const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { sendExpoPush, notifyUid } = require("./notify");

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const RESERVED = new Set(["admin", "support", "uvel", "official", "help", "null", "undefined"]);

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase().replace(/^@+/, "");
}

exports.claimUsername = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in before choosing a username.");
  const username = normalizeUsername(req.data && req.data.username);
  if (!USERNAME_PATTERN.test(username) || RESERVED.has(username)) {
    throw new HttpsError("invalid-argument", "Use 3–20 lowercase letters, numbers, or underscores.");
  }
  const db = admin.firestore();
  const usernameRef = db.collection("usernames").doc(username);
  const userRef = db.collection("users").doc(req.auth.uid);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(usernameRef);
    if (existing.exists && existing.data().uid !== req.auth.uid) {
      throw new HttpsError("already-exists", "That username is already taken.");
    }
    tx.set(usernameRef, { uid: req.auth.uid, username, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    tx.set(userRef, { username, usernameNormalized: username, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  return { username };
});

function publicUser(uid, data) {
  return { uid, username: data.username || "", displayName: data.name || data.displayName || "", avatarUri: data.avatarUri || data.personUri || "" };
}

function blockKey(fromUid, toUid) { return `${fromUid}_${toUid}`; }

async function isBlocked(db, fromUid, toUid) {
  const [a, b] = await Promise.all([db.collection("blocks").doc(blockKey(fromUid, toUid)).get(), db.collection("blocks").doc(blockKey(toUid, fromUid)).get()]);
  return a.exists || b.exists;
}

exports.searchUsers = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in before searching for friends.");
  const term = String(req.data && req.data.term || "").trim().toLowerCase().slice(0, 40);
  if (term.length < 2) return { users: [] };
  const db = admin.firestore();
  const [byUsername, byName] = await Promise.all([
    db.collection("users").where("username", ">=", term).where("username", "<=", `${term}\uf8ff`).limit(12).get(),
    db.collection("users").where("nameLower", ">=", term).where("nameLower", "<=", `${term}\uf8ff`).limit(12).get(),
  ]);
  const seen = new Set();
  const users = [...byUsername.docs, ...byName.docs].filter((snap) => {
    if (snap.id === req.auth.uid || seen.has(snap.id)) return false;
    seen.add(snap.id);
    return true;
  }).slice(0, 20).map((snap) => publicUser(snap.id, snap.data() || {}));
  return { users };
});

exports.sendFriendRequest = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in before adding a friend.");
  const toUid = String(req.data && req.data.toUid || "").trim();
  if (!toUid || toUid === req.auth.uid) throw new HttpsError("invalid-argument", "That friend request is not valid.");
  const db = admin.firestore();
  if (await isBlocked(db, req.auth.uid, toUid)) throw new HttpsError("permission-denied", "You can’t add this user.");
  const [fromSnap, toSnap] = await Promise.all([db.collection("users").doc(req.auth.uid).get(), db.collection("users").doc(toUid).get()]);
  if (!toSnap.exists) throw new HttpsError("not-found", "User not found.");
  const from = publicUser(req.auth.uid, fromSnap.data() || {});
  const to = publicUser(toUid, toSnap.data() || {});
  const requestId = `${req.auth.uid}_${toUid}`;
  const requestRef = db.collection("friendRequests").doc(requestId);
  const notificationRef = db.collection("users").doc(toUid).collection("notifications").doc(requestId);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(requestRef);
    if (existing.exists && ["pending", "accepted"].includes(existing.data().status)) return;
    tx.set(requestRef, { fromUid: req.auth.uid, toUid, from, to, status: "pending", createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    tx.set(notificationRef, { kind: "friend_request", requestId, actor: from, readAt: null, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  await sendExpoPush(toSnap.data().expoPushToken, `${from.displayName || "Someone"} added you`, "They want to be friends on Uvel.", { kind: "friend_request", requestId });
  return { requestId, status: "pending" };
});

exports.respondFriendRequest = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in before responding to a friend request.");
  const requestId = String(req.data && req.data.requestId || "").trim();
  const action = String(req.data && req.data.action || "");
  if (!requestId || !["accepted", "declined"].includes(action)) throw new HttpsError("invalid-argument", "That friend request action is not valid.");
  const db = admin.firestore();
  const requestRef = db.collection("friendRequests").doc(requestId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(requestRef);
    if (!snap.exists || snap.data().toUid !== req.auth.uid || snap.data().status !== "pending") throw new HttpsError("failed-precondition", "That request is no longer available.");
    const data = snap.data();
    tx.update(requestRef, { status: action, respondedAt: admin.firestore.FieldValue.serverTimestamp() });
    tx.update(db.collection("users").doc(req.auth.uid).collection("notifications").doc(requestId), { readAt: admin.firestore.FieldValue.serverTimestamp() });
    if (action === "accepted") {
      const pair = [data.fromUid, data.toUid].sort().join("_");
      tx.set(db.collection("friendships").doc(pair), { userIds: [data.fromUid, data.toUid], createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(db.collection("users").doc(data.fromUid).collection("notifications").doc(`friend_${pair}`), { kind: "friend_accepted", requestId, actor: data.to, readAt: null, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
  });
  if (action === "accepted") {
    const snap = await requestRef.get();
    const data = snap.data() || {};
    const acceptor = data.to && data.to.displayName ? data.to.displayName : "Your friend";
    await notifyUid(admin.firestore(), data.fromUid, `${acceptor} accepted`, "You’re friends on Uvel. Send a message.", { kind: "friend_accepted", requestId });
  }
  return { requestId, status: action };
});

exports.listFriends = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in before loading friends.");
  const db = admin.firestore();
  const snap = await db.collection("friendships").where("userIds", "array-contains", req.auth.uid).limit(100).get();
  const ids = snap.docs.map((doc) => (doc.data().userIds || []).find((id) => id !== req.auth.uid)).filter(Boolean);
  const users = await Promise.all(ids.map(async (uid) => {
    const user = await db.collection("users").doc(uid).get();
    return user.exists ? publicUser(uid, user.data() || {}) : null;
  }));
  return { users: users.filter(Boolean) };
});

exports.createFriendChat = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in before chatting.");
  const otherUid = String(req.data && req.data.otherUid || "").trim();
  if (!otherUid || otherUid === req.auth.uid) throw new HttpsError("invalid-argument", "That friend is not valid.");
  const pair = [req.auth.uid, otherUid].sort();
  const db = admin.firestore();
  if (await isBlocked(db, req.auth.uid, otherUid)) throw new HttpsError("permission-denied", "You can’t message this user.");
  const friendship = await db.collection("friendships").doc(pair.join("_")).get();
  if (!friendship.exists) throw new HttpsError("permission-denied", "You can only message friends.");
  const id = pair.join("_");
  await db.collection("friendChats").doc(id).set({ participantIds: pair, type: "friend", updatedAt: admin.firestore.FieldValue.serverTimestamp(), createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { conversationId: id };
});

exports.sendFriendMessage = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in before sending a message.");
  const conversationId = String(req.data && req.data.conversationId || "").trim();
  const text = String(req.data && req.data.text || "").trim().slice(0, 2000);
  const photoUrl = String(req.data && req.data.photoUrl || "").trim().slice(0, 2000);
  if (!conversationId || (!text && !photoUrl)) throw new HttpsError("invalid-argument", "Message text or photo is required.");
  const db = admin.firestore();
  const threadRef = db.collection("friendChats").doc(conversationId);
  const thread = await threadRef.get();
  if (!thread.exists || !(thread.data().participantIds || []).includes(req.auth.uid)) throw new HttpsError("permission-denied", "You are not in this conversation.");
  const participants = thread.data().participantIds || [];
  const recipient = participants.find((uid) => uid !== req.auth.uid);
  if (recipient && await isBlocked(db, req.auth.uid, recipient)) throw new HttpsError("permission-denied", "Messaging is unavailable for this user.");
  const messageRef = threadRef.collection("messages").doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.runTransaction(async (tx) => {
    tx.set(messageRef, { text, photoUrl: photoUrl || null, from: req.auth.uid, createdAt: now, status: "sent", kind: photoUrl ? "photo" : "text" });
    tx.update(threadRef, { lastText: text || "Sent a photo", lastFrom: req.auth.uid, lastAt: now, updatedAt: now, [`unreadBy.${recipient}`]: admin.firestore.FieldValue.increment(1) });
  });
  const recipientSnap = recipient ? await db.collection("users").doc(recipient).get() : null;
  const fromSnap = await db.collection("users").doc(req.auth.uid).get();
  const fromName = publicUser(req.auth.uid, fromSnap.data() || {}).displayName || "A friend";
  await sendExpoPush(recipientSnap && recipientSnap.data().expoPushToken, `${fromName} sent you a message`, text || "Sent a photo", { kind: "friend_message", conversationId });
  return { messageId: messageRef.id };
});

const { onSchedule } = require("firebase-functions/v2/scheduler");

const TODAY_NUDGES = [
  { title: "Today’s floor is up", body: "A few pieces landed that look like you." },
  { title: "Come pick through Today", body: "Nothing loud. Just clothes." },
  { title: "Your edit is waiting", body: "Open Uvel when you’ve got a minute." },
];

exports.nudgeQuietUsers = onSchedule({ schedule: "0 16 * * *", timeZone: "America/New_York" }, async () => {
  const db = admin.firestore();
  const cutoff = Date.now() - 36 * 60 * 60 * 1000;
  const snap = await db.collection("users").where("wantsUpdates", "==", true).limit(400).get();
  const pick = TODAY_NUDGES[Math.floor(Math.random() * TODAY_NUDGES.length)];
  await Promise.all(snap.docs.map(async (doc) => {
    const user = doc.data() || {};
    if (!user.expoPushToken) return;
    const last = typeof user.lastSeen === "number" ? user.lastSeen : 0;
    if (last && last > cutoff) return;
    await sendExpoPush(user.expoPushToken, pick.title, pick.body, { kind: "today" });
  }));
});

exports.listFriendChats = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in before loading chats.");
  const snap = await admin.firestore().collection("friendChats").where("participantIds", "array-contains", req.auth.uid).orderBy("updatedAt", "desc").limit(50).get();
  return { chats: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});

exports.uploadFriendAttachment = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in before uploading.");
  const base64 = String(req.data && req.data.base64 || "");
  const contentType = String(req.data && req.data.contentType || "image/jpeg");
  if (!base64 || !/^image\/(jpeg|png|webp)$/.test(contentType) || base64.length > 3500000) throw new HttpsError("invalid-argument", "That image is too large or unsupported.");
  const bucket = admin.storage().bucket();
  const path = `friend-attachments/${req.auth.uid}/${crypto.randomUUID()}.${contentType.split("/")[1]}`;
  const file = bucket.file(path);
  await file.save(Buffer.from(base64, "base64"), { metadata: { contentType, metadata: { ownerId: req.auth.uid } } });
  const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 1000 * 60 * 60 * 24 * 30 });
  return { url };
});

exports.blockFriend = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in before blocking a user.");
  const blockedUid = String(req.data && req.data.blockedUid || "").trim();
  if (!blockedUid || blockedUid === req.auth.uid) throw new HttpsError("invalid-argument", "That user is not valid.");
  await admin.firestore().collection("blocks").doc(blockKey(req.auth.uid, blockedUid)).set({ blockerUid: req.auth.uid, blockedUid, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { blockedUid };
});

exports.reportFriendConversation = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in before reporting.");
  const conversationId = String(req.data && req.data.conversationId || "").trim();
  const reason = String(req.data && req.data.reason || "").trim().slice(0, 300);
  if (!conversationId || !reason) throw new HttpsError("invalid-argument", "A conversation and reason are required.");
  await admin.firestore().collection("friendReports").add({ conversationId, reporterUid: req.auth.uid, reason, createdAt: admin.firestore.FieldValue.serverTimestamp(), status: "open" });
  return { reported: true };
});
