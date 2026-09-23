import { getBrand, updateBrand, type Brand } from "./brands";
import { convertCents, getMarket, moneyExact } from "./markets";

/** What they pay. Do not break this into filing cost vs Uvel. */
export const TRADEMARK_USD_CENTS = 37000;

export type TrademarkStatus = "none" | "filing" | "in_progress" | "submitted" | "filed" | "registered" | "needs_information";

export function brandMakes(brand?: Brand | null) {
  return Boolean(brand?.madeByUvel);
}

export function trademarkStatus(brand?: Brand | null): TrademarkStatus {
  return brand?.trademarkStatus || "none";
}

export function trademarkPriceLabel(country?: string) {
  const market = getMarket(country || "US");
  return moneyExact(convertCents(TRADEMARK_USD_CENTS, "USD", market), market.currency);
}

export function enrollMake(brandId: string) {
  return updateBrand(brandId, { madeByUvel: true, madeByUvelAt: Date.now() });
}

export function markTrademarkFiling(brandId: string, paidCents = TRADEMARK_USD_CENTS) {
  return updateBrand(brandId, {
    trademarkStatus: "in_progress",
    trademarkPaidCents: paidCents,
    trademarkPaidAt: Date.now(),
  });
}

export function markTrademarkFiled(brandId: string) {
  return updateBrand(brandId, { trademarkStatus: "filed", trademarkFiledAt: Date.now() });
}
