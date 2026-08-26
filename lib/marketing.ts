import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { ClosetPiece } from "./wardrobe";
import { firebaseAuth, firebaseDb, firebaseFunctions, firebaseReady } from "./firebase";

export type MarketingStatus = "draft" | "scheduled" | "live" | "paused" | "ended";
export type CampaignChannel = "brand_page" | "shop" | "today";
export type PromotionKind = "percentage" | "fixed";

export type BrandCollection = {
  id: string;
  brandId: string;
  name: string;
  description: string;
  productIds: string[];
  coverProductId: string;
  status: MarketingStatus;
  startAt?: number;
  endAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type BrandCampaign = {
  id: string;
  brandId: string;
  name: string;
  headline: string;
  body: string;
  channel: CampaignChannel;
  collectionId?: string;
  promotionId?: string;
  productIds: string[];
  status: MarketingStatus;
  startAt?: number;
  endAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type BrandPromotion = {
  id: string;
  brandId: string;
  code: string;
  kind: PromotionKind;
  value: number;
  currency?: string;
  minimumOrderCents: number;
  usageLimit?: number;
  status: MarketingStatus;
  startAt?: number;
  endAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type MarketingState = {
  collections: BrandCollection[];
  campaigns: BrandCampaign[];
  promotions: BrandPromotion[];
};

const KEY = "uvel-brand-marketing-v1";
let cache: MarketingState = { collections: [], campaigns: [], promotions: [] };
let hydrated = false;
const listeners = new Set<() => void>();
const watches = new Map<string, () => void>();
const liveCampaignCache = new Map<string, BrandCampaign[]>();
const liveWatches = new Map<string, () => void>();
let liveShopCampaignCache: BrandCampaign[] | null = null;
let liveShopWatch: (() => void) | null = null;

function millis(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") return (value as { toMillis: () => number }).toMillis();
  return Date.now();
}

function emit() { listeners.forEach((listener) => listener()); }

async function persist() {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* local marketing cache is best effort */ }
}

function normalizeCollection(data: BrandCollection): BrandCollection {
  return { ...data, productIds: Array.isArray(data.productIds) ? data.productIds : [], createdAt: millis(data.createdAt), updatedAt: millis(data.updatedAt) };
}
function normalizeCampaign(data: BrandCampaign): BrandCampaign {
  return { ...data, channel: data.channel || "brand_page", productIds: Array.isArray(data.productIds) ? data.productIds : [], createdAt: millis(data.createdAt), updatedAt: millis(data.updatedAt) };
}
function normalizePromotion(data: BrandPromotion): BrandPromotion {
  return { ...data, code: String(data.code || "").toUpperCase(), minimumOrderCents: Math.max(0, Number(data.minimumOrderCents) || 0), createdAt: millis(data.createdAt), updatedAt: millis(data.updatedAt) };
}

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as MarketingState;
      cache = { collections: (saved.collections || []).map(normalizeCollection), campaigns: (saved.campaigns || []).map(normalizeCampaign), promotions: (saved.promotions || []).map(normalizePromotion) };
    }
  } catch { cache = { collections: [], campaigns: [], promotions: [] }; }
  emit();
}
void hydrate();

function mergeBrand<T extends { id: string; brandId: string }>(items: T[], brandId: string, remote: T[]) {
  const local = items.filter((item) => item.brandId !== brandId);
  return [...local, ...remote.filter((item) => item.brandId === brandId)];
}

export function watchBrandMarketing(brandId: string) {
  if (!brandId || watches.has(brandId) || !firebaseReady() || !firebaseAuth().currentUser) return () => undefined;
  const stops = [
    ["brandCollections", (data: Record<string, unknown>, id: string) => normalizeCollection({ ...(data as unknown as BrandCollection), id } as BrandCollection), "collections"],
    ["brandCampaigns", (data: Record<string, unknown>, id: string) => normalizeCampaign({ ...(data as unknown as BrandCampaign), id } as BrandCampaign), "campaigns"],
    ["brandPromotions", (data: Record<string, unknown>, id: string) => normalizePromotion({ ...(data as unknown as BrandPromotion), id } as BrandPromotion), "promotions"],
  ].map(([path, normalize, key]) => onSnapshot(query(collection(firebaseDb(), path as string), where("brandId", "==", brandId)), (snap) => {
    const remote = snap.docs.map((item) => (normalize as (data: Record<string, unknown>, id: string) => unknown)(item.data(), item.id));
    cache = { ...cache, [key as string]: mergeBrand((cache[key as keyof MarketingState] || []) as Array<{ id: string; brandId: string }>, brandId, remote as Array<{ id: string; brandId: string }>) } as MarketingState;
    void persist();
    emit();
  }, () => undefined));
  const stop = () => stops.forEach((unsubscribe) => unsubscribe());
  watches.set(brandId, stop);
  return () => { watches.delete(brandId); stop(); };
}

export function watchLiveBrandCampaigns(brandId: string) {
  if (!brandId || liveWatches.has(brandId) || !firebaseReady()) return () => undefined;
  const unsubscribe = onSnapshot(query(collection(firebaseDb(), "brandCampaigns"), where("brandId", "==", brandId), where("status", "==", "live")), (snap) => {
    liveCampaignCache.set(brandId, snap.docs.map((item) => normalizeCampaign({ ...(item.data() as unknown as BrandCampaign), id: item.id })));
    emit();
  }, () => undefined);
  const stop = () => { unsubscribe(); liveCampaignCache.delete(brandId); };
  liveWatches.set(brandId, stop);
  return () => { liveWatches.delete(brandId); stop(); };
}

export function useLiveCampaigns(brandId: string) {
  const [, setTick] = useState(0);
  useEffect(() => { const listener = () => setTick((value) => value + 1); listeners.add(listener); const stop = watchLiveBrandCampaigns(brandId); return () => { listeners.delete(listener); stop(); }; }, [brandId]);
  const local = cache.campaigns.filter((item) => item.brandId === brandId && item.status === "live");
  return liveCampaignCache.get(brandId) || local;
}

export function watchLiveShopCampaigns() {
  if (liveShopWatch || !firebaseReady()) return () => undefined;
  const unsubscribe = onSnapshot(query(collection(firebaseDb(), "brandCampaigns"), where("status", "==", "live")), (snap) => {
    liveShopCampaignCache = snap.docs.map((item) => normalizeCampaign({ ...(item.data() as unknown as BrandCampaign), id: item.id }));
    emit();
  }, () => { liveShopCampaignCache = []; emit(); });
  const stop = () => { unsubscribe(); liveShopCampaignCache = null; liveShopWatch = null; };
  liveShopWatch = stop;
  return () => { if (liveShopWatch === stop) stop(); };
}

export function useLiveShopCampaigns() {
  const [, setTick] = useState(0);
  useEffect(() => { const listener = () => setTick((value) => value + 1); listeners.add(listener); const stop = watchLiveShopCampaigns(); return () => { listeners.delete(listener); stop(); }; }, []);
  const local = cache.campaigns.filter((item) => item.status === "live");
  return liveShopCampaignCache || local;
}

export function useMarketing(brandId: string): MarketingState {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    const stop = watchBrandMarketing(brandId);
    return () => { listeners.delete(listener); stop(); };
  }, [brandId]);
  return {
    collections: cache.collections.filter((item) => item.brandId === brandId).sort((a, b) => b.updatedAt - a.updatedAt),
    campaigns: cache.campaigns.filter((item) => item.brandId === brandId).sort((a, b) => b.updatedAt - a.updatedAt),
    promotions: cache.promotions.filter((item) => item.brandId === brandId).sort((a, b) => b.updatedAt - a.updatedAt),
  };
}

function idFor(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }

async function saveRemote(functionName: string, payload: object) {
  if (!firebaseReady() || !firebaseAuth().currentUser) return;
  await httpsCallable(firebaseFunctions(), functionName)(payload);
}

export async function saveBrandCollection(input: Omit<BrandCollection, "id" | "createdAt" | "updatedAt"> & { id?: string; startAt?: number; endAt?: number }) {
  if (!input.brandId || !input.name.trim() || !input.productIds.length) throw new Error("Add a name and at least one product to the collection.");
  const now = Date.now();
  const existing = cache.collections.find((item) => item.id === input.id);
  const item: BrandCollection = normalizeCollection({ ...input, id: input.id || idFor("collection"), name: input.name.trim(), description: input.description.trim(), createdAt: existing?.createdAt || now, updatedAt: now });
  await saveRemote("saveBrandCollection", item);
  cache = { ...cache, collections: [item, ...cache.collections.filter((row) => row.id !== item.id)] };
  await persist(); emit(); return item;
}

export async function saveBrandCampaign(input: Omit<BrandCampaign, "id" | "createdAt" | "updatedAt"> & { id?: string; startAt?: number; endAt?: number }) {
  if (!input.brandId || !input.name.trim() || !input.headline.trim() || !input.productIds.length) throw new Error("Add a campaign name, headline, and at least one product.");
  const now = Date.now();
  const existing = cache.campaigns.find((item) => item.id === input.id);
  const item: BrandCampaign = normalizeCampaign({ ...input, id: input.id || idFor("campaign"), name: input.name.trim(), headline: input.headline.trim(), body: input.body.trim(), createdAt: existing?.createdAt || now, updatedAt: now });
  await saveRemote("saveBrandCampaign", item);
  cache = { ...cache, campaigns: [item, ...cache.campaigns.filter((row) => row.id !== item.id)] };
  await persist(); emit(); return item;
}

export async function saveBrandPromotion(input: Omit<BrandPromotion, "id" | "createdAt" | "updatedAt"> & { id?: string; startAt?: number; endAt?: number }) {
  const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (!input.brandId || code.length < 3 || !Number.isFinite(input.value) || input.value <= 0) throw new Error("Add a valid promotion code and value.");
  if (input.kind === "percentage" && input.value > 100) throw new Error("Percentage promotions cannot exceed 100%.");
  const now = Date.now();
  const existing = cache.promotions.find((item) => item.id === input.id);
  const item: BrandPromotion = normalizePromotion({ ...input, id: input.id || idFor("promotion"), code, createdAt: existing?.createdAt || now, updatedAt: now });
  await saveRemote("saveBrandPromotion", item);
  cache = { ...cache, promotions: [item, ...cache.promotions.filter((row) => row.id !== item.id)] };
  await persist(); emit(); return item;
}

export function productsForCollection(collectionItem: BrandCollection, products: ClosetPiece[]) {
  const byId = new Map(products.filter((piece) => piece.brandId === collectionItem.brandId).map((piece) => [piece.id, piece]));
  return collectionItem.productIds.map((id) => byId.get(id)).filter((piece): piece is ClosetPiece => Boolean(piece));
}
