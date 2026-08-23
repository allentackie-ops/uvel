export const ARCH = [
  "Quiet luxury",
  "Street",
  "Vintage archive",
  "Utility",
  "Romantic",
  "Western city",
  "Tailored city",
  "Bourgeois chic",
] as const;

export const PALS = ["Earth & camel", "Ivory & ink", "Warm rust", "Stone & olive"] as const;
export const SILS = ["Oversized", "Tailored", "Fluid", "Cropped"] as const;

export type Dna = {
  archetype: string;
  palette: string;
  silhouette: string;
  styles: string[];
  gender: string;
};

const ARCH_WORDS: Record<string, string[]> = {
  "Quiet luxury": [
    "quiet", "luxury", "cashmere", "camel", "blazer", "loafer", "loafers", "linen", "wool",
    "trench", "coat", "cream", "ivory", "navy", "silk", "knit", "trousers", "tailored",
    "old", "money", "minimal", "clean", "beige", "overcoat", "cardigan",
  ],
  Street: [
    "street", "cargo", "cargos", "hoodie", "sneaker", "sneakers", "baggy", "graphic",
    "denim", "jersey", "cap", "bomber", "trainer", "oversized", "fitcheck", "streetwear",
  ],
  "Vintage archive": [
    "vintage", "archive", "thrift", "90s", "80s", "y2k", "leather", "denim", "band",
    "retro", "washed", "bootcut", " motocross",
  ],
  Utility: [
    "utility", "cargo", "field", "jacket", "parka", "workwear", "boot", "khaki", "olive",
    "pocket", "canvas", "chore",
  ],
  Romantic: [
    "romantic", "silk", "slip", "dress", "floral", "lace", "satin", "bow", "chiffon",
    "blush", "soft", "skirt", "blouse", "poet",
  ],
  "Western city": [
    "western", "cowboy", "boot", "boots", "denim", "suede", "belt", "fringe", "check",
    "plaid", "hat",
  ],
  "Tailored city": [
    "tailored", "suit", "blazer", "trouser", "oxford", "shirt", "work", "office",
    "pleat", "waistcoat", "coat",
  ],
  "Bourgeois chic": [
    "bourgeois", "chic", "tweed", "ballet", "flat", "pearl", "cardigan", "midi",
    "trench", "paris", "kitten",
  ],
};

const PAL_WORDS: Record<string, string[]> = {
  "Earth & camel": ["camel", "tan", "brown", "earth", "chocolate", "khaki", "sand", "cognac"],
  "Ivory & ink": ["ivory", "white", "cream", "black", "ink", "navy", "bone", "monochrome"],
  "Warm rust": ["rust", "orange", "terracotta", "burgundy", "wine", "red", "copper", "brick"],
  "Stone & olive": ["stone", "olive", "green", "grey", "gray", "sage", "moss", "taupe"],
};

const SIL_WORDS: Record<string, string[]> = {
  Oversized: ["oversized", "baggy", "relaxed", "slouch", "wide", "volume"],
  Tailored: ["tailored", "fitted", "sharp", "structured", "slim", "cut"],
  Fluid: ["fluid", "drape", "slip", "bias", "flowing", "silk", "satin"],
  Cropped: ["crop", "cropped", "mini", "short", "tank"],
};

const STYLE_WORDS: Record<string, string[]> = {
  Quiet: ARCH_WORDS["Quiet luxury"],
  Romantic: ARCH_WORDS.Romantic,
  Tailored: ARCH_WORDS["Tailored city"],
  Street: ARCH_WORDS.Street,
  Vintage: ARCH_WORDS["Vintage archive"],
  Western: ARCH_WORDS["Western city"],
  Utility: ARCH_WORDS.Utility,
  Minimal: ARCH_WORDS["Quiet luxury"],
  Evening: ["evening", "satin", "heel", "dress", "sparkle", "black"],
  Work: ARCH_WORDS["Tailored city"],
  Y2K: ["y2k", "low", "rise", "butterfly", "sparkle", "mini"],
  Coastal: ["linen", "white", "stripe", "blue", "resort", "cotton"],
};

const BAD = [
  "shirtless", "topless", "nude", "underwear", "lingerie", "thirst", "onlyfans",
  "abs", "bare chest", "no shirt",
];

const FROM_SETUP: Record<string, { arch?: string; pal?: string; sil?: string }> = {
  Quiet: { arch: "Quiet luxury" },
  Romantic: { arch: "Romantic" },
  Tailored: { arch: "Tailored city", sil: "Tailored" },
  Street: { arch: "Street" },
  Vintage: { arch: "Vintage archive" },
  Western: { arch: "Western city" },
  Utility: { arch: "Utility" },
  Minimal: { arch: "Quiet luxury", sil: "Tailored" },
  Evening: { arch: "Romantic" },
  Work: { arch: "Tailored city" },
  Y2K: { arch: "Vintage archive" },
  Coastal: { pal: "Ivory & ink" },
};

export function seedFromStyles(styles: string[]) {
  const out: Partial<Dna> = {};
  for (const s of styles) {
    const hit = FROM_SETUP[s];
    if (!hit) continue;
    if (hit.arch && !out.archetype) out.archetype = hit.arch;
    if (hit.pal && !out.palette) out.palette = hit.pal;
    if (hit.sil && !out.silhouette) out.silhouette = hit.sil;
  }
  return out;
}

export function dnaKeywords(dna: Dna): string[] {
  const words = new Set<string>();
  for (const w of ARCH_WORDS[dna.archetype] || []) words.add(w);
  for (const w of PAL_WORDS[dna.palette] || []) words.add(w);
  for (const w of SIL_WORDS[dna.silhouette] || []) words.add(w);
  for (const s of dna.styles || []) {
    for (const w of STYLE_WORDS[s] || [s.toLowerCase()]) words.add(w);
  }
  if (/male|man|men/i.test(dna.gender)) {
    ["mens", "men", "him", "trouser", "shirt"].forEach((w) => words.add(w));
  }
  if (/female|woman|women/i.test(dna.gender)) {
    ["womens", "women", "her", "dress", "skirt"].forEach((w) => words.add(w));
  }
  return [...words];
}

export function dnaHint(kind: "arch" | "pal" | "sil", value: string) {
  const map = kind === "arch" ? ARCH_WORDS : kind === "pal" ? PAL_WORDS : SIL_WORDS;
  return (map[value] || []).slice(0, 5).join(" · ");
}

function bag(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
}

export function scoreLookText(text: string, dna: Dna) {
  const hay = bag(text);
  const set = new Set(hay);
  let n = 0;
  for (const w of dnaKeywords(dna)) if (set.has(w)) n += 3;
  for (const w of BAD) if (text.toLowerCase().includes(w)) n -= 12;
  return n;
}

export function rankLooks<T extends { title?: string; summary?: string; shopQuery?: string; handle?: string }>(
  looks: T[],
  dna: Dna,
) {
  if (!dna.archetype && !dna.palette && !dna.styles.length) return looks;
  return [...looks].sort((a, b) => {
    const as = scoreLookText([a.title, a.summary, a.shopQuery, a.handle].filter(Boolean).join(" "), dna);
    const bs = scoreLookText([b.title, b.summary, b.shopQuery, b.handle].filter(Boolean).join(" "), dna);
    return bs - as;
  });
}

export function igQuery(dna: Dna) {
  const keys = dnaKeywords(dna).slice(0, 4).join(" ");
  const base = keys ? `${keys} ootd` : "ootd fitcheck";
  return `web search: site:instagram.com/reel ${base}. List every instagram.com/reel URL you saw.`;
}

export function dnaFrom(s: {
  archetype?: string;
  palette?: string;
  silhouette?: string;
  styles?: string[];
  gender?: string;
}): Dna {
  return {
    archetype: s.archetype || "",
    palette: s.palette || "",
    silhouette: s.silhouette || "",
    styles: s.styles || [],
    gender: s.gender || "",
  };
}
