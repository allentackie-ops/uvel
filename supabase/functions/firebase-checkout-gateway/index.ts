import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIREBASE_API_KEY = "AIzaSyBYacCvSdirUvZkw6nFZAjm894ZoAPAaPw";
const FIREBASE_BASE = "https://us-central1-uvel-32d32.cloudfunctions.net";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-id-token",
};
const text = (value: unknown, limit = 2000) => String(value ?? "").trim().slice(0, limit);
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

function firebaseErrorMessage(body: unknown, status: number) {
  const root = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const error = root.error;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const nested = error as Record<string, unknown>;
    for (const candidate of [nested.message, nested.details, nested.status]) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }
  for (const candidate of [root.message, root.details]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  const raw = text(body, 500);
  return raw || `Marketplace request failed (upstream status ${status}).`;
}

async function firebaseCall(name: string, token: string, data: unknown) {
  const response = await fetch(`${FIREBASE_BASE}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  const raw = await response.text().catch(() => "");
  let body: unknown = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = raw;
  }
  const root = body && typeof body === "object" ? body as Record<string, unknown> : {};
  if (!response.ok || root.error) throw new Error(firebaseErrorMessage(body, response.status));
  return root.data ?? body;
}

async function stripe(path: string, values: Record<string, string>) {
  if (!STRIPE_SECRET_KEY) throw new Error("Stripe is not configured in Supabase yet. Add STRIPE_SECRET_KEY before accepting payments.");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(text(body?.error?.message || "Stripe request failed", 500));
  return body;
}

function cents(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? String(number) : "";
}

async function mirrorOrder(uid: string, order: any) {
  if (text(order.buyerId, 160) !== uid) throw new Error("You can only mirror your own checkout.");
  const row = {
    firebase_order_id: text(order.id, 160), checkout_batch_id: text(order.checkoutBatchId, 160) || null,
    buyer_uid: text(order.buyerId, 160), seller_uid: text(order.sellerId, 160), listing_id: text(order.pieceId, 160),
    listing_name: text(order.pieceName, 200), brand_id: text(order.brandId, 160) || null,
    amount_cents: Math.floor(Number(order.totalCents)), item_cents: Math.floor(Number(order.itemCents || 0)),
    fee_cents: Math.floor(Number(order.feeCents || 0)), shipping_cents: Math.floor(Number(order.shipCents || 0)),
    discount_cents: Math.floor(Number(order.discountCents || 0)), credit_cents: Math.floor(Number(order.creditCents || 0)),
    currency: text(order.currency, 3).toUpperCase(), country: text(order.country, 2).toUpperCase(),
    pay_method: text(order.payMethod, 80), address: order.address && typeof order.address === "object" ? order.address : {},
    status: "pending", fulfillment_status: text(order.fulfillmentStatus, 40) || null, updated_at: new Date().toISOString(),
  };
  if (!row.firebase_order_id || !row.buyer_uid || !row.listing_id || !Number.isSafeInteger(row.amount_cents) || row.amount_cents <= 0) throw new Error("Invalid checkout order.");
  const { data, error } = await db.from("checkout_orders").upsert(row, { onConflict: "firebase_order_id" }).select("id,firebase_order_id,status,amount_cents,currency").single();
  if (error) throw error;
  return data;
}

async function createIntent(uid: string, orderId: string, amountCents?: unknown, currency?: unknown) {
  const { data: order, error } = await db.from("checkout_orders").select("firebase_order_id,buyer_uid,amount_cents,currency,listing_id").eq("firebase_order_id", orderId).maybeSingle();
  if (error) throw error;
  if (!order || order.buyer_uid !== uid) throw new Error("Checkout order was not found in Supabase.");
  const amount = cents(amountCents) || cents(order.amount_cents);
  if (!amount) throw new Error("Invalid checkout amount.");
  const curr = text(currency || order.currency, 3).toLowerCase();
  const paymentIntent = await stripe("payment_intents", { amount, currency: curr, "automatic_payment_methods[enabled]": "true", "metadata[firebase_order_id]": orderId, "metadata[listing_id]": text(order.listing_id, 160) });
  await db.from("checkout_payments").insert({ firebase_order_id: orderId, provider: "stripe", provider_reference: paymentIntent.id, payment_intent_id: paymentIntent.id, amount_cents: Number(amount), currency: curr.toUpperCase(), status: "requires_action" });
  return { clientSecret: text(paymentIntent.client_secret, 1000), paymentIntentId: text(paymentIntent.id, 200) };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return out({ error: "POST required" }, 405);
  try {
    const token = text(request.headers.get("x-firebase-id-token"), 6000);
    const uid = await verify(token);
    if (!uid) return out({ error: "Firebase authentication failed" }, 401);
    const body = await request.json();
    const action = text(body.action, 40);
    if (action === "mirror_order") return out({ order: await mirrorOrder(uid, body.order) });
    if (action === "stripe_intent") return out(await createIntent(uid, text(body.orderId, 160), body.amountCents, body.currency));
    if (action === "hosted_checkout") {
      const input = body.input || {};
      const amount = cents(input.amountCents);
      if (!amount) throw new Error("Invalid checkout amount.");
      const session = await stripe("checkout/sessions", {
        mode: "payment", "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": text(input.currency, 3).toLowerCase(),
        "line_items[0][price_data][unit_amount]": amount, "line_items[0][price_data][product_data][name]": text(input.name, 200) || "Uvel purchase",
        customer_email: text(input.email, 320), success_url: "uvel://checkout/success?orderId=" + encodeURIComponent(text(input.orderId, 160)),
        cancel_url: "uvel://checkout/cancel?orderId=" + encodeURIComponent(text(input.orderId, 160)), "metadata[firebase_order_id]": text(input.orderId, 160),
        "metadata[listing_id]": text(input.listingId, 160), "metadata[reference]": text(input.reference, 200),
      });
      return out({ processor: "stripe", url: text(session.url, 2000), reference: text(input.reference, 200) });
    }
    if (action === "grouped_create" || action === "promotion") return out(await firebaseCall(action === "grouped_create" ? "createGroupedCheckout" : "validatePromotion", token, body.input || {}));
    if (action === "grouped_intent") {
      const batchId = text(body.checkoutBatchId, 160);
      const { data: rows, error } = await db.from("checkout_orders").select("firebase_order_id,buyer_uid,amount_cents,currency").eq("checkout_batch_id", batchId).eq("buyer_uid", uid).limit(20);
      if (error) throw error;
      if (!rows?.length) throw new Error("Grouped checkout is not mirrored into Supabase yet.");
      const total = rows.reduce((sum: number, row: any) => sum + Number(row.amount_cents || 0), 0);
      const paymentIntent = await stripe("payment_intents", { amount: String(total), currency: text(rows[0].currency, 3).toLowerCase(), "automatic_payment_methods[enabled]": "true", "metadata[checkout_batch_id]": batchId });
      return out({ clientSecret: text(paymentIntent.client_secret, 1000), paymentIntentId: text(paymentIntent.id, 200), checkoutBatchId: batchId });
    }
    return out({ error: "Unknown checkout action" }, 400);
  } catch (error) {
    console.error(error);
    return out({ error: error instanceof Error ? error.message : "Checkout failed" }, 500);
  }
});
