import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIREBASE_API_KEY = "AIzaSyBYacCvSdirUvZkw6nFZAjm894ZoAPAaPw";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-id-token" };
const text = (value: unknown, limit = 2000) => String(value ?? "").trim().slice(0, limit);
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const codeOf = (value: unknown) => text(value, 32).toUpperCase().replace(/[^A-Z0-9_-]/g, "");

async function firebaseUid(token: string) {
  if (!token) return null;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }) });
  if (!response.ok) return null;
  const body = await response.json();
  return body.users?.[0]?.localId ? String(body.users[0].localId) : null;
}

function active(row: any, now = Date.now()) {
  const start = row.start_at ? Date.parse(String(row.start_at)) : 0;
  const end = row.end_at ? Date.parse(String(row.end_at)) : 0;
  return row.status === "live" && (!start || start <= now) && (!end || end >= now) && (row.usage_limit == null || Number(row.usage_count || 0) < Number(row.usage_limit));
}

function publicPromotion(row: any) {
  return { id: row.id, brandId: row.brand_id || undefined, listingId: row.listing_id || undefined, ownerId: row.owner_firebase_uid || undefined, code: row.code, kind: row.kind, value: Number(row.value), currency: row.currency || undefined, minimumOrderCents: Number(row.minimum_order_cents || 0), usageLimit: row.usage_limit == null ? undefined : Number(row.usage_limit), usageCount: Number(row.usage_count || 0), status: row.status, startAt: row.start_at ? Date.parse(row.start_at) : undefined, endAt: row.end_at ? Date.parse(row.end_at) : undefined, createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(), updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now() };
}

async function validate(input: any) {
  const brandId = text(input?.brandId, 160);
  const listingId = text(input?.listingId, 160);
  const requestedId = text(input?.promotionId, 160);
  const requestedCode = codeOf(input?.code);
  const currency = text(input?.currency, 3).toUpperCase();
  const itemCents = Math.floor(Number(input?.itemCents) || 0);
  if (!listingId || !currency || !Number.isSafeInteger(itemCents) || itemCents <= 0 || (!requestedId && !requestedCode)) throw new Error("That promotion request is not valid.");
  let query = db.from("promotions").select("*");
  if (requestedId) query = query.eq("id", requestedId);
  else query = query.eq("code", requestedCode);
  const { data: rows, error } = await query.limit(2);
  if (error) throw error;
  const row = (rows || []).find((candidate: any) => (candidate.listing_id ? candidate.listing_id === listingId : Boolean(brandId && candidate.brand_id === brandId)) && (!requestedCode || candidate.code === requestedCode));
  if (!row || (requestedId && row.id !== requestedId) || !active(row)) throw new Error("That promotion is not active for this listing.");
  const promotionCurrency = text(row.currency, 3).toUpperCase();
  if (promotionCurrency && promotionCurrency !== currency && (row.kind === "fixed" || Number(row.minimum_order_cents || 0) > 0)) throw new Error(row.kind === "fixed" ? `This fixed-amount promo is in ${promotionCurrency} and can only be used in a ${promotionCurrency} checkout.` : `This promo's minimum order is set in ${promotionCurrency}; it can only be used in a ${promotionCurrency} checkout.`);
  const minimumOrderCents = Math.max(0, Math.floor(Number(row.minimum_order_cents) || 0));
  if (itemCents < minimumOrderCents) throw new Error("This promotion does not apply to orders below its minimum.");
  const value = Number(row.value);
  if (!Number.isFinite(value) || value <= 0 || (row.kind === "percentage" && value > 70)) throw new Error("That promotion is not configured correctly.");
  const discountCents = row.kind === "percentage" ? Math.min(itemCents, Math.floor(itemCents * value / 100)) : Math.min(itemCents, Math.floor(value * 100));
  if (!discountCents) throw new Error("This promotion does not reduce the order total.");
  return { promotionId: row.id, code: row.code, kind: row.kind, value, currency, discountCents, minimumOrderCents, source: row.listing_id ? "listing" : "brand" };
}

function normalizeInput(input: any, uid: string, current: any = {}) {
  const id = text(input?.id || current?.id, 160) || `promotion-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  const code = codeOf(input?.code);
  const kind = text(input?.kind, 20);
  const value = Number(input?.value);
  const startAt = input?.startAt ? new Date(Number(input.startAt)).toISOString() : null;
  const endAt = input?.endAt ? new Date(Number(input.endAt)).toISOString() : null;
  if (code.length < 3) throw new Error("Promo codes need at least 3 letters or numbers.");
  if (!['percentage', 'fixed'].includes(kind)) throw new Error("Choose a valid discount type.");
  if (!Number.isFinite(value) || value <= 0 || (kind === "percentage" && value > 70)) throw new Error(kind === "percentage" ? "Promo codes max out at 70%." : "Enter a discount greater than zero.");
  const usageLimit = input?.usageLimit == null || input.usageLimit === "" ? null : Math.floor(Number(input.usageLimit));
  if (usageLimit != null && (!Number.isSafeInteger(usageLimit) || usageLimit <= 0)) throw new Error("Usage limit must be a whole number greater than zero.");
  if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) throw new Error("Promotion end time must be after its start time.");
  return { id, brand_id: text(input?.brandId || current?.brand_id, 160) || null, listing_id: text(input?.listingId || current?.listing_id, 160) || null, owner_firebase_uid: text(input?.ownerId || current?.owner_firebase_uid, 160) || uid, code, kind, value: Math.round(value * 100) / 100, currency: text(input?.currency || current?.currency, 3).toUpperCase() || null, minimum_order_cents: Math.max(0, Math.floor(Number(input?.minimumOrderCents) || 0)), usage_limit: usageLimit, usage_count: Number(current?.usage_count || 0), status: text(input?.status || current?.status, 20) || "draft", start_at: startAt, end_at: endAt, created_by_uid: current?.created_by_uid || uid, updated_at: new Date().toISOString() };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return out({ error: "POST required" }, 405);
  try {
    const uid = await firebaseUid(text(request.headers.get("x-firebase-id-token"), 6000));
    if (!uid) return out({ error: "Sign in before using promotions." }, 401);
    const body = await request.json();
    const action = text(body.action, 40);
    if (action === "validate") return out(await validate(body.input || {}));
    if (action === "list_brand") {
      const brandId = text(body.brandId, 160);
      const { data, error } = await db.from("promotions").select("*").eq("brand_id", brandId).order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return out({ promotions: (data || []).map(publicPromotion) });
    }
    if (action === "list_owner") {
      const { data, error } = await db.from("promotions").select("*").eq("owner_firebase_uid", uid).order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return out({ promotions: (data || []).map(publicPromotion) });
    }
    if (action === "list_listing") {
      const { data, error } = await db.from("promotions").select("*").eq("owner_firebase_uid", uid).eq("listing_id", text(body.listingId, 160)).order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return out({ promotions: (data || []).map(publicPromotion) });
    }
    if (action === "save") {
      const input = body.input || {};
      const existingId = text(input.id, 160);
      let current: any = {};
      if (existingId) {
        const { data, error } = await db.from("promotions").select("*").eq("id", existingId).maybeSingle();
        if (error) throw error;
        if (!data || data.created_by_uid !== uid) return out({ error: "You can only edit your own promotion." }, 403);
        current = data;
      }
      const row = normalizeInput(input, uid, current);
      if (!row.brand_id && !row.listing_id) throw new Error("Choose a brand or listing for this promotion.");
      const duplicate = await db.from("promotions").select("id").eq("code", row.code).neq("id", row.id).maybeSingle();
      if (duplicate.error) throw duplicate.error;
      if (duplicate.data) return out({ error: "This promo code has been used." }, 409);
      const { data, error } = await db.from("promotions").upsert(row, { onConflict: "id" }).select("*").single();
      if (error) throw error;
      return out({ promotion: publicPromotion(data) });
    }
    if (action === "status") {
      const id = text(body.promotionId, 160);
      const status = text(body.status, 20);
      if (!['draft', 'scheduled', 'live', 'paused', 'ended'].includes(status)) return out({ error: "Choose a valid promotion status." }, 400);
      const { data: current, error: lookupError } = await db.from("promotions").select("*").eq("id", id).maybeSingle();
      if (lookupError) throw lookupError;
      if (!current || current.created_by_uid !== uid) return out({ error: "You can only manage your own promotion." }, 403);
      const { data, error } = await db.from("promotions").update({ status, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
      if (error) throw error;
      return out({ promotion: publicPromotion(data) });
    }
    return out({ error: "Unknown promotion action" }, 400);
  } catch (error) {
    console.error(error);
    return out({ error: error instanceof Error ? error.message : "Promotion request failed." }, 500);
  }
});
