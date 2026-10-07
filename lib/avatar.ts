import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { uploadProfileAvatarToSupabase } from "./supabaseSocial";

export async function uploadProfileAvatar(uri: string): Promise<string> {
  if (!uri) throw new Error("Choose a photo first.");

  let base64: string | undefined;
  try {
    const image = await manipulateAsync(
      uri,
      [{ resize: { width: 512 } }],
      { compress: 0.82, format: SaveFormat.JPEG, base64: true },
    );
    base64 = image.base64;
  } catch {
    throw new Error("Could not prepare that photo. Try choosing another image.");
  }

  if (!base64) throw new Error("Could not prepare that photo. Try choosing another image.");
  if (base64.length > 2_100_000) throw new Error("Choose a profile photo under 1.5 MB.");

  try {
    const avatarUri = await uploadProfileAvatarToSupabase(base64);
    if (!avatarUri) throw new Error("Supabase did not return the saved profile photo.");
    return avatarUri;
  } catch {
    throw new Error("Could not upload your profile picture to Supabase. Please check your connection and try again.");
  }
}
