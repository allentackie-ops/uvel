import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const FIREBASE_API_KEY = "AIzaSyBYacCvSdirUvZkw6nFZAjm894ZoAPAaPw";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-id-token" };
const text = (v: unknown, n = 2000) => String(v ?? "").trim().slice(0, n);
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const pair = (a: string, b: string) => [a, b].sort();
function pub(uid: string, row: any) { return { uid, username: text(row?.username, 40), displayName: text(row?.display_name, 120), avatarUri: text(row?.avatar_uri, 2000) || undefined }; }
async function firebaseUser(token: string) { const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }) }); if (!r.ok) return null; const d = await r.json(); const u = d.users?.[0]; return u?.localId ? String(u.localId) : null; }
async function blocked(a: string, b: string) { const { data, error } = await db.from("friend_blocks").select("id").or(`and(blocker_uid.eq.${a},blocked_uid.eq.${b}),and(blocker_uid.eq.${b},blocked_uid.eq.${a})`).limit(1); if (error) throw error; return Boolean(data?.length); }
async function areFriends(a: string, b: string) { const id = pair(a, b).join("_"); const { data, error } = await db.from("friendships").select("id").eq("id", id).maybeSingle(); if (error) throw error; return Boolean(data); }
async function profile(uid: string) { const { data, error } = await db.from("social_profiles").select("firebase_uid,username,display_name,avatar_uri").eq("firebase_uid", uid).maybeSingle(); if (error) throw error; return data ? pub(uid, data) : { uid, username: "", displayName: "Uvel member" }; }
async function syncProfile(uid: string, value: any) {
  const username = text(value?.username, 40).toLowerCase().replace(/^@+/, "");
  const displayName = text(value?.displayName, 120);
  const existing = await profile(uid);
  const storagePrefix = `${(Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "")}/storage/v1/object/public/profile-avatars/`;
  const requestedAvatar = text(value?.avatarUri, 2000);
  const currentAvatar = "avatarUri" in existing ? existing.avatarUri || "" : "";
  const avatarUri = requestedAvatar.startsWith(storagePrefix) ? requestedAvatar : currentAvatar.startsWith(storagePrefix) ? currentAvatar : null;
  const { error } = await db.from("social_profiles").upsert({ firebase_uid: uid, username, display_name: displayName, avatar_uri: avatarUri, updated_at: new Date().toISOString() }, { onConflict: "firebase_uid" });
  if (error) throw error;
  return pub(uid, { username, display_name: displayName, avatar_uri: avatarUri });
}
async function uploadProfileAvatar(uid: string, body: any) {
  const contentType = text(body?.contentType, 80).toLowerCase();
  const encoded = String(body?.base64 ?? "").trim().replace(/^data:image\/jpeg;base64,/i, "");
  if (contentType !== "image/jpeg" || !encoded || encoded.length > 2_100_000 || encoded.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return out({ error: "Choose a valid JPEG profile photo under 1.5 MB." }, 400);
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  if (bytes.length < 4 || bytes.length > 1_500_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return out({ error: "Choose a valid JPEG profile photo under 1.5 MB." }, 413);
  const { data: current, error: currentError } = await db.from("social_profiles").select("username,display_name").eq("firebase_uid", uid).maybeSingle();
  if (currentError) throw currentError;
  const path = `${uid}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await db.storage.from("profile-avatars").upload(path, bytes, { contentType, upsert: false, cacheControl: "31536000" });
  if (uploadError) throw uploadError;
  const { data: publicData } = db.storage.from("profile-avatars").getPublicUrl(path);
  const avatarUri = publicData.publicUrl;
  const { error: profileError } = await db.from("social_profiles").upsert({ firebase_uid: uid, username: current?.username || "", display_name: current?.display_name || "", avatar_uri: avatarUri, updated_at: new Date().toISOString() }, { onConflict: "firebase_uid" });
  if (profileError) throw profileError;
  return out({ avatarUri });
}
async function notify(recipientUid: string, kind: string, requestId: string, actor: any, id: string) { const { error } = await db.from("friend_notifications").upsert({ id, recipient_uid: recipientUid, kind, request_id: requestId, actor, read_at: null }, { onConflict: "id" }); if (error) throw error; }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return out({ error: "POST required" }, 405);
  try {
    const uid = await firebaseUser(text(req.headers.get("x-firebase-id-token"), 6000));
    if (!uid) return out({ error: "Firebase authentication failed" }, 401);
    const body = await req.json();
    const requestedAction = text(body.action, 40);
    const legacyDecision = ["accepted", "declined"].includes(requestedAction) ? requestedAction : "";
    const route = legacyDecision ? "respond_request" : requestedAction;
    if (route === "sync_profile") return out({ profile: await syncProfile(uid, body.profile) });
    if (route === "upload_profile_avatar") return await uploadProfileAvatar(uid, body);
    if (route === "search_users") { const term = text(body.term, 40).toLowerCase(); if (term.length < 2) return out({ users: [] }); const { data, error } = await db.from("social_profiles").select("firebase_uid,username,display_name,avatar_uri").neq("firebase_uid", uid).or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).limit(20); if (error) throw error; return out({ users: (data || []).map((r: any) => pub(r.firebase_uid, r)) }); }
    if (route === "send_request") { const toUid = text(body.toUid, 160); if (!toUid || toUid === uid || await blocked(uid, toUid)) return out({ error: "You can’t add this user." }, 403); const from = await profile(uid); const to = await profile(toUid); if (!to.uid || (!to.username && to.displayName === "Uvel member")) return out({ error: "User not found." }, 404); const id = `${uid}_${toUid}`; const { data: existing, error: existingError } = await db.from("friend_requests").select("status").eq("id", id).maybeSingle(); if (existingError) throw existingError; if (existing?.status === "accepted") return out({ requestId: id, status: "accepted" }); const { error } = await db.from("friend_requests").upsert({ id, from_uid: uid, to_uid: toUid, from_user: from, to_user: to, status: "pending" }, { onConflict: "id" }); if (error) throw error; await notify(toUid, "friend_request", id, from, id); return out({ requestId: id, status: "pending" }); }
    if (route === "add_from_share") { const other = text(body.sharedByUid, 160); if (!other || other === uid || await blocked(uid, other)) return out({ error: "You can’t add this user." }, 403); const ids = pair(uid, other); const id = ids.join("_"); const me = await profile(uid); const friend = await profile(other); const { error } = await db.from("friendships").upsert({ id, user_a: ids[0], user_b: ids[1], source: "shared_link" }, { onConflict: "id" }); if (error) throw error; await notify(uid, "friend_added", id, friend, `friend_added_${id}_${uid}`); await notify(other, "friend_added", id, me, `friend_added_${id}_${other}`); return out({ status: "added", friendshipId: id }); }
    if (route === "respond_request") {
      const requestId = text(body.requestId, 200);
      // `action` is the gateway route; `decision` carries accepted/declined.
      const decision = text(body.decision, 20) || legacyDecision;
      if (!["accepted", "declined"].includes(decision)) return out({ error: "That friend request action is not valid." }, 400);
      const { data: request, error: lookupError } = await db.from("friend_requests").select("*").eq("id", requestId).eq("to_uid", uid).eq("status", "pending").maybeSingle();
      if (lookupError) throw lookupError;
      if (!request) return out({ error: "That request is no longer available." }, 409);
      const { data: updated, error: updateError } = await db.from("friend_requests").update({ status: decision, responded_at: new Date().toISOString() }).eq("id", requestId).eq("to_uid", uid).eq("status", "pending").select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!updated) return out({ error: "That request is no longer available." }, 409);
      const { error: readError } = await db.from("friend_notifications").update({ read_at: new Date().toISOString() }).eq("id", requestId).eq("recipient_uid", uid);
      if (readError) throw readError;
      if (decision === "accepted") { const ids = pair(request.from_uid, request.to_uid); const friendshipId = ids.join("_"); const { error } = await db.from("friendships").upsert({ id: friendshipId, user_a: ids[0], user_b: ids[1] }, { onConflict: "id" }); if (error) throw error; await notify(request.from_uid, "friend_accepted", requestId, request.to_user, `friend_${friendshipId}`); }
      return out({ requestId, status: decision });
    }
    if (route === "notifications") { const { data, error } = await db.from("friend_notifications").select("id,kind,request_id,actor,read_at,created_at").eq("recipient_uid", uid).order("created_at", { ascending: false }).limit(100); if (error) throw error; return out({ notifications: (data || []).map((r: any) => ({ id: r.id, kind: r.kind, requestId: r.request_id, actor: r.actor, readAt: r.read_at, createdAt: r.created_at })) }); }
    if (route === "mark_notification_read") { const notificationId = text(body.notificationId, 200); if (!notificationId) return out({ error: "Notification is not valid." }, 400); const { error } = await db.from("friend_notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId).eq("recipient_uid", uid); if (error) throw error; return out({ ok: true }); }
    if (route === "list_friends") { const { data: rows, error } = await db.from("friendships").select("user_a,user_b").or(`user_a.eq.${uid},user_b.eq.${uid}`).limit(100); if (error) throw error; const ids = (rows || []).map((r: any) => r.user_a === uid ? r.user_b : r.user_a); if (!ids.length) return out({ users: [] }); const { data: blocks, error: blockError } = await db.from("friend_blocks").select("blocker_uid,blocked_uid").or(`blocker_uid.eq.${uid},blocked_uid.eq.${uid}`).limit(200); if (blockError) throw blockError; const blockedIds = new Set((blocks || []).map((r: any) => r.blocker_uid === uid ? r.blocked_uid : r.blocker_uid)); const visibleIds = ids.filter((id: string) => !blockedIds.has(id)); if (!visibleIds.length) return out({ users: [] }); const { data: profiles, error: profileError } = await db.from("social_profiles").select("firebase_uid,username,display_name,avatar_uri").in("firebase_uid", visibleIds); if (profileError) throw profileError; return out({ users: (profiles || []).map((r: any) => pub(r.firebase_uid, r)) }); }
    if (route === "create_chat") { const other = text(body.otherUid, 160); if (!other || other === uid || await blocked(uid, other)) return out({ error: "Messaging is unavailable for this user." }, 403); const ids = pair(uid, other); const chatId = ids.join("_"); if (!await areFriends(uid, other)) return out({ error: "You can only message friends." }, 403); const { error: upsertError } = await db.from("friend_chats").upsert({ id: chatId, user_a: ids[0], user_b: ids[1], hidden_a: false, hidden_b: false }, { onConflict: "id" }); if (upsertError) throw upsertError; return out({ conversationId: chatId }); }
    if (route === "mark_read") { const chatId = text(body.conversationId, 200); const ids = chatId.split("_"); if (ids.length !== 2 || !ids.includes(uid)) return out({ error: "You are not in this conversation." }, 403); const unreadColumn = uid === ids[0] ? "unread_a" : "unread_b"; const { error } = await db.from("friend_chats").update({ [unreadColumn]: 0 }).eq("id", chatId); if (error) throw error; const { error: messageError } = await db.from("friend_messages").update({ status: "read" }).eq("chat_id", chatId).neq("from_uid", uid).neq("status", "read"); if (messageError) throw messageError; return out({ ok: true }); }
    if (route === "list_chats") { const { data, error } = await db.from("friend_chats").select("*").or(`user_a.eq.${uid},user_b.eq.${uid}`).order("updated_at", { ascending: false }).limit(50); if (error) throw error; const rows = data || []; const ids = rows.map((r: any) => r.id); if (!ids.length) return out({ chats: [] }); const [{ data: friendships, error: friendshipError }, { data: blocks, error: blockError }] = await Promise.all([db.from("friendships").select("id").in("id", ids), db.from("friend_blocks").select("blocker_uid,blocked_uid").or(`blocker_uid.eq.${uid},blocked_uid.eq.${uid}`).limit(200)]); if (friendshipError) throw friendshipError; if (blockError) throw blockError; const friendshipIds = new Set((friendships || []).map((r: any) => r.id)); const blockByPeer = new Map<string, any>((blocks || []).map((r: any) => [r.blocker_uid === uid ? r.blocked_uid : r.blocker_uid, r] as [string, any])); const blockedPeers = Array.from(blockByPeer.entries()).filter(([, relation]) => relation.blocker_uid === uid).map(([peer]) => peer); const blockedInitials = new Map<string, string>(); if (blockedPeers.length) { const { data: profiles, error: profilesError } = await db.from("social_profiles").select("firebase_uid,username,display_name").in("firebase_uid", blockedPeers); if (profilesError) throw profilesError; (profiles || []).forEach((person: any) => blockedInitials.set(person.firebase_uid, String(person.display_name || person.username || "U").slice(0, 1).toUpperCase())); } const chats = rows.flatMap((r: any) => { const peer = r.user_a === uid ? r.user_b : r.user_a; const relation = blockByPeer.get(peer); const blockedByMe = Boolean(relation && relation.blocker_uid === uid); const blockedByThem = Boolean(relation && relation.blocked_uid === uid); const hidden = Boolean(r.user_a === uid ? r.hidden_a : r.hidden_b); if (hidden || blockedByThem || (!friendshipIds.has(r.id) && !blockedByMe)) return []; return [{ id: r.id, participantIds: [r.user_a, r.user_b], lastText: blockedByMe ? "Blocked" : r.last_text, lastFrom: blockedByMe ? "" : r.last_from, lastAt: r.last_at, unreadBy: { [r.user_a]: r.unread_a, [r.user_b]: r.unread_b }, blockedByMe, blockedByThem, blockedInitial: blockedByMe ? blockedInitials.get(peer) || "U" : undefined, hidden }]; }); return out({ chats }); }
    if (route === "list_messages") {
      const chatId = text(body.conversationId, 200); const ids = chatId.split("_");
      if (ids.length !== 2 || !ids.includes(uid)) return out({ error: "You are not in this conversation." }, 403);
      const { data: chat, error: chatError } = await db.from("friend_chats").select("user_a,user_b,hidden_a,hidden_b,cleared_a_at,cleared_b_at").eq("id", chatId).maybeSingle();
      if (chatError) throw chatError;
      if (!chat || ![chat.user_a, chat.user_b].includes(uid)) return out({ error: "Conversation not found." }, 404);
      const peerUid = chat.user_a === uid ? chat.user_b : chat.user_a;
      if (await blocked(uid, peerUid) || !await areFriends(uid, peerUid)) return out({ messages: [] });
      const hidden = uid === chat.user_a ? chat.hidden_a : chat.hidden_b;
      if (hidden) return out({ messages: [] });
      const clearedAt = uid === chat.user_a ? chat.cleared_a_at : chat.cleared_b_at;
      let messageQuery = db.from("friend_messages").select("id,text,from_uid,photo_url,created_at,status,reply_to").eq("chat_id", chatId).order("created_at", { ascending: true }).limit(100);
      if (clearedAt) messageQuery = messageQuery.gt("created_at", clearedAt);
      const { data: rows, error } = await messageQuery;
      if (error) throw error;
      const replyIds = Array.from(new Set((rows || []).map((row: any) => row.reply_to).filter(Boolean)));
      let quotedRows: any[] = [];
      if (replyIds.length) { let quoteQuery = db.from("friend_messages").select("id,text,from_uid,photo_url,created_at").in("id", replyIds); if (clearedAt) quoteQuery = quoteQuery.gt("created_at", clearedAt); const { data, error: quotedError } = await quoteQuery; if (quotedError) throw quotedError; quotedRows = data || []; }
      const quotedById = new Map(quotedRows.map((row: any) => [row.id, row]));
      return out({ messages: (rows || []).map((row: any) => { const quote: any = row.reply_to ? quotedById.get(row.reply_to) : null; return { id: row.id, text: row.text, from: row.from_uid, photoUrl: row.photo_url, createdAt: row.created_at, status: row.status, replyTo: quote ? { id: quote.id, text: quote.text, from: quote.from_uid, photoUrl: quote.photo_url } : undefined }; }) });
    }
    if (route === "send_voice_message") {
      const chatId = text(body.conversationId, 200);
      const message = text(body.text, 2000);
      const encoded = text(body.base64, 6_000_000);
      const contentType = text(body.contentType, 80).toLowerCase();
      const ids = chatId.split("_");
      if (ids.length !== 2 || !ids.includes(uid) || !message.startsWith("uvel_voice_note:") || !encoded) return out({ error: "That voice note is not valid." }, 400);
      if (!["audio/mp4", "audio/webm"].includes(contentType)) return out({ error: "That voice format is not supported." }, 400);
      if (encoded.length > Math.ceil(4 * 1024 * 1024 * 1.4)) return out({ error: "That voice note is too long." }, 413);
      const bytes = Uint8Array.from(atob(encoded.includes(",") ? encoded.split(",").pop()! : encoded), (char) => char.charCodeAt(0));
      if (!bytes.length || bytes.length > 4 * 1024 * 1024) return out({ error: "That voice note is too long." }, 413);
      const recipient = ids.find((participant) => participant !== uid)!;
      if (await blocked(uid, recipient)) return out({ error: "Messaging is unavailable for this user." }, 403);
      if (!await areFriends(uid, recipient)) return out({ error: "You can only message friends." }, 403);
      const { data: chat, error: chatError } = await db.from("friend_chats").select("id,user_a,user_b,unread_a,unread_b").eq("id", chatId).maybeSingle();
      if (chatError) throw chatError;
      if (!chat || ![chat.user_a, chat.user_b].includes(uid)) return out({ error: "Conversation not found." }, 404);
      const extension = contentType === "audio/mp4" ? "m4a" : "webm";
      const path = `${uid}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await db.storage.from("message-media").upload(path, bytes, { contentType, upsert: false, cacheControl: "31536000" });
      if (uploadError) throw uploadError;
      const { data: signed, error: signedError } = await db.storage.from("message-media").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signedError || !signed?.signedUrl) throw signedError || new Error("Voice note could not be opened.");
      const { data: sent, error: sendError } = await db.from("friend_messages").insert({ chat_id: chatId, from_uid: uid, text: message, photo_url: signed.signedUrl }).select("id").single();
      if (sendError) throw sendError;
      const now = new Date().toISOString();
      const update = uid === chat.user_a
        ? { last_text: message, last_from: uid, last_at: now, updated_at: now, unread_b: Number(chat.unread_b || 0) + 1, hidden_a: false, hidden_b: false }
        : { last_text: message, last_from: uid, last_at: now, updated_at: now, unread_a: Number(chat.unread_a || 0) + 1, hidden_a: false, hidden_b: false };
      const { error: updateError } = await db.from("friend_chats").update(update).eq("id", chatId);
      if (updateError) throw updateError;
      return out({ messageId: sent.id, audioUrl: signed.signedUrl });
    }
    if (route === "send_message") {
      const chatId = text(body.conversationId, 200); const message = text(body.text, 2000); const photoUrl = text(body.photoUrl, 2000) || null; const replyTo = text(body.replyTo, 40) || null; const ids = chatId.split("_");
      if (ids.length !== 2 || !ids.includes(uid) || (!message && !photoUrl)) return out({ error: "Message text or photo is required." }, 400);
      if (replyTo && !/^[0-9a-f-]{36}$/i.test(replyTo)) return out({ error: "That reply target is invalid." }, 400);
      const recipient = ids.find((x) => x !== uid)!; if (await blocked(uid, recipient)) return out({ error: "Messaging is unavailable for this user." }, 403); if (!await areFriends(uid, recipient)) return out({ error: "You can only message friends." }, 403);
      const { data: chat, error: chatError } = await db.from("friend_chats").select("id,user_a,user_b,unread_a,unread_b").eq("id", chatId).maybeSingle(); if (chatError) throw chatError; if (!chat) return out({ error: "Conversation not found." }, 404);
      if (replyTo) { const { data: target, error: targetError } = await db.from("friend_messages").select("id").eq("id", replyTo).eq("chat_id", chatId).maybeSingle(); if (targetError) throw targetError; if (!target) return out({ error: "The message you’re replying to is no longer available." }, 404); }
      const { data: sent, error } = await db.from("friend_messages").insert({ chat_id: chatId, from_uid: uid, text: message, photo_url: photoUrl, reply_to: replyTo }).select("id").single(); if (error) throw error;
      const now = new Date().toISOString(); const update = uid === chat.user_a ? { last_text: message || "Sent a photo", last_from: uid, last_at: now, updated_at: now, unread_b: Number(chat.unread_b || 0) + 1, hidden_a: false, hidden_b: false } : { last_text: message || "Sent a photo", last_from: uid, last_at: now, updated_at: now, unread_a: Number(chat.unread_a || 0) + 1, hidden_a: false, hidden_b: false }; const { error: updateError } = await db.from("friend_chats").update(update).eq("id", chatId); if (updateError) throw updateError;
      return out({ messageId: sent.id });
    }
    if (route === "delete_message") {
      const chatId = text(body.conversationId, 200); const messageId = text(body.messageId, 40); const ids = chatId.split("_");
      if (ids.length !== 2 || !ids.includes(uid)) return out({ error: "You are not in this conversation." }, 403);
      const { data: chat, error: chatLookupError } = await db.from("friend_chats").select("user_a,user_b,unread_a,unread_b").eq("id", chatId).maybeSingle(); if (chatLookupError) throw chatLookupError;
      if (!chat || ![chat.user_a, chat.user_b].includes(uid)) return out({ error: "Conversation not found." }, 404);
      const { data: message, error: messageError } = await db.from("friend_messages").select("id,from_uid,status").eq("id", messageId).eq("chat_id", chatId).maybeSingle(); if (messageError) throw messageError;
      if (!message || message.from_uid !== uid) return out({ error: "You can only delete your own messages." }, 403);
      const { error: deleteError } = await db.from("friend_messages").delete().eq("id", messageId).eq("chat_id", chatId).eq("from_uid", uid); if (deleteError) throw deleteError;
      const { data: latest, error: latestError } = await db.from("friend_messages").select("text,from_uid,photo_url,created_at").eq("chat_id", chatId).order("created_at", { ascending: false }).limit(1).maybeSingle(); if (latestError) throw latestError;
      const recipientUnreadColumn = uid === chat.user_a ? "unread_b" : "unread_a";
      const update: Record<string, unknown> = { last_text: latest ? latest.text || (latest.photo_url ? "Sent a photo" : "") : "", last_from: latest?.from_uid || null, last_at: latest?.created_at || null, updated_at: new Date().toISOString() };
      if (message.status !== "read") update[recipientUnreadColumn] = Math.max(0, Number(chat[recipientUnreadColumn] || 0) - 1);
      const { error: chatError } = await db.from("friend_chats").update(update).eq("id", chatId); if (chatError) throw chatError;
      return out({ ok: true });
    }
    if (route === "block") { const other = text(body.blockedUid, 160); if (!other || other === uid) return out({ error: "That block is not valid." }, 400); const { error } = await db.from("friend_blocks").upsert({ id: `${uid}_${other}`, blocker_uid: uid, blocked_uid: other }, { onConflict: "id" }); if (error) throw error; const chatId = pair(uid, other).join("_"); const { error: chatError } = await db.from("friend_chats").update({ unread_a: 0, unread_b: 0 }).eq("id", chatId); if (chatError) throw chatError; return out({ blockedUid: other }); }
    if (route === "unblock") { const other = text(body.blockedUid, 160); if (!other || other === uid) return out({ error: "That unblock is not valid." }, 400); const { error } = await db.from("friend_blocks").delete().eq("blocker_uid", uid).eq("blocked_uid", other); if (error) throw error; return out({ ok: true }); }
    if (route === "unfriend") { const other = text(body.otherUid, 160); if (!other || other === uid) return out({ error: "That friend is not valid." }, 400); const chatId = pair(uid, other).join("_"); const { error } = await db.from("friendships").delete().eq("id", chatId); if (error) throw error; const { error: blockError } = await db.from("friend_blocks").delete().or(`and(blocker_uid.eq.${uid},blocked_uid.eq.${other}),and(blocker_uid.eq.${other},blocked_uid.eq.${uid})`); if (blockError) throw blockError; const { error: requestError } = await db.from("friend_requests").delete().or(`id.eq.${uid}_${other},id.eq.${other}_${uid}`); if (requestError) throw requestError; const relationshipIds = Array.from(new Set([chatId, `${uid}_${other}`, `${other}_${uid}`])); for (const recipient of [uid, other]) { const { error: notificationError } = await db.from("friend_notifications").delete().eq("recipient_uid", recipient).in("request_id", relationshipIds); if (notificationError) throw notificationError; } const { error: chatError } = await db.from("friend_chats").update({ unread_a: 0, unread_b: 0 }).eq("id", chatId); if (chatError) throw chatError; return out({ ok: true }); }
    if (route === "delete_chat") { const chatId = text(body.conversationId, 200); const ids = chatId.split("_"); if (ids.length !== 2 || !ids.includes(uid)) return out({ error: "You are not in this conversation." }, 403); const { data: chat, error: chatLookupError } = await db.from("friend_chats").select("user_a,user_b").eq("id", chatId).maybeSingle(); if (chatLookupError) throw chatLookupError; if (!chat || ![chat.user_a, chat.user_b].includes(uid)) return out({ error: "Conversation not found." }, 404); const now = new Date().toISOString(); const update = uid === chat.user_a ? { hidden_a: true, cleared_a_at: now, unread_a: 0, updated_at: now } : { hidden_b: true, cleared_b_at: now, unread_b: 0, updated_at: now }; const { error } = await db.from("friend_chats").update(update).eq("id", chatId); if (error) throw error; return out({ ok: true }); }
    if (route === "conversation_status") { const chatId = text(body.conversationId, 200); const ids = chatId.split("_"); if (ids.length !== 2 || !ids.includes(uid)) return out({ error: "You are not in this conversation." }, 403); const { data: chat, error: chatError } = await db.from("friend_chats").select("user_a,user_b,hidden_a,hidden_b").eq("id", chatId).maybeSingle(); if (chatError) throw chatError; if (!chat || ![chat.user_a, chat.user_b].includes(uid)) return out({ error: "Conversation not found." }, 404); const peer = chat.user_a === uid ? chat.user_b : chat.user_a; const { data: relation, error: relationError } = await db.from("friend_blocks").select("blocker_uid,blocked_uid").or(`and(blocker_uid.eq.${uid},blocked_uid.eq.${peer}),and(blocker_uid.eq.${peer},blocked_uid.eq.${uid})`).limit(1).maybeSingle(); if (relationError) throw relationError; const { data: friendship, error: friendshipError } = await db.from("friendships").select("id").eq("id", chatId).maybeSingle(); if (friendshipError) throw friendshipError; const blockedByMe = relation?.blocker_uid === uid; const peerProfile = blockedByMe ? await profile(peer) : null; const blockedInitial = blockedByMe ? String(peerProfile?.displayName || peerProfile?.username || "U").slice(0, 1).toUpperCase() : undefined; return out({ isFriend: Boolean(friendship), blockedByMe, blockedByThem: relation?.blocked_uid === uid, blockedInitial, hidden: Boolean(chat.user_a === uid ? chat.hidden_a : chat.hidden_b) }); }
    if (route === "report") { const conversationId = text(body.conversationId, 200); const reason = text(body.reason, 500); const { error } = await db.from("friend_reports").insert({ conversation_id: conversationId, reporter_uid: uid, reason }); if (error) throw error; return out({ reported: true }); }
    return out({ error: "Unknown social action" }, 400);
  } catch (error) { console.error(error); return out({ error: "Social request failed" }, 500); }
});
