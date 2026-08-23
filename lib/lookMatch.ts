import { openaiKey } from "./tryon";
import type { ClosetPiece } from "./wardrobe";
import type { Look } from "./trends";

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
  let n = 0;
  for (const w of needles) if (set.has(w)) n += 3;
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
  return [...pieces].sort((a, b) => {
    const as = scoreListing(a, [], styles) + (a.country === country ? 2 : 0);
    const bs = scoreListing(b, [], styles) + (b.country === country ? 2 : 0);
    return bs - as || b.createdAt - a.createdAt;
  });
}

async function asRemoteImage(uri: string) {
  if (/^https?:/i.test(uri)) return uri;
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

export async function matchLookImage(imageUrl: string, pieces: ClosetPiece[]): Promise<string[] | null> {
  if (!pieces.length) return [];
  const key = openaiKey();
  if (!key || !imageUrl) return null;
  const inventory = pieces
    .slice(0, 40)
    .map((p) => `${p.id} | ${p.name} | ${p.category} | ${p.color} | ${p.material} | ${p.notes}`.slice(0, 160))
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
                text: `This is a fashion look (photo or a frame from a video). Match it to items people are actually selling on Uvel. Only pick pieces that are the same kind of garment, colour, or silhouette. If nothing is close, return {"ids":[]}.\n\nInventory:\n${inventory}\n\nJSON: {"ids":["id"]}`,
              },
              { type: "image_url", image_url: { url: await asRemoteImage(imageUrl), detail: "low" } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw) as { ids?: unknown };
    const ids = Array.isArray(parsed.ids) ? parsed.ids.map(String) : [];
    const have = new Set(pieces.map((p) => p.id));
    return ids.filter((id) => have.has(id));
  } catch {
    return null;
  }
}
