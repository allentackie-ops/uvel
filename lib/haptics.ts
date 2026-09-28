import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

const KEY = "uvel-haptics-enabled-v1";
let enabled = true;
let hydrated = false;
let hydration: Promise<boolean> | null = null;

export const ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = Haptics.NotificationFeedbackType;

async function hydrate() {
  if (hydrated) return enabled;
  if (!hydration) {
    hydration = AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw !== null) enabled = raw !== "false";
        hydrated = true;
        return enabled;
      })
      .catch(() => {
        hydrated = true;
        return enabled;
      });
  }
  return hydration;
}

void hydrate();

export async function loadHapticsEnabled() {
  return hydrate();
}

export async function setHapticsEnabled(value: boolean) {
  await hydrate();
  enabled = value;
  hydrated = true;
  await AsyncStorage.setItem(KEY, String(value));
}

export function impactAsync(style: Haptics.ImpactFeedbackStyle) {
  if (!enabled) return Promise.resolve();
  return Haptics.impactAsync(style).catch(() => undefined);
}

export function selectionAsync() {
  if (!enabled) return Promise.resolve();
  return Haptics.selectionAsync().catch(() => undefined);
}

export function notificationAsync(type: Haptics.NotificationFeedbackType) {
  if (!enabled) return Promise.resolve();
  return Haptics.notificationAsync(type).catch(() => undefined);
}
