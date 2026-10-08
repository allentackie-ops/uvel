const test = require("node:test");
const assert = require("node:assert/strict");
const { promotionQuoteFromRecord } = require("./promotionQuote");

const input = { brandId: "brand-1", listingId: "listing-1", currency: "USD", itemCents: 10000 };
const livePercentage = { brandId: "brand-1", code: "SAVE10", kind: "percentage", value: 10, status: "live", usageCount: 0 };

test("quotes an active percentage promo and rounds the discount down to cents", () => {
  const quote = promotionQuoteFromRecord("promo-1", livePercentage, "brand", { ...input, promotionId: "promo-1", code: "save10" });
  assert.equal(quote.discountCents, 1000);
  assert.equal(quote.code, "SAVE10");
});

test("rejects a quote if the stored promotion ID or code does not match the order", () => {
  assert.equal(promotionQuoteFromRecord("promo-1", livePercentage, "brand", { ...input, promotionId: "other" }), null);
  assert.equal(promotionQuoteFromRecord("promo-1", livePercentage, "brand", { ...input, code: "OTHER" }), null);
});

test("rejects expired, not-yet-live, paused, over-limit, and over-cap promos", () => {
  const now = 1000;
  assert.equal(promotionQuoteFromRecord("p", { ...livePercentage, endAt: 999 }, "brand", input, now), null);
  assert.equal(promotionQuoteFromRecord("p", { ...livePercentage, startAt: 1001 }, "brand", input, now), null);
  assert.equal(promotionQuoteFromRecord("p", { ...livePercentage, status: "paused" }, "brand", input, now), null);
  assert.equal(promotionQuoteFromRecord("p", { ...livePercentage, usageCount: 1, usageLimit: 1 }, "brand", input, now), null);
  assert.equal(promotionQuoteFromRecord("p", { ...livePercentage, value: 71 }, "brand", input, now), null);
});

test("keeps listing promos bound to their listing and caps fixed discount at the item subtotal", () => {
  const listingPromo = { listingId: "listing-1", code: "TENOFF", kind: "fixed", value: 200, status: "live" };
  const quote = promotionQuoteFromRecord("listing-promo", listingPromo, "listing", { ...input, promotionId: "listing-promo", code: "TENOFF" });
  assert.equal(quote.discountCents, 10000);
  assert.equal(promotionQuoteFromRecord("listing-promo", listingPromo, "listing", { ...input, listingId: "other-listing", promotionId: "listing-promo" }), null);
});
