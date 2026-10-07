import * as FileSystem from "expo-file-system/legacy";
import { firebaseAuth, firebaseReady } from "./firebase";
import { requireSupabase } from "./supabase";

export type SupabaseListingProcessingInput = {
  listingId: string;
  photos: string[];
  backgroundKeys: string[];
  backgroundMap: Record<string, { name: string; color: string }>;
  selectedBackgroundKey: string;
  title?: string;
  brand?: string;
  category?: string;
  color?: string;
  size?: string;
  condition?: string;
  material?: string;
  description?: string;
  priceCents?: number;
  currency: string;
  country: string;
};

export type SupabaseListingStatus = {
  id: string;
  status: string;
  processingStatus: "idle" | "queued" | "processing" | "completed" | "failed";
  processingMessage?: string | null;
  processingError?: string | null;
  processedAt?: string | null;
  title?: string | null;
  brand?: string | null;
  category?: string | null;
  color?: string | null;
  material?: string | null;
  description?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  backgroundKey?: string | null;
};

type UploadedPhoto = { storagePath: string };

function contentTypeOf(uri: string) {
  const clean = uri.split(/[?#]/, 1)[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".heic")) return "image/heic";
  if (clean.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}

async function localBase64(uri: string) {
  let localUri = uri;
  let temporary = false;
  if (/^https?:\/\//i.test(uri)) {
    const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!directory) throw new Error("Photo storage is unavailable on this device.");
    const suffix = contentTypeOf(uri).split("/")[1].replace("jpeg", "jpg");
    const downloaded = await FileSystem.downloadAsync(uri, `${directory}uvel-listing-${Date.now()}-${Math.random().toString(36).slice(2)}.${suffix}`);
    localUri = downloaded.uri;
    temporary = true;
  }
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    if (!base64) throw new Error("One of the listing photos is empty.");
    return base64;
  } finally {
    if (temporary) await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
  }
}

function base64Bytes(base64: string) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function currentIdentity() {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Sign in before listing an item.");
  const user = firebaseAuth().currentUser!;
  return { user, token: await user.getIdToken() };
}

export async function uploadSupabaseListingPhotos(listingId: string, photos: string[]): Promise<UploadedPhoto[]> {
  const { token } = await currentIdentity();
  if (photos.length < 3 || photos.length > 6) throw new Error("Add between 3 and 6 photos.");
  const uploaded: UploadedPhoto[] = [];
  for (let index = 0; index < photos.length; index += 1) {
    const uri = photos[index];
    const type = contentTypeOf(uri);
    const result = await processorCall<{ ok: true; storagePath: string }>(token, {
      action: "upload",
      listingId,
      photoIndex: index,
      contentType: type,
      base64: await localBase64(uri),
    }, "listing-photo-upload");
    uploaded.push({ storagePath: result.storagePath });
  }
  return uploaded;
}

async function processorCall<T>(token: string, body: Record<string, unknown>, functionName = "listing-processor") {
  const { data, error } = await requireSupabase().functions.invoke(functionName, { body, headers: { "x-firebase-id-token": token } });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function startSupabaseListingProcessing(input: SupabaseListingProcessingInput) {
  const { token } = await currentIdentity();
  const uploaded = await uploadSupabaseListingPhotos(input.listingId, input.photos);
  return processorCall<{ ok: true; listingId: string; status: "queued" }>(token, {
    action: "start",
    listingId: input.listingId,
    title: input.title,
    brand: input.brand,
    category: input.category,
    color: input.color,
    size: input.size,
    condition: input.condition,
    material: input.material,
    description: input.description,
    priceCents: input.priceCents,
    currency: input.currency,
    country: input.country,
    selectedBackgroundKey: input.selectedBackgroundKey,
    backgroundMap: input.backgroundMap,
    photos: uploaded.map((photo, index) => ({ storagePath: photo.storagePath, backgroundKey: input.backgroundKeys[index] || input.selectedBackgroundKey, backgroundName: input.backgroundMap[input.backgroundKeys[index] || input.selectedBackgroundKey]?.name || "clean studio", backgroundColor: input.backgroundMap[input.backgroundKeys[index] || input.selectedBackgroundKey]?.color || "soft neutral" })),
  });
}

export async function getSupabaseListingStatus(listingId: string) {
  const { token } = await currentIdentity();
  const result = await processorCall<{ listing: SupabaseListingStatus }>(token, { action: "status", listingId });
  return result.listing;
}

export async function publishSupabaseListing(listingId: string) {
  const { token } = await currentIdentity();
  return processorCall<{ ok: true; listingId: string }>(token, { action: "publish", listingId });
}
