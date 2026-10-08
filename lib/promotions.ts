import { supabasePromotionCall } from "./supabasePromotion";

export type ListingPromotion = {
  id: string;
  listingId: string;
  ownerId: string;
  code: string;
  kind: "percentage";
  value: number;
  status: "draft" | "scheduled" | "live" | "paused" | "ended";
  usageCount?: number;
  usageLimit?: number;
  endAt?: number;
  createdAt?: number;
  updatedAt?: number;
};

type SaveListingPromotionInput = {
  listingId: string;
  promotionId?: string;
  code: string;
  value: number;
  expiresInDays: 1 | 3 | 30 | 365;
};

export async function saveListingPromotion(input: SaveListingPromotionInput): Promise<ListingPromotion> {
  const endAt = Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000;
  const result = await supabasePromotionCall<{ promotion: ListingPromotion }>("save", {
    input: { id: input.promotionId, listingId: input.listingId, code: input.code, kind: "percentage", value: input.value, status: "live", endAt },
  });
  return result.promotion;
}

export async function listListingPromotions(): Promise<ListingPromotion[]> {
  const result = await supabasePromotionCall<{ promotions: ListingPromotion[] }>("list_owner");
  return result.promotions;
}

export async function updateListingPromotionStatus(input: { promotionId: string; status: "live" | "paused" | "ended" }): Promise<ListingPromotion> {
  const result = await supabasePromotionCall<{ promotion: ListingPromotion }>("status", input);
  return result.promotion;
}
