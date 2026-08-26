const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const stripeSecret = defineSecret("STRIPE_SECRET");
const paystackSecret = defineSecret("PAYSTACK_SECRET");
const anthropicSecret = defineSecret("ANTHROPIC_API_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const paystackWebhookSecret = defineSecret("PAYSTACK_WEBHOOK_SECRET");

if (!admin.apps.length) admin.initializeApp();

const PAYSTACK = new Set(["GH", "NG", "KE", "ZA"]);
const RESERVATION_MINUTES = 30;

function timestampMillis(value) {
  if (typeof value === "number") return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  return 0;
}

async function releaseOrderReservation(orderId, reason = "released") {
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const reservationRef = db.collection("inventoryReservations").doc(orderId);
  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    const reservationSnap = await tx.get(reservationRef);
    if (!orderSnap.exists || !reservationSnap.exists) return;
    const order = orderSnap.data() || {};
    const reservation = reservationSnap.data() || {};
    if (reservation.status !== "active") return;
    const listingRef = order.pieceId ? db.collection("listings").doc(String(order.pieceId)) : null;
    const listingSnap = listingRef ? await tx.get(listingRef) : null;
    if (listingRef && listingSnap && listingSnap.exists) {
      const listing = listingSnap.data() || {};
      const currentStock = Number(listing.stockQuantity);
      const patch = {};
      if (Number.isFinite(currentStock)) patch.stockQuantity = Math.max(0, Math.floor(currentStock) + 1);
      patch.reservedQuantity = increment(-1);
      const variantKey = String(reservation.variantKey || "");
      if (variantKey && listing.sizeStock && typeof listing.sizeStock === "object") {
        patch.sizeStock = { ...listing.sizeStock, [variantKey]: Math.max(0, Math.floor(Number(listing.sizeStock[variantKey]) || 0) + 1) };
      }
      if (variantKey && listing.reservedSizeStock && typeof listing.reservedSizeStock === "object") {
        patch.reservedSizeStock = { ...listing.reservedSizeStock, [variantKey]: Math.max(0, Math.floor(Number(listing.reservedSizeStock[variantKey]) || 0) - 1) };
      }
      if (listing.status === "sold" && Number.isFinite(currentStock)) patch.status = "listed";
      if (Object.keys(patch).length) tx.set(listingRef, patch, { merge: true });
    }
    tx.set(reservationRef, { status: reason, releasedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    tx.set(orderRef, { inventoryReservationStatus: reason, inventoryReservationReleasedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
}

async function reserveOrderInventory(orderId, listingId, brandId, variantKey) {
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const listingRef = db.collection("listings").doc(listingId);
  const reservationRef = db.collection("inventoryReservations").doc(orderId);
  const expiresAt = Date.now() + RESERVATION_MINUTES * 60 * 1000;
  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    const listingSnap = await tx.get(listingRef);
    const reservationSnap = await tx.get(reservationRef);
    if (!orderSnap.exists || !listingSnap.exists) throw new HttpsError("not-found", "Order or listing not found.");
    const order = orderSnap.data() || {};
    const existing = reservationSnap.exists ? reservationSnap.data() || {} : {};
    if (existing.status === "active" && timestampMillis(existing.expiresAt) > Date.now()) return;
    const listing = listingSnap.data() || {};
    if (listing.status !== "listed" || listing.brandId !== brandId) throw new HttpsError("failed-precondition", "Listing is no longer available.");
    const stock = Number(listing.stockQuantity);
    const hasStock = Number.isFinite(stock);
    if (!hasStock) throw new HttpsError("failed-precondition", "This listing has no inventory configured.");
    const variant = String(variantKey || order.variantKey || "").trim();
    const sizeStock = listing.sizeStock && typeof listing.sizeStock === "object" ? { ...listing.sizeStock } : null;
    if (variant && sizeStock) {
      const variantStock = Number(sizeStock[variant]);
      if (!Number.isFinite(variantStock) || variantStock <= 0) throw new HttpsError("failed-precondition", "That size is sold out.");
      sizeStock[variant] = Math.max(0, Math.floor(variantStock) - 1);
    } else if (stock <= 0) {
      throw new HttpsError("failed-precondition", "This listing is sold out.");
    }
    const listingPatch = { stockQuantity: Math.max(0, Math.floor(stock) - 1), reservedQuantity: increment(1) };
    if (sizeStock) listingPatch.sizeStock = sizeStock;
    if (variant && listing.reservedSizeStock && typeof listing.reservedSizeStock === "object") {
      listingPatch.reservedSizeStock = { ...listing.reservedSizeStock, [variant]: Math.max(0, Math.floor(Number(listing.reservedSizeStock[variant]) || 0) + 1) };
    }
    tx.set(listingRef, listingPatch, { merge: true });
    tx.set(reservationRef, {
      orderId,
      listingId,
      brandId,
      variantKey: variant || null,
      status: "active",
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(orderRef, {
      inventoryReservationId: orderId,
      inventoryReservationStatus: "active",
      inventoryReservationExpiresAt: admin.firestore.Timestamp.fromMillis(expiresAt),
      inventoryReservedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

exports.createCheckout = onCall({ secrets: [stripeSecret, paystackSecret] }, async (req) => {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "Sign in before checking out.");
  }

  const { amountCents, currency, email, method, country, reference, name, orderId, listingId, brandId, variantKey } = req.data || {};
  const normalizedCurrency = String(currency || "").toUpperCase();
  const normalizedEmail = String(req.auth.token.email || email || "").trim().toLowerCase();
  const normalizedMethod = String(method || "");
  const normalizedCountry = String(country || "").toUpperCase();
  const normalizedReference = String(reference || "").trim();
  const normalizedOrderId = String(orderId || "").trim();
  const normalizedListingId = String(listingId || "").trim();
  const normalizedBrandId = String(brandId || "").trim();
  const normalizedVariantKey = String(variantKey || "").trim().slice(0, 80);

  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > 100000000 ||
    !/^[A-Z]{3}$/.test(normalizedCurrency) ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail) ||
    !["card", "momo", "telecel", "mpesa", "apple"].includes(normalizedMethod) ||
    !/^[A-Z]{2}$/.test(normalizedCountry) ||
    !/^[a-zA-Z0-9._:-]{1,120}$/.test(normalizedReference) ||
    !/^[a-zA-Z0-9._:-]{1,120}$/.test(normalizedOrderId)
  ) {
    throw new HttpsError("invalid-argument", "Missing amount.");
  }

  const orderRef = admin.firestore().collection("orders").doc(normalizedOrderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = orderSnap.data() || {};
  if (order.buyerId !== req.auth.uid || order.status !== "pending") {
    throw new HttpsError("failed-precondition", "Order is not available for payment.");
  }
  if (order.totalCents !== amountCents || String(order.currency || "").toUpperCase() !== normalizedCurrency) {
    throw new HttpsError("invalid-argument", "Order amount changed.");
  }
  if (normalizedListingId && order.pieceId !== normalizedListingId) {
    throw new HttpsError("invalid-argument", "Order listing changed.");
  }
  if (normalizedBrandId && order.brandId !== normalizedBrandId) {
    throw new HttpsError("invalid-argument", "Order brand changed.");
  }
  let reserved = false;
  if (order.brandId && order.pieceId) {
    const listingSnap = await admin.firestore().collection("listings").doc(String(order.pieceId)).get();
    const listing = listingSnap.data() || {};
    if (!listingSnap.exists || listing.status !== "listed" || listing.brandId !== order.brandId) {
      throw new HttpsError("failed-precondition", "Listing is no longer available.");
    }
    const orderVariant = String(order.variantKey || "").trim();
    if (normalizedVariantKey && orderVariant && normalizedVariantKey !== orderVariant) {
      throw new HttpsError("invalid-argument", "Selected size changed.");
    }
    const effectiveVariant = normalizedVariantKey || orderVariant;
    if (listing.sizeStock && typeof listing.sizeStock === "object" && Object.keys(listing.sizeStock).length && !effectiveVariant) {
      throw new HttpsError("invalid-argument", "Choose a size before checking out.");
    }
    await reserveOrderInventory(normalizedOrderId, String(order.pieceId), String(order.brandId), effectiveVariant);
    reserved = true;
  }

  if (normalizedMethod !== "apple" && PAYSTACK.has(normalizedCountry)) {
    try {
      const key = paystackSecret.value();
      if (!key) throw new HttpsError("failed-precondition", "Paystack isn’t connected yet.");
      const channels =
        normalizedMethod === "momo" || normalizedMethod === "telecel" || normalizedMethod === "mpesa"
          ? ["mobile_money"]
          : normalizedMethod === "card"
            ? ["card"]
            : undefined;
      const r = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          amount: Math.round(amountCents),
          currency: normalizedCurrency,
          reference: normalizedReference,
          callback_url: "https://allentackie-ops.github.io/uvel/pay.html",
          channels,
          metadata: {
            name: String(name || "").slice(0, 160),
            country: normalizedCountry,
            method: normalizedMethod,
            orderId: normalizedOrderId,
            listingId: normalizedListingId,
            brandId: normalizedBrandId,
            variantKey: normalizedVariantKey,
          },
        }),
      });
      const json = await r.json();
      if (!json.status) throw new HttpsError("internal", json.message || "Paystack failed.");
      await orderRef.set({ paymentProvider: "paystack", paymentReference: normalizedReference, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return { processor: "paystack", url: json.data.authorization_url, reference: normalizedReference };
    } catch (error) {
      if (reserved) await releaseOrderReservation(normalizedOrderId).catch(() => undefined);
      throw error;
    }
  }

  try {
    const key = stripeSecret.value();
    if (!key) throw new HttpsError("failed-precondition", "Stripe isn’t connected yet.");
    const stripe = require("stripe")(key);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: normalizedEmail,
      success_url: "https://allentackie-ops.github.io/uvel/pay.html",
      cancel_url: "https://allentackie-ops.github.io/uvel/pay.html",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: normalizedCurrency.toLowerCase(),
            unit_amount: Math.round(amountCents),
            product_data: { name: name || "Uvel order" },
          },
        },
      ],
      payment_method_types: ["card"],
      metadata: {
        reference: normalizedReference,
        orderId: normalizedOrderId,
        listingId: normalizedListingId,
        brandId: normalizedBrandId,
        country: normalizedCountry,
        method: normalizedMethod,
        variantKey: normalizedVariantKey,
      },
    });
    await orderRef.set({ paymentProvider: "stripe", paymentReference: session.id, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { processor: "stripe", url: session.url, reference: session.id };
  } catch (error) {
    if (reserved) await releaseOrderReservation(normalizedOrderId).catch(() => undefined);
    throw error;
  }
});

function uidSafe(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

function fieldId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 140);
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function increment(value) {
  return admin.firestore.FieldValue.increment(value);
}

function analyticsRefs(db, brandId) {
  const base = db.collection("brandAnalytics").doc(brandId);
  return {
    base,
    daily: (day) => base.collection("daily").doc(day),
    states: (id) => base.collection("states").doc(fieldId(id)),
    audience: (uid) => base.collection("audience").doc(fieldId(uid)),
    top: (listingId) => base.collection("top").doc(fieldId(listingId)),
  };
}

async function recordEvent(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const input = req.data || {};
  const type = String(input.type || "");
  const brandId = String(input.brandId || "").trim();
  const listingId = String(input.listingId || "").trim();
  const listingName = String(input.listingName || "").slice(0, 160);
  const listingPhoto = String(input.listingPhoto || "").slice(0, 2000);
  const eventId = String(input.eventId || `${type}_${uidSafe(req.auth.uid)}_${Date.now()}`).slice(0, 160);
  const allowed = new Set(["brand_view", "listing_view", "listing_like", "listing_unlike", "brand_follow", "brand_unfollow"]);
  if (!allowed.has(type) || !brandId || (type.startsWith("listing_") && !listingId)) {
    throw new HttpsError("invalid-argument", "Invalid analytics event.");
  }

  const db = admin.firestore();
  const brandRef = db.collection("brands").doc(brandId);
  if (listingId) {
    const listingSnap = await db.collection("listings").doc(listingId).get();
    const listing = listingSnap.data() || {};
    if (!listingSnap.exists || listing.brandId !== brandId || listing.status !== "listed") {
      throw new HttpsError("failed-precondition", "Listing is not available.");
    }
  }
  const refs = analyticsRefs(db, brandId);
  const uid = req.auth.uid;
  const day = dayKey();
  const stateId = type === "brand_view" || type === "listing_view"
    ? `event_${eventId}`
    : type.startsWith("listing_")
        ? `listing_like_${uid}_${listingId}`
        : `brand_follow_${uid}`;
  const stateRef = refs.states(stateId);
  const audienceRef = refs.audience(uid);
  const dailyRef = refs.daily(day);
  const topRef = listingId ? refs.top(listingId) : null;

  await db.runTransaction(async (tx) => {
    const reads = [tx.get(brandRef), tx.get(stateRef)];
    if (type === "brand_view") reads.push(tx.get(audienceRef));
    const snapshots = await Promise.all(reads);
    const brandSnap = snapshots[0];
    const stateSnap = snapshots[1];
    if (!brandSnap.exists) throw new HttpsError("not-found", "Brand not found.");
    const desired = type === "listing_like" || type === "brand_follow";
    if (stateSnap.exists) {
      const state = stateSnap.data() || {};
      if (type.endsWith("_view") || Boolean(state.active) === desired) return;
    }

    const payload = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (type === "brand_view") {
      const audienceSnap = snapshots[2];
      tx.set(stateRef, { uid, type, eventId, day, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      tx.set(audienceRef, { firstSeenAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(refs.base, { views: increment(1), unique: audienceSnap.exists ? increment(0) : increment(1), ...payload }, { merge: true });
      tx.set(dailyRef, { day, views: increment(1), ...payload }, { merge: true });
      return;
    }
    if (type === "listing_view") {
      tx.set(stateRef, { uid, listingId, type, eventId, day, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      tx.set(dailyRef, { day, views: increment(1), ...payload }, { merge: true });
      if (topRef) tx.set(topRef, { id: listingId, name: listingName || "Listing", photo: listingPhoto, views: increment(1), ...payload }, { merge: true });
      return;
    }
    tx.set(stateRef, { uid, listingId: listingId || null, type: desired ? "active" : "inactive", active: desired, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    const delta = desired ? 1 : -1;
    if (type.startsWith("listing_")) {
      tx.set(refs.base, { likes: increment(delta), ...payload }, { merge: true });
      tx.set(dailyRef, { day, likes: desired ? increment(1) : increment(0), ...payload }, { merge: true });
      if (topRef) tx.set(topRef, { id: listingId, name: listingName || "Listing", photo: listingPhoto, likes: increment(delta), ...payload }, { merge: true });
    } else {
      tx.set(refs.base, { follows: increment(delta), ...payload }, { merge: true });
    }
  });
  return { ok: true };
}

exports.recordAnalyticsEvent = onCall(recordEvent);

async function markOrderPaid(orderId, provider, providerReference, providerAmount, providerCurrency, providerPaymentId, providerTransactionId) {
  if (!orderId) return { ok: false, reason: "missing-order" };
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const reservationRef = db.collection("inventoryReservations").doc(orderId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) return { ok: false, reason: "order-not-found" };
    const order = snap.data() || {};
    if (order.status === "paid") return { ok: true, duplicate: true };
    if (order.status !== "pending") return { ok: false, reason: "order-not-pending" };
    if (Number(providerAmount) > 0 && Number(order.totalCents) !== Number(providerAmount)) return { ok: false, reason: "amount-mismatch" };
    if (providerCurrency && String(order.currency || "").toUpperCase() !== String(providerCurrency).toUpperCase()) return { ok: false, reason: "currency-mismatch" };
    const reservationSnap = await tx.get(reservationRef);
    const reservation = reservationSnap.exists ? reservationSnap.data() || {} : {};
    const reservationActive = reservation.status === "active" && timestampMillis(reservation.expiresAt) > Date.now();
    const reservationExpired = reservation.status === "active" && !reservationActive;
    const listingRef = order.pieceId ? db.collection("listings").doc(String(order.pieceId)) : null;
    const listingSnap = listingRef ? await tx.get(listingRef) : null;
    const listingData = listingSnap && listingSnap.exists ? listingSnap.data() || {} : {};
    const listingStock = Number(listingData.stockQuantity);
    const hasTrackedStock = Boolean(order.brandId && Number.isFinite(listingStock));
    if (order.brandId && reservationExpired) return { ok: false, reason: "inventory-reservation-expired" };
    if (order.brandId && (!listingSnap || !listingSnap.exists || listingData.status !== "listed") && !reservationActive) return { ok: false, reason: "listing-unavailable" };
    if (order.brandId && !reservationActive && (!hasTrackedStock || listingStock <= 0)) return { ok: false, reason: "listing-unavailable" };
    const paidAt = admin.firestore.FieldValue.serverTimestamp();
    const paidUpdate = { status: "paid", fulfillmentStatus: "unfulfilled", paymentProvider: provider, paymentReference: providerReference, paidAt };
    if (providerPaymentId) paidUpdate.paymentIntentId = providerPaymentId;
    if (providerTransactionId) paidUpdate.paymentTransactionId = providerTransactionId;
    if (reservationActive) {
      tx.set(reservationRef, { status: "consumed", consumedAt: paidAt }, { merge: true });
      paidUpdate.inventoryReservationStatus = "consumed";
      if (listingRef && listingSnap && listingSnap.exists) {
        const reservationPatch = { reservedQuantity: increment(-1) };
        if (hasTrackedStock && listingStock <= 0) {
          reservationPatch.status = "sold";
          reservationPatch.soldAt = paidAt;
        }
        tx.set(listingRef, reservationPatch, { merge: true });
      }
    }
    tx.update(orderRef, paidUpdate);
    if (listingRef && !reservationActive) {
      if (hasTrackedStock) {
        const remaining = Math.max(0, Math.floor(listingStock) - 1);
        const variantKey = String(order.variantKey || "").trim();
        const sizeStock = listingData.sizeStock && typeof listingData.sizeStock === "object" ? { ...listingData.sizeStock } : null;
        if (variantKey && sizeStock) {
          const variantStock = Number(sizeStock[variantKey]);
          if (!Number.isFinite(variantStock) || variantStock <= 0) return { ok: false, reason: "variant-unavailable" };
          sizeStock[variantKey] = Math.max(0, Math.floor(variantStock) - 1);
        }
        const listingPatch = remaining > 0 ? { stockQuantity: remaining } : { stockQuantity: 0, status: "sold", soldAt: paidAt };
        if (sizeStock) listingPatch.sizeStock = sizeStock;
        tx.set(listingRef, listingPatch, { merge: true });
      } else {
        tx.set(listingRef, { status: "sold", soldAt: paidAt }, { merge: true });
      }
    }
    if (order.brandId) {
      const refs = analyticsRefs(db, String(order.brandId));
      const day = dayKey();
      const currency = String(order.currency || "USD").toUpperCase();
      const earnings = Math.max(0, Number(order.itemCents || 0) - Number(order.feeCents || 0));
      tx.set(refs.base, {
        sold: increment(1),
        earningsCents: increment(earnings),
        currency,
        [`earningsByCurrency.${currency}`]: increment(earnings),
        updatedAt: paidAt,
      }, { merge: true });
      tx.set(refs.daily(day), {
        day,
        sales: increment(1),
        earnings: increment(earnings),
        [`earningsByCurrency.${currency}`]: increment(earnings),
        updatedAt: paidAt,
      }, { merge: true });
      if (order.pieceId) {
        tx.set(refs.top(String(order.pieceId)), {
          id: String(order.pieceId),
          name: String(order.pieceName || "Listing"),
          photo: String(order.piecePhoto || ""),
          sold: increment(1),
          updatedAt: paidAt,
        }, { merge: true });
      }
    }
    return { ok: true };
  });
}

const FULFILLMENT_TRANSITIONS = {
  unfulfilled: new Set(["processing", "canceled"]),
  processing: new Set(["packed", "canceled"]),
  packed: new Set(["shipped"]),
  shipped: new Set(["delivered"]),
  delivered: new Set(["returned"]),
  canceled: new Set(),
  returned: new Set(),
};

exports.updateOrderFulfillment = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const input = req.data || {};
  const orderId = String(input.orderId || "").trim();
  const nextStatus = String(input.fulfillmentStatus || "").trim();
  const carrier = String(input.carrier || "").trim().slice(0, 80);
  const trackingNumber = String(input.trackingNumber || "").trim().slice(0, 120);
  if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(orderId) || !Object.prototype.hasOwnProperty.call(FULFILLMENT_TRANSITIONS, nextStatus)) {
    throw new HttpsError("invalid-argument", "Invalid fulfillment update.");
  }
  if (nextStatus === "shipped" && !trackingNumber) {
    throw new HttpsError("invalid-argument", "Add tracking information before marking the order shipped.");
  }

  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = orderSnap.data() || {};
  if (!order.brandId) throw new HttpsError("failed-precondition", "This is not a brand order.");
  const brandSnap = await db.collection("brands").doc(String(order.brandId)).get();
  const brand = brandSnap.data() || {};
  const member = Array.isArray(brand.members) ? brand.members.find((candidate) => candidate && candidate.uid === req.auth.uid) : null;
  const role = member && member.role;
  if (!role || !["owner", "admin", "support"].includes(role)) {
    throw new HttpsError("permission-denied", "You cannot update this brand order.");
  }
  const update = {
    fulfillmentStatus: nextStatus,
    fulfillmentUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (carrier) update.carrier = carrier;
  if (trackingNumber) update.trackingNumber = trackingNumber;
  if (nextStatus === "processing") update.processingAt = admin.firestore.FieldValue.serverTimestamp();
  if (nextStatus === "packed") update.packedAt = admin.firestore.FieldValue.serverTimestamp();
  if (nextStatus === "shipped") update.shippedAt = admin.firestore.FieldValue.serverTimestamp();
  if (nextStatus === "delivered") update.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
  if (nextStatus === "canceled") update.canceledAt = admin.firestore.FieldValue.serverTimestamp();
  if (nextStatus === "returned") update.returnedAt = admin.firestore.FieldValue.serverTimestamp();
  await db.runTransaction(async (tx) => {
    const latestSnap = await tx.get(orderRef);
    if (!latestSnap.exists) throw new HttpsError("not-found", "Order not found.");
    const latest = latestSnap.data() || {};
    if (latest.status !== "paid") throw new HttpsError("failed-precondition", "Only paid orders can enter fulfillment.");
    const currentStatus = String(latest.fulfillmentStatus || "unfulfilled");
    if (nextStatus === "canceled" && !(latest.resolution?.type === "cancellation" && latest.resolution?.status === "approved")) {
      throw new HttpsError("failed-precondition", "Cancellations must be approved from the resolution workflow.");
    }
    const allowed = FULFILLMENT_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.has(nextStatus)) throw new HttpsError("failed-precondition", `Order cannot move from ${currentStatus} to ${nextStatus}.`);
    tx.set(orderRef, update, { merge: true });
  });
  await writeAudit(db, { brandId: String(order.brandId), actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Brand team member"), action: "order_fulfillment_updated", entity: "order", entityId: orderId, entityName: String(order.pieceName || "Order"), summary: `Fulfillment moved to ${nextStatus}.`, metadata: { from: String(order.fulfillmentStatus || "unfulfilled"), to: nextStatus } });
  return { ok: true, orderId, fulfillmentStatus: nextStatus };
});

function stripeWebhook() {
  return onRequest({ secrets: [stripeSecret, stripeWebhookSecret] }, async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("POST only");
    let event;
    try {
      const stripe = require("stripe")(stripeSecret.value());
      event = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], stripeWebhookSecret.value());
    } catch (e) {
      return res.status(400).send(`Webhook signature verification failed: ${e.message}`);
    }
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      const metadata = session.metadata || {};
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : "";
      const result = await markOrderPaid(metadata.orderId, "stripe", session.id, session.amount_total, session.currency, paymentIntentId, "");
      if (!result.ok && !result.duplicate) return res.status(400).json(result);
    }
    if (event.type === "refund.created" || event.type === "refund.updated") {
      const refund = event.data.object || {};
      await recordProviderRefund(String(refund.metadata?.orderId || ""), String(refund.id || ""), String(refund.status || "processing"));
    }
    return res.status(200).send("ok");
  });
}

exports.stripeWebhook = stripeWebhook();

exports.paystackWebhook = onRequest({ secrets: [paystackWebhookSecret] }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("POST only");
  const signature = String(req.headers["x-paystack-signature"] || "");
  const expected = crypto.createHmac("sha512", paystackWebhookSecret.value()).update(req.rawBody).digest("hex");
  if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).send("Invalid signature");
  const event = req.body || {};
  if (event.event === "charge.success") {
    const data = event.data || {};
    const metadata = data.metadata || {};
    const result = await markOrderPaid(metadata.orderId, "paystack", String(data.reference || ""), data.amount, data.currency, "", String(data.id || ""));
    if (!result.ok && !result.duplicate) return res.status(400).json(result);
  }
  if (String(event.event || "").startsWith("refund.")) {
    const data = event.data || {};
    const transaction = data.transaction;
    const transactionReference = typeof transaction === "object" ? String(transaction.reference || "") : String(transaction || "");
    const orderSnap = await admin.firestore().collection("orders").where("paymentReference", "==", transactionReference).limit(1).get();
    if (!orderSnap.empty) await recordProviderRefund(orderSnap.docs[0].id, String(data.id || ""), String(data.status || event.event.replace("refund.", "")));
  }
  return res.status(200).send("ok");
});

exports.getBrandAnalytics = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const brandId = String(req.data?.brandId || "").trim();
  const currency = String(req.data?.currency || "USD").toUpperCase();
  if (!brandId || !/^[A-Z]{3}$/.test(currency)) throw new HttpsError("invalid-argument", "Invalid brand analytics request.");
  const db = admin.firestore();
  const brandSnap = await db.collection("brands").doc(brandId).get();
  if (!brandSnap.exists) throw new HttpsError("not-found", "Brand not found.");
  const brand = brandSnap.data() || {};
  const member = Array.isArray(brand.members) && brand.members.find((m) => m.uid === req.auth.uid);
  if (!member || (member.role !== "owner" && !brand.analyticsShared)) throw new HttpsError("permission-denied", "Analytics are private.");
  const refs = analyticsRefs(db, brandId);
  const [baseSnap, dailySnap, topSnap, listingsSnap] = await Promise.all([
    refs.base.get(),
    refs.base.collection("daily").get(),
    refs.base.collection("top").limit(20).get(),
    db.collection("listings").where("brandId", "==", brandId).get(),
  ]);
  const base = baseSnap.data() || {};
  const byDay = new Map(dailySnap.docs.map((d) => [d.id, d.data()]));
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const day = dayKey(date);
    const row = byDay.get(day) || {};
    daily.push({ day, views: Number(row.views || 0), likes: Number(row.likes || 0), sales: Number(row.sales || 0), earnings: Number((row.earningsByCurrency || {})[currency] || 0) });
  }
  const earningsByCurrency = base.earningsByCurrency || {};
  const views = Number(base.views || 0);
  const unique = Number(base.unique || 0);
  const sold = Number(base.sold || 0);
  return {
    data: {
      views,
      unique,
      likes: Number(base.likes || 0),
      follows: Number(base.follows || 0),
      listings: listingsSnap.docs.filter((d) => d.data().status === "listed").length,
      sold,
      earningsCents: Number(earningsByCurrency[currency] || 0),
      currency,
      conversion: unique ? Math.round((sold / unique) * 1000) / 10 : 0,
      daily,
      top: topSnap.docs.map((d) => {
        const row = d.data();
        return { id: String(row.id || d.id), name: String(row.name || "Listing"), photo: String(row.photo || ""), views: Number(row.views || 0), likes: Number(row.likes || 0), sold: Number(row.sold || 0) };
      }).sort((a, b) => (b.views + b.sold * 100) - (a.views + a.sold * 100)).slice(0, 5),
    },
  };
});

exports.deleteMyAccount = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = req.auth.uid;
  const db = admin.firestore();
  const deletedUser = "deleted-user";

  const [brandsSnap, listingsByOwner, listingsByLister, buyerOrders, sellerOrders, chatsByBuyer, chatsBySeller, invitesFrom, invitesTo] = await Promise.all([
    db.collection("brands").get(),
    db.collection("listings").where("ownerId", "==", uid).get(),
    db.collection("listings").where("listedByUid", "==", uid).get(),
    db.collection("orders").where("buyerId", "==", uid).get(),
    db.collection("orders").where("sellerId", "==", uid).get(),
    db.collection("chats").where("buyerId", "==", uid).get(),
    db.collection("chats").where("sellerId", "==", uid).get(),
    db.collection("brandInvites").where("fromUid", "==", uid).get(),
    db.collection("brandInvites").where("toUid", "==", uid).get(),
  ]);

  const ownedBrandIds = brandsSnap.docs.filter((d) => d.data().ownerId === uid).map((d) => d.id);
  const brandBatch = db.batch();
  const memberBrands = [];
  for (const brandDoc of brandsSnap.docs) {
    const brand = brandDoc.data() || {};
    if (brand.ownerId === uid) continue;
    const members = Array.isArray(brand.members) ? brand.members.filter((member) => member?.uid !== uid) : brand.members;
    const followers = Array.isArray(brand.followers) ? brand.followers.filter((follower) => follower !== uid) : brand.followers;
    if (members !== brand.members || followers !== brand.followers) {
      memberBrands.push(brandDoc.ref);
      brandBatch.update(brandDoc.ref, { members, followers, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  }
  if (memberBrands.length) await brandBatch.commit();

  const allListings = new Map([...listingsByOwner.docs, ...listingsByLister.docs].map((d) => [d.id, d]));
  for (const listing of allListings.values()) await db.recursiveDelete(listing.ref);
  for (const brandId of ownedBrandIds) {
    await db.recursiveDelete(db.collection("brands").doc(brandId));
    await db.recursiveDelete(db.collection("brandAnalytics").doc(brandId));
  }
  for (const invite of [...invitesFrom.docs, ...invitesTo.docs]) await db.recursiveDelete(invite.ref);

  const orderBatch = db.batch();
  for (const order of new Map([...buyerOrders.docs, ...sellerOrders.docs].map((d) => [d.id, d])).values()) {
    const data = order.data() || {};
    orderBatch.update(order.ref, {
      buyerId: data.buyerId === uid ? deletedUser : data.buyerId,
      sellerId: data.sellerId === uid ? deletedUser : data.sellerId,
      buyerEmail: admin.firestore.FieldValue.delete(),
      buyerName: admin.firestore.FieldValue.delete(),
      address: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  if ([...buyerOrders.docs, ...sellerOrders.docs].length) await orderBatch.commit();
  for (const chat of new Map([...chatsByBuyer.docs, ...chatsBySeller.docs].map((d) => [d.id, d])).values()) {
    await db.recursiveDelete(chat.ref);
  }

  const analyticsDocs = await Promise.all(brandsSnap.docs.map((brandDoc) => brandDoc.ref.collection("states").get()));
  for (const stateSnap of analyticsDocs) {
    for (const state of stateSnap.docs) {
      if (state.data()?.uid === uid) await db.recursiveDelete(state.ref);
    }
  }
  for (const brandDoc of brandsSnap.docs) {
    await db.recursiveDelete(brandDoc.ref.collection("audience").doc(uid));
  }
  await db.recursiveDelete(db.collection("users").doc(uid));
  await admin.auth().deleteUser(uid);
  return { ok: true };
});

function parseJson(text) {
  const t = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*|\s*```$/g, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("No JSON");
  return JSON.parse(t.slice(start, end + 1));
}

const HOUSES = [
  "nike",
  "adidas",
  "gucci",
  "chanel",
  "dior",
  "prada",
  "hermes",
  "louisvuitton",
  "lv",
  "rolex",
  "zara",
  "hm",
  "shein",
  "supreme",
  "offwhite",
  "balenciaga",
  "fendi",
  "versace",
  "givenchy",
  "burberry",
  "moncler",
  "puma",
  "newbalance",
  "yeezy",
  "skims",
];

function coreToken(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/(incorporated|corporation|company|limited|gmbh|sarl|sas|plc|llc|ltd|inc|corp|co)$/g, "");
}

function impersonates(name, handle) {
  const core = coreToken(name);
  const h = coreToken(handle);
  const words = String(name || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return HOUSES.some((house) => core === house || h === house || words.includes(house));
}

function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

function validContactNumber(s) {
  return String(s || "").replace(/[^0-9]/g, "").length >= 7;
}

function validInstagram(s) {
  return /^@?[a-z0-9._]{2,30}$/i.test(String(s || "").trim());
}

function validWebsite(s) {
  return /^https?:\/\/[^\s]+$/i.test(String(s || "").trim());
}

function hasBrandContact(f) {
  return validContactNumber(f.phone) || validContactNumber(f.whatsapp) || validInstagram(f.instagram) || looksLikeEmail(f.contactEmail) || validWebsite(f.website);
}

function isSoftReason(reason) {
  const r = String(reason || "").toLowerCase();
  return (
    /\binstagram\b|\binsta\b|\big handle\b|\bsocials?\b/.test(r) ||
    /\bwebsite\b|\bweb site\b|\blanding page\b|\bsite unreachable\b/.test(r) ||
    /\btax id\b|\bregistration (?:or tax )?id\b|\bregistration number\b/.test(r) ||
    /\bprivate relay\b|\bhide my email\b|\bprivaterelay\b|\bapple id\b|\bapplicant email\b|\bsign-in email\b/.test(r) ||
    /\bgrammatical\b|\bgrammar\b|\bspelling\b|\btypos?\b/.test(r) ||
    /\bplaceholder\b|\bgeneric\b|\bnarrative\b|\baesthetic\b/.test(r) ||
    /does not match your brand name or handle/.test(r) ||
    /handle \([^)]+\) does not match/.test(r) ||
    /\btoo short\b|\bmore detail\b|\bnot enough\b|\bweak brand story\b|\bclarify the discrepancy\b/.test(r)
  );
}

function localHardFail(f) {
  if (!String(f.name || "").trim()) {
    return { ok: false, headline: "Need a brand name", reasons: ["Add the name buyers will see."], notes: "" };
  }
  if (!coreToken(f.handle)) {
    return { ok: false, headline: "Need a handle", reasons: ["Pick an @ made of letters or numbers."], notes: "" };
  }
  if (!String(f.legalName || "").trim()) {
    return { ok: false, headline: "Need a legal name", reasons: ["Add the registered or legal name of the house."], notes: "" };
  }
  if (String(f.story || "").trim().length < 4) {
    return { ok: false, headline: "Need a story", reasons: ["Write a line about who you are and what you make."], notes: "" };
  }
  if (!hasBrandContact(f)) {
    return {
      ok: false,
      headline: "Add a contact channel",
      reasons: ["Add at least one reachable brand contact: phone, WhatsApp, Instagram, email, or website."],
      notes: "",
    };
  }
  if (impersonates(f.name, f.handle)) {
    return {
      ok: false,
      headline: "That name is taken by a known house",
      reasons: ["Pick a name and handle that are yours — not a famous label."],
      notes: "",
    };
  }
  return null;
}

function sanitizeReview(f, review) {
  const hard = localHardFail(f);
  if (hard) return hard;
  const kept = (review.reasons || []).filter((r) => !isSoftReason(r));
  if (review.ok || kept.length === 0) {
    return { ok: true, headline: "Verified.", reasons: [], notes: review.notes || "" };
  }
  return {
    ok: false,
    headline: review.headline || "This brand can’t be verified yet.",
    reasons: kept.slice(0, 3),
    notes: review.notes || "",
  };
}

function promptOf(f) {
  return `You are the brand-verification desk for Uvel, a fashion marketplace in early access. A person is applying to open a BRAND page. Brands get a blue check and may post new fashion.

Be a light gate, not an editor. Uvel is early: independent labels, new houses, and small ateliers should pass. Default to APPROVE.

REQUIRED fields — the only fields you may use to reject:
Brand name: ${f.name}
Handle: @${f.handle}
Legal / registered name: ${f.legalName || "(none)"}
Vertical: ${f.vertical}
Country: ${f.country || "(none)"}
Contact channels:
- Phone: ${f.phone || "(none)"}
- WhatsApp: ${f.whatsapp || "(none)"}
- Instagram: ${f.instagram || "(none)"}
- Email: ${f.contactEmail || "(none)"}
- Website: ${f.website || "(none)"}
Story: ${f.story || "(none)"}

At least one brand contact channel must be present and usable. Do not reject the brand because optional channels are blank. Do not confuse a brand contact with the applicant's personal/sign-in email (often Apple Hide My Email).

Handle vs name: they MATCH if they share the same core word after stripping spaces, punctuation, and legal suffixes (Inc, Ltd, LLC, GmbH, SARL, Co). "Apion Inc." and @apion MATCH. Do not invent mismatches. One-letter differences in optional socials are irrelevant because socials are out of scope.

Story: one real sentence is enough. Grammar, typos, informal or generic phrasing are NOT grounds to reject.

Contact channels: one usable phone number, WhatsApp number, Instagram handle, email address, or website is enough. Do not require all channels. Do not mention Apple private relay.

Reject ONLY if:
- The name or handle is a famous house (Nike, Adidas, Gucci, Chanel, Louis Vuitton, Dior, Prada, Hermes, Rolex, Zara, H&M, Shein, Supreme, Off-White, Balenciaga) or an obvious fake of one. Close original names are fine.
- A required field above is empty.
- No brand contact channel is usable.
- A supplied email is malformed and no other usable channel is supplied.
- Handle is a slur or empty.
- Adult, weapons, drugs, hate, or clearly not a fashion business.

Return ONLY JSON:
{
  "ok": boolean,
  "headline": string,
  "reasons": string[],
  "notes": string
}

headline: "Verified." if ok, else a few words.
reasons: 0–3 actionable sentences. Empty if ok. Never mention optional fields.
notes: one sentence on what you checked.`;
}

exports.reviewBrand = onCall({ secrets: [anthropicSecret] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const f = req.data || {};
  const hard = localHardFail(f);
  if (hard) return hard;

  const key = anthropicSecret.value();
  if (!key) throw new HttpsError("failed-precondition", "Brand check isn’t connected yet.");

  const prompt = promptOf(f);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new HttpsError("internal", json.error?.message || "Couldn’t finish the check.");
  const parsed = parseJson(json.content?.[0]?.text || "{}");
  const ok = parsed.ok === true;
  const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.map(String).filter(Boolean).slice(0, 3) : [];
  return sanitizeReview(f, {
    ok,
    reasons,
    headline: String(parsed.headline || (ok ? "Verified." : "This brand can’t be verified yet.")),
    notes: String(parsed.notes || ""),
  });
});

exports.deleteAccount = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = req.auth.uid;
  const db = admin.firestore();
  await db.collection("users").doc(uid).delete().catch(() => undefined);
  await admin.auth().deleteUser(uid);
  return { ok: true };
});

exports.expireInventoryReservations = onSchedule("every 15 minutes", async () => {
  const db = admin.firestore();
  const snapshot = await db.collection("inventoryReservations").where("status", "==", "active").limit(200).get();
  const now = Date.now();
  await Promise.all(
    snapshot.docs
      .filter((item) => timestampMillis(item.data()?.expiresAt) > 0 && timestampMillis(item.data()?.expiresAt) <= now)
      .map((item) => releaseOrderReservation(item.id, "expired").catch(() => undefined)),
  );
});

const RESOLUTION_REASONS = new Set(["changed_mind", "wrong_size", "not_as_described", "damaged", "defective", "late", "other"]);
const RESOLUTION_MANAGER_ROLES = new Set(["owner", "admin", "support", "finance"]);

function resolutionData(order) {
  return order.resolution && typeof order.resolution === "object" ? order.resolution : null;
}

async function brandMemberRole(db, brandId, uid) {
  const snap = await db.collection("brands").doc(String(brandId)).get();
  if (!snap.exists) return null;
  const brand = snap.data() || {};
  const member = Array.isArray(brand.members) ? brand.members.find((candidate) => candidate && candidate.uid === uid) : null;
  return member && member.role ? String(member.role) : null;
}

async function restockOrderInventory(orderId) {
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
    const order = orderSnap.data() || {};
    if (order.inventoryRestockedAt || !order.brandId || !order.pieceId) return;
    const listingRef = db.collection("listings").doc(String(order.pieceId));
    const listingSnap = await tx.get(listingRef);
    if (!listingSnap.exists) {
      tx.set(orderRef, { inventoryRestockedAt: admin.firestore.FieldValue.serverTimestamp(), restockWarning: "listing-not-found" }, { merge: true });
      return;
    }
    const listing = listingSnap.data() || {};
    const patch = { stockQuantity: Math.max(0, Math.floor(Number(listing.stockQuantity) || 0) + 1) };
    const variantKey = String(order.variantKey || "").trim();
    if (variantKey && listing.sizeStock && typeof listing.sizeStock === "object") {
      patch.sizeStock = { ...listing.sizeStock, [variantKey]: Math.max(0, Math.floor(Number(listing.sizeStock[variantKey]) || 0) + 1) };
    }
    if (listing.status === "sold") patch.status = "listed";
    tx.set(listingRef, patch, { merge: true });
    tx.set(orderRef, { inventoryRestockedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
}

async function providerRefund(order) {
  const amount = Math.max(1, Math.floor(Number(order.refundAmountCents || order.totalCents) || 0));
  if (String(order.paymentProvider || "") === "stripe") {
    const key = stripeSecret.value();
    if (!key || !order.paymentIntentId) throw new HttpsError("failed-precondition", "Stripe refund details are not available for this order.");
    const stripe = require("stripe")(key);
    const refund = await stripe.refunds.create(
      { payment_intent: String(order.paymentIntentId), amount, metadata: { orderId: String(order.id), reason: String(order.resolution?.reason || "resolution") } },
      { idempotencyKey: `uvel-refund-${String(order.id)}` },
    );
    return { id: refund.id, status: String(refund.status || "pending") };
  }
  if (String(order.paymentProvider || "") === "paystack") {
    const key = paystackSecret.value();
    const transaction = String(order.paymentTransactionId || order.paymentReference || "");
    if (!key || !transaction) throw new HttpsError("failed-precondition", "Paystack refund details are not available for this order.");
    const response = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ transaction, amount, customer_note: `Uvel order ${order.id} refund`, merchant_note: String(order.resolution?.reason || "Order resolution") }),
    });
    const json = await response.json();
    if (!response.ok || !json.status) throw new HttpsError("internal", json.message || "Paystack refund failed.");
    return { id: String(json.data?.id || transaction), status: String(json.data?.status || "pending") };
  }
  throw new HttpsError("failed-precondition", "This order has no supported payment provider refund path.");
}

async function executeRefund(orderId) {
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const beforeSnap = await orderRef.get();
  if (!beforeSnap.exists) throw new HttpsError("not-found", "Order not found.");
  const before = beforeSnap.data() || {};
  if (before.refundStatus === "succeeded") return { ok: true, status: "succeeded", duplicate: true };
  if (before.refundStatus !== "processing") return { ok: false, status: "not-ready" };
  try {
    const refund = await providerRefund({ ...before, id: orderId });
    const succeeded = ["succeeded", "processed", "completed"].includes(refund.status);
    const resolution = resolutionData(before);
    const refundPatch = { refundStatus: succeeded ? "succeeded" : "processing", refundProviderId: refund.id, refundUpdatedAt: admin.firestore.FieldValue.serverTimestamp(), ...(succeeded ? { refundedAt: admin.firestore.FieldValue.serverTimestamp() } : {}) };
    if (succeeded && resolution) refundPatch.resolution = { ...resolution, status: "refunded", refundedAt: admin.firestore.FieldValue.serverTimestamp() };
    await orderRef.set(refundPatch, { merge: true });
    return { ok: true, status: succeeded ? "succeeded" : "processing", providerId: refund.id };
  } catch (error) {
    await orderRef.set({ refundStatus: "failed", refundError: error instanceof Error ? error.message.slice(0, 240) : "Refund failed.", refundUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
}

exports.requestOrderResolution = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const input = req.data || {};
  const orderId = String(input.orderId || "").trim();
  const type = String(input.type || "").trim();
  const reason = String(input.reason || "").trim();
  const note = String(input.note || "").trim().slice(0, 500);
  if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(orderId) || !["cancellation", "return"].includes(type) || !RESOLUTION_REASONS.has(reason)) throw new HttpsError("invalid-argument", "Invalid resolution request.");
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = snap.data() || {};
  if (order.buyerId !== req.auth.uid || order.status !== "paid") throw new HttpsError("permission-denied", "Only the buyer of a paid order can request this action.");
  const fulfillment = String(order.fulfillmentStatus || "unfulfilled");
  if (type === "cancellation" && !["unfulfilled", "processing", "packed"].includes(fulfillment)) throw new HttpsError("failed-precondition", "This order can no longer be canceled.");
  if (type === "return" && fulfillment !== "delivered") throw new HttpsError("failed-precondition", "Returns are available after delivery.");
  if (resolutionData(order) && !["rejected", "closed"].includes(String(resolutionData(order).status || ""))) throw new HttpsError("failed-precondition", "This order already has an open resolution.");
  const now = admin.firestore.FieldValue.serverTimestamp();
  await orderRef.set({ resolution: { type, status: "requested", reason, note, requestedAt: now, restockDecision: "pending" }, refundStatus: "none", resolutionUpdatedAt: now }, { merge: true });
  await writeAudit(db, { brandId: String(order.brandId), actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Buyer"), action: "resolution_requested", entity: "resolution", entityId: orderId, entityName: String(order.pieceName || "Order"), summary: `${type === "return" ? "Return" : "Cancellation"} requested.`, metadata: { reason } });
  return { ok: true, orderId, type, status: "requested" };
});

exports.confirmOrderReturnSent = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const orderId = String(req.data?.orderId || "").trim();
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = snap.data() || {};
  const resolution = resolutionData(order);
  if (order.buyerId !== req.auth.uid || !resolution || resolution.type !== "return" || resolution.status !== "approved") throw new HttpsError("failed-precondition", "This return is not ready for shipment.");
  await orderRef.set({ resolution: { ...resolution, status: "item_sent", itemSentAt: admin.firestore.FieldValue.serverTimestamp() }, resolutionUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await writeAudit(db, { brandId: String(order.brandId), actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Buyer"), action: "resolution_approved", entity: "resolution", entityId: orderId, entityName: String(order.pieceName || "Order"), summary: "Buyer marked the return as sent.", metadata: { status: "item_sent" } });
  return { ok: true, orderId, status: "item_sent" };
});

exports.reviewOrderResolution = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const orderId = String(req.data?.orderId || "").trim();
  const decision = String(req.data?.decision || "").trim();
  if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(orderId) || !["approve", "reject", "mark_received", "confirm_restock", "skip_restock"].includes(decision)) throw new HttpsError("invalid-argument", "Invalid resolution review.");
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = snap.data() || {};
  const role = await brandMemberRole(db, order.brandId, req.auth.uid);
  if (!role || !RESOLUTION_MANAGER_ROLES.has(role)) throw new HttpsError("permission-denied", "You cannot review this brand resolution.");
  const resolution = resolutionData(order);
  if (!resolution) throw new HttpsError("failed-precondition", "No resolution is open for this order.");
  const now = admin.firestore.FieldValue.serverTimestamp();
  if (decision === "reject") {
    if (!["requested", "approved", "item_sent"].includes(resolution.status)) throw new HttpsError("failed-precondition", "This resolution cannot be rejected now.");
    await orderRef.set({ resolution: { ...resolution, status: "rejected", reviewedAt: now }, refundStatus: "none", resolutionUpdatedAt: now }, { merge: true });
    await writeAudit(db, { brandId: String(order.brandId), actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Brand team member"), action: "resolution_rejected", entity: "resolution", entityId: orderId, entityName: String(order.pieceName || "Order"), summary: `${resolution.type === "return" ? "Return" : "Cancellation"} rejected.` });
    return { ok: true, orderId, status: "rejected" };
  }
  if (decision === "approve") {
    if (resolution.status !== "requested") throw new HttpsError("failed-precondition", "This resolution has already been reviewed.");
    if (resolution.type === "cancellation") {
      const approved = await db.runTransaction(async (tx) => {
        const latestSnap = await tx.get(orderRef);
        const latest = latestSnap.data() || {};
        const latestResolution = resolutionData(latest);
        if (!latestResolution || latestResolution.status !== "requested" || !["unfulfilled", "processing", "packed"].includes(String(latest.fulfillmentStatus || "unfulfilled"))) throw new HttpsError("failed-precondition", "This cancellation is no longer available.");
        tx.set(orderRef, { fulfillmentStatus: "canceled", canceledAt: now, refundStatus: "processing", refundAmountCents: Number(latest.totalCents || 0), resolution: { ...latestResolution, status: "approved", reviewedAt: now, refundRequestedAt: now }, resolutionUpdatedAt: now }, { merge: true });
        return true;
      });
      if (approved) {
        await restockOrderInventory(orderId);
        const refund = await executeRefund(orderId);
        await writeAudit(db, { brandId: String(order.brandId), actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Brand team member"), action: "resolution_approved", entity: "resolution", entityId: orderId, entityName: String(order.pieceName || "Order"), summary: "Cancellation approved and refund initiated.", metadata: { refundStatus: refund.status } });
        return { ...refund, orderId };
      }
    }
    await orderRef.set({ resolution: { ...resolution, status: "approved", reviewedAt: now }, resolutionUpdatedAt: now }, { merge: true });
    await writeAudit(db, { brandId: String(order.brandId), actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Brand team member"), action: "resolution_approved", entity: "resolution", entityId: orderId, entityName: String(order.pieceName || "Order"), summary: "Return approved." });
    return { ok: true, orderId, status: "approved" };
  }
  if (resolution.type !== "return") throw new HttpsError("failed-precondition", "Only returns can use this review action.");
  if (decision === "mark_received") {
    if (resolution.status !== "item_sent") throw new HttpsError("failed-precondition", "The buyer has not marked the return as sent.");
    await orderRef.set({ fulfillmentStatus: "returned", resolution: { ...resolution, status: "received", receivedAt: now }, refundStatus: "processing", refundAmountCents: Number(order.totalCents || 0), resolutionUpdatedAt: now }, { merge: true });
    const refund = await executeRefund(orderId);
    await writeAudit(db, { brandId: String(order.brandId), actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Brand team member"), action: "return_received", entity: "resolution", entityId: orderId, entityName: String(order.pieceName || "Order"), summary: "Return received and refund initiated.", metadata: { refundStatus: refund.status } });
    return { ...refund, orderId };
  }
  if (resolution.status !== "received") throw new HttpsError("failed-precondition", "Receive the returned item before deciding restock.");
  const shouldRestock = decision === "confirm_restock";
  await orderRef.set({ resolution: { ...resolution, restockDecision: shouldRestock ? "restock" : "no_restock" }, resolutionUpdatedAt: now }, { merge: true });
  if (shouldRestock) await restockOrderInventory(orderId);
  await writeAudit(db, { brandId: String(order.brandId), actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Brand team member"), action: "restock_decided", entity: "resolution", entityId: orderId, entityName: String(order.pieceName || "Order"), summary: shouldRestock ? "Returned item marked for restock." : "Returned item marked not for restock.", metadata: { restock: shouldRestock } });
  return { ok: true, orderId, restockDecision: shouldRestock ? "restock" : "no_restock" };
});

function normalizedRefundStatus(value) {
  const status = String(value || "").toLowerCase();
  if (["succeeded", "processed", "completed", "success"].includes(status)) return "succeeded";
  if (["failed", "canceled", "cancelled"].includes(status)) return "failed";
  return "processing";
}

async function recordProviderRefund(orderId, providerId, providerStatus) {
  if (!orderId) return;
  const db = admin.firestore();
  const state = normalizedRefundStatus(providerStatus);
  const patch = { refundStatus: state, refundUpdatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (providerId) patch.refundProviderId = providerId;
  if (state === "succeeded") {
    patch.refundedAt = admin.firestore.FieldValue.serverTimestamp();
    const snap = await db.collection("orders").doc(orderId).get();
    const resolution = snap.exists ? resolutionData(snap.data() || {}) : null;
    if (resolution) patch.resolution = { ...resolution, status: "refunded", refundedAt: admin.firestore.FieldValue.serverTimestamp() };
  }
  await db.collection("orders").doc(orderId).set(patch, { merge: true });
}

const AUDIT_ACTIONS = new Set([
  "product_created", "product_updated", "product_published", "product_drafted", "product_archived", "product_restored", "product_duplicated",
  "price_updated", "inventory_updated", "market_updated", "order_fulfillment_updated", "resolution_requested", "resolution_approved", "resolution_rejected", "resolution_reviewed",
  "return_received", "refund_requested", "refund_succeeded", "restock_confirmed", "restock_decided", "team_role_updated", "brand_settings_updated", "support_case_created", "support_case_updated", "support_note_added",
]);
const AUDIT_ENTITIES = new Set(["product", "order", "team", "brand", "resolution"]);

async function writeAudit(db, input) {
  if (!input || !input.brandId || !AUDIT_ACTIONS.has(String(input.action)) || !AUDIT_ENTITIES.has(String(input.entity))) return;
  const requestedId = String(input.id || "").trim();
  const safeId = /^[a-zA-Z0-9_-]{8,160}$/.test(requestedId) ? requestedId : undefined;
  const ref = safeId ? db.collection("brandAudit").doc(safeId) : db.collection("brandAudit").doc();
  const metadata = input.metadata && typeof input.metadata === "object" ? Object.fromEntries(Object.entries(input.metadata).slice(0, 12).map(([key, value]) => [String(key).slice(0, 40), typeof value === "boolean" || typeof value === "number" ? value : String(value).slice(0, 120)])) : {};
  await ref.set({
    brandId: String(input.brandId).slice(0, 120),
    actorUid: String(input.actorUid || "system").slice(0, 120),
    actorName: String(input.actorName || "Brand team member").slice(0, 120),
    action: String(input.action),
    entity: String(input.entity),
    entityId: String(input.entityId || "").slice(0, 120),
    entityName: String(input.entityName || "").slice(0, 160),
    summary: String(input.summary || "Brand workspace change").slice(0, 240),
    metadata,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

exports.recordAuditEvent = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const input = req.data || {};
  const brandId = String(input.brandId || "").trim();
  const action = String(input.action || "").trim();
  const entity = String(input.entity || "").trim();
  const entityId = String(input.entityId || "").trim();
  if (!brandId || !AUDIT_ACTIONS.has(action) || !AUDIT_ENTITIES.has(entity) || !entityId) throw new HttpsError("invalid-argument", "Invalid audit event.");
  const db = admin.firestore();
  const role = await brandMemberRole(db, brandId, req.auth.uid);
  if (!role) throw new HttpsError("permission-denied", "You are not a member of this brand.");
  const productRoles = new Set(["owner", "admin", "merchandiser", "poster"]);
  const orderRoles = new Set(["owner", "admin", "support", "finance"]);
  const teamRoles = new Set(["owner", "admin"]);
  const allowed = entity === "product" ? productRoles.has(role) : entity === "order" || entity === "resolution" ? orderRoles.has(role) : entity === "team" ? teamRoles.has(role) : ["owner", "admin", "marketing"].includes(role);
  if (!allowed) throw new HttpsError("permission-denied", "Your role cannot write this audit event.");
  await writeAudit(db, {
    brandId,
    actorUid: req.auth.uid,
    actorName: String(input.actorName || req.auth.token.name || req.auth.token.email || "Brand team member"),
    action,
    entity,
    entityId,
    entityName: input.entityName,
    summary: input.summary,
    metadata: input.metadata,
  });
  return { ok: true };
});

const CATALOG_EDIT_ROLES = new Set(["owner", "admin", "merchandiser", "poster"]);
const CATALOG_STATUS_VALUES = new Set(["owned", "draft", "listed", "archived", "sold"]);
const CATALOG_FIELDS = new Set(["photo", "photos", "name", "brand", "category", "color", "size", "sizes", "sizeStock", "sku", "condition", "material", "notes", "listPriceCents", "originalPriceCents", "status", "stockQuantity", "marketPrices", "marketAvailability", "shipsTo", "shopLook"]);

function safeCatalogPatch(input) {
  if (!input || typeof input !== "object") throw new HttpsError("invalid-argument", "Catalog update is invalid.");
  const patch = {};
  for (const [key, value] of Object.entries(input)) {
    if (CATALOG_FIELDS.has(key)) patch[key] = value;
  }
  if (!Object.keys(patch).length) throw new HttpsError("invalid-argument", "No editable catalog fields were supplied.");
  if (patch.status !== undefined && !CATALOG_STATUS_VALUES.has(String(patch.status))) throw new HttpsError("invalid-argument", "Invalid catalog status.");
  if (patch.stockQuantity !== undefined && (!Number.isInteger(patch.stockQuantity) || patch.stockQuantity < 0)) throw new HttpsError("invalid-argument", "Stock must be a non-negative whole number.");
  if (patch.listPriceCents !== undefined && (!Number.isInteger(patch.listPriceCents) || patch.listPriceCents <= 0)) throw new HttpsError("invalid-argument", "Price must be a positive whole number of cents.");
  if (patch.status === "listed" && Number(patch.stockQuantity) <= 0) throw new HttpsError("failed-precondition", "A listed product must have inventory.");
  if (patch.sizeStock !== undefined && (!patch.sizeStock || typeof patch.sizeStock !== "object" || Object.values(patch.sizeStock).some((value) => !Number.isInteger(value) || value < 0))) throw new HttpsError("invalid-argument", "Size stock must contain non-negative whole numbers.");
  if (patch.marketPrices !== undefined && (!patch.marketPrices || typeof patch.marketPrices !== "object" || Object.values(patch.marketPrices).some((value) => !Number.isInteger(value) || value <= 0))) throw new HttpsError("invalid-argument", "Market prices are invalid.");
  if (patch.marketAvailability !== undefined && (!patch.marketAvailability || typeof patch.marketAvailability !== "object" || Object.values(patch.marketAvailability).some((value) => typeof value !== "boolean"))) throw new HttpsError("invalid-argument", "Market availability is invalid.");
  return patch;
}

exports.updateBrandCatalog = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const listingId = String(req.data?.listingId || "").trim();
  if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(listingId)) throw new HttpsError("invalid-argument", "Invalid listing ID.");
  const db = admin.firestore();
  const listingRef = db.collection("listings").doc(listingId);
  const snap = await listingRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Product not found.");
  const current = snap.data() || {};
  if (!current.brandId) throw new HttpsError("failed-precondition", "Only brand products can be managed in Brand HQ.");
  const role = await brandMemberRole(db, current.brandId, req.auth.uid);
  if (!role || !CATALOG_EDIT_ROLES.has(role)) throw new HttpsError("permission-denied", "Your role cannot edit this catalog.");
  const patch = safeCatalogPatch(req.data?.patch);
  const next = { ...current, ...patch };
  if (["listed", "draft", "owned"].includes(String(next.status || "")) && Number(next.stockQuantity) <= 0) throw new HttpsError("failed-precondition", "A catalog product must retain at least one unit before publishing or drafting.");
  if (next.status === "sold" && Number(next.stockQuantity) !== 0) throw new HttpsError("failed-precondition", "Sold products must have zero available stock.");
  await listingRef.set({ ...patch, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  const action = patch.status === "listed" ? "product_published" : patch.status === "draft" ? "product_drafted" : patch.status === "archived" ? "product_archived" : "product_updated";
  await writeAudit(db, { brandId: current.brandId, actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Brand team member"), action, entity: "product", entityId: listingId, entityName: String(current.name || "Product"), summary: `Catalog product ${action.replace("product_", "").replace("_", " ")}.`, metadata: { status: String(next.status || current.status || "") } });
  return { ok: true, listingId, status: next.status || current.status };
});

exports.createBrandCatalog = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const listingId = String(req.data?.listingId || "").trim();
  const piece = req.data?.piece || {};
  if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(listingId) || String(piece.id || "") !== listingId) throw new HttpsError("invalid-argument", "Invalid product identity.");
  const db = admin.firestore();
  const brandId = String(piece.brandId || "").trim();
  if (!brandId) throw new HttpsError("invalid-argument", "Brand is required.");
  const role = await brandMemberRole(db, brandId, req.auth.uid);
  if (!role || !CATALOG_EDIT_ROLES.has(role)) throw new HttpsError("permission-denied", "Your role cannot create catalog products.");
  const patch = safeCatalogPatch(piece);
  if (patch.status !== "draft") throw new HttpsError("failed-precondition", "New team catalog products must start as drafts.");
  const brandSnap = await db.collection("brands").doc(brandId).get();
  const brand = brandSnap.data() || {};
  const product = { ...patch, brandId, ownerId: String(brand.ownerId || req.auth.uid), listedByUid: req.auth.uid, listedByName: String(req.auth.token.name || req.auth.token.email || "Brand team member"), createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  await db.collection("listings").doc(listingId).set(product, { merge: false });
  await writeAudit(db, { brandId, actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Brand team member"), action: "product_duplicated", entity: "product", entityId: listingId, entityName: String(product.name || "Product"), summary: "Product created as a catalog draft." });
  return { ok: true, listingId, status: "draft" };
});

const SHIPMENT_TRANSITIONS = {
  label_pending: new Set(["in_transit", "exception", "returned"]),
  in_transit: new Set(["out_for_delivery", "delivered", "exception", "returned"]),
  out_for_delivery: new Set(["delivered", "exception", "returned"]),
  exception: new Set(["in_transit", "out_for_delivery", "delivered", "returned"]),
  delivered: new Set(["returned"]),
  returned: new Set(),
};
const SHIPMENT_STATUSES = new Set(["label_pending", "in_transit", "out_for_delivery", "delivered", "exception", "returned"]);
const SHIPPING_EXCEPTION_CODES = new Set(["address_issue", "carrier_delay", "damaged", "lost", "recipient_unavailable", "customs", "other"]);

function shipmentRoleAllowed(role) {
  return ["owner", "admin", "support"].includes(role);
}

function safeShipmentInput(data) {
  const carrier = String(data?.carrier || "").trim().slice(0, 80);
  const trackingNumber = String(data?.trackingNumber || "").trim().slice(0, 120);
  const trackingUrl = data?.trackingUrl ? String(data.trackingUrl).trim().slice(0, 500) : "";
  if (!carrier || !trackingNumber) throw new HttpsError("invalid-argument", "Carrier and tracking number are required.");
  if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) throw new HttpsError("invalid-argument", "Tracking URL must be a valid web URL.");
  return { carrier, trackingNumber, trackingUrl };
}

exports.createOrderShipment = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const orderId = String(req.data?.orderId || "").trim();
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = snap.data() || {};
  const role = await brandMemberRole(db, order.brandId, req.auth.uid);
  if (!role || !shipmentRoleAllowed(role)) throw new HttpsError("permission-denied", "Your role cannot create shipments.");
  if (order.status !== "paid" || String(order.fulfillmentStatus || "unfulfilled") !== "packed") throw new HttpsError("failed-precondition", "Only packed paid orders can be shipped.");
  const input = safeShipmentInput(req.data);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const shipmentId = `sh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const shipment = { id: shipmentId, carrier: input.carrier, trackingNumber: input.trackingNumber, ...(input.trackingUrl ? { trackingUrl: input.trackingUrl } : {}), status: "in_transit", shippedAt: now, lastEventAt: now, createdAt: now, updatedAt: now };
  await orderRef.set({ carrier: input.carrier, trackingNumber: input.trackingNumber, shipment, fulfillmentStatus: "shipped", fulfillmentUpdatedAt: now }, { merge: true });
  await writeAudit(db, { brandId: String(order.brandId), actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Brand team member"), action: "order_fulfillment_updated", entity: "order", entityId: orderId, entityName: String(order.pieceName || "Order"), summary: `Shipment created with ${input.carrier}.`, metadata: { shipmentStatus: "in_transit", carrier: input.carrier } });
  return { ok: true, orderId, shipmentId, status: "in_transit" };
});

exports.updateOrderShipment = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const orderId = String(req.data?.orderId || "").trim();
  const nextStatus = String(req.data?.status || "").trim();
  if (!SHIPMENT_STATUSES.has(nextStatus)) throw new HttpsError("invalid-argument", "Invalid shipment status.");
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = snap.data() || {};
  const role = await brandMemberRole(db, order.brandId, req.auth.uid);
  if (!role || !shipmentRoleAllowed(role)) throw new HttpsError("permission-denied", "Your role cannot update shipments.");
  const shipment = order.shipment || {};
  const currentStatus = String(shipment.status || "label_pending");
  if (!SHIPMENT_TRANSITIONS[currentStatus] || !SHIPMENT_TRANSITIONS[currentStatus].has(nextStatus)) throw new HttpsError("failed-precondition", `Shipment cannot move from ${currentStatus} to ${nextStatus}.`);
  const exceptionCode = req.data?.exceptionCode ? String(req.data.exceptionCode) : "";
  const note = req.data?.note ? String(req.data.note).trim().slice(0, 240) : "";
  const location = req.data?.location ? String(req.data.location).trim().slice(0, 120) : "";
  if (nextStatus === "exception" && (!SHIPPING_EXCEPTION_CODES.has(exceptionCode) || !note)) throw new HttpsError("invalid-argument", "Exception code and note are required.");
  const now = admin.firestore.FieldValue.serverTimestamp();
  const nextShipment = { ...shipment, status: nextStatus, updatedAt: now, lastEventAt: now, ...(location ? { lastLocation: location } : {}), ...(nextStatus === "exception" ? { exceptionCode, exceptionNote: note } : {}), ...(nextStatus === "delivered" ? { deliveredAt: now } : {}) };
  const fulfillmentStatus = nextStatus === "delivered" ? "delivered" : nextStatus === "returned" ? "returned" : "shipped";
  await orderRef.set({ shipment: nextShipment, fulfillmentStatus, fulfillmentUpdatedAt: now, ...(nextStatus === "delivered" ? { deliveredAt: now } : {}) }, { merge: true });
  await writeAudit(db, { brandId: String(order.brandId), actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Brand team member"), action: "order_fulfillment_updated", entity: "order", entityId: orderId, entityName: String(order.pieceName || "Order"), summary: `Shipment updated to ${nextStatus.replace("_", " ")}.`, metadata: { shipmentStatus: nextStatus, ...(exceptionCode ? { exceptionCode } : {}) } });
  return { ok: true, orderId, status: nextStatus };
});

const SUPPORT_STATUSES = new Set(["open", "in_progress", "waiting_on_buyer", "escalated", "resolved", "closed"]);
const SUPPORT_PRIORITIES = new Set(["normal", "high", "urgent"]);
const SUPPORT_AGENT_ROLES = new Set(["owner", "admin", "support"]);
const SUPPORT_TRANSITIONS = { open: new Set(["in_progress", "waiting_on_buyer", "escalated", "resolved", "closed"]), in_progress: new Set(["waiting_on_buyer", "escalated", "resolved", "closed"]), waiting_on_buyer: new Set(["in_progress", "escalated", "resolved", "closed"]), escalated: new Set(["in_progress", "resolved", "closed"]), resolved: new Set(["open", "closed"]), closed: new Set(["open"]) };
const SUPPORT_CATEGORIES = new Set(["order_status", "shipping", "return", "refund", "cancellation", "product", "payment", "other"]);

exports.createSupportCase = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const input = req.data || {};
  const caseId = String(input.id || "").trim();
  const orderId = String(input.orderId || "").trim();
  const brandId = String(input.brandId || "").trim();
  if (!/^sc-[a-zA-Z0-9_-]{8,160}$/.test(caseId) || !orderId || !brandId || !String(input.threadId || "") || !String(input.pieceId || "")) throw new HttpsError("invalid-argument", "An order-linked support case is required.");
  if (!SUPPORT_CATEGORIES.has(String(input.category || "")) || !SUPPORT_PRIORITIES.has(String(input.priority || "normal"))) throw new HttpsError("invalid-argument", "Invalid support case category or priority.");
  const db = admin.firestore();
  const orderSnap = await db.collection("orders").doc(orderId).get();
  if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = orderSnap.data() || {};
  if (String(order.brandId || "") !== brandId || String(order.pieceId || "") !== String(input.pieceId)) throw new HttpsError("failed-precondition", "Support case does not match the order.");
  const role = await brandMemberRole(db, brandId, req.auth.uid);
  if (order.buyerId !== req.auth.uid && !role) throw new HttpsError("permission-denied", "Only the buyer or brand team can open this support case.");
  const caseRef = db.collection("supportCases").doc(caseId);
  const existing = await caseRef.get();
  if (existing.exists) return { ok: true, caseId, existing: true };
  const now = admin.firestore.FieldValue.serverTimestamp();
  await caseRef.set({
    id: caseId,
    brandId,
    orderId,
    threadId: String(input.threadId),
    pieceId: String(input.pieceId),
    buyerId: String(order.buyerId),
    buyerName: String(input.buyerName || order.address?.name || "Buyer").slice(0, 120),
    productName: String(input.productName || order.pieceName || "Order").slice(0, 160),
    productPhoto: String(input.productPhoto || order.piecePhoto || "").slice(0, 500),
    subject: String(input.subject || `Help with ${order.pieceName || "my order"}`).slice(0, 180),
    category: String(input.category),
    status: "open",
    priority: String(input.priority || "normal"),
    lastMessage: "",
    lastAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await writeAudit(db, { brandId, actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Buyer"), action: "support_case_created", entity: "order", entityId: orderId, entityName: String(order.pieceName || "Order"), summary: "Order-linked support case opened.", metadata: { category: String(input.category), priority: String(input.priority || "normal") } });
  return { ok: true, caseId, status: "open" };
});

exports.updateSupportCase = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const caseId = String(req.data?.caseId || "").trim();
  const db = admin.firestore();
  const caseRef = db.collection("supportCases").doc(caseId);
  const snap = await caseRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Support case not found.");
  const current = snap.data() || {};
  const role = await brandMemberRole(db, current.brandId, req.auth.uid);
  if (!role || !SUPPORT_AGENT_ROLES.has(role)) throw new HttpsError("permission-denied", "Your role cannot update support cases.");
  const input = req.data?.patch || {};
  const patch = {};
  if (input.status !== undefined) {
    if (!SUPPORT_STATUSES.has(String(input.status))) throw new HttpsError("invalid-argument", "Invalid support status.");
    const currentStatus = String(current.status || "open");
    if (String(input.status) !== currentStatus && !SUPPORT_TRANSITIONS[currentStatus]?.has(String(input.status))) throw new HttpsError("failed-precondition", "That support status transition is not allowed.");
    patch.status = String(input.status);
  }
  if (input.priority !== undefined) {
    if (!SUPPORT_PRIORITIES.has(String(input.priority))) throw new HttpsError("invalid-argument", "Invalid support priority.");
    patch.priority = String(input.priority);
  }
  if (input.assigneeUid !== undefined) {
    const assigneeUid = String(input.assigneeUid || "");
    if (assigneeUid) {
      const assigneeRole = await brandMemberRole(db, current.brandId, assigneeUid);
      if (!assigneeRole || !SUPPORT_AGENT_ROLES.has(assigneeRole)) throw new HttpsError("invalid-argument", "Assignee is not an eligible support agent.");
      patch.assigneeUid = assigneeUid;
      patch.assigneeName = String(input.assigneeName || "Support agent").slice(0, 120);
    } else {
      patch.assigneeUid = "";
      patch.assigneeName = "";
    }
  }
  if (input.lastMessage !== undefined) patch.lastMessage = String(input.lastMessage || "").trim().slice(0, 240);
  if (!Object.keys(patch).length) throw new HttpsError("invalid-argument", "No support changes were supplied.");
  patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  patch.lastAt = admin.firestore.FieldValue.serverTimestamp();
  await caseRef.set(patch, { merge: true });
  await writeAudit(db, { brandId: String(current.brandId), actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Support agent"), action: "support_case_updated", entity: "order", entityId: String(current.orderId || caseId), entityName: String(current.productName || "Order"), summary: "Support case updated.", metadata: { ...(patch.status ? { status: patch.status } : {}), ...(patch.priority ? { priority: patch.priority } : {}) } });
  return { ok: true, caseId };
});

exports.addSupportInternalNote = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const input = req.data || {};
  const caseId = String(input.caseId || "").trim();
  const noteId = String(input.id || "").trim();
  const body = String(input.body || "").trim().slice(0, 500);
  if (!caseId || !/^note-[a-zA-Z0-9_-]{8,160}$/.test(noteId) || !body) throw new HttpsError("invalid-argument", "A note is required.");
  const db = admin.firestore();
  const caseSnap = await db.collection("supportCases").doc(caseId).get();
  if (!caseSnap.exists) throw new HttpsError("not-found", "Support case not found.");
  const supportCase = caseSnap.data() || {};
  const role = await brandMemberRole(db, supportCase.brandId, req.auth.uid);
  if (!role || !SUPPORT_AGENT_ROLES.has(role)) throw new HttpsError("permission-denied", "Your role cannot add internal notes.");
  await db.collection("supportCases").doc(caseId).collection("notes").doc(noteId).set({ id: noteId, caseId, authorUid: req.auth.uid, authorName: String(req.auth.token.name || req.auth.token.email || "Support agent").slice(0, 120), body, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  await writeAudit(db, { brandId: String(supportCase.brandId), actorUid: req.auth.uid, actorName: String(req.auth.token.name || req.auth.token.email || "Support agent"), action: "support_note_added", entity: "order", entityId: String(supportCase.orderId || caseId), entityName: String(supportCase.productName || "Order"), summary: "Private support note added." });
  return { ok: true, caseId, noteId };
});
