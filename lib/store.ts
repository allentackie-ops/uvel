import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import type { Session } from "./auth";
import { guessLocale } from "./i18n";
import { detectCountry, setActiveMarket } from "./markets";
import { shouldAskSetup } from "./sessionPath";

type State = {
  isPlus: boolean;
  plusPlan: string;
  saved: string[];
  archetype: string;
  palette: string;
  silhouette: string;
  personUri: string | null;
  avatarUri: string | null;
  findsUsed: number;
  tryOnsUsed: number;
  appearance: "light" | "dark";
  onboarded: boolean;
  onboardVersion: number;
  signedInWith: string;
  uid: string;
  email: string;
  displayName: string;
  locale: string;
  country: string;
  profileDone: boolean;
  birthday: string;
  gender: string;
  styles: string[];
  wardrobeUris: string[];
  wantsUpdates: boolean;
};

const KEY = "uvel-state-v1";
const PROFILES = "uvel-profiles-v1";
const defaults: State = {
  isPlus: false,
  plusPlan: "",
  saved: [],
  archetype: "",
  palette: "",
  silhouette: "",
  personUri: null,
  avatarUri: null,
  findsUsed: 0,
  tryOnsUsed: 0,
  appearance: "light",
  onboarded: false,
  onboardVersion: 0,
  signedInWith: "",
  uid: "",
  email: "",
  displayName: "",
  locale: "",
  country: "",
  profileDone: false,
  birthday: "",
  gender: "",
  styles: [],
  wardrobeUris: [],
  wantsUpdates: false,
};

let memory = { ...defaults };
let hydrated = false;
const listeners = new Set<() => void>();

async function load() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) memory = { ...defaults, ...JSON.parse(raw) };
  if (!memory.locale) memory.locale = guessLocale();
  if (!memory.country) memory.country = detectCountry();
  setActiveMarket(memory.country);
  if ((memory.onboardVersion ?? 0) < 4) memory.onboarded = false;
  hydrated = true;
  listeners.forEach((l) => l());
}

void load().then(() => {
  void import("./auth").then(({ subscribeAuth }) => {
    subscribeAuth((user) => {
      if (!user) return;
      void restoreProfile(user.uid).then((stashed) => {
        memory = {
          ...memory,
          uid: user.uid,
          email: user.email,
          displayName: user.name || (stashed?.displayName as string) || memory.displayName,
          signedInWith: user.provider,
          onboarded: true,
          onboardVersion: Math.max(memory.onboardVersion ?? 0, 4),
          profileDone: memory.profileDone || Boolean(stashed?.profileDone),
          birthday: (stashed?.birthday as string) || memory.birthday,
          gender: (stashed?.gender as string) || memory.gender,
          styles: (stashed?.styles as string[]) || memory.styles,
          wantsUpdates: Boolean(stashed?.wantsUpdates) || memory.wantsUpdates,
        };
        listeners.forEach((l) => l());
        void AsyncStorage.setItem(KEY, JSON.stringify(memory));
      });
    });
  });
});

async function stashProfile() {
  if (!memory.uid || !memory.profileDone) return;
  try {
    const raw = await AsyncStorage.getItem(PROFILES);
    const all = raw ? (JSON.parse(raw) as Record<string, Partial<State>>) : {};
    all[memory.uid] = {
      profileDone: true,
      displayName: memory.displayName,
      avatarUri: memory.avatarUri,
      birthday: memory.birthday,
      gender: memory.gender,
      styles: memory.styles,
      wantsUpdates: memory.wantsUpdates,
    };
    await AsyncStorage.setItem(PROFILES, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

async function restoreProfile(uid: string) {
  try {
    const raw = await AsyncStorage.getItem(PROFILES);
    const all = raw ? (JSON.parse(raw) as Record<string, Partial<State>>) : {};
    return all[uid] ?? null;
  } catch {
    return null;
  }
}

export function snapshot() {
  return { ...memory };
}

async function save(next: Partial<State>) {
  memory = { ...memory, ...next };
  if (next.country) setActiveMarket(next.country);
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
    likePiece: (id: string) => {
      const uid = memory.uid || "me";
      void import("./wardrobe").then(({ toggleLiker }) => {
        const { liked, piece } = toggleLiker(id, {
          uid,
          name: memory.displayName || "Uvel member",
          photo: memory.avatarUri || memory.personUri || undefined,
        });
        void save({
          saved: liked ? Array.from(new Set([...memory.saved, id])) : memory.saved.filter((x) => x !== id),
        });
        if (!liked || !piece?.ownerId || piece.ownerId === uid) return;
        void import("./chat").then(({ readUserLite }) =>
          readUserLite(piece.ownerId as string).then((other) => {
            const token = typeof other?.expoPushToken === "string" ? other.expoPushToken : "";
            if (!token) return;
            const who = memory.displayName || "Someone";
            void import("./push").then(({ sendPush }) =>
              sendPush(token, "New like", `${who} liked ${piece.name}`, { pieceId: id }),
            );
          }),
        );
      });
    },
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
    setAvatar: (uri: string | null) => save({ avatarUri: uri }).then(() => stashProfile()),
    setAppearance: (appearance: "light" | "dark") => save({ appearance }),
    setLocale: (locale: string) => save({ locale }),
    setCountry: (country: string) => save({ country }),
    completeOnboard: (provider?: string) =>
      save({
        onboarded: true,
        onboardVersion: 4,
        signedInWith: provider ?? memory.signedInWith,
      }),
    acceptSession: async (s: Session) => {
      const stashed = await restoreProfile(s.uid);
      const skip = !shouldAskSetup(s.via) || Boolean(stashed?.profileDone);
      await save({
        onboarded: true,
        onboardVersion: 4,
        signedInWith: s.provider,
        uid: s.uid,
        email: s.email,
        displayName: (stashed?.displayName as string) || s.name || memory.displayName,
        avatarUri: (stashed?.avatarUri as string) || memory.avatarUri,
        profileDone: skip,
        birthday: (stashed?.birthday as string) || memory.birthday,
        gender: (stashed?.gender as string) || memory.gender,
        styles: (stashed?.styles as string[]) || memory.styles,
        wantsUpdates: Boolean(stashed?.wantsUpdates),
      });
    },
    completeProfile: (patch: {
      displayName?: string;
      birthday: string;
      gender: string;
      personUri: string | null;
      styles: string[];
      wardrobeUris: string[];
      wantsUpdates: boolean;
    }) => {
      void import("./auth").then(({ writeUserProfile }) => {
        if (!memory.uid) return;
        void writeUserProfile(memory.uid, {
          profileDone: true,
          seen: true,
          name: patch.displayName || memory.displayName,
          birthday: patch.birthday,
          gender: patch.gender,
          styles: patch.styles,
          wantsUpdates: patch.wantsUpdates,
        });
      });
      return save({
        ...patch,
        profileDone: true,
        onboarded: true,
        onboardVersion: 4,
      }).then(() => stashProfile());
    },
    signOutAccount: async () => {
      const { signOut } = await import("./auth");
      await stashProfile();
      await signOut();
      await save({
        onboarded: false,
        signedInWith: "",
        uid: "",
        email: "",
        displayName: "",
        profileDone: false,
        birthday: "",
        gender: "",
        styles: [],
        wardrobeUris: [],
        wantsUpdates: false,
        personUri: null,
        avatarUri: null,
      });
    },
  };
}
