import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIREBASE_API_KEY = "AIzaSyBYacCvSdirUvZkw6nFZAjm894ZoAPAaPw";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-id-token",
};
const text = (value: unknown, max = 200) => String(value ?? "").trim().slice(0, max);
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const pair = (a: string, b: string) => [a, b].sort();

async function firebaseUser(token: string) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  if (!response.ok) return null;
  const body = await response.json();
  const user = body.users?.[0];
  return user?.localId ? String(user.localId) : null;
}

async function friendIds(uid: string) {
  const { data: friendships, error } = await db
    .from("friendships")
    .select("user_a,user_b")
    .or(`user_a.eq.${uid},user_b.eq.${uid}`)
    .limit(100);
  if (error) throw error;
  const ids = (friendships || []).map((row: any) => row.user_a === uid ? row.user_b : row.user_a).filter(Boolean);
  if (!ids.length) return [];
  const { data: blocks, error: blockError } = await db
    .from("friend_blocks")
    .select("blocker_uid,blocked_uid")
    .or(`blocker_uid.eq.${uid},blocked_uid.eq.${uid}`)
    .limit(200);
  if (blockError) throw blockError;
  const blocked = new Set((blocks || []).map((row: any) => row.blocker_uid === uid ? row.blocked_uid : row.blocker_uid));
  return [...new Set(ids)].filter((id: string) => !blocked.has(id));
}

async function recordView(uid: string, listingId: string) {
  const { data: existing, error: lookupError } = await db
    .from("friend_listing_views")
    .select("view_count")
    .eq("viewer_uid", uid)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  const { error } = await db.from("friend_listing_views").upsert({
    viewer_uid: uid,
    listing_id: listingId,
    view_count: Number(existing?.view_count || 0) + 1,
    last_viewed_at: new Date().toISOString(),
  }, { onConflict: "viewer_uid,listing_id" });
  if (error) throw error;
  return { ok: true };
}

async function trending(uid: string, limit: number) {
  const ids = await friendIds(uid);
  if (!ids.length) return { listingIds: [], friendCount: 0 };
  const { data: rows, error } = await db
    .from("friend_listing_views")
    .select("listing_id,view_count,last_viewed_at")
    .in("viewer_uid", ids)
    .order("last_viewed_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  const now = Date.now();
  const scores = new Map<string, { score: number; lastViewedAt: number }>();
  for (const row of rows || []) {
    const listingId = text(row.listing_id, 200);
    if (!listingId) continue;
    const lastViewedAt = Date.parse(String(row.last_viewed_at || "")) || 0;
    const ageDays = Math.max(0, (now - lastViewedAt) / 86_400_000);
    const recency = Math.max(0.15, Math.exp(-ageDays / 14));
    const score = Math.min(24, Number(row.view_count || 0)) * recency;
    const previous = scores.get(listingId);
    scores.set(listingId, {
      score: (previous?.score || 0) + score,
      lastViewedAt: Math.max(previous?.lastViewedAt || 0, lastViewedAt),
    });
  }
  const listingIds = [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score || b[1].lastViewedAt - a[1].lastViewedAt)
    .slice(0, Math.max(4, Math.min(24, limit)))
    .map(([listingId]) => listingId);
  return { listingIds, friendCount: ids.length };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return out({ error: "POST required" }, 405);
  try {
    const uid = await firebaseUser(text(request.headers.get("x-firebase-id-token"), 6000));
    if (!uid) return out({ error: "Firebase authentication failed" }, 401);
    const body = await request.json();
    const action = text(body.action, 40);
    if (action === "record_view") {
      const listingId = text(body.listingId, 200);
      if (!listingId) return out({ error: "A listing is required." }, 400);
      return out(await recordView(uid, listingId));
    }
    if (action === "trending") {
      return out(await trending(uid, Number(body.limit) || 12));
    }
    return out({ error: "Unknown friend-trending action" }, 400);
  } catch (error) {
    console.error(error);
    return out({ error: "Friend trend request failed" }, 500);
  }
});
