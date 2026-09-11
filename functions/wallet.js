const { HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const RELEASE_MS = 2 * 24 * 60 * 60 * 1000;

function saleNet(order) {
  return Math.max(0, Math.floor(Number(order.itemCents || 0)) - Math.floor(Number(order.discountCents || 0)));
}

function walletRef(db, uid) {
  return db.collection("wallets").doc(uid);
}

function increment(value) {
  return admin.firestore.FieldValue.increment(value);
}

async function creditSellerPending(orderId) {
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) return;
    const order = snap.data() || {};
    if (order.status !== "paid" || order.walletCredited) return;
    const sellerId = String(order.sellerId || "").trim();
    const net = saleNet(order);
    if (!sellerId || sellerId === "seller" || sellerId === String(order.buyerId || "")) {
      tx.set(orderRef, { walletCredited: true }, { merge: true });
      return;
    }
    const currency = String(order.currency || "USD").toUpperCase();
    tx.set(walletRef(db, sellerId), {
      uid: sellerId,
      pendingCents: increment(net),
      availableCents: increment(0),
      currency,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    const entryId = `sale-${orderId}`;
    tx.set(db.collection("walletEntries").doc(entryId), {
      id: entryId,
      uid: sellerId,
      orderId,
      type: "sale",
      status: "pending",
      amountCents: net,
      currency,
      pieceName: String(order.pieceName || ""),
      piecePhoto: String(order.piecePhoto || ""),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(orderRef, { walletCredited: true, walletPendingCents: net }, { merge: true });
  });
}

async function releaseSellerWallet(orderId, reason) {
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) return;
    const order = snap.data() || {};
    if (order.status !== "paid" || order.walletReleased || order.refundStatus === "succeeded") return;
    const sellerId = String(order.sellerId || "").trim();
    const net = Math.max(0, Math.floor(Number(order.walletPendingCents || saleNet(order))));
    if (!sellerId || !net) {
      tx.set(orderRef, { walletReleased: true }, { merge: true });
      return;
    }
    tx.set(walletRef(db, sellerId), {
      pendingCents: increment(-net),
      availableCents: increment(net),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(db.collection("walletEntries").doc(`sale-${orderId}`), {
      status: "available",
      releasedAt: admin.firestore.FieldValue.serverTimestamp(),
      releaseReason: reason || "completed",
    }, { merge: true });
    tx.set(orderRef, { walletReleased: true, walletReleasedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
}

async function voidSellerWallet(orderId) {
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) return;
    const order = snap.data() || {};
    if (order.walletVoided) return;
    const sellerId = String(order.sellerId || "").trim();
    const net = Math.max(0, Math.floor(Number(order.walletPendingCents || saleNet(order))));
    if (!sellerId || !net) {
      tx.set(orderRef, { walletVoided: true }, { merge: true });
      return;
    }
    const patch = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (order.walletReleased) patch.availableCents = increment(-net);
    else patch.pendingCents = increment(-net);
    tx.set(walletRef(db, sellerId), patch, { merge: true });
    tx.set(db.collection("walletEntries").doc(`sale-${orderId}`), {
      status: "void",
      voidedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(orderRef, { walletVoided: true }, { merge: true });
  });
}

async function confirmOrderReceivedHandler(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const orderId = String(req.data?.orderId || "").trim();
  if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(orderId)) throw new HttpsError("invalid-argument", "Invalid order.");
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = snap.data() || {};
  if (order.buyerId !== req.auth.uid) throw new HttpsError("permission-denied", "Only the buyer can confirm this order.");
  if (order.status !== "paid") throw new HttpsError("failed-precondition", "This order is not paid yet.");
  const fulfillment = String(order.fulfillmentStatus || "unfulfilled");
  if (!["shipped", "delivered"].includes(fulfillment)) throw new HttpsError("failed-precondition", "Confirm after the piece is on the way.");
  const resolution = order.resolution || {};
  if (resolution.status && !["rejected", "closed"].includes(String(resolution.status))) {
    throw new HttpsError("failed-precondition", "This order has an open claim.");
  }
  const now = admin.firestore.FieldValue.serverTimestamp();
  await orderRef.set({
    buyerConfirmedAt: now,
    fulfillmentStatus: "delivered",
    deliveredAt: order.deliveredAt || now,
    fulfillmentUpdatedAt: now,
  }, { merge: true });
  await releaseSellerWallet(orderId, "buyer_confirmed");
  return { ok: true, orderId };
}

async function releaseDueWalletsHandler() {
  const db = admin.firestore();
  const snap = await db.collection("orders").where("status", "==", "paid").where("fulfillmentStatus", "==", "delivered").get();
  const now = Date.now();
  let released = 0;
  for (const doc of snap.docs) {
    const order = doc.data() || {};
    if (order.walletReleased || order.walletVoided || order.refundStatus === "succeeded") continue;
    const deliveredAt = order.deliveredAt && typeof order.deliveredAt.toMillis === "function" ? order.deliveredAt.toMillis() : Number(order.deliveredAt || 0);
    const confirmed = order.buyerConfirmedAt != null;
    if (!confirmed && deliveredAt && now - deliveredAt < RELEASE_MS) continue;
    await releaseSellerWallet(doc.id, confirmed ? "buyer_confirmed" : "auto_release");
    released += 1;
  }
  return { ok: true, released };
}

async function saveUserPayoutProfileHandler(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const input = req.data || {};
  const destinationType = String(input.destinationType || "");
  const country = String(input.country || "").toUpperCase();
  const currency = String(input.currency || "").toUpperCase();
  const accountHolderName = String(input.accountHolderName || "").trim().slice(0, 160);
  const institutionName = String(input.institutionName || "").trim().slice(0, 160);
  const destination = String(input.destination || "").replace(/\D/g, "");
  if (!["bank", "mobile_money"].includes(destinationType) || !/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency) || !accountHolderName || !institutionName || destination.length < 4) {
    throw new HttpsError("invalid-argument", "Complete your payout details.");
  }
  const uid = req.auth.uid;
  const profile = {
    uid,
    status: "submitted",
    destinationType,
    country,
    currency,
    accountHolderName,
    institutionName,
    destinationLast4: destination.slice(-4),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await admin.firestore().collection("userPayoutProfiles").doc(uid).set(profile, { merge: true });
  return { ok: true, status: "submitted", destinationLast4: profile.destinationLast4 };
}

async function requestSellerPayoutHandler(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const currency = String(req.data?.currency || "").toUpperCase();
  const amountCents = Number(req.data?.amountCents);
  if (!/^[A-Z]{3}$/.test(currency) || !Number.isSafeInteger(amountCents) || amountCents < 10) {
    throw new HttpsError("invalid-argument", "Invalid payout amount.");
  }
  const uid = req.auth.uid;
  const db = admin.firestore();
  const profileSnap = await db.collection("userPayoutProfiles").doc(uid).get();
  if (!profileSnap.exists) throw new HttpsError("failed-precondition", "Add a bank or mobile money account first.");
  const payoutId = `upayout-${Date.now().toString(36)}`;
  await db.runTransaction(async (tx) => {
    const wsnap = await tx.get(walletRef(db, uid));
    const wallet = wsnap.data() || {};
    const available = Math.max(0, Math.floor(Number(wallet.availableCents || 0)));
    if (amountCents > available) throw new HttpsError("failed-precondition", "Payout amount exceeds your available balance.");
    tx.set(walletRef(db, uid), {
      availableCents: increment(-amountCents),
      paidOutCents: increment(amountCents),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(db.collection("userPayouts").doc(payoutId), {
      id: payoutId,
      uid,
      currency,
      amountCents,
      status: "requested",
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(db.collection("walletEntries").doc(`payout-${payoutId}`), {
      id: `payout-${payoutId}`,
      uid,
      type: "payout",
      status: "requested",
      amountCents: -amountCents,
      currency,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { ok: true, payoutId, status: "requested" };
}

async function payWithWalletHandler(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const orderId = String(req.data?.orderId || "").trim();
  if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(orderId)) throw new HttpsError("invalid-argument", "Invalid order.");
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
    const order = snap.data() || {};
    if (order.buyerId !== req.auth.uid || order.status !== "pending") throw new HttpsError("failed-precondition", "Order is not available for payment.");
    const total = Math.max(0, Math.floor(Number(order.totalCents || 0)));
    const wref = walletRef(db, req.auth.uid);
    const wsnap = await tx.get(wref);
    const available = Math.max(0, Math.floor(Number((wsnap.data() || {}).availableCents || 0)));
    if (available < total) throw new HttpsError("failed-precondition", "Your Uvel balance is not enough for this order.");
    const paidAt = admin.firestore.FieldValue.serverTimestamp();
    tx.set(wref, {
      availableCents: increment(-total),
      updatedAt: paidAt,
    }, { merge: true });
    tx.set(db.collection("walletEntries").doc(`spend-${orderId}`), {
      id: `spend-${orderId}`,
      uid: req.auth.uid,
      orderId,
      type: "spend",
      status: "available",
      amountCents: -total,
      currency: String(order.currency || "USD").toUpperCase(),
      pieceName: String(order.pieceName || ""),
      createdAt: paidAt,
    });
    tx.set(orderRef, {
      status: "paid",
      fulfillmentStatus: "unfulfilled",
      paymentProvider: "wallet",
      paymentReference: `wallet-${orderId}`,
      payMethod: "Uvel balance",
      paidAt,
    }, { merge: true });
  });
  await creditSellerPending(orderId);
  return { ok: true, orderId, processor: "wallet" };
}

module.exports = {
  creditSellerPending,
  releaseSellerWallet,
  voidSellerWallet,
  confirmOrderReceivedHandler,
  releaseDueWalletsHandler,
  saveUserPayoutProfileHandler,
  requestSellerPayoutHandler,
  payWithWalletHandler,
};
