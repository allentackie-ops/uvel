import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { TRENDS, type Trend } from "./catalog";
import desk from "../docs/trends.json";
import { liveDesk } from "./desk";
import { prefetchLookVideo } from "./lookFrame";
import { dnaFrom, rankLooks } from "./styleDna";
import { snapshot } from "./store";
import { aiGeneratedFromUnknown } from "./contentLabels";

export type Source = Trend["source"] | "All";
export const SOURCES: Source[] = ["All", "TikTok", "Instagram", "Snapchat"];

export type Look = Trend & {
  id: string;
  imageUrl?: string;
  videoUrl?: string;
  postUrl?: string;
  handle?: string;
  heat?: string;
  aiGenerated?: boolean;
};

const LOOKS_KEY = "uvel-looks-v1";

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
        aiGenerated: aiGeneratedFromUnknown(r) || undefined,
      } as Look;
    })
    .filter((x): x is Look => Boolean(x));
}

const URL = "https://raw.githubusercontent.com/allentackie-ops/uvel/main/docs/trends.json";
const bundled = parse(desk);
let cache: Look[] = bundled;
let updatedAt = "";
let pulling: Promise<Look[]> | null = null;
let primed = false;
let heroId: string | null = null;
let heroTurn = 0;
let merging = false;
const listeners = new Set<(looks: Look[]) => void>();

const HERO_SOURCES: Exclude<Source, "All">[] = ["Instagram", "TikTok", "Snapchat"];

function balanceSources(next: Look[]): Look[] {
  const order: Exclude<Source, "All">[] = ["TikTok", "Instagram", "Snapchat", "X"];
  const groups = new Map<Exclude<Source, "All">, Look[]>();
  for (const source of order) groups.set(source, next.filter((look) => look.source === source));
  const out: Look[] = [];
  for (let i = 0; out.length < next.length; i += 1) {
    let added = false;
    for (const source of order) {
      const row = groups.get(source)?.[i];
      if (!row) continue;
      out.push(row);
      added = true;
    }
    if (!added) break;
  }
  return out;
}

function pin(next: Look[]): Look[] {
  const withVid = next.filter((l) => l.videoUrl);
  const pool = withVid.length ? withVid : next;
  if (!heroId || !next.some((l) => l.id === heroId)) {
    const preferred = HERO_SOURCES[heroTurn % HERO_SOURCES.length];
    heroId = pool.find((l) => l.source === preferred)?.id ?? pool[0]?.id ?? next[0]?.id ?? null;
  }
  const hero = next.find((l) => l.id === heroId);
  const rest = next.filter((l) => l.id !== heroId);
  return hero ? [hero, ...rest] : next;
}

function serialize(looks: Look[]) {
  return looks.map((l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    source: l.source,
    summary: l.summary,
    imageUrl: l.imageUrl,
    videoUrl: l.videoUrl,
    postUrl: l.postUrl,
    handle: l.handle,
    garmentIds: l.garmentIds,
    shopQuery: l.shopQuery,
    heat: l.heat,
    aiGenerated: l.aiGenerated,
  }));
}

function setCache(next: Look[]) {
  if (!next.length) return;
  cache = pin(balanceSources(rankLooks(next, dnaFrom(snapshot()))));
  updatedAt = new Date().toISOString();
  listeners.forEach((l) => l(cache));
  void AsyncStorage.setItem(LOOKS_KEY, JSON.stringify({ looks: serialize(cache) })).catch(() => undefined);
}

void AsyncStorage.getItem(LOOKS_KEY)
  .then((raw) => {
    if (!raw || primed) return;
    const looks = parse(JSON.parse(raw));
    if (looks.length) setCache(looks);
  })
  .catch(() => undefined);

export function bundledLooks() {
  return cache;
}

export function hasLooks() {
  return cache.length > 0;
}

function warmHero(looks: Look[]) {
  looks
    .filter((l) => l.videoUrl)
    .slice(0, 3)
    .forEach((l) => {
      void prefetchLookVideo(l.videoUrl);
    });
}

export async function pullLooks(opts?: { fresh?: boolean }) {
  if (opts?.fresh) {
    heroId = null;
    heroTurn = (heroTurn + 1) % HERO_SOURCES.length;
    primed = false;
  }
  if (primed && cache.length && !opts?.fresh) return cache;
  if (pulling) return pulling;
  pulling = (async () => {
    try {
      const live = await liveDesk((partial) => {
        if (merging) setCache(partial as Look[]);
        else if (partial.length) {
          setCache(partial as Look[]);
          warmHero(partial as Look[]);
        }
      }, dnaFrom(snapshot()));
      if (live.length) {
        setCache(live as Look[]);
        warmHero(live as Look[]);
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
          setCache(looks);
          warmHero(looks);
          primed = true;
          merging = true;
          return cache;
        }
      }
    } catch {
      /* keep going */
    }
    if (!cache.length) setCache(bundled);
    warmHero(cache);
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
