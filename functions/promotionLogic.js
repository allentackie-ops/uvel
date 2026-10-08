function promotionCurrencyMismatch(promotion, checkoutCurrency) {
  const promotionCurrency = String(promotion?.currency || "").trim().toUpperCase();
  const buyerCurrency = String(checkoutCurrency || "").trim().toUpperCase();
  if (!promotionCurrency || !buyerCurrency || promotionCurrency === buyerCurrency) return null;

  const kind = String(promotion?.kind || "");
  const minimumOrderCents = Math.max(0, Math.floor(Number(promotion?.minimumOrderCents) || 0));
  if (kind === "percentage" && minimumOrderCents === 0) return null;
  if (kind === "fixed") {
    return `This fixed-amount promo is in ${promotionCurrency} and can only be used in a ${promotionCurrency} checkout.`;
  }
  return `This promo's minimum order is set in ${promotionCurrency}; it can only be used in a ${promotionCurrency} checkout.`;
}

module.exports = { promotionCurrencyMismatch };
