const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const stripeSecret = defineSecret("STRIPE_SECRET");
const paystackSecret = defineSecret("PAYSTACK_SECRET");
const anthropicSecret = defineSecret("ANTHROPIC_API_KEY");

if (!admin.apps.length) admin.initializeApp();

const PAYSTACK = new Set(["GH", "NG", "KE", "ZA"]);

exports.createCheckout = onCall({ secrets: [stripeSecret, paystackSecret] }, async (req) => {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "Sign in before checking out.");
  }

  const { amountCents, currency, email, method, country, reference, name } = req.data || {};
  const normalizedCurrency = String(currency || "").toUpperCase();
  const normalizedEmail = String(req.auth.token.email || email || "").trim().toLowerCase();
  const normalizedMethod = String(method || "");
  const normalizedCountry = String(country || "").toUpperCase();
  const normalizedReference = String(reference || "").trim();

  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > 100000000 ||
    !/^[A-Z]{3}$/.test(normalizedCurrency) ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail) ||
    !["card", "momo", "telecel", "mpesa", "apple"].includes(normalizedMethod) ||
    !/^[A-Z]{2}$/.test(normalizedCountry) ||
    !/^[a-zA-Z0-9._:-]{1,120}$/.test(normalizedReference)
  ) {
    throw new HttpsError("invalid-argument", "Missing amount.");
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
        metadata: { name: String(name || "").slice(0, 160), country: normalizedCountry, method: normalizedMethod },
      }),
    });
    const json = await r.json();
    if (!json.status) throw new HttpsError("internal", json.message || "Paystack failed.");
    return { processor: "paystack", url: json.data.authorization_url, reference };
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
    metadata: { reference: normalizedReference, country: normalizedCountry, method: normalizedMethod },
  });
  return { processor: "stripe", url: session.url, reference: session.id };
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

exports.deleteAccount = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = req.auth.uid;
  const db = admin.firestore();
  await db.collection("users").doc(uid).delete().catch(() => undefined);
  await admin.auth().deleteUser(uid);
  return { ok: true };
});
