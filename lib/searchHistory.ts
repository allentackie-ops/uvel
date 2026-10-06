import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "uvel-search-history-v1";
const MAX_RECENT_SEARCHES = 10;

function normalize(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, all) => all.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index)
    .slice(0, MAX_RECENT_SEARCHES);
}

export async function loadRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return normalize(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export async function saveRecentSearches(values: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(normalize(values)));
  } catch {
    // Search history is an optional local convenience.
  }
}

export function addRecentSearch(values: string[], value: string): string[] {
  const next = value.trim();
  if (!next) return normalize(values);
  return normalize([next, ...values]);
}

export { MAX_RECENT_SEARCHES };
