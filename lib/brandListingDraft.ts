import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import type { Category } from "./catalog";
import { firebaseAuth, firebaseReady } from "./firebase";
import { getSupabase } from "./supabase";
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
const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();
function emit() { listeners.forEach((listener) => listener(drafts.slice())); }
function sort(items: BrandListingDraft[]) { return items.sort((a, b) => b.updatedAt - a.updatedAt); }
async function localSave() {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(drafts)); } catch { /* Keep the in-memory draft available for this session. */ }
}
async function supabaseDraftCall<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    if (!firebaseReady()) return null;
    const user = firebaseAuth().currentUser;
    if (!user) return null;
    const supabase = getSupabase();
    if (!supabase) return null;
    const token = await user.getIdToken();
    const { data, error } = await supabase.functions.invoke("brand-listing-drafts", {
      body,
      headers: { "x-firebase-id-token": token },
    });
    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));
    return data as T;
  } catch {
    // Local drafts remain usable if Supabase is offline or not configured in this build.
    return null;
  }
}
async function pushDraft(draft: BrandListingDraft) {
  await supabaseDraftCall({ action: "save", draft });
}
function scheduleRemoteSave(draft: BrandListingDraft) {
  const previous = pendingSaves.get(draft.id);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => {
    pendingSaves.delete(draft.id);
    const latest = drafts.find((item) => item.id === draft.id);
    if (latest) void pushDraft(latest);
  }, 800);
  pendingSaves.set(draft.id, timer);
}
async function synchronizeFromSupabase() {
  const result = await supabaseDraftCall<{ drafts?: BrandListingDraft[] }>({ action: "list" });
  if (!result?.drafts) return;
  const merged = new Map(drafts.map((draft) => [draft.id, draft]));
  for (const remote of result.drafts) {
    if (!remote?.id || !remote.brandId) continue;
    const local = merged.get(remote.id);
    if (!local || Number(remote.updatedAt) > Number(local.updatedAt)) merged.set(remote.id, remote);
  }
  drafts = sort(Array.from(merged.values()));
  emit();
  await localSave();
  const remoteById = new Map(result.drafts.map((draft) => [draft.id, draft]));
  const missingOrNewer = drafts.filter((draft) => !remoteById.has(draft.id) || draft.updatedAt > Number(remoteById.get(draft.id)?.updatedAt || 0));
  await Promise.all(missingOrNewer.map(pushDraft));
}
async function hydrate() {
  if (loaded) return drafts;
  if (loading) return loading;
  loading = (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      loaded = true;
      try { drafts = raw ? sort(JSON.parse(raw) as BrandListingDraft[]) : []; } catch { drafts = []; }
      emit();
      await synchronizeFromSupabase();
      return drafts;
    } catch {
      loaded = true;
      drafts = [];
      return drafts;
    }
  })();
  try { return await loading; } finally { loading = null; }
}
export async function loadBrandListingDrafts() { return hydrate(); }
export async function saveBrandListingDraft(input: Omit<BrandListingDraft, "updatedAt"> & { updatedAt?: number }) {
  const item = { ...input, updatedAt: Date.now() };
  drafts = sort([item, ...drafts.filter((draft) => draft.id !== item.id)]);
  loaded = true;
  emit();
  await localSave();
  scheduleRemoteSave(item);
  return item;
}
export async function removeBrandListingDraft(id: string) {
  const timer = pendingSaves.get(id);
  if (timer) clearTimeout(timer);
  pendingSaves.delete(id);
  drafts = drafts.filter((draft) => draft.id !== id);
  loaded = true;
  emit();
  await localSave();
  await supabaseDraftCall({ action: "delete", id });
}
export async function clearBrandListingDraft(id: string) { return removeBrandListingDraft(id); }
export function brandListingDraftProgress(draft: Pick<BrandListingDraft, "photos" | "name" | "price" | "notes" | "category" | "picked" | "color" | "material">) {
  const checks = [draft.photos.length > 0, Boolean(draft.name.trim()), Number(draft.price) > 0, Boolean(draft.notes.trim()), Boolean(draft.category), draft.picked.length > 0, Boolean(draft.color.trim()), Boolean(draft.material.trim())];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
export function useBrandListingDrafts(brandId?: string) {
  const [items, setItems] = useState<BrandListingDraft[]>(() => brandId ? drafts.filter((draft) => draft.brandId === brandId) : drafts);
  useEffect(() => { const listener = (next: BrandListingDraft[]) => setItems(brandId ? next.filter((draft) => draft.brandId === brandId) : next); listeners.add(listener); void hydrate().then((next) => setItems(brandId ? next.filter((draft) => draft.brandId === brandId) : next)); return () => { listeners.delete(listener); }; }, [brandId]);
  return items;
}
