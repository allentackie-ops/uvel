import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};
const MAX_LIMIT = 100;
const SIGNED_URL_SECONDS = 3600;

type ListingPhoto = {
  storage_path: string | null;
  render_storage_path: string | null;
  sort_order: number;
};

type ListingRow = {
  id: string;
  owner_id: string | null;
  owner_firebase_uid: string | null;
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
  created_at: string;
  ai_analysis: Record<string, unknown> | null;
  listing_photos: ListingPhoto[] | null;
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return response({ error: "POST required" }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const requestedLimit = Number(body?.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_LIMIT)
      : 50;

    const { data, error } = await supabase
      .from("listings")
      .select("id,owner_id,owner_firebase_uid,title,brand,category,color,size,condition,material,description,price_cents,currency,country,created_at,ai_analysis,listing_photos(storage_path,render_storage_path,sort_order)")
      .eq("status", "listed")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    const listings = (data || []) as unknown as ListingRow[];
    const paths = [...new Set(listings.flatMap((listing) => (listing.listing_photos || [])
      .map((photo) => photo.render_storage_path || photo.storage_path)
      .filter((path): path is string => Boolean(path))))];
    const signedUrls = new Map<string, string>();

    if (paths.length) {
      const { data: signed, error: signError } = await supabase.storage
        .from("listing-media")
        .createSignedUrls(paths, SIGNED_URL_SECONDS);
      if (signError) {
        console.error("Could not sign Today feed listing photos", signError);
      } else {
        for (const item of signed || []) {
          if (item.path && item.signedUrl) signedUrls.set(item.path, item.signedUrl);
        }
      }
    }

    return response({
      listings: listings.map((listing) => ({
        id: listing.id,
        ownerId: listing.owner_firebase_uid || listing.owner_id || undefined,
        title: listing.title,
        brand: listing.brand,
        category: listing.category,
        color: listing.color,
        size: listing.size,
        condition: listing.condition,
        material: listing.material,
        description: listing.description,
        priceCents: listing.price_cents,
        currency: listing.currency,
        country: listing.country,
        isDemo: listing.ai_analysis?.demo === true && listing.ai_analysis?.purpose === "checkout_testing",
        createdAt: listing.created_at,
        photos: (listing.listing_photos || [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((photo) => {
            const path = photo.render_storage_path || photo.storage_path;
            return path ? signedUrls.get(path) : undefined;
          })
          .filter((url): url is string => Boolean(url)),
      })),
    });
  } catch (error) {
    console.error("Today marketplace feed failed", error);
    return response({ error: "The Supabase marketplace feed is temporarily unavailable." }, 503);
  }
});
