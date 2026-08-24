import { MARKETS, getMarket } from "./markets";

/** Where a listing may appear. `"all"` is every Uvel store. An array is an allow-list. */
export type ShipsTo = "all" | string[];

export function listingVisibleIn(opts: {
  origin?: string | null;
  shipsTo?: ShipsTo | null;
  buyer: string;
}) {
  const buyer = (opts.buyer || "").toUpperCase();
  if (!buyer) return false;
  if (opts.shipsTo === "all") return true;
  if (Array.isArray(opts.shipsTo) && opts.shipsTo.length) {
    return opts.shipsTo.some((c) => c.toUpperCase() === buyer);
  }
  const origin = (opts.origin || "").toUpperCase();
  return Boolean(origin) && origin === buyer;
}

export function shipsMode(origin: string, shipsTo?: ShipsTo | null): "home" | "all" | "pick" {
  if (shipsTo === "all") return "all";
  const home = (origin || "").toUpperCase();
  if (Array.isArray(shipsTo) && shipsTo.length) {
    const set = new Set(shipsTo.map((c) => c.toUpperCase()).filter(Boolean));
    if (set.size >= MARKETS.length) return "all";
    if (set.size === 1 && home && set.has(home)) return "home";
    if (set.size === 0) return "home";
    return "pick";
  }
  return "home";
}

export function encodeShipsTo(origin: string, mode: "home" | "all" | "pick", picked: string[] = []): ShipsTo {
  const home = origin.toUpperCase();
  if (mode === "all") return "all";
  if (mode === "home") return [home];
  const set = new Set([home, ...picked.map((c) => c.toUpperCase())].filter(Boolean));
  if (set.size >= MARKETS.length) return "all";
  return [...set];
}

export function shipsToLabel(origin: string, shipsTo?: ShipsTo | null) {
  const mode = shipsMode(origin, shipsTo);
  const home = getMarket(origin);
  if (mode === "home") return `${home.name} only`;
  if (mode === "all") return "Every Uvel store";
  const codes = Array.isArray(shipsTo) && shipsTo.length ? shipsTo : [origin];
  const names = codes.map((c) => getMarket(c).name);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} + ${names.length - 2} more`;
}

export function shipsToLine(origin: string, shipsTo?: ShipsTo | null) {
  const mode = shipsMode(origin, shipsTo);
  const home = getMarket(origin);
  if (mode === "home") return `On the ${home.name} floor`;
  if (mode === "all") return "Sells in every Uvel store";
  return `Sells in ${shipsToLabel(origin, shipsTo)}`;
}
