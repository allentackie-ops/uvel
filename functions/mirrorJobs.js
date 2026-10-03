const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const sharp = require("sharp");
const { notifyUid } = require("./notify");

if (!admin.apps.length) admin.initializeApp({ storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "uvel-32d32.firebasestorage.app" });

const openaiImageSecret = defineSecret("OPENAI_API_KEY");
const DAILY_LIMIT = 3;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const ACTIVE_JOB_STALE_MS = 15 * 60 * 1000;
const JOB_TIMEOUT_MS = 170 * 1000;
const ALLOWED_SOURCE_KINDS = new Set(["uvel", "photo", "link"]);
const PROMPT =
  "Photo edit, not a new picture. Image 1 is the original phone photo of the person — keep it faithful: same face, hair, skin texture, body, pose, hands, accessories, room, lighting, and camera grain. Do not redraw, smooth, beautify, illustrate, paint, or CGI the person or the room. Image 2 is the garment reference. Put that exact garment on the person with realistic fit, fabric folds, and shadows matching the original photo. Only change the clothing area needed to show the garment. Preserve the person's identity and pose. No illustration, painting, airbrush, mannequin, collage, or text.";

function utcDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function validId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{12,80}$/.test(value);
}

async function validateInput(bucket, path) {
  const [metadata] = await bucket.file(path).getMetadata().catch(() => {
    throw new HttpsError("failed-precondition", "A Mirror photo could not be uploaded. Please choose it again.");
  });
  const size = Number(metadata.size || 0);
  const contentType = String(metadata.contentType || "").toLowerCase();
  if (!contentType.startsWith("image/") || size < 1 || size > MAX_INPUT_BYTES) {
    throw new HttpsError("invalid-argument", "Choose image files smaller than 8 MB.");
  }
}

exports.startMirrorJob = onCall({ region: "us-central1", timeoutSeconds: 60 }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to create a Mirror look.");
  const uid = request.auth.uid;
  const data = request.data || {};
  const jobId = String(data.jobId || "");
  const sourceKind = String(data.sourceKind || "");
  if (!validId(jobId) || !ALLOWED_SOURCE_KINDS.has(sourceKind)) {
    throw new HttpsError("invalid-argument", "Invalid Mirror request.");
  }

  const personPath = `users/${uid}/mirror-jobs/${jobId}/person.jpg`;
  const garmentPath = `users/${uid}/mirror-jobs/${jobId}/garment.jpg`;
  const bucket = admin.storage().bucket();
  await Promise.all([validateInput(bucket, personPath), validateInput(bucket, garmentPath)]);

  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);
  const jobRef = userRef.collection("mirrorJobs").doc(jobId);
  const usageRef = userRef.collection("mirrorUsage").doc("current");
  const today = utcDayKey();
  const now = Date.now();
  let remainingToday = DAILY_LIMIT;

  await db.runTransaction(async (transaction) => {
    const [userSnapshot, existingJob, usageSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(jobRef),
      transaction.get(usageRef),
    ]);
    const userData = userSnapshot.exists ? userSnapshot.data() || {} : {};
    if (!userSnapshot.exists || userData.deletionStatus === "deactivated") {
      throw new HttpsError("permission-denied", "This account can’t create a Mirror look right now.");
    }
    if (existingJob.exists) {
      const existing = existingJob.data() || {};
      if (existing.uid !== uid) throw new HttpsError("permission-denied", "This Mirror request is not yours.");
      const usage = usageSnapshot.exists ? usageSnapshot.data() || {} : {};
      remainingToday = Math.max(0, DAILY_LIMIT - (usage.dayKey === today ? Number(usage.count || 0) : 0));
      return;
    }

    const usage = usageSnapshot.exists ? usageSnapshot.data() || {} : {};
    const count = usage.dayKey === today ? Number(usage.count || 0) : 0;
    if (usage.activeJobId) {
      const activeRef = userRef.collection("mirrorJobs").doc(String(usage.activeJobId));
      const activeSnapshot = await transaction.get(activeRef);
      const activeStatus = activeSnapshot.exists ? String(activeSnapshot.data()?.status || "") : "";
      const activeAt = Number(usage.activeAt || 0);
      const stillRunning = ["queued", "processing"].includes(activeStatus) && now - activeAt < ACTIVE_JOB_STALE_MS;
      if (stillRunning) {
        throw new HttpsError("resource-exhausted", "A Mirror look is already being created. Wait for it to finish first.");
      }
    }
    if (count >= DAILY_LIMIT) {
      throw new HttpsError("resource-exhausted", "You’ve reached today’s Mirror limit. Try again tomorrow.");
    }

    const garmentName = String(data.garmentName || "this piece").trim().slice(0, 100) || "this piece";
    const pieceId = typeof data.pieceId === "string" ? data.pieceId.slice(0, 160) : "";
    transaction.set(usageRef, {
      dayKey: today,
      count: count + 1,
      activeJobId: jobId,
      activeAt: now,
      updatedAt: now,
    }, { merge: true });
    transaction.create(jobRef, {
      id: jobId,
      uid,
      status: "queued",
      sourceKind,
      garmentName,
      ...(pieceId ? { pieceId } : {}),
      personPath,
      garmentPath,
      resultPath: "",
      createdAt: now,
      updatedAt: now,
    });
    remainingToday = DAILY_LIMIT - count - 1;
  });

  return { ok: true, jobId, status: "queued", remainingToday };
});

exports.cleanupMirrorInputs = onCall({ region: "us-central1", timeoutSeconds: 30 }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const jobId = String(request.data?.jobId || "");
  if (!validId(jobId)) throw new HttpsError("invalid-argument", "Invalid Mirror request.");
  const db = admin.firestore();
  const jobRef = db.collection("users").doc(request.auth.uid).collection("mirrorJobs").doc(jobId);
  if ((await jobRef.get()).exists) throw new HttpsError("failed-precondition", "This Mirror look has already started.");
  const bucket = admin.storage().bucket();
  await Promise.all([
    bucket.file(`users/${request.auth.uid}/mirror-jobs/${jobId}/person.jpg`).delete().catch(() => undefined),
    bucket.file(`users/${request.auth.uid}/mirror-jobs/${jobId}/garment.jpg`).delete().catch(() => undefined),
  ]);
  return { ok: true };
});

async function releaseActiveJob(db, uid, jobId) {
  const usageRef = db.collection("users").doc(uid).collection("mirrorUsage").doc("current");
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(usageRef);
    if (!snapshot.exists || String(snapshot.data()?.activeJobId || "") !== jobId) return;
    transaction.set(usageRef, {
      activeJobId: admin.firestore.FieldValue.delete(),
      activeAt: admin.firestore.FieldValue.delete(),
      updatedAt: Date.now(),
    }, { merge: true });
  });
}

function publicFailure(error) {
  const text = String(error?.message || error || "").toLowerCase();
  if (text.includes("moderation") || text.includes("safety") || text.includes("image_rejected")) {
    return "We couldn’t use one of those images. Try a different photo or clothing piece.";
  }
  if (text.includes("429") || text.includes("rate_limit")) {
    return "Mirror is busy right now. Please try again in a little while.";
  }
  return "We couldn’t finish this look. Your photos were removed from processing storage; please try again.";
}

async function notifyMirrorCompletion(db, uid, jobId, succeeded) {
  const title = succeeded ? "Your Mirror look is ready" : "Your Mirror look couldn’t finish";
  const body = succeeded ? "Tap to see the look you created." : "Tap to return to Mirror and try another photo or piece.";
  const kind = succeeded ? "mirror_ready" : "mirror_failed";
  const notificationId = `mirror-${jobId}`;
  await Promise.all([
    db.collection("users").doc(uid).collection("notifications").doc(notificationId).set({
      id: notificationId,
      kind,
      title,
      body,
      mirrorJobId: jobId,
      readAt: null,
      createdAt: Date.now(),
    }, { merge: true }).catch(() => undefined),
    notifyUid(db, uid, title, body, { kind, jobId }).catch(() => undefined),
  ]);
}

exports.processMirrorJob = onDocumentCreated({
  document: "users/{uid}/mirrorJobs/{jobId}",
  secrets: [openaiImageSecret],
  timeoutSeconds: 180,
  memory: "1GiB",
  maxInstances: 4,
  retry: true,
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot?.exists) return;
  const db = admin.firestore();
  const jobRef = snapshot.ref;
  const uid = String(event.params.uid || "");
  const jobId = String(event.params.jobId || "");
  let claimed = false;
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(jobRef);
    if (!current.exists) return;
    const data = current.data() || {};
    const status = String(data.status || "");
    const startedAt = Number(data.startedAt || 0);
    if (status !== "queued" && !(status === "processing" && Date.now() - startedAt > JOB_TIMEOUT_MS + 30_000)) return;
    transaction.update(jobRef, { status: "processing", startedAt: Date.now(), updatedAt: Date.now() });
    claimed = true;
  });
  if (!claimed) return;

  const job = snapshot.data() || {};
  const bucket = admin.storage().bucket();
  const personFile = bucket.file(String(job.personPath || ""));
  const garmentFile = bucket.file(String(job.garmentPath || ""));
  let completed = false;
  let resultFile = null;
  try {
    const apiKey = openaiImageSecret.value();
    if (!apiKey) throw new Error("The image service is not configured.");
    const [[personBytes], [garmentBytes]] = await Promise.all([personFile.download(), garmentFile.download()]);
    const [personJpeg, garmentJpeg] = await Promise.all([
      sharp(personBytes, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1200, height: 1800, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
      sharp(garmentBytes, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1000, height: 1400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
    ]);
    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(JOB_TIMEOUT_MS),
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt: PROMPT,
        images: [
          { image_url: `data:image/jpeg;base64,${personJpeg.toString("base64")}` },
          { image_url: `data:image/jpeg;base64,${garmentJpeg.toString("base64")}` },
        ],
        size: "1024x1536",
        quality: "medium",
        moderation: "auto",
        output_format: "jpeg",
      }),
    });
    const responseText = await response.text();
    let payload;
    try { payload = JSON.parse(responseText); } catch { payload = {}; }
    if (!response.ok) {
      const message = String(payload?.error?.message || `OpenAI request failed (${response.status}).`);
      throw new Error(message.slice(0, 240));
    }
    const encoded = String(payload?.data?.[0]?.b64_json || "");
    if (!encoded) throw new Error("The image service returned no edited image.");
    const output = Buffer.from(encoded, "base64");
    if (!output.length || output.length > 20 * 1024 * 1024) throw new Error("The generated image could not be saved.");
    const resultPath = `users/${uid}/mirror-jobs/${jobId}/result.jpg`;
    resultFile = bucket.file(resultPath);
    await resultFile.save(output, {
      resumable: false,
      metadata: {
        contentType: "image/jpeg",
        metadata: { ownerUid: uid, mirrorJobId: jobId },
      },
    });
    const [resultUrl] = await resultFile.getSignedUrl({ action: "read", expires: "2500-01-01" });
    await jobRef.update({
      status: "completed",
      resultPath,
      resultUrl,
      completedAt: Date.now(),
      updatedAt: Date.now(),
      errorMessage: "",
    });
    completed = true;
  } catch (error) {
    await resultFile?.delete().catch(() => undefined);
    await jobRef.update({
      status: "failed",
      errorMessage: publicFailure(error),
      completedAt: Date.now(),
      updatedAt: Date.now(),
    }).catch(() => undefined);
  } finally {
    await Promise.all([
      personFile.delete().catch(() => undefined),
      garmentFile.delete().catch(() => undefined),
      releaseActiveJob(db, uid, jobId).catch(() => undefined),
    ]);
    await notifyMirrorCompletion(db, uid, jobId, completed).catch(() => undefined);
  }
});
