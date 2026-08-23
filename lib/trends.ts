import { useEffect, useState } from "react";
import { TRENDS, type Trend } from "./catalog";
import desk from "../docs/trends.json";
import { liveDesk } from "./desk";
import { prefetchLookVideo } from "./lookFrame";

export type Source = Trend["source"] | "All";
export const SOURCES: Source[] = ["All", "TikTok", "Instagram", "Snapchat"];

export type Look = Trend & {
  id: string;
  imageUrl?: string;
  videoUrl?: string;
  postUrl?: string;
  handle?: string;
  heat?: string;
};

function localImage(id: string) {
  return TRENDS.find((t) => t.slug === id)?.image ?? TRENDS[0].image;
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
        videoUrl: typeof r.videoUrl === "string" ? r.videoUrl : undefined,
        handle: typeof r.handle === "string" ? r.handle : undefined,
        garmentIds,
        shopQuery: String(r.shopQuery || ""),
        heat: typeof r.heat === "string" ? r.heat : `Latest on ${source}`,
      } as Look;
    })
    .filter((x): x is Look => Boolean(x));
}

const URL = "https://raw.githubusercontent.com/allentackie-ops/uvel/main/docs/trends.json";
const bundled = parse(desk);
let cache: Look[] = [];
let updatedAt = "";
let pulling: Promise<Look[]> | null = null;
let primed = false;
let heroId: string | null = null;
let merging = false;
const listeners = new Set<(looks: Look[]) => void>();

function pin(next: Look[]): Look[] {
  const withVid = next.filter((l) => l.videoUrl);
  const pool = withVid.length ? withVid : next;
  if (!heroId || !next.some((l) => l.id === heroId)) {
    heroId = pool[0]?.id ?? next[0]?.id ?? null;
  }
  const hero = next.find((l) => l.id === heroId);
  const rest = next.filter((l) => l.id !== heroId);
  return hero ? [hero, ...rest] : next;
}

function setCache(next: Look[]) {
  if (!next.length) return;
  cache = pin(next);
  updatedAt = new Date().toISOString();
  listeners.forEach((l) => l(cache));
}

export function bundledLooks() {
  return cache;
}

export function hasLooks() {
  return cache.length > 0;
}

async function warmHero(looks: Look[]) {
  for (const look of looks.slice(0, 6)) {
    if (!look.videoUrl) continue;
    const local = await Promise.race([
      prefetchLookVideo(look.videoUrl),
      new Promise<null>((r) => setTimeout(() => r(null), 8000)),
    ]);
    if (local) {
      heroId = look.id;
      setCache(looks);
      const extra = looks.filter((l) => l.id !== look.id && l.videoUrl).slice(0, 2);
      extra.forEach((l) => prefetchLookVideo(l.videoUrl));
      return true;
    }
  }
  return false;
}

export async function pullLooks(opts?: { fresh?: boolean }) {
  if (opts?.fresh) {
    heroId = null;
    primed = false;
  }
  if (primed && cache.length && !opts?.fresh) return cache;
  if (pulling) return pulling;
  pulling = (async () => {
    try {
      const live = await liveDesk((partial) => {
        if (merging) setCache(partial as Look[]);
      });
      if (live.length) {
        await warmHero(live as Look[]);
        if (!cache.length) setCache(live as Look[]);
        merging = true;
        primed = true;
        return cache;
      }
    } catch {
      /* fall through */
    }
    try {
      const res = await fetch(`${URL}?t=${Date.now()}`);
      if (res.ok) {
        const json = (await res.json()) as { updatedAt?: string; looks?: unknown };
        const looks = parse(json);
        if (looks.length) {
          await warmHero(looks);
          if (!cache.length) setCache(looks);
          primed = true;
          merging = true;
          return cache;
        }
      }
    } catch {
      /* keep going */
    }
    if (!cache.length) setCache(bundled);
    await warmHero(cache);
    primed = true;
    merging = true;
    return cache;
  })();
  try {
    return await pulling;
  } finally {
    pulling = null;
  }
}

export function looksUpdated() {
  return updatedAt;
}

export function useLooks() {
  const [looks, setLooks] = useState<Look[]>(cache);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(!cache.length);

  useEffect(() => {
    const l = (next: Look[]) => {
      setLooks(next);
      setLoading(false);
    };
    listeners.add(l);
    if (cache.length) {
      setLooks(cache);
      setLoading(false);
    }
    void pullLooks().finally(() => setLoading(false));
    return () => {
      listeners.delete(l);
    };
  }, []);

  async function refresh() {
    setRefreshing(true);
    merging = false;
    const next = await pullLooks({ fresh: true });
    setLooks(next);
    setRefreshing(false);
  }

  return { looks, refreshing, refresh, loading, stamp: updatedAt };
}

export function lookImage(look: Look) {
  return look.imageUrl ? { uri: look.imageUrl } : look.image;
}
