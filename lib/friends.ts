import { pollSocial, searchSupabaseUsers, socialCall } from "./supabaseSocial";

export type PublicUser = { uid: string; username: string; displayName: string; avatarUri?: string };
export type FriendNotification = { id: string; kind: "friend_request" | "friend_accepted" | "friend_added"; requestId: string; actor: PublicUser; readAt?: unknown; createdAt?: unknown };
const friendNotificationCache = new Map<string, FriendNotification[]>();
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

export function getCachedFriendNotifications(uid: string) {
  return friendNotificationCache.get(uid) || [];
}

export async function listFriendNotifications(uid?: string) {
  const result = await socialCall<{ notifications: FriendNotification[] }>("notifications");
  const notifications = result.notifications || [];
  if (uid) friendNotificationCache.set(uid, notifications);
  return notifications;
}

export function subscribeFriendNotifications(uid: string, callback: (items: FriendNotification[]) => void) {
  return pollSocial(async () => {
    return listFriendNotifications(uid);
  }, callback, 5000);
}
