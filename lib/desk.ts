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

type Seed = {
  id: string;
  source: Source;
  postUrl: string;
  handle: string;
  title: string;
  summary: string;
  shopQuery: string;
  fallbackVideo?: string;
  fallbackImage?: string;
};

const RAW = "https://raw.githubusercontent.com/allentackie-ops/uvel/main/docs/looks";

const SEED: Seed[] = [
  {
    id: "lexia",
    source: "TikTok",
    postUrl: "https://www.tiktok.com/@notverylexi/video/7624626484992298253",
    handle: "@notverylexi",
    title: "OOTD — the grey dress",
    summary: "Square-neck grey maxi, a small black bag. The actual TikTok.",
    shopQuery: "grey maxi dress",
    fallbackVideo: `${RAW}/lexia.mp4`,
    fallbackImage: `${RAW}/lexia.jpg`,
  },
  {
    id: "lexia-today",
    source: "TikTok",
    postUrl: "https://www.tiktok.com/@notverylexi/video/7626790931278187789",
    handle: "@notverylexi",
    title: "OOTD for today",
    summary: "Same creator, another fitcheck that’s actually moving.",
    shopQuery: "bodycon dress",
    fallbackVideo: `${RAW}/lexia-white.mp4`,
    fallbackImage: `${RAW}/lexia-white.jpg`,
  },
  {
    id: "kiki",
    source: "TikTok",
    postUrl: "https://www.tiktok.com/tag/ootd",
    handle: "fitcheck",
    title: "Fit check, posted",
    summary: "A real OOTD video. Hair, knit, denim — moving.",
    shopQuery: "denim tank",
    fallbackVideo: `${RAW}/kiki.mp4`,
    fallbackImage: `${RAW}/kiki.jpg`,
  },
  {
    id: "nthabi",
    source: "TikTok",
    postUrl: "https://www.tiktok.com/tag/fitcheck",
    handle: "@itsnthabimm9zb",
    title: "Same pants, three lengths",
    summary: "One pair of trousers, three ways. The video, not a still.",
    shopQuery: "trousers shirt",
    fallbackVideo: `${RAW}/nthabi.mp4`,
    fallbackImage: `${RAW}/nthabi.jpg`,
  },
  {
    id: "asooke",
    source: "Instagram",
    postUrl: "https://www.instagram.com/explore/tags/asooke/",
    handle: "@styledbyfeesah",
    title: "Aso-oke cargos, linen shirt",
    summary: "Heritage trousers, a crisp shirt. Filmed, not faked.",
    shopQuery: "linen shirt trousers",
    fallbackVideo: `${RAW}/asooke.mp4`,
    fallbackImage: `${RAW}/asooke.jpg`,
  },
];

type Resolved = Seed & { videoUrl?: string; imageUrl?: string };

async function tikwm(postUrl: string): Promise<{ play?: string; cover?: string; title?: string; handle?: string }> {
  if (!postUrl.includes("tiktok.com/@") || !postUrl.includes("/video/")) return {};
  const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(postUrl)}&hd=1`);
  if (!res.ok) return {};
  const json = (await res.json()) as {
    code?: number;
    data?: { play?: string; hdplay?: string; cover?: string; origin_cover?: string; title?: string; author?: { unique_id?: string } };
  };
  const d = json.data;
  if (!d) return {};
  return {
    play: d.hdplay || d.play,
    cover: d.origin_cover || d.cover,
    title: d.title,
    handle: d.author?.unique_id ? `@${d.author.unique_id}` : undefined,
  };
}

async function resolve(seed: Seed): Promise<Resolved> {
  try {
    const live = await tikwm(seed.postUrl);
    return {
      ...seed,
      videoUrl: live.play || seed.fallbackVideo,
      imageUrl: live.cover || seed.fallbackImage,
      handle: live.handle || seed.handle,
      title: seed.title,
    };
  } catch {
    return { ...seed, videoUrl: seed.fallbackVideo, imageUrl: seed.fallbackImage };
  }
}

function asLook(row: Resolved): DeskLook {
  return {
    id: row.id,
    slug: row.id,
    title: row.title,
    source: row.source,
    summary: row.summary,
    image: { uri: row.imageUrl || row.fallbackImage || "" },
    imageUrl: row.imageUrl || row.fallbackImage,
    videoUrl: row.videoUrl || row.fallbackVideo,
    postUrl: row.postUrl,
    handle: row.handle,
    garmentIds: [],
    shopQuery: row.shopQuery,
    heat: `${row.source} · ${row.handle}`,
  };
}

async function anthropicOrder(rows: Resolved[]): Promise<Resolved[]> {
  const key = anthropicKey();
  if (!key || rows.length < 2) return rows;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 700,
        messages: [
          {
            role: "user",
            content: `You are Uvel’s fashion desk. These are LIVE social videos (TikTok / IG / X), not stock photos. Rank them for a homepage of what normal people are wearing today. Prefer real OOTD / fitcheck videos of people in clothes. Skip product-only flats.

Return ONLY JSON: {"ids":["id",...]} using these ids, most relevant first.

${rows.map((r) => `- ${r.id} | ${r.source} | ${r.handle} | ${r.title} | ${r.summary}`).join("\n")}`,
          },
        ],
      }),
    });
    if (!res.ok) return rows;
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = json.content?.find((c) => c.type === "text")?.text || "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < 0) return rows;
    const parsed = JSON.parse(text.slice(start, end + 1)) as { ids?: unknown };
    const ids = Array.isArray(parsed.ids) ? parsed.ids.map(String) : [];
    const map = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids.map((id) => map.get(id)).filter((x): x is Resolved => Boolean(x));
    for (const r of rows) if (!ordered.includes(r)) ordered.push(r);
    return ordered;
  } catch {
    return rows;
  }
}

export async function liveDesk(): Promise<DeskLook[]> {
  const resolved = await Promise.all(SEED.map((s) => resolve(s)));
  const withVideo = resolved.filter((r) => r.videoUrl);
  const ordered = await anthropicOrder(withVideo.length ? withVideo : resolved);
  return ordered.map(asLook);
}
