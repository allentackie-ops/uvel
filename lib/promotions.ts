import { httpsCallable } from "firebase/functions";
import { firebaseAuth, firebaseFunctions, firebaseReady } from "./firebase";

export type ListingPromotion = {
  id: string;
  listingId: string;
  ownerId: string;
  code: string;
  kind: "percentage";
  value: number;
  status: "live" | "paused" | "ended";
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
  if (!firebaseReady() || !firebaseAuth().currentUser) {
    throw new Error("Sign in before creating a promo code.");
  }
  const call = httpsCallable<SaveListingPromotionInput, ListingPromotion>(firebaseFunctions(), "saveListingPromotion");
  const result = await call(input);
  return result.data;
}

export async function listListingPromotions(): Promise<ListingPromotion[]> {
  if (!firebaseReady() || !firebaseAuth().currentUser) return [];
  const call = httpsCallable<void, ListingPromotion[]>(firebaseFunctions(), "listMyListingPromotions");
  const result = await call();
  return result.data;
}

export async function updateListingPromotionStatus(input: { promotionId: string; status: "live" | "paused" | "ended" }): Promise<ListingPromotion> {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Sign in before updating a promo code.");
  const call = httpsCallable<{ promotionId: string; status: "live" | "paused" | "ended" }, ListingPromotion>(firebaseFunctions(), "updateListingPromotionStatus");
  const result = await call(input);
  return result.data;
}
