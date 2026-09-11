import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Linking } from "react-native";

async function need(kind: "camera" | "library") {
  const perm =
    kind === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.granted) return;
  if (perm.canAskAgain === false) await Linking.openSettings();
  throw new Error(
    kind === "camera"
      ? "Turn on Camera for Uvel in Settings."
      : "Turn on Photos for Uvel in Settings.",
  );
}

export async function takePhoto(front = true) {
  await need("camera");
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.55,
    allowsEditing: false,
    cameraType: front ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
  });
  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

export async function pickFromLibrary() {
  await need("library");
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.55,
    allowsEditing: false,
  });
  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

async function copyFounderImport(uri: string, name?: string) {
  const root = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ""}founder-imports/`;
  await FileSystem.makeDirectoryAsync(root, { intermediates: true }).catch(() => undefined);
  const safeName = (name || `canvas-work-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, "-");
  const destination = `${root}${Date.now()}-${safeName}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

export async function importFounderWork() {
  const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) return null;
  if (asset.mimeType === "application/pdf" || asset.name?.toLowerCase().endsWith(".pdf")) return { uri: await copyFounderImport(asset.uri, asset.name || "reference.pdf"), name: asset.name || "Imported reference.pdf", kind: "document" as const };
  return { uri: await copyFounderImport(asset.uri, asset.name), name: asset.name || "Imported canvas work", kind: "image" as const };
}

export async function saveFounderPhotoReference(uri: string) {
  if (uri.startsWith("file://") && uri.includes("founder-imports/")) return uri;
  return copyFounderImport(uri);
}

export async function takeListingPhoto() {
  await need("camera");
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.72,
    allowsEditing: true,
    aspect: [4, 5],
    cameraType: ImagePicker.CameraType.back,
  });
  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

export async function pickListingPhoto() {
  await need("library");
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.72,
    allowsEditing: true,
    aspect: [4, 5],
  });
  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

async function persistListingClip(uri: string, duration?: number | null) {
  if (typeof duration === "number" && duration > 15.5) {
    throw new Error("Keep the clip to 15 seconds.");
  }
  const root = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ""}listing-clips/`;
  await FileSystem.makeDirectoryAsync(root, { intermediates: true }).catch(() => undefined);
  const destination = `${root}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

export async function takeListingClip() {
  await need("camera");
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ["videos"],
    quality: 0.7,
    videoMaxDuration: 15,
    allowsEditing: true,
    cameraType: ImagePicker.CameraType.back,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  if (!asset?.uri) return null;
  return persistListingClip(asset.uri, asset.duration);
}

export async function pickListingClip() {
  await need("library");
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["videos"],
    quality: 0.7,
    videoMaxDuration: 15,
    allowsEditing: true,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  if (!asset?.uri) return null;
  return persistListingClip(asset.uri, asset.duration);
}

export async function takeAvatar() {
  await need("camera");
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.72,
    allowsEditing: true,
    aspect: [1, 1],
    cameraType: ImagePicker.CameraType.front,
  });
  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

export async function pickAvatar() {
  await need("library");
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.72,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

export async function pickLogo() {
  await need("library");
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.82,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

export async function takeLogo() {
  await need("camera");
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.82,
    allowsEditing: true,
    aspect: [1, 1],
    cameraType: ImagePicker.CameraType.back,
  });
  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

export async function pickBannerImage() {
  await need("library");
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.82,
    allowsEditing: true,
    aspect: [16, 9],
  });
  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

export async function pickBannerVideo() {
  await need("library");
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["videos"],
    quality: 0.8,
    videoMaxDuration: 30,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  return asset?.uri ?? null;
}
