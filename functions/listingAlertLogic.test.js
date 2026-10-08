const { test } = require("node:test");
const assert = require("node:assert/strict");
const { detectListingAlertKinds, allowsListingAlertKind } = require("./listingAlertLogic");

test("detects a genuine lower listing price", () => {
  assert.deepEqual(detectListingAlertKinds(
    { status: "listed", listPriceCents: 12000, stockQuantity: 3 },
    { status: "listed", listPriceCents: 9900, stockQuantity: 3 },
  ), ["price_drop"]);
});

test("does not treat equal, increased, zero, or missing prices as a price drop", () => {
  for (const nextPrice of [12000, 13000, 0, undefined]) {
    assert.deepEqual(detectListingAlertKinds(
      { status: "listed", listPriceCents: 12000, stockQuantity: 2 },
      { status: "listed", listPriceCents: nextPrice, stockQuantity: 2 },
    ), []);
  }
});

test("detects a zero-to-positive stock-quantity transition as a restock", () => {
  assert.deepEqual(detectListingAlertKinds(
    { status: "sold", listPriceCents: 12000, stockQuantity: 0 },
    { status: "listed", listPriceCents: 12000, stockQuantity: 1 },
  ), ["restock"]);
});

test("detects restocks from per-size inventory", () => {
  assert.deepEqual(detectListingAlertKinds(
    { status: "sold", listPriceCents: 12000, sizeStock: { S: 0, M: 0 } },
    { status: "listed", listPriceCents: 12000, sizeStock: { S: 0, M: 2 } },
  ), ["restock"]);
});

test("does not infer restock when the prior inventory is unknown or the listing remains unavailable", () => {
  assert.deepEqual(detectListingAlertKinds(
    { status: "sold", listPriceCents: 12000 },
    { status: "listed", listPriceCents: 12000, stockQuantity: 2 },
  ), []);
  assert.deepEqual(detectListingAlertKinds(
    { status: "sold", listPriceCents: 12000, stockQuantity: 0 },
    { status: "sold", listPriceCents: 12000, stockQuantity: 2 },
  ), []);
});

test("supports simultaneous price-drop and restock changes", () => {
  assert.deepEqual(detectListingAlertKinds(
    { status: "sold", listPriceCents: 12000, stockQuantity: 0 },
    { status: "listed", listPriceCents: 9900, stockQuantity: 1 },
  ), ["price_drop", "restock"]);
});

test("filters changes according to the viewer's selected alert kind", () => {
  assert.equal(allowsListingAlertKind("price_drop", "price_drop"), true);
  assert.equal(allowsListingAlertKind("price_drop", "restock"), false);
  assert.equal(allowsListingAlertKind("restock", "restock"), true);
  assert.equal(allowsListingAlertKind("both", "price_drop"), true);
  assert.equal(allowsListingAlertKind(undefined, "restock"), true);
});
