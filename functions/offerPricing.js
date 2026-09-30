const { HttpsError } = require("firebase-functions/v2/https");

const PER_USD = {
  USD: 1, CAD: 1.36, MXN: 17.2, BRL: 5.1, ARS: 980, COP: 4100, CLP: 950,
  PEN: 3.75, GBP: 0.79, EUR: 0.92, PLN: 4, SEK: 10.5, GHS: 15.5, NGN: 1600,
  KES: 129, ZAR: 18.2, EGP: 50, MAD: 10, JPY: 150, KRW: 1350, CNY: 7.2,
  HKD: 7.8, TWD: 32, INR: 84, IDR: 16000, THB: 34, VND: 25000, PHP: 58,
  SGD: 1.34, MYR: 4.5, AED: 3.67,
};
const ZERO_DECIMAL = new Set(["ARS", "COP", "CLP", "NGN", "JPY", "KRW", "IDR", "VND"]);

function millis(value) {
  if (typeof value === "number") return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  return 0;
}

function convertCents(cents, fromCurrency, toCurrency) {
  const amount = Number(cents);
  const from = String(fromCurrency || "USD").toUpperCase();
  const to = String(toCurrency || "USD").toUpperCase();
  if (!Number.isSafeInteger(amount) || !PER_USD[from] || !PER_USD[to]) throw new HttpsError("failed-precondition", "This offer currency is not supported for checkout.");
  if (from === to) return amount;
  const usdMajor = (amount / 100) / PER_USD[from];
  const raw = usdMajor * PER_USD[to];
  let roundedMajor;
  if (ZERO_DECIMAL.has(to) || raw >= 10000) roundedMajor = Math.round(raw / 100) * 100;
  else if (raw >= 1000) roundedMajor = Math.round(raw / 10) * 10;
  else roundedMajor = Math.round(raw);
  return roundedMajor * 100;
}

function feeUsdCents(itemUsdCents) {
  const usd = Number(itemUsdCents) / 100;
  if (usd >= 1000) return 899;
  if (usd >= 500) return 699;
  if (usd >= 150) return 499;
  if (usd >= 50) return 299;
  return 99;
}

function feeCents(itemCents, itemCurrency, paymentCurrency) {
  const usdCents = convertCents(itemCents, itemCurrency, "USD");
  return convertCents(feeUsdCents(usdCents), "USD", paymentCurrency);
}

function assertListingOfferLock(listing, order) {
  const activeId = String(listing.activeOfferId || "");
  const activeUntil = millis(listing.activeOfferExpiresAt);
  if (activeId && activeUntil > Date.now() && activeId !== String(order.offerId || "")) {
    throw new HttpsError("failed-precondition", "This listing is reserved while the seller’s accepted offer is active.");
  }
  if (order.offerId && activeId !== String(order.offerId)) {
    throw new HttpsError("failed-precondition", "This offer is no longer reserved for checkout.");
  }
}

async function assertOfferOrderPricing(db, order, buyerId) {
  const offerId = String(order?.offerId || "").trim();
  if (!offerId) return null;
  if (!/^[a-zA-Z0-9_-]{8,120}$/.test(offerId)) throw new HttpsError("invalid-argument", "Invalid offer checkout.");
  const offerRef = db.collection("listingOffers").doc(offerId);
  const listingId = String(order.pieceId || "");
  const listingRef = db.collection("listings").doc(listingId);
  const [offerSnap, listingSnap] = await Promise.all([offerRef.get(), listingRef.get()]);
  if (!offerSnap.exists || !listingSnap.exists) throw new HttpsError("not-found", "The accepted offer or listing is unavailable.");
  const offer = offerSnap.data() || {};
  const listing = listingSnap.data() || {};
  const agreedCents = Number(offer.agreedPriceCents ?? offer.offerCents);
  const offerCurrency = String(offer.currency || "USD").toUpperCase();
  const paymentCurrency = String(order.currency || "USD").toUpperCase();
  if (offer.status !== "accepted" || offer.buyerId !== buyerId || order.buyerId !== buyerId || offer.listingId !== listingId || order.sellerId !== offer.sellerId || order.brandId || listing.brandId || listing.status !== "listed" || listing.sellerPaused === true) {
    throw new HttpsError("failed-precondition", "This offer is not available for this checkout.");
  }
  const checkoutUntil = millis(offer.checkoutExpiresAt);
  if (!checkoutUntil || checkoutUntil <= Date.now()) throw new HttpsError("failed-precondition", "The accepted offer has expired.");
  assertListingOfferLock(listing, order);
  const available = Number(listing.stockQuantity);
  let heldByThisOrder = false;
  if (order.id && (!Number.isSafeInteger(available) || available <= 0)) {
    const reservationSnap = await db.collection("inventoryReservations").doc(String(order.id)).get();
    const reservation = reservationSnap.data() || {};
    heldByThisOrder = reservationSnap.exists && reservation.status === "active" && reservation.orderId === order.id && reservation.listingId === listingId;
  }
  if ((!Number.isSafeInteger(available) || available <= 0) && !heldByThisOrder) throw new HttpsError("failed-precondition", "This listing is no longer available.");
  const itemCents = convertCents(agreedCents, offerCurrency, paymentCurrency);
  const expectedFeeCents = feeCents(agreedCents, offerCurrency, paymentCurrency);
  const shippingCents = Number(order.shipCents || 0);
  const taxCents = Number(order.taxCents || 0);
  const expectedTotalCents = itemCents + expectedFeeCents + shippingCents + taxCents;
  if (
    !Number.isSafeInteger(agreedCents) || agreedCents <= 0 ||
    Number(order.offerPriceCents) !== agreedCents || String(order.offerCurrency || "").toUpperCase() !== offerCurrency ||
    Number(order.itemCents) !== itemCents || Number(order.feeCents) !== expectedFeeCents ||
    Number(order.discountCents || 0) !== 0 || Number(order.creditCents || 0) !== 0 ||
    order.promotionId || order.promotionCode ||
    !Number.isSafeInteger(shippingCents) || shippingCents < 0 || !Number.isSafeInteger(taxCents) || taxCents < 0 ||
    !Number.isSafeInteger(expectedTotalCents) || Number(order.totalCents) !== expectedTotalCents
  ) {
    throw new HttpsError("invalid-argument", "The offer checkout price no longer matches the seller’s agreement.");
  }
  return { offer, listing, itemCents, feeCents: expectedFeeCents };
}

module.exports = { millis, convertCents, feeCents, assertListingOfferLock, assertOfferOrderPricing };
