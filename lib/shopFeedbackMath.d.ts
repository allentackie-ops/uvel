export type ShopFeedbackSignal = {
  listingId: string;
  choice: "interested" | "not_interested";
  createdAt: number;
  category: string;
  color: string;
  brand: string;
  material: string;
  priceBand: string;
  terms: string[];
};

export type ShopFeedbackListing = {
  id: string;
  name?: string;
  notes?: string;
  category?: string;
  color?: string;
  brand?: string;
  brandId?: string;
  material?: string;
  listPriceCents: number;
};

export function scoreShopFeedback(
  piece: ShopFeedbackListing,
  feedback: Record<string, ShopFeedbackSignal>,
  now?: number,
): number;

export function filterNotInterestedListings<T extends { id: string }>(
  pieces: T[],
  feedback: Record<string, ShopFeedbackSignal>,
): T[];
