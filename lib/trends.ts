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
const listeners = new Set<(looks: Look[]) => void>();

function setCache(next: Look[]) {
  if (!next.length) return;
  cache = next;
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
  const vids = looks.map((l) => l.videoUrl).filter((u): u is string => Boolean(u)).slice(0, 3);
  if (!vids.length) return;
  await Promise.race([
    Promise.all(vids.map((u) => prefetchLookVideo(u))),
    new Promise((r) => setTimeout(r, 2800)),
  ]);
}

export async function pullLooks() {
  if (pulling) return pulling;
  pulling = (async () => {
    try {
      const live = await liveDesk((partial) => setCache(partial as Look[]));
      if (live.length) {
        setCache(live as Look[]);
        await warmHero(cache);
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
          setCache(looks);
          await warmHero(cache);
          return cache;
        }
      }
    } catch {
      /* keep going */
    }
    if (!cache.length) setCache(bundled);
    await warmHero(cache);
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
    const next = await pullLooks();
    setLooks(next);
    setRefreshing(false);
  }

  return { looks, refreshing, refresh, loading, stamp: updatedAt };
}

export function lookImage(look: Look) {
  return look.imageUrl ? { uri: look.imageUrl } : look.image;
}