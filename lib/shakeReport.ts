import AsyncStorage from "@react-native-async-storage/async-storage";
import { Accelerometer } from "expo-sensors";
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

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
    let shakeWindowStart = 0;
    let shakeHits = 0;
    let cancelled = false;
    let subscription: { remove: () => void } | undefined;

    const start = async () => {
      try {
        if (!(await Accelerometer.isAvailableAsync())) return;
        let permission = await Accelerometer.getPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) {
          permission = await Accelerometer.requestPermissionsAsync();
        }
        if (cancelled || !permission.granted) return;

        Accelerometer.setUpdateInterval(60);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          if (!previous) {
            previous = { x, y, z };
            return;
          }
          const delta = Math.sqrt(
            (x - previous.x) ** 2 +
              (y - previous.y) ** 2 +
              (z - previous.z) ** 2,
          );
          previous = { x, y, z };
          const now = Date.now();
          if (delta > 0.2 && now - lastShake > 1600) {
            if (now - (shakeWindowStart || now) > 1200) {
              shakeWindowStart = now;
              shakeHits = 0;
            }
            shakeHits += 1;
          }
          if (shakeHits >= 2 && now - lastShake > 1600) {
            lastShake = now;
            shakeHits = 0;
            onShake();
          }
        });
      } catch {
        // Sensors may be unavailable or denied on a particular device/build.
      }
    };

    void start();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active" && !cancelled) {
        subscription?.remove();
        subscription = undefined;
        previous = undefined;
        shakeWindowStart = 0;
        shakeHits = 0;
        void start();
      }
    });
    return () => {
      cancelled = true;
      appState.remove();
      subscription?.remove();
    };
  }, [active, enabledPreference, onShake]);
  return enabledPreference;
}
