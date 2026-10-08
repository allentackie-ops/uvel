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
const TREND_WINDOW_DAYS = 7;
const MIN_DWELL_SECONDS = 10;
const MAX_DWELL_SECONDS = 300;
const validEvents = new Set(["qualified_view", "share", "copy_link"]);

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
  listing_photos: ListingPhoto[] | null;
};

type ScoreRow = {
  listing_id: string;
  market_code: string;
  trend_score: number | string;
  qualified_views: number | string;
  shares: number | string;
  copied_links: number | string;
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function safeText(value: unknown, maxLength = 200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function scorePayload(row: ScoreRow) {
  return {
    listingId: row.listing_id,
    score: Number(row.trend_score) || 0,
    qualifiedViews: Number(row.qualified_views) || 0,
    shares: Number(row.shares) || 0,
    copiedLinks: Number(row.copied_links) || 0,
  };
}

function canShipTo(shipsTo: unknown, origin: string, market: string) {
  if (shipsTo === "all") return true;
  if (Array.isArray(shipsTo)) return shipsTo.some((code) => String(code).toUpperCase() === market);
  return origin.toUpperCase() === market;
}

async function getScores(market: string | null) {
  const { data, error } = await supabase.rpc("get_listing_trend_scores", {
    p_market_code: market,
    p_days: TREND_WINDOW_DAYS,
  });
  if (error) throw error;
  return (data || []) as ScoreRow[];
}

async function trendingFeed(market: string) {
  const [marketRows, globalRows] = await Promise.all([getScores(market), getScores(null)]);
  const globalMap = new Map<string, ReturnType<typeof scorePayload>>();
  for (const row of globalRows) {
    const next = scorePayload(row);
    const current = globalMap.get(next.listingId) || { ...next, score: 0, qualifiedViews: 0, shares: 0, copiedLinks: 0 };
    current.score += next.score;
    current.qualifiedViews += next.qualifiedViews;
    current.shares += next.shares;
    current.copiedLinks += next.copiedLinks;
    globalMap.set(next.listingId, current);
  }

  const { data: brandRows, error: brandError } = await supabase
    .from("brand_catalog_items")
    .select("id,brand_id,brand_name,country,ships_to,photo_paths,piece,status,updated_at")
    .eq("status", "listed")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (brandError) throw brandError;

  const rankedBrands = (brandRows || [])
    .filter((row) => canShipTo(row.ships_to, String(row.country || ""), market))
    .map((row) => ({
      row,
      score: globalMap.get(String(row.id)) || { listingId: String(row.id), score: 0, qualifiedViews: 0, shares: 0, copiedLinks: 0 },
    }))
    .filter((entry) => entry.score.score > 0)
    .sort((a, b) => b.score.score - a.score.score)
    .slice(0, 50);
  const brandPaths = [...new Set(rankedBrands.flatMap(({ row }) => Array.isArray(row.photo_paths) ? row.photo_paths : []))];
  const signedUrls = new Map<string, string>();
  if (brandPaths.length) {
    const { data: signed, error: signError } = await supabase.storage.from("listing-media").createSignedUrls(brandPaths, SIGNED_URL_SECONDS);
    if (signError) console.error("Could not sign Supabase brand catalog photos", signError);
    else for (const item of signed || []) if (item.path && item.signedUrl) signedUrls.set(item.path, item.signedUrl);
  }

  const brandItems = rankedBrands.flatMap(({ row, score }) => {
    const photos = (Array.isArray(row.photo_paths) ? row.photo_paths : [])
      .map((path: string) => signedUrls.get(path))
      .filter((url: string | undefined): url is string => Boolean(url));
    if (!photos.length) return [];
    const piece = {
      ...(row.piece && typeof row.piece === "object" ? row.piece : {}),
      id: row.id,
      brandId: row.brand_id,
      brand: row.brand_name,
      country: row.country,
      shipsTo: row.ships_to,
      status: "listed",
      photo: photos[0],
      photos,
    };
    return [{ piece, ...score }];
  });

  const allGlobalScores = [...globalMap.values()].sort((a, b) => b.score - a.score).slice(0, 1000);
  return response({
    market,
    marketScores: marketRows.filter((row) => row.market_code === market).map(scorePayload),
    globalScores: allGlobalScores,
    brandItems,
    windowDays: TREND_WINDOW_DAYS,
    minDwellSeconds: MIN_DWELL_SECONDS,
    weights: { qualifiedView: 1, share: 5, copyLink: 4 },
  });
}

async function recordTrend(body: Record<string, unknown>, market: string) {
  const listingId = safeText(body.listingId, 160);
  const interaction = safeText(body.interaction, 24);
  const actorId = safeText(body.actorId, 200);
  if (!listingId || !actorId || !validEvents.has(interaction)) return response({ error: "A listing, actor, and valid interaction are required." }, 400);

  const dwellSeconds = interaction === "qualified_view" ? Math.floor(Number(body.dwellSeconds)) : null;
  if (interaction === "qualified_view" && (!Number.isFinite(dwellSeconds) || dwellSeconds! < MIN_DWELL_SECONDS || dwellSeconds! > MAX_DWELL_SECONDS)) {
    return response({ error: "A qualified listing view must last at least 10 seconds." }, 400);
  }

  let isVisible = false;
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(listingId)) {
    const { data: listing, error } = await supabase.from("listings").select("id,status,country").eq("id", listingId).maybeSingle();
    if (error) throw error;
    isVisible = Boolean(listing && listing.status === "listed" && String(listing.country || "").toUpperCase() === market);
  }
  if (!isVisible) {
    const { data: brand, error } = await supabase.from("brand_catalog_items")
      .select("id,status,country,ships_to")
      .eq("id", listingId)
      .maybeSingle();
    if (error) throw error;
    isVisible = Boolean(brand && brand.status === "listed" && canShipTo(brand.ships_to, String(brand.country || ""), market));
  }
  if (!isVisible) return response({ error: "This item is not available in the selected store." }, 404);

  const actorHash = await sha256(actorId);
  const day = new Date().toISOString().slice(0, 10);
  const eventKey = await sha256(`${actorHash}|${listingId}|${market}|${interaction}|${day}`);
  const { error } = await supabase.from("listing_trending_events").upsert({
    listing_id: listingId,
    market_code: market,
    event_type: interaction,
    actor_hash: actorHash,
    event_key: eventKey,
    dwell_seconds: dwellSeconds,
  }, { onConflict: "event_key", ignoreDuplicates: true });
  if (error) throw error;
  return response({ ok: true });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return response({ error: "POST required" }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const action = safeText(body?.action, 24);
    if (action === "trending" || action === "record-trend") {
      const market = safeText(body?.market, 2).toUpperCase();
      if (!/^[A-Z]{2}$/.test(market)) return response({ error: "A valid store market is required." }, 400);
      if (action === "record-trend") return await recordTrend(body, market);
      return await trendingFeed(market);
    }

    const requestedLimit = Number(body?.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_LIMIT)
      : 50;

    const { data, error } = await supabase
      .from("listings")
      .select("id,owner_id,owner_firebase_uid,title,brand,category,color,size,condition,material,description,price_cents,currency,country,created_at,listing_photos(storage_path,render_storage_path,sort_order)")
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
