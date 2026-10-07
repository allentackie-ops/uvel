import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIREBASE_API_KEY = "AIzaSyBYacCvSdirUvZkw6nFZAjm894ZoAPAaPw";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-id-token" };
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const text = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

type Identity = { uid: string; email?: string };
type Conversation = { id: string; buyer_uid: string; seller_uid: string; recipient_ids: string[] };

async function identity(token: string): Promise<Identity | null> {
  if (!token) return null;
  const result = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }),
  });
  if (!result.ok) return null;
  const user = (await result.json()).users?.[0];
  return user?.localId ? { uid: String(user.localId), email: text(user.email, 320) } : null;
}
function member(row: Conversation | null, uid: string) {
  return Boolean(row && (row.buyer_uid === uid || row.seller_uid === uid || (row.recipient_ids || []).includes(uid)));
}
async function conversation(id: string, uid: string) {
  const { data, error } = await db.from("marketplace_conversations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!member(data as Conversation | null, uid)) return null;
  return data;
}
function mapMessage(row: any) {
  return {
    id: row.id, text: row.text || "", from: row.from_uid, kind: row.kind || "text", createdAt: row.created_at,
    photoUrl: row.photo_url || undefined, offerCents: row.offer_cents ?? undefined, offerId: row.offer_id || undefined,
    offerStatus: row.offer_status || undefined, offerExpiresAt: row.offer_expires_at || undefined,
    checkoutExpiresAt: row.checkout_expires_at || undefined, responseMessage: row.response_message || undefined,
    fromName: row.from_name || undefined, fromUsername: row.from_username || undefined, fromPhoto: row.from_photo || undefined,
    status: row.status || "sent",
  };
}
function mapConversation(row: any) {
  return {
    id: row.id, pieceId: row.piece_id, buyerId: row.buyer_uid, sellerId: row.seller_uid,
    pieceName: row.piece_name || "", piecePhoto: row.piece_photo || "", piecePriceCents: row.piece_price_cents || 0,
    sellerName: row.seller_name || "Seller", buyerName: row.buyer_name || "Buyer", buyerPhoto: row.buyer_photo || undefined,
    buyerUsername: row.buyer_username || undefined, brandId: row.brand_id || undefined, brandName: row.brand_name || undefined,
    brandLogo: row.brand_logo || undefined, brandVerified: Boolean(row.brand_verified), recipientIds: row.recipient_ids || [],
    orderId: row.order_id || undefined, supportCaseId: row.support_case_id || undefined, lastText: row.last_text || "",
    lastAt: row.last_at, lastFrom: row.last_from || "", unreadBuyer: row.unread_buyer || 0, unreadSeller: row.unread_seller || 0,
    typingBy: row.typing_by || "", typingAt: row.typing_at || 0,
  };
}
async function blocked(a: string, b: string) {
  const { data } = await db.from("friend_blocks").select("id").or(`and(blocker_uid.eq.${a},blocked_uid.eq.${b}),and(blocker_uid.eq.${b},blocked_uid.eq.${a})`).limit(1);
  return Boolean(data?.length);
}
async function uploadAttachment(uid: string, encoded: string, contentType: string) {
  const raw = text(encoded, 12_000_000);
  if (!raw || raw.length > Math.ceil(MAX_ATTACHMENT_BYTES * 1.4)) throw new Error("Choose a smaller photo.");
  const bytes = Uint8Array.from(atob(raw.includes(",") ? raw.split(",").pop()! : raw), (char) => char.charCodeAt(0));
  if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES) throw new Error("Choose a smaller photo.");
  const safeType = /^image\/(jpeg|png|webp|heic|heif)$/.test(contentType) ? contentType : "image/jpeg";
  const extension = safeType.split("/")[1] === "jpeg" ? "jpg" : safeType.split("/")[1];
  const path = `${uid}/${crypto.randomUUID()}.${extension}`;
  const { error } = await db.storage.from("message-media").upload(path, bytes, { contentType: safeType, upsert: false, cacheControl: "31536000" });
  if (error) throw error;
  const { data, error: signedError } = await db.storage.from("message-media").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signedError || !data?.signedUrl) throw signedError || new Error("Photo could not be opened.");
  return data.signedUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return out({ error: "POST required" }, 405);
  try {
    const user = await identity(text(req.headers.get("x-firebase-id-token"), 6000));
    if (!user) return out({ error: "Authentication failed" }, 401);
    const body = await req.json();
    const action = text(body.action, 60);

    if (action === "upload_attachment") return out({ url: await uploadAttachment(user.uid, text(body.base64, 12_000_000), text(body.contentType, 80)) });
    if (action === "profile") {
      const { data } = await db.from("profiles").select("display_name,expo_push_token").eq("legacy_firebase_uid", text(body.uid, 160)).maybeSingle();
      return out({ profile: data ? { displayName: data.display_name || "", expoPushToken: data.expo_push_token || "" } : null });
    }
    if (action === "upsert_thread") {
      const value = body.thread || {};
      const id = text(value.id, 300); if (!id) return out({ error: "Conversation id is required" }, 400);
      const existing = await conversation(id, user.uid);
      if (existing && !member(existing as Conversation, user.uid)) return out({ error: "Conversation access denied" }, 403);
      const row = {
        id, piece_id: text(value.pieceId, 200), buyer_uid: text(value.buyerId, 160), seller_uid: text(value.sellerId, 160),
        piece_name: text(value.pieceName, 200), piece_photo: text(value.piecePhoto, 2000), piece_price_cents: Number(value.piecePriceCents) || 0,
        seller_name: text(value.sellerName, 160), buyer_name: text(value.buyerName, 160), buyer_photo: text(value.buyerPhoto, 2000) || null,
        buyer_username: text(value.buyerUsername, 80) || null, brand_id: text(value.brandId, 160) || null, brand_name: text(value.brandName, 160) || null,
        brand_logo: text(value.brandLogo, 2000) || null, brand_verified: Boolean(value.brandVerified), recipient_ids: Array.isArray(value.recipientIds) ? value.recipientIds.map(String).slice(0, 20) : [],
        order_id: text(value.orderId, 200) || null, support_case_id: text(value.supportCaseId, 200) || null, updated_at: new Date().toISOString(),
      };
      if (!row.buyer_uid || !row.seller_uid || ![row.buyer_uid, row.seller_uid, ...row.recipient_ids].includes(user.uid)) return out({ error: "Conversation access denied" }, 403);
      const { data, error } = await db.from("marketplace_conversations").upsert(row, { onConflict: "id" }).select("*").single();
      if (error) throw error;
      return out({ thread: mapConversation(data) });
    }
    if (action === "list_threads") {
      const { data, error } = await db.from("marketplace_conversations").select("*").order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return out({ threads: (data || []).filter((row: any) => member(row, user.uid)).map(mapConversation) });
    }
    if (action === "list_messages") {
      const id = text(body.threadId, 300); const row = await conversation(id, user.uid); if (!row) return out({ error: "Conversation access denied" }, 403);
      const { data, error } = await db.from("marketplace_messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true }).limit(100);
      if (error) throw error;
      return out({ messages: (data || []).map(mapMessage) });
    }
    if (action === "send_message") {
      const id = text(body.threadId, 300); const row = await conversation(id, user.uid); if (!row) return out({ error: "Conversation access denied" }, 403);
      const message = text(body.text, 2000); const photoUrl = text(body.photoUrl, 2000) || null;
      if (!message && !photoUrl) return out({ error: "Message text or photo is required" }, 400);
      if (await blocked(user.uid, row.buyer_uid === user.uid ? row.seller_uid : row.buyer_uid)) return out({ error: "Messaging is unavailable for this user" }, 403);
      const values = { conversation_id: id, text: message, from_uid: user.uid, kind: text(body.kind, 20) || "text", photo_url: photoUrl, offer_cents: Number(body.offerCents) || null, offer_id: text(body.offerId, 200) || null, offer_status: text(body.offerStatus, 30) || null, response_message: text(body.responseMessage, 500) || null, status: "sent", from_name: text(body.fromName, 160) || null, from_username: text(body.fromUsername, 80) || null, from_photo: text(body.fromPhoto, 2000) || null };
      const { data: sent, error } = await db.from("marketplace_messages").insert(values).select("*").single(); if (error) throw error;
      const isBuyer = user.uid === row.buyer_uid;
      const update = { last_text: message || "Sent a photo", last_from: user.uid, last_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...(isBuyer ? { unread_seller: Number(row.unread_seller || 0) + 1 } : { unread_buyer: Number(row.unread_buyer || 0) + 1 }) };
      await db.from("marketplace_conversations").update(update).eq("id", id);
      return out({ message: mapMessage(sent) });
    }
    if (action === "set_typing") {
      const id = text(body.threadId, 300); if (!await conversation(id, user.uid)) return out({ error: "Conversation access denied" }, 403);
      await db.from("marketplace_conversations").update({ typing_by: body.on ? user.uid : "", typing_at: body.on ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id); return out({ ok: true });
    }
    if (action === "mark_seen") {
      const id = text(body.threadId, 300); const row = await conversation(id, user.uid); if (!row) return out({ error: "Conversation access denied" }, 403);
      await db.from("marketplace_conversations").update(user.uid === row.buyer_uid ? { unread_buyer: 0 } : { unread_seller: 0 }).eq("id", id); return out({ ok: true });
    }
    if (action === "update_message") {
      const id = text(body.messageId, 100); const threadId = text(body.threadId, 300); if (!await conversation(threadId, user.uid)) return out({ error: "Conversation access denied" }, 403);
      const patch = { offer_status: text(body.offerStatus, 30) || null, response_message: text(body.responseMessage, 500) || null };
      const { error } = await db.from("marketplace_messages").update(patch).eq("id", id).eq("conversation_id", threadId); if (error) throw error; return out({ ok: true });
    }
    if (action === "report") {
      const id = text(body.threadId, 300); if (!await conversation(id, user.uid)) return out({ error: "Conversation access denied" }, 403);
      const { error } = await db.from("marketplace_chat_reports").insert({ conversation_id: id, reporter_uid: user.uid, reason: text(body.reason, 500) }); if (error) throw error; return out({ ok: true });
    }
    if (action === "block") {
      const other = text(body.blockedUid, 160); if (!other || other === user.uid) return out({ error: "That block is not valid" }, 400);
      const { error } = await db.from("friend_blocks").upsert({ id: `${user.uid}_${other}`, blocker_uid: user.uid, blocked_uid: other }, { onConflict: "id" }); if (error) throw error; return out({ blockedUid: other });
    }
    return out({ error: "Unknown messaging action" }, 400);
  } catch (error) { console.error(error); return out({ error: text(error instanceof Error ? error.message : error, 240) || "Messaging request failed" }, 500); }
});
