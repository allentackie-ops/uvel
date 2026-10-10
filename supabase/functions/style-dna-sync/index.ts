import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIREBASE_API_KEY = "AIzaSyBYacCvSdirUvZkw6nFZAjm894ZoAPAaPw";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-id-token" };
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const text = (value: unknown, max = 120) => String(value ?? "").trim().slice(0, max);
const valid = (value: unknown) => typeof value === "string" && value.length <= 120;

async function firebaseUser(token: string) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }) });
  if (!response.ok) return null;
  const body = await response.json();
  const user = body.users?.[0];
  return user?.localId ? String(user.localId) : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return out({ error: "POST required" }, 405);
  try {
    const uid = await firebaseUser(text(request.headers.get("x-firebase-id-token"), 6000));
    if (!uid) return out({ error: "Firebase authentication failed" }, 401);
    const body = await request.json();
    if (body.action === "read") {
      const { data, error } = await db.from("style_dna_profiles").select("archetype,palette,silhouette,styles,updated_at").eq("firebase_uid", uid).maybeSingle();
      if (error) throw error;
      return out({ profile: data || null });
    }
    if (body.action !== "write") return out({ error: "Unknown Style DNA action" }, 400);
    const styles = Array.isArray(body.styles) ? [...new Set(body.styles.filter((value: unknown) => valid(value)).map((value: string) => text(value)))].slice(0, 24) : [];
    const row = { firebase_uid: uid, archetype: text(body.archetype), palette: text(body.palette), silhouette: text(body.silhouette), styles, source: "uvel_app", updated_at: new Date().toISOString() };
    const { data, error } = await db.from("style_dna_profiles").upsert(row, { onConflict: "firebase_uid" }).select("archetype,palette,silhouette,styles,updated_at").single();
    if (error) throw error;
    return out({ profile: data });
  } catch (error) {
    console.error("Style DNA sync failed", error);
    return out({ error: "Could not sync Style DNA" }, 500);
  }
});
