import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firebaseDb, firebaseFunctions, firebaseReady } from "./firebase";
import type { PublicUser } from "./friends";

export type FriendMessage = { id: string; text: string; from: string; photoUrl?: string; createdAt?: unknown; status?: string };
export type FriendChatPreview = { id: string; participantIds: string[]; lastText?: string; lastFrom?: string; lastAt?: unknown; unreadBy?: Record<string, number> };

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

export async function sendFriendMessage(conversationId: string, text: string, photoUrl?: string) {
  if (!firebaseReady()) throw new Error("Friend chat is unavailable offline.");
  const call = httpsCallable<{ conversationId: string; text: string; photoUrl?: string }, { messageId: string }>(firebaseFunctions(), "sendFriendMessage");
  return (await call({ conversationId, text, photoUrl })).data;
}

export async function listFriendChats() {
  if (!firebaseReady()) return [] as FriendChatPreview[];
  const call = httpsCallable<undefined, { chats: FriendChatPreview[] }>(firebaseFunctions(), "listFriendChats");
  return (await call(undefined)).data.chats || [];
}

export async function uploadFriendAttachment(base64: string, contentType = "image/jpeg") {
  if (!firebaseReady()) throw new Error("Photo messages are unavailable offline.");
  const call = httpsCallable<{ base64: string; contentType: string }, { url: string }>(firebaseFunctions(), "uploadFriendAttachment");
  return (await call({ base64, contentType })).data.url;
}

export async function blockFriend(blockedUid: string) {
  const call = httpsCallable<{ blockedUid: string }, { blockedUid: string }>(firebaseFunctions(), "blockFriend");
  return (await call({ blockedUid })).data;
}

export async function reportFriendConversation(conversationId: string, reason: string) {
  const call = httpsCallable<{ conversationId: string; reason: string }, { reported: boolean }>(firebaseFunctions(), "reportFriendConversation");
  return (await call({ conversationId, reason })).data;
}

export function subscribeFriendMessages(conversationId: string, callback: (messages: FriendMessage[]) => void) {
  if (!firebaseReady() || !conversationId) return () => undefined;
  const q = query(collection(firebaseDb(), "friendChats", conversationId, "messages"), orderBy("createdAt", "asc"), limit(100));
  return onSnapshot(q, (snap) => callback(snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<FriendMessage, "id">) }))), () => callback([]));
}
