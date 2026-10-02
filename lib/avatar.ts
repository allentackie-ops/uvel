import { httpsCallable } from "firebase/functions";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { firebaseFunctions } from "./firebase";

type UpdateAvatarResponse = {
  avatarUri?: string;
};

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

  try {
    const updateAvatar = httpsCallable<{ imageBase64: string }, UpdateAvatarResponse>(
      firebaseFunctions(),
      "updateProfileAvatar",
    );
    const result = await updateAvatar({ imageBase64: base64 });
    const avatarUri = result.data?.avatarUri;
    if (!avatarUri) throw new Error("The profile photo could not be saved.");
    return avatarUri;
  } catch (error) {
    if (error instanceof Error && error.message && !/internal/i.test(error.message)) {
      throw error;
    }
    throw new Error("Could not sync your profile picture. Please try again.");
  }
}
