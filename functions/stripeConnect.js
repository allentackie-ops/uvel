const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

const stripeSecret = defineSecret("STRIPE_SECRET");
const MIN_PAYOUT_CENTS = 100;

function stripeClient() {
  const key = stripeSecret.value();
  if (!key) throw new HttpsError("failed-precondition", "Stripe is not connected yet.");
  return require("stripe")(key);
}

function profileRef(uid) {
  return admin.firestore().collection("userPayoutProfiles").doc(uid);
}

function normalizeCountry(value) {
  return String(value || "").trim().toUpperCase();
}

async function createConnectAccountHandler(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = req.auth.uid;
  const db = admin.firestore();
  const existing = await profileRef(uid).get();
  const current = existing.data() || {};
  const stripe = stripeClient();
  let accountId = String(current.stripeAccountId || "");
  if (!accountId) {
    const account = await stripe.accounts.create({
      country: "US",
      controller: {
        fees: { payer: "application" },
        losses: { payments: "application" },
        stripe_dashboard: { type: "express" },
      },
      capabilities: { transfers: { requested: true } },
      business_profile: { product_description: "Selling clothing and fashion items on Uvel." },
      metadata: { uvelUid: uid },
    }, { idempotencyKey: `connect-account-${uid}` });
    accountId = account.id;
    await profileRef(uid).set({ uid, stripeAccountId: accountId, country: "US", currency: "USD", provider: "stripe_connect", status: "onboarding", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: "https://uvel.app/payouts/refresh",
    return_url: "https://uvel.app/payouts/return",
    collection_options: { fields: "eventually_due" },
  });
  return { accountId, url: accountLink.url, expiresAt: accountLink.expires_at };
}

async function getConnectAccountStatusHandler(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const snap = await profileRef(req.auth.uid).get();
  const profile = snap.data() || {};
  const accountId = String(profile.stripeAccountId || "");
  if (!accountId) return { connected: false, payoutsEnabled: false, chargesEnabled: false, requirements: [] };
  const account = await stripeClient().accounts.retrieve(accountId);
  const status = {
    connected: true,
    accountId,
    payoutsEnabled: Boolean(account.payouts_enabled),
    chargesEnabled: Boolean(account.charges_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    requirements: account.requirements?.currently_due || [],
    disabledReason: account.requirements?.disabled_reason || null,
    externalAccounts: (account.external_accounts?.data || []).map((item) => ({
      id: item.id,
      type: item.object === "bank_account" ? "bank" : "card",
      last4: item.last4,
      bankName: item.bank_name || null,
      brand: item.brand || null,
      availablePayoutMethods: item.available_payout_methods || [],
    })),
  };
  await profileRef(req.auth.uid).set({ provider: "stripe_connect", status: status.payoutsEnabled ? "ready" : "onboarding", payoutsEnabled: status.payoutsEnabled, chargesEnabled: status.chargesEnabled, currentlyDue: status.requirements, disabledReason: status.disabledReason, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return status;
}

async function requestConnectPayoutHandler(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const amountCents = Number(req.data?.amountCents);
  const currency = String(req.data?.currency || "USD").toUpperCase();
  const mode = String(req.data?.mode || "standard");
  if (!Number.isSafeInteger(amountCents) || amountCents < MIN_PAYOUT_CENTS || currency !== "USD" || !["standard", "instant"].includes(mode)) {
    throw new HttpsError("invalid-argument", "Enter a valid US payout amount.");
  }
  const uid = req.auth.uid;
  const db = admin.firestore();
  const profileSnap = await profileRef(uid).get();
  const profile = profileSnap.data() || {};
  const accountId = String(profile.stripeAccountId || "");
  if (!accountId) throw new HttpsError("failed-precondition", "Complete Stripe payout setup first.");
  const stripe = stripeClient();
  const account = await stripe.accounts.retrieve(accountId);
  if (!account.payouts_enabled) throw new HttpsError("failed-precondition", "Stripe needs more information before payouts can be sent.");
  if (mode === "instant") {
    const eligible = (account.external_accounts?.data || []).some((item) => (item.available_payout_methods || []).includes("instant"));
    if (!eligible) throw new HttpsError("failed-precondition", "Instant payouts are not available for this payout account yet.");
  }
  const payoutId = `upayout-${Date.now().toString(36)}-${uid.slice(0, 8)}`;
  const walletRef = db.collection("wallets").doc(uid);
  await db.runTransaction(async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const wallet = walletSnap.data() || {};
    const available = Math.max(0, Math.floor(Number(wallet.availableCents || 0)));
    if (amountCents > available) throw new HttpsError("failed-precondition", "Payout amount exceeds your available balance.");
    tx.set(walletRef, { availableCents: admin.firestore.FieldValue.increment(-amountCents), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    tx.set(db.collection("userPayouts").doc(payoutId), { id: payoutId, uid, currency, amountCents, mode, status: "processing", requestedAt: admin.firestore.FieldValue.serverTimestamp(), stripeAccountId: accountId }, { merge: true });
    tx.set(db.collection("walletEntries").doc(`payout-${payoutId}`), { id: `payout-${payoutId}`, uid, type: "payout", status: "requested", amountCents: -amountCents, currency, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  try {
    const transfer = await stripe.transfers.create({ amount: amountCents, currency: currency.toLowerCase(), destination: accountId, metadata: { uvelPayoutId: payoutId, uvelUid: uid } }, { idempotencyKey: payoutId });
    let stripePayoutId = "";
    if (mode === "instant") {
      const instant = await stripe.payouts.create({ amount: amountCents, currency: currency.toLowerCase(), method: "instant", metadata: { uvelPayoutId: payoutId, uvelUid: uid } }, { stripeAccount: accountId, idempotencyKey: `${payoutId}-instant` });
      stripePayoutId = instant.id;
    }
    await db.collection("userPayouts").doc(payoutId).set({ status: "processing", transferId: transfer.id, stripePayoutId: stripePayoutId || null, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("walletEntries").doc(`payout-${payoutId}`).set({ status: "requested", transferId: transfer.id, stripePayoutId: stripePayoutId || null }, { merge: true });
    return { payoutId, status: "processing", mode };
  } catch (error) {
    await db.runTransaction(async (tx) => {
      tx.set(walletRef, { availableCents: admin.firestore.FieldValue.increment(amountCents), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(db.collection("userPayouts").doc(payoutId), { status: "failed", failureMessage: error.message || "Stripe payout failed.", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(db.collection("walletEntries").doc(`payout-${payoutId}`), { status: "void", failureMessage: error.message || "Stripe payout failed." }, { merge: true });
    });
    throw new HttpsError("failed-precondition", error.message || "Stripe payout failed.");
  }
}

async function handleConnectEvent(event) {
  const db = admin.firestore();
  const object = event.data?.object || {};
  if (event.type === "account.updated" && event.account) {
    const snap = await db.collection("userPayoutProfiles").where("stripeAccountId", "==", event.account).limit(1).get();
    if (!snap.empty) await snap.docs[0].ref.set({ payoutsEnabled: Boolean(object.payouts_enabled), chargesEnabled: Boolean(object.charges_enabled), currentlyDue: object.requirements?.currently_due || [], disabledReason: object.requirements?.disabled_reason || null, status: object.payouts_enabled ? "ready" : "onboarding", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
  const payoutId = String(object.metadata?.uvelPayoutId || "");
  if (payoutId && ["payout.paid", "payout.failed", "payout.canceled", "transfer.created", "transfer.failed", "transfer.reversed"].includes(event.type)) {
    const status = event.type === "payout.paid" ? "paid" : ["payout.failed", "payout.canceled", "transfer.failed", "transfer.reversed"].includes(event.type) ? "failed" : "processing";
    await db.collection("userPayouts").doc(payoutId).set({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("walletEntries").doc(`payout-${payoutId}`).set({ status: status === "paid" ? "available" : status === "failed" ? "void" : "requested", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
}

module.exports = { createConnectAccountHandler, getConnectAccountStatusHandler, requestConnectPayoutHandler, handleConnectEvent, stripeSecret };
