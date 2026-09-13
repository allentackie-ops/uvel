import type { Category } from "./catalog";
import * as FileSystem from "expo-file-system";
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

function bytesToBase64(bytes: Uint8Array) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += chars[(n >> 18) & 63];
    out += chars[(n >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? chars[n & 63] : "=";
  }
  return out;
}

function mimeOf(uri: string) {
  const u = uri.toLowerCase();
  if (u.includes(".png") || u.startsWith("data:image/png")) return "image/png";
  if (u.includes(".webp")) return "image/webp";
  return "image/jpeg";
}

async function uriToParts(uri: string) {
  const res = await fetch(uri);
  if (!res.ok) throw new Error("Couldn’t read that photo.");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length) throw new Error("That photo is empty.");
  return { mime: mimeOf(uri) as "image/jpeg" | "image/png" | "image/webp", data: bytesToBase64(bytes) };
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

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Photo check timed out.")), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

async function reviewOnDeviceAi(uri: string, mode: "listing" | "founder") {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  if (!base64) throw new Error("That photo is empty.");
  const model = getGenerativeModel(firebaseAi(), { model: "gemini-2.5-flash" });
  const schema = mode === "founder" ? "{\"ok\":boolean,\"headline\":string,\"reasons\":string[]}" : "{\"ok\":boolean,\"score\":number,\"issues\":string[],\"tip\":string,\"title\":string,\"brand\":string,\"category\":string,\"color\":string,\"conditionGuess\":string,\"material\":string,\"description\":string}";
  const prompt = mode === "founder"
    ? "You are the final Uvel Founder Studio gate, run only when the user presses Apply as a brand. Review this attached fashion photo, sketch, silhouette, or stylized design reference. Approve identifiable wearable fashion or a clear fashion design that could be manufactured. A dark background, typography, logo, monochrome styling, or abstract treatment is acceptable when it is clearly a fashion reference. Reject only unsafe content, ordinary screenshots/memes/receipts, unrelated graphics, or images too blurry/dark/cropped to judge. Return ONLY JSON matching " + schema + ". If approved, use headline This is the piece. and reasons []."
    : "Review this Uvel listing image. Approve wearable fashion and identifiable fashion sketches/design references. Reject unsafe content, ordinary screenshots/memes/receipts, unrelated graphics, or images too blurry/dark/cropped to judge. Return ONLY JSON matching " + schema + ".";
  const result = await model.generateContent([{ inlineData: { mimeType: mimeOf(uri), data: base64 } }, prompt]);
  return parseJson(result.response.text());
}

export async function reviewListingPhoto(uri: string): Promise<PhotoReview> {
  const parsed = await reviewOnDeviceAi(uri, "listing");
  const ok = parsed.ok === true;
  return { ok, score: Math.max(1, Math.min(10, Number(parsed.score) || (ok ? 7 : 3))), issues: Array.isArray(parsed.issues) ? parsed.issues.map(String).filter(Boolean).slice(0, 2) : [], tip: String(parsed.tip ?? ""), title: String(parsed.title ?? ""), brand: String(parsed.brand ?? ""), category: asCat(parsed.category), color: String(parsed.color ?? ""), conditionGuess: String(parsed.conditionGuess ?? "Excellent"), material: String(parsed.material ?? ""), description: String(parsed.description ?? ""), analysisStatus: "complete" };
}

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
  const key = anthropicKey();
  if (!key) return { ok: false, reasons: ["Safety check isn’t on."], headline: "Couldn’t check this yet" };

  const shots = opts.photos.slice(0, 3);
  const images = await Promise.all(shots.map((uri) => uriToParts(uri)));
  const res = await withTimeout(
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              ...images.map((img) => ({
                type: "image" as const,
                source: { type: "base64" as const, media_type: img.mime, data: img.data },
              })),
              {
                type: "text",
                text: `You are the last check before a listing goes live on Uvel, a secondhand fashion app. Buyers see this on the public floor.

Listing:
Title: ${opts.name}
Category: ${opts.category}
Brand: ${opts.brand}
Colour: ${opts.color}
Size: ${opts.size}
Condition: ${opts.condition}
Price: $${opts.price}
Description: ${opts.notes || "(none)"}

Approve ONLY wearable fashion: clothes, shoes, bags, jewelry, scarves, belts, hats, hair accessories, or a clearly identifiable fashion design/reference submitted through the photo-or-sketch field.

The photo-or-sketch field intentionally accepts real garments as well as fashion illustrations, line drawings, silhouettes, product/editorial references, and stylized monochrome designs. A dark background, typography, brand mark, or abstract treatment is not by itself a violation when the image is clearly a fashion reference.

ok must be false if ANY of these:
- weapons, drugs, vapes, alcohol, tobacco, medicine
- adult/sexual content, nudes, fetish
- hate, violence, self-harm
- live animals, food, plants as the product
- trash, memes, ordinary app/web screenshots, receipts, or unrelated graphics with no identifiable fashion item/design
- the photos don’t show the item
- title is nonsense / doesn’t match the photos
- counterfeit sold as authentic when it’s obviously fake packaging/tags
- something no clothing marketplace would allow

Be strict on safety. Be fair on ordinary used clothes, even if messy or vintage.

Return ONLY JSON:
{ "ok": boolean, "headline": string, "reasons": string[] }

headline: short, human. If ok: "Clear to list." If not: why in a few words.
reasons: 0–3 short sentences the seller can act on. Empty if ok.`,
              },
            ],
          },
        ],
      }),
    }),
    22000,
  );

  const json = (await res.json()) as { content?: { text?: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || "Couldn’t finish the check.");
  const parsed = parseJson(json.content?.[0]?.text ?? "{}");
  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.map((x) => String(x)).filter(Boolean).slice(0, 3)
    : [];
  const ok = parsed.ok === true;
  return {
    ok,
    reasons,
    headline: String(parsed.headline ?? (ok ? "Clear to list." : "This can’t go on the floor.")),
  };
}

/** First-piece gate for Founder Studio. Fail closed. Sketches of clothes can pass. Random pics cannot. */
export async function reviewFounderPiece(uri: string): Promise<FeedReview> {
  const parsed = await reviewOnDeviceAi(uri, "founder");
  const ok = parsed.ok === true;
  return { ok, reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String).filter(Boolean).slice(0, 2) : [], headline: String(parsed.headline ?? (ok ? "This is the piece." : "That isn’t the piece.")) };
}
