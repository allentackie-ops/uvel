import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { Order } from "./orders";
import { firebaseAuth, firebaseDb, firebaseFunctions, firebaseReady } from "./firebase";

export type SettlementStatus = "pending" | "available" | "refunded" | "void";
export type PayoutStatus = "requested" | "processing" | "paid" | "failed" | "reversed";
export type PayoutProfileStatus = "not_started" | "submitted" | "verified" | "needs_attention";
export type PayoutDestinationType = "bank" | "mobile_money";

export type SettlementEntry = {
  id: string;
  brandId: string;
  orderId: string;
  orderDate: number;
  buyerId: string;
  productName: string;
  productPhoto: string;
  currency: string;
  grossCents: number;
  feeCents: number;
  refundCents: number;
  netCents: number;
  status: SettlementStatus;
};

export type PayoutProfile = {
  brandId: string;
  status: PayoutProfileStatus;
  destinationType: PayoutDestinationType;
  country: string;
  currency: string;
  legalName: string;
  registrationId: string;
  accountHolderName: string;
  institutionName: string;
  destinationLast4: string;
  updatedAt: number;
  needsAttentionReason?: string;
};

export type Payout = {
  id: string;
  brandId: string;
  currency: string;
  amountCents: number;
  status: PayoutStatus;
  requestedAt: number;
  processedAt?: number;
  failureReason?: string;
};

export type FinanceTotals = {
  currency: string;
  grossCents: number;
  feesCents: number;
  refundsCents: number;
  netCents: number;
  pendingCents: number;
  availableCents: number;
  paidOutCents: number;
};

function millis(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") return (value as { toMillis: () => number }).toMillis();
  return Date.now();
}

export function settlementEntry(order: Order, brandId: string): SettlementEntry | null {
  if (order.brandId !== brandId || order.status !== "paid") return null;
  const currency = String(order.currency || "USD").toUpperCase();
  const grossCents = Math.max(0, Math.floor(Number(order.itemCents) || 0) - Math.floor(Number(order.discountCents) || 0));
  const feeCents = Math.max(0, Math.floor(Number(order.feeCents) || 0));
  const hasRefund = order.refundStatus === "processing" || order.refundStatus === "succeeded";
  const refundCents = hasRefund ? Math.min(grossCents, Math.max(0, Math.floor(Number(order.refundAmountCents || order.itemCents) || 0))) : 0;
  const status: SettlementStatus = order.fulfillmentStatus === "canceled" ? "void" : order.refundStatus === "succeeded" ? "refunded" : order.fulfillmentStatus === "delivered" ? "available" : "pending";
  return {
    id: `order-${order.id}`,
    brandId,
    orderId: order.id,
    orderDate: millis(order.createdAt),
    buyerId: order.buyerId,
    productName: order.pieceName,
    productPhoto: order.piecePhoto,
    currency,
    grossCents,
    feeCents,
    refundCents,
    netCents: status === "void" ? 0 : Math.max(0, grossCents - feeCents - refundCents),
    status,
  };
}

export function settlementLedger(orders: Order[], brandId: string, since?: number) {
  return orders.map((order) => settlementEntry(order, brandId)).filter((entry): entry is SettlementEntry => Boolean(entry) && (!since || (entry as SettlementEntry).orderDate >= since)).sort((a, b) => b.orderDate - a.orderDate);
}

export function financeTotals(entries: SettlementEntry[], payouts: Payout[], currency: string): FinanceTotals {
  const rows = entries.filter((entry) => entry.currency === currency);
  const paidOutCents = payouts.filter((payout) => payout.currency === currency && ["requested", "paid", "processing"].includes(payout.status)).reduce((sum, payout) => sum + Math.max(0, payout.amountCents), 0);
  const grossCents = rows.reduce((sum, row) => sum + row.grossCents, 0);
  const feesCents = rows.reduce((sum, row) => sum + row.feeCents, 0);
  const refundsCents = rows.reduce((sum, row) => sum + row.refundCents, 0);
  const netCents = rows.reduce((sum, row) => sum + row.netCents, 0);
  const pendingCents = rows.filter((row) => row.status === "pending").reduce((sum, row) => sum + row.netCents, 0);
  const availableBeforePayout = rows.filter((row) => row.status === "available").reduce((sum, row) => sum + row.netCents, 0);
  return { currency, grossCents, feesCents, refundsCents, netCents, pendingCents, availableCents: Math.max(0, availableBeforePayout - paidOutCents), paidOutCents };
}

const PROFILE_KEY = "uvel-payout-profiles-v1";
let localProfiles: Record<string, PayoutProfile> = {};
let profilesHydrated = false;
const profileListeners = new Set<() => void>();

async function hydrateProfiles() {
  if (profilesHydrated) return;
  profilesHydrated = true;
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    localProfiles = raw ? JSON.parse(raw) as Record<string, PayoutProfile> : {};
  } catch { localProfiles = {}; }
  profileListeners.forEach((listener) => listener());
}
void hydrateProfiles();

export function usePayoutProfile(brandId: string) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    profileListeners.add(listener);
    if (brandId && firebaseReady() && firebaseAuth().currentUser) {
      const stop = onSnapshot(doc(firebaseDb(), "payoutProfiles", brandId), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as PayoutProfile;
        localProfiles[brandId] = { ...data, brandId, updatedAt: millis(data.updatedAt) };
        void AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(localProfiles));
        profileListeners.forEach((notify) => notify());
      }, () => undefined);
      return () => { profileListeners.delete(listener); stop(); };
    }
    return () => { profileListeners.delete(listener); };
  }, [brandId]);
  return localProfiles[brandId];
}

export type SavePayoutProfileInput = Omit<PayoutProfile, "status" | "updatedAt" | "destinationLast4"> & { destination: string };
export async function savePayoutProfile(input: SavePayoutProfileInput) {
  const destination = input.destination.replace(/\D/g, "");
  if (!input.brandId || !input.legalName.trim() || !input.registrationId.trim() || !input.accountHolderName.trim() || !input.institutionName.trim() || destination.length < 4) throw new Error("Complete the required payout and compliance details.");
  const profile: PayoutProfile = { brandId: input.brandId, status: "submitted", destinationType: input.destinationType, country: input.country.toUpperCase(), currency: input.currency.toUpperCase(), legalName: input.legalName.trim(), registrationId: input.registrationId.trim(), accountHolderName: input.accountHolderName.trim(), institutionName: input.institutionName.trim(), destinationLast4: destination.slice(-4), updatedAt: Date.now() };
  if (firebaseReady() && firebaseAuth().currentUser) {
    const call = httpsCallable(firebaseFunctions(), "savePayoutProfile");
    await call({ ...profile, destination });
  }
  localProfiles[input.brandId] = profile;
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(localProfiles));
  profileListeners.forEach((listener) => listener());
  return profile;
}

const payoutCache: Record<string, Payout[]> = {};
const payoutWatches = new Set<string>();
const listeners = new Set<() => void>();

export function usePayouts(brandId: string) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    if (brandId && !payoutWatches.has(brandId) && firebaseReady() && firebaseAuth().currentUser) {
      payoutWatches.add(brandId);
      const stop = onSnapshot(query(collection(firebaseDb(), "payouts"), where("brandId", "==", brandId)), (snap) => {
        payoutCache[brandId] = snap.docs.map((item) => {
          const data = item.data() as Payout;
          return { ...data, id: item.id, requestedAt: millis(data.requestedAt), processedAt: data.processedAt == null ? undefined : millis(data.processedAt) };
        }).sort((a, b) => b.requestedAt - a.requestedAt);
        listeners.forEach((notify) => notify());
      }, () => undefined);
      return () => { listeners.delete(listener); payoutWatches.delete(brandId); stop(); };
    }
    return () => { listeners.delete(listener); };
  }, [brandId]);
  return payoutCache[brandId] || [];
}

export async function requestBrandPayout(brandId: string, currency: string, amountCents: number) {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Payout requests require a signed-in connection to Uvel.");
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error("A valid payout amount is required.");
  const call = httpsCallable(firebaseFunctions(), "requestBrandPayout");
  return call({ brandId, currency, amountCents });
}
