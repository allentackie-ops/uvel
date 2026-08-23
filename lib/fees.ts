import { convertCents, getMarket, type Market } from "./markets";

/** Buyer protection fee, priced in USD then converted. */
export function feeUsdCents(itemUsdCents: number) {
  const usd = itemUsdCents / 100;
  if (usd >= 1000) return 899;
  if (usd >= 500) return 699;
  if (usd >= 150) return 499;
  if (usd >= 50) return 299;
  return 99;
}

export function uvelFeeCents(itemCents: number, itemCurrency: string, view: Market) {
  const asUsd = convertCents(itemCents, itemCurrency, getMarket("US"));
  return convertCents(feeUsdCents(asUsd), "USD", view);
}

export function shippingCents(sameCountry: boolean, express: boolean, view: Market) {
  const usd = express ? (sameCountry ? 1299 : 2499) : sameCountry ? 599 : 1499;
  return convertCents(usd, "USD", view);
}

export type PayMethod = {
  id: string;
  label: string;
  kind: "apple" | "card" | "wallet" | "bank";
  icon?: "apple" | "momo" | "telecel" | "card";
};

export function payMethods(country: string): PayMethod[] {
  const apple: PayMethod = { id: "apple", label: "Apple Pay", kind: "apple", icon: "apple" };
  const card: PayMethod = { id: "card", label: "Card", kind: "card", icon: "card" };
  const extra: Record<string, PayMethod[]> = {
    US: [apple, card],
    CA: [apple, card],
    GB: [apple, card],
    IE: [apple, card],
    FR: [apple, card],
    DE: [apple, card],
    IT: [apple, card],
    ES: [apple, card],
    NL: [apple, { id: "ideal", label: "iDEAL", kind: "bank" }, card],
    PT: [apple, card],
    PL: [apple, { id: "blik", label: "BLIK", kind: "wallet" }, card],
    SE: [apple, { id: "swish", label: "Swish", kind: "wallet" }, card],
    MX: [apple, card, { id: "oxxo", label: "OXXO", kind: "bank" }],
    BR: [apple, { id: "pix", label: "Pix", kind: "wallet" }, card],
    AR: [card, { id: "transfer", label: "Bank transfer", kind: "bank" }],
    CO: [card, { id: "pse", label: "PSE", kind: "bank" }],
    CL: [card],
    PE: [card],
    GH: [
      { id: "momo", label: "MTN MoMo", kind: "wallet", icon: "momo" },
      { id: "telecel", label: "Telecel Cash", kind: "wallet", icon: "telecel" },
      card,
      apple,
    ],
    NG: [card, { id: "transfer", label: "Bank transfer", kind: "bank" }],
    KE: [{ id: "mpesa", label: "M-Pesa", kind: "wallet" }, card],
    ZA: [card, { id: "eft", label: "EFT", kind: "bank" }, apple],
    EG: [card],
    MA: [card],
    JP: [apple, card],
    KR: [card, { id: "kakaopay", label: "KakaoPay", kind: "wallet" }],
    CN: [{ id: "alipay", label: "Alipay", kind: "wallet" }, { id: "wechat", label: "WeChat Pay", kind: "wallet" }, card],
    HK: [apple, card],
    TW: [apple, card],
    IN: [{ id: "upi", label: "UPI", kind: "wallet" }, card],
    ID: [{ id: "qris", label: "QRIS", kind: "wallet" }, card],
    TH: [{ id: "promptpay", label: "PromptPay", kind: "wallet" }, card],
    VN: [card],
    PH: [card, { id: "gcash", label: "GCash", kind: "wallet" }],
    SG: [apple, { id: "paynow", label: "PayNow", kind: "wallet" }, card],
    MY: [card, { id: "fpx", label: "FPX", kind: "bank" }],
    AE: [apple, card],
  };
  return extra[country] ?? [apple, card];
}
