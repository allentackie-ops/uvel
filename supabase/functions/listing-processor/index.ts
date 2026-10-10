import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const FIREBASE_API_KEY = Deno.env.get("FIREBASE_API_KEY") || "AIzaSyBYacCvSdirUvZkw6nFZAjm894ZoAPAaPw";
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-id-token" };
const MAX_PHOTOS = 6;
const MAX_BYTES = 8 * 1024 * 1024;

type Identity = { firebaseUid: string; email: string };
type PhotoInput = { storagePath: string; backgroundKey: string; backgroundName: string; backgroundColor: string };

function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers }); }
function text(value: unknown, max = 2000) { return String(value ?? "").trim().slice(0, max); }
function safeId(value: unknown) { const id = text(value, 120); return /^[A-Za-z0-9_-]{1,120}$/.test(id) ? id : ""; }

async function verifyFirebaseToken(token: string): Promise<Identity | null> {
  if (!token) return null;
  const result = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }) });
  if (!result.ok) return null;
  const data = await result.json();
  const user = data.users?.[0];
  return user?.localId ? { firebaseUid: String(user.localId), email: text(user.email, 320) } : null;
}

async function ownerListing(identity: Identity, listingId: string) {
  const { data, error } = await supabase.from("listings").select("*").eq("id", listingId).eq("owner_firebase_uid", identity.firebaseUid).maybeSingle();
  if (error) throw error;
  return data;
}

async function signedUrl(path: string, expires = 3600) {
  const { data, error } = await supabase.storage.from("listing-media").createSignedUrl(path, expires);
  if (error || !data?.signedUrl) throw error || new Error("Listing media could not be opened.");
  return data.signedUrl;
}

async function openAiRender(sourceUrl: string, backgroundName: string, backgroundColor: string) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("Supabase image processing is not configured.");
  const prompt = `Edit this exact product photograph for a marketplace listing. Preserve the product exactly: its identity, shape, color, material, stitching, logos, proportions, and every visible detail. Remove the original room, floor, furniture, props, and environmental shadows. Place only the product on a clean ${backgroundName} studio background with a subtle realistic grounding shadow and natural light. Do not invent, restyle, recolor, crop into a portrait frame, add text, add a border, or change the product. The background should be close to ${backgroundColor}. Return one realistic listing image.`;
  const result = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(120_000), body: JSON.stringify({ model: "gpt-image-1", prompt, images: [{ image_url: sourceUrl }], size: "1024x1536", quality: "high", output_format: "png" }) });
  const json = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(text(json?.error?.message || "Image processing failed.", 240));
  const encoded = text(json?.data?.[0]?.b64_json, 30_000_000);
  if (!encoded) throw new Error("Image processing returned no image.");
  return Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
}

async function analyzeListing(sourceUrl: string, currency: string) {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return { title: "Your piece", description: "A well-presented piece ready for its next home.", brand: "Unlabeled", category: "Other", color: "N/A", material: "N/A", priceCents: 2500, confidence: "low" };
  const image = await fetch(sourceUrl);
  if (!image.ok) throw new Error("The listing photo could not be analyzed.");
  const bytes = new Uint8Array(await image.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("The listing photo is too large to analyze.");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const prompt = `You are preparing a concise secondhand marketplace listing from a product photo. Identify the actual item conservatively. Use simple English. Return ONLY JSON with title, description, brand, category, color, material, priceCents, and confidence. Title: 2-6 clear words. Description: 1-2 short sentences, detailed but not bloated. Use "N/A" when a field is not meaningfully applicable or cannot be seen (for example lipstick material, or an unknown brand). Do not invent a brand. Choose a fair used-market suggested price in ${currency || "USD"} cents; never use an extreme price. Category should be a useful broad category such as tops, bottoms, dresses, outerwear, shoes, bags, hats, jewelry, makeup, equipment, or other. Do not fill size or condition; those belong to the seller. JSON: {"title":"", "description":"", "brand":"", "category":"", "color":"", "material":"", "priceCents":0, "confidence":"low|medium|high"}`;
  const result = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }, signal: AbortSignal.timeout(60_000), body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 600, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: btoa(binary) } }, { type: "text", text: prompt }] }] }) });
  const json = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error("Listing details could not be generated.");
  const raw = text(json?.content?.[0]?.text, 4000).replace(/^```json\s*|\s*```$/g, "");
  const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  return { title: text(parsed.title, 120) || "Your piece", description: text(parsed.description, 500) || "A well-presented piece ready for its next home.", brand: text(parsed.brand, 120) || "Unlabeled", category: text(parsed.category, 80) || "Other", color: text(parsed.color, 80) || "N/A", material: text(parsed.material, 120) || "N/A", priceCents: Math.max(100, Math.min(500000, Math.round(Number(parsed.priceCents) || 2500))), confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "medium" };
}

async function notify(identity: Identity, listingId: string, title: string, body: string) {
  const { data: preference, error: preferenceError } = await supabase.from("user_notification_preferences").select("enabled,expo_push_token").eq("firebase_uid", identity.firebaseUid).maybeSingle();
  if (preferenceError) throw preferenceError;
  let token = preference?.enabled ? text(preference.expo_push_token, 500) : "";
  if (!preference) {
    const { data: profile } = await supabase.from("profiles").select("expo_push_token").eq("legacy_firebase_uid", identity.firebaseUid).maybeSingle();
    token = text(profile?.expo_push_token, 500);
  }
  if (!token) return;
  await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: token, title, body, sound: "default", priority: "high", data: { kind: "listing_processing_complete", listingId } }) }).catch(() => undefined);
}

async function processListing(identity: Identity, listingId: string) {
  const listing = await ownerListing(identity, listingId);
  if (!listing || listing.processing_status !== "queued") return;
  await supabase.from("listings").update({ status: "analyzing", processing_status: "processing", processing_message: "Getting the listing right", processing_error: null, updated_at: new Date().toISOString() }).eq("id", listingId);
  try {
    const { data: photos, error: photoError } = await supabase.from("listing_photos").select("id,storage_path,sort_order,background_key").eq("listing_id", listingId).order("sort_order");
    if (photoError) throw photoError;
    if (!photos?.length || photos.length > MAX_PHOTOS) throw new Error("Add between 3 and 6 photos.");
    const backgrounds = (listing.background_map || {}) as Record<string, { name?: string; color?: string }>;
    const sourceUrl = await signedUrl(String(photos[0].storage_path));
    const ai = await analyzeListing(sourceUrl, String(listing.currency || "USD"));
    await supabase.from("listings").update({ ai_suggestions: ai, title: ai.title, brand: ai.brand, category: ai.category, color: ai.color, material: ai.material, description: ai.description, price_cents: ai.priceCents, processing_message: "Finishing the listing", updated_at: new Date().toISOString() }).eq("id", listingId);
    await supabase.from("listings").update({ status: "cutout_processing", processing_message: "Making each photo ready", updated_at: new Date().toISOString() }).eq("id", listingId);
    for (const photo of photos) {
      const key = String(photo.background_key || listing.selected_background_key || "natural-linen");
      const background = backgrounds[key] || { name: "clean studio", color: "soft neutral" };
      const rendered = await openAiRender(await signedUrl(String(photo.storage_path)), String(background.name || "clean studio"), String(background.color || "soft neutral"));
      const renderPath = `${identity.firebaseUid}/${listingId}/rendered-${photo.sort_order}.png`;
      const { error: uploadError } = await supabase.storage.from("listing-media").upload(renderPath, rendered, { contentType: "image/png", upsert: true, cacheControl: "31536000" });
      if (uploadError) throw uploadError;
      await supabase.from("listing_photos").update({ render_storage_path: renderPath, background_key: key, render_url: renderPath }).eq("id", photo.id);
      await supabase.from("listing_cutouts").upsert({ listing_id: listingId, source_photo_id: photo.id, status: "ready", storage_path: renderPath, updated_at: new Date().toISOString() }, { onConflict: "listing_id" });
    }
    await supabase.from("listings").update({ status: "ready_for_review", processing_status: "completed", processing_message: "Your listing is ready", processed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", listingId);
    await notify(identity, listingId, "Your listing is ready", "Your listing is ready to review.");
  } catch (error) {
    const message = text(error instanceof Error ? error.message : error, 240) || "Listing processing failed.";
    await supabase.from("listings").update({ status: "draft", processing_status: "failed", processing_error: message, processing_message: "We could not finish the listing", updated_at: new Date().toISOString() }).eq("id", listingId);
    await notify(identity, listingId, "Your listing needs attention", message);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return response({ error: "POST required" }, 405);
  const identity = await verifyFirebaseToken(text(request.headers.get("x-firebase-id-token"), 5000));
  if (!identity) return response({ error: "Authentication failed" }, 401);
  try {
    const body = await request.json();
    const action = text(body.action, 40);
    const listingId = safeId(body.listingId);
    if (!listingId) return response({ error: "A listing id is required" }, 400);
    if (action === "upload") {
      const photoIndex = Number(body.photoIndex);
      const contentType = text(body.contentType, 40).toLowerCase();
      const base64 = text(body.base64, 12000000);
      if (!Number.isInteger(photoIndex) || photoIndex < 0 || photoIndex >= MAX_PHOTOS || !base64 || !["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(contentType)) return response({ error: "Invalid listing photo upload" }, 400);
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      if (!bytes.length || bytes.length > MAX_BYTES) return response({ error: "Choose a smaller listing photo" }, 400);
      const extension = contentType.split("/")[1].replace("jpeg", "jpg");
      const path = `${identity.firebaseUid}/${listingId}/source-${photoIndex}.${extension}`;
      const { error } = await supabase.storage.from("listing-media").upload(path, bytes, { contentType, upsert: true, cacheControl: "31536000" });
      if (error) throw error;
      return response({ ok: true, storagePath: path });
    }
    if (action === "status") {
      const listing = await ownerListing(identity, listingId);
      if (!listing) return response({ error: "Listing not found" }, 404);
      return response({ listing: { id: listing.id, status: listing.status, processingStatus: listing.processing_status, processingMessage: listing.processing_message, processingError: listing.processing_error, processedAt: listing.processed_at, title: listing.title, brand: listing.brand, category: listing.category, color: listing.color, material: listing.material, description: listing.description, priceCents: listing.price_cents, currency: listing.currency, backgroundKey: listing.selected_background_key } });
    }
    if (action === "publish") {
      const listing = await ownerListing(identity, listingId);
      if (!listing || listing.processing_status !== "completed") return response({ error: "Listing is not ready to publish" }, 409);
      const requestedPrice = Number(body.priceCents);
      const priceCents = Number.isSafeInteger(requestedPrice) && requestedPrice > 0 ? requestedPrice : Number(listing.price_cents) || null;
      const previousPrice = Number(listing.previous_price_cents) || 0;
      const requestedOriginal = Number(body.originalPriceCents) || 0;
      const storedOriginal = Number(listing.original_price_cents) || 0;
      const originalPriceCents = priceCents
        ? (previousPrice > priceCents ? previousPrice : requestedOriginal > priceCents ? requestedOriginal : storedOriginal > priceCents ? storedOriginal : null)
        : null;
      const { error } = await supabase.from("listings").update({ status: "listed", price_cents: priceCents, original_price_cents: originalPriceCents, previous_price_cents: null, updated_at: new Date().toISOString() }).eq("id", listingId);
      if (error) throw error;
      return response({ ok: true, listingId });
    }
    if (action !== "start") return response({ error: "Unsupported action" }, 400);
    const photos = Array.isArray(body.photos) ? body.photos.slice(0, MAX_PHOTOS) as PhotoInput[] : [];
    if (photos.length < 3 || photos.length > MAX_PHOTOS) return response({ error: "Add between 3 and 6 photos" }, 400);
    const existingListing = await ownerListing(identity, listingId);
    const requestedPrice = Number(body.priceCents);
    const priceCents = Number.isSafeInteger(requestedPrice) && requestedPrice > 0 ? requestedPrice : null;
    const previousPrice = Number(existingListing?.price_cents) || 0;
    const requestedOriginal = Number(body.originalPriceCents) || 0;
    const storedOriginal = Number(existingListing?.original_price_cents) || 0;
    const originalPriceCents = priceCents
      ? (previousPrice > priceCents ? previousPrice : requestedOriginal > priceCents ? requestedOriginal : storedOriginal > priceCents ? storedOriginal : null)
      : null;
    const { data: profile } = await supabase.from("profiles").select("id").eq("legacy_firebase_uid", identity.firebaseUid).maybeSingle();
    const listing = { legacy_firebase_id: listingId, owner_firebase_uid: identity.firebaseUid, owner_id: profile?.id || null, source: "supabase", status: "analyzing", processing_status: "queued", processing_message: "Getting the listing right", title: text(body.title, 120) || null, brand: text(body.brand, 120) || null, category: text(body.category, 80) || null, color: text(body.color, 80) || null, size: text(body.size, 80) || null, condition: text(body.condition, 80) || null, material: text(body.material, 120) || null, description: text(body.description, 500) || null, price_cents: priceCents, original_price_cents: originalPriceCents, previous_price_cents: previousPrice || null, currency: text(body.currency, 3).toUpperCase(), country: text(body.country, 2).toUpperCase(), selected_background_key: text(body.selectedBackgroundKey, 80) || null, background_map: body.backgroundMap && typeof body.backgroundMap === "object" ? body.backgroundMap : {}, ai_analysis: {}, ai_suggestions: {}, moderation: { status: "pending", source: "supabase-listing-processor" }, updated_at: new Date().toISOString() };
    const { data: saved, error } = await supabase.from("listings").upsert(listing, { onConflict: "legacy_firebase_id" }).select("id").single();
    if (error) throw error;
    await supabase.from("listing_photos").delete().eq("listing_id", saved.id);
    const { error: photoError } = await supabase.from("listing_photos").insert(photos.map((photo, index) => ({ listing_id: saved.id, storage_path: text(photo.storagePath, 500), sort_order: index, capture_source: "camera", captured_at: new Date().toISOString(), background_key: text(photo.backgroundKey, 80) || null })));
    if (photoError) throw photoError;
    EdgeRuntime.waitUntil(processListing(identity, listingId));
    return response({ ok: true, listingId, status: "queued" });
  } catch (error) {
    console.error(error);
    return response({ error: text(error instanceof Error ? error.message : error, 240) || "Could not start listing processing" }, 500);
  }
});
