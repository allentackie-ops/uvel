const test = require("node:test");
const assert = require("node:assert/strict");
const { promotionQuoteFromRecord } = require("./promotionQuote");

const baseInput = { brandId: "brand-1", listingId: "listing-1", currency: "USD", itemCents: 10000 };

function quote(overrides = {}, input = baseInput) {
  return promotionQuoteFromRecord("promo-1", {
    code: "SAVE20",
    brandId: "brand-1",
    kind: "percentage",
    value: 20,
    currency: "USD",
    minimumOrderCents: 0,
    status: "live",
    ...overrides,
  }, "brand", { ...input, promotionId: "promo-1", code: "SAVE20" });
}

test("promotion flow applies an active brand code to the matching listing", () => {
  assert.deepEqual(quote(), {
    promotionId: "promo-1",
    code: "SAVE20",
    kind: "percentage",
    value: 20,
    currency: "USD",
    discountCents: 2000,
    minimumOrderCents: 0,
    source: "brand",
  });
});

test("promotion flow rejects a brand code outside its brand scope", () => {
  assert.equal(quote({}, { ...baseInput, brandId: "other-brand" }), null);
});

test("promotion flow rejects inactive, expired, capped, and below-minimum codes", () => {
  assert.equal(quote({ status: "paused" }), null);
  assert.equal(quote({ endAt: Date.now() - 1 }), null);
  assert.equal(quote({ usageCount: 3, usageLimit: 3 }), null);
  assert.equal(quote({ minimumOrderCents: 10001 }), null);
});

test("promotion flow keeps fixed discounts and minimums in their configured currency", () => {
  assert.equal(quote({ kind: "fixed", value: 25, currency: "EUR" }, { ...baseInput, currency: "USD" }), null);
  const fixed = quote({ kind: "fixed", value: 25, currency: "USD" });
  assert.equal(fixed.discountCents, 2500);
});
