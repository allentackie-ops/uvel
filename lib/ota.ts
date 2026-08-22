import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

let inFlight = false;

export async function pullOta(): Promise<"reload" | "ok"> {
  return pull();
}

async function pull(): Promise<"reload" | "ok"> {
  if (__DEV__ || !Updates.isEnabled) return "ok";
  if (inFlight) return "ok";
  inFlight = true;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
      return "reload";
    }
  } catch {
    /* offline / first binary */
  } finally {
    inFlight = false;
  }
  return "ok";
}

/** Check on launch and whenever the app comes back. Hold the splash until the first check finishes (or 4s). */
export function useOtaReady() {
  const [ready, setReady] = useState(__DEV__);

  useEffect(() => {
    let cancelled = false;
    const failOpen = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 4000);

    void pull().then((r) => {
      if (cancelled || r === "reload") return;
      clearTimeout(failOpen);
      setReady(true);
    });

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void pull();
    });

    return () => {
      cancelled = true;
      clearTimeout(failOpen);
      sub.remove();
    };
  }, []);

  return ready;
}
