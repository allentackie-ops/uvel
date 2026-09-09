import AsyncStorage from "@react-native-async-storage/async-storage";
import { Accelerometer } from "expo-sensors";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

const STORAGE_KEY = "@uvel/shake-report-enabled";
const DEFAULT_ENABLED = true;
const listeners = new Set<(enabled: boolean) => void>();
let enabled = DEFAULT_ENABLED;
let hydrated = false;
let hydratePromise: Promise<void> | undefined;

function notify() {
  listeners.forEach((listener) => listener(enabled));
}

export function useShakeReportEnabled() {
  const [value, setValue] = useState(enabled);
  useEffect(() => {
    const listener = (next: boolean) => setValue(next);
    listeners.add(listener);
    void hydrateShakeReport();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return value;
}

export async function hydrateShakeReport() {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => {
      if (stored === "0" || stored === "1") enabled = stored === "1";
      hydrated = true;
      notify();
    })
    .catch(() => {
      hydrated = true;
    })
    .finally(() => {
      hydratePromise = undefined;
    });
  return hydratePromise;
}

export async function setShakeReportEnabled(next: boolean) {
  enabled = next;
  notify();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // The in-memory value still works for the current session.
  }
}

export function useShakeDetector(onShake: () => void, active = true) {
  const enabledPreference = useShakeReportEnabled();
  useEffect(() => {
    if (!active || !enabledPreference || Platform.OS === "web") return;
    let previous: { x: number; y: number; z: number } | undefined;
    let lastShake = 0;
    Accelerometer.setUpdateInterval(80);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      if (!previous) {
        previous = { x, y, z };
        return;
      }
      const delta = Math.abs(x - previous.x) + Math.abs(y - previous.y) + Math.abs(z - previous.z);
      previous = { x, y, z };
      const now = Date.now();
      if (delta > 2.4 && now - lastShake > 1800) {
        lastShake = now;
        onShake();
      }
    });
    return () => subscription.remove();
  }, [active, enabledPreference, onShake]);
  return enabledPreference;
}
