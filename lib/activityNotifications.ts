import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { firebaseDb, firebaseReady } from "./firebase";

export type ActivityNotificationKind = "more_like" | "not_interested" | "bookmark" | "seller_listing" | "offer_received" | "offer_accepted" | "offer_declined" | "offer_expired" | "mirror_ready" | "mirror_failed";

export type ActivityNotification = {
  id: string;
  kind: ActivityNotificationKind;
  title: string;
  body: string;
  lookId: string;
  imageUrl?: string;
  target: "saved" | "none";
  offerId?: string;
  threadId?: string;
  mirrorJobId?: string;
  at: number;
  read: boolean;
};

const MAX = 100;
const KEY_PREFIX = "uvel-activity-notifications-v1:";
let activeUid = "";
let notifications: ActivityNotification[] = [];
let loading: Promise<ActivityNotification[]> | null = null;
let remoteUnsubscribe: (() => void) | null = null;
const listeners = new Set<() => void>();

function key(uid: string) {
  return `${KEY_PREFIX}${uid || "guest"}`;
}

function emit() {
  listeners.forEach((listener) => listener());
}

async function hydrate(uid: string) {
  const normalizedUid = uid || "guest";
  if (normalizedUid === activeUid && loading) return loading;
  if (normalizedUid === activeUid && !loading) return notifications;
  activeUid = normalizedUid;
  remoteUnsubscribe?.();
  remoteUnsubscribe = null;
  loading = AsyncStorage.getItem(key(normalizedUid))
    .then((raw) => {
      try {
        const parsed = raw ? (JSON.parse(raw) as ActivityNotification[]) : [];
        notifications = Array.isArray(parsed)
          ? parsed.filter((item) => item && typeof item.id === "string" && typeof item.title === "string")
          : [];
      } catch {
        notifications = [];
      }
      return notifications;
    })
    .catch(() => {
      notifications = [];
      return notifications;
    });
  await loading;
  loading = null;
  emit();
  if (firebaseReady() && uid) {
    remoteUnsubscribe = onSnapshot(collection(firebaseDb(), "users", uid, "notifications"), (snapshot) => {
      const remote = snapshot.docs.map((item) => {
        const data = item.data() as Record<string, unknown>;
        const rawKind = String(data.kind || "seller_listing");
        const kind: ActivityNotificationKind = ["offer_received", "offer_accepted", "offer_declined", "offer_expired", "mirror_ready", "mirror_failed"].includes(rawKind)
          ? rawKind as ActivityNotificationKind
          : "seller_listing";
        const createdAt = data.createdAt as { toMillis?: () => number } | undefined;
        const at = typeof data.createdAt === "number" ? data.createdAt : typeof createdAt?.toMillis === "function" ? createdAt.toMillis() : Date.now();
        return {
          id: item.id,
          kind,
          title: String(data.title || "New listing from someone you follow"),
          body: String(data.body || "A seller or brand you follow just posted something new."),
          lookId: String(data.listingId || data.lookId || ""),
          imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
          target: "none" as const,
          offerId: typeof data.offerId === "string" ? data.offerId : undefined,
          threadId: typeof data.threadId === "string" ? data.threadId : undefined,
          mirrorJobId: typeof data.mirrorJobId === "string" ? data.mirrorJobId : undefined,
          at,
          read: Boolean(data.readAt),
        };
      });
      const local = notifications.filter((item) => !remote.some((incoming) => incoming.id === item.id));
      notifications = [...remote, ...local].sort((a, b) => b.at - a.at).slice(0, MAX);
      emit();
    }, () => undefined);
  }
  return notifications;
}

async function persist() {
  try {
    await AsyncStorage.setItem(key(activeUid), JSON.stringify(notifications.slice(0, MAX)));
  } catch {
    // Activity remains available in memory for the current session.
  }
}

export function activityNotifications(uid: string) {
  return uid && uid === activeUid ? notifications.slice() : [];
}

export function unreadActivityCount(uid: string) {
  return activityNotifications(uid).filter((item) => !item.read).length;
}

export async function preloadActivityNotifications(uid: string) {
  await hydrate(uid);
  return activityNotifications(uid);
}

export function useActivityNotifications(uid: string) {
  const [, rerender] = useState(0);
  useEffect(() => {
    let active = true;
    const listener = () => {
      if (active) rerender((value) => value + 1);
    };
    listeners.add(listener);
    void hydrate(uid);
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, [uid]);
  return activityNotifications(uid);
}

export async function addActivityNotification(
  uid: string,
  input: Omit<ActivityNotification, "id" | "at" | "read">,
) {
  await hydrate(uid);
  const at = Date.now();
  notifications = [
    { ...input, id: `activity:${input.kind}:${input.lookId}:${at}`, at, read: false },
    ...notifications,
  ].slice(0, MAX);
  await persist();
  emit();
}

export async function markActivityNotificationRead(uid: string, id: string) {
  await hydrate(uid);
  notifications = notifications.map((item) => (item.id === id ? { ...item, read: true } : item));
  await persist();
  if (firebaseReady() && id) {
    void updateDoc(doc(firebaseDb(), "users", uid, "notifications", id), { readAt: Date.now() }).catch(() => undefined);
  }
  emit();
}
