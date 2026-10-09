import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIREBASE_API_KEY = Deno.env.get("FIREBASE_API_KEY") || "AIzaSyBYacCvSdirUvZkw6nFZAjm894ZoAPAaPw";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-id-token",
};
const text = (value: unknown, limit = 2000) => String(value ?? "").trim().slice(0, limit);
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const USD_PER_CURRENCY: Record<string, number> = { USD: 1, CAD: 1.36, MXN: 17.2, GBP: 0.79, EUR: 0.92, JPY: 150, AUD: 1.52 };
const EXPRESS_CARRIERS = new Set(["fedex", "dhl", "dpd", "ups", "purolator"]);

type Identity = { uid: string; email: string };
type Address = { name: string; phone: string; line1: string; line2: string; city: string; region: string; postal: string; country: string };
type Choice = { listingId: string; carrierId: string; creditCents: number; promotionId: string; promotionCode: string };

async function firebaseIdentity(token: string): Promise<Identity | null> {
  if (!token) return null;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  if (!response.ok) return null;
  const body = await response.json().catch(() => ({}));
  const user = body.users?.[0];
  return user?.localId ? { uid: String(user.localId), email: text(user.email, 320) } : null;
}

function cleanAddress(value: unknown): Address {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const clean = (key: string, limit = 160) => text(input[key], limit);
  const address = { name: clean("name"), phone: clean("phone", 48), line1: clean("line1"), line2: clean("line2"), city: clean("city"), region: clean("region"), postal: clean("postal", 48), country: clean("country", 2).toUpperCase() };
  if (!address.name || !address.line1 || !address.city || !address.postal || !/^[A-Z]{2}$/.test(address.country)) throw new Error("Enter a complete shipping address before checking out.");
  return address;
}

function convertToUsdCents(value: unknown, currency: unknown) {
  const amount = Number(value);
  const code = text(currency, 3).toUpperCase();
  const rate = USD_PER_CURRENCY[code];
  if (!rate || !Number.isSafeInteger(amount) || amount <= 0) throw new Error("Unsupported or invalid listing price.");
  if (code === "USD") return amount;
  const rawUsd = (amount / 100) / rate;
  const majorUsd = rawUsd >= 10000 ? Math.round(rawUsd / 100) * 100 : rawUsd >= 1000 ? Math.round(rawUsd / 10) * 10 : Math.round(rawUsd);
  return Math.max(0, Math.floor(majorUsd * 100));
}
function protectionFee(itemCents: number) {
  const dollars = itemCents / 100;
  return dollars >= 1000 ? 899 : dollars >= 500 ? 699 : dollars >= 150 ? 499 : dollars >= 50 ? 299 : 99;
}
function shippingFee(sameCountry: boolean, express: boolean) {
  return express ? (sameCountry ? 1299 : 2499) : sameCountry ? 599 : 1499;
}
function promotionActive(row: any) {
  const now = Date.now();
  return row?.status === "live" && (!row.start_at || Date.parse(row.start_at) <= now) && (!row.end_at || Date.parse(row.end_at) >= now) && (row.usage_limit == null || Number(row.usage_count || 0) < Number(row.usage_limit));
}
async function promotionDiscount(choice: Choice, listing: any, itemCents: number) {
  if (!choice.promotionId && !choice.promotionCode) return { discountCents: 0, promotion: null };
  let query = db.from("promotions").select("id,listing_id,brand_id,code,kind,value,currency,minimum_order_cents,status,start_at,end_at,usage_limit,usage_count");
  query = choice.promotionId ? query.eq("id", choice.promotionId) : query.eq("code", choice.promotionCode);
  const { data: rows, error } = await query.limit(2);
  if (error) throw error;
  const row = (rows || []).find((candidate: any) => (candidate.listing_id ? candidate.listing_id === listing.id : Boolean(listing.brand_id && candidate.brand_id === listing.brand_id)) && (!choice.promotionCode || candidate.code === choice.promotionCode));
  if (!row || !promotionActive(row)) throw new Error("A promo code is no longer valid for one of these items.");
  if (row.currency && String(row.currency).toUpperCase() !== "USD" && (row.kind === "fixed" || Number(row.minimum_order_cents || 0) > 0)) throw new Error("This promotion can only be used with its configured currency.");
  if (itemCents < Number(row.minimum_order_cents || 0)) throw new Error("This promotion does not apply to orders below its minimum.");
  const value = Number(row.value);
  const discountCents = row.kind === "percentage" ? Math.min(itemCents, Math.floor(itemCents * value / 100)) : Math.min(itemCents, Math.floor(value * 100));
  if (!discountCents) throw new Error("This promotion does not reduce the order total.");
  return { discountCents, promotion: { id: row.id, code: row.code, source: row.listing_id ? "listing" : "brand" } };
}

async function listedRows(ids: string[]) {
  const uuidIds = ids.filter((id) => /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id));
  const textIds = ids.filter((id) => !uuidIds.includes(id));
  const [listingResult, catalogResult] = await Promise.all([
    uuidIds.length ? db.from("listings").select("id,owner_firebase_uid,owner_id,status,title,brand,price_cents,currency,country,ai_analysis").in("id", uuidIds).limit(8) : Promise.resolve({ data: [], error: null }),
    textIds.length ? db.from("brand_catalog_items").select("id,owner_firebase_uid,listed_by_uid,status,brand_id,brand_name,country,piece").in("id", textIds).limit(8) : Promise.resolve({ data: [], error: null }),
  ]);
  if (listingResult.error) throw listingResult.error;
  if (catalogResult.error) throw catalogResult.error;
  const catalogRows = (catalogResult.data || []).map((row: any) => ({ ...row, title: row.piece?.name || row.brand_name || "Listing", brand: row.brand_name, price_cents: row.piece?.listPriceCents, currency: row.piece?.currency || "USD", owner_firebase_uid: row.listed_by_uid || row.owner_firebase_uid, country: row.country, brand_id: row.brand_id, ai_analysis: row.piece || {} }));
  const rows = [...(listingResult.data || []), ...catalogRows];
  if (rows.length !== ids.length) throw new Error("A listing in this checkout was not found in Supabase.");
  return new Map(rows.map((row: any) => [String(row.id), row]));
}

function orderForClient(row: any, uid: string, batchId: string, id: string) {
  return { id, checkoutBatchId: batchId, pieceId: row.listing_id, pieceName: row.listing_name, piecePhoto: "", brandId: row.brand_id || undefined, buyerId: uid, sellerId: row.seller_uid, itemCents: row.item_cents, feeCents: row.fee_cents, discountCents: row.discount_cents, creditCents: row.credit_cents, shipCents: row.shipping_cents, taxCents: 0, totalCents: row.amount_cents, currency: row.currency, country: row.country, payMethod: row.pay_method, delivery: row.delivery || "Standard delivery", address: row.address, status: row.status, fulfillmentStatus: row.fulfillment_status || "unfulfilled", createdAt: Date.parse(row.created_at || new Date().toISOString()) };
}

async function groupedCreate(uid: string, input: any) {
  const batchId = text(input?.checkoutBatchId, 160);
  const listingIds = Array.isArray(input?.listingIds) ? input.listingIds.map((value: unknown) => text(value, 120)) : [];
  if (!/^cb-[a-z0-9]{4,32}$/.test(batchId) || listingIds.length < 2 || listingIds.length > 8 || listingIds.some((id: string) => !/^[a-zA-Z0-9._:-]{1,120}$/.test(id)) || new Set(listingIds).size !== listingIds.length) throw new Error("Invalid grouped checkout request.");
  const address = cleanAddress(input?.address);
  const choices = new Map<string, Choice>((Array.isArray(input?.shippingChoices) ? input.shippingChoices : []).map((item: any) => [text(item?.listingId, 120), { listingId: text(item?.listingId, 120), carrierId: text(item?.carrierId, 80), creditCents: Math.max(0, Math.floor(Number(item?.creditCents) || 0)), promotionId: text(item?.promotionId, 160), promotionCode: text(item?.promotionCode, 32).toUpperCase().replace(/[^A-Z0-9_-]/g, "") }]));
  if (choices.size !== listingIds.length || listingIds.some((id: string) => !choices.has(id))) throw new Error("Select delivery for every listing before checking out.");
  const totalCredit = [...choices.values()].reduce((sum, choice) => sum + choice.creditCents, 0);
  if (totalCredit > 1500 || [...choices.values()].filter((choice) => choice.creditCents > 0).length > 1) throw new Error("First Find can be applied to one item per grouped checkout.");

  const existing = await db.from("checkout_orders").select("*").eq("checkout_batch_id", batchId).eq("buyer_uid", uid).order("created_at", { ascending: true }).limit(8);
  if (existing.error) throw existing.error;
  if ((existing.data || []).length) {
    const existingRows = (existing.data || []) as any[];
    const same = existingRows.length === listingIds.length && listingIds.every((id: string) => existingRows.some((row: any) => row.listing_id === id));
    if (!same) throw new Error("This checkout reference belongs to another cart.");
    return { checkoutBatchId: batchId, orderIds: existingRows.map((row: any) => ({ id: row.firebase_order_id, pieceId: row.listing_id })), orders: existingRows.map((row: any) => orderForClient(row, uid, batchId, row.firebase_order_id)), amountCents: existingRows.reduce((sum: number, row: any) => sum + Number(row.amount_cents || 0), 0), alreadyExists: true };
  }

  const rows = await listedRows(listingIds);
  const orders: any[] = [];
  for (const [index, listingId] of listingIds.entries()) {
    const listing = rows.get(listingId);
    if (!listing || listing.status !== "listed") throw new Error("A listing in this bag is no longer available.");
    const sellerUid = text(listing.owner_firebase_uid || listing.owner_id || listing.listed_by_uid, 160);
    if (!sellerUid || sellerUid === uid) throw new Error("A listing does not have an eligible seller.");
    const choice = choices.get(listingId)!;
    const itemCents = convertToUsdCents(listing.price_cents, listing.currency || "USD");
    const sameCountry = address.country === text(listing.country || "US", 2).toUpperCase();
    const carrierId = choice.carrierId.toLowerCase();
    if (!carrierId) throw new Error("Select delivery for every listing before checking out.");
    const express = EXPRESS_CARRIERS.has(carrierId);
    const feeCents = protectionFee(itemCents);
    const shippingCents = shippingFee(sameCountry, express);
    if (choice.creditCents > itemCents) throw new Error("First Find credit cannot exceed the item price.");
    const promo = await promotionDiscount(choice, { ...listing, id: listingId }, itemCents);
    const discountCents = Math.min(promo.discountCents, Math.max(0, itemCents - choice.creditCents));
    const amountCents = itemCents + feeCents + shippingCents - choice.creditCents - discountCents;
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error("This checkout total is invalid.");
    const id = `grp-${batchId.slice(3)}-${index.toString(36)}`;
    orders.push({ firebase_order_id: id, checkout_batch_id: batchId, buyer_uid: uid, seller_uid: sellerUid, listing_id: listingId, listing_name: text(listing.title || listing.brand || "Listing", 200), brand_id: text(listing.brand_id, 160) || null, amount_cents: amountCents, item_cents: itemCents, fee_cents: feeCents, shipping_cents: shippingCents, discount_cents: discountCents, credit_cents: choice.creditCents, currency: "USD", country: "US", pay_method: "stripe", address, status: "pending", fulfillment_status: "unfulfilled", updated_at: new Date().toISOString() });
  }
  const inserted = await db.from("checkout_orders").insert(orders).select("*");
  if (inserted.error) throw inserted.error;
  const amountCents = orders.reduce((sum, row) => sum + row.amount_cents, 0);
  return { checkoutBatchId: batchId, orderIds: orders.map((row) => ({ id: row.firebase_order_id, pieceId: row.listing_id })), orders: (inserted.data || orders).map((row: any) => orderForClient(row, uid, batchId, row.firebase_order_id)), amountCents, alreadyExists: false };
}

async function stripeRequest(method: "POST" | "GET", path: string, values: Record<string, string> = {}) {
  if (!STRIPE_SECRET_KEY) throw new Error("Stripe is not configured in Supabase yet. Add STRIPE_SECRET_KEY before accepting payments.");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, ...(method === "POST" ? { body: new URLSearchParams(values) } : {}) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(text(body?.error?.message || "Stripe request failed", 500));
  return body;
}

async function groupedIntent(uid: string, batchId: string) {
  if (!/^cb-[a-z0-9]{4,32}$/.test(batchId)) throw new Error("Invalid grouped checkout.");
  const result = await db.from("checkout_orders").select("*").eq("checkout_batch_id", batchId).eq("buyer_uid", uid).order("created_at", { ascending: true }).limit(8);
  if (result.error) throw result.error;
  const rows = result.data || [];
  if (rows.length < 2) throw new Error("Grouped checkout was not created in Supabase.");
  if (rows.some((row: any) => row.status !== "pending")) throw new Error("One or more orders in this checkout are no longer payable.");
  const amount = rows.reduce((sum: number, row: any) => sum + Number(row.amount_cents || 0), 0);
  if (!Number.isSafeInteger(amount) || amount <= 0 || rows.some((row: any) => row.currency !== "USD")) throw new Error("Stripe grouped checkout is currently available for US-dollar orders only.");
  let paymentIntent: any;
  const prior = rows.find((row: any) => row.payment_intent_id)?.payment_intent_id;
  if (prior) paymentIntent = await stripeRequest("GET", `payment_intents/${encodeURIComponent(prior)}`);
  if (!paymentIntent || ["canceled", "succeeded"].includes(paymentIntent.status)) paymentIntent = await stripeRequest("POST", "payment_intents", { amount: String(amount), currency: "usd", "automatic_payment_methods[enabled]": "true", "metadata[checkout_batch_id]": batchId, "metadata[buyer_uid]": uid });
  if (paymentIntent.status === "succeeded") return { checkoutBatchId: batchId, alreadyPaid: true, paymentIntentId: paymentIntent.id };
  const now = new Date().toISOString();
  const update = await db.from("checkout_orders").update({ payment_provider: "stripe", payment_reference: paymentIntent.id, payment_intent_id: paymentIntent.id, updated_at: now }).eq("checkout_batch_id", batchId).eq("buyer_uid", uid);
  if (update.error) throw update.error;
  await db.from("checkout_payments").upsert(rows.map((row: any) => ({ firebase_order_id: row.firebase_order_id, provider: "stripe", provider_reference: paymentIntent.id, payment_intent_id: paymentIntent.id, amount_cents: row.amount_cents, currency: "USD", status: "requires_action", updated_at: now })), { onConflict: "id" });
  return { checkoutBatchId: batchId, clientSecret: text(paymentIntent.client_secret, 1000), paymentIntentId: text(paymentIntent.id, 200) };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return out({ error: "POST required" }, 405);
  try {
    const identity = await firebaseIdentity(text(request.headers.get("x-firebase-id-token"), 6000));
    if (!identity) return out({ error: "Authentication failed" }, 401);
    const body = await request.json().catch(() => ({}));
    const action = text(body.action, 40);
    if (action === "grouped_create") return out(await groupedCreate(identity.uid, body.input || {}));
    if (action === "grouped_intent") return out(await groupedIntent(identity.uid, text(body.checkoutBatchId, 160)));
    return out({ error: "This Supabase checkout route only handles grouped checkout." }, 400);
  } catch (error) {
    console.error(error);
    return out({ error: error instanceof Error ? error.message : "Checkout failed" }, 500);
  }
});
