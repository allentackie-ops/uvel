const USD_PER_CURRENCY = {
  USD: 1, CAD: 1.36, MXN: 17.2, BRL: 5.1, ARS: 980, COP: 4100, CLP: 950, PEN: 3.75,
  GBP: 0.79, EUR: 0.92, PLN: 4, SEK: 10.5, GHS: 15.5, NGN: 1600, KES: 129, ZAR: 18.2,
  EGP: 50, MAD: 10, JPY: 150, KRW: 1350, CNY: 7.2, HKD: 7.8, TWD: 32, INR: 84,
  IDR: 16000, THB: 34, VND: 25000, PHP: 58, SGD: 1.34, MYR: 4.5, AED: 3.67,
};

const COUNTRY_CARRIERS = {
  US: { usps: ["USPS", false], ups: ["UPS", false], fedex: ["FedEx", true] },
  CA: { "canada-post": ["Canada Post", false], purolator: ["Purolator", false], fedex: ["FedEx", true] },
  GB: { "royal-mail": ["Royal Mail", false], evri: ["Evri", false], dpd: ["DPD", true] },
  IE: { "an-post": ["An Post", false], dpd: ["DPD", true], dhl: ["DHL", true] },
  GH: { "ghana-post": ["Ghana Post", false], dhl: ["DHL", true], fedex: ["FedEx", true] },
  NG: { nipost: ["NIPOST", false], dhl: ["DHL", true], fedex: ["FedEx", true] },
  KE: { "posta-kenya": ["Posta Kenya", false], dhl: ["DHL", true], fargo: ["Fargo Courier", false] },
  ZA: { sapo: ["South African Post Office", false], aramex: ["Aramex", false], dhl: ["DHL", true] },
};

function convertToUsdMarketCents(cents, currency) {
  const normalized = String(currency || "USD").toUpperCase();
  const amount = Number(cents);
  const rate = USD_PER_CURRENCY[normalized];
  if (!rate || !Number.isSafeInteger(amount) || amount <= 0) throw new Error("Unsupported or invalid listing price.");
  if (normalized === "USD") return amount;
  const rawUsd = (amount / 100) / rate;
  const majorUsd = rawUsd >= 10000
    ? Math.round(rawUsd / 100) * 100
    : rawUsd >= 1000
      ? Math.round(rawUsd / 10) * 10
      : Math.round(rawUsd);
  return Math.max(0, Math.floor(majorUsd * 100));
}

function buyerProtectionFeeUsdCents(itemUsdCents) {
  const amountUsd = Number(itemUsdCents) / 100;
  if (!Number.isSafeInteger(Number(itemUsdCents)) || amountUsd <= 0) throw new Error("Invalid buyer-protection fee amount.");
  if (amountUsd >= 1000) return 899;
  if (amountUsd >= 500) return 699;
  if (amountUsd >= 150) return 499;
  if (amountUsd >= 50) return 299;
  return 99;
}

function shippingUsdCents(sameCountry, express) {
  return express ? (sameCountry ? 1299 : 2499) : sameCountry ? 599 : 1499;
}

function quoteGroupedLine({ listPriceCents, currency, sameCountry, express = false, buyerPaysShipping = true, madeByUvel = false, creditCents = 0 }) {
  const itemCents = convertToUsdMarketCents(listPriceCents, currency);
  const feeCents = buyerProtectionFeeUsdCents(itemCents);
  const shipCents = buyerPaysShipping || madeByUvel ? shippingUsdCents(sameCountry, express) : 0;
  const credit = Math.max(0, Math.floor(Number(creditCents) || 0));
  if (credit > itemCents) throw new Error("First Find credit cannot exceed the item price.");
  return { itemCents, feeCents, shipCents, creditCents: credit, totalCents: itemCents + feeCents + shipCents - credit };
}

function groupedCarrier(origin, carrierId, enabledIds) {
  const code = String(origin || "US").toUpperCase();
  const options = COUNTRY_CARRIERS[code] || {
    [`${code.toLowerCase()}-post`]: [`${code} postal service`, false],
    [`${code.toLowerCase()}-dhl`]: ["DHL", true],
    [`${code.toLowerCase()}-fedex`]: ["FedEx", true],
  };
  const id = String(carrierId || "").trim();
  if (!options[id] || (Array.isArray(enabledIds) && enabledIds.length > 0 && !enabledIds.includes(id))) return null;
  return { id, name: options[id][0], express: options[id][1] === true };
}

module.exports = { USD_PER_CURRENCY, convertToUsdMarketCents, buyerProtectionFeeUsdCents, shippingUsdCents, quoteGroupedLine, groupedCarrier };
