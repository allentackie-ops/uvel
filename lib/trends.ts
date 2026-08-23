import { useEffect, useState } from "react";
import { TRENDS, type Trend } from "./catalog";

export type Source = Trend["source"] | "All";
export const SOURCES: Source[] = ["All", "TikTok", "Instagram", "Snapchat", "X"];

export type Look = Trend & {
  id: string;
  imageUrl?: string;
  postUrl?: string;
  heat?: string;
};

const SEED: Look[] = TRENDS.map((t) => ({
  ...t,
  id: t.slug,
  heat: t.source === "TikTok" ? "Today on TikTok" : `Latest on ${t.source}`,
}));

const EXTRA: Look[] = [
  {
    id: "layered-max",
    slug: "layered-max",
    title: "More is more, on purpose",
    source: "TikTok",
    summary: "Multi-layered tops and culottes. The 90s styling hack is the feed again.",
    image: TRENDS[0].image,
    garmentIds: ["oxford-shirt", "poet-blouse", "wide-trousers"],
    shopQuery: "layered blouse",
    heat: "Rising · TikTok",
    postUrl: "https://www.whowhatwear.com/fashion/trends/tiktok-fashion-trends-2026",
  },
  {
    id: "boho-26",
    slug: "boho-26",
    title: "Boho, not Coachella",
    source: "TikTok",
    summary: "Soft volume, a poet blouse, a bag that looks found. 2026 boho is quieter.",
    image: TRENDS[3].image,
    garmentIds: ["poet-blouse", "satin-skirt", "silk-slip"],
    shopQuery: "poet blouse",
    heat: "TikTok · summer 26",
  },
  {
    id: "napoleon",
    slug: "napoleon",
    title: "Shoulder, then fringe",
    source: "Instagram",
    summary: "Napoleon jackets and a strong shoulder. One dramatic layer over something plain.",
    image: TRENDS[2].image,
    garmentIds: ["leather-trench", "wool-blazer", "herringbone-coat"],
    shopQuery: "blazer trench",
    heat: "Instagram · editorial",
    postUrl: "https://www.instagram.com/explore/tags/napoleonjacket/",
  },
  {
    id: "sunday-fit",
    slug: "sunday-fit",
    title: "Sunday fit, posted",
    source: "X",
    summary: "X is just people in clothes they actually wore. Knit, oxford, loafers.",
    image: TRENDS[0].image,
    garmentIds: ["cashmere-crew", "oxford-shirt", "loafer"],
    shopQuery: "oxford loafers",
    heat: "X · this morning",
    postUrl: "https://x.com/search?q=sunday%20outfit&src=typed_query&f=live",
  },
];

const FALLBACK: Look[] = [...SEED, ...EXTRA];
const URL = "https://raw.githubusercontent.com/allentackie-ops/uvel/main/docs/trends.json";

function localImage(id: string) {
  return FALLBACK.find((l) => l.id === id || l.slug === id)?.image ?? TRENDS[0].image;
}

function parse(raw: unknown): Look[] {
  if (!raw || typeof raw !== "object") return [];
  const looks = (raw as { looks?: unknown }).looks;
  if (!Array.isArray(looks)) return [];
  return looks
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const source = r.source;
      if (source !== "TikTok" && source !== "Instagram" && source !== "X" && source !== "Snapchat") return null;
      const id = String(r.id || r.slug || "");
      if (!id) return null;
      const garmentIds = Array.isArray(r.garmentIds) ? r.garmentIds.map(String) : [];
      return {
        id,
        slug: String(r.slug || id),
        title: String(r.title || "Today’s look"),
        source,
        summary: String(r.summary || ""),
        image: localImage(id),
        imageUrl: typeof r.imageUrl === "string" ? r.imageUrl : undefined,
        postUrl: typeof r.postUrl === "string" ? r.postUrl : undefined,
        garmentIds,
        shopQuery: String(r.shopQuery || ""),
        heat: typeof r.heat === "string" ? r.heat : `Latest on ${source}`,
      } as Look;
    })
    .filter((x): x is Look => Boolean(x));
}

let cache: Look[] = FALLBACK;
let updatedAt = "";

export function bundledLooks() {
  return cache;
}

export async function pullLooks() {
  try {
    const res = await fetch(`${URL}?t=${Date.now()}`);
    if (!res.ok) return cache;
    const json = (await res.json()) as { updatedAt?: string; looks?: unknown };
    const looks = parse(json);
    if (looks.length) {
      cache = looks;
      updatedAt = json.updatedAt || new Date().toISOString();
    }
  } catch {
    /* keep seed */
  }
  return cache;
}

export function looksUpdated() {
  return updatedAt;
}

export function useLooks() {
  const [looks, setLooks] = useState<Look[]>(cache);
  const [refreshing, setRefreshing] = useState(false);
  const [stamp, setStamp] = useState(updatedAt);

  useEffect(() => {
    void pullLooks().then((next) => {
      setLooks(next);
      setStamp(looksUpdated());
    });
  }, []);

  async function refresh() {
    setRefreshing(true);
    const next = await pullLooks();
    setLooks(next);
    setStamp(looksUpdated());
    setRefreshing(false);
  }

  return { looks, refreshing, refresh, stamp };
}

export function lookImage(look: Look) {
  return look.imageUrl ? { uri: look.imageUrl } : look.image;
}
