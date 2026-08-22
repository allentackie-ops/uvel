import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

type State = {
  isPlus: boolean;
  plusPlan: string;
  saved: string[];
  archetype: string;
  palette: string;
  silhouette: string;
  personUri: string | null;
  findsUsed: number;
  tryOnsUsed: number;
  appearance: "light" | "dark";
  onboarded: boolean;
  onboardVersion: number;
};

const KEY = "uvel-state-v1";
const defaults: State = {
  isPlus: false,
  plusPlan: "",
  saved: [],
  archetype: "",
  palette: "",
  silhouette: "",
  personUri: null,
  findsUsed: 0,
  tryOnsUsed: 0,
  appearance: "light",
  onboarded: false,
  onboardVersion: 0,
};

let memory = { ...defaults };
let hydrated = false;
const listeners = new Set<() => void>();

async function load() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) memory = { ...defaults, ...JSON.parse(raw) };
  if ((memory.onboardVersion ?? 0) < 2) memory.onboarded = false;
  hydrated = true;
  listeners.forEach((l) => l());
}

void load();

async function save(next: Partial<State>) {
  memory = { ...memory, ...next };
  listeners.forEach((l) => l());
  await AsyncStorage.setItem(KEY, JSON.stringify(memory));
}

export function useUvel() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  return {
    ...memory,
    hydrated,
    remainingFinds: memory.isPlus ? 99 : Math.max(0, 2 - memory.findsUsed),
    remainingTryOns: memory.isPlus ? 99 : Math.max(0, 1 - memory.tryOnsUsed),
    toggleSaved: (id: string) =>
      save({
        saved: memory.saved.includes(id)
          ? memory.saved.filter((x) => x !== id)
          : [...memory.saved, id],
      }),
    consumeFind: () => {
      if (memory.isPlus) return true;
      if (memory.findsUsed >= 2) return false;
      void save({ findsUsed: memory.findsUsed + 1 });
      return true;
    },
    consumeTryOn: () => {
      if (memory.isPlus) return true;
      if (memory.tryOnsUsed >= 1) return false;
      void save({ tryOnsUsed: memory.tryOnsUsed + 1 });
      return true;
    },
    activatePlus: (plan: string) => save({ isPlus: true, plusPlan: plan }),
    setStyle: (patch: Partial<State>) => save(patch),
    setPerson: (uri: string | null) => save({ personUri: uri }),
    setAppearance: (appearance: "light" | "dark") => save({ appearance }),
    completeOnboard: () => save({ onboarded: true, onboardVersion: 2 }),
  };
}
