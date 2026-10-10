import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIREBASE_API_KEY = "AIzaSyBYacCvSdirUvZkw6nFZAjm894ZoAPAaPw";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-id-token",
};
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

async function verify(token: string) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  if (!response.ok) return null;
  const body = await response.json();
  return body.users?.[0]?.localId ? String(body.users[0].localId) : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return out({ error: "POST required" }, 405);
  try {
    const token = String(request.headers.get("x-firebase-id-token") || "").trim();
    const uid = await verify(token);
    if (!uid) return out({ error: "Authentication failed" }, 401);

    const body = await request.json().catch(() => ({}));
    const requestedLimit = Number(body?.limit);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 20, 1), 50);
    const { data, error } = await db
      .from("checkout_orders")
      .select("listing_id,listing_name,brand_id,updated_at")
      .eq("buyer_uid", uid)
      .eq("status", "paid")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    const seen = new Set<string>();
    const purchases = (data || [])
      .map((row) => ({
        listingId: String(row.listing_id || "").trim(),
        listingName: String(row.listing_name || "").trim(),
        brandId: row.brand_id ? String(row.brand_id).trim() : undefined,
      }))
      .filter((row) => {
        const key = row.listingId || row.listingName;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return out({ purchases });
  } catch (error) {
    console.error(error);
    return out({ error: error instanceof Error ? error.message : "Purchase history unavailable" }, 500);
  }
});
