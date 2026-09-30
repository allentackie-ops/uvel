import * as FileSystem from "expo-file-system/legacy";
import { httpsCallable } from "firebase/functions";
import { firebaseAuth, firebaseFunctions, firebaseReady } from "./firebase";

export type PersonalListingReviewInput = {
  listingId: string;
  photos: string[];
  name: string;
  brand: string;
  category: string;
  color: string;
  size: string;
  condition: string;
  material: string;
  notes: string;
  listPriceCents: number;
  originalPriceCents: number;
  country: string;
  currency: string;
  shipsTo: unknown;
  shippingMethod: "dropoff" | "pickup";
  shippingCarriers: string[];
  shippingBuyerPays: boolean;
  shopLook?: string;
  clipUri?: string;
  ownerName?: string;
  ownerPhoto?: string;
};

export type PersonalListingReviewResult = {
  ok: boolean;
  status: "listed" | "rejected";
  headline: string;
  reasons: string[];
  photos: string[];
  photoStoragePaths: string[];
};

type UploadResult = { url: string; path: string };
type SubmitPayload = Omit<PersonalListingReviewInput, "photos"> & { mediaPaths: string[] };

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
    const mime = contentTypeOf(uri);
    const suffix = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime.includes("heic") ? "heic" : mime.includes("heif") ? "heif" : "jpg";
    const destination = `${directory}uvel-review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${suffix}`;
    const downloaded = await FileSystem.downloadAsync(uri, destination);
    localUri = downloaded.uri;
    temporary = true;
  }
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    if (!base64) throw new Error("One of the listing photos is empty.");
    if (base64.length > 8 * 1024 * 1024) throw new Error("Choose listing photos under 6 MB each.");
    return base64;
  } finally {
    if (temporary) await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
  }
}

export async function submitPersonalListingForReview(input: PersonalListingReviewInput): Promise<PersonalListingReviewResult> {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Sign in before submitting a listing for review.");
  if (!input.photos.length || input.photos.length > 10) throw new Error("Add between 1 and 10 photos.");

  const upload = httpsCallable<{ listingId: string; photoIndex: number; contentType: string; base64: string }, UploadResult>(
    firebaseFunctions(),
    "uploadPersonalListingAsset",
  );
  const uploaded = await Promise.all(input.photos.map(async (uri, photoIndex) => {
    const result = await upload({
      listingId: input.listingId,
      photoIndex,
      contentType: contentTypeOf(uri),
      base64: await localBase64(uri),
    });
    if (!result.data?.url || !result.data?.path) throw new Error("A listing photo could not be uploaded.");
    return result.data;
  }));

  const listingFields = { ...input };
  delete (listingFields as Partial<PersonalListingReviewInput>).photos;
  const submit = httpsCallable<SubmitPayload, PersonalListingReviewResult>(
    firebaseFunctions(),
    "submitPersonalListingForReview",
    { timeout: 300_000 },
  );
  const result = await submit({ ...listingFields, mediaPaths: uploaded.map((item) => item.path) });
  return result.data;
}
