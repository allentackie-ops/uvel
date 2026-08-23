import { useEffect, useState } from "react";
import { TRENDS, type Trend } from "./catalog";
import desk from "../docs/trends.json";

export type Source = Trend["source"] | "All";
export const SOURCES: Source[] = ["All", "TikTok", "Instagram", "Snapchat", "X"];

export type Look = Trend & {
  id: string;
  imageUrl?: string;
  postUrl?: string;
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
        garmentIds,
        shopQuery: String(r.shopQuery || ""),
        heat: typeof r.heat === "string" ? r.heat : `Latest on ${source}`,
      } as Look;
    })
    .filter((x): x is Look => Boolean(x));
}

const URL = "https://raw.githubusercontent.com/allentackie-ops/uvel/main/docs/trends.json";
let cache: Look[] = parse(desk);
let updatedAt = typeof (desk as { updatedAt?: string }).updatedAt === "string" ? (desk as { updatedAt: string }).updatedAt : "";

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
