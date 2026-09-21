import AsyncStorage from "@react-native-async-storage/async-storage";
import { readUserProfile, writeUserProfile } from "./auth";

export type PrivacySettingKey = "marketingFeature" | "favoriteNotifications" | "personalizedContent" | "recentlyViewed";

export type PrivacySettings = Record<PrivacySettingKey, boolean>;

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  marketingFeature: true,
  favoriteNotifications: true,
  personalizedContent: true,
  recentlyViewed: true,
};

const KEY = "uvel-privacy-settings-v1";
function storageKey(uid?: string) {
  return uid ? `${KEY}-${uid}` : `${KEY}-guest`;
}

export async function loadPrivacySettings(uid?: string): Promise<PrivacySettings> {
  let local: Partial<PrivacySettings> = {};
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    local = raw ? (JSON.parse(raw) as Partial<PrivacySettings>) : {};
  } catch {
    local = {};
  }

  let remote: Partial<PrivacySettings> = {};
  if (uid) {
    try {
      const profile = await readUserProfile(uid);
      if (profile?.privacySettings && typeof profile.privacySettings === "object") {
        remote = profile.privacySettings as Partial<PrivacySettings>;
      }
    } catch {
      remote = {};
    }
  }

  const merged = { ...DEFAULT_PRIVACY_SETTINGS, ...local, ...remote };
  await AsyncStorage.setItem(storageKey(uid), JSON.stringify(merged)).catch(() => undefined);
  return merged;
}

export async function savePrivacySetting(uid: string | undefined, key: PrivacySettingKey, value: boolean, current: PrivacySettings) {
  const next = { ...current, [key]: value };
  await AsyncStorage.setItem(storageKey(uid), JSON.stringify(next));
  if (uid) {
    await writeUserProfile(uid, { privacySettings: next });
  }
  return next;
}
