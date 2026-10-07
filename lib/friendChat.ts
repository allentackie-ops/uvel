import { pollSocial, socialCall } from "./supabaseSocial";
import { marketplaceCall } from "./supabaseMarketplace";
import { useEffect, useState } from "react";
import type { PublicUser } from "./friends";

export type FriendMessage = { id: string; text: string; from: string; photoUrl?: string; createdAt?: unknown; status?: string };
export type FriendChatPreview = { id: string; participantIds: string[]; lastText?: string; lastFrom?: string; lastAt?: unknown; unreadBy?: Record<string, number> };

export async function listFriends() {
  const result = await socialCall<{ users: PublicUser[] }>("list_friends");
  return result.users || [];
}

export async function createFriendChat(otherUid: string) {
  const result = await socialCall<{ conversationId: string }>("create_chat", { otherUid });
  return result.conversationId;
}

export async function sendFriendMessage(conversationId: string, text: string, photoUrl?: string) {
  return socialCall<{ messageId: string }>("send_message", { conversationId, text, photoUrl: photoUrl || "" });
}

export async function listFriendChats() {
  const result = await socialCall<{ chats: FriendChatPreview[] }>("list_chats");
  return result.chats || [];
}

export async function markFriendChatRead(conversationId: string) {
  return socialCall<{ ok: boolean }>("mark_read", { conversationId });
}

export function useFriendChatUnread(uid: string) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!uid || uid === "me") {
      setUnread(0);
      return () => undefined;
    }
    return pollSocial(async () => {
      const chats = await listFriendChats();
      return chats.reduce((total, chat) => total + Number(chat.unreadBy?.[uid] || 0), 0);
    }, setUnread, 5000);
  }, [uid]);

  return unread;
}

export async function uploadFriendAttachment(base64: string, contentType = "image/jpeg") {
  const result = await marketplaceCall<{ url: string }>("upload_attachment", { base64, contentType });
  return result.url;
}

export async function blockFriend(blockedUid: string) {
  return socialCall<{ blockedUid: string }>("block", { blockedUid });
}

export async function reportFriendConversation(conversationId: string, reason: string) {
  return socialCall<{ reported: boolean }>("report", { conversationId, reason });
}

export function subscribeFriendMessages(conversationId: string, callback: (messages: FriendMessage[]) => void, onError?: (error: unknown) => void) {
  return pollSocial(async () => {
    const result = await socialCall<{ messages: FriendMessage[] }>("list_messages", { conversationId });
    return result.messages || [];
  }, callback, 2500, onError);
}
