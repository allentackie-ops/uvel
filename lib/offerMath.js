'use strict';

function suggestedOfferCents(listPriceCents) {
  const price = Math.max(0, Math.floor(Number(listPriceCents) || 0));
  if (price <= 1) return 0;
  return Math.max(1, Math.min(price - 1, Math.round(price * 0.75)));
}

module.exports = { suggestedOfferCents };
