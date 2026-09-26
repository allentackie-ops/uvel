const test = require("node:test");
const assert = require("node:assert/strict");
const {
  convertToUsdMarketCents,
  buyerProtectionFeeUsdCents,
  shippingUsdCents,
  quoteGroupedLine,
  groupedCarrier,
} = require("./groupedCheckoutMath");

test("USD prices remain exact and foreign listing prices follow the app conversion rounding", () => {
  assert.equal(convertToUsdMarketCents(14100, "USD"), 14100);
  assert.equal(convertToUsdMarketCents(10000, "CAD"), 7400);
  assert.equal(convertToUsdMarketCents(1000000, "JPY"), 6700);
  assert.throws(() => convertToUsdMarketCents(0, "USD"), /price/i);
  assert.throws(() => convertToUsdMarketCents(1000, "ZZZ"), /price/i);
});

test("buyer protection fee thresholds match single-item checkout", () => {
  assert.equal(buyerProtectionFeeUsdCents(4999), 99);
  assert.equal(buyerProtectionFeeUsdCents(5000), 299);
  assert.equal(buyerProtectionFeeUsdCents(14999), 299);
  assert.equal(buyerProtectionFeeUsdCents(15000), 499);
  assert.equal(buyerProtectionFeeUsdCents(50000), 699);
  assert.equal(buyerProtectionFeeUsdCents(100000), 899);
});

test("shipping fees reflect the listing's home/international destination and carrier speed", () => {
  assert.equal(shippingUsdCents(true, false), 599);
  assert.equal(shippingUsdCents(false, false), 1499);
  assert.equal(shippingUsdCents(true, true), 1299);
  assert.equal(shippingUsdCents(false, true), 2499);
});

test("group quote charges protection and shipping per distinct item/seller", () => {
  const lines = [14100, 6400, 9800].map((listPriceCents) => quoteGroupedLine({
    listPriceCents,
    currency: "USD",
    sameCountry: true,
    buyerPaysShipping: true,
  }));
  assert.deepEqual(lines.map(({ itemCents, feeCents, shipCents, totalCents }) => ({ itemCents, feeCents, shipCents, totalCents })), [
    { itemCents: 14100, feeCents: 299, shipCents: 599, totalCents: 14998 },
    { itemCents: 6400, feeCents: 299, shipCents: 599, totalCents: 7298 },
    { itemCents: 9800, feeCents: 299, shipCents: 599, totalCents: 10698 },
  ]);
  assert.equal(lines.reduce((sum, line) => sum + line.totalCents, 0), 32994);
});

test("shipping waived by a seller does not remove buyer protection; Uvel-made listings still charge delivery", () => {
  assert.deepEqual(quoteGroupedLine({ listPriceCents: 8000, currency: "USD", sameCountry: true, buyerPaysShipping: false }), {
    itemCents: 8000, feeCents: 299, shipCents: 0, creditCents: 0, totalCents: 8299,
  });
  assert.deepEqual(quoteGroupedLine({ listPriceCents: 8000, currency: "USD", sameCountry: true, buyerPaysShipping: false, madeByUvel: true }), {
    itemCents: 8000, feeCents: 299, shipCents: 599, creditCents: 0, totalCents: 8898,
  });
});

test("a First Find credit reduces the buyer total once while preserving the seller item amount", () => {
  const line = quoteGroupedLine({ listPriceCents: 14100, currency: "USD", sameCountry: true, creditCents: 1500 });
  assert.deepEqual(line, { itemCents: 14100, feeCents: 299, shipCents: 599, creditCents: 1500, totalCents: 13498 });
  assert.throws(() => quoteGroupedLine({ listPriceCents: 14100, currency: "USD", sameCountry: true, creditCents: 14101 }), /credit/i);
});

test("carrier validation respects the listing's enabled carrier allow-list", () => {
  assert.deepEqual(groupedCarrier("US", "fedex", ["fedex"]), { id: "fedex", name: "FedEx", express: true });
  assert.equal(groupedCarrier("US", "ups", ["fedex"]), null);
  assert.deepEqual(groupedCarrier("CA", "canada-post", []), { id: "canada-post", name: "Canada Post", express: false });
});
