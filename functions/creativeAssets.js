'use strict';
const admin = require('firebase-admin');
const sharp = require('sharp');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');

if (!admin.apps.length) admin.initializeApp({ storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'uvel-32d32.firebasestorage.app' });
const openaiImageSecret = defineSecret('OPENAI_API_KEY');
const MAX_BYTES = 8 * 1024 * 1024;

function sourcePath(data) {
  return Array.isArray(data?.photoStoragePaths) && data.photoStoragePaths[0]
    ? String(data.photoStoragePaths[0])
    : '';
}

async function makeCutout(bytes, apiKey) {
  const jpeg = await sharp(bytes, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt: 'Use the reference product photograph exactly. Isolate the primary product or visible wearer as the complete subject, following its natural irregular silhouette. Remove every background pixel, room, floor, furniture, props, and cast environmental shadow. Preserve the exact product identity, color, material, pose, proportions, texture, and fine edges. Do not crop into a rectangle. Do not add a frame, border, circle, oval, rounded rectangle, solid background, colored background, or checkerboard. Return only the subject with true transparent alpha surrounding it.',
      images: [{ image_url: `data:image/jpeg;base64,${jpeg.toString('base64')}` }],
      size: '1024x1536',
      quality: 'medium',
      background: 'transparent',
      output_format: 'png',
    }),
  });
  const text = await response.text();
  let payload = {};
  try { payload = JSON.parse(text); } catch { /* handled below */ }
  if (!response.ok) throw new Error(String(payload?.error?.message || `Cutout generation failed (${response.status}).`).slice(0, 240));
  const encoded = String(payload?.data?.[0]?.b64_json || '');
  if (!encoded) throw new Error('Cutout generation returned no image.');
  const output = Buffer.from(encoded, 'base64');
  if (!output.length || output.length > 20 * 1024 * 1024) throw new Error('Generated cutout is invalid.');
  return output;
}

exports.processListingCreativeAsset = onDocumentWritten({
  document: 'listings/{listingId}',
  secrets: [openaiImageSecret],
  timeoutSeconds: 180,
  memory: '1GiB',
  maxInstances: 4,
  retry: true,
}, async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;
  const data = after.data() || {};
  if (String(data.status || '') !== 'listed' || data.brandId) return;
  const inputPath = sourcePath(data);
  if (!inputPath || data.creativeCutoutSourcePath === inputPath || data.cutoutStatus === 'processing') return;
  const db = admin.firestore();
  const listingRef = after.ref;
  const claim = await db.runTransaction(async (tx) => {
    const current = await tx.get(listingRef);
    if (!current.exists) return false;
    const currentData = current.data() || {};
    if (String(currentData.status || '') !== 'listed' || currentData.brandId || !sourcePath(currentData)) return false;
    if (currentData.cutoutStatus === 'processing' || currentData.creativeCutoutSourcePath === sourcePath(currentData)) return false;
    tx.set(listingRef, { cutoutStatus: 'processing', creativeEligible: false, creativeCutoutSourcePath: sourcePath(currentData), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
  if (!claim) return;
  try {
    const apiKey = openaiImageSecret.value();
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');
    const bucket = admin.storage().bucket();
    const [bytes] = await bucket.file(inputPath).download();
    if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('Source image is unavailable or too large.');
    const output = await makeCutout(bytes, apiKey);
    const cutoutPath = `creative-cutouts/${event.params.listingId}/${require('crypto').createHash('sha256').update(inputPath).digest('hex').slice(0, 16)}.png`;
    const cutoutFile = bucket.file(cutoutPath);
    await cutoutFile.save(output, { resumable: false, metadata: { contentType: 'image/png', metadata: { listingId: event.params.listingId, sourcePath: inputPath, assetType: 'transparent-product-cutout' } } });
    const [cutoutPhoto] = await cutoutFile.getSignedUrl({ action: 'read', expires: '2500-01-01' });
    await listingRef.set({ cutoutPhoto, cutoutPhotoPath: cutoutPath, cutoutStatus: 'ready', creativeEligible: true, cutoutUpdatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  } catch (error) {
    await listingRef.set({ cutoutStatus: 'failed', creativeEligible: false, cutoutError: String(error?.message || error).slice(0, 240), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
});
