import * as ImagePicker from "expo-image-picker";
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

