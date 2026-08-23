import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { cacheDirectory, downloadAsync, getInfoAsync } from "expo-file-system/legacy";
import type { VideoPlayer, VideoThumbnail } from "expo-video";

function cacheName(url: string) {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (Math.imul(h, 31) + url.charCodeAt(i)) | 0;
  return `${cacheDirectory}uvel-look-${Math.abs(h)}.mp4`;
}

const downloads = new Map<string, Promise<string | null>>();
const locals = new Map<string, string>();

function wait(ms: number) {
  return new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
}

async function localVideo(url: string) {
  const dest = cacheName(url);
  const existing = await getInfoAsync(dest);
  if (existing.exists && (existing.size ?? 0) > 80_000) {
    locals.set(url, dest);
    return dest;
  }
  let pending = downloads.get(url);
  if (!pending) {
    pending = downloadAsync(url, dest, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" },
    })
      .then(async () => {
        const info = await getInfoAsync(dest);
        if (!info.exists || (info.size ?? 0) < 80_000) return null;
        locals.set(url, dest);
        return dest;
      })
      .catch(() => null);
    downloads.set(url, pending);
  }
  return pending;
}

async function saveThumb(thumb: VideoThumbnail) {
  const image = await ImageManipulator.manipulate(thumb).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  if (saved.base64) return `data:image/jpeg;base64,${saved.base64}`;
  return saved.uri;
}

export async function frameAtTime(player: VideoPlayer, time: number, _sourceUrl: string) {
  const t = Math.max(0, Number(time) || 0);
  const grab = (async () => {
    try {
      const thumbs = await player.generateThumbnailsAsync([t], { maxWidth: 720, maxHeight: 1280 });
      const thumb = thumbs[0];
      if (!thumb) return null;
      return await saveThumb(thumb);
    } catch {
      return null;
    }
  })();
  return (await Promise.race([grab, wait(2500)])) ?? (await Promise.race([grab, wait(1500)]));
}

export function playableLookVideo(url: string) {
  return locals.get(url) ?? url;
}

export function prefetchLookVideo(url?: string) {
  if (!url || !/^https?:/i.test(url)) return Promise.resolve(null as string | null);
  return localVideo(url);
}
