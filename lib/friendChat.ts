import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firebaseDb, firebaseFunctions, firebaseReady } from "./firebase";
import type { PublicUser } from "./friends";

export type FriendMessage = { id: string; text: string; from: string; createdAt?: unknown; status?: string };

export async function listFriends() {
  if (!firebaseReady()) return [] as PublicUser[];
  const call = httpsCallable<undefined, { users: PublicUser[] }>(firebaseFunctions(), "listFriends");
  return (await call(undefined)).data.users || [];
}

export async function createFriendChat(otherUid: string) {
  if (!firebaseReady()) throw new Error("Friend chat is unavailable offline.");
  const call = httpsCallable<{ otherUid: string }, { conversationId: string }>(firebaseFunctions(), "createFriendChat");
  return (await call({ otherUid })).data.conversationId;
}

export async function sendFriendMessage(conversationId: string, text: string) {
  if (!firebaseReady()) throw new Error("Friend chat is unavailable offline.");
  const call = httpsCallable<{ conversationId: string; text: string }, { messageId: string }>(firebaseFunctions(), "sendFriendMessage");
  return (await call({ conversationId, text })).data;
}

export function subscribeFriendMessages(conversationId: string, callback: (messages: FriendMessage[]) => void) {
  if (!firebaseReady() || !conversationId) return () => undefined;
  const q = query(collection(firebaseDb(), "friendChats", conversationId, "messages"), orderBy("createdAt", "asc"), limit(100));
  return onSnapshot(q, (snap) => callback(snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<FriendMessage, "id">) }))), () => callback([]));
}
