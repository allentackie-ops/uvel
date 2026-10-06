import { httpsCallable } from "firebase/functions";
import { firebaseFunctions, firebaseReady } from "./firebase";
import { mirrorSocialProfiles, pollSocial, searchSupabaseUsers, socialCall } from "./supabaseSocial";

export type PublicUser = { uid: string; username: string; displayName: string; avatarUri?: string };
export type FriendNotification = { id: string; kind: "friend_request" | "friend_accepted" | "friend_added"; requestId: string; actor: PublicUser; readAt?: unknown; createdAt?: unknown };

export async function searchUsers(term: string) {
  try {
    const users = await searchSupabaseUsers(term);
    if (users.length) return users;
  } catch { /* use Firebase search while profiles are being seeded */ }
  if (!firebaseReady()) return [] as PublicUser[];
  const call = httpsCallable<{ term: string }, { users: PublicUser[] }>(firebaseFunctions(), "searchUsers");
  const users = (await call({ term: term.trim() })).data.users || [];
  void mirrorSocialProfiles(users);
  return users;
}

export async function sendFriendRequest(toUid: string) {
  const result = await socialCall<{ requestId: string; status: string }>("send_request", { toUid });
  return result;
}

export async function addFriendFromShare(sharedByUid: string) {
  return socialCall<{ status: string; friendshipId: string }>("add_from_share", { sharedByUid });
}

export async function respondFriendRequest(requestId: string, action: "accepted" | "declined") {
  return socialCall<{ requestId: string; status: string }>("respond_request", { requestId, action });
}

export function subscribeFriendNotifications(_uid: string, callback: (items: FriendNotification[]) => void) {
  return pollSocial(async () => {
    const result = await socialCall<{ notifications: FriendNotification[] }>("notifications");
    return result.notifications || [];
  }, callback, 5000);
}
