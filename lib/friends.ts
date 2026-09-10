import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firebaseDb, firebaseFunctions, firebaseReady } from "./firebase";

export type PublicUser = { uid: string; username: string; displayName: string; avatarUri?: string };
export type FriendNotification = { id: string; kind: "friend_request" | "friend_accepted"; requestId: string; actor: PublicUser; readAt?: unknown; createdAt?: unknown };

export async function searchUsers(term: string) {
  if (!firebaseReady()) return [] as PublicUser[];
  const call = httpsCallable<{ term: string }, { users: PublicUser[] }>(firebaseFunctions(), "searchUsers");
  const result = await call({ term: term.trim() });
  return result.data.users || [];
}

export async function sendFriendRequest(toUid: string) {
  if (!firebaseReady()) throw new Error("Friends are unavailable offline.");
  const call = httpsCallable<{ toUid: string }, { requestId: string; status: string }>(firebaseFunctions(), "sendFriendRequest");
  return (await call({ toUid })).data;
}

export async function respondFriendRequest(requestId: string, action: "accepted" | "declined") {
  if (!firebaseReady()) throw new Error("Friends are unavailable offline.");
  const call = httpsCallable<{ requestId: string; action: string }, { requestId: string; status: string }>(firebaseFunctions(), "respondFriendRequest");
  return (await call({ requestId, action })).data;
}

export function subscribeFriendNotifications(uid: string, callback: (items: FriendNotification[]) => void) {
  if (!firebaseReady() || !uid) return () => undefined;
  const q = query(collection(firebaseDb(), "users", uid, "notifications"), where("kind", "in", ["friend_request", "friend_accepted"]), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<FriendNotification, "id">) })));
  }, () => callback([]));
}
