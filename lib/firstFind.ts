import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { scoreListing } from "./lookMatch";
import { convertCents, getMarket, type Market } from "./markets";
import { allOrders, useOrders } from "./orders";
import { useUvel } from "./store";
import type { ClosetPiece } from "./wardrobe";

const KEY = "uvel-first-find-v1";
const DEVICE_KEY = "uvel-device-offer-v1";
const FIRST_FIND_USD_CENTS = 1500;
const MATCH_MIN = 4;

export type FirstFindGrant = {
  id: string;
  type: "first_find" | "referral";
  amountUsdCents: number;
  at: number;
};

type FirstFindState = {
  uid: string;
  grants: FirstFindGrant[];
  referralCode: string;
  referredBy?: string;
};

type DeviceLock = {
  claimed: boolean;
  uid: string;
  at: number;
  spent: boolean;
};

const listeners = new Set<() => void>();
let memory: FirstFindState = { uid: "", grants: [], referralCode: "" };
let device: DeviceLock = { claimed: false, uid: "", at: 0, spent: false };

function emit() {
  listeners.forEach((listener) => listener());
}

function codeFrom(uid: string) {
  const raw = (uid || "guest").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  return (raw || "UVEL") + String((uid || "x").length * 17).slice(-2);
}

async function persistAccount() {
  await AsyncStorage.setItem(KEY, JSON.stringify(memory)).catch(() => undefined);
}

async function persistDevice() {
  await AsyncStorage.setItem(DEVICE_KEY, JSON.stringify(device)).catch(() => undefined);
}

async function hydrate() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) memory = { ...memory, ...(JSON.parse(raw) as FirstFindState) };
  } catch {
    /* keep defaults */
  }
  try {
    const raw = await AsyncStorage.getItem(DEVICE_KEY);
    if (raw) device = { ...device, ...(JSON.parse(raw) as DeviceLock) };
  } catch {
    /* keep defaults */
  }
  if (!device.claimed && memory.grants.some((grant) => grant.type === "first_find") && memory.uid) {
    device = { claimed: true, uid: memory.uid, at: Date.now(), spent: false };
    void persistDevice();
  }
  emit();
}
void hydrate();

function deviceBlocks(uid: string) {
  return Boolean(device.claimed && device.uid && uid && device.uid !== uid);
}

function deviceSpentFor(uid: string) {
  return Boolean(device.claimed && device.uid === uid && device.spent);
}

export function dnaIsReady(app: { archetype?: string; palette?: string; silhouette?: string }) {
  return Boolean(app.archetype || app.palette || app.silhouette);
}

export function firstFindCents(market: Market = getMarket()) {
  if (market.code === "GH") return 20000;
  return convertCents(FIRST_FIND_USD_CENTS, "USD", market);
}

export function listingMatchesDna(piece: ClosetPiece, styles: string[]) {
  return scoreListing(piece, [], styles) >= MATCH_MIN;
}

export function creditOnOrders(uid: string) {
  if (!uid) return 0;
  return allOrders()
    .filter((order) => order.buyerId === uid && order.status !== "failed")
    .reduce((sum, order) => sum + Math.max(0, order.creditCents || 0), 0);
}

export function remainingCreditCents(uid: string, market: Market) {
  if (!uid || deviceBlocks(uid) || deviceSpentFor(uid)) return 0;
  const granted = memory.uid === uid
    ? memory.grants.reduce((sum, grant) => {
        if (grant.type === "first_find") return sum + firstFindCents(market);
        return sum + convertCents(grant.amountUsdCents, "USD", market);
      }, 0)
    : 0;
  return Math.max(0, granted - creditOnOrders(uid));
}

export function applyFirstFind(itemCents: number, uid: string, market: Market, piece: ClosetPiece, styles: string[]) {
  if (deviceBlocks(uid) || deviceSpentFor(uid)) return 0;
  if (!listingMatchesDna(piece, styles)) return 0;
  const left = remainingCreditCents(uid, market);
  if (left < 10) return 0;
  return Math.min(itemCents, left);
}

function claimDevice(uid: string) {
  if (!uid) return;
  if (device.claimed && device.uid && device.uid !== uid) return;
  if (device.claimed && device.uid === uid) return;
  device = { claimed: true, uid, at: Date.now(), spent: false };
  void persistDevice();
}

function markSpent(uid: string) {
  if (!uid || !device.claimed || device.uid !== uid || device.spent) return;
  device = { ...device, spent: true };
  void persistDevice();
  emit();
}

function ensureGrant(uid: string, type: FirstFindGrant["type"], amountUsdCents: number) {
  if (!uid) return;
  if (deviceBlocks(uid)) return;
  if (deviceSpentFor(uid) && type === "first_find") return;
  if (memory.uid && memory.uid !== uid) {
    memory = { uid, grants: [], referralCode: codeFrom(uid), referredBy: undefined };
  }
  if (!memory.referralCode) memory.referralCode = codeFrom(uid);
  memory.uid = uid;
  if (memory.grants.some((grant) => grant.type === type)) {
    if (type === "first_find") claimDevice(uid);
    void persistAccount();
    return;
  }
  if (type === "first_find") claimDevice(uid);
  memory = {
    ...memory,
    grants: [...memory.grants, { id: `${type}-${Date.now().toString(36)}`, type, amountUsdCents, at: Date.now() }],
  };
  void persistAccount();
  emit();
}

export function claimInvite(code: string, uid: string) {
  const clean = code.trim().toUpperCase();
  if (!clean || !uid) return false;
  if (clean === (memory.referralCode || codeFrom(uid))) return false;
  if (memory.referredBy) return true;
  memory = { ...memory, uid: memory.uid || uid, referredBy: clean, referralCode: memory.referralCode || codeFrom(uid) };
  void persistAccount();
  emit();
  return true;
}

export function useFirstFind() {
  const app = useUvel();
  const market = getMarket(app.country);
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
    if (!app.uid) return;
    if (memory.uid && memory.uid !== app.uid) {
      memory = { uid: app.uid, grants: [], referralCode: codeFrom(app.uid) };
      void persistAccount();
      emit();
    } else if (!memory.referralCode) {
      memory = { ...memory, uid: app.uid, referralCode: codeFrom(app.uid) };
      void persistAccount();
      emit();
    }
  }, [app.uid]);
  useEffect(() => {
    if (!app.uid || !dnaIsReady(app)) return;
    if (deviceBlocks(app.uid) || deviceSpentFor(app.uid)) return;
    ensureGrant(app.uid, "first_find", FIRST_FIND_USD_CENTS);
  }, [app.uid, app.archetype, app.palette, app.silhouette, tick]);
  useEffect(() => {
    if (!app.uid || deviceBlocks(app.uid)) return;
    const left = remainingCreditCents(app.uid, market);
    if (device.claimed && device.uid === app.uid && left < 10 && (device.spent || creditOnOrders(app.uid) > 0)) {
      markSpent(app.uid);
    }
  }, [app.uid, market.code, tick, orders]);

  return useMemo(() => {
    const ready = dnaIsReady(app);
    const blocked = deviceBlocks(app.uid);
    const remaining = remainingCreditCents(app.uid, market);
    const amount = firstFindCents(market);
    return {
      ready,
      blocked,
      amount,
      remaining,
      currency: market.currency,
      referralCode: memory.referralCode || codeFrom(app.uid),
      referredBy: memory.referredBy,
      matches: (piece: ClosetPiece) => remaining >= 10 && listingMatchesDna(piece, app.styles),
      applyTo: (piece: ClosetPiece, itemCents: number) => applyFirstFind(itemCents, app.uid, market, piece, app.styles),
    };
  }, [app.uid, app.archetype, app.palette, app.silhouette, app.styles, app.country, tick, orders]);
}
