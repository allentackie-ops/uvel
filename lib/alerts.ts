import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import type { ClosetPiece } from "./wardrobe";
import { armNotificationHandler } from "./push";

export type AlertKind = "price_drop" | "restock" | "both";

export type AlertPreference = {
  listingId: string;
  kind: AlertKind;
  baselinePriceCents: number;
  lastPriceCents: number;
  baselineStock: number | null;
  lastStock: number | null;
  createdAt: number;
  updatedAt: number;
};

export type AlertEvent = {
  id: string;
  listingId: string;
  kind: "price_drop" | "restock";
  title: string;
  body: string;
  photo: string;
  listingName: string;
  at: number;
  read: boolean;
};

const PREFS_PREFIX = "uvel-alert-preferences-v1:";
const EVENTS_PREFIX = "uvel-alert-events-v1:";

let activeUid = "";
let preferences: Record<string, AlertPreference> = {};
let events: AlertEvent[] = [];
let hydratedUid = "";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function prefKey(uid: string) {
  return `${PREFS_PREFIX}${uid}`;
}

function eventKey(uid: string) {
  return `${EVENTS_PREFIX}${uid}`;
}

function normalizeKind(value: unknown): AlertKind {
  return value === "price_drop" || value === "restock" || value === "both" ? value : "both";
}

function normalizePreference(value: AlertPreference): AlertPreference {
  return {
    ...value,
    kind: normalizeKind(value.kind),
    baselinePriceCents: Math.max(0, Number(value.baselinePriceCents) || 0),
    lastPriceCents: Math.max(0, Number(value.lastPriceCents) || 0),
    baselineStock: typeof value.baselineStock === "number" ? Math.max(0, value.baselineStock) : null,
    lastStock: typeof value.lastStock === "number" ? Math.max(0, value.lastStock) : null,
  };
}

function normalizeEvent(value: AlertEvent): AlertEvent {
  return {
    ...value,
    kind: value.kind === "restock" ? "restock" : "price_drop",
    at: Number(value.at) || Date.now(),
    read: Boolean(value.read),
  };
}

export async function hydrateAlerts(uid: string) {
  if (!uid) return;
  if (hydratedUid === uid && activeUid === uid) return;
  activeUid = uid;
  hydratedUid = uid;
  try {
    const [rawPrefs, rawEvents] = await Promise.all([
      AsyncStorage.getItem(prefKey(uid)),
      AsyncStorage.getItem(eventKey(uid)),
    ]);
    const savedPrefs = rawPrefs ? (JSON.parse(rawPrefs) as Record<string, AlertPreference>) : {};
    preferences = Object.fromEntries(Object.entries(savedPrefs).map(([id, value]) => [id, normalizePreference(value)]));
    events = rawEvents ? (JSON.parse(rawEvents) as AlertEvent[]).map(normalizeEvent).sort((a, b) => b.at - a.at).slice(0, 100) : [];
  } catch {
    preferences = {};
    events = [];
  }
  emit();
}

async function persist() {
  if (!activeUid) return;
  try {
    await Promise.all([
      AsyncStorage.setItem(prefKey(activeUid), JSON.stringify(preferences)),
      AsyncStorage.setItem(eventKey(activeUid), JSON.stringify(events.slice(0, 100))),
    ]);
  } catch {
    /* Alert state remains available in memory for the current session. */
  }
}

function stockOf(piece: ClosetPiece) {
  if (typeof piece.stockQuantity === "number") return Math.max(0, piece.stockQuantity);
  if (piece.sizeStock && Object.keys(piece.sizeStock).length) {
    return Object.values(piece.sizeStock).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  }
  return null;
}

function includesKind(kind: AlertKind, target: "price_drop" | "restock") {
  return kind === "both" || kind === target;
}

async function requestLocalPermission() {
  try {
    armNotificationHandler();
    const Notifications = await import("expo-notifications");
    const current = await Notifications.getPermissionsAsync();
    if (current.status === "granted") return true;
    const next = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return next.status === "granted";
  } catch {
    return false;
  }
}

async function deliverLocal(event: AlertEvent) {
  try {
    const Notifications = await import("expo-notifications");
    const current = await Notifications.getPermissionsAsync();
    if (current.status !== "granted") return false;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: event.title,
        body: event.body,
        sound: "default",
        data: { pieceId: event.listingId, alertId: event.id },
      },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}

export async function setAlertPreference(uid: string, piece: ClosetPiece, kind: AlertKind | "off") {
  if (!uid || !piece.id) return false;
  await hydrateAlerts(uid);
  if (kind === "off") {
    delete preferences[piece.id];
    await persist();
    emit();
    return true;
  }
  const stock = stockOf(piece);
  const current = preferences[piece.id];
  preferences[piece.id] = {
    listingId: piece.id,
    kind,
    baselinePriceCents: current?.baselinePriceCents ?? Math.max(0, piece.listPriceCents),
    lastPriceCents: Math.max(0, piece.listPriceCents),
    baselineStock: current?.baselineStock ?? stock,
    lastStock: stock,
    createdAt: current?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
  await persist();
  emit();
  return true;
}

export async function enableAlert(uid: string, piece: ClosetPiece, kind: AlertKind) {
  const permission = await requestLocalPermission();
  const saved = await setAlertPreference(uid, piece, kind);
  return { saved, permission };
}

export function getAlertPreference(uid: string, listingId: string) {
  return uid && uid === activeUid ? preferences[listingId] || null : null;
}

export function alertPreferences(uid: string) {
  return uid && uid === activeUid ? Object.values(preferences).sort((a, b) => b.updatedAt - a.updatedAt) : [];
}

export function alertEvents(uid: string) {
  return uid && uid === activeUid ? events.slice() : [];
}

export async function markAlertRead(uid: string, id: string) {
  await hydrateAlerts(uid);
  events = events.map((event) => event.id === id ? { ...event, read: true } : event);
  await persist();
  emit();
}

export async function observeListing(uid: string, piece: ClosetPiece) {
  if (!uid || !piece.id) return;
  await hydrateAlerts(uid);
  const preference = preferences[piece.id];
  if (!preference) return;
  const currentPrice = Math.max(0, piece.listPriceCents);
  const currentStock = stockOf(piece);
  const at = Date.now();
  const priceDropped = includesKind(preference.kind, "price_drop") && currentPrice < preference.lastPriceCents;
  const restocked = includesKind(preference.kind, "restock") && preference.lastStock === 0 && currentStock !== null && currentStock > 0;
  const nextEvents: AlertEvent[] = [];
  if (priceDropped) {
    nextEvents.push({
      id: `${piece.id}:price:${currentPrice}:${at}`,
      listingId: piece.id,
      kind: "price_drop",
      title: "Price drop on a saved item",
      body: `${piece.name} is now priced lower than the last recorded check.`,
      photo: piece.photo,
      listingName: piece.name,
      at,
      read: false,
    });
  }
  if (restocked) {
    nextEvents.push({
      id: `${piece.id}:restock:${at}`,
      listingId: piece.id,
      kind: "restock",
      title: "Back in stock",
      body: `${piece.name} has recorded inventory again.`,
      photo: piece.photo,
      listingName: piece.name,
      at,
      read: false,
    });
  }
  preferences[piece.id] = {
    ...preference,
    lastPriceCents: currentPrice,
    lastStock: currentStock,
    updatedAt: at,
  };
  if (nextEvents.length) {
    const unique = nextEvents.filter((event) => !events.some((old) => old.listingId === event.listingId && old.kind === event.kind && old.body === event.body && at - old.at < 60_000));
    events = [...unique, ...events].sort((a, b) => b.at - a.at).slice(0, 100);
    for (const event of unique) void deliverLocal(event);
  }
  await persist();
  if (nextEvents.length) emit();
}

export function useAlertPreference(uid: string, listingId: string) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    void hydrateAlerts(uid);
    return () => { listeners.delete(listener); };
  }, [uid, listingId]);
  return getAlertPreference(uid, listingId);
}

export function useAlertCenter(uid: string) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    void hydrateAlerts(uid);
    return () => { listeners.delete(listener); };
  }, [uid]);
  return {
    preferences: alertPreferences(uid),
    events: alertEvents(uid),
  };
}

export function alertKindLabel(kind: AlertKind) {
  if (kind === "price_drop") return "Price drops";
  if (kind === "restock") return "Restocks";
  return "Price drops + restocks";
}
