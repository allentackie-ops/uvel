'use strict';

const crypto = require('node:crypto');
const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const MAX_BASE64_CHARS = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1_500_000;

function decodeJpeg(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_BASE64_CHARS) {
    throw new HttpsError('invalid-argument', 'Profile photo is empty or too large.');
  }
  const base64 = value.replace(/^data:image\/jpeg;base64,/i, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 === 1) {
    throw new HttpsError('invalid-argument', 'Profile photo is not a valid JPEG.');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')) {
    throw new HttpsError('invalid-argument', 'Profile photo is not a valid JPEG.');
  }
  if (bytes.length < 4 || bytes.length > MAX_IMAGE_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new HttpsError('invalid-argument', 'Profile photo must be a JPEG under 1.5 MB.');
  }
  return bytes;
}

async function syncPersonalListingPhotos(db, uid, avatarUri) {
  const [byListedBy, byOwner] = await Promise.all([
    db.collection('listings').where('listedByUid', '==', uid).get(),
    db.collection('listings').where('ownerId', '==', uid).get(),
  ]);
  const docs = new Map();
  for (const snap of [byListedBy, byOwner]) {
    for (const document of snap.docs) docs.set(document.id, document);
  }
  const updates = [...docs.values()].filter((document) => {
    const listing = document.data() || {};
    return listing.status === 'listed' && !listing.brandId && listing.ownerPhoto !== avatarUri;
  });

  for (let index = 0; index < updates.length; index += 450) {
    const batch = db.batch();
    for (const document of updates.slice(index, index + 450)) {
      batch.update(document.ref, {
        ownerPhoto: avatarUri,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return updates.length;
}

exports.updateProfileAvatar = onCall({ timeoutSeconds: 60, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before changing your profile picture.');
  const bytes = decodeJpeg(request.data?.imageBase64);
  const uid = request.auth.uid;
  const objectPath = `users/${uid}/avatar.jpg`;
  const token = crypto.randomUUID();
  const bucket = admin.storage().bucket();
  const file = bucket.file(objectPath);

  try {
    await file.save(bytes, {
      resumable: false,
      metadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=300',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    const avatarUri = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
    const db = admin.firestore();
    await db.collection('users').doc(uid).set({
      avatarUri,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    const updatedListings = await syncPersonalListingPhotos(db, uid, avatarUri);
    return { avatarUri, updatedListings };
  } catch (error) {
    console.error('Profile avatar sync failed', { uid, message: error?.message || String(error) });
    throw new HttpsError('internal', 'Could not update your profile picture. Please try again.');
  }
});
