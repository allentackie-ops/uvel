import { firebaseAuth, firebaseReady } from "./firebase";
import { requireSupabase } from "./supabase";

export type PurchaseSignal = {
  listingId: string;
  listingName: string;
  brandId?: string;
};

/**
 * Supabase is the source of truth for settled purchases. Firebase is used only
 * to verify the existing Uvel session at the Supabase Edge Function boundary.
 */
export async function fetchPaidPurchaseSignals(limit = 20): Promise<PurchaseSignal[]> {
  if (!firebaseReady() || !firebaseAuth().currentUser) return [];
  const token = await firebaseAuth().currentUser!.getIdToken();
  const boundedLimit = Math.min(Math.max(Math.floor(limit) || 1, 1), 50);
  const { data, error } = await requireSupabase().functions.invoke("today-purchase-history", {
    body: { limit: boundedLimit },
    headers: { "x-firebase-id-token": token },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  if (!Array.isArray(data?.purchases)) return [];
  return data.purchases
    .map((item: Record<string, unknown>) => ({
      listingId: String(item.listingId || "").trim(),
      listingName: String(item.listingName || "").trim(),
      brandId: item.brandId ? String(item.brandId).trim() : undefined,
    }))
    .filter((item: PurchaseSignal) => Boolean(item.listingId || item.listingName));
}
