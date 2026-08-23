import * as Updates from "expo-updates";
import { useEffect } from "react";
import { AppState } from "react-native";

let inFlight = false;
let downloaded = false;

export async function pullOta(): Promise<"reload" | "ok"> {
  return pull(false);
}

async function pull(apply: boolean): Promise<"reload" | "ok"> {
  if (__DEV__ || !Updates.isEnabled) return "ok";
  if (inFlight) return "ok";
  inFlight = true;
  try {
    if (apply && downloaded) {
      await Updates.reloadAsync();
      return "reload";
    }
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      downloaded = true;
      if (apply) {
        await Updates.reloadAsync();
        return "reload";
      }
    }
  } catch {
    /* offline / first binary */
  } finally {
    inFlight = false;
  }
  return "ok";
}

/** Fetch in the background. Never block first paint. Apply when they come back. */
export function useOtaReady() {
  useEffect(() => {
    void pull(false);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void pull(true);
    });
    return () => sub.remove();
  }, []);
  return true;
}
