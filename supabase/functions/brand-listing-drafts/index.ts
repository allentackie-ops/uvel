import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const FIREBASE_API_KEY = "AIzaSyBYacCvSdirUvZkw6nFZAjm894ZoAPAaPw";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-id-token" };
const text = (value: unknown, limit = 200) => String(value ?? "").trim().slice(0, limit);
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
async function firebaseUid(token: string) {
  if (!token) return null;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }) });
  if (!response.ok) return null;
  const body = await response.json();
  return body.users?.[0]?.localId ? String(body.users[0].localId) : null;
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return out({ error: "POST required" }, 405);
  try {
    const uid = await firebaseUid(text(request.headers.get("x-firebase-id-token"), 6000));
    if (!uid) return out({ error: "Sign in before accessing saved listing drafts." }, 401);
    const body = await request.json();
    const action = text(body?.action, 20);
    if (action === "list") {
      const { data, error } = await db.from("brand_listing_drafts").select("draft").eq("owner_firebase_uid", uid).order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return out({ drafts: (data || []).map((row: { draft: unknown }) => row.draft) });
    }
    if (action === "save") {
      const draft = body?.draft;
      const id = text(draft?.id, 160);
      const brandId = text(draft?.brandId, 160);
      if (!id || !brandId || !draft || typeof draft !== "object") return out({ error: "A valid brand listing draft is required." }, 400);
      const serialized = JSON.stringify(draft);
      if (serialized.length > 180_000) return out({ error: "This draft is too large to sync. Remove a large media attachment and try again." }, 413);
      const { data: existing, error: lookupError } = await db.from("brand_listing_drafts").select("owner_firebase_uid").eq("id", id).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing && existing.owner_firebase_uid !== uid) return out({ error: "You can only update your own saved draft." }, 403);
      const updatedAt = Number(draft.updatedAt) || Date.now();
      const nextDraft = { ...draft, id, brandId, updatedAt };
      const { error } = await db.from("brand_listing_drafts").upsert({ id, brand_id: brandId, owner_firebase_uid: uid, draft: nextDraft, updated_at: new Date(updatedAt).toISOString() }, { onConflict: "id" });
      if (error) throw error;
      return out({ ok: true, draft: nextDraft });
    }
    if (action === "delete") {
      const id = text(body?.id, 160);
      if (!id) return out({ error: "A draft id is required." }, 400);
      const { error } = await db.from("brand_listing_drafts").delete().eq("id", id).eq("owner_firebase_uid", uid);
      if (error) throw error;
      return out({ ok: true });
    }
    return out({ error: "Unknown saved-draft action." }, 400);
  } catch (error) {
    console.error(error);
    return out({ error: error instanceof Error ? error.message : "Saved draft request failed." }, 500);
  }
});
