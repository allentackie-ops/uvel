import { anthropicKey } from "./tryon";

type Source = "TikTok" | "Instagram" | "X" | "Snapchat";

export type DeskLook = {
  id: string;
  slug: string;
  title: string;
  source: Source;
  summary: string;
  image: { uri: string };
  imageUrl?: string;
  videoUrl?: string;
  postUrl: string;
  handle: string;
  garmentIds: string[];
  shopQuery: string;
  heat: string;
};

const TAGS = [
  { id: "13251", tag: "ootd" },
  { id: "1613431309176854", tag: "fitcheck" },
  { id: "11885", tag: "fashion" },
  { id: "72878", tag: "grwm" },
  { id: "15193", tag: "streetstyle" },
  { id: "3958603", tag: "outfitinspo" },
];

const RAW = "https://raw.githubusercontent.com/allentackie-ops/uvel/main/docs/looks";

const FALLBACK: DeskLook[] = [
  look("lexia", "Grey maxi dress", "TikTok", "@notverylexi", "https://www.tiktok.com/@notverylexi/video/7624626484992298253", `${RAW}/lexia.mp4`, `${RAW}/lexia.jpg`, "grey dress"),
  look("lexia-today", "OOTD grey knit", "TikTok", "@notverylexi", "https://www.tiktok.com/@notverylexi/video/7626790931278187789", `${RAW}/lexia-white.mp4`, `${RAW}/lexia-white.jpg`, "knit dress"),
  look("kiki", "Fit check", "TikTok", "fitcheck", "https://www.tiktok.com/tag/ootd", `${RAW}/kiki.mp4`, `${RAW}/kiki.jpg`, "denim"),
  look("nthabi", "Same pants three ways", "TikTok", "@itsnthabimm9zb", "https://www.tiktok.com/tag/fitcheck", `${RAW}/nthabi.mp4`, `${RAW}/nthabi.jpg`, "trousers"),
  look("asooke", "Aso oke cargos", "Instagram", "@styledbyfeesah", "https://www.instagram.com/explore/tags/asooke/", `${RAW}/asooke.mp4`, `${RAW}/asooke.jpg`, "linen shirt"),
];

function look(
  id: string,
  title: string,
  source: Source,
  handle: string,
  postUrl: string,
  videoUrl: string,
  imageUrl: string,
  shopQuery: string,
): DeskLook {
  return {
    id,
    slug: id,
    title,
    source,
    summary: title,
    image: { uri: imageUrl },
    imageUrl,
    videoUrl,
    postUrl,
    handle,
    garmentIds: [],
    shopQuery,
    heat: `${source} · ${handle}`,
  };
}

function captionFrom(title: string, tag: string) {
  const cleaned = title
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#@]\w+/g, " ")
    .replace(/[-—–_|•·.,!?'"`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const stop = new Set(["the", "and", "this", "that", "with", "from", "just", "today", "for", "you", "my", "a", "to", "of", "in", "on", "is", "it"]);
  const words = cleaned.split(" ").filter((w) => w.length > 1 && !stop.has(w.toLowerCase()));
  if (words.length >= 2) return words.slice(0, 5).join(" ");
  if (words.length === 1) return words[0];
  return tag;
}

type Clip = {
  id: string;
  tag: string;
  title: string;
  play: string;
  cover: string;
  handle: string;
  postUrl: string;
};

async function tagClips(tag: { id: string; tag: string }): Promise<Clip[]> {
  const res = await fetch(`https://www.tikwm.com/api/challenge/posts?challenge_id=${tag.id}&count=8`);
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: {
      videos?: {
        video_id?: string;
        title?: string;
        play?: string;
        cover?: string;
        origin_cover?: string;
        ai_dynamic_cover?: string;
        duration?: number;
        is_ad?: boolean;
        author?: { unique_id?: string };
      }[];
    };
  };
  const vids = json.data?.videos ?? [];
  const out: Clip[] = [];
  for (const v of vids) {
    if (v.is_ad || !v.play || !v.video_id) continue;
    if ((v.duration ?? 0) < 3) continue;
    const handle = v.author?.unique_id ? `@${v.author.unique_id}` : `#${tag.tag}`;
    out.push({
      id: v.video_id,
      tag: tag.tag,
      title: captionFrom(v.title || tag.tag, tag.tag),
      play: v.play,
      cover: v.origin_cover || v.cover || v.ai_dynamic_cover || "",
      handle,
      postUrl: v.author?.unique_id
        ? `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`
        : `https://www.tiktok.com/tag/${tag.tag}`,
    });
  }
  return out;
}

async function recaption(clips: Clip[]): Promise<Record<string, string>> {
  const key = anthropicKey();
  if (!key || !clips.length) return {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `These are live OOTD / fitcheck / fashion videos. Write a 2 to 5 word caption for each that names the clothes on screen. No dashes. No hashtags. No quotes. Plain words only.

Return ONLY JSON: {"captions":{"id":"caption"}}

${clips.map((c) => `${c.id} | #${c.tag} | ${c.handle} | ${c.title}`).join("\n")}`,
          },
        ],
      }),
    });
    if (!res.ok) return {};
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = json.content?.find((c) => c.type === "text")?.text || "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < 0) return {};
    const parsed = JSON.parse(text.slice(start, end + 1)) as { captions?: Record<string, string> };
    const out: Record<string, string> = {};
    for (const [id, cap] of Object.entries(parsed.captions || {})) {
      const clean = cap.replace(/[-—–]/g, " ").replace(/[#@]/g, "").replace(/\s+/g, " ").trim();
      if (clean) out[id] = clean;
    }
    return out;
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

function asLook(c: Clip, title: string): DeskLook {
  return {
    id: c.id,
    slug: c.id,
    title,
    source: "TikTok",
    summary: `#${c.tag}`,
    image: { uri: c.cover },
    imageUrl: c.cover,
    videoUrl: c.play,
    postUrl: c.postUrl,
    handle: c.handle,
    garmentIds: [],
    shopQuery: title,
    heat: `TikTok · #${c.tag}`,
  };
}

export async function liveDesk(): Promise<DeskLook[]> {
  const batches = await Promise.allSettled(TAGS.map((t) => tagClips(t)));
  const picked: Clip[] = [];
  const seen = new Set<string>();
  for (const b of batches) {
    if (b.status !== "fulfilled") continue;
    let n = 0;
    for (const c of b.value) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      picked.push(c);
      n += 1;
      if (n >= 2) break;
    }
  }
  if (!picked.length) return FALLBACK;
  const caps = await recaption(picked);
  const liveLooks = picked.map((c) => asLook(c, caps[c.id] || c.title));
  const extra = FALLBACK.filter((f) => f.source !== "TikTok");
  return [...liveLooks, ...extra];
}
