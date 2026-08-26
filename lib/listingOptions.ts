import type { Category } from "./catalog";
import type { ShipsTo } from "./ships";

export const LISTING_CATEGORIES: Category[] = [
  "Outerwear",
  "Dresses",
  "Tops",
  "Trousers",
  "Knitwear",
  "Skirts",
  "Shoes",
  "Bags",
  "Accessories",
];

export const LISTING_CONDITIONS = ["New with tags", "Like new", "Excellent", "Good", "Fair"] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

type PendingSelection = {
  category?: Category;
  condition?: ListingCondition;
  shipsTo?: ShipsTo;
};

let pending: PendingSelection = {};

export function setPendingListingSelection<K extends keyof PendingSelection>(kind: K, value: PendingSelection[K]) {
  pending[kind] = value;
}

export function takePendingListingSelection<K extends keyof PendingSelection>(kind: K) {
  const value = pending[kind];
  delete pending[kind];
  return value;
}
