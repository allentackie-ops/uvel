import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { cacheDirectory, deleteAsync, downloadAsync, getInfoAsync, readDirectoryAsync } from "expo-file-system/legacy";
import type { VideoPlayer, VideoThumbnail } from "expo-video";

const LOOK_CACHE_PREFIX = "uvel-look-";
const MIN_VALID_VIDEO_BYTES = 80_000;
export const LOOK_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const LOOK_CACHE_MAX_BYTES = 250 * 1024 * 1024;

function cacheName(url: string) {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (Math.imul(h, 31) + url.charCodeAt(i)) | 0;
  return `${cacheDirectory}${LOOK_CACHE_PREFIX}${Math.abs(h)}.mp4`;
}

const downloads = new Map<string, Promise<string | null>>();
const locals = new Map<string, string>();
let cleanupPromise: Promise<void> | null = null;

function wait(ms: number) {
  return new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
}

/** Removes only Uvel look-video files; user data and unrelated cache files are untouched. */
export function cleanupLookVideoCache() {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    try {
      if (!cacheDirectory) return;
      const names = await readDirectoryAsync(cacheDirectory);
      const files = (await Promise.all(names
        .filter((name) => name.startsWith(LOOK_CACHE_PREFIX) && name.endsWith(".mp4"))
        .map(async (name) => {
          const uri = `${cacheDirectory}${name}`;
          try {
            const info = await getInfoAsync(uri);
            if (!info.exists || info.isDirectory) return null;
            return { uri, size: info.size ?? 0, modifiedAt: (info.modificationTime ?? 0) * 1000 };
          } catch {
            return null;
          }
        })))
        .filter((file): file is { uri: string; size: number; modifiedAt: number } => file !== null);

      const now = Date.now();
      const stale = files.filter((file) => file.modifiedAt > 0 && now - file.modifiedAt > LOOK_CACHE_TTL_MS);
      const staleUris = new Set(stale.map((file) => file.uri));
      let totalBytes = files.filter((file) => !staleUris.has(file.uri)).reduce((sum, file) => sum + file.size, 0);
      const overBudget = new Set<string>();
      for (const file of files.filter((file) => !staleUris.has(file.uri)).sort((a, b) => a.modifiedAt - b.modifiedAt)) {
        if (totalBytes <= LOOK_CACHE_MAX_BYTES) break;
        overBudget.add(file.uri);
        totalBytes -= file.size;
      }

      await Promise.all(files
        .filter((file) => file.size < MIN_VALID_VIDEO_BYTES || staleUris.has(file.uri) || overBudget.has(file.uri))
        .map(async (file) => {
          try {
            await deleteAsync(file.uri, { idempotent: true });
            for (const [url, local] of locals) if (local === file.uri) locals.delete(url);
          } catch {
            // Cache cleanup is best effort and must never affect playback.
          }
        }));
    } catch {
      // Cache cleanup is best effort and must never affect playback.
    } finally {
      cleanupPromise = null;
    }
  })();
  return cleanupPromise;
}

void cleanupLookVideoCache();

async function localVideo(url: string) {
  void cleanupLookVideoCache();
  const dest = cacheName(url);
  const existing = await getInfoAsync(dest);
  if (existing.exists && (existing.size ?? 0) > MIN_VALID_VIDEO_BYTES) {
    const modifiedAt = (existing.modificationTime ?? 0) * 1000;
    if (!modifiedAt || Date.now() - modifiedAt <= LOOK_CACHE_TTL_MS) {
      locals.set(url, dest);
      return dest;
    }
    try {
      await deleteAsync(dest, { idempotent: true });
    } catch {
      // A stale file will be replaced if the download succeeds.
    }
  }
  let pending = downloads.get(url);
  if (!pending) {
    pending = downloadAsync(url, dest, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" },
    })
      .then(async () => {
        const info = await getInfoAsync(dest);
        if (!info.exists || (info.size ?? 0) < MIN_VALID_VIDEO_BYTES) return null;
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
