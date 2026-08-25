import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import type { Category } from "./catalog";
import type { ShipsTo } from "./ships";

const KEY = "uvel-listing-draft-v1";

type DraftPhoto = { uri: string };

export type ListingDraft = {
  photos: DraftPhoto[];
  name: string;
  brand: string;
  category: Category | null;
  color: string;
  size: string;
  condition: string;
  material: string;
  notes: string;
  price: string;
  was: string;
  shopLook: string;
  shipsTo: ShipsTo;
  origin?: string;
  currency?: string;
  updatedAt: number;
};

let current: ListingDraft | null = null;
let loaded = false;
let loading: Promise<ListingDraft | null> | null = null;
const listeners = new Set<(draft: ListingDraft | null) => void>();

function emit() {
  listeners.forEach((listener) => listener(current));
}

async function hydrate() {
  if (loaded) return current;
  if (loading) return loading;
  loading = AsyncStorage.getItem(KEY)
    .then((raw) => {
      loaded = true;
      if (!raw) return null;
      try {
        current = JSON.parse(raw) as ListingDraft;
      } catch {
        current = null;
      }
      emit();
      return current;
    })
    .catch(() => {
      loaded = true;
      current = null;
      return null;
    });
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

function hasContent(draft: ListingDraft) {
  return draft.photos.length > 0 || Boolean(draft.name || draft.brand || draft.category || draft.color || draft.size || draft.condition || draft.material || draft.notes || draft.price || draft.was);
}

export async function loadListingDraft() {
  return hydrate();
}

export async function saveListingDraft(draft: ListingDraft) {
  if (!hasContent(draft)) return;
  current = { ...draft, updatedAt: Date.now() };
  loaded = true;
  emit();
  await AsyncStorage.multiSet([
    [KEY, JSON.stringify(current)],
    [`${KEY}:notice`, "1"],
  ]);
}

export async function clearListingDraft() {
  current = null;
  loaded = true;
  emit();
  await AsyncStorage.multiRemove([KEY, `${KEY}:notice`]);
}

export async function consumeListingDraftNotice() {
  const draft = await hydrate();
  const pending = await AsyncStorage.getItem(`${KEY}:notice`);
  if (pending !== "1" || !draft) return null;
  await AsyncStorage.removeItem(`${KEY}:notice`);
  return draft;
}

export function draftProgress(draft: ListingDraft) {
  const checks = [
    draft.photos.length > 0,
    Number(draft.price) > 0,
    Boolean(draft.name.trim()),
    Boolean(draft.notes.trim()),
    Boolean(draft.category),
    Boolean(draft.size.trim()),
    Boolean(draft.color.trim()),
    Boolean(draft.material.trim()),
    Boolean(draft.condition),
  ];
  return `${checks.filter(Boolean).length} of ${checks.length} ready`;
}

export function useListingDraft() {
  const [draft, setDraft] = useState<ListingDraft | null>(current);
  const [ready, setReady] = useState(loaded);
  useEffect(() => {
    const listener = (next: ListingDraft | null) => {
      setDraft(next);
      setReady(true);
    };
    listeners.add(listener);
    void hydrate().then((next) => {
      setDraft(next);
      setReady(true);
    });
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return { draft, ready };
}
