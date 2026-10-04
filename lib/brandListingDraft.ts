import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import type { Category } from "./catalog";
import type { ShipsTo } from "./ships";

const KEY = "uvel-brand-listing-drafts-v1";
export type BrandListingDraft = {
  id: string;
  brandId: string;
  brandName: string;
  photos: Array<{ uri: string }>;
  clipUri: string;
  name: string;
  sku: string;
  category: Category | null;
  system: string;
  picked: string[];
  sizeStock: Record<string, string>;
  color: string;
  material: string;
  notes: string;
  measurements?: Record<string, string>;
  price: string;
  stockQuantity: string;
  shipsTo: ShipsTo;
  condition: string;
  updatedAt: number;
};
let drafts: BrandListingDraft[] = [];
let loaded = false;
let loading: Promise<BrandListingDraft[]> | null = null;
const listeners = new Set<(items: BrandListingDraft[]) => void>();
function emit() { listeners.forEach((listener) => listener(drafts.slice())); }
async function hydrate() {
  if (loaded) return drafts;
  if (loading) return loading;
  loading = AsyncStorage.getItem(KEY).then((raw) => {
    loaded = true;
    try { drafts = raw ? (JSON.parse(raw) as BrandListingDraft[]).sort((a, b) => b.updatedAt - a.updatedAt) : []; } catch { drafts = []; }
    emit();
    return drafts;
  }).catch(() => { loaded = true; drafts = []; return drafts; });
  try { return await loading; } finally { loading = null; }
}
export async function loadBrandListingDrafts() { return hydrate(); }
export async function saveBrandListingDraft(input: Omit<BrandListingDraft, "updatedAt"> & { updatedAt?: number }) {
  const item = { ...input, updatedAt: Date.now() };
  drafts = [item, ...drafts.filter((draft) => draft.id !== item.id)].sort((a, b) => b.updatedAt - a.updatedAt);
  loaded = true; emit();
  await AsyncStorage.setItem(KEY, JSON.stringify(drafts));
  return item;
}
export async function removeBrandListingDraft(id: string) {
  drafts = drafts.filter((draft) => draft.id !== id); loaded = true; emit(); await AsyncStorage.setItem(KEY, JSON.stringify(drafts));
}
export async function clearBrandListingDraft(id: string) { return removeBrandListingDraft(id); }
export function useBrandListingDrafts(brandId?: string) {
  const [items, setItems] = useState<BrandListingDraft[]>(() => brandId ? drafts.filter((draft) => draft.brandId === brandId) : drafts);
  useEffect(() => { const listener = (next: BrandListingDraft[]) => setItems(brandId ? next.filter((draft) => draft.brandId === brandId) : next); listeners.add(listener); void hydrate().then((next) => setItems(brandId ? next.filter((draft) => draft.brandId === brandId) : next)); return () => { listeners.delete(listener); }; }, [brandId]);
  return items;
}
