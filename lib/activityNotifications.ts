import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type ActivityNotificationKind = "more_like" | "not_interested" | "bookmark";

export type ActivityNotification = {
  id: string;
  kind: ActivityNotificationKind;
  title: string;
  body: string;
  lookId: string;
  imageUrl?: string;
  target: "saved" | "none";
  at: number;
  read: boolean;
};

const MAX = 100;
const KEY_PREFIX = "uvel-activity-notifications-v1:";
let activeUid = "";
let notifications: ActivityNotification[] = [];
let loading: Promise<ActivityNotification[]> | null = null;
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
  emit();
}
