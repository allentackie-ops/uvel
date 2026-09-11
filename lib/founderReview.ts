import { httpsCallable } from "firebase/functions";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { firebaseFunctions, firebaseReady } from "./firebase";
import type { BrandReview } from "./brandVerify";

export type FounderFiling = {
  name: string;
  handle: string;
  piece: string;
  category: string;
  audience: string;
  story: string;
  photos: string[];
  brandId?: string;
};

export const FOUNDER_REVIEW_STAGES = [
  "Reading the filing…",
  "Searching the USPTO…",
  "Checking the pictures…",
  "Scanning replica language…",
  "Deciding…",
];

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Brand check timed out.")), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

async function imagePayload(uri: string) {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 720 });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.62, base64: true });
  if (!saved.base64) throw new Error("empty");
  return { mime: "image/jpeg" as const, data: saved.base64 };
}

export async function reviewFounderBrand(filing: FounderFiling): Promise<BrandReview> {
  if (!firebaseReady()) {
    return {
      ok: false,
      decision: "human_review",
      headline: "Human review is needed",
      reasons: ["The review desk isn’t connected yet. Nothing has been cleared."],
      notes: "",
    };
  }
  const photos = filing.photos.filter(Boolean).slice(0, 2);
  const images: { mime: "image/jpeg"; data: string }[] = [];
  for (const uri of photos) {
    try {
      images.push(await imagePayload(uri));
    } catch {
      /* skip a broken still */
    }
  }
  const call = httpsCallable(firebaseFunctions(), "reviewFounderBrand");
  const res = await withTimeout(
    call({
      name: filing.name,
      handle: filing.handle,
      piece: filing.piece,
      category: filing.category,
      audience: filing.audience,
      story: filing.story,
      brandId: filing.brandId || "",
      images,
    }) as Promise<{ data: BrandReview }>,
    50000,
  );
  if (res?.data && typeof res.data.ok === "boolean") return res.data;
  return {
    ok: false,
    decision: "human_review",
    headline: "Human review is needed",
    reasons: ["The review desk didn’t return a decision."],
    notes: "",
  };
}
