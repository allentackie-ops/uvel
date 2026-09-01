import { httpsCallable } from "firebase/functions";
import { firebaseFunctions, firebaseReady } from "./firebase";
import { hasBrandContact } from "./brandContact";
import { anthropicKey } from "./tryon";

export type BrandFiling = {
  name: string;
  handle: string;
  legalName: string;
  vertical: string;
  story: string;
  website: string;
  instagram: string;
  phone: string;
  whatsapp: string;
  contactEmail: string;
  country: string;
  registrationId: string;
  ownerName: string;
  ownerEmail: string;
};

export type BrandReviewDecision = "needs_information" | "human_review" | "uvel_reviewed" | "rejected";

export type BrandReview = {
  ok: boolean;
  decision: BrandReviewDecision;
  headline: string;
  reasons: string[];
  notes: string;
};

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

function parseJson(text: string): Record<string, unknown> {
  const t = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("No JSON");
  return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Brand check timed out.")), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

function coreToken(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/(incorporated|corporation|company|limited|gmbh|sarl|sas|plc|llc|ltd|inc|corp|co)$/g, "");
}

function impersonates(name: string, handle: string) {
  const core = coreToken(name);
  const h = coreToken(handle);
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return HOUSES.some((house) => core === house || h === house || words.includes(house));
}

function looksLikeEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** Optional fields and style nits must never block a brand. */
function isSoftReason(reason: string) {
  const r = reason.toLowerCase();
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

function localHardFail(f: BrandFiling): BrandReview | null {
  if (!f.name.trim()) {
    return { ok: false, decision: "needs_information", headline: "Need a brand name", reasons: ["Add the name buyers will see."], notes: "" };
  }
  if (!coreToken(f.handle)) {
    return { ok: false, decision: "needs_information", headline: "Need a handle", reasons: ["Pick an @ made of letters or numbers."], notes: "" };
  }
  if (!f.legalName.trim()) {
    return { ok: false, decision: "needs_information", headline: "Need a legal name", reasons: ["Add the registered or legal name of the house."], notes: "" };
  }
  if (f.story.trim().length < 4) {
    return { ok: false, decision: "needs_information", headline: "Need a story", reasons: ["Write a line about who you are and what you make."], notes: "" };
  }
  if (!hasBrandContact(f)) {
    return {
      ok: false,
      decision: "needs_information",
      headline: "Add a contact channel",
      reasons: ["Add at least one reachable brand contact: phone, WhatsApp, Instagram, email, or website."],
      notes: "",
    };
  }
  if (impersonates(f.name, f.handle)) {
    return {
      ok: false,
      decision: "human_review",
      headline: "That name needs a human review",
      reasons: ["Pick a name and handle that are yours — not a famous label."],
      notes: "",
    };
  }
  return null;
}

function promptOf(f: BrandFiling) {
  return `You are the brand-verification desk for Uvel, a fashion marketplace in early access. A person is applying to open a BRAND page. Brands get a blue check and may post new fashion.

Be a light gate, not an editor. Uvel is early: independent labels, new houses, and small ateliers should pass. Default to APPROVE.

REQUIRED fields — the only fields you may use to reject:
Brand name: ${f.name}
Handle: @${f.handle}
Legal / registered name: ${f.legalName || "(none)"}
Vertical: ${f.vertical}
Country: ${f.country || "(none)"}
Contact channels:
- Phone: ${f.phone || "(none)"}
- WhatsApp: ${f.whatsapp || "(none)"}
- Instagram: ${f.instagram || "(none)"}
- Email: ${f.contactEmail || "(none)"}
- Website: ${f.website || "(none)"}
Story: ${f.story || "(none)"}

At least one brand contact channel must be present and usable. Do not reject the brand because optional channels are blank. Do not confuse a brand contact with the applicant's personal/sign-in email (often Apple Hide My Email).

Handle vs name: they MATCH if they share the same core word after stripping spaces, punctuation, and legal suffixes (Inc, Ltd, LLC, GmbH, SARL, Co). "Apion Inc." and @apion MATCH. Do not invent mismatches. One-letter differences in optional socials are irrelevant because socials are out of scope.

Story: one real sentence is enough. Grammar, typos, informal or generic phrasing are NOT grounds to reject.

Contact channels: one usable phone number, WhatsApp number, Instagram handle, email address, or website is enough. Do not require all channels. Do not mention Apple private relay.

Reject ONLY if:
- The name or handle is a famous house (Nike, Adidas, Gucci, Chanel, Louis Vuitton, Dior, Prada, Hermes, Rolex, Zara, H&M, Shein, Supreme, Off-White, Balenciaga) or an obvious fake of one. Close original names are fine.
- A required field above is empty.
- No brand contact channel is usable.
- A supplied email is malformed and no other usable channel is supplied.
- Handle is a slur or empty.
- Adult, weapons, drugs, hate, or clearly not a fashion business.

Return ONLY JSON:
{
  "ok": boolean,
  "decision": "needs_information" | "human_review" | "uvel_reviewed" | "rejected",
  "headline": string,
  "reasons": string[],
  "notes": string
}

decision: use "uvel_reviewed" only when the filing passes Uvel’s internal safety screen; use "needs_information" for missing required information; use "human_review" for possible impersonation, trademark, ownership, or other uncertain conflicts; use "rejected" only for a clear Uvel policy violation. Never claim legal clearance or trademark ownership.
headline: "Uvel review complete." if ok, else a few words.
reasons: 0–3 actionable sentences. Empty if ok. Never mention optional fields.
notes: one sentence on what you checked.`;
}

function asReview(parsed: Record<string, unknown>): BrandReview {
  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.map((x) => String(x)).filter(Boolean).slice(0, 3)
    : [];
  const ok = parsed.ok === true;
  const decision = parsed.decision === "needs_information" || parsed.decision === "human_review" || parsed.decision === "uvel_reviewed" || parsed.decision === "rejected"
    ? parsed.decision
    : ok ? "uvel_reviewed" : "human_review";
  return {
    ok,
    decision,
    reasons,
    headline: String(parsed.headline ?? (ok ? "Uvel review complete." : "This brand needs review.")),
    notes: String(parsed.notes ?? ""),
  };
}

export function sanitizeReview(filing: BrandFiling, review: BrandReview): BrandReview {
  const hard = localHardFail(filing);
  if (hard) return hard;
  const kept = review.reasons.filter((r) => !isSoftReason(r));
  if (review.ok || kept.length === 0) {
    return { ok: true, decision: "uvel_reviewed", headline: "Uvel review complete.", reasons: [], notes: review.notes };
  }
  return {
    ok: false,
    decision: review.decision === "needs_information" || review.decision === "rejected" ? review.decision : "human_review",
    headline: review.headline || "This brand needs review.",
    reasons: kept,
    notes: review.notes,
  };
}

/** Never send optional fields to the model — they are stored on the brand, not scored. */
export function filingForReview(f: BrandFiling): BrandFiling {
  return {
    ...f,
    website: f.website || "",
    instagram: f.instagram || "",
    phone: f.phone || "",
    whatsapp: f.whatsapp || "",
    registrationId: "",
    ownerEmail: f.contactEmail || "",
  };
}

async function reviewBrandLocal(filing: BrandFiling): Promise<BrandReview> {
  const key = anthropicKey();
  if (!key) return { ok: false, decision: "human_review", headline: "Human review is needed", reasons: ["Automated brand screening is not connected yet. This application has not been legally or trademark verified."], notes: "Automated screening unavailable; do not show a public verification badge." };

  const res = await withTimeout(
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [{ role: "user", content: promptOf(filing) }],
      }),
    }),
    22000,
  );

  const json = (await res.json()) as { content?: { text?: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || "Couldn’t finish the check.");
  return asReview(parseJson(json.content?.[0]?.text ?? "{}"));
}

export async function reviewBrand(filing: BrandFiling, brandId?: string): Promise<BrandReview> {
  const hard = localHardFail(filing);
  if (hard) return hard;
  const payload = filingForReview(filing);

  if (firebaseReady()) {
    try {
      const call = httpsCallable(firebaseFunctions(), "reviewBrand");
      const res = await withTimeout(call({ ...payload, ...(brandId ? { brandId } : {}) }) as Promise<{ data: BrandReview }>, 25000);
      if (res?.data && typeof res.data.ok === "boolean") return sanitizeReview(filing, res.data);
    } catch (error) {
      if (brandId) throw error;
      /* Unscoped prototype checks may still use the local desk. */
    }
  }
  return sanitizeReview(filing, await reviewBrandLocal(payload));
}

export const VERIFY_STAGES = [
  "Reading the filing…",
  "Checking the name against known houses…",
  "Reading the story…",
  "Scanning for impersonation…",
  "Deciding verification…",
];
