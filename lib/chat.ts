import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { firebaseDb, firebaseReady } from "./firebase";
import { sendPush } from "./push";

export type MsgStatus = "sending" | "sent" | "delivered" | "seen" | "failed";
export type OfferStatus = "pending" | "accepted" | "declined" | "expired";

export type ChatMsg = {
  id: string;
  text: string;
  from: string;
  kind: "text" | "offer" | "system";
  createdAt: number;
  photoUrl?: string;
  offerCents?: number;
  offerStatus?: OfferStatus;
  status?: MsgStatus;
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
  brandId?: string;
  brandName?: string;
  brandLogo?: string;
  brandVerified?: boolean;
  recipientIds?: string[];
  orderId?: string;
  supportCaseId?: string;
  lastText: string;
  lastAt: number;
  lastFrom: string;
  unreadBuyer: number;
  unreadSeller: number;
  typingBy: string;
  typingAt: number;
};

const KEY = "uvel-chat-v1";
const BLOCK_KEY = "uvel-chat-blocks-v1";
const memory = {
  threads: {} as Record<string, ChatThread>,
  messages: {} as Record<string, ChatMsg[]>,
};
const msgSubs = new Map<string, Set<(m: ChatMsg[]) => void>>();
const threadSubs = new Map<string, Set<(t: ChatThread) => void>>();
const inboxSubs = new Set<() => void>();
let hydrated = false;
let blockedUsers = new Set<string>();

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
  try {
    const blocks = await AsyncStorage.getItem(BLOCK_KEY);
    if (blocks) blockedUsers = new Set(JSON.parse(blocks) as string[]);
  } catch {
    blockedUsers = new Set();
  }
  inboxSubs.forEach((fn) => fn());
}
void hydrate();

export function isBlocked(uid: string) {
  return Boolean(uid && blockedUsers.has(uid));
}

export async function blockUser(uid: string) {
  if (!uid) return;
  blockedUsers.add(uid);
  await AsyncStorage.setItem(BLOCK_KEY, JSON.stringify(Array.from(blockedUsers)));
}

export async function reportConversation(threadId: string, reporterId: string, reason = "User reported a conversation") {
  if (!firebaseReady()) return false;
  try {
    await addDoc(collection(firebaseDb(), "chatReports"), { threadId, reporterId, reason, createdAt: Date.now() });
    return true;
  } catch {
    return false;
  }
}

function emitMsgs(id: string) {
  const list = memory.messages[id] ?? [];
  msgSubs.get(id)?.forEach((fn) => fn(list));
}

function emitThread(id: string) {
  const t = memory.threads[id];
  if (t) threadSubs.get(id)?.forEach((fn) => fn(t));
}

function emitInbox() {
  inboxSubs.forEach((fn) => fn());
}

function patchThread(id: string, patch: Partial<ChatThread>) {
  const t = memory.threads[id];
  if (!t) return;
  Object.assign(t, patch);
  emitThread(id);
  emitInbox();
}

export function threadId(buyerId: string, sellerId: string, pieceId: string, brandId?: string, contextId?: string) {
  const a = buyerId || "me";
  const b = brandId ? `brand:${brandId}` : sellerId || "seller";
  return `${[a, b].sort().join("_")}__${pieceId}${contextId ? `__${contextId}` : ""}`;
}

export function getThread(id: string) {
  return memory.threads[id];
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

export function clock(ms: number) {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${m} ${ap}`;
}

export function dayLabel(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  const same = d.toDateString() === now.toDateString();
  if (same) return "Today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  brandId?: string;
  brandName?: string;
  brandLogo?: string;
  brandVerified?: boolean;
  recipientIds?: string[];
  orderId?: string;
  supportCaseId?: string;
  contextId?: string;
}): string {
  const id = threadId(input.buyerId, input.sellerId, input.pieceId, input.brandId, input.contextId);
  const prev = memory.threads[id];
  memory.threads[id] = {
    ...(prev || {}),
    ...input,
    id,
    lastText: prev?.lastText ?? "",
    lastAt: prev?.lastAt ?? Date.now(),
    lastFrom: prev?.lastFrom ?? "",
    unreadBuyer: prev?.unreadBuyer ?? 0,
    unreadSeller: prev?.unreadSeller ?? 0,
    typingBy: prev?.typingBy ?? "",
    typingAt: prev?.typingAt ?? 0,
  };
  if (!memory.messages[id]) memory.messages[id] = [];
  void persist();
  emitInbox();
  emitThread(id);
  if (firebaseReady()) {
    try {
      void setDoc(
        doc(firebaseDb(), "chats", id),
        { ...memory.threads[id], updatedAt: Date.now() },
        { merge: true },
      ).catch(() => undefined);
    } catch {
      /* Chat remains available locally if Firebase is unavailable on this device. */
    }
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
    try {
      const q = query(collection(firebaseDb(), "chats", id, "messages"), orderBy("createdAt", "desc"), limit(80));
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
              offerStatus: v.offerStatus,
              status: v.status ?? "delivered",
            };
          });
          const local = memory.messages[id] ?? [];
          const seen = new Set(remote.map((m) => `${m.from}|${m.createdAt}|${m.text}`));
          const extra = local.filter((m) => !seen.has(`${m.from}|${m.createdAt}|${m.text}`));
          const merged = [...remote, ...extra].sort((a, b) => a.createdAt - b.createdAt);
          memory.messages[id] = merged.map((m) => {
            const old = local.find((x) => x.id === m.id || (x.from === m.from && x.createdAt === m.createdAt && x.text === m.text));
            const rank = { failed: -1, sending: 0, sent: 1, delivered: 2, seen: 3 };
            const a = old?.status ?? "sent";
            const b = m.status ?? "delivered";
            return { ...m, status: (rank[b] > rank[a] ? b : a) as MsgStatus };
          });
          emitMsgs(id);
        },
        () => undefined,
      );
    } catch {
      /* Local chat remains available if the remote listener cannot be created. */
    }
  }
  return () => {
    set!.delete(onMsgs);
    unsubFs();
  };
}

export async function loadOlderMessages(id: string, before?: ChatMsg) {
  if (!firebaseReady() || !before) return [];
  try {
    const q = query(collection(firebaseDb(), "chats", id, "messages"), orderBy("createdAt", "desc"), startAfter(before.createdAt), limit(80));
    const snap = await getDocs(q);
    return snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ChatMsg, "id">) })).reverse();
  } catch {
    return [];
  }
}

export async function updateOfferStatus(threadId: string, messageId: string, status: OfferStatus) {
  const list = memory.messages[threadId] ?? [];
  memory.messages[threadId] = list.map((message) => message.id === messageId ? { ...message, offerStatus: status } : message);
  emitMsgs(threadId);
  void persist();
  if (firebaseReady()) {
    try {
      await updateDoc(doc(firebaseDb(), "chats", threadId, "messages", messageId), { offerStatus: status });
    } catch {
      // Preserve the local state and reconcile it on the next remote snapshot.
    }
  }
}

export function listenThread(id: string, onThread: (t: ChatThread) => void) {
  let set = threadSubs.get(id);
  if (!set) {
    set = new Set();
    threadSubs.set(id, set);
  }
  set.add(onThread);
  if (memory.threads[id]) onThread(memory.threads[id]);
  let unsubFs = () => undefined as void;
  if (firebaseReady()) {
    try {
      unsubFs = onSnapshot(
        doc(firebaseDb(), "chats", id),
        (snap) => {
          const v = snap.data() as Partial<ChatThread> | undefined;
          if (!v) return;
          const existing = memory.threads[id];
          const t: ChatThread = existing || {
            id,
            pieceId: String(v.pieceId || ""),
            buyerId: String(v.buyerId || ""),
            sellerId: String(v.sellerId || ""),
            pieceName: String(v.pieceName || "Listing"),
            piecePhoto: String(v.piecePhoto || ""),
            piecePriceCents: typeof v.piecePriceCents === "number" ? v.piecePriceCents : 0,
            sellerName: String(v.sellerName || "Seller"),
            buyerName: String(v.buyerName || "Buyer"),
            lastText: String(v.lastText || ""),
            lastAt: typeof v.lastAt === "number" ? v.lastAt : Date.now(),
            lastFrom: String(v.lastFrom || ""),
            unreadBuyer: typeof v.unreadBuyer === "number" ? v.unreadBuyer : 0,
            unreadSeller: typeof v.unreadSeller === "number" ? v.unreadSeller : 0,
            typingBy: String(v.typingBy || ""),
            typingAt: typeof v.typingAt === "number" ? v.typingAt : 0,
          };
          memory.threads[id] = {
            ...t,
            ...v,
            id,
            brandId: v.brandId || t.brandId,
            brandName: v.brandName || t.brandName,
            brandLogo: v.brandLogo || t.brandLogo,
            brandVerified: typeof v.brandVerified === "boolean" ? v.brandVerified : t.brandVerified,
            recipientIds: v.recipientIds || t.recipientIds,
          };
          emitThread(id);
          emitInbox();
        },
        () => undefined,
      );
    } catch {
      /* Local chat remains available if the remote listener cannot be created. */
    }
  }
  return () => {
    set!.delete(onThread);
    unsubFs();
  };
}

export function inboxFor(uid: string): ChatThread[] {
  return Object.values(memory.threads)
    .filter((t) => t.buyerId === uid || t.sellerId === uid || (t.recipientIds || []).includes(uid) || t.buyerId === "me" || t.sellerId === "seller")
    .sort((a, b) => b.lastAt - a.lastAt);
}

export function useInbox(uid: string) {
  const [, tick] = useState(0);
  useEffect(() => {
    const fn = () => tick((n) => n + 1);
    inboxSubs.add(fn);
    void hydrate().then(fn);
    const stops: Array<() => void> = [];
    if (firebaseReady() && uid && uid !== "me") {
      const upsert = (docSnap: { id: string; data: () => unknown }) => {
        const v = (docSnap.data() || {}) as Partial<ChatThread>;
        const current = memory.threads[docSnap.id];
        const next: ChatThread = current || {
          id: docSnap.id,
          pieceId: String(v.pieceId || ""),
          buyerId: String(v.buyerId || ""),
          sellerId: String(v.sellerId || ""),
          pieceName: String(v.pieceName || "Listing"),
          piecePhoto: String(v.piecePhoto || ""),
          piecePriceCents: typeof v.piecePriceCents === "number" ? v.piecePriceCents : 0,
          sellerName: String(v.sellerName || "Seller"),
          buyerName: String(v.buyerName || "Buyer"),
          lastText: String(v.lastText || ""),
          lastAt: typeof v.lastAt === "number" ? v.lastAt : Date.now(),
          lastFrom: String(v.lastFrom || ""),
          unreadBuyer: typeof v.unreadBuyer === "number" ? v.unreadBuyer : 0,
          unreadSeller: typeof v.unreadSeller === "number" ? v.unreadSeller : 0,
          typingBy: String(v.typingBy || ""),
          typingAt: typeof v.typingAt === "number" ? v.typingAt : 0,
        };
        memory.threads[docSnap.id] = { ...next, ...v, id: docSnap.id } as ChatThread;
      };
      const watch = (q: ReturnType<typeof query>) => {
        stops.push(onSnapshot(q, (snap) => {
          snap.docs.forEach(upsert);
          emitInbox();
        }, () => undefined));
      };
      watch(query(collection(firebaseDb(), "chats"), where("buyerId", "==", uid)));
      watch(query(collection(firebaseDb(), "chats"), where("sellerId", "==", uid)));
      watch(query(collection(firebaseDb(), "chats"), where("recipientIds", "array-contains", uid)));
    }
    return () => {
      inboxSubs.delete(fn);
      stops.forEach((stop) => stop());
    };
  }, [uid]);
  return inboxFor(uid);
}

export function unreadFor(t: ChatThread, uid: string) {
  const seller = t.sellerId === uid || t.sellerId === "seller" || (t.recipientIds || []).includes(uid);
  return seller ? t.unreadSeller || 0 : t.unreadBuyer || 0;
}

export function setTyping(id: string, uid: string, on: boolean) {
  patchThread(id, { typingBy: on ? uid : "", typingAt: on ? Date.now() : 0 });
  void persist();
  if (firebaseReady()) {
    try {
      void setDoc(
        doc(firebaseDb(), "chats", id),
        { typingBy: on ? uid : "", typingAt: on ? Date.now() : 0 },
        { merge: true },
      ).catch(() => undefined);
    } catch {
      /* Local typing state remains safe if Firebase is unavailable. */
    }
  }
}

export function markSeen(id: string, uid: string) {
  const list = memory.messages[id] ?? [];
  let changed = false;
  memory.messages[id] = list.map((m) => {
    if (m.from !== uid && m.status !== "seen") {
      changed = true;
      return { ...m, status: "seen" as const };
    }
    return m;
  });
  const t = memory.threads[id];
  if (t) {
    if (t.buyerId === uid) t.unreadBuyer = 0;
    else if (t.sellerId === uid || (t.recipientIds || []).includes(uid)) t.unreadSeller = 0;
  }
  if (changed) emitMsgs(id);
  emitThread(id);
  emitInbox();
  void persist();
  if (firebaseReady() && changed) {
    try {
      void setDoc(
        doc(firebaseDb(), "chats", id),
        { unreadBuyer: t?.unreadBuyer ?? 0, unreadSeller: t?.unreadSeller ?? 0, seenBy: uid, seenAt: Date.now() },
        { merge: true },
      ).catch(() => undefined);
    } catch {
      /* Local seen state remains safe if Firebase is unavailable. */
    }
  }
}

export async function sendChat(opts: {
  threadId: string;
  from: string;
  to: string;
  text: string;
  kind?: ChatMsg["kind"];
  offerCents?: number;
  offerStatus?: OfferStatus;
  photoUrl?: string;
  fromName: string;
  pieceId: string;
  toIds?: string[];
}): Promise<ChatMsg> {
  const msg: ChatMsg = {
    id: `m-${Date.now().toString(36)}`,
    text: opts.text.trim(),
    from: opts.from,
    kind: opts.kind ?? "text",
    createdAt: Date.now(),
    photoUrl: opts.photoUrl,
    offerCents: opts.offerCents,
    offerStatus: opts.offerStatus,
    status: "sending",
  };
  memory.messages[opts.threadId] = [...(memory.messages[opts.threadId] ?? []), msg];
  const thread = memory.threads[opts.threadId];
  if (thread) {
    thread.lastText = msg.text;
    thread.lastAt = msg.createdAt;
    thread.lastFrom = msg.from;
    thread.typingBy = "";
    thread.typingAt = 0;
    const toSeller = opts.to === thread.sellerId || opts.to === "seller" || Boolean(thread.recipientIds?.length && !(thread.recipientIds || []).includes(opts.from));
    if (toSeller) thread.unreadSeller = (thread.unreadSeller || 0) + 1;
    else thread.unreadBuyer = (thread.unreadBuyer || 0) + 1;
  }
  emitMsgs(opts.threadId);
  emitThread(opts.threadId);
  emitInbox();
  void persist();

  const markDelivered = () => {
    memory.messages[opts.threadId] = (memory.messages[opts.threadId] ?? []).map((m) =>
      m.id === msg.id && m.status !== "seen" ? { ...m, status: "delivered" as const } : m,
    );
    emitMsgs(opts.threadId);
    void persist();
  };
  const markFailed = () => {
    memory.messages[opts.threadId] = (memory.messages[opts.threadId] ?? []).map((m) =>
      m.id === msg.id ? { ...m, status: "failed" as const } : m,
    );
    emitMsgs(opts.threadId);
    void persist();
  };

  if (firebaseReady()) {
    try {
      void addDoc(collection(firebaseDb(), "chats", opts.threadId, "messages"), {
        text: msg.text,
        from: msg.from,
        kind: msg.kind,
        createdAt: msg.createdAt,
        offerCents: msg.offerCents ?? null,
        offerStatus: msg.offerStatus ?? null,
        photoUrl: msg.photoUrl ?? null,
        status: "delivered",
      }).then(markDelivered).catch(markFailed);
      void setDoc(
        doc(firebaseDb(), "chats", opts.threadId),
        {
          lastText: msg.text,
          lastAt: msg.createdAt,
          lastFrom: msg.from,
          unreadBuyer: thread?.unreadBuyer ?? 0,
          unreadSeller: thread?.unreadSeller ?? 0,
          typingBy: "",
          typingAt: 0,
        },
        { merge: true },
      ).catch(markFailed);
    } catch {
      markFailed();
    }
  }

  const recipients = Array.from(new Set((opts.toIds?.length ? opts.toIds : [opts.to]).filter((uid) => uid && uid !== opts.from)));
  await Promise.all(
    recipients.map(async (uid) => {
      const other = await readUserLite(uid);
      const token = typeof other?.expoPushToken === "string" ? other.expoPushToken : "";
      if (token) {
        void sendPush(token, opts.fromName || "Uvel", msg.text, {
          pieceId: opts.pieceId,
          threadId: opts.threadId,
          brandId: thread?.brandId || "",
        });
      }
    }),
  );
  return msg;
}
