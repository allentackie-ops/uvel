const { promotionCurrencyMismatch } = require("./promotionLogic");

function timestampMillis(value) {
  if (typeof value === "number") return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  return 0;
}

function promotionQuoteFromRecord(promotionId, promotion, source, input, now = Date.now()) {
  const brandId = String(input.brandId || "").trim();
  const listingId = String(input.listingId || "").trim();
  const requestedId = String(input.promotionId || "").trim();
  const code = String(input.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const currency = String(input.currency || "").toUpperCase();
  const itemCents = Math.floor(Number(input.itemCents) || 0);
  if (!listingId || !currency || !Number.isSafeInteger(itemCents) || itemCents <= 0 || !promotion || !["brand", "listing"].includes(source)) return null;

  const storedCode = String(promotion.code || "").toUpperCase();
  const active = promotion.status === "live" && (!promotion.startAt || timestampMillis(promotion.startAt) <= now) && (!promotion.endAt || timestampMillis(promotion.endAt) >= now);
  if ((source === "brand" && (!brandId || promotion.brandId !== brandId)) || (source === "listing" && promotion.listingId !== listingId) || (requestedId && String(promotionId) !== requestedId) || (code && storedCode !== code) || !active) return null;
  if (promotionCurrencyMismatch(promotion, currency)) return null;

  const minimumOrderCents = Math.max(0, Math.floor(Number(promotion.minimumOrderCents) || 0));
  if (itemCents < minimumOrderCents) return null;
  const usageCount = Math.max(0, Math.floor(Number(promotion.usageCount) || 0));
  const usageLimit = promotion.usageLimit == null ? undefined : Math.max(1, Math.floor(Number(promotion.usageLimit) || 0));
  if (usageLimit != null && usageCount >= usageLimit) return null;
  const kind = String(promotion.kind || "");
  const value = Number(promotion.value);
  if (!["percentage", "fixed"].includes(kind) || !Number.isFinite(value) || value <= 0 || (kind === "percentage" && value > 70)) return null;
  const discountCents = kind === "percentage" ? Math.min(itemCents, Math.floor(itemCents * value / 100)) : Math.min(itemCents, Math.floor(value * 100));
  if (!discountCents) return null;
  return { promotionId: String(promotionId), code: storedCode, kind, value, currency, discountCents, minimumOrderCents, source };
}

async function resolvePromotionQuote(db, input) {
  const brandId = String(input.brandId || "").trim();
  const listingId = String(input.listingId || "").trim();
  const promotionId = String(input.promotionId || "").trim();
  const code = String(input.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const currency = String(input.currency || "").toUpperCase();
  const itemCents = Math.floor(Number(input.itemCents) || 0);
  if (!listingId || !currency || !Number.isSafeInteger(itemCents) || itemCents <= 0 || (!promotionId && !code)) return null;

  const listingSnap = await db.collection("listings").doc(listingId).get();
  const listing = listingSnap.data() || {};
  if (!listingSnap.exists || listing.status !== "listed" || listing.sellerPaused === true || (brandId && listing.brandId !== brandId)) return null;

  let promotionSnap = null;
  let source = "brand";
  if (promotionId) {
    const brandSnap = brandId ? await db.collection("brandPromotions").doc(promotionId).get() : null;
    if (brandSnap && brandSnap.exists) promotionSnap = brandSnap;
    if (!promotionSnap) {
      const listingPromotion = await db.collection("listingPromotions").doc(promotionId).get();
      if (listingPromotion.exists) {
        promotionSnap = listingPromotion;
        source = "listing";
      }
    }
  } else {
    if (brandId) {
      const promotions = await db.collection("brandPromotions").where("brandId", "==", brandId).get();
      promotionSnap = promotions.docs.find((snap) => String(snap.data()?.code || "").toUpperCase() === code) || null;
    }
    if (!promotionSnap) {
      const promotions = await db.collection("listingPromotions").where("listingId", "==", listingId).get();
      promotionSnap = promotions.docs.find((snap) => String(snap.data()?.code || "").toUpperCase() === code) || null;
      if (promotionSnap) source = "listing";
    }
  }
  if (!promotionSnap?.exists) return null;
  return promotionQuoteFromRecord(promotionSnap.id, promotionSnap.data() || {}, source, { ...input, brandId, listingId, promotionId, code, currency, itemCents });
}

module.exports = { resolvePromotionQuote, promotionQuoteFromRecord };
