import AsyncStorage from "@react-native-async-storage/async-storage";
import { arrayRemove, arrayUnion, doc, setDoc } from "firebase/firestore";
import { firebaseDb, firebaseReady } from "./firebase";

const KEY = "uvel-followed-sellers-v1";
let followed = new Set<string>();
let hydrated = false;

export async function hydrateFollowedSellers() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const ids = raw ? JSON.parse(raw) : [];
    if (Array.isArray(ids)) followed = new Set(ids.filter((id): id is string => typeof id === "string"));
  } catch {
    followed = new Set();
  }
}

export function isSellerFollowed(id: string) {
  return followed.has(id);
}

export function toggleSellerFollow(id: string) {
  if (followed.has(id)) followed.delete(id);
  else followed.add(id);
  void AsyncStorage.setItem(KEY, JSON.stringify([...followed]));
  return followed.has(id);
}

/** Mirror seller follows onto the signed-in user's profile for server notifications. */
export async function syncSellerFollow(uid: string, sellerId: string, following: boolean) {
  if (!uid || !sellerId || !firebaseReady()) return;
  try {
    await setDoc(doc(firebaseDb(), "users", uid), {
      followingSellerIds: following ? arrayUnion(sellerId) : arrayRemove(sellerId),
      updatedAt: Date.now(),
    }, { merge: true });
  } catch {
    // Local following still works when Firebase is unavailable.
  }
}
