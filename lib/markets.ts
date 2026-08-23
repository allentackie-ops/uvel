export type Region = "North America" | "South America" | "Europe" | "Africa" | "Asia";

export type Market = {
  code: string;
  name: string;
  region: Region;
  currency: string;
  symbol: string;
  locale: string;
  perUsd: number;
  zeroDecimal?: boolean;
};

export const MARKETS: Market[] = [
  { code: "US", name: "United States", region: "North America", currency: "USD", symbol: "$", locale: "en-US", perUsd: 1 },
  { code: "CA", name: "Canada", region: "North America", currency: "CAD", symbol: "CA$", locale: "en-CA", perUsd: 1.36 },
  { code: "MX", name: "Mexico", region: "North America", currency: "MXN", symbol: "MX$", locale: "es-MX", perUsd: 17.2 },
  { code: "BR", name: "Brazil", region: "South America", currency: "BRL", symbol: "R$", locale: "pt-BR", perUsd: 5.1 },
  { code: "AR", name: "Argentina", region: "South America", currency: "ARS", symbol: "AR$", locale: "es-AR", perUsd: 980, zeroDecimal: true },
  { code: "CO", name: "Colombia", region: "South America", currency: "COP", symbol: "COL$", locale: "es-CO", perUsd: 4100, zeroDecimal: true },
  { code: "CL", name: "Chile", region: "South America", currency: "CLP", symbol: "CLP$", locale: "es-CL", perUsd: 950, zeroDecimal: true },
  { code: "PE", name: "Peru", region: "South America", currency: "PEN", symbol: "S/", locale: "es-PE", perUsd: 3.75 },
  { code: "GB", name: "United Kingdom", region: "Europe", currency: "GBP", symbol: "£", locale: "en-GB", perUsd: 0.79 },
  { code: "IE", name: "Ireland", region: "Europe", currency: "EUR", symbol: "€", locale: "en-IE", perUsd: 0.92 },
  { code: "FR", name: "France", region: "Europe", currency: "EUR", symbol: "€", locale: "fr-FR", perUsd: 0.92 },
  { code: "DE", name: "Germany", region: "Europe", currency: "EUR", symbol: "€", locale: "de-DE", perUsd: 0.92 },
  { code: "IT", name: "Italy", region: "Europe", currency: "EUR", symbol: "€", locale: "it-IT", perUsd: 0.92 },
  { code: "ES", name: "Spain", region: "Europe", currency: "EUR", symbol: "€", locale: "es-ES", perUsd: 0.92 },
  { code: "NL", name: "Netherlands", region: "Europe", currency: "EUR", symbol: "€", locale: "nl-NL", perUsd: 0.92 },
  { code: "PT", name: "Portugal", region: "Europe", currency: "EUR", symbol: "€", locale: "pt-PT", perUsd: 0.92 },
  { code: "PL", name: "Poland", region: "Europe", currency: "PLN", symbol: "zł", locale: "pl-PL", perUsd: 4.0 },
  { code: "SE", name: "Sweden", region: "Europe", currency: "SEK", symbol: "kr", locale: "sv-SE", perUsd: 10.5 },
  { code: "GH", name: "Ghana", region: "Africa", currency: "GHS", symbol: "GH₵", locale: "en-GH", perUsd: 15.5 },
  { code: "NG", name: "Nigeria", region: "Africa", currency: "NGN", symbol: "₦", locale: "en-NG", perUsd: 1600, zeroDecimal: true },
  { code: "KE", name: "Kenya", region: "Africa", currency: "KES", symbol: "KSh", locale: "en-KE", perUsd: 129 },
  { code: "ZA", name: "South Africa", region: "Africa", currency: "ZAR", symbol: "R", locale: "en-ZA", perUsd: 18.2 },
  { code: "EG", name: "Egypt", region: "Africa", currency: "EGP", symbol: "E£", locale: "ar-EG", perUsd: 50 },
  { code: "MA", name: "Morocco", region: "Africa", currency: "MAD", symbol: "MAD", locale: "fr-MA", perUsd: 10 },
  { code: "JP", name: "Japan", region: "Asia", currency: "JPY", symbol: "¥", locale: "ja-JP", perUsd: 150, zeroDecimal: true },
  { code: "KR", name: "South Korea", region: "Asia", currency: "KRW", symbol: "₩", locale: "ko-KR", perUsd: 1350, zeroDecimal: true },
  { code: "CN", name: "China", region: "Asia", currency: "CNY", symbol: "¥", locale: "zh-CN", perUsd: 7.2 },
  { code: "HK", name: "Hong Kong", region: "Asia", currency: "HKD", symbol: "HK$", locale: "zh-HK", perUsd: 7.8 },
  { code: "TW", name: "Taiwan", region: "Asia", currency: "TWD", symbol: "NT$", locale: "zh-TW", perUsd: 32 },
  { code: "IN", name: "India", region: "Asia", currency: "INR", symbol: "₹", locale: "en-IN", perUsd: 84 },
  { code: "ID", name: "Indonesia", region: "Asia", currency: "IDR", symbol: "Rp", locale: "id-ID", perUsd: 16000, zeroDecimal: true },
  { code: "TH", name: "Thailand", region: "Asia", currency: "THB", symbol: "฿", locale: "th-TH", perUsd: 34 },
  { code: "VN", name: "Vietnam", region: "Asia", currency: "VND", symbol: "₫", locale: "vi-VN", perUsd: 25000, zeroDecimal: true },
  { code: "PH", name: "Philippines", region: "Asia", currency: "PHP", symbol: "₱", locale: "en-PH", perUsd: 58 },
  { code: "SG", name: "Singapore", region: "Asia", currency: "SGD", symbol: "S$", locale: "en-SG", perUsd: 1.34 },
  { code: "MY", name: "Malaysia", region: "Asia", currency: "MYR", symbol: "RM", locale: "ms-MY", perUsd: 4.5 },
  { code: "AE", name: "United Arab Emirates", region: "Asia", currency: "AED", symbol: "AED", locale: "ar-AE", perUsd: 3.67 },
];

const BY_CODE = Object.fromEntries(MARKETS.map((m) => [m.code, m]));
const BY_CURRENCY = Object.fromEntries(MARKETS.map((m) => [m.currency, m]));

const TZ: Record<string, string> = {
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Phoenix": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Mexico_City": "MX",
  "America/Sao_Paulo": "BR",
  "America/Argentina/Buenos_Aires": "AR",
  "America/Bogota": "CO",
  "America/Santiago": "CL",
  "America/Lima": "PE",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Rome": "IT",
  "Europe/Madrid": "ES",
  "Europe/Amsterdam": "NL",
  "Europe/Lisbon": "PT",
  "Europe/Warsaw": "PL",
  "Europe/Stockholm": "SE",
  "Africa/Accra": "GH",
  "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
  "Africa/Johannesburg": "ZA",
  "Africa/Cairo": "EG",
  "Africa/Casablanca": "MA",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN",
  "Asia/Hong_Kong": "HK",
  "Asia/Taipei": "TW",
  "Asia/Kolkata": "IN",
  "Asia/Jakarta": "ID",
  "Asia/Bangkok": "TH",
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Manila": "PH",
  "Asia/Singapore": "SG",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Dubai": "AE",
};

let active = "US";

export function setActiveMarket(code: string) {
  active = getMarket(code).code;
}

export function getMarket(code?: string | null): Market {
  if (code && BY_CODE[code.toUpperCase()]) return BY_CODE[code.toUpperCase()];
  return BY_CODE[active] ?? BY_CODE.US;
}

export function detectCountry(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ[tz]) return TZ[tz];
  } catch {
    /* ignore */
  }
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale || "";
    const parts = loc.replace("_", "-").split("-");
    const region = parts.find((p) => p.length === 2 && BY_CODE[p.toUpperCase()]);
    if (region) return region.toUpperCase();
  } catch {
    /* ignore */
  }
  return "US";
}

function marketForCurrency(currency: string): Market {
  return BY_CURRENCY[currency] ?? BY_CODE[active] ?? BY_CODE.US;
}

function toUsdMajor(cents: number, currency: string) {
  const m = marketForCurrency(currency);
  const major = cents / 100;
  return major / m.perUsd;
}

function fromUsdMajor(usd: number, market: Market) {
  const raw = usd * market.perUsd;
  if (market.zeroDecimal || raw >= 10000) return Math.round(raw / 100) * 100;
  if (raw >= 1000) return Math.round(raw / 10) * 10;
  if (raw >= 100) return Math.round(raw);
  return Math.round(raw);
}

export function convertCents(cents: number, fromCurrency: string, to: Market) {
  if (!cents) return 0;
  if (fromCurrency === to.currency) return cents;
  const usd = toUsdMajor(cents, fromCurrency);
  return fromUsdMajor(usd, to) * 100;
}

export function money(cents: number, fromCurrency = "USD") {
  const market = getMarket();
  const local = convertCents(cents, fromCurrency, market);
  const major = local / 100;
  try {
    return new Intl.NumberFormat(market.locale, {
      style: "currency",
      currency: market.currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(major);
  } catch {
    return `${market.symbol}${Math.round(major)}`;
  }
}

export function regions(): Region[] {
  return ["North America", "South America", "Europe", "Africa", "Asia"];
}

export function marketsIn(region: Region) {
  return MARKETS.filter((m) => m.region === region);
}
