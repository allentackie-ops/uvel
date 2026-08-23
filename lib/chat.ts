import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
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
};

export function threadId(buyerId: string, sellerId: string, pieceId: string) {
  return `${[buyerId, sellerId].sort().join("_")}__${pieceId}`;
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
  if (!n) return "On Uvel";
  const min = Math.max(1, Math.round((Date.now() - n) / 60000));
  if (min < 3) return "Active now";
  if (min < 60) return `Last seen ${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `Last seen ${hr} hour${hr === 1 ? "" : "s"} ago`;
  const d = Math.round(hr / 24);
  return `Last seen ${d} day${d === 1 ? "" : "s"} ago`;
}

export async function openThread(input: {
  pieceId: string;
  buyerId: string;
  sellerId: string;
  pieceName: string;
  piecePhoto: string;
  piecePriceCents: number;
  sellerName: string;
  buyerName: string;
}): Promise<string> {
  const id = threadId(input.buyerId, input.sellerId, input.pieceId);
  if (!firebaseReady()) return id;
  try {
    await setDoc(
      doc(firebaseDb(), "chats", id),
      {
        ...input,
        lastText: "",
        lastAt: Date.now(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    /* local UI still works */
  }
  return id;
}

export function listenMessages(id: string, onMsgs: (msgs: ChatMsg[]) => void) {
  if (!firebaseReady()) {
    onMsgs([]);
    return () => undefined;
  }
  const q = query(collection(firebaseDb(), "chats", id, "messages"), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const msgs: ChatMsg[] = snap.docs.map((d) => {
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
      onMsgs(msgs);
    },
    () => onMsgs([]),
  );
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
}): Promise<boolean> {
  const createdAt = Date.now();
  const payload = {
    text: opts.text.trim(),
    from: opts.from,
    kind: opts.kind ?? "text",
    createdAt,
    offerCents: opts.offerCents ?? null,
    photoUrl: opts.photoUrl ?? null,
  };
  let ok = false;
  if (firebaseReady()) {
    try {
      await addDoc(collection(firebaseDb(), "chats", opts.threadId, "messages"), payload);
      await setDoc(
        doc(firebaseDb(), "chats", opts.threadId),
        { lastText: payload.text, lastAt: createdAt, lastFrom: opts.from },
        { merge: true },
      );
      ok = true;
    } catch {
      ok = false;
    }
  }
  if (opts.to && opts.to !== opts.from) {
    const other = await readUserLite(opts.to);
    const token = typeof other?.expoPushToken === "string" ? other.expoPushToken : "";
    if (token) {
      void sendPush(token, opts.fromName || "Uvel", payload.text, {
        pieceId: opts.pieceId,
        threadId: opts.threadId,
      });
    }
  }
  return ok;
}
