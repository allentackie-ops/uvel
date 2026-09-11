import { httpsCallable } from "firebase/functions";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { firebaseFunctions, firebaseReady } from "./firebase";
import type { BrandReview } from "./brandVerify";

export type FounderFiling = {
  name: string;
  handle: string;
  piece: string;
  category: string;
  audience: string;
  story: string;
  photos: string[];
  brandId?: string;
};

export const FOUNDER_REVIEW_STAGES = [
  "Reading the filing…",
  "Searching the USPTO…",
  "Checking the pictures…",
  "Scanning replica language…",
  "Deciding…",
];

const HOUSES = ["nike", "adidas", "gucci", "chanel", "dior", "prada", "hermes", "louisvuitton", "lv", "rolex", "zara", "hm", "shein", "supreme", "offwhite", "balenciaga", "fendi", "versace", "givenchy", "burberry", "moncler", "puma", "newbalance", "yeezy", "skims"];
const REPLICA_RE = /\b(replica|counterfeit|1\s*:\s*1|aaa\s*quality|mirror\s*quality|inspired\s*by\s+(nike|adidas|gucci|chanel|dior|prada|hermes|louis|lv|balenciaga|fendi|versace)|not\s*affiliated|fake\s*(nike|gucci|chanel)|authentic\s*(nike|gucci|chanel|dior|prada|lv))\b/i;

function token(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
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

async function imagePayload(uri: string) {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 720 });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.62, base64: true });
  if (!saved.base64) throw new Error("empty");
  return { mime: "image/jpeg" as const, data: saved.base64 };
}

type UsptoMark = { mark: string; status: string; serial: string; owner: string };

function marksFromUnknown(data: unknown): UsptoMark[] {
  const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const nested = rec.response && typeof rec.response === "object" ? (rec.response as Record<string, unknown>) : {};
  const rows = rec.results || rec.docs || rec.items || rec.hits || nested.docs || [];
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 8).map((row) => {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      mark: String(item.wordMark || item.cm || item.mark || item.markText || item.combinedMark || item.conveyedName || ""),
      status: String(item.status || item.statusCode || item.ld || item.liveDeadIndicator || ""),
      serial: String(item.serialNumber || item.sn || item.serial || ""),
      owner: String(item.owner || item.ownerName || item.on || ""),
    };
  }).filter((item) => item.mark);
}

function markLooksLive(status: string) {
  const s = status.toLowerCase();
  if (!s) return true;
  if (/\b(dead|abandoned|cancelled|canceled|expired|surrendered)\b/.test(s)) return false;
  return /\b(live|registered|pending|published|allowed|active)\b/.test(s) || s === "1";
}

async function searchUspto(name: string): Promise<UsptoMark[]> {
  const query = name.trim();
  if (query.length < 2) return [];
  const clean = query.replace(/"/g, "");
  const attempts: Array<() => Promise<UsptoMark[]>> = [
    async () => {
      const res = await fetch("https://tmsearch.uspto.gov/api/v1/trademarkSearch/search", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ query: `cm:"${clean}"`, rows: 8, start: 0 }),
      });
      if (!res.ok) throw new Error(String(res.status));
      return marksFromUnknown(await res.json());
    },
    async () => {
      const res = await fetch(`https://assignment-api.uspto.gov/trademark/v2/assignments?query=${encodeURIComponent(clean)}&rows=6`);
      if (!res.ok) throw new Error(String(res.status));
      return marksFromUnknown(await res.json());
    },
  ];
  for (const attempt of attempts) {
    try {
      const marks = await withTimeout(attempt(), 8000);
      if (marks.length) return marks;
    } catch {
      /* next door */
    }
  }
  return [];
}

async function reviewFounderLocal(filing: FounderFiling): Promise<BrandReview> {
  const name = filing.name.trim();
  const handle = filing.handle.trim().replace(/^@/, "");
  const copy = [name, handle, filing.piece, filing.audience, filing.story].join(" ");
  if (!name) return { ok: false, decision: "needs_information", headline: "Need a brand name", reasons: ["Add the name buyers will see."], notes: "" };
  if (!token(handle)) return { ok: false, decision: "needs_information", headline: "Need a handle", reasons: ["Pick an @ made of letters or numbers."], notes: "" };
  if (!filing.piece.trim()) return { ok: false, decision: "needs_information", headline: "Need a first piece", reasons: ["Name the first piece, then apply again."], notes: "" };
  const core = token(name);
  const h = token(handle);
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (HOUSES.some((house) => core === house || h === house || words.includes(house))) {
    return { ok: false, decision: "rejected", headline: "That name isn’t available", reasons: ["Pick a name and handle that are yours — not a famous label. Change the name and send again."], notes: "Famous-house screen." };
  }
  if (REPLICA_RE.test(copy)) {
    return { ok: false, decision: "rejected", headline: "Replica language", reasons: ["Uvel doesn’t take replica, 1:1, or “inspired by” famous-house listings. Take that language out and send again."], notes: "Replica language screen." };
  }
  const uspto = await searchUspto(name);
  const liveHit = uspto.find((item) => token(item.mark) === core && markLooksLive(item.status));
  if (liveHit) {
    return {
      ok: false,
      decision: "rejected",
      headline: "That name is already a trademark",
      reasons: [`“${name}” matches a live USPTO mark${liveHit.serial ? ` (SN ${liveHit.serial})` : ""}. Change the name and send again.`],
      notes: "USPTO exact live wordmark.",
    };
  }
  return { ok: true, decision: "uvel_reviewed", headline: "Uvel review complete.", reasons: [], notes: "Name, handle, USPTO, replica language." };
}

export async function reviewFounderBrand(filing: FounderFiling): Promise<BrandReview> {
  const local = await reviewFounderLocal(filing);
  if (!local.ok) return local;
  if (!firebaseReady()) return local;
  try {
    const photos = filing.photos.filter(Boolean).slice(0, 2);
    const images: { mime: "image/jpeg"; data: string }[] = [];
    for (const uri of photos) {
      try {
        images.push(await imagePayload(uri));
      } catch {
        /* skip a broken still */
      }
    }
    const call = httpsCallable(firebaseFunctions(), "reviewFounderBrand");
    const res = await withTimeout(
      call({
        name: filing.name,
        handle: filing.handle,
        piece: filing.piece,
        category: filing.category,
        audience: filing.audience,
        story: filing.story,
        brandId: filing.brandId || "",
        images,
      }) as Promise<{ data: BrandReview }>,
      50000,
    );
    if (res?.data && typeof res.data.ok === "boolean") return res.data;
  } catch {
    /* desk not deployed yet — local USPTO + replica already passed */
  }
  return local;
}
