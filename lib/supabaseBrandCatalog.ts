import { firebaseAuth, firebaseReady } from "./firebase";
import { uploadSupabaseBrandPhotos } from "./listingReview";
import { requireSupabase } from "./supabase";
import type { ClosetPiece } from "./wardrobe";

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function firebaseIdToken() {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Sign in before syncing a brand product.");
  return firebaseAuth().currentUser!.getIdToken();
}

async function syncCall(body: Record<string, unknown>, token: string) {
  const { data, error } = await requireSupabase().functions.invoke("brand-catalog-sync", {
    body,
    headers: { "x-firebase-id-token": token },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export async function syncNewBrandCatalogItem(piece: ClosetPiece) {
  const token = await firebaseIdToken();
  const photos = piece.photos?.length ? piece.photos : [piece.photo];
  const photoPaths = await uploadSupabaseBrandPhotos(piece.id, photos);
  await syncCall({ action: "upsert", piece: serialize(piece), photoPaths }, token);
}

export async function syncBrandCatalogPatch(id: string, patch: Partial<ClosetPiece>) {
  const token = await firebaseIdToken();
  const photoUris = patch.photos?.length ? patch.photos : patch.photo ? [patch.photo] : [];
  const photoPaths = photoUris.length ? await uploadSupabaseBrandPhotos(id, photoUris) : undefined;
  await syncCall({ action: "patch", id, patch: serialize(patch), ...(photoPaths ? { photoPaths } : {}) }, token);
}

export async function removeSyncedBrandCatalogItem(id: string) {
  const token = await firebaseIdToken();
  await syncCall({ action: "remove", id }, token);
}
