import type { Category } from "./catalog";
import { File } from "expo-file-system";
import { getGenerativeModel } from "firebase/ai";
import { firebaseAi } from "./firebase";

export type PhotoReview = {
  ok: boolean;
  score: number;
  issues: string[];
  tip: string;
  title: string;
  brand: string;
  category: Category;
  color: string;
  conditionGuess: string;
  sizeGuess: string;
  material: string;
  description: string;
  analysisStatus: "complete" | "unavailable";
};

export type FeedReview = {
  ok: boolean;
  reasons: string[];
  headline: string;
};

const CATS: Category[] = [
  "Outerwear",
  "Dresses",
  "Tops",
  "Trousers",
  "Knitwear",
  "Skirts",
  "Shoes",
  "Bags",
  "Accessories",
  "Jewelry",
  "Watches",
  "Hats",
  "Belts",
  "Sunglasses",
  "Scarves",
  "Hair",
  "Lingerie",
  "Swim",
  "Activewear",
  "Socks",
  "Ties",
  "Gloves",
];

function mimeOf(uri: string) {
  const u = uri.toLowerCase();
  if (u.includes(".png") || u.startsWith("data:image/png")) return "image/png";
  if (u.includes(".webp")) return "image/webp";
  return "image/jpeg";
}

function parseJson(text: string): Record<string, unknown> {
  const t = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("No JSON");
  return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
}

function asCat(v: unknown): Category {
  const s = String(v ?? "");
  return (CATS as string[]).includes(s) ? (s as Category) : "Tops";
}

async function reviewOnDeviceAi(uri: string, mode: "listing" | "founder") {
  const base64 = await new File(uri).base64();
  if (!base64) throw new Error("That photo is empty.");
  const model = getGenerativeModel(firebaseAi(), { model: "gemini-2.5-flash" });
  const schema = mode === "founder" ? "{\"ok\":boolean,\"headline\":string,\"reasons\":string[]}" : "{\"ok\":boolean,\"score\":number,\"issues\":string[],\"tip\":string,\"title\":string,\"brand\":string,\"category\":string,\"color\":string,\"conditionGuess\":string,\"sizeGuess\":string,\"material\":string,\"description\":string}";
  const prompt = mode === "founder"
    ? "You are the final Uvel Founder Studio gate, run only when the user presses Apply as a brand. Review this attached fashion photo, sketch, silhouette, or stylized design reference. Approve identifiable wearable fashion or a clear fashion design that could be manufactured. A dark background, typography, logo, monochrome styling, or abstract treatment is acceptable when it is clearly a fashion reference. Reject only unsafe content, ordinary screenshots/memes/receipts, unrelated graphics, or images too blurry/dark/cropped to judge. Return ONLY JSON matching " + schema + ". If approved, use headline This is the piece. and reasons []."
    : "Review this Uvel listing image. Approve wearable fashion and identifiable fashion sketches/design references. Reject unsafe content, ordinary screenshots/memes/receipts, unrelated graphics, or images too blurry/dark/cropped to judge. Return ONLY JSON matching " + schema + ".";
  const result = await model.generateContent([{ inlineData: { mimeType: mimeOf(uri), data: base64 } }, prompt]);
  return parseJson(result.response.text());
}

export async function reviewListingPhoto(uri: string): Promise<PhotoReview> {
  const parsed = await reviewOnDeviceAi(uri, "listing");
  const ok = parsed.ok === true;
  return { ok, score: Math.max(1, Math.min(10, Number(parsed.score) || (ok ? 7 : 3))), issues: Array.isArray(parsed.issues) ? parsed.issues.map(String).filter(Boolean).slice(0, 2) : [], tip: String(parsed.tip ?? ""), title: String(parsed.title ?? ""), brand: String(parsed.brand ?? ""), category: asCat(parsed.category), color: String(parsed.color ?? ""), conditionGuess: String(parsed.conditionGuess ?? "Excellent"), sizeGuess: String(parsed.sizeGuess ?? ""), material: String(parsed.material ?? ""), description: String(parsed.description ?? ""), analysisStatus: "complete" };
}

/** Lightweight preflight retained for verified-brand listings; personal listings use the trusted server review. */
export async function reviewListingForFeed(opts: {
  photos: string[];
  name: string;
  notes: string;
  category: string;
  brand: string;
  color: string;
  size: string;
  condition: string;
  price: string;
}): Promise<FeedReview> {
  if (!opts.photos.length) return { ok: false, headline: "Add a product photo", reasons: ["A clear photo is required before publishing."] };
  const images = await Promise.all(opts.photos.slice(0, 3).map(async (uri) => {
    const data = await new File(uri).base64();
    if (!data) throw new Error("Couldn’t read one of those photos.");
    return { inlineData: { mimeType: mimeOf(uri), data } };
  }));
  const model = getGenerativeModel(firebaseAi(), { model: "gemini-2.5-flash" });
  const prompt = `Review this verified-brand fashion listing before publication. Be fair to ordinary wearable fashion and fashion references. Reject unrelated/non-fashion images, unsafe or prohibited content, photos that do not show the product, or a title that clearly contradicts the images. Return only JSON {"ok":boolean,"headline":string,"reasons":string[]}.
Title: ${opts.name}
Category: ${opts.category}; brand: ${opts.brand}; colour: ${opts.color}; size: ${opts.size}; condition: ${opts.condition}; price: ${opts.price}
Description: ${opts.notes || "(none)"}`;
  const response = await model.generateContent([...images, prompt]);
  const parsed = parseJson(response.response.text());
  const ok = parsed.ok === true;
  return {
    ok,
    headline: String(parsed.headline ?? (ok ? "Clear to list." : "This listing needs changes.")),
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String).filter(Boolean).slice(0, 3) : [],
  };
}

/** First-piece gate for Founder Studio. Fail closed. Sketches of clothes can pass. Random pics cannot. */
export async function reviewFounderPiece(uri: string): Promise<FeedReview> {
  const parsed = await reviewOnDeviceAi(uri, "founder");
  const ok = parsed.ok === true;
  return { ok, reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String).filter(Boolean).slice(0, 2) : [], headline: String(parsed.headline ?? (ok ? "This is the piece." : "That isn’t the piece.")) };
}
