const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const stripeSecret = defineSecret("STRIPE_SECRET");
const paystackSecret = defineSecret("PAYSTACK_SECRET");
const anthropicSecret = defineSecret("ANTHROPIC_API_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const paystackWebhookSecret = defineSecret("PAYSTACK_WEBHOOK_SECRET");

if (!admin.apps.length) admin.initializeApp();

const PAYSTACK = new Set(["GH", "NG", "KE", "ZA"]);

exports.createCheckout = onCall({ secrets: [stripeSecret, paystackSecret] }, async (req) => {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "Sign in before checking out.");
  }

  const { amountCents, currency, email, method, country, reference, name, orderId, listingId, brandId } = req.data || {};
  const normalizedCurrency = String(currency || "").toUpperCase();
  const normalizedEmail = String(req.auth.token.email || email || "").trim().toLowerCase();
  const normalizedMethod = String(method || "");
  const normalizedCountry = String(country || "").toUpperCase();
  const normalizedReference = String(reference || "").trim();
  const normalizedOrderId = String(orderId || "").trim();
  const normalizedListingId = String(listingId || "").trim();
  const normalizedBrandId = String(brandId || "").trim();

  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > 100000000 ||
    !/^[A-Z]{3}$/.test(normalizedCurrency) ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail) ||
    !["card", "momo", "telecel", "mpesa", "apple"].includes(normalizedMethod) ||
    !/^[A-Z]{2}$/.test(normalizedCountry) ||
    !/^[a-zA-Z0-9._:-]{1,120}$/.test(normalizedReference) ||
    !/^[a-zA-Z0-9._:-]{1,120}$/.test(normalizedOrderId)
  ) {
    throw new HttpsError("invalid-argument", "Missing amount.");
  }

  const orderRef = admin.firestore().collection("orders").doc(normalizedOrderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = orderSnap.data() || {};
  if (order.buyerId !== req.auth.uid || order.status !== "pending") {
    throw new HttpsError("failed-precondition", "Order is not available for payment.");
  }
  if (order.totalCents !== amountCents || String(order.currency || "").toUpperCase() !== normalizedCurrency) {
    throw new HttpsError("invalid-argument", "Order amount changed.");
  }
  if (normalizedListingId && order.pieceId !== normalizedListingId) {
    throw new HttpsError("invalid-argument", "Order listing changed.");
  }
  if (normalizedBrandId && order.brandId !== normalizedBrandId) {
    throw new HttpsError("invalid-argument", "Order brand changed.");
  }
  if (order.brandId && order.pieceId) {
    const listingSnap = await admin.firestore().collection("listings").doc(String(order.pieceId)).get();
    const listing = listingSnap.data() || {};
    if (!listingSnap.exists || listing.status !== "listed" || listing.brandId !== order.brandId) {
      throw new HttpsError("failed-precondition", "Listing is no longer available.");
    }
  }

  if (normalizedMethod !== "apple" && PAYSTACK.has(normalizedCountry)) {
    const key = paystackSecret.value();
    if (!key) throw new HttpsError("failed-precondition", "Paystack isn’t connected yet.");
    const channels =
      normalizedMethod === "momo" || normalizedMethod === "telecel" || normalizedMethod === "mpesa"
        ? ["mobile_money"]
        : normalizedMethod === "card"
          ? ["card"]
          : undefined;
    const r = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizedEmail,
        amount: Math.round(amountCents),
        currency: normalizedCurrency,
        reference: normalizedReference,
        callback_url: "https://allentackie-ops.github.io/uvel/pay.html",
        channels,
        metadata: {
          name: String(name || "").slice(0, 160),
          country: normalizedCountry,
          method: normalizedMethod,
          orderId: normalizedOrderId,
          listingId: normalizedListingId,
          brandId: normalizedBrandId,
        },
      }),
    });
    const json = await r.json();
    if (!json.status) throw new HttpsError("internal", json.message || "Paystack failed.");
    await orderRef.set({ paymentProvider: "paystack", paymentReference: normalizedReference, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { processor: "paystack", url: json.data.authorization_url, reference: normalizedReference };
  }

  const key = stripeSecret.value();
  if (!key) throw new HttpsError("failed-precondition", "Stripe isn’t connected yet.");
  const stripe = require("stripe")(key);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: normalizedEmail,
    success_url: "https://allentackie-ops.github.io/uvel/pay.html",
    cancel_url: "https://allentackie-ops.github.io/uvel/pay.html",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: normalizedCurrency.toLowerCase(),
          unit_amount: Math.round(amountCents),
          product_data: { name: name || "Uvel order" },
        },
      },
    ],
    payment_method_types: ["card"],
    metadata: {
      reference: normalizedReference,
      orderId: normalizedOrderId,
      listingId: normalizedListingId,
      brandId: normalizedBrandId,
      country: normalizedCountry,
      method: normalizedMethod,
    },
  });
  await orderRef.set({ paymentProvider: "stripe", paymentReference: session.id, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { processor: "stripe", url: session.url, reference: session.id };
});

function uidSafe(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

function fieldId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 140);
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function increment(value) {
  return admin.firestore.FieldValue.increment(value);
}

function analyticsRefs(db, brandId) {
  const base = db.collection("brandAnalytics").doc(brandId);
  return {
    base,
    daily: (day) => base.collection("daily").doc(day),
    states: (id) => base.collection("states").doc(fieldId(id)),
    audience: (uid) => base.collection("audience").doc(fieldId(uid)),
    top: (listingId) => base.collection("top").doc(fieldId(listingId)),
  };
}

async function recordEvent(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const input = req.data || {};
  const type = String(input.type || "");
  const brandId = String(input.brandId || "").trim();
  const listingId = String(input.listingId || "").trim();
  const listingName = String(input.listingName || "").slice(0, 160);
  const listingPhoto = String(input.listingPhoto || "").slice(0, 2000);
  const eventId = String(input.eventId || `${type}_${uidSafe(req.auth.uid)}_${Date.now()}`).slice(0, 160);
  const allowed = new Set(["brand_view", "listing_view", "listing_like", "listing_unlike", "brand_follow", "brand_unfollow"]);
  if (!allowed.has(type) || !brandId || (type.startsWith("listing_") && !listingId)) {
    throw new HttpsError("invalid-argument", "Invalid analytics event.");
  }

  const db = admin.firestore();
  const brandRef = db.collection("brands").doc(brandId);
  if (listingId) {
    const listingSnap = await db.collection("listings").doc(listingId).get();
    const listing = listingSnap.data() || {};
    if (!listingSnap.exists || listing.brandId !== brandId || listing.status !== "listed") {
      throw new HttpsError("failed-precondition", "Listing is not available.");
    }
  }
  const refs = analyticsRefs(db, brandId);
  const uid = req.auth.uid;
  const day = dayKey();
  const stateId = type === "brand_view" || type === "listing_view"
    ? `event_${eventId}`
    : type.startsWith("listing_")
        ? `listing_like_${uid}_${listingId}`
        : `brand_follow_${uid}`;
  const stateRef = refs.states(stateId);
  const audienceRef = refs.audience(uid);
  const dailyRef = refs.daily(day);
  const topRef = listingId ? refs.top(listingId) : null;

  await db.runTransaction(async (tx) => {
    const reads = [tx.get(brandRef), tx.get(stateRef)];
    if (type === "brand_view") reads.push(tx.get(audienceRef));
    const snapshots = await Promise.all(reads);
    const brandSnap = snapshots[0];
    const stateSnap = snapshots[1];
    if (!brandSnap.exists) throw new HttpsError("not-found", "Brand not found.");
    const desired = type === "listing_like" || type === "brand_follow";
    if (stateSnap.exists) {
      const state = stateSnap.data() || {};
      if (type.endsWith("_view") || Boolean(state.active) === desired) return;
    }

    const payload = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (type === "brand_view") {
      const audienceSnap = snapshots[2];
      tx.set(stateRef, { uid, type, eventId, day, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      tx.set(audienceRef, { firstSeenAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(refs.base, { views: increment(1), unique: audienceSnap.exists ? increment(0) : increment(1), ...payload }, { merge: true });
      tx.set(dailyRef, { day, views: increment(1), ...payload }, { merge: true });
      return;
    }
    if (type === "listing_view") {
      tx.set(stateRef, { uid, listingId, type, eventId, day, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      tx.set(dailyRef, { day, views: increment(1), ...payload }, { merge: true });
      if (topRef) tx.set(topRef, { id: listingId, name: listingName || "Listing", photo: listingPhoto, views: increment(1), ...payload }, { merge: true });
      return;
    }
    tx.set(stateRef, { uid, listingId: listingId || null, type: desired ? "active" : "inactive", active: desired, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    const delta = desired ? 1 : -1;
    if (type.startsWith("listing_")) {
      tx.set(refs.base, { likes: increment(delta), ...payload }, { merge: true });
      tx.set(dailyRef, { day, likes: desired ? increment(1) : increment(0), ...payload }, { merge: true });
      if (topRef) tx.set(topRef, { id: listingId, name: listingName || "Listing", photo: listingPhoto, likes: increment(delta), ...payload }, { merge: true });
    } else {
      tx.set(refs.base, { follows: increment(delta), ...payload }, { merge: true });
    }
  });
  return { ok: true };
}

exports.recordAnalyticsEvent = onCall(recordEvent);

async function markOrderPaid(orderId, provider, providerReference, providerAmount, providerCurrency) {
  if (!orderId) return { ok: false, reason: "missing-order" };
  const db = admin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) return { ok: false, reason: "order-not-found" };
    const order = snap.data() || {};
    const listingRef = order.pieceId ? db.collection("listings").doc(String(order.pieceId)) : null;
    const listingSnap = listingRef ? await tx.get(listingRef) : null;
    if (order.status === "paid") return { ok: true, duplicate: true };
    if (order.status !== "pending") return { ok: false, reason: "order-not-pending" };
    if (Number(providerAmount) > 0 && Number(order.totalCents) !== Number(providerAmount)) return { ok: false, reason: "amount-mismatch" };
    if (order.brandId && (!listingSnap || !listingSnap.exists || listingSnap.data().status !== "listed")) return { ok: false, reason: "listing-unavailable" };
    if (providerCurrency && String(order.currency || "").toUpperCase() !== String(providerCurrency).toUpperCase()) return { ok: false, reason: "currency-mismatch" };
    const paidAt = admin.firestore.FieldValue.serverTimestamp();
    tx.update(orderRef, { status: "paid", paymentProvider: provider, paymentReference: providerReference, paidAt });
    if (listingRef) {
      tx.set(listingRef, { status: "sold", soldAt: paidAt }, { merge: true });
    }
    if (order.brandId) {
      const refs = analyticsRefs(db, String(order.brandId));
      const day = dayKey();
      const currency = String(order.currency || "USD").toUpperCase();
      const earnings = Math.max(0, Number(order.itemCents || 0) - Number(order.feeCents || 0));
      tx.set(refs.base, {
        sold: increment(1),
        earningsCents: increment(earnings),
        currency,
        [`earningsByCurrency.${currency}`]: increment(earnings),
        updatedAt: paidAt,
      }, { merge: true });
      tx.set(refs.daily(day), {
        day,
        sales: increment(1),
        earnings: increment(earnings),
        [`earningsByCurrency.${currency}`]: increment(earnings),
        updatedAt: paidAt,
      }, { merge: true });
      if (order.pieceId) {
        tx.set(refs.top(String(order.pieceId)), {
          id: String(order.pieceId),
          name: String(order.pieceName || "Listing"),
          photo: String(order.piecePhoto || ""),
          sold: increment(1),
          updatedAt: paidAt,
        }, { merge: true });
      }
    }
    return { ok: true };
  });
}

function stripeWebhook() {
  return onRequest({ secrets: [stripeSecret, stripeWebhookSecret] }, async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("POST only");
    let event;
    try {
      const stripe = require("stripe")(stripeSecret.value());
      event = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], stripeWebhookSecret.value());
    } catch (e) {
      return res.status(400).send(`Webhook signature verification failed: ${e.message}`);
    }
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      const metadata = session.metadata || {};
      const result = await markOrderPaid(metadata.orderId, "stripe", session.id, session.amount_total, session.currency);
      if (!result.ok && !result.duplicate) return res.status(400).json(result);
    }
    return res.status(200).send("ok");
  });
}

exports.stripeWebhook = stripeWebhook();

exports.paystackWebhook = onRequest({ secrets: [paystackWebhookSecret] }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("POST only");
  const signature = String(req.headers["x-paystack-signature"] || "");
  const expected = crypto.createHmac("sha512", paystackWebhookSecret.value()).update(req.rawBody).digest("hex");
  if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).send("Invalid signature");
  const event = req.body || {};
  if (event.event === "charge.success") {
    const data = event.data || {};
    const metadata = data.metadata || {};
    const result = await markOrderPaid(metadata.orderId, "paystack", String(data.reference || ""), data.amount, data.currency);
    if (!result.ok && !result.duplicate) return res.status(400).json(result);
  }
  return res.status(200).send("ok");
});

exports.getBrandAnalytics = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const brandId = String(req.data?.brandId || "").trim();
  const currency = String(req.data?.currency || "USD").toUpperCase();
  if (!brandId || !/^[A-Z]{3}$/.test(currency)) throw new HttpsError("invalid-argument", "Invalid brand analytics request.");
  const db = admin.firestore();
  const brandSnap = await db.collection("brands").doc(brandId).get();
  if (!brandSnap.exists) throw new HttpsError("not-found", "Brand not found.");
  const brand = brandSnap.data() || {};
  const member = Array.isArray(brand.members) && brand.members.find((m) => m.uid === req.auth.uid);
  if (!member || (member.role !== "owner" && !brand.analyticsShared)) throw new HttpsError("permission-denied", "Analytics are private.");
  const refs = analyticsRefs(db, brandId);
  const [baseSnap, dailySnap, topSnap, listingsSnap] = await Promise.all([
    refs.base.get(),
    refs.base.collection("daily").get(),
    refs.base.collection("top").limit(20).get(),
    db.collection("listings").where("brandId", "==", brandId).get(),
  ]);
  const base = baseSnap.data() || {};
  const byDay = new Map(dailySnap.docs.map((d) => [d.id, d.data()]));
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const day = dayKey(date);
    const row = byDay.get(day) || {};
    daily.push({ day, views: Number(row.views || 0), likes: Number(row.likes || 0), sales: Number(row.sales || 0), earnings: Number((row.earningsByCurrency || {})[currency] || 0) });
  }
  const earningsByCurrency = base.earningsByCurrency || {};
  const views = Number(base.views || 0);
  const unique = Number(base.unique || 0);
  const sold = Number(base.sold || 0);
  return {
    data: {
      views,
      unique,
      likes: Number(base.likes || 0),
      follows: Number(base.follows || 0),
      listings: listingsSnap.docs.filter((d) => d.data().status === "listed").length,
      sold,
      earningsCents: Number(earningsByCurrency[currency] || 0),
      currency,
      conversion: unique ? Math.round((sold / unique) * 1000) / 10 : 0,
      daily,
      top: topSnap.docs.map((d) => {
        const row = d.data();
        return { id: String(row.id || d.id), name: String(row.name || "Listing"), photo: String(row.photo || ""), views: Number(row.views || 0), likes: Number(row.likes || 0), sold: Number(row.sold || 0) };
      }).sort((a, b) => (b.views + b.sold * 100) - (a.views + a.sold * 100)).slice(0, 5),
    },
  };
});

function parseJson(text) {
  const t = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*|\s*```$/g, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("No JSON");
  return JSON.parse(t.slice(start, end + 1));
}

const HOUSES = [
  "nike",
  "adidas",
  "gucci",
  "chanel",
  "dior",
  "prada",
  "hermes",
  "louisvuitton",
  "lv",
  "rolex",
  "zara",
  "hm",
  "shein",
  "supreme",
  "offwhite",
  "balenciaga",
  "fendi",
  "versace",
  "givenchy",
  "burberry",
  "moncler",
  "puma",
  "newbalance",
  "yeezy",
  "skims",
];

function coreToken(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/(incorporated|corporation|company|limited|gmbh|sarl|sas|plc|llc|ltd|inc|corp|co)$/g, "");
}

function impersonates(name, handle) {
  const core = coreToken(name);
  const h = coreToken(handle);
  const words = String(name || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return HOUSES.some((house) => core === house || h === house || words.includes(house));
}

function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

function isSoftReason(reason) {
  const r = String(reason || "").toLowerCase();
  return (
    /\binstagram\b|\binsta\b|\big handle\b|\bsocials?\b/.test(r) ||
    /\bwebsite\b|\bweb site\b|\blanding page\b|\bsite unreachable\b/.test(r) ||
    /\btax id\b|\bregistration (?:or tax )?id\b|\bregistration number\b/.test(r) ||
    /\bprivate relay\b|\bhide my email\b|\bprivaterelay\b|\bapple id\b|\bapplicant email\b|\bsign-in email\b/.test(r) ||
    /\bgrammatical\b|\bgrammar\b|\bspelling\b|\btypos?\b/.test(r) ||
    /\bplaceholder\b|\bgeneric\b|\bnarrative\b|\baesthetic\b/.test(r) ||
    /does not match your brand name or handle/.test(r) ||
    /handle \([^)]+\) does not match/.test(r) ||
    /\btoo short\b|\bmore detail\b|\bnot enough\b|\bweak brand story\b|\bclarify the discrepancy\b/.test(r)
  );
}

function localHardFail(f) {
  if (!String(f.name || "").trim()) {
    return { ok: false, headline: "Need a brand name", reasons: ["Add the name buyers will see."], notes: "" };
  }
  if (!coreToken(f.handle)) {
    return { ok: false, headline: "Need a handle", reasons: ["Pick an @ made of letters or numbers."], notes: "" };
  }
  if (!String(f.legalName || "").trim()) {
    return { ok: false, headline: "Need a legal name", reasons: ["Add the registered or legal name of the house."], notes: "" };
  }
  if (String(f.story || "").trim().length < 4) {
    return { ok: false, headline: "Need a story", reasons: ["Write a line about who you are and what you make."], notes: "" };
  }
  if (!looksLikeEmail(f.contactEmail)) {
    return {
      ok: false,
      headline: "Need a contact email",
      reasons: ["Use a real email the brand can be reached at."],
      notes: "",
    };
  }
  if (impersonates(f.name, f.handle)) {
    return {
      ok: false,
      headline: "That name is taken by a known house",
      reasons: ["Pick a name and handle that are yours — not a famous label."],
      notes: "",
    };
  }
  return null;
}

function sanitizeReview(f, review) {
  const hard = localHardFail(f);
  if (hard) return hard;
  const kept = (review.reasons || []).filter((r) => !isSoftReason(r));
  if (review.ok || kept.length === 0) {
    return { ok: true, headline: "Verified.", reasons: [], notes: review.notes || "" };
  }
  return {
    ok: false,
    headline: review.headline || "This brand can’t be verified yet.",
    reasons: kept.slice(0, 3),
    notes: review.notes || "",
  };
}

function promptOf(f) {
  return `You are the brand-verification desk for Uvel, a fashion marketplace in early access. A person is applying to open a BRAND page. Brands get a blue check and may post new fashion.

Be a light gate, not an editor. Uvel is early: independent labels, new houses, and small ateliers should pass. Default to APPROVE.

REQUIRED fields — the only fields you may use to reject:
Brand name: ${f.name}
Handle: @${f.handle}
Legal / registered name: ${f.legalName || "(none)"}
Vertical: ${f.vertical}
Country: ${f.country || "(none)"}
Contact email: ${f.contactEmail || "(none)"}
Story: ${f.story || "(none)"}

Do not ask about, compare, or reject on Instagram, website, tax/registration id, tagline, or the applicant's personal/sign-in email (often Apple Hide My Email). Those are optional and out of scope.

Handle vs name: they MATCH if they share the same core word after stripping spaces, punctuation, and legal suffixes (Inc, Ltd, LLC, GmbH, SARL, Co). "Apion Inc." and @apion MATCH. Do not invent mismatches. One-letter differences in optional socials are irrelevant because socials are out of scope.

Story: one real sentence is enough. Grammar, typos, informal or generic phrasing are NOT grounds to reject.

Contact email: only this brand contact field. A normal address with @ is enough. Do not mention Apple private relay.

Reject ONLY if:
- The name or handle is a famous house (Nike, Adidas, Gucci, Chanel, Louis Vuitton, Dior, Prada, Hermes, Rolex, Zara, H&M, Shein, Supreme, Off-White, Balenciaga) or an obvious fake of one. Close original names are fine.
- A required field above is empty.
- Contact email has no @.
- Handle is a slur or empty.
- Adult, weapons, drugs, hate, or clearly not a fashion business.

Return ONLY JSON:
{
  "ok": boolean,
  "headline": string,
  "reasons": string[],
  "notes": string
}

headline: "Verified." if ok, else a few words.
reasons: 0–3 actionable sentences. Empty if ok. Never mention optional fields.
notes: one sentence on what you checked.`;
}

exports.reviewBrand = onCall({ secrets: [anthropicSecret] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const f = req.data || {};
  const hard = localHardFail(f);
  if (hard) return hard;

  const key = anthropicSecret.value();
  if (!key) throw new HttpsError("failed-precondition", "Brand check isn’t connected yet.");

  const prompt = promptOf(f);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new HttpsError("internal", json.error?.message || "Couldn’t finish the check.");
  const parsed = parseJson(json.content?.[0]?.text || "{}");
  const ok = parsed.ok === true;
  const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.map(String).filter(Boolean).slice(0, 3) : [];
  return sanitizeReview(f, {
    ok,
    reasons,
    headline: String(parsed.headline || (ok ? "Verified." : "This brand can’t be verified yet.")),
    notes: String(parsed.notes || ""),
  });
});
