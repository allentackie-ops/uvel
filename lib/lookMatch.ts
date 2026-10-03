import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { getGenerativeModel } from "firebase/ai";
import { firebaseAi } from "./firebase";
import type { Category } from "./catalog";
import { allPieces, type ClosetPiece } from "./wardrobe";
import type { Look } from "./trends";
import { dnaFrom, dnaKeywords } from "./styleDna";
import { snapshot } from "./store";
import { listingVisibleIn } from "./ships";

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

function bag(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

const DAY = 24 * 60 * 60 * 1000;

export function followedBrandBoost(piece: ClosetPiece, followedBrandIds: string[]) {
  if (!piece.brandId || !followedBrandIds.includes(piece.brandId)) return 0;
  const age = Math.max(0, Date.now() - (piece.createdAt || 0));
  const freshness = age <= 14 * DAY ? 8 : age <= 45 * DAY ? 4 : 1;
  return 14 + freshness;
}

export function firstSaleBoost(piece: ClosetPiece, dnaScore: number) {
  if (dnaScore <= 0 || piece.status !== "listed") return 0;
  const owner = piece.ownerId || piece.listedByUid;
  if (!owner) return 0;
  const first = allPieces()
    .filter((row) => (row.ownerId === owner || row.listedByUid === owner) && (row.status === "listed" || row.status === "sold"))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0];
  return first?.id === piece.id ? 16 : 0;
}

export function scoreListing(piece: ClosetPiece, needles: string[], styles: string[]) {
  const hay = bag([piece.name, piece.brand, piece.category, piece.color, piece.material, piece.notes].join(" "));
  const set = new Set(hay);
  const dna = dnaFrom({ ...snapshot(), styles });
  let n = 0;
  for (const w of needles) if (set.has(w)) n += 3;
  for (const w of dnaKeywords(dna)) if (set.has(w)) n += 4;
  for (const s of styles) {
    const t = s.toLowerCase();
    if (hay.includes(t) || piece.notes.toLowerCase().includes(t) || piece.category.toLowerCase().includes(t)) n += 4;
  }
  return n;
}

export function matchListings(
  look: Pick<Look, "title" | "summary" | "shopQuery">,
  pieces: ClosetPiece[],
  styles: string[] = [],
  followedBrandIds: string[] = [],
) {
  const needles = bag([look.shopQuery, look.title, look.summary].join(" "));
  return [...pieces]
    .map((p) => {
      const s = scoreListing(p, needles, styles);
      return { p, s: s + followedBrandBoost(p, followedBrandIds) + firstSaleBoost(p, s) };
    })
    .sort((a, b) => b.s - a.s || b.p.createdAt - a.p.createdAt)
    .map((x) => x.p);
}

export function forYou(pieces: ClosetPiece[], styles: string[], country: string, followedBrandIds: string[] = []) {
  const gender = snapshot().gender;
  return [...pieces]
    .filter((p) => listingVisibleIn({ origin: p.country, shipsTo: p.shipsTo, buyer: country }))
    .sort((a, b) => {
      const as = scoreListing(a, [], styles);
      const bs = scoreListing(b, [], styles);
      const aTotal = as + (a.country === country ? 2 : 0) + followedBrandBoost(a, followedBrandIds) + firstSaleBoost(a, as) + genderBoost(a, gender);
      const bTotal = bs + (b.country === country ? 2 : 0) + followedBrandBoost(b, followedBrandIds) + firstSaleBoost(b, bs) + genderBoost(b, gender);
      return bTotal - aTotal || b.createdAt - a.createdAt;
    });
}

function bytesToBase64(bytes: Uint8Array) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? chars[n & 63] : "=";
  }
  return out;
}

async function imageData(uri: string) {
  if (uri.startsWith("data:")) {
    const comma = uri.indexOf(",");
    if (comma < 0) throw new Error("That photo could not be read.");
    const mimeType = uri.slice(5, comma).split(";")[0] || "image/jpeg";
    return { mimeType, data: uri.slice(comma + 1) };
  }
  if (/^https?:/i.test(uri)) {
    const res = await fetch(uri);
    if (!res.ok) throw new Error("That photo could not be loaded.");
    const bytes = new Uint8Array(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    return { mimeType, data: bytesToBase64(bytes) };
  }
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 768 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.78, base64: true });
  if (!saved.base64) throw new Error("That photo could not be read.");
  return { mimeType: "image/jpeg", data: saved.base64 };
}

export function asCategory(raw?: string): Category | null {
  const s = (raw || "").toLowerCase().trim();
  if (!s) return null;
  if (/(outerwear|jacket|coat|blazer|trench|parka)/.test(s)) return "Outerwear";
  if (/(dress|gown|slip dress)/.test(s)) return "Dresses";
  if (/(skirt)/.test(s)) return "Skirts";
  if (/(trouser|pant|jean|denim|short|chino)/.test(s)) return "Trousers";
  if (/(knit|sweater|cardigan|crew|turtleneck)/.test(s)) return "Knitwear";
  if (/(shoe|sneaker|boot|loafer|heel|sandal)/.test(s)) return "Shoes";
  if (/(bag|tote|purse|clutch)/.test(s)) return "Bags";
  if (/(accessor|belt|hat|scarf|jewel|glass)/.test(s)) return "Accessories";
  if (/(top|tee|t-shirt|shirt|blouse|cami|bodysuit|corset|tank)/.test(s)) return "Tops";
  const exact = CATS.find((c) => c.toLowerCase() === s);
  return exact ?? null;
}

export function listingAudience(piece: ClosetPiece): "men" | "women" | "unisex" {
  const cat = (piece.category || "").toLowerCase();
  if (cat === "dresses" || cat === "skirts" || cat === "lingerie") return "women";
  const t = `${piece.name} ${piece.notes} ${piece.category}`.toLowerCase();
  if (
    /(bodysuit|corset|blouse|dress|skirt|heel|cami|bralette|gown|women|ladies|crop top|sleeveless bodysuit)/.test(t)
  ) {
    return "women";
  }
  if (/\b(men'?s|menswear|male|for him)\b/.test(t)) return "men";
  return "unisex";
}

export function genderBoost(piece: ClosetPiece, gender?: string) {
  const g = (gender || "").toLowerCase();
  if (!g || g === "other") return 0;
  const who = listingAudience(piece);
  if (/^(man|male|men)$/.test(g)) {
    if (who === "men") return 18;
    if (who === "unisex") return 10;
    return -8;
  }
  if (/^(woman|female|women)$/.test(g)) {
    if (who === "women") return 18;
    if (who === "unisex") return 10;
    return -8;
  }
  return 0;
}

export function pieceFitsLook(
  piece: ClosetPiece,
  opts: { wearer: "man" | "woman" | "unknown"; categories: Category[] },
) {
  if (opts.categories.length && !opts.categories.includes(piece.category)) return false;
  const who = listingAudience(piece);
  if (opts.wearer === "man" && who === "women") return false;
  if (opts.wearer === "woman" && who === "men") return false;
  return true;
}

export type NormalizedBox = { left: number; top: number; right: number; bottom: number };

export type LensHit = {
  ids: string[];
  terms: string[];
  categories: Category[];
  wearer: "man" | "woman" | "unknown";
  box: NormalizedBox | null;
  detectedItem: string;
};

function normalizedBox(value: unknown): NormalizedBox | null {
  const values = Array.isArray(value)
    ? value.map(Number)
    : value && typeof value === "object"
      ? [Number((value as Record<string, unknown>).left), Number((value as Record<string, unknown>).top), Number((value as Record<string, unknown>).right), Number((value as Record<string, unknown>).bottom)]
      : [];
  if (values.length < 4 || values.slice(0, 4).some((v) => !Number.isFinite(v))) return null;
  const scale = values.slice(0, 4).some((v) => Math.abs(v) > 1) ? 1000 : 1;
  const [leftRaw, topRaw, rightRaw, bottomRaw] = values.slice(0, 4).map((v) => Math.max(0, Math.min(1, v / scale)));
  if (rightRaw - leftRaw < 0.05 || bottomRaw - topRaw < 0.05) return null;
  return { left: leftRaw, top: topRaw, right: rightRaw, bottom: bottomRaw };
}

export async function lensScan(imageUrl: string, pieces: ClosetPiece[]): Promise<LensHit | null> {
  if (!imageUrl) return null;
  const inventory = pieces
    .slice(0, 50)
    .map(
      (p) =>
        `${p.id} | SALE_ITEM=${p.name} | CATEGORY=${p.category} | COLOR=${p.color} | ${p.material} | ${p.notes}`.slice(
          0,
          180,
        ),
    )
    .join("\n");
  try {
    const photo = await imageData(imageUrl);
    const model = getGenerativeModel(firebaseAi(), { model: "gemini-2.5-flash" });
    const result = await model.generateContent([
      { inlineData: { mimeType: photo.mimeType, data: photo.data } },
      `You power Uvel visual shopping. Analyze this image, whether the garment is worn, on a mannequin, on a hanger, or laid flat. Be strict about matches; an empty result is better than a wrong one.

Find the single most prominent clothing item to highlight. It may be any visible garment, including a dress on a mannequin. Give a tight rectangular bounding box around the garment itself, including its edges/sleeves/hem but excluding the person/mannequin and background where possible. Coordinates are normalized integers from 0 to 1000: [left, top, right, bottom], from the original full image. If no clothing item can be identified, set found=false and bbox=[0,0,1000,1000].

Identify up to three clearly visible garments and the wearer (man, woman, or unknown). Category must be one of: Outerwear, Dresses, Tops, Trousers, Knitwear, Skirts, Shoes, Bags, Accessories. A t-shirt is Tops; jeans/trousers/shorts are Trousers. Match a listing only when the listed item's category and visible colour/silhouette/material are reasonably similar to a garment in the image. Inventory rows describe the item being sold; do not match another garment merely because it appears in the listing photo. Return only exact inventory IDs, never objects. If nothing qualifies, ids must be [].

Return ONLY JSON in this shape: {"found":true,"garment":"short item label","bbox":[100,100,900,900],"wearer":"unknown","garments":[{"category":"Dresses","color":"navy"}],"ids":[]}

Inventory:
${inventory || "(No listed items are available right now.)"}`,
    ]);
    const raw = result.response.text().trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < start) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      ids?: unknown;
      wearer?: string;
      garments?: { category?: string; color?: string; kind?: string }[];
      found?: boolean;
      garment?: string;
      bbox?: unknown;
    };
    const wearer: LensHit["wearer"] =
      parsed.wearer === "man" || parsed.wearer === "woman" ? parsed.wearer : "unknown";
    const garments = parsed.garments ?? [];
    const categories = [
      ...new Set(
        garments
          .map((g) => asCategory(g.category) || asCategory(g.kind))
          .filter((c): c is Category => Boolean(c)),
      ),
    ];
    const detectedCategory = asCategory(garments[0]?.category || garments[0]?.kind);
    const normalizedCategories = detectedCategory && !categories.includes(detectedCategory) ? [...categories, detectedCategory] : categories;
    const rawIds = Array.isArray(parsed.ids)
      ? parsed.ids.map((id) => (typeof id === "string" ? id : "")).filter(Boolean)
      : [];
    const ids = (parsed.found === false ? [] : rawIds).filter((id) => {
      const piece = pieces.find((p) => p.id === id);
      return piece ? pieceFitsLook(piece, { wearer, categories: normalizedCategories }) : false;
    });
    const terms = garments
      .flatMap((g) => [g.category, g.color, g.kind])
      .filter((x): x is string => Boolean(x && x.trim()));
    return {
      ids,
      terms,
      categories: normalizedCategories,
      wearer,
      box: parsed.found === false ? null : normalizedBox(parsed.bbox),
      detectedItem: String(parsed.garment || "").trim().slice(0, 80),
    };
  } catch {
    return null;
  }
}

export async function matchLookImage(imageUrl: string, pieces: ClosetPiece[]): Promise<string[] | null> {
  const hit = await lensScan(imageUrl, pieces);
  return hit ? hit.ids : null;
}
