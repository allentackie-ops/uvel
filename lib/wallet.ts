import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firebaseAuth, firebaseDb, firebaseFunctions, firebaseReady } from "./firebase";
import { allOrders, useOrders, type Order } from "./orders";
import { useUvel } from "./store";

export const WALLET_RELEASE_MS = 2 * 24 * 60 * 60 * 1000;
const CONFIRMS_KEY = "uvel-wallet-confirms-v1";
const PAYOUTS_KEY = "uvel-wallet-payouts-v1";
const PROFILE_KEY = "uvel-wallet-payout-profile-v1";

export type WalletEntryStatus = "pending" | "available" | "void" | "requested";
export type WalletEntryType = "sale" | "payout" | "spend";

export type WalletEntry = {
  id: string;
  uid: string;
  orderId?: string;
  type: WalletEntryType;
  status: WalletEntryStatus;
  amountCents: number;
  currency: string;
  pieceName?: string;
  piecePhoto?: string;
  createdAt: number;
};

export type UserPayout = {
  id: string;
  uid: string;
  currency: string;
  amountCents: number;
  status: "requested" | "processing" | "paid" | "failed";
  requestedAt: number;
};

export type UserPayoutProfile = {
  uid: string;
  status: "not_started" | "submitted";
  destinationType: "bank" | "mobile_money";
  country: string;
  currency: string;
  accountHolderName: string;
  institutionName: string;
  destinationLast4: string;
};

export type WalletSnapshot = {
  pendingCents: number;
  availableCents: number;
  paidOutCents: number;
  currency: string;
  entries: WalletEntry[];
  payouts: UserPayout[];
  profile?: UserPayoutProfile;
};

const listeners = new Set<() => void>();
let confirms: Record<string, number> = {};
let localPayouts: UserPayout[] = [];
let localProfile: UserPayoutProfile | undefined;
let remoteWallet: { pendingCents: number; availableCents: number; paidOutCents: number; currency?: string } | null = null;
let remoteEntries: WalletEntry[] = [];
let remotePayouts: UserPayout[] = [];
let remoteProfile: UserPayoutProfile | undefined;

function emit() {
  listeners.forEach((listener) => listener());
}

function millis(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") return (value as { toMillis: () => number }).toMillis();
  return Date.now();
}

async function hydrateLocal() {
  try {
    const raw = await AsyncStorage.getItem(CONFIRMS_KEY);
    confirms = raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    confirms = {};
  }
  try {
    const raw = await AsyncStorage.getItem(PAYOUTS_KEY);
    localPayouts = raw ? (JSON.parse(raw) as UserPayout[]) : [];
  } catch {
    localPayouts = [];
  }
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    localProfile = raw ? (JSON.parse(raw) as UserPayoutProfile) : undefined;
  } catch {
    localProfile = undefined;
  }
  emit();
}
void hydrateLocal();

export function saleNetCents(order: Order) {
  return Math.max(0, Math.floor(order.itemCents || 0) - Math.floor(order.discountCents || 0));
}

export function orderWalletStatus(order: Order): WalletEntryStatus | null {
  if (order.status !== "paid") return null;
  if (order.fulfillmentStatus === "canceled" || order.refundStatus === "succeeded") return "void";
  if (order.walletVoided) return "void";
  if (order.walletReleased || order.buyerConfirmedAt || confirms[order.id]) return "available";
  const deliveredAt = order.deliveredAt || (order.fulfillmentStatus === "delivered" ? order.fulfillmentUpdatedAt || order.paidAt || order.createdAt : 0);
  if (deliveredAt && Date.now() - deliveredAt >= WALLET_RELEASE_MS) return "available";
  return "pending";
}

function derivedSales(uid: string): WalletEntry[] {
  return allOrders()
    .filter((order) => order.sellerId === uid && order.buyerId !== uid)
    .map((order) => {
      const status = orderWalletStatus(order);
      if (!status) return null;
      return {
        id: `sale-${order.id}`,
        uid,
        orderId: order.id,
        type: "sale" as const,
        status,
        amountCents: saleNetCents(order),
        currency: (order.currency || "USD").toUpperCase(),
        pieceName: order.pieceName,
        piecePhoto: order.piecePhoto,
        createdAt: order.paidAt || order.createdAt,
      };
    })
    .filter((row): row is WalletEntry => Boolean(row));
}

export function buildWallet(uid: string, currency: string): WalletSnapshot {
  const sales = remoteEntries.length ? remoteEntries.filter((row) => row.type === "sale") : derivedSales(uid);
  const spends = remoteEntries.filter((row) => row.type === "spend");
  const payouts = remotePayouts.length ? remotePayouts : localPayouts;
  const payoutEntries = (remoteEntries.length ? remoteEntries.filter((row) => row.type === "payout") : payouts.map((payout) => ({
    id: `payout-${payout.id}`,
    uid,
    type: "payout" as const,
    status: payout.status === "failed" ? "void" : "requested" as WalletEntryStatus,
    amountCents: -Math.abs(payout.amountCents),
    currency: payout.currency,
    createdAt: payout.requestedAt,
  })));
  const pendingCents = remoteWallet
    ? Math.max(0, remoteWallet.pendingCents)
    : sales.filter((row) => row.status === "pending").reduce((sum, row) => sum + row.amountCents, 0);
  const saleAvailable = sales.filter((row) => row.status === "available").reduce((sum, row) => sum + row.amountCents, 0);
  const paidOutCents = remoteWallet
    ? Math.max(0, remoteWallet.paidOutCents || 0)
    : payouts.filter((payout) => ["requested", "processing", "paid"].includes(payout.status)).reduce((sum, payout) => sum + payout.amountCents, 0);
  const spentCents = spends.reduce((sum, row) => sum + Math.abs(row.amountCents), 0);
  const availableCents = remoteWallet
    ? Math.max(0, remoteWallet.availableCents)
    : Math.max(0, saleAvailable - paidOutCents - spentCents);
  const entries = [...sales, ...payoutEntries, ...spends].sort((a, b) => b.createdAt - a.createdAt);
  return {
    pendingCents,
    availableCents,
    paidOutCents,
    currency: remoteWallet?.currency || currency,
    entries,
    payouts,
    profile: remoteProfile || localProfile,
  };
}

export function useWallet(currency = "USD") {
  const { uid } = useUvel();
  const orders = useOrders();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  useEffect(() => {
    if (!uid || !firebaseReady() || !firebaseAuth().currentUser) return;
    const db = firebaseDb();
    const stops = [
      onSnapshot(doc(db, "wallets", uid), (snap) => {
        if (!snap.exists()) {
          remoteWallet = null;
          emit();
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        remoteWallet = {
          pendingCents: Math.max(0, Math.floor(Number(data.pendingCents) || 0)),
          availableCents: Math.max(0, Math.floor(Number(data.availableCents) || 0)),
          paidOutCents: Math.max(0, Math.floor(Number(data.paidOutCents) || 0)),
          currency: typeof data.currency === "string" ? data.currency : undefined,
        };
        emit();
      }, () => undefined),
      onSnapshot(query(collection(db, "walletEntries"), where("uid", "==", uid)), (snap) => {
        remoteEntries = snap.docs.map((item) => {
          const data = item.data() as WalletEntry;
          return { ...data, id: item.id, createdAt: millis(data.createdAt) };
        });
        emit();
      }, () => undefined),
      onSnapshot(query(collection(db, "userPayouts"), where("uid", "==", uid)), (snap) => {
        remotePayouts = snap.docs.map((item) => {
          const data = item.data() as UserPayout;
          return { ...data, id: item.id, requestedAt: millis(data.requestedAt) };
        });
        emit();
      }, () => undefined),
      onSnapshot(doc(db, "userPayoutProfiles", uid), (snap) => {
        remoteProfile = snap.exists() ? (snap.data() as UserPayoutProfile) : undefined;
        emit();
      }, () => undefined),
    ];
    return () => stops.forEach((stop) => stop());
  }, [uid]);
  return useMemo(() => buildWallet(uid, currency), [uid, currency, tick, orders]);
}

export async function confirmOrderReceived(orderId: string) {
  confirms = { ...confirms, [orderId]: Date.now() };
  await AsyncStorage.setItem(CONFIRMS_KEY, JSON.stringify(confirms)).catch(() => undefined);
  emit();
  if (firebaseReady() && firebaseAuth().currentUser) {
    const call = httpsCallable(firebaseFunctions(), "confirmOrderReceived");
    await call({ orderId });
  }
}

export async function saveUserPayoutProfile(input: Omit<UserPayoutProfile, "uid" | "status" | "destinationLast4"> & { destination: string }) {
  const destination = input.destination.replace(/\D/g, "");
  if (destination.length < 4 || !input.accountHolderName.trim() || !input.institutionName.trim()) {
    throw new Error("Add the account name, institution, and number.");
  }
  const uid = firebaseAuth().currentUser?.uid || "";
  const profile: UserPayoutProfile = {
    uid,
    status: "submitted",
    destinationType: input.destinationType,
    country: input.country,
    currency: input.currency,
    accountHolderName: input.accountHolderName.trim(),
    institutionName: input.institutionName.trim(),
    destinationLast4: destination.slice(-4),
  };
  localProfile = profile;
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)).catch(() => undefined);
  emit();
  if (firebaseReady() && firebaseAuth().currentUser) {
    const call = httpsCallable(firebaseFunctions(), "saveUserPayoutProfile");
    await call({ ...profile, destination });
  }
  return profile;
}

export async function requestSellerPayout(currency: string, amountCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 10) throw new Error("Enter a valid amount.");
  const uid = firebaseAuth().currentUser?.uid || "";
  const payout: UserPayout = {
    id: `local-${Date.now().toString(36)}`,
    uid,
    currency,
    amountCents,
    status: "requested",
    requestedAt: Date.now(),
  };
  if (firebaseReady() && firebaseAuth().currentUser) {
    const call = httpsCallable<{ currency: string; amountCents: number }, { payoutId: string }>(firebaseFunctions(), "requestSellerPayout");
    await call({ currency, amountCents });
  } else {
    localPayouts = [payout, ...localPayouts];
    await AsyncStorage.setItem(PAYOUTS_KEY, JSON.stringify(localPayouts)).catch(() => undefined);
    emit();
  }
  return payout;
}

export async function payWithWallet(orderId: string) {
  if (!firebaseReady() || !firebaseAuth().currentUser) {
    throw new Error("Uvel balance needs a signed-in connection.");
  }
  const call = httpsCallable(firebaseFunctions(), "payWithWallet");
  await call({ orderId });
}

export function buyerHasConfirmed(orderId: string) {
  return Boolean(confirms[orderId]);
}
