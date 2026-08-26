import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firebaseAuth, firebaseDb, firebaseFunctions, firebaseReady } from "./firebase";

export type AuditEntity = "product" | "order" | "team" | "brand" | "resolution" | "payout";

export type AuditEvent = {
  id: string;
  brandId: string;
  actorUid: string;
  actorName: string;
  action: string;
  entity: AuditEntity;
  entityId: string;
  entityName: string;
  summary: string;
  metadata?: Record<string, string | number | boolean>;
  createdAt: number;
};

export type AuditInput = Omit<AuditEvent, "id" | "actorUid" | "actorName" | "createdAt"> & {
  actorName?: string;
};

const KEY = "uvel-brand-audit-v1";
let cache: AuditEvent[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
const watches = new Set<string>();

function emit() {
  listeners.forEach((listener) => listener());
}

function millis(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") return (value as { toMillis: () => number }).toMillis();
  return Date.now();
}

function normalize(event: AuditEvent): AuditEvent {
  return { ...event, createdAt: millis(event.createdAt), metadata: event.metadata || undefined };
}

async function persistLocal() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache.slice(0, 500)));
  } catch {
    /* Remote audit remains the source of truth when local storage is unavailable. */
  }
}

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as AuditEvent[]).map(normalize) : [];
  } catch {
    cache = [];
  }
  emit();
}
void hydrate();

function mergeRemote(events: AuditEvent[]) {
  const byId = new Map(cache.map((event) => [event.id, event]));
  events.forEach((event) => byId.set(event.id, normalize(event)));
  cache = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 500);
  void persistLocal();
  emit();
}

export function watchBrandAudit(brandId: string) {
  if (watches.has(brandId) || !firebaseReady() || !firebaseAuth().currentUser) return () => undefined;
  watches.add(brandId);
  try {
    const eventsQuery = query(collection(firebaseDb(), "brandAudit"), where("brandId", "==", brandId));
    const unsubscribe = onSnapshot(eventsQuery, (snap) => {
      mergeRemote(snap.docs.map((item) => {
        const data = item.data() as Omit<AuditEvent, "id">;
        return normalize({ ...data, id: item.id } as AuditEvent);
      }));
    }, () => undefined);
    return () => {
      watches.delete(brandId);
      unsubscribe();
    };
  } catch {
    watches.delete(brandId);
    return () => undefined;
  }
}

export function useAudit(brandId: string) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    const stop = watchBrandAudit(brandId);
    return () => {
      listeners.delete(listener);
      stop();
    };
  }, [brandId]);
  return cache.filter((event) => event.brandId === brandId).sort((a, b) => b.createdAt - a.createdAt);
}

export async function recordAuditEvent(input: AuditInput) {
  const user = firebaseAuth().currentUser;
  const event: AuditEvent = {
    ...input,
    id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    actorUid: user?.uid || "local",
    actorName: input.actorName || user?.displayName || "Brand team member",
    createdAt: Date.now(),
  };
  cache = [event, ...cache.filter((item) => item.id !== event.id)].slice(0, 500);
  void persistLocal();
  emit();
  if (!firebaseReady() || !user) return event;
  try {
    const call = httpsCallable(firebaseFunctions(), "recordAuditEvent");
    await call(event);
  } catch {
    /* Keep the local event visible; the next backend-enabled action can sync remote history. */
  }
  return event;
}

export function clearAuditCache() {
  cache = [];
  void persistLocal();
  emit();
}
