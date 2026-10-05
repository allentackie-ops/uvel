import * as Updates from "expo-updates";
import { useEffect } from "react";

let inFlight = false;

export async function pullOta(): Promise<"ok"> {
  if (__DEV__ || !Updates.isEnabled) return "ok";
  if (inFlight) return "ok";
  inFlight = true;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    /* offline / first binary */
  } finally {
    inFlight = false;
  }
  return "ok";
}

/** Fetch in the background without reloading the live session; Expo applies it on the next cold launch. */
export function useOtaReady() {
  useEffect(() => {
    void pullOta();
  }, []);
  return true;
}
