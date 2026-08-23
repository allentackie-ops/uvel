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
    allowsEditing: false,
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
    allowsEditing: false,
  });
  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}
