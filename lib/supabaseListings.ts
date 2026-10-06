import { requireSupabase } from "./supabase";
import { firebaseAuth } from "./firebase";

export type SupabaseListing = {
  id: string;
  owner_id: string | null;
  source: "supabase" | "firebase";
  status: string;
  title: string | null;
  brand: string | null;
  category: string | null;
  color: string | null;
  size: string | null;
  condition: string | null;
  material: string | null;
  description: string | null;
  price_cents: number | null;
  currency: string | null;
  country: string | null;
  selected_background_key: string | null;
  ai_analysis: Record<string, unknown>;
  moderation: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SupabaseRecentSearch = {
  id: string;
  user_id: string;
  query: string;
  created_at: string;
};

export type MirrorListingInput = {
  firebaseListingId: string;
  title: string;
  brand?: string;
  category?: string;
  color?: string;
  size?: string;
  condition?: string;
  material?: string;
  description?: string;
  priceCents?: number;
  currency?: string;
  country?: string;
  backgroundKey?: string;
  aiAnalysis?: Record<string, unknown>;
  photoStoragePaths: string[];
  photoUrls: string[];
};

export async function mirrorAcceptedFirebaseListing(input: MirrorListingInput) {
  const user = firebaseAuth().currentUser;
  if (!user) return { ok: false, skipped: true } as const;
  const token = await user.getIdToken();
  const { data, error } = await requireSupabase().functions.invoke("firebase-listings-gateway", {
    body: {
      listing: input,
      photos: input.photoStoragePaths.map((path, index) => ({ path, url: input.photoUrls[index] || "" })),
    },
    headers: { "x-firebase-id-token": token },
  });
  if (error) throw error;
  return data as { ok: boolean; listingId?: string; firebaseListingId?: string };
}

export async function fetchSupabaseListedListings(limit = 50) {
  const { data, error } = await requireSupabase()
    .from("listings")
    .select("id,owner_id,source,status,title,brand,category,color,size,condition,material,description,price_cents,currency,country,selected_background_key,ai_analysis,moderation,created_at,updated_at")
    .eq("status", "listed")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw error;
  return (data || []) as SupabaseListing[];
}

export async function fetchSupabaseListing(id: string) {
  const { data, error } = await requireSupabase()
    .from("listings")
    .select("id,owner_id,source,status,title,brand,category,color,size,condition,material,description,price_cents,currency,country,selected_background_key,ai_analysis,moderation,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as SupabaseListing | null;
}

export async function saveRecentSearch(query: string) {
  const value = query.trim().replace(/\s+/g, " ");
  if (!value) return null;
  const supabase = requireSupabase();
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("recent_searches")
    .insert({ user_id: userId, query: value.slice(0, 160) })
    .select("id,user_id,query,created_at")
    .single();
  if (error) throw error;
  return data as SupabaseRecentSearch;
}

export async function fetchRecentSearches(limit = 10) {
  const supabase = requireSupabase();
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return [] as SupabaseRecentSearch[];
  const { data, error } = await supabase
    .from("recent_searches")
    .select("id,user_id,query,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) throw error;
  return (data || []) as SupabaseRecentSearch[];
}

export async function deleteRecentSearch(id: string) {
  const { error } = await requireSupabase().from("recent_searches").delete().eq("id", id);
  if (error) throw error;
}
