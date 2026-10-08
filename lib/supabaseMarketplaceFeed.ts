import { requireSupabase } from "./supabase";

export type SupabaseMarketplaceListing = {
  id: string;
  ownerId?: string | null;
  title?: string | null;
  brand?: string | null;
  category?: string | null;
  color?: string | null;
  size?: string | null;
  condition?: string | null;
  material?: string | null;
  description?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  country?: string | null;
  createdAt?: string | null;
  photos: string[];
};

export async function fetchSupabaseMarketplaceListings(limit = 100): Promise<SupabaseMarketplaceListing[]> {
  const boundedLimit = Math.min(Math.max(Math.floor(limit) || 1, 1), 100);
  const { data, error } = await requireSupabase().functions.invoke("today-marketplace-feed", {
    body: { limit: boundedLimit },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  if (!Array.isArray(data?.listings)) throw new Error("Supabase returned an invalid marketplace feed.");
  return data.listings as SupabaseMarketplaceListing[];
}
