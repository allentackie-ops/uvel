import { useEffect, useState } from "react";
import { sendPush } from "./push";
import { marketplaceCall } from "./supabaseMarketplace";

export type MsgStatus = "sending" | "sent" | "delivered" | "seen" | "failed";
export type OfferStatus = "pending" | "accepted" | "declined" | "expired";
export type ChatMsg = { id: string; text: string; from: string; kind: "text" | "offer" | "system"; createdAt: number; photoUrl?: string; offerCents?: number; offerId?: string; offerStatus?: OfferStatus; offerExpiresAt?: unknown; checkoutExpiresAt?: unknown; responseMessage?: string; fromName?: string; fromUsername?: string; fromPhoto?: string; status?: MsgStatus };
export type ChatThread = { id: string; pieceId: string; buyerId: string; sellerId: string; pieceName: string; piecePhoto: string; piecePriceCents: number; sellerName: string; buyerName: string; buyerPhoto?: string; buyerUsername?: string; brandId?: string; brandName?: string; brandLogo?: string; brandVerified?: boolean; recipientIds?: string[]; orderId?: string; supportCaseId?: string; lastText: string; lastAt: number; lastFrom: string; unreadBuyer: number; unreadSeller: number; typingBy: string; typingAt: number };
const memory = { threads: {} as Record<string, ChatThread>, messages: {} as Record<string, ChatMsg[]> };
const msgSubs = new Map<string, Set<(messages: ChatMsg[]) => void>>();
const threadSubs = new Map<string, Set<(thread: ChatThread) => void>>();
const inboxSubs = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setInterval>>();
const inboxLoads = new Map<string, Promise<void>>();
const asMs = (value: unknown) => typeof value === "number" ? value : Date.parse(String(value || "")) || Date.now();
function emitMessages(id: string) { msgSubs.get(id)?.forEach((callback) => callback(memory.messages[id] || [])); }
function emitThread(id: string) { const thread = memory.threads[id]; if (thread) threadSubs.get(id)?.forEach((callback) => callback(thread)); }
function emitInbox() { inboxSubs.forEach((callback) => callback()); }
function storeThread(thread: ChatThread) { memory.threads[thread.id] = { ...thread, lastAt: asMs(thread.lastAt), typingAt: asMs(thread.typingAt) }; emitThread(thread.id); emitInbox(); }
function storeMessages(id: string, messages: ChatMsg[]) { memory.messages[id] = messages.map((message) => ({ ...message, createdAt: asMs(message.createdAt) })).sort((a, b) => a.createdAt - b.createdAt); emitMessages(id); }
function startPoll(key: string, load: () => Promise<void>, interval = 2500) { void load(); const previous = timers.get(key); if (previous) clearInterval(previous); const timer = setInterval(() => { void load(); }, interval); timers.set(key, timer); return () => { clearInterval(timer); if (timers.get(key) === timer) timers.delete(key); }; }
export function isBlocked(_uid: string) { return false; }
export async function blockUser(uid: string) { if (uid) await marketplaceCall("block", { blockedUid: uid }); }
export async function reportConversation(threadId: string, _reporterId: string, reason = "User reported a conversation") { try { await marketplaceCall("report", { threadId, reason }); return true; } catch { return false; } }
export async function readUserLite(uid: string) { const result = await marketplaceCall<{ profile: { displayName?: string; expoPushToken?: string } | null }>("profile", { uid }); return result.profile ? { name: result.profile.displayName || "", expoPushToken: result.profile.expoPushToken || "" } : null; }
export function threadId(buyerId: string, sellerId: string, pieceId: string, brandId?: string, contextId?: string) { const a = buyerId || "me"; const b = brandId ? `brand:${brandId}` : sellerId || "seller"; return `${[a, b].sort().join("_")}__${pieceId}${contextId ? `__${contextId}` : ""}`; }
export function getThread(id: string) { return memory.threads[id]; }
export function lastSeenLabel(ms?: unknown) { const n = typeof ms === "number" ? ms : 0; if (!n) return ""; const min = Math.max(1, Math.round((Date.now() - n) / 60000)); if (min < 3) return "Active now"; if (min < 60) return `Last seen ${min} min ago`; const hr = Math.round(min / 60); if (hr < 24) return `Last seen ${hr} hour${hr === 1 ? "" : "s"} ago`; const d = Math.round(hr / 24); return `Last seen ${d} day${d === 1 ? "" : "s"} ago`; }
export function clock(ms: number) { const d = new Date(ms); const h = d.getHours(); const m = d.getMinutes().toString().padStart(2, "0"); return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`; }
export function dayLabel(ms: number) { const d = new Date(ms); const now = new Date(); if (d.toDateString() === now.toDateString()) return "Today"; const y = new Date(now); y.setDate(now.getDate() - 1); if (d.toDateString() === y.toDateString()) return "Yesterday"; return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
export function openThread(input: { pieceId: string; buyerId: string; sellerId: string; pieceName: string; piecePhoto: string; piecePriceCents: number; sellerName: string; buyerName: string; brandId?: string; brandName?: string; brandLogo?: string; brandVerified?: boolean; recipientIds?: string[]; orderId?: string; supportCaseId?: string; contextId?: string }): string {
  const id = threadId(input.buyerId, input.sellerId, input.pieceId, input.brandId, input.contextId); const existing = memory.threads[id];
  const thread: ChatThread = { ...(existing || {}), ...input, id, lastText: existing?.lastText || "", lastAt: existing?.lastAt || Date.now(), lastFrom: existing?.lastFrom || "", unreadBuyer: existing?.unreadBuyer || 0, unreadSeller: existing?.unreadSeller || 0, typingBy: existing?.typingBy || "", typingAt: existing?.typingAt || 0 };
  storeThread(thread); void marketplaceCall("upsert_thread", { thread }).catch(() => undefined); return id;
}
export function listenMessages(id: string, callback: (messages: ChatMsg[]) => void) { let set = msgSubs.get(id); if (!set) { set = new Set(); msgSubs.set(id, set); } set.add(callback); callback(memory.messages[id] || []); const stop = startPoll(`messages:${id}`, async () => { try { const result = await marketplaceCall<{ messages: ChatMsg[] }>("list_messages", { threadId: id }); storeMessages(id, result.messages || []); } catch { /* retain last server state */ } }); return () => { set!.delete(callback); stop(); }; }
export async function loadOlderMessages(id: string, before?: ChatMsg) { if (!before) return []; try { const result = await marketplaceCall<{ messages: ChatMsg[] }>("list_messages", { threadId: id }); return (result.messages || []).map((message) => ({ ...message, createdAt: asMs(message.createdAt) })).filter((message) => message.createdAt < before.createdAt).slice(-80); } catch { return []; } }
export async function updateOfferStatus(threadIdValue: string, messageId: string, status: OfferStatus) { await marketplaceCall("update_message", { threadId: threadIdValue, messageId, offerStatus: status }); }
export function listenThread(id: string, callback: (thread: ChatThread) => void) { let set = threadSubs.get(id); if (!set) { set = new Set(); threadSubs.set(id, set); } set.add(callback); if (memory.threads[id]) callback(memory.threads[id]); const stop = startPoll(`thread:${id}`, async () => { try { const result = await marketplaceCall<{ threads: ChatThread[] }>("list_threads"); const thread = (result.threads || []).find((item) => item.id === id); if (thread) storeThread(thread); } catch { /* retain local state */ } }); return () => { set!.delete(callback); stop(); }; }
export function inboxFor(uid: string) { return Object.values(memory.threads).filter((thread) => thread.buyerId === uid || thread.sellerId === uid || (thread.recipientIds || []).includes(uid)).sort((a, b) => b.lastAt - a.lastAt); }
export async function preloadMarketplaceInbox(uid: string) {
  if (!uid || uid === "me") return;
  const existing = inboxLoads.get(uid);
  if (existing) return existing;
  const request = (async () => {
    try {
      const result = await marketplaceCall<{ threads: ChatThread[] }>("list_threads");
      (result.threads || []).forEach(storeThread);
    } catch { /* retain the current cached inbox when offline */ }
  })();
  inboxLoads.set(uid, request);
  try { await request; } finally { if (inboxLoads.get(uid) === request) inboxLoads.delete(uid); }
}
export function useInbox(uid: string) { const [, tick] = useState(0); useEffect(() => { const notify = () => tick((value) => value + 1); inboxSubs.add(notify); const stop = startPoll(`inbox:${uid}`, () => preloadMarketplaceInbox(uid)); return () => { inboxSubs.delete(notify); stop(); }; }, [uid]); return inboxFor(uid); }
export function unreadFor(thread: ChatThread, uid: string) { return thread.buyerId === uid ? thread.unreadBuyer || 0 : thread.unreadSeller || 0; }
export function setTyping(id: string, uid: string, on: boolean) { const thread = memory.threads[id]; if (thread) { thread.typingBy = on ? uid : ""; thread.typingAt = on ? Date.now() : 0; emitThread(id); } void marketplaceCall("set_typing", { threadId: id, on }).catch(() => undefined); }
export function markSeen(id: string, uid: string) { const thread = memory.threads[id]; if (thread) { if (thread.buyerId === uid) thread.unreadBuyer = 0; else thread.unreadSeller = 0; emitThread(id); emitInbox(); } void marketplaceCall("mark_seen", { threadId: id }).catch(() => undefined); }
export async function sendChat(opts: { threadId: string; from: string; to: string; text: string; kind?: ChatMsg["kind"]; offerCents?: number; offerStatus?: OfferStatus; photoUrl?: string; fromName: string; pieceId: string; pieceName?: string; toIds?: string[] }): Promise<ChatMsg> {
  const optimistic: ChatMsg = { id: `local-${Date.now().toString(36)}`, text: opts.text.trim(), from: opts.from, kind: opts.kind || "text", createdAt: Date.now(), photoUrl: opts.photoUrl, offerCents: opts.offerCents, offerStatus: opts.offerStatus, status: "sending" };
  memory.messages[opts.threadId] = [...(memory.messages[opts.threadId] || []), optimistic]; emitMessages(opts.threadId);
  try {
    const result = await marketplaceCall<{ message: ChatMsg }>("send_message", { threadId: opts.threadId, text: optimistic.text, kind: optimistic.kind, offerCents: opts.offerCents, offerStatus: opts.offerStatus, photoUrl: opts.photoUrl || "", fromName: opts.fromName, pieceId: opts.pieceId });
    const sent = { ...result.message, createdAt: asMs(result.message.createdAt), status: "delivered" as const }; memory.messages[opts.threadId] = [...(memory.messages[opts.threadId] || []).filter((message) => message.id !== optimistic.id), sent]; emitMessages(opts.threadId);
    const thread = memory.threads[opts.threadId]; if (thread) { thread.lastText = sent.text || "Sent a photo"; thread.lastAt = sent.createdAt; thread.lastFrom = sent.from; thread.typingBy = ""; thread.typingAt = 0; emitThread(opts.threadId); emitInbox(); }
    const recipients = Array.from(new Set((opts.toIds?.length ? opts.toIds : [opts.to]).filter((uid) => uid && uid !== opts.from))); await Promise.all(recipients.map(async (recipient) => { const profile = await readUserLite(recipient).catch(() => null); if (profile?.expoPushToken) void sendPush(profile.expoPushToken, `${opts.fromName || "Uvel"} sent you a message`, sent.text || `Asked about ${opts.pieceName || "a listing"}`, { kind: "listing_message", pieceId: opts.pieceId, threadId: opts.threadId }); }));
    return sent;
  } catch (error) { memory.messages[opts.threadId] = (memory.messages[opts.threadId] || []).map((message) => message.id === optimistic.id ? { ...message, status: "failed" } : message); emitMessages(opts.threadId); throw error; }
}
