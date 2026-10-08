const test = require("node:test");
const assert = require("node:assert/strict");
const { promotionCurrencyMismatch } = require("./promotionLogic");

test("percentage promo with no minimum works in a different checkout currency", () => {
  assert.equal(promotionCurrencyMismatch({ kind: "percentage", currency: "USD", minimumOrderCents: 0 }, "GHS"), null);
});

test("percentage promo with a minimum remains locked to its configured currency", () => {
  assert.match(promotionCurrencyMismatch({ kind: "percentage", currency: "USD", minimumOrderCents: 5000 }, "GHS"), /minimum order is set in USD/);
});

test("fixed promo remains locked to the currency in which its amount was entered", () => {
  assert.match(promotionCurrencyMismatch({ kind: "fixed", currency: "EUR", value: 10 }, "USD"), /fixed-amount promo is in EUR/);
});

test("same-currency and currency-neutral promos do not fail the currency check", () => {
  assert.equal(promotionCurrencyMismatch({ kind: "fixed", currency: "USD" }, "USD"), null);
  assert.equal(promotionCurrencyMismatch({ kind: "percentage", value: 20 }, "GHS"), null);
});
