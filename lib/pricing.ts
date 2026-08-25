import type { Category } from "./catalog";
import { convertCents, getMarketByCurrency, type Market } from "./markets";
import type { ClosetPiece } from "./wardrobe";

const DAY = 24 * 60 * 60 * 1000;

const CATEGORY_USD: Partial<Record<Category, number>> = {
  Outerwear: 120,
  Dresses: 85,
  Tops: 42,
  Trousers: 68,
  Knitwear: 72,
  Skirts: 58,
  Shoes: 90,
  Bags: 95,
  Accessories: 36,
};

const CONDITION_FACTOR: Record<string, number> = {
  "New with tags": 1.28,
  New: 1.24,
  "Like new": 1.12,
  Excellent: 1,
  Good: 0.82,
  Fair: 0.62,
};

export type PriceGuide = {
  bargainCents: number;
  optimalCents: number;
  premiumCents: number;
  confidence: "starting point" | "good match" | "strong match";
  note: string;
  comparables: ClosetPiece[];
};

function words(value?: string) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function overlap(a?: string, b?: string) {
  const right = new Set(words(b));
  return words(a).filter((word) => right.has(word)).length;
}

function scoreComparable(target: PricingTarget, piece: ClosetPiece) {
  let score = 0;
  if (target.category && piece.category === target.category) score += 8;
  else if (target.category && overlap(target.category, piece.category)) score += 3;
  if (target.brand && target.brand.toLowerCase() !== "unlabeled" && target.brand.toLowerCase() === piece.brand.toLowerCase()) score += 6;
  score += Math.min(4, overlap(target.name, piece.name));
  score += Math.min(3, overlap(target.color, piece.color));
  score += Math.min(3, overlap(target.material, piece.material));
  if (target.size && piece.size && target.size.toLowerCase() === piece.size.toLowerCase()) score += 1;
  return score;
}

function roundCents(cents: number, market: Market) {
  const step = market.zeroDecimal ? 100 : cents >= 10000 ? 500 : 100;
  return Math.max(step, Math.round(cents / step) * step);
}

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  if (!ordered.length) return 0;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
}

export type PricingTarget = {
  id?: string;
  name?: string;
  brand?: string;
  category?: string;
  color?: string;
  material?: string;
  size?: string;
  condition?: string;
};

export function buildPriceGuide(target: PricingTarget, pieces: ClosetPiece[], currency: string): PriceGuide {
  const market = getMarketByCurrency(currency);
  const candidates = pieces
    .filter((piece) => piece.id !== target.id && piece.status !== "owned")
    .map((piece) => ({ piece, score: scoreComparable(target, piece) }))
    .filter(({ score }) => score >= (target.category ? 8 : 2))
    .sort((a, b) => b.score - a.score || b.piece.createdAt - a.piece.createdAt)
    .slice(0, 6)
    .map(({ piece }) => piece);

  const comparablePrices = candidates.map((piece) => convertCents(piece.listPriceCents, piece.currency || "USD", market));
  const categoryBase = CATEGORY_USD[target.category as Category] ?? 60;
  const conditionFactor = CONDITION_FACTOR[target.condition || "Excellent"] ?? 1;
  const baseline = convertCents(Math.round(categoryBase * conditionFactor * 100), "USD", market);
  const reference = comparablePrices.length ? median(comparablePrices) : baseline;
  const optimal = roundCents(reference, market);
  const bargain = roundCents(optimal * 0.78, market);
  const premium = roundCents(optimal * 1.28, market);

  if (comparablePrices.length >= 3) {
    return {
      bargainCents: bargain,
      optimalCents: optimal,
      premiumCents: premium,
      confidence: "strong match",
      note: `Based on ${comparablePrices.length} close listings with similar details.`,
      comparables: candidates,
    };
  }
  if (comparablePrices.length) {
    return {
      bargainCents: bargain,
      optimalCents: optimal,
      premiumCents: premium,
      confidence: "good match",
      note: `Based on ${comparablePrices.length} nearby listing${comparablePrices.length === 1 ? "" : "s"} and the item details you entered.`,
      comparables: candidates,
    };
  }
  return {
    bargainCents: bargain,
    optimalCents: optimal,
    premiumCents: premium,
    confidence: "starting point",
    note: "A starting point based on the category, condition, and currency. More comparable listings will sharpen it.",
    comparables: [],
  };
}

export function formatPriceCents(cents: number, currency: string) {
  const market = getMarketByCurrency(currency);
  const major = cents / 100;
  const digits = market.zeroDecimal ? 0 : 2;
  try {
    return new Intl.NumberFormat(market.locale, {
      style: "currency",
      currency: market.currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(major);
  } catch {
    return `${market.symbol}${digits ? major.toFixed(digits) : Math.round(major)}`;
  }
}

export function isFreshComparable(piece: ClosetPiece) {
  return Date.now() - (piece.createdAt || 0) <= 14 * DAY;
}

export function majorFromCents(cents: number) {
  return String(Math.max(0, Math.round(cents / 100)));
}

export function centsFromMajor(value: string) {
  const major = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(major) ? Math.max(0, major) * 100 : 0;
}

export function marketForCurrency(currency: string) {
  return getMarketByCurrency(currency);
}

export function categoryFromParam(value?: string): Category | undefined {
  return value as Category | undefined;
}
