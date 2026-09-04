import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import type { Look } from "./trends";

const KEY = "uvel-saved-looks-v1";

export type SavedLook = Pick<Look, "id" | "slug" | "title" | "source" | "summary" | "imageUrl" | "postUrl" | "handle" | "shopQuery" | "garmentIds" | "heat" | "aiGenerated" | "country"> & {
  savedAt: number;
};

let saved: SavedLook[] = [];
let loaded = false;
let loading: Promise<SavedLook[]> | null = null;
const listeners = new Set<(next: SavedLook[]) => void>();

function emit() {
  listeners.forEach((listener) => listener(saved));
}

function toSavedLook(look: Look): SavedLook {
  return {
    id: look.id,
    slug: look.slug,
    title: look.title,
    source: look.source,
    summary: look.summary,
    imageUrl: look.imageUrl,
    postUrl: look.postUrl,
    handle: look.handle,
    shopQuery: look.shopQuery,
    garmentIds: look.garmentIds,
    heat: look.heat,
    aiGenerated: look.aiGenerated,
    country: look.country,
    savedAt: Date.now(),
  };
}

async function hydrate() {
  if (loaded) return saved;
  if (loading) return loading;
  loading = AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string") as SavedLook[] : [];
      } catch {
        return [];
      }
    })
    .catch(() => [])
    .then((next) => {
      saved = next.sort((a, b) => b.savedAt - a.savedAt);
      loaded = true;
      emit();
      return saved;
    });
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

function persist() {
  void AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => undefined);
}

export function isLookSaved(id: string) {
  return saved.some((look) => look.id === id);
}

export async function toggleSavedLook(look: Look) {
  await hydrate();
  if (isLookSaved(look.id)) saved = saved.filter((item) => item.id !== look.id);
  else saved = [toSavedLook(look), ...saved].slice(0, 100);
  emit();
  persist();
  return isLookSaved(look.id);
}

export function useSavedLooks() {
  const [looks, setLooks] = useState<SavedLook[]>(saved);
  useEffect(() => {
    const listener = (next: SavedLook[]) => setLooks([...next]);
    listeners.add(listener);
    void hydrate().then((next) => setLooks([...next]));
    return () => listeners.delete(listener);
  }, []);
  return looks;
}

export function savedLookImage(look: SavedLook) {
  return look.imageUrl ? { uri: look.imageUrl } : undefined;
}
