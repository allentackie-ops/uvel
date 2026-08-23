import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { cacheDirectory, downloadAsync, getInfoAsync } from "expo-file-system/legacy";
import { createVideoPlayer, type VideoPlayer, type VideoThumbnail } from "expo-video";

function cacheName(url: string) {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (Math.imul(h, 31) + url.charCodeAt(i)) | 0;
  return `${cacheDirectory}uvel-look-${Math.abs(h)}.mp4`;
}

const downloads = new Map<string, Promise<string>>();

async function localVideo(url: string) {
  const dest = cacheName(url);
  const existing = await getInfoAsync(dest);
  if (existing.exists) return dest;
  let pending = downloads.get(url);
  if (!pending) {
    pending = downloadAsync(url, dest).then(() => dest);
    downloads.set(url, pending);
  }
  return pending;
}

async function saveThumb(thumb: VideoThumbnail) {
  const image = await ImageManipulator.manipulate(thumb).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (saved.base64) return `data:image/jpeg;base64,${saved.base64}`;
  return saved.uri;
}

function waitReady(player: VideoPlayer) {
  return new Promise<void>((resolve) => {
    if (player.duration > 0) {
      resolve();
      return;
    }
    const t = setTimeout(() => {
      sub.remove();
      resolve();
    }, 2500);
    const sub = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") {
        clearTimeout(t);
        sub.remove();
        resolve();
      }
    });
  });
}

async function thumbsAt(player: VideoPlayer, time: number) {
  const thumbs = await player.generateThumbnailsAsync([Math.max(0, time)], { maxWidth: 720, maxHeight: 1280 });
  const thumb = thumbs[0];
  if (!thumb) return null;
  const actual = Number(thumb.actualTime) || 0;
  const uri = await saveThumb(thumb);
  return { uri, actual };
}

export async function frameAtTime(player: VideoPlayer, time: number, sourceUrl: string) {
  const t = Math.max(0, time);
  try {
    const live = await thumbsAt(player, t);
    if (live?.uri && (t < 0.25 || Math.abs(live.actual - t) <= 0.45)) return live.uri;
  } catch {
    /* remote seek often snaps to 0 — fall through to a local file */
  }
  try {
    const local = await localVideo(sourceUrl);
    const probe = createVideoPlayer(local);
    await waitReady(probe);
    const fromFile = await thumbsAt(probe, t);
    (probe as { release?: () => void }).release?.();
    if (fromFile?.uri) return fromFile.uri;
  } catch {
    /* keep going */
  }
  try {
    const live = await thumbsAt(player, t);
    return live?.uri ?? null;
  } catch {
    return null;
  }
}

export function prefetchLookVideo(url?: string) {
  if (!url || !/^https?:/i.test(url)) return;
  void localVideo(url).catch(() => undefined);
}
