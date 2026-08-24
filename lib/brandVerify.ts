import { httpsCallable } from "firebase/functions";
import { firebaseFunctions, firebaseReady } from "./firebase";
import { anthropicKey } from "./tryon";

export type BrandFiling = {
  name: string;
  handle: string;
  legalName: string;
  vertical: string;
  story: string;
  website: string;
  instagram: string;
  contactEmail: string;
  country: string;
  registrationId: string;
  ownerName: string;
  ownerEmail: string;
};

export type BrandReview = {
  ok: boolean;
  headline: string;
  reasons: string[];
  notes: string;
};

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

function promptOf(f: BrandFiling) {
  return `You are the brand-verification desk for Uvel, a fashion marketplace. A person is applying to open a BRAND page, which is different from a regular person listing secondhand clothes. Brands receive a blue verified check and may post new fashion items only after you approve.

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

ok must be false if ANY of these:
- The name impersonates a famous house or street brand (Nike, Adidas, Gucci, Chanel, Louis Vuitton, Dior, Prada, Hermes, Rolex, Zara, H&M, Shein, Supreme, Off-White, Balenciaga, Apple, and obvious lookalikes / misspellings).
- The story is empty, nonsense, or clearly not fashion.
- Contact email is missing or obviously fake (no @, disposable joke domains used as the only identity).
- Handle is offensive, impersonating, or empty.
- Adult, weapons, drugs, hate, or not a fashion business.
- They claim to already be a global conglomerate with no matching legal name / site.

ok may be true for independent labels, ateliers, archives, and new houses that look like a real fashion project — even if small, even if the site is a landing page, even if Instagram is new. Prefer approve when the filing is complete and not impersonating.

Return ONLY JSON:
{
  "ok": boolean,
  "headline": string,
  "reasons": string[],
  "notes": string
}

headline: short, human. If ok: "Verified." If not: why in a few words.
reasons: 0–3 short sentences the applicant can act on. Empty if ok.
notes: one sentence on what you checked.`;
}

async function reviewBrandLocal(filing: BrandFiling): Promise<BrandReview> {
  const key = anthropicKey();
  if (!key) return { ok: false, headline: "Couldn’t check this yet", reasons: ["Safety check isn’t on."], notes: "" };

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
        max_tokens: 500,
        messages: [{ role: "user", content: promptOf(filing) }],
      }),
    }),
    22000,
  );

  const json = (await res.json()) as { content?: { text?: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || "Couldn’t finish the check.");
  const parsed = parseJson(json.content?.[0]?.text ?? "{}");
  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.map((x) => String(x)).filter(Boolean).slice(0, 3)
    : [];
  const ok = parsed.ok === true;
  return {
    ok,
    reasons,
    headline: String(parsed.headline ?? (ok ? "Verified." : "This brand can’t be verified yet.")),
    notes: String(parsed.notes ?? ""),
  };
}

export async function reviewBrand(filing: BrandFiling): Promise<BrandReview> {
  if (firebaseReady()) {
    try {
      const call = httpsCallable(firebaseFunctions(), "reviewBrand");
      const res = await withTimeout(call(filing) as Promise<{ data: BrandReview }>, 25000);
      if (res?.data && typeof res.data.ok === "boolean") return res.data;
    } catch {
      /* fall through to the same Anthropic desk the listings use */
    }
  }
  return reviewBrandLocal(filing);
}

export const VERIFY_STAGES = [
  "Reading the filing…",
  "Checking the name against known houses…",
  "Looking at the site and socials…",
  "Scanning for impersonation…",
  "Deciding verification…",
];
