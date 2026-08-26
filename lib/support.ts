import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firebaseAuth, firebaseDb, firebaseFunctions, firebaseReady } from "./firebase";

export type SupportStatus = "open" | "in_progress" | "waiting_on_buyer" | "escalated" | "resolved" | "closed";
export type SupportPriority = "normal" | "high" | "urgent";
export type SupportCategory = "order_status" | "shipping" | "return" | "refund" | "cancellation" | "product" | "payment" | "other";

export type SupportCase = {
  id: string;
  brandId: string;
  orderId: string;
  threadId: string;
  pieceId: string;
  buyerId: string;
  buyerName: string;
  productName: string;
  productPhoto: string;
  subject: string;
  category: SupportCategory;
  status: SupportStatus;
  priority: SupportPriority;
  assigneeUid?: string;
  assigneeName?: string;
  lastMessage?: string;
  lastAt: number;
  createdAt: number;
  updatedAt: number;
};

const KEY = "uvel-support-cases-v1";
let cache: SupportCase[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
const watches = new Set<string>();
export type SupportNote = { id: string; caseId: string; authorUid: string; authorName: string; body: string; createdAt: number };
const noteCache: Record<string, SupportNote[]> = {};
const noteWatches = new Set<string>();

function emit() { listeners.forEach((listener) => listener()); }
function millis(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") return (value as { toMillis: () => number }).toMillis();
  return Date.now();
}
function normalize(value: SupportCase): SupportCase {
  return { ...value, lastAt: millis(value.lastAt), createdAt: millis(value.createdAt), updatedAt: millis(value.updatedAt) };
}
async function persist() {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(cache.slice(0, 500))); } catch { /* local cache is optional */ }
}
async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try { const raw = await AsyncStorage.getItem(KEY); cache = raw ? (JSON.parse(raw) as SupportCase[]).map(normalize) : []; } catch { cache = []; }
  emit();
}
void hydrate();
function mergeRemote(rows: SupportCase[]) {
  const byId = new Map(cache.map((row) => [row.id, row]));
  rows.forEach((row) => byId.set(row.id, normalize(row)));
  cache = Array.from(byId.values()).sort((a, b) => b.lastAt - a.lastAt).slice(0, 500);
  void persist();
  emit();
}

export function watchBrandSupport(brandId: string) {
  if (!brandId || watches.has(brandId) || !firebaseReady() || !firebaseAuth().currentUser) return () => undefined;
  watches.add(brandId);
  try {
    const casesQuery = query(collection(firebaseDb(), "supportCases"), where("brandId", "==", brandId));
    const unsubscribe = onSnapshot(casesQuery, (snap) => {
      mergeRemote(snap.docs.map((item) => normalize({ ...(item.data() as SupportCase), id: item.id })));
    }, () => undefined);
    return () => { watches.delete(brandId); unsubscribe(); };
  } catch {
    watches.delete(brandId);
    return () => undefined;
  }
}

export function useSupportCases(brandId: string) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    const stop = watchBrandSupport(brandId);
    return () => { listeners.delete(listener); stop(); };
  }, [brandId]);
  return cache.filter((item) => item.brandId === brandId).sort((a, b) => b.lastAt - a.lastAt);
}

function addLocal(item: SupportCase) {
  cache = [item, ...cache.filter((row) => row.id !== item.id)];
  void persist();
  emit();
}

export type CreateSupportInput = Omit<SupportCase, "id" | "status" | "priority" | "lastAt" | "createdAt" | "updatedAt"> & { priority?: SupportPriority };
export async function createSupportCase(input: CreateSupportInput) {
  const now = Date.now();
  const item: SupportCase = { ...input, id: `sc-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, status: "open", priority: input.priority || "normal", lastAt: now, createdAt: now, updatedAt: now };
  if (firebaseReady() && firebaseAuth().currentUser) {
    const call = httpsCallable(firebaseFunctions(), "createSupportCase");
    await call(item);
  }
  addLocal(item);
  return item;
}

export async function updateSupportCase(caseId: string, patch: Partial<Pick<SupportCase, "status" | "priority" | "assigneeUid" | "assigneeName" | "lastMessage">>) {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Support updates require a signed-in connection to Uvel.");
  const call = httpsCallable(firebaseFunctions(), "updateSupportCase");
  await call({ caseId, patch });
  const now = Date.now();
  cache = cache.map((item) => item.id === caseId ? { ...item, ...patch, updatedAt: now, lastAt: now } : item);
  void persist();
  emit();
}

export function localUpdateSupportCase(caseId: string, patch: Partial<SupportCase>) {
  cache = cache.map((item) => item.id === caseId ? { ...item, ...patch, updatedAt: Date.now() } : item);
  void persist();
  emit();
}

function mergeNotes(caseId: string, rows: SupportNote[]) {
  const byId = new Map((noteCache[caseId] || []).map((note) => [note.id, note]));
  rows.forEach((note) => byId.set(note.id, { ...note, createdAt: millis(note.createdAt) }));
  noteCache[caseId] = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
  emit();
}

export function useInternalNotes(caseId: string) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    if (caseId && !noteWatches.has(caseId) && firebaseReady() && firebaseAuth().currentUser) {
      noteWatches.add(caseId);
      const notesQuery = query(collection(firebaseDb(), "supportCases", caseId, "notes"), orderBy("createdAt", "desc"));
      const stop = onSnapshot(notesQuery, (snap) => mergeNotes(caseId, snap.docs.map((item) => ({ ...(item.data() as SupportNote), id: item.id, caseId }))), () => undefined);
      return () => { listeners.delete(listener); noteWatches.delete(caseId); stop(); };
    }
    return () => { listeners.delete(listener); };
  }, [caseId]);
  return noteCache[caseId] || [];
}

export async function addSupportInternalNote(caseId: string, body: string, authorName: string) {
  const clean = body.trim().slice(0, 500);
  if (!clean) throw new Error("Write an internal note first.");
  const now = Date.now();
  const note: SupportNote = { id: `note-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, caseId, authorUid: firebaseAuth().currentUser?.uid || "local", authorName: authorName || "Support agent", body: clean, createdAt: now };
  if (firebaseReady() && firebaseAuth().currentUser) {
    const call = httpsCallable(firebaseFunctions(), "addSupportInternalNote");
    await call(note);
  }
  noteCache[caseId] = [note, ...(noteCache[caseId] || [])];
  emit();
  return note;
}
