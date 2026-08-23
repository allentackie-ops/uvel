import { anthropicKey } from "./tryon";
import type { Category } from "./catalog";

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

export async function reviewListingPhoto(uri: string): Promise<PhotoReview> {
  const key = anthropicKey();
  if (!key) {
    return {
      ok: true,
      score: 7,
      issues: [],
      tip: "",
      title: "",
      brand: "",
      category: "Tops",
      color: "",
      conditionGuess: "Excellent",
      material: "",
      description: "",
    };
  }

  const { mime, data } = await uriToParts(uri);
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
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mime, data } },
              {
                type: "text",
                text: `You are the listing editor for Uvel, a secondhand clothes app. Buyers need to clearly see the garment.

Return ONLY JSON:
{
  "ok": boolean,
  "score": 1-10,
  "issues": string[],
  "tip": string,
  "title": string,
  "brand": string,
  "category": "Outerwear" | "Dresses" | "Tops" | "Trousers" | "Knitwear" | "Skirts" | "Shoes" | "Bags" | "Accessories",
  "color": string,
  "conditionGuess": "New with tags" | "Like new" | "Excellent" | "Good" | "Fair",
  "material": string,
  "description": string
}

ok is false when a buyer could not fairly judge the piece: blurry, too dark, item cropped or tiny, heavy clutter, screenshot/meme, not clothing/accessories, or the clothes are hidden.

ok is true if the garment is the focus and clearly visible — on a hanger, flat lay, or worn in a mirror pic is fine.

issues: max 2 short sentences, plain English, no jargon.
tip: one sentence on how to reshoot if ok is false, else "".
title: a sellable name like "Ivory silk slip" — empty if you cannot tell.
description: 1-2 sentences a seller could post. Empty if unclear.
brand: guess or "".`,
              },
            ],
          },
        ],
      }),
    }),
    18000,
  );

  const json = (await res.json()) as { content?: { text?: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || "Couldn’t check that photo.");
  const parsed = parseJson(json.content?.[0]?.text ?? "{}");
  const issues = Array.isArray(parsed.issues) ? parsed.issues.map((x) => String(x)).filter(Boolean).slice(0, 2) : [];
  const ok = Boolean(parsed.ok);
  return {
    ok,
    score: Math.max(1, Math.min(10, Number(parsed.score) || (ok ? 7 : 3))),
    issues,
    tip: String(parsed.tip ?? ""),
    title: String(parsed.title ?? ""),
    brand: String(parsed.brand ?? ""),
    category: asCat(parsed.category),
    color: String(parsed.color ?? ""),
    conditionGuess: String(parsed.conditionGuess ?? "Excellent"),
    material: String(parsed.material ?? ""),
    description: String(parsed.description ?? ""),
  };
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

Approve ONLY wearable fashion: clothes, shoes, bags, jewelry, scarves, belts, hats, hair accessories.

ok must be false if ANY of these:
- weapons, drugs, vapes, alcohol, tobacco, medicine
- adult/sexual content, nudes, fetish
- hate, violence, self-harm
- live animals, food, plants as the product
- trash, memes, screenshots, receipts, not a real item
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
