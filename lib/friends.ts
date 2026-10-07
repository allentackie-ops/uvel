import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { pollSocial, searchSupabaseUsers, socialCall } from "./supabaseSocial";

export type PublicUser = { uid: string; username: string; displayName: string; avatarUri?: string };
export type FriendNotification = { id: string; kind: "friend_request" | "friend_accepted" | "friend_added"; requestId: string; actor: PublicUser; readAt?: unknown; createdAt?: unknown };
const FRIEND_NOTIFICATIONS_KEY = "uvel-friend-notifications-v1:";
const friendNotificationCache = new Map<string, FriendNotification[]>();
const friendNotificationListeners = new Map<string, Set<(items: FriendNotification[]) => void>>();
const friendNotificationRequests = new Map<string, Promise<FriendNotification[]>>();

function publishFriendNotifications(uid: string, items: FriendNotification[]) {
  friendNotificationCache.set(uid, items);
  friendNotificationListeners.get(uid)?.forEach((listener) => listener(items));
  void AsyncStorage.setItem(`${FRIEND_NOTIFICATIONS_KEY}${uid}`, JSON.stringify(items)).catch(() => undefined);
}

export async function searchUsers(term: string) {
  return searchSupabaseUsers(term);
}

export async function sendFriendRequest(toUid: string) {
  const result = await socialCall<{ requestId: string; status: string }>("send_request", { toUid });
  return result;
}

export async function addFriendFromShare(sharedByUid: string) {
  return socialCall<{ status: string; friendshipId: string }>("add_from_share", { sharedByUid });
}

export async function respondFriendRequest(requestId: string, action: "accepted" | "declined") {
  return socialCall<{ requestId: string; status: string }>("respond_request", { requestId, decision: action });
}

export async function unfriendFriend(otherUid: string) {
  return socialCall<{ ok: boolean }>("unfriend", { otherUid });
}

export function getCachedFriendNotifications(uid: string) {
  return friendNotificationCache.get(uid) || [];
}

export async function restoreFriendNotifications(uid: string) {
  if (!uid || uid === "me") return [];
  const cached = friendNotificationCache.get(uid);
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(`${FRIEND_NOTIFICATIONS_KEY}${uid}`);
    const parsed = raw ? JSON.parse(raw) as FriendNotification[] : [];
    const valid = Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string" && item.actor) : [];
    if (!friendNotificationCache.has(uid)) publishFriendNotifications(uid, valid);
    return friendNotificationCache.get(uid) || valid;
  } catch {
    return friendNotificationCache.get(uid) || [];
  }
}

export async function listFriendNotifications(uid?: string) {
  if (uid) {
    const existing = friendNotificationRequests.get(uid);
    if (existing) return existing;
  }
  const request = (async () => {
    const result = await socialCall<{ notifications: FriendNotification[] }>("notifications");
    const notifications = result.notifications || [];
    if (uid) publishFriendNotifications(uid, notifications);
    return notifications;
  })();
  if (!uid) return request;
  friendNotificationRequests.set(uid, request);
  try {
    return await request;
  } finally {
    if (friendNotificationRequests.get(uid) === request) friendNotificationRequests.delete(uid);
  }
}

export function markFriendNotificationReadLocally(uid: string, id: string) {
  const items = friendNotificationCache.get(uid);
  if (!items) return;
  publishFriendNotifications(uid, items.map((item) => item.id === id ? { ...item, readAt: Date.now() } : item));
}

export async function markFriendNotificationRead(uid: string, id: string) {
  markFriendNotificationReadLocally(uid, id);
  return socialCall<{ ok: boolean }>("mark_notification_read", { notificationId: id });
}

export function subscribeFriendNotifications(uid: string, callback: (items: FriendNotification[]) => void) {
  if (!uid || uid === "me") return () => undefined;
  let listeners = friendNotificationListeners.get(uid);
  if (!listeners) {
    listeners = new Set();
    friendNotificationListeners.set(uid, listeners);
  }
  listeners.add(callback);
  const cached = friendNotificationCache.get(uid);
  if (cached) callback(cached);
  void restoreFriendNotifications(uid);
  const stop = pollSocial(() => listFriendNotifications(uid), () => undefined, 5000);
  return () => {
    listeners?.delete(callback);
    stop();
    if (listeners?.size === 0) friendNotificationListeners.delete(uid);
  };
}

export function useFriendNotifications(uid: string) {
  const [items, setItems] = useState<FriendNotification[]>(() => getCachedFriendNotifications(uid));
  useEffect(() => {
    if (!uid || uid === "me") {
      setItems([]);
      return () => undefined;
    }
    let active = true;
    void restoreFriendNotifications(uid).then((cached) => { if (active) setItems(cached); });
    const stop = subscribeFriendNotifications(uid, (next) => { if (active) setItems(next); });
    return () => { active = false; stop(); };
  }, [uid]);
  return items;
}
