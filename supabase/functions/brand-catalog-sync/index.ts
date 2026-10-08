import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const FIREBASE_API_KEY = Deno.env.get("FIREBASE_API_KEY") || "AIzaSyBYacCvSdirUvZkw6nFZAjm894ZoAPAaPw";
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-id-token",
  "Cache-Control": "no-store",
};
const statuses = new Set(["owned", "draft", "review_pending", "listed", "sold", "archived", "rejected"]);
const publicPieceFields = [
  "id", "name", "brand", "category", "color", "size", "sizes", "sku", "marketPrices", "marketAvailability",
  "condition", "material", "notes", "measurements", "listPriceCents", "originalPriceCents", "status", "createdAt",
  "ownerId", "ownerName", "country", "currency", "shipsTo", "shippingMethod", "shippingCarriers", "shippingBuyerPays",
  "brandId", "listedByUid", "listedByName", "stockQuantity", "sizeStock", "reservedQuantity", "reservedSizeStock",
];

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function text(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

async function firebaseUid(token: string) {
  if (!token) return null;
  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  if (!lookup.ok) return null;
  const user = (await lookup.json()).users?.[0];
  return user?.localId ? String(user.localId) : null;
}

function normalizeShipsTo(value: unknown, country: string) {
  if (value === "all") return "all";
  if (Array.isArray(value)) {
    const codes = [...new Set(value.map((item) => text(item, 2).toUpperCase()).filter((item) => /^[A-Z]{2}$/.test(item)))];
    return codes.includes(country) ? codes : [country, ...codes];
  }
  return [country];
}

function publicPiece(value: Record<string, unknown>) {
  return Object.fromEntries(publicPieceFields.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
}

function validPhotoPaths(paths: unknown, uid: string, id: string): string[] | null {
  if (!Array.isArray(paths) || paths.length < 1 || paths.length > 5) return null;
  const safeUid = uid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const safeId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const result = paths.map((path) => text(path, 240));
  return result.every((path, index) => new RegExp(`^${safeUid}/${safeId}/source-${index}\\.(jpg|png|webp|heic|heif)$`, "i").test(path)) ? result : null;
}

async function existingItem(id: string) {
  const { data, error } = await supabase.from("brand_catalog_items")
    .select("id,brand_id,brand_name,owner_firebase_uid,listed_by_uid,status,country,ships_to,category,photo_paths,piece")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return response({ error: "POST required" }, 405);

  try {
    const token = text(request.headers.get("x-firebase-id-token"), 5000);
    const uid = await firebaseUid(token);
    if (!uid) return response({ error: "Authentication failed." }, 401);

    const body = await request.json().catch(() => ({}));
    const action = text(body?.action, 16);
    const id = text(action === "upsert" ? body?.piece?.id : body?.id, 120);
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) return response({ error: "Invalid brand product ID." }, 400);

    const previous = await existingItem(id);
    if (previous && previous.owner_firebase_uid !== uid && previous.listed_by_uid !== uid) {
      return response({ error: "You are not allowed to change this brand product." }, 403);
    }

    let nextPiece: Record<string, unknown>;
    let photoPaths: string[];
    if (action === "remove") {
      if (!previous) return response({ ok: true, id });
      const { error } = await supabase.from("brand_catalog_items").delete().eq("id", id);
      if (error) throw error;
      if (Array.isArray(previous.photo_paths) && previous.photo_paths.length) {
        const { error: storageError } = await supabase.storage.from("listing-media").remove(previous.photo_paths);
        if (storageError) console.error("Could not clean up removed brand photos", storageError);
      }
      return response({ ok: true, id });
    }

    if (action === "upsert") {
      const incoming = body?.piece;
      if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return response({ error: "A brand product is required." }, 400);
      if (JSON.stringify(incoming).length > 180_000) return response({ error: "Brand product data is too large." }, 413);
      const ownerId = text(incoming.ownerId, 160);
      const listedByUid = text(incoming.listedByUid || uid, 160);
      if (uid !== ownerId && uid !== listedByUid) return response({ error: "The signed-in user must own or publish this item." }, 403);
      if (previous && previous.brand_id !== text(incoming.brandId, 160)) return response({ error: "Brand product IDs cannot move between brands." }, 409);
      const country = text(incoming.country, 2).toUpperCase();
      const status = text(incoming.status, 24);
      const brandId = text(incoming.brandId, 160);
      const brandName = text(incoming.brand, 120);
      const category = text(incoming.category, 60);
      const uploadedPaths = validPhotoPaths(body?.photoPaths, uid, id);
      if (!brandId || !brandName || !category || !/^[A-Z]{2}$/.test(country) || !statuses.has(status) || !uploadedPaths) {
        return response({ error: "Brand product fields or Supabase photo paths are invalid." }, 400);
      }
      nextPiece = publicPiece(incoming);
      nextPiece.id = id;
      nextPiece.brandId = brandId;
      nextPiece.brand = brandName;
      nextPiece.country = country;
      nextPiece.shipsTo = normalizeShipsTo(incoming.shipsTo, country);
      nextPiece.status = status;
      photoPaths = uploadedPaths;
      const row = {
        id,
        brand_id: brandId,
        brand_name: brandName,
        owner_firebase_uid: text(incoming.ownerId || uid, 160),
        listed_by_uid: listedByUid,
        status,
        country,
        ships_to: nextPiece.shipsTo,
        category,
        photo_paths: photoPaths,
        piece: nextPiece,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("brand_catalog_items").upsert(row, { onConflict: "id" });
      if (error) throw error;
      const oldPaths = Array.isArray(previous?.photo_paths) ? previous.photo_paths.filter((path: string) => !photoPaths.includes(path)) : [];
      if (oldPaths.length) {
        const { error: storageError } = await supabase.storage.from("listing-media").remove(oldPaths);
        if (storageError) console.error("Could not clean up replaced brand photos", storageError);
      }
      return response({ ok: true, id });
    }

    if (action === "patch") {
      if (!previous) return response({ error: "Brand product was not found in Supabase." }, 404);
      const patch = body?.patch;
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) return response({ error: "A product update is required." }, 400);
      if (JSON.stringify(patch).length > 100_000) return response({ error: "Brand product update is too large." }, 413);
      nextPiece = publicPiece({ ...previous.piece, ...patch, id });
      const ownerId = text(nextPiece.ownerId || previous.owner_firebase_uid, 160);
      const listedByUid = text(nextPiece.listedByUid || previous.listed_by_uid, 160);
      if (uid !== ownerId && uid !== listedByUid) return response({ error: "The signed-in user must own or publish this item." }, 403);
      const country = text(nextPiece.country || previous.country, 2).toUpperCase();
      const status = text(nextPiece.status || previous.status, 24);
      const brandId = text(nextPiece.brandId || previous.brand_id, 160);
      const brandName = text(nextPiece.brand || previous.brand_name, 120);
      const category = text(nextPiece.category || previous.category, 60);
      const uploadedPaths = body?.photoPaths === undefined ? previous.photo_paths : validPhotoPaths(body.photoPaths, uid, id);
      if (!brandId || !brandName || !category || !/^[A-Z]{2}$/.test(country) || !statuses.has(status) || !uploadedPaths) {
        return response({ error: "Brand product update or Supabase photo paths are invalid." }, 400);
      }
      nextPiece.brandId = brandId;
      nextPiece.brand = brandName;
      nextPiece.country = country;
      nextPiece.shipsTo = normalizeShipsTo(nextPiece.shipsTo ?? previous.ships_to, country);
      nextPiece.status = status;
      const { error } = await supabase.from("brand_catalog_items").update({
        brand_id: brandId,
        brand_name: brandName,
        owner_firebase_uid: ownerId,
        listed_by_uid: listedByUid,
        status,
        country,
        ships_to: nextPiece.shipsTo,
        category,
        photo_paths: uploadedPaths,
        piece: nextPiece,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      const oldPaths = Array.isArray(previous.photo_paths) ? previous.photo_paths.filter((path: string) => !uploadedPaths.includes(path)) : [];
      if (oldPaths.length) {
        const { error: storageError } = await supabase.storage.from("listing-media").remove(oldPaths);
        if (storageError) console.error("Could not clean up replaced brand photos", storageError);
      }
      return response({ ok: true, id });
    }

    return response({ error: "Unknown brand catalog sync action." }, 400);
  } catch (error) {
    console.error("Supabase brand catalog sync failed", error);
    return response({ error: "Could not sync this brand product to Supabase." }, 503);
  }
});
