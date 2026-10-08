function alertStockQuantity(listing = {}) {
  if (listing.sizeStock && typeof listing.sizeStock === "object") {
    const values = Object.values(listing.sizeStock);
    if (values.length) return values.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  }
  if (listing.stockQuantity == null) return null;
  const stock = Number(listing.stockQuantity);
  return Number.isFinite(stock) ? Math.max(0, stock) : null;
}

function detectListingAlertKinds(before = {}, after = {}) {
  if (!before || !after || after.status !== "listed") return [];
  const oldPrice = Number(before.listPriceCents);
  const newPrice = Number(after.listPriceCents);
  const kinds = [];
  if (Number.isFinite(oldPrice) && Number.isFinite(newPrice) && oldPrice > 0 && newPrice > 0 && newPrice < oldPrice) {
    kinds.push("price_drop");
  }
  const oldStock = alertStockQuantity(before);
  const newStock = alertStockQuantity(after);
  if (oldStock !== null && oldStock <= 0 && newStock !== null && newStock > 0) kinds.push("restock");
  return kinds;
}

function allowsListingAlertKind(preference, kind) {
  const alertKind = ["price_drop", "restock", "both"].includes(String(preference || "")) ? String(preference) : "both";
  return alertKind === "both" || alertKind === kind;
}

module.exports = { alertStockQuantity, detectListingAlertKinds, allowsListingAlertKind };
