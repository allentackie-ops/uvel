import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import type { Session } from "./auth";
import { guessLocale } from "./i18n";
import { detectCountry, setActiveMarket } from "./markets";
import { skipSetup } from "./sessionPath";
import { syncSavedLikes, toggleLiker } from "./wardrobe";

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
  profileChecked: boolean;
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
  profileChecked: false,
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
  if (memory.uid && memory.profileDone) memory.profileChecked = true;
  hydrated = true;
  listeners.forEach((l) => l());
}

void load().then(() => {
  void import("./auth").then(({ subscribeAuth }) => {
    subscribeAuth((user) => {
      if (!user) {
        memory = { ...memory, profileChecked: true };
        listeners.forEach((l) => l());
        return;
      }
      void applyAccount(user, { restored: true });
    });
  });
  setTimeout(() => {
    if (memory.profileChecked) return;
    memory = { ...memory, profileChecked: true };
    listeners.forEach((l) => l());
  }, 10000);
});

async function applyAccount(
  user: Session,
  opts: { restored?: boolean } = {},
) {
  const stashed = await restoreProfile(user.uid);
  const knownDone = skipSetup({
    via: opts.restored ? null : user.via,
    remote: null,
    stashedDone: Boolean(stashed?.profileDone) || memory.profileDone,
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt,
  });
  if (knownDone) {
    memory = {
      ...memory,
      uid: user.uid,
      email: user.email,
      displayName: (stashed?.displayName as string) || user.name || memory.displayName,
      signedInWith: user.provider,
      onboarded: true,
      onboardVersion: Math.max(memory.onboardVersion ?? 0, 4),
      profileDone: true,
      profileChecked: true,
      birthday: (stashed?.birthday as string) || memory.birthday,
      gender: (stashed?.gender as string) || memory.gender,
      styles: (stashed?.styles as string[]) || memory.styles,
      wantsUpdates: Boolean(stashed?.wantsUpdates) || memory.wantsUpdates,
      avatarUri: (stashed?.avatarUri as string) || memory.avatarUri,
    };
    listeners.forEach((l) => l());
    void AsyncStorage.setItem(KEY, JSON.stringify(memory));
  }

  let remote: Record<string, unknown> | null = null;
  try {
    const { readUserProfile } = await import("./auth");
    remote = await readUserProfile(user.uid);
  } catch {
    remote = null;
  }
  const done = skipSetup({
    via: opts.restored ? null : user.via,
    remote,
    stashedDone: Boolean(stashed?.profileDone) || memory.profileDone || knownDone,
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt,
  });
  memory = {
    ...memory,
    uid: user.uid,
    email: user.email,
    displayName:
      (typeof remote?.name === "string" && remote.name) ||
      (stashed?.displayName as string) ||
      user.name ||
      memory.displayName,
    signedInWith: user.provider,
    onboarded: true,
    onboardVersion: Math.max(memory.onboardVersion ?? 0, 4),
    profileDone: done || memory.profileDone,
    profileChecked: true,
    birthday: (typeof remote?.birthday === "string" && remote.birthday) || (stashed?.birthday as string) || memory.birthday,
    gender: (typeof remote?.gender === "string" && remote.gender) || (stashed?.gender as string) || memory.gender,
    styles: (Array.isArray(remote?.styles) ? (remote.styles as string[]) : null) || (stashed?.styles as string[]) || memory.styles,
    wantsUpdates: Boolean(remote?.wantsUpdates) || Boolean(stashed?.wantsUpdates) || memory.wantsUpdates,
    avatarUri: (stashed?.avatarUri as string) || memory.avatarUri,
  };
  listeners.forEach((l) => l());
  void AsyncStorage.setItem(KEY, JSON.stringify(memory));
  if (done) {
    void stashProfile();
    if (!remoteProfileFlag(remote)) {
      void import("./auth").then(({ writeUserProfile }) =>
        writeUserProfile(user.uid, {
          profileDone: true,
          seen: true,
          name: memory.displayName,
          birthday: memory.birthday,
          gender: memory.gender,
          styles: memory.styles,
          wantsUpdates: memory.wantsUpdates,
        }),
      );
    }
  }
}

function remoteProfileFlag(remote: Record<string, unknown> | null) {
  return remote?.profileDone === true;
}

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
      const liker = {
        uid,
        name: memory.displayName || "Uvel member",
        photo: memory.avatarUri || memory.personUri || undefined,
      };
      const { liked, piece } = toggleLiker(id, liker);
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
    },
    seedSavedLikes: () => {
      syncSavedLikes(memory.saved, {
        uid: memory.uid || "me",
        name: memory.displayName || "Uvel member",
        photo: memory.avatarUri || memory.personUri || undefined,
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
      await applyAccount(s, { restored: false });
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
        profileChecked: true,
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
        profileChecked: true,
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
