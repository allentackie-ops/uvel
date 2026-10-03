import * as FileSystem from "expo-file-system/legacy";

const FOLDER = "mirror-person";

export async function persistMirrorPhoto(uri: string) {
  if (!uri) throw new Error("Choose a photo first.");
  if (!uri.startsWith("file://")) return uri;
  const directory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!directory) throw new Error("This photo could not be saved on this device.");
  const root = `${directory}${FOLDER}/`;
  if (uri.startsWith(root)) return uri;
  await FileSystem.makeDirectoryAsync(root, { intermediates: true }).catch(() => undefined);
  const extension = uri.match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1]?.toLowerCase() || "jpg";
  const destination = `${root}${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}
