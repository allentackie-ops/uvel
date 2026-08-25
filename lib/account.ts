import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpsCallable } from "firebase/functions";
import { signOut } from "./auth";
import { firebaseFunctions, firebaseReady } from "./firebase";

export async function deleteAccount() {
  if (!firebaseReady()) throw new Error("Account deletion is unavailable while Firebase is disconnected.");
  await httpsCallable(firebaseFunctions(), "deleteMyAccount")({});
  await signOut();
  const keys = await AsyncStorage.getAllKeys();
  const userKeys = keys.filter((key) => key.startsWith("uvel-"));
  if (userKeys.length) await AsyncStorage.multiRemove(userKeys);
}
