import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { firebaseDb, firebaseReady } from "./firebase";
import { sendPush } from "./push";

export type ChatMsg = {
  id: string;
  text: string;
  from: string;
  kind: "text" | "offer" | "system";
  createdAt: number;
  photoUrl?: string;
  offerCents?: number;
};

export type ChatThread = {
  id: string;
  pieceId: string;
  buyerId: string;
  sellerId: string;
  pieceName: string;
  piecePhoto: string;
  piecePriceCents: number;
  sellerName: string;
  buyerName: string;
  lastText: string;
  lastAt: number;
  lastFrom: string;
};

const KEY = "uvel-chat-v1";
const memory = {
  threads: {} as Record<string, ChatThread>,
  messages: {} as Record<string, ChatMsg[]>,
};
const msgSubs = new Map<string, Set<(m: ChatMsg[]) => void>>();
const inboxSubs = new Set<() => void>();
let hydrated = false;

async function persist() {
  await AsyncStorage.setItem(KEY, JSON.stringify(memory));
}

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as typeof memory;
      memory.threads = parsed.threads ?? {};
      memory.messages = parsed.messages ?? {};
    }
  } catch {
    /* empty */
  }
  inboxSubs.forEach((fn) => fn());
}
void hydrate();

function emitMsgs(id: string) {
  const list = memory.messages[id] ?? [];
  msgSubs.get(id)?.forEach((fn) => fn(list));
}

function emitInbox() {
  inboxSubs.forEach((fn) => fn());
}

export function threadId(buyerId: string, sellerId: string, pieceId: string) {
  const a = buyerId || "me";
  const b = sellerId || "seller";
  return `${[a, b].sort().join("_")}__${pieceId}`;
}

export async function readUserLite(uid: string) {
  if (!uid || !firebaseReady()) return null;
  try {
    const snap = await getDoc(doc(firebaseDb(), "users", uid));
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function lastSeenLabel(ms?: unknown) {
  const n = typeof ms === "number" ? ms : 0;
  if (!n) return "";
  const min = Math.max(1, Math.round((Date.now() - n) / 60000));
  if (min < 3) return "Active now";
  if (min < 60) return `Last seen ${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `Last seen ${hr} hour${hr === 1 ? "" : "s"} ago`;
  const d = Math.round(hr / 24);
  return `Last seen ${d} day${d === 1 ? "" : "s"} ago`;
}

export function openThread(input: {
  pieceId: string;
  buyerId: string;
  sellerId: string;
  pieceName: string;
  piecePhoto: string;
  piecePriceCents: number;
  sellerName: string;
  buyerName: string;
}): string {
  const id = threadId(input.buyerId, input.sellerId, input.pieceId);
  const prev = memory.threads[id];
  memory.threads[id] = {
    id,
    ...input,
    lastText: prev?.lastText ?? "",
    lastAt: prev?.lastAt ?? Date.now(),
    lastFrom: prev?.lastFrom ?? "",
  };
  if (!memory.messages[id]) memory.messages[id] = [];
  void persist();
  emitInbox();
  if (firebaseReady()) {
    void setDoc(
      doc(firebaseDb(), "chats", id),
      { ...memory.threads[id], updatedAt: Date.now() },
      { merge: true },
    ).catch(() => undefined);
  }
  return id;
}

export function listenMessages(id: string, onMsgs: (msgs: ChatMsg[]) => void) {
  let set = msgSubs.get(id);
  if (!set) {
    set = new Set();
    msgSubs.set(id, set);
  }
  set.add(onMsgs);
  onMsgs(memory.messages[id] ?? []);
  let unsubFs = () => undefined as void;
  if (firebaseReady()) {
    const q = query(collection(firebaseDb(), "chats", id, "messages"), orderBy("createdAt", "asc"));
    unsubFs = onSnapshot(
      q,
      (snap) => {
        const remote: ChatMsg[] = snap.docs.map((d) => {
          const v = d.data() as ChatMsg;
          return {
            id: d.id,
            text: v.text ?? "",
            from: v.from ?? "",
            kind: v.kind ?? "text",
            createdAt: typeof v.createdAt === "number" ? v.createdAt : Date.now(),
            photoUrl: v.photoUrl,
            offerCents: v.offerCents,
          };
        });
        const local = memory.messages[id] ?? [];
        const seen = new Set(remote.map((m) => `${m.from}|${m.createdAt}|${m.text}`));
        const extra = local.filter((m) => !seen.has(`${m.from}|${m.createdAt}|${m.text}`));
        memory.messages[id] = [...remote, ...extra].sort((a, b) => a.createdAt - b.createdAt);
        emitMsgs(id);
      },
      () => undefined,
    );
  }
  return () => {
    set!.delete(onMsgs);
    unsubFs();
  };
}

export function inboxFor(uid: string): ChatThread[] {
  return Object.values(memory.threads)
    .filter((t) => t.buyerId === uid || t.sellerId === uid || t.buyerId === "me" || t.sellerId === "seller")
    .sort((a, b) => b.lastAt - a.lastAt);
}

export function useInbox(uid: string) {
  const [, tick] = useState(0);
  useEffect(() => {
    const fn = () => tick((n) => n + 1);
    inboxSubs.add(fn);
    void hydrate().then(fn);
    return () => {
      inboxSubs.delete(fn);
    };
  }, [uid]);
  return inboxFor(uid);
}

export async function sendChat(opts: {
  threadId: string;
  from: string;
  to: string;
  text: string;
  kind?: ChatMsg["kind"];
  offerCents?: number;
  photoUrl?: string;
  fromName: string;
  pieceId: string;
}): Promise<ChatMsg> {
  const msg: ChatMsg = {
    id: `m-${Date.now().toString(36)}`,
    text: opts.text.trim(),
    from: opts.from,
    kind: opts.kind ?? "text",
    createdAt: Date.now(),
    photoUrl: opts.photoUrl,
    offerCents: opts.offerCents,
  };
  memory.messages[opts.threadId] = [...(memory.messages[opts.threadId] ?? []), msg];
  const thread = memory.threads[opts.threadId];
  if (thread) {
    thread.lastText = msg.text;
    thread.lastAt = msg.createdAt;
    thread.lastFrom = msg.from;
  }
  emitMsgs(opts.threadId);
  emitInbox();
  void persist();

  if (firebaseReady()) {
    void addDoc(collection(firebaseDb(), "chats", opts.threadId, "messages"), {
      text: msg.text,
      from: msg.from,
      kind: msg.kind,
      createdAt: msg.createdAt,
      offerCents: msg.offerCents ?? null,
      photoUrl: msg.photoUrl ?? null,
    }).catch(() => undefined);
    void setDoc(
      doc(firebaseDb(), "chats", opts.threadId),
      { lastText: msg.text, lastAt: msg.createdAt, lastFrom: msg.from },
      { merge: true },
    ).catch(() => undefined);
  }

  if (opts.to && opts.to !== opts.from) {
    const other = await readUserLite(opts.to);
    const token = typeof other?.expoPushToken === "string" ? other.expoPushToken : "";
    if (token) {
      void sendPush(token, opts.fromName || "Uvel", msg.text, {
        pieceId: opts.pieceId,
        threadId: opts.threadId,
      });
    }
  }
  return msg;
}
