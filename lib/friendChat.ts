import { pollSocial, socialCall } from "./supabaseSocial";
import { marketplaceCall } from "./supabaseMarketplace";
import { useEffect, useState } from "react";
import type { PublicUser } from "./friends";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type FriendMessage = { id: string; text: string; from: string; photoUrl?: string; createdAt?: unknown; status?: string; replyTo?: { id: string; text: string; from: string; photoUrl?: string } };
export type FriendChatPreview = { id: string; participantIds: string[]; lastText?: string; lastFrom?: string; lastAt?: unknown; unreadBy?: Record<string, number>; blockedByMe?: boolean; blockedByThem?: boolean; blockedInitial?: string; hidden?: boolean };

export function friendMessagePreview(text?: string) {
  if (!text) return "";
  const voicePrefix = "uvel_voice_note:";
  if (text.startsWith(voicePrefix)) {
    try {
      const note = JSON.parse(text.slice(voicePrefix.length)) as { durationMs?: unknown };
      const totalSeconds = Math.max(0, Math.floor(Number(note.durationMs) / 1000));
      return `Voice note · ${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
    } catch { return "Voice note"; }
  }
  const sharedPrefix = "uvel_shared_listing:";
  if (!text.startsWith(sharedPrefix)) return text;
  try {
    const shared = JSON.parse(text.slice(sharedPrefix.length)) as { name?: unknown };
    return typeof shared.name === "string" && shared.name ? `Shared listing: ${shared.name}` : "Shared a listing";
  } catch {
    return "Shared a listing";
  }
}

export async function listFriends() {
  const result = await socialCall<{ users: PublicUser[] }>("list_friends");
  return result.users || [];
}

export async function createFriendChat(otherUid: string) {
  const result = await socialCall<{ conversationId: string }>("create_chat", { otherUid });
  return result.conversationId;
}

export async function sendFriendMessage(conversationId: string, text: string, photoUrl?: string, replyTo?: string) {
  return socialCall<{ messageId: string }>("send_message", { conversationId, text, photoUrl: photoUrl || "", replyTo: replyTo || "" });
}

export async function sendFriendVoiceMessage(conversationId: string, base64: string, contentType: string, text: string, replyTo?: string) {
  return socialCall<{ messageId: string; audioUrl: string }>("send_voice_message", { conversationId, base64, contentType, text, replyTo: replyTo || "" });
}

export async function deleteFriendMessage(conversationId: string, messageId: string) {
  return socialCall<{ ok: boolean }>("delete_message", { conversationId, messageId });
}

export async function listFriendChats() {
  const result = await socialCall<{ chats: FriendChatPreview[] }>("list_chats");
  return result.chats || [];
}

export type FriendInboxSnapshot = { friends: PublicUser[]; chats: FriendChatPreview[] };
const FRIEND_INBOX_CACHE_PREFIX = "uvel-friend-inbox-v1:";
const friendInboxCache = new Map<string, FriendInboxSnapshot>();
const friendInboxRequests = new Map<string, Promise<FriendInboxSnapshot>>();
const friendMessageCache = new Map<string, FriendMessage[]>();
const friendInboxListeners = new Map<string, Set<(snapshot: FriendInboxSnapshot) => void>>();

function publishFriendInbox(uid: string, snapshot: FriendInboxSnapshot) {
  friendInboxCache.set(uid, snapshot);
  friendInboxListeners.get(uid)?.forEach((listener) => listener(snapshot));
}

export function getCachedFriendInbox(uid: string) {
  return friendInboxCache.get(uid) || null;
}

export async function restoreFriendInboxCache(uid: string) {
  if (!uid || uid === "me") return null;
  const cached = friendInboxCache.get(uid);
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(`${FRIEND_INBOX_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<FriendInboxSnapshot>;
    if (!Array.isArray(value.friends) || !Array.isArray(value.chats)) return null;
    const snapshot = { friends: value.friends as PublicUser[], chats: value.chats as FriendChatPreview[] };
    const newer = friendInboxCache.get(uid);
    if (newer) return newer;
    publishFriendInbox(uid, snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

export async function refreshFriendInbox(uid: string): Promise<FriendInboxSnapshot> {
  if (!uid || uid === "me") return { friends: [], chats: [] };
  const existing = friendInboxRequests.get(uid);
  if (existing) return existing;
  const request = (async () => {
    const [friends, chats] = await Promise.all([listFriends(), listFriendChats()]);
    const snapshot = { friends, chats };
    const previous = friendInboxCache.get(uid);
    publishFriendInbox(uid, snapshot);
    if (!previous || JSON.stringify(previous) !== JSON.stringify(snapshot)) {
      void AsyncStorage.setItem(`${FRIEND_INBOX_CACHE_PREFIX}${uid}`, JSON.stringify(snapshot)).catch(() => undefined);
    }
    chats.slice(0, 5).forEach((chat) => {
      if (!friendMessageCache.has(chat.id)) void preloadFriendMessages(chat.id).catch(() => undefined);
    });
    return snapshot;
  })();
  friendInboxRequests.set(uid, request);
  try {
    return await request;
  } finally {
    if (friendInboxRequests.get(uid) === request) friendInboxRequests.delete(uid);
  }
}

export function subscribeFriendInbox(uid: string, callback: (snapshot: FriendInboxSnapshot) => void, intervalMs = 8000) {
  if (!uid || uid === "me") return () => undefined;
  let listeners = friendInboxListeners.get(uid);
  if (!listeners) {
    listeners = new Set();
    friendInboxListeners.set(uid, listeners);
  }
  listeners.add(callback);
  const cached = friendInboxCache.get(uid);
  if (cached) callback(cached);
  void restoreFriendInboxCache(uid).then((snapshot) => { if (snapshot) callback(snapshot); });
  const stop = pollSocial(() => refreshFriendInbox(uid), () => undefined, intervalMs);
  return () => {
    listeners?.delete(callback);
    stop();
    if (listeners?.size === 0) friendInboxListeners.delete(uid);
  };
}

export function getCachedFriendMessages(conversationId: string) {
  return friendMessageCache.get(conversationId);
}

export async function preloadFriendMessages(conversationId: string) {
  const result = await socialCall<{ messages: FriendMessage[] }>("list_messages", { conversationId });
  const next = result.messages || [];
  friendMessageCache.set(conversationId, next);
  return next;
}

export async function markFriendChatRead(conversationId: string) {
  return socialCall<{ ok: boolean }>("mark_read", { conversationId });
}

export function useFriendChatUnread(uid: string) {
  const [unread, setUnread] = useState(() => (getCachedFriendInbox(uid)?.chats || []).reduce((total, chat) => total + Number(chat.unreadBy?.[uid] || 0), 0));

  useEffect(() => {
    if (!uid || uid === "me") {
      setUnread(0);
      return () => undefined;
    }
    let active = true;
    const update = (snapshot: FriendInboxSnapshot) => {
      if (active) setUnread(snapshot.chats.reduce((total, chat) => total + Number(chat.unreadBy?.[uid] || 0), 0));
    };
    void restoreFriendInboxCache(uid).then((snapshot) => { if (active && snapshot) update(snapshot); });
    const stop = subscribeFriendInbox(uid, update, 5000);
    return () => { active = false; stop(); };
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

export async function unblockFriend(blockedUid: string) {
  return socialCall<{ ok: boolean }>("unblock", { blockedUid });
}

export async function unfriendFriend(otherUid: string) {
  return socialCall<{ ok: boolean }>("unfriend", { otherUid });
}

export async function deleteFriendChat(conversationId: string) {
  return socialCall<{ ok: boolean }>("delete_chat", { conversationId });
}

export async function getFriendConversationStatus(conversationId: string) {
  return socialCall<{ isFriend: boolean; blockedByMe: boolean; blockedByThem: boolean; blockedInitial?: string; hidden: boolean }>("conversation_status", { conversationId });
}

export async function reportFriendConversation(conversationId: string, reason: string) {
  return socialCall<{ reported: boolean }>("report", { conversationId, reason });
}

export function subscribeFriendMessages(conversationId: string, callback: (messages: FriendMessage[]) => void, onError?: (error: unknown) => void) {
  return pollSocial(async () => {
    const result = await socialCall<{ messages: FriendMessage[] }>("list_messages", { conversationId });
    return result.messages || [];
  }, (messages) => {
    friendMessageCache.set(conversationId, messages);
    callback(messages);
  }, 2500, onError);
}
