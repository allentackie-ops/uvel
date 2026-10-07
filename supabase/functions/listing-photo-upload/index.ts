import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const FIREBASE_API_KEY = Deno.env.get("FIREBASE_API_KEY") || "AIzaSyBYacCvSdirUvZkw6nFZAjm894ZoAPAaPw";
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-id-token" };
const text = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);
async function identity(token: string) { if (!token) return null; const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }) }); if (!r.ok) return null; const user = (await r.json()).users?.[0]; return user?.localId ? String(user.localId) : null; }
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const uid = await identity(text(request.headers.get("x-firebase-id-token"), 5000));
    if (!uid) return new Response(JSON.stringify({ error: "Authentication failed" }), { status: 401, headers });
    const body = await request.json();
    const listingId = text(body.listingId, 120);
    const index = Number(body.photoIndex);
    const contentType = text(body.contentType, 40).toLowerCase();
    const base64 = text(body.base64, 12000000);
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(listingId) || !Number.isInteger(index) || index < 0 || index >= 6 || !base64 || !["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(contentType)) return new Response(JSON.stringify({ error: "Invalid listing photo upload" }), { status: 400, headers });
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) return new Response(JSON.stringify({ error: "Choose a smaller listing photo" }), { status: 400, headers });
    const extension = contentType.split("/")[1].replace("jpeg", "jpg");
    const path = `${uid}/${listingId}/source-${index}.${extension}`;
    const { error } = await supabase.storage.from("listing-media").upload(path, bytes, { contentType, upsert: true, cacheControl: "31536000" });
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, storagePath: path }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: text(error instanceof Error ? error.message : error, 240) || "Could not upload listing photo" }), { status: 500, headers });
  }
});
