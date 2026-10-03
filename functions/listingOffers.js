const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { notifyUid } = require("./notify");
const { millis } = require("./offerPricing");

const OFFER_REPLY_MS = 24 * 60 * 60 * 1000;
const CHECKOUT_MS = 24 * 60 * 60 * 1000;
const ZERO_DECIMAL_CURRENCIES = new Set(["ARS", "COP", "CLP", "NGN", "JPY", "KRW", "IDR", "VND"]);
const safeName = (value, fallback) => String(value || "").trim().slice(0, 100) || fallback;
function idForChat(buyerId, sellerId, listingId) {
  return `${[buyerId, sellerId].sort().join("_")}__${listingId}`;
}
function currencyText(cents, currency) {
  try {
    const digits = ZERO_DECIMAL_CURRENCIES.has(String(currency).toUpperCase()) ? 0 : 2;
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(cents) / 100);
  } catch {
    return `${currency} ${(Number(cents) / 100).toFixed(2)}`;
  }
}
function userName(data, fallback) {
  return safeName(data?.displayName || data?.name, fallback);
}
function userPhoto(data) {
  return String(data?.avatarUri || data?.photoURL || data?.photo || "").slice(0, 2000);
}
function profileUsername(data) {
  return String(data?.username || data?.handle || "").replace(/^@/, "").slice(0, 40);
}
function offerNotificationRef(db, uid, id) {
  return db.collection("users").doc(uid).collection("notifications").doc(id);
}

exports.createListingOffer = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in before making an offer.");
  const buyerId = req.auth.uid;
  const listingId = String(req.data?.listingId || "").trim();
  const offerCents = Number(req.data?.offerCents);
  if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(listingId) || !Number.isSafeInteger(offerCents) || offerCents <= 0) throw new HttpsError("invalid-argument", "Enter a valid offer amount.");

  const db = admin.firestore();
  const listingRef = db.collection("listings").doc(listingId);
  const listingSnap = await listingRef.get();
  if (!listingSnap.exists) throw new HttpsError("not-found", "This listing is unavailable.");
  const listing = listingSnap.data() || {};
  const sellerId = String(listing.ownerId || listing.listedByUid || "");
  const listPriceCents = Number(listing.listPriceCents);
  const currency = String(listing.currency || "USD").toUpperCase();
  if (listing.brandId || listing.status !== "listed" || listing.sellerPaused === true || Number(listing.reservedQuantity || 0) > 0 || !sellerId || sellerId === buyerId || !Number.isSafeInteger(listPriceCents) || listPriceCents <= 1 || offerCents >= listPriceCents || !/^[A-Z]{3}$/.test(currency) || !Number.isSafeInteger(Number(listing.stockQuantity)) || Number(listing.stockQuantity) <= 0) {
    throw new HttpsError("failed-precondition", "Offers are available only on active listings from another individual seller.");
  }

  const [buyerSnap, sellerSnap] = await Promise.all([
    db.collection("users").doc(buyerId).get(),
    db.collection("users").doc(sellerId).get(),
  ]);
  const buyer = buyerSnap.data() || {};
  const seller = sellerSnap.data() || {};
  const buyerName = userName(buyer, safeName(req.auth.token.name, "Buyer"));
  const buyerUsername = profileUsername(buyer);
  const buyerPhoto = userPhoto(buyer);
  const sellerName = userName(seller, safeName(listing.ownerName || listing.listedByName, "Seller"));
  const threadId = idForChat(buyerId, sellerId, listingId);
  const offerId = `of-${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}`;
  const messageId = offerId;
  const now = Date.now();
  const dbNow = admin.firestore.FieldValue.serverTimestamp();
  const expiresAt = admin.firestore.Timestamp.fromMillis(now + OFFER_REPLY_MS);
  const offerRef = db.collection("listingOffers").doc(offerId);
  const chatRef = db.collection("chats").doc(threadId);
  const messageRef = chatRef.collection("messages").doc(messageId);
  const notificationId = `offer-received-${offerId}`;
  const notificationRef = offerNotificationRef(db, sellerId, notificationId);
  const text = `${buyerName} offered ${currencyText(offerCents, currency)} for ${String(listing.name || "this listing").slice(0, 120)}.`;

  await db.runTransaction(async (tx) => {
    const [liveListingSnap, chatSnap] = await Promise.all([tx.get(listingRef), tx.get(chatRef)]);
    if (!liveListingSnap.exists) throw new HttpsError("not-found", "This listing is unavailable.");
    const liveListing = liveListingSnap.data() || {};
    const currentSellerId = String(liveListing.ownerId || liveListing.listedByUid || "");
    const currentPrice = Number(liveListing.listPriceCents);
    if (liveListing.brandId || liveListing.status !== "listed" || liveListing.sellerPaused === true || Number(liveListing.reservedQuantity || 0) > 0 || currentSellerId !== sellerId || sellerId === buyerId || !Number.isSafeInteger(currentPrice) || offerCents >= currentPrice || Number(liveListing.stockQuantity) <= 0) throw new HttpsError("failed-precondition", "This listing is no longer eligible for an offer.");
    const activeId = String(liveListing.activeOfferId || "");
    const activeUntil = millis(liveListing.activeOfferExpiresAt);
    if (activeId && activeUntil > now) {
      const activeSnap = await tx.get(db.collection("listingOffers").doc(activeId));
      const activeOffer = activeSnap.exists ? activeSnap.data() || {} : {};
      if (activeOffer.status === "accepted" && millis(activeOffer.checkoutExpiresAt) > now) throw new HttpsError("failed-precondition", "The seller has another accepted offer active for this listing.");
    }
    if (activeId && activeUntil <= now) tx.set(listingRef, { activeOfferId: null, activeOfferExpiresAt: null }, { merge: true });
    const oldChat = chatSnap.exists ? chatSnap.data() || {} : {};
    if (chatSnap.exists && (oldChat.buyerId !== buyerId || oldChat.sellerId !== sellerId || oldChat.pieceId !== listingId)) throw new HttpsError("failed-precondition", "This conversation does not match the listing participants.");
    tx.set(offerRef, {
      id: offerId,
      listingId,
      threadId,
      buyerId,
      buyerName,
      buyerUsername,
      buyerPhoto,
      sellerId,
      sellerName,
      listingName: String(liveListing.name || "Listing").slice(0, 180),
      listingPhoto: String(liveListing.photo || (Array.isArray(liveListing.photos) ? liveListing.photos[0] : "") || "").slice(0, 2000),
      currency,
      offerCents,
      status: "pending",
      createdAt: dbNow,
      createdAtMs: now,
      expiresAt,
      responseMessage: "",
      agreedPriceCents: null,
      checkoutExpiresAt: null,
    });
    tx.set(chatRef, {
      id: threadId,
      pieceId: listingId,
      buyerId,
      sellerId,
      pieceName: String(liveListing.name || "Listing").slice(0, 180),
      piecePhoto: String(liveListing.photo || (Array.isArray(liveListing.photos) ? liveListing.photos[0] : "") || "").slice(0, 2000),
      piecePriceCents: currentPrice,
      sellerName,
      buyerName,
      buyerPhoto,
      buyerUsername,
      lastText: text,
      lastAt: now,
      lastFrom: buyerId,
      unreadBuyer: Number(oldChat.unreadBuyer || 0),
      unreadSeller: Number(oldChat.unreadSeller || 0) + 1,
      typingBy: "",
      typingAt: 0,
      updatedAt: dbNow,
    }, { merge: true });
    tx.set(messageRef, {
      id: messageId,
      offerId,
      text,
      from: buyerId,
      fromName: buyerName,
      fromUsername: buyerUsername,
      fromPhoto: buyerPhoto,
      kind: "offer",
      createdAt: now,
      offerCents,
      offerStatus: "pending",
      offerExpiresAt: expiresAt,
      responseMessage: "",
      status: "delivered",
    });
    tx.set(notificationRef, {
      id: notificationId,
      kind: "offer_received",
      title: "New offer",
      body: `${buyerName} offered ${currencyText(offerCents, currency)} for ${String(liveListing.name || "your listing").slice(0, 100)}.`,
      listingId,
      offerId,
      threadId,
      imageUrl: String(liveListing.photo || "").slice(0, 2000),
      readAt: null,
      createdAt: now,
    }, { merge: true });
  });

  await notifyUid(db, sellerId, "New offer", `${buyerName} offered ${currencyText(offerCents, currency)} for ${String(listing.name || "your listing").slice(0, 100)}.`, { kind: "offer_received", offerId, listingId, threadId }).catch(() => undefined);
  return { offerId, threadId, status: "pending", offerCents, currency, expiresAt: now + OFFER_REPLY_MS };
});

exports.respondToListingOffer = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in to respond to this offer.");
  const offerId = String(req.data?.offerId || "").trim();
  const decision = String(req.data?.decision || "");
  const responseMessage = String(req.data?.message || "").trim().slice(0, 500);
  if (!/^of-[a-z0-9-]{8,120}$/i.test(offerId) || !["accepted", "declined"].includes(decision) || (decision === "accepted" && responseMessage)) throw new HttpsError("invalid-argument", "Choose yes or no for this offer.");

  const db = admin.firestore();
  const offerRef = db.collection("listingOffers").doc(offerId);
  const result = await db.runTransaction(async (tx) => {
    const offerSnap = await tx.get(offerRef);
    if (!offerSnap.exists) throw new HttpsError("not-found", "This offer is unavailable.");
    const offer = offerSnap.data() || {};
    if (offer.sellerId !== req.auth.uid) throw new HttpsError("permission-denied", "Only the listing’s seller can respond to this offer.");
    if (offer.status !== "pending") throw new HttpsError("failed-precondition", "This offer has already been answered.");
    const listingRef = db.collection("listings").doc(String(offer.listingId || ""));
    const chatRef = db.collection("chats").doc(String(offer.threadId || ""));
    const messageRef = chatRef.collection("messages").doc(offerId);
    const [listingSnap, chatSnap, messageSnap] = await Promise.all([tx.get(listingRef), tx.get(chatRef), tx.get(messageRef)]);
    if (!listingSnap.exists || !chatSnap.exists || !messageSnap.exists) throw new HttpsError("failed-precondition", "The offer conversation or listing is unavailable.");
    const listing = listingSnap.data() || {};
    const chat = chatSnap.data() || {};
    if (listing.brandId || String(listing.ownerId || listing.listedByUid || "") !== req.auth.uid || chat.sellerId !== req.auth.uid || chat.buyerId !== offer.buyerId) throw new HttpsError("permission-denied", "You can only answer offers for your own personal listings.");
    const now = Date.now();
    const buyerId = String(offer.buyerId || "");
    const notificationId = `offer-${decision}-${offerId}`;
    const notificationRef = offerNotificationRef(db, buyerId, notificationId);
    if (millis(offer.expiresAt) <= now) {
      tx.set(offerRef, { status: "expired", expiredAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(messageRef, { offerStatus: "expired" }, { merge: true });
      tx.set(chatRef, { lastText: "The offer expired before the seller responded.", lastAt: now, lastFrom: req.auth.uid, unreadBuyer: Number(chat.unreadBuyer || 0) + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(notificationRef, { id: notificationId, kind: "offer_expired", title: "Offer expired", body: "The seller didn’t respond within 24 hours.", listingId: offer.listingId, offerId, threadId: offer.threadId, imageUrl: offer.listingPhoto || "", readAt: null, createdAt: now }, { merge: true });
      return { expired: true, buyerId, listingId: String(offer.listingId), threadId: String(offer.threadId), notificationId };
    }
    if (listing.status !== "listed" || listing.sellerPaused === true || Number(listing.stockQuantity) <= 0) throw new HttpsError("failed-precondition", "This listing is no longer available.");
    if (decision === "accepted" && Number(listing.reservedQuantity || 0) > 0) throw new HttpsError("failed-precondition", "This listing is in another checkout right now. Try responding again after that checkout releases the item.");

    let checkoutExpiresAt = null;
    if (decision === "accepted") {
      const activeId = String(listing.activeOfferId || "");
      const activeUntil = millis(listing.activeOfferExpiresAt);
      if (activeId && activeUntil > now && activeId !== offerId) throw new HttpsError("failed-precondition", "Another accepted offer is already active for this listing.");
      checkoutExpiresAt = admin.firestore.Timestamp.fromMillis(now + CHECKOUT_MS);
      tx.set(listingRef, { activeOfferId: offerId, activeOfferExpiresAt: checkoutExpiresAt, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
    const title = decision === "accepted" ? "Your offer was accepted" : "Offer declined";
    const body = decision === "accepted"
      ? `${offer.sellerName || "The seller"} accepted ${currencyText(Number(offer.offerCents), String(offer.currency || "USD"))}. Tap to check out within 24 hours.`
      : responseMessage ? `The seller declined your offer. See why: ${responseMessage}` : "The seller declined your offer.";
    const chatText = decision === "accepted" ? "Offer accepted · tap to check out" : responseMessage ? `Offer declined: ${responseMessage}` : "Offer declined";
    tx.set(offerRef, {
      status: decision,
      agreedPriceCents: decision === "accepted" ? Number(offer.offerCents) : null,
      acceptedAt: decision === "accepted" ? admin.firestore.FieldValue.serverTimestamp() : null,
      declinedAt: decision === "declined" ? admin.firestore.FieldValue.serverTimestamp() : null,
      checkoutExpiresAt,
      responseMessage,
      respondedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(messageRef, {
      offerStatus: decision,
      responseMessage,
      checkoutExpiresAt,
      respondedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(chatRef, {
      lastText: chatText,
      lastAt: now,
      lastFrom: req.auth.uid,
      unreadBuyer: Number(chat.unreadBuyer || 0) + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(notificationRef, {
      id: notificationId,
      kind: decision === "accepted" ? "offer_accepted" : "offer_declined",
      title,
      body,
      listingId: String(offer.listingId),
      offerId,
      threadId: String(offer.threadId),
      imageUrl: String(offer.listingPhoto || ""),
      responseMessage,
      readAt: null,
      createdAt: now,
    }, { merge: true });
    return { expired: false, buyerId, listingId: String(offer.listingId), threadId: String(offer.threadId), title, body, kind: decision === "accepted" ? "offer_accepted" : "offer_declined" };
  });
  if (result.expired) {
    await notifyUid(db, result.buyerId, "Offer expired", "The seller didn’t respond within 24 hours.", { kind: "offer_expired", offerId, listingId: result.listingId, threadId: result.threadId }).catch(() => undefined);
    throw new HttpsError("deadline-exceeded", "This offer expired before the seller responded.");
  }
  await notifyUid(db, result.buyerId, result.title, result.body, { kind: result.kind, offerId, listingId: result.listingId, threadId: result.threadId }).catch(() => undefined);
  return { offerId, status: decision, responseMessage, checkoutExpiresAt: decision === "accepted" ? Date.now() + CHECKOUT_MS : null };
});

exports.expireListingOffers = onSchedule({ schedule: "every 15 minutes", timeoutSeconds: 540, memory: "512MiB" }, async () => {
  const db = admin.firestore();
  const now = Date.now();
  const expired = await db.collection("listingOffers")
    .where("status", "==", "pending")
    .where("expiresAt", "<=", admin.firestore.Timestamp.fromMillis(now))
    .orderBy("expiresAt", "asc")
    .limit(200)
    .get();

  for (const candidate of expired.docs) {
    const result = await db.runTransaction(async (tx) => {
      const offerSnap = await tx.get(candidate.ref);
      if (!offerSnap.exists) return null;
      const offer = offerSnap.data() || {};
      if (offer.status !== "pending" || millis(offer.expiresAt) > now) return null;
      const listingRef = db.collection("listings").doc(String(offer.listingId || ""));
      const chatRef = db.collection("chats").doc(String(offer.threadId || ""));
      const messageRef = chatRef.collection("messages").doc(candidate.id);
      const notificationId = `offer-expired-${candidate.id}`;
      const notificationRef = offerNotificationRef(db, String(offer.buyerId || ""), notificationId);
      const [listingSnap, chatSnap, messageSnap] = await Promise.all([tx.get(listingRef), tx.get(chatRef), tx.get(messageRef)]);
      if (!chatSnap.exists || !messageSnap.exists) return null;
      const chat = chatSnap.data() || {};
      const title = "Offer expired";
      const body = "The seller didn’t respond within 24 hours.";
      tx.set(candidate.ref, { status: "expired", expiredAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(messageRef, { offerStatus: "expired" }, { merge: true });
      tx.set(chatRef, { lastText: "The offer expired before the seller responded.", lastAt: now, unreadBuyer: Number(chat.unreadBuyer || 0) + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(notificationRef, {
        id: notificationId,
        kind: "offer_expired",
        title,
        body,
        listingId: String(offer.listingId || ""),
        offerId: candidate.id,
        threadId: String(offer.threadId || ""),
        imageUrl: String(offer.listingPhoto || (listingSnap.data() || {}).photo || ""),
        readAt: null,
        createdAt: now,
      }, { merge: true });
      return { buyerId: String(offer.buyerId || ""), listingId: String(offer.listingId || ""), threadId: String(offer.threadId || ""), title, body };
    });
    if (result?.buyerId) {
      await notifyUid(db, result.buyerId, result.title, result.body, { kind: "offer_expired", offerId: candidate.id, listingId: result.listingId, threadId: result.threadId }).catch(() => undefined);
    }
  }
});
