import { anthropicKey, openaiKey } from "./tryon";
import { igQuery, rankLooks, type Dna } from "./styleDna";
import { aiGeneratedFromUnknown } from "./contentLabels";

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
  aiGenerated?: boolean;
  country?: string;
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
  look("lexia", "Grey maxi dress", "TikTok", "@notverylexi", "https://www.tiktok.com/@notverylexi/video/7624626484992298253", `${RAW}/lexia.mp4`, `${RAW}/lexia.jpg`, "grey dress", "US"),
  look("kiki", "Fit check", "TikTok", "fitcheck", "https://www.tiktok.com/tag/ootd", `${RAW}/kiki.mp4`, `${RAW}/kiki.jpg`, "denim", "US"),
  look("asooke", "Aso oke cargos", "Instagram", "@styledbyfeesah", "https://www.instagram.com/explore/tags/ootd/", `${RAW}/asooke.mp4`, `${RAW}/asooke.jpg`, "linen shirt", "GH"),
  look("lagos-loafers", "Shirt and loafers, Lagos", "Instagram", "Lagos", "https://www.instagram.com/explore/tags/menswear/", "", `${RAW}/lagos-loafers.jpg`, "shirt loafers", "NG"),
  look("sooj", "Proof of life", "Instagram", "@sooj_official", "https://www.instagram.com/sooj_official/", "", `${RAW}/sooj.jpg`, "cream tee trousers", "US"),
];

const FALLBACK_BY_SOURCE = {
  TikTok: FALLBACK.filter((item) => item.source === "TikTok"),
  Instagram: FALLBACK.filter((item) => item.source === "Instagram"),
} satisfies Partial<Record<Source, DeskLook[]>>;

function look(
  id: string,
  title: string,
  source: Source,
  handle: string,
  postUrl: string,
  videoUrl: string,
  imageUrl: string,
  shopQuery: string,
  country?: string,
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
    country,
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

function timeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch(() => {
      clearTimeout(t);
      resolve(null);
    });
  });
}

type Clip = {
  id: string;
  tag: string;
  title: string;
  play: string;
  cover: string;
  handle: string;
  postUrl: string;
  aiGenerated?: boolean;
  country?: string;
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
        ai_generated?: boolean;
        is_ai_generated?: boolean;
        content_label?: string;
        labels?: string[];
        author?: { unique_id?: string; country?: string };
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
        aiGenerated: aiGeneratedFromUnknown(v) || undefined,
        country: typeof v.author?.country === "string" ? v.author.country.toUpperCase() : undefined,
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

function asTikTok(c: Clip, title: string): DeskLook {
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
    aiGenerated: c.aiGenerated,
    country: c.country,
  };
}

async function tiktokLooks(): Promise<DeskLook[]> {
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
  if (!picked.length) return [];
  const caps = await recaption(picked);
  return picked.map((c) => asTikTok(c, caps[c.id] || c.title));
}

function igVideoFromEmbed(html: string): string {
  const i = html.indexOf("video_url");
  if (i < 0) return "";
  let chunk = html.slice(i, i + 8000);
  chunk = chunk.replace(/\\u0026/gi, "&").replace(/\\u0025/gi, "%").replace(/\\u003d/gi, "=");
  chunk = chunk.replace(/\\+/g, "");
  const m = chunk.match(/https:\/\/scontent[^"\s<>]+?\.mp4[^"\s<>]*/);
  return m?.[0] ?? "";
}

async function embedVideo(code: string): Promise<string> {
  const headers = { "User-Agent": "Mozilla/5.0" };
  for (const path of [`reel/${code}/embed/`, `reel/${code}/embed/captioned/`, `p/${code}/embed/`]) {
    try {
      const res = await fetch(`https://www.instagram.com/${path}`, { headers });
      if (!res.ok) continue;
      const video = igVideoFromEmbed(await res.text());
      if (video) return video;
    } catch {
      /* next */
    }
  }
  return "";
}

async function hydrateIg(code: string): Promise<DeskLook | null> {
  try {
    const postUrl = `https://www.instagram.com/reel/${code}/`;
    const headers = { "User-Agent": "Mozilla/5.0" };
    const [oeRes, video] = await Promise.all([
      fetch(`https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(postUrl)}`, { headers }).catch(() => null),
      embedVideo(code),
    ]);
    if (!video) return null;
    let title = "fit check";
    let handle = "@instagram";
    let thumb = `https://www.instagram.com/p/${code}/media/?size=l`;
    let aiGenerated = false;
    if (oeRes && oeRes.ok) {
      const d = (await oeRes.json()) as { title?: string; author_name?: string; thumbnail_url?: string; aiGenerated?: boolean; isAiGenerated?: boolean; contentLabel?: string; labels?: string[] };
      if (d.title) title = d.title;
      if (d.author_name) handle = `@${d.author_name}`;
      if (d.thumbnail_url) thumb = d.thumbnail_url;
      aiGenerated = aiGeneratedFromUnknown(d);
    }
    const caption = captionFrom(title, "ootd");
    return {
      id: `ig-${code}`,
      slug: code,
      title: caption,
      source: "Instagram",
      summary: "#ootd",
      image: { uri: thumb },
      imageUrl: thumb,
      videoUrl: video,
      postUrl,
      handle,
      garmentIds: [],
      shopQuery: caption,
      heat: `Instagram · ${handle}`,
      aiGenerated: aiGenerated || undefined,
    };
  } catch {
    return null;
  }
}

let deskDna: Dna | null = null;

async function instagramLooks(): Promise<DeskLook[]> {
  const key = anthropicKey();
  if (!key) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 14000);
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
        max_tokens: 400,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 1 }],
        messages: [
          {
            role: "user",
            content: deskDna ? igQuery(deskDna) : "web search: site:instagram.com/reel ootd fitcheck. List every instagram.com/reel URL you saw.",
          },
        ],
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const blob = JSON.stringify(json);
    const codes = [...new Set([...blob.matchAll(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]{5,})/g)].map((m) => m[1]))];
    const hydrated = await Promise.all(codes.slice(0, 8).map((c) => timeout(hydrateIg(c), 12000)));
    return hydrated.filter((x): x is DeskLook => Boolean(x && x.videoUrl));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

type SnapRaw = {
  id: string;
  media: string;
  cover: string;
  views: number;
  aiGenerated?: boolean;
};

async function snapRaw(): Promise<SnapRaw[]> {
  const res = await fetch("https://www.snapchat.com/spotlight", {
    headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15" },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const start = html.indexOf('<script id="__NEXT_DATA__"');
  if (start < 0) return [];
  const jsonStart = html.indexOf(">", start) + 1;
  const jsonEnd = html.indexOf("</script>", jsonStart);
  if (jsonEnd < 0) return [];
  const data = JSON.parse(html.slice(jsonStart, jsonEnd)) as {
    props?: {
      pageProps?: {
        spotlightFeed?: {
          spotlightStories?: {
            story?: {
              snapList?: {
                snapId?: { value?: string };
                snapUrls?: { mediaUrl?: string; mediaPreviewUrl?: { value?: string } };
              }[];
            };
            metadata?: { videoMetadata?: { viewCount?: string; thumbnailUrl?: string } };
          }[];
        };
      };
    };
  };
  const stories = data.props?.pageProps?.spotlightFeed?.spotlightStories ?? [];
  const out: SnapRaw[] = [];
  for (const s of stories) {
    const snap = s.story?.snapList?.[0];
    const media = snap?.snapUrls?.mediaUrl;
    const cover = snap?.snapUrls?.mediaPreviewUrl?.value || s.metadata?.videoMetadata?.thumbnailUrl || "";
    const id = snap?.snapId?.value;
    if (!media || !id) continue;
    out.push({
      id,
      media,
      cover,
      views: Number(s.metadata?.videoMetadata?.viewCount || 0),
      aiGenerated: aiGeneratedFromUnknown(s) || undefined,
    });
  }
  return out.sort((a, b) => b.views - a.views);
}

async function pickFashionSnaps(snaps: SnapRaw[]): Promise<{ id: string; caption: string }[]> {
  const key = openaiKey();
  const slice = snaps.slice(0, 8);
  if (!key || !slice.length) return [];
  try {
    const content: unknown[] = [
      {
        type: "text",
        text: `These Snapchat stills are numbered 0 to ${slice.length - 1}. For EACH index return whether it is a fashion/outfit/OOTD photo of a person in clothes. Caption 2-5 words naming the clothes. No dashes.
${deskDna?.archetype ? `Prefer looks that fit: ${[deskDna.archetype, deskDna.palette, deskDna.silhouette].filter(Boolean).join(", ")}.` : ""}

JSON: {"picks":[{"i":0,"fashion":true,"caption":"white tank denim shorts"}]}`,
      },
    ];
    for (const s of slice) {
      content.push({ type: "image_url", image_url: { url: s.cover, detail: "low" } });
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content }],
      }),
    });
    if (!res.ok) return slice.slice(0, 4).map((s) => ({ id: s.id, caption: "Spotlight look" }));
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content || "{}") as {
      picks?: { i?: number; fashion?: boolean; caption?: string }[];
    };
    const fashion = (parsed.picks || [])
      .filter((p) => p.fashion && typeof p.i === "number" && slice[p.i])
      .map((p) => ({
        id: slice[p.i!].id,
        caption: captionFrom(p.caption || "Spotlight look", "ootd"),
      }));
    return fashion.slice(0, 5);
  } catch {
    return [];
  }
}

async function snapLooks(): Promise<DeskLook[]> {
  const raw = await snapRaw();
  if (!raw.length) return [];
  const picks = await pickFashionSnaps(raw);
  const byId = new Map(raw.map((s) => [s.id, s]));
  return picks
    .map((p) => {
      const s = byId.get(p.id);
      if (!s) return null;
      return {
        id: `snap-${s.id.slice(0, 18)}`,
        slug: s.id.slice(0, 18),
        title: p.caption,
        source: "Snapchat" as const,
        summary: "Spotlight",
        image: { uri: s.cover },
        imageUrl: s.cover,
        videoUrl: s.media,
        postUrl: "https://www.snapchat.com/spotlight",
        handle: "Spotlight",
        garmentIds: [],
        shopQuery: p.caption,
        heat: "Snapchat · Spotlight",
        aiGenerated: s.aiGenerated,
      } as DeskLook;
    })
    .filter((x): x is DeskLook => Boolean(x));
}

function weave(groups: DeskLook[][]) {
  const out: DeskLook[] = [];
  const seen = new Set<string>();
  let i = 0;
  let more = true;
  while (more && out.length < 18) {
    more = false;
    for (const g of groups) {
      const row = g[i];
      if (!row) continue;
      more = true;
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
    i += 1;
  }
  return out;
}

export async function liveDesk(onPartial?: (looks: DeskLook[]) => void, dna?: Dna | null): Promise<DeskLook[]> {
  deskDna = dna || null;
  const sort = (rows: DeskLook[]) => (dna ? rankLooks(rows, dna) : rows);
  const buckets: DeskLook[][] = [[], [], []];
  const publish = () => {
    const mixed = sort(weave(buckets));
    if (mixed.length) onPartial?.(mixed);
    return mixed;
  };

  const tt = timeout(tiktokLooks(), 12000).then((v) => {
    buckets[0] = v?.length ? v : FALLBACK_BY_SOURCE.TikTok || [];
    return publish();
  });
  const ig = timeout(instagramLooks(), 16000).then((v) => {
    buckets[1] = v?.length ? v : FALLBACK_BY_SOURCE.Instagram || [];
    return publish();
  });
  const snap = timeout(snapLooks(), 14000).then((v) => {
    buckets[2] = v || [];
    return publish();
  });

  await Promise.race([tt, new Promise((r) => setTimeout(r, 4500))]);
  const early = publish();
  void Promise.all([ig, snap, tt]).then(() => publish());
  if (early.length) return early;
  const fb = sort(FALLBACK);
  onPartial?.(fb);
  return fb;
}
