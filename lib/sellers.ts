import AsyncStorage from "@react-native-async-storage/async-storage";

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
