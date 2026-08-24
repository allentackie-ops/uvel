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

exports.reviewBrand = onCall({ secrets: [anthropicSecret] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const f = req.data || {};
  const key = anthropicSecret.value();
  if (!key) throw new HttpsError("failed-precondition", "Brand check isn’t connected yet.");

  let siteSnippet = "";
  const website = String(f.website || "").trim();
  if (/^https?:\/\//i.test(website)) {
    try {
      const r = await fetch(website, { signal: AbortSignal.timeout(4000), redirect: "follow" });
      const html = await r.text();
      siteSnippet = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 1800);
    } catch {
      siteSnippet = "(site unreachable)";
    }
  }

  const prompt = `You are the brand-verification desk for Uvel, a fashion marketplace. A person is applying to open a BRAND page, which is different from a regular person listing secondhand clothes. Brands receive a blue verified check and may post new fashion items only after you approve.

Be thorough. Read every field. Look for impersonation, empty shells, scams, and anything that is not a real fashion house or independent label.

Filing:
Brand name: ${f.name}
Handle: @${f.handle}
Legal / registered name: ${f.legalName || "(none)"}
Vertical: ${f.vertical}
Country: ${f.country}
Website: ${f.website || "(none)"}
Instagram: ${f.instagram || "(none)"}
Contact email: ${f.contactEmail || "(none)"}
Registration / tax id: ${f.registrationId || "(none)"}
Story: ${f.story || "(none)"}
Applicant: ${f.ownerName} <${f.ownerEmail}>
Website text (fetched): ${siteSnippet || "(none)"}

ok must be false if ANY of these:
- The name impersonates a famous house or street brand (Nike, Adidas, Gucci, Chanel, Louis Vuitton, Dior, Prada, Hermes, Rolex, Zara, H&M, Shein, Supreme, Off-White, Balenciaga, Apple, and obvious lookalikes / misspellings).
- The story is empty, nonsense, or clearly not fashion.
- Contact email is missing or obviously fake.
- Handle is offensive, impersonating, or empty.
- Adult, weapons, drugs, hate, or not a fashion business.
- They claim to already be a global conglomerate with no matching legal name / site.

ok may be true for independent labels, ateliers, archives, and new houses that look like a real fashion project — even if small.

Return ONLY JSON:
{ "ok": boolean, "headline": string, "reasons": string[], "notes": string }`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new HttpsError("internal", json.error?.message || "Couldn’t finish the check.");
  const parsed = parseJson(json.content?.[0]?.text || "{}");
  const ok = parsed.ok === true;
  const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.map(String).filter(Boolean).slice(0, 3) : [];
  return {
    ok,
    reasons,
    headline: String(parsed.headline || (ok ? "Verified." : "This brand can’t be verified yet.")),
    notes: String(parsed.notes || ""),
  };
});

