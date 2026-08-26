import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firebaseAuth, firebaseDb, firebaseFunctions, firebaseReady } from "./firebase";

export type AttributionEventType = "impression" | "engagement" | "checkout_started" | "purchase";

export type CampaignAttribution = {
  id: string;
  brandId: string;
  campaignId: string;
  collectionId?: string;
  promotionId?: string;
  impressions: number;
  engagements: number;
  checkoutStarted: number;
  purchases: number;
  revenueCents: number;
  currency: string;
  updatedAt: number;
};

export type AttributionEventInput = {
  brandId: string;
  campaignId: string;
  collectionId?: string;
  promotionId?: string;
  channel?: "brand_page" | "shop" | "today";
  type: AttributionEventType;
  listingId?: string;
  orderId?: string;
  valueCents?: number;
  currency?: string;
  eventId?: string;
};

const KEY = "uvel-campaign-attribution-v1";
let cache: CampaignAttribution[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
const watches = new Map<string, () => void>();
const remoteCache = new Map<string, CampaignAttribution[]>();

function emit() { listeners.forEach((listener) => listener()); }
function millis(value: unknown) { if (typeof value === "number") return value; if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") return (value as { toMillis: () => number }).toMillis(); return Date.now(); }
function summaryId(brandId: string, campaignId: string) { return `${brandId}__${campaignId}`; }
function normalize(data: CampaignAttribution): CampaignAttribution { return { ...data, impressions: Math.max(0, Number(data.impressions) || 0), engagements: Math.max(0, Number(data.engagements) || 0), checkoutStarted: Math.max(0, Number(data.checkoutStarted) || 0), purchases: Math.max(0, Number(data.purchases) || 0), revenueCents: Math.max(0, Number(data.revenueCents) || 0), updatedAt: millis(data.updatedAt) }; }

async function persist() { try { await AsyncStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* best effort */ } }
async function hydrate() { if (hydrated) return; hydrated = true; try { const raw = await AsyncStorage.getItem(KEY); cache = raw ? (JSON.parse(raw) as CampaignAttribution[]).map(normalize) : []; } catch { cache = []; } emit(); }
void hydrate();

function applyLocal(input: AttributionEventInput) {
  const id = summaryId(input.brandId, input.campaignId);
  const current = cache.find((item) => item.id === id) || { id, brandId: input.brandId, campaignId: input.campaignId, collectionId: input.collectionId, promotionId: input.promotionId, impressions: 0, engagements: 0, checkoutStarted: 0, purchases: 0, revenueCents: 0, currency: input.currency || "USD", updatedAt: Date.now() };
  const next = { ...current, collectionId: input.collectionId || current.collectionId, promotionId: input.promotionId || current.promotionId, currency: input.currency || current.currency, updatedAt: Date.now() };
  if (input.type === "impression") next.impressions += 1;
  if (input.type === "engagement") next.engagements += 1;
  if (input.type === "checkout_started") next.checkoutStarted += 1;
  if (input.type === "purchase") { next.purchases += 1; next.revenueCents += Math.max(0, Number(input.valueCents) || 0); }
  cache = [next, ...cache.filter((item) => item.id !== id)];
  void persist(); emit();
}

export function watchBrandAttribution(brandId: string) {
  if (!brandId || watches.has(brandId) || !firebaseReady() || !firebaseAuth().currentUser) return () => undefined;
  const unsubscribe = onSnapshot(query(collection(firebaseDb(), "brandCampaignAttribution"), where("brandId", "==", brandId)), (snap) => {
    const remote = snap.docs.map((doc) => normalize({ ...(doc.data() as CampaignAttribution), id: doc.id }));
    remoteCache.set(brandId, remote);
    cache = [...cache.filter((item) => item.brandId !== brandId), ...remote];
    void persist(); emit();
  }, () => { remoteCache.set(brandId, []); emit(); });
  const stop = () => { unsubscribe(); remoteCache.delete(brandId); }; watches.set(brandId, stop);
  return () => { watches.delete(brandId); stop(); };
}

export function useCampaignAttribution(brandId: string) {
  const [, setTick] = useState(0);
  useEffect(() => { const listener = () => setTick((value) => value + 1); listeners.add(listener); const stop = watchBrandAttribution(brandId); return () => { listeners.delete(listener); stop(); }; }, [brandId]);
  return (remoteCache.get(brandId) || []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function recordCampaignAttribution(input: AttributionEventInput) {
  if (!input.brandId || !input.campaignId || input.type === "purchase") return;
  applyLocal(input);
  if (!firebaseReady() || !firebaseAuth().currentUser) return;
  await httpsCallable(firebaseFunctions(), "recordCampaignAttribution")({ ...input, eventId: input.eventId || `${input.type}_${Date.now()}_${Math.random().toString(36).slice(2)}` });
}
