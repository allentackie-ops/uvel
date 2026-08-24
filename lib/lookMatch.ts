import { openaiKey } from "./tryon";
import type { Category } from "./catalog";
import type { ClosetPiece } from "./wardrobe";
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
) {
  const needles = bag([look.shopQuery, look.title, look.summary].join(" "));
  return [...pieces]
    .map((p) => ({ p, s: scoreListing(p, needles, styles) }))
    .sort((a, b) => b.s - a.s || b.p.createdAt - a.p.createdAt)
    .map((x) => x.p);
}

export function forYou(pieces: ClosetPiece[], styles: string[], country: string) {
  return [...pieces]
    .filter((p) => listingVisibleIn({ origin: p.country, shipsTo: p.shipsTo, buyer: country }))
    .sort((a, b) => {
      const as = scoreListing(a, [], styles) + (a.country === country ? 2 : 0);
      const bs = scoreListing(b, [], styles) + (b.country === country ? 2 : 0);
      return bs - as || b.createdAt - a.createdAt;
    });
}

async function asRemoteImage(uri: string) {
  if (/^https?:/i.test(uri) || uri.startsWith("data:")) return uri;
  const res = await fetch(uri);
  if (!res.ok) throw new Error("photo");
  const bytes = new Uint8Array(await res.arrayBuffer());
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
  return `data:image/jpeg;base64,${out}`;
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
  const t = `${piece.name} ${piece.notes} ${piece.category}`.toLowerCase();
  if (
    /(bodysuit|corset|blouse|dress|skirt|heel|cami|bralette|gown|women|ladies|crop top|sleeveless bodysuit)/.test(t)
  ) {
    return "women";
  }
  if (/\b(men'?s|menswear|male)\b/.test(t)) return "men";
  return "unisex";
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

export type LensHit = {
  ids: string[];
  terms: string[];
  categories: Category[];
  wearer: "man" | "woman" | "unknown";
};

export async function lensScan(imageUrl: string, pieces: ClosetPiece[]): Promise<LensHit | null> {
  const empty: LensHit = { ids: [], terms: [], categories: [], wearer: "unknown" };
  if (!pieces.length) return empty;
  const key = openaiKey();
  if (!key || !imageUrl) return null;
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
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You match clothes for a resale app. Be strict. Empty is better than wrong.

1. Look at the person in this frozen frame. wearer = "man" or "woman" or "unknown".
2. List only garments ON THEIR BODY. category must be one of: Outerwear, Dresses, Tops, Trousers, Knitwear, Skirts, Shoes, Bags, Accessories.
   A t-shirt is Tops. Jeans/trousers/shorts are Trousers. A dress is Dresses. Never mix these.
3. Inventory rows are what the seller is SELLING (SALE_ITEM + CATEGORY). Ignore other clothes that happen to appear in a listing photo. A Tops listing is not trousers just because jeans are in the photo.
4. Match a listing only if ALL of these are true:
   - same category as a garment on the person
   - gender-right (men's tee ≠ women's bodysuit/corset/blouse/dress; women's top ≠ men's oxford)
   - similar colour and silhouette
5. If nothing qualifies, ids must be []. ids must be exact inventory ids like tee-m, never objects.

A black graphic tee matches another dark graphic/print tee. The print text does not need to be the same band. A cream men's tee matches a cream men's tee, not a women's bodysuit.

Examples:
- Man in a cream tee and beige trousers. Women's white corset bodysuit → not a match.
- Shirtless man in jeans. Looking for trousers. A bodysuit listing whose photo also has jeans → not a match. Only a Trousers listing of similar jeans.

JSON:
{"wearer":"man","garments":[{"category":"Tops","color":"cream"},{"category":"Trousers","color":"beige"}],"ids":[]}

Inventory:
${inventory}`,
              },
              { type: "image_url", image_url: { url: await asRemoteImage(imageUrl), detail: "high" } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw) as {
      ids?: unknown;
      wearer?: string;
      garments?: { category?: string; color?: string; kind?: string }[];
    };
    const wearer: LensHit["wearer"] =
      parsed.wearer === "man" || parsed.wearer === "woman" ? parsed.wearer : "unknown";
    const categories = [
      ...new Set(
        (parsed.garments ?? [])
          .map((g) => asCategory(g.category) || asCategory(g.kind))
          .filter((c): c is Category => Boolean(c)),
      ),
    ];
    const have = new Set(pieces.map((p) => p.id));
    const rawIds = Array.isArray(parsed.ids)
      ? parsed.ids.map((id) => (typeof id === "string" ? id : "")).filter(Boolean)
      : [];
    const ids = rawIds.filter((id) => {
      const piece = pieces.find((p) => p.id === id);
      return piece ? pieceFitsLook(piece, { wearer, categories }) : false;
    });
    const terms = (parsed.garments ?? [])
      .flatMap((g) => [g.category, g.color, g.kind])
      .filter((x): x is string => Boolean(x && x.trim()));
    return { ids, terms, categories, wearer };
  } catch {
    return null;
  }
}

export async function matchLookImage(imageUrl: string, pieces: ClosetPiece[]): Promise<string[] | null> {
  const hit = await lensScan(imageUrl, pieces);
  return hit ? hit.ids : null;
}
