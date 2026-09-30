const test = require("node:test");
const assert = require("node:assert/strict");
const { convertCents, feeCents } = require("./offerPricing");
const { suggestedOfferCents } = require("../lib/offerMath");

// The UI uses this same 25%-off rule in lib/offers.ts; keep a small fixture here
// so the recording's $6 → $4.50 recommendation is protected against regression.
test("recommended offer is 25 percent below the listing price in integer cents", () => {
  assert.equal(suggestedOfferCents(600), 450);
  assert.equal(suggestedOfferCents(101), 76);
  assert.equal(suggestedOfferCents(1), 0);
});

test("same-currency offer checkout preserves the exact accepted cents", () => {
  assert.equal(convertCents(450, "USD", "USD"), 450);
});

test("USD offer conversion uses the app market rounding policy", () => {
  assert.equal(convertCents(450, "USD", "CAD"), 600);
});

test("buyer protection fee is derived from the agreed item price", () => {
  assert.equal(feeCents(450, "USD", "USD"), 99);
  assert.equal(feeCents(6000, "USD", "USD"), 299);
});
