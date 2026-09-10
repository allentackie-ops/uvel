import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClosetPiece } from "./wardrobe";

export type PersonalizationAction = "view" | "save" | "share" | "search" | "double_view" | "double_tap_like" | "try_on";
export type PersonalizationConsent = "unset" | "allowed" | "declined";

type ListingSignal = {
  views: number;
  repeatViews: number;
  saves: number;
  shares: number;
  doubleTapLikes: number;
  lastViewedAt: number;
};

type PersonalizationProfile = {
  version: 1;
  events: number;
  listings: Record<string, ListingSignal>;
  terms: Record<string, number>;
  categories: Record<string, number>;
  colors: Record<string, number>;
  brands: Record<string, number>;
  materials: Record<string, number>;
  priceBands: Record<string, number>;
};

const EMPTY: PersonalizationProfile = {
  version: 1,
  events: 0,
  listings: {},
  terms: {},
  categories: {},
  colors: {},
  brands: {},
  materials: {},
  priceBands: {},
};
const PROFILE_PREFIX = "uvel-personalization-v1:";
const CONSENT_KEY = "uvel-personalization-consent-v1";
const MAX_TERM_LENGTH = 36;
const DAY = 24 * 60 * 60 * 1000;

function key(uid: string) {
  return `${PROFILE_PREFIX}${uid || "guest"}`;
}

function words(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && word.length <= MAX_TERM_LENGTH)
    .slice(0, 24);
}

function priceBand(cents: number) {
  if (cents < 5000) return "under-50";
  if (cents < 15000) return "50-150";
  if (cents < 30000) return "150-300";
  return "over-300";
}

function copyProfile(profile: PersonalizationProfile): PersonalizationProfile {
  return {
    ...profile,
    listings: Object.fromEntries(Object.entries(profile.listings).map(([id, value]) => [id, { ...value }])),
    terms: { ...profile.terms },
    categories: { ...profile.categories },
    colors: { ...profile.colors },
    brands: { ...profile.brands },
    materials: { ...profile.materials },
    priceBands: { ...profile.priceBands },
  };
}

function normalize(raw: unknown): PersonalizationProfile {
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const parsed = raw as Partial<PersonalizationProfile>;
  return {
    version: 1,
    events: Number(parsed.events) || 0,
    listings: parsed.listings || {},
    terms: parsed.terms || {},
    categories: parsed.categories || {},
    colors: parsed.colors || {},
    brands: parsed.brands || {},
    materials: parsed.materials || {},
    priceBands: parsed.priceBands || {},
  };
}

export function usePersonalization(uid: string) {
  const storageKey = useMemo(() => key(uid), [uid]);
  const [profile, setProfile] = useState<PersonalizationProfile>(EMPTY);
  const [consent, setConsent] = useState<PersonalizationConsent>("unset");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    setReady(false);
    void Promise.all([AsyncStorage.getItem(storageKey), AsyncStorage.getItem(CONSENT_KEY)]).then(([raw, rawConsent]) => {
      if (!active) return;
      try {
        setProfile(normalize(raw ? JSON.parse(raw) : null));
      } catch {
        setProfile({ ...EMPTY });
      }
      setConsent(rawConsent === "allowed" || rawConsent === "declined" ? rawConsent : "unset");
      setReady(true);
    }).catch(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [storageKey]);

  const setActivityConsent = useCallback(async (next: Exclude<PersonalizationConsent, "unset">) => {
    setConsent(next);
    await AsyncStorage.setItem(CONSENT_KEY, next);
  }, []);

  const record = useCallback((action: PersonalizationAction, piece?: ClosetPiece, query?: string) => {
    if (consent === "declined") return;
    setProfile((current) => {
      const next = copyProfile(current);
      next.events += 1;
      const delta = action === "view" ? 1 : action === "double_view" ? 3 : action === "save" ? 5 : action === "share" ? 6 : action === "double_tap_like" ? 7 : action === "try_on" ? 4 : 2;
      const add = (bucket: Record<string, number>, value?: string) => {
        if (!value) return;
        bucket[value.toLowerCase()] = (bucket[value.toLowerCase()] || 0) + delta;
      };
      if (query) words(query).forEach((word) => add(next.terms, word));
      if (!piece) {
        void AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => undefined);
        return next;
      }
      const existing = next.listings[piece.id] || { views: 0, repeatViews: 0, saves: 0, shares: 0, doubleTapLikes: 0, lastViewedAt: 0 };
      const now = Date.now();
      if (action === "view") {
        existing.views += 1;
        if (existing.lastViewedAt && now - existing.lastViewedAt < 30 * 60 * 1000) existing.repeatViews += 1;
        existing.lastViewedAt = now;
      }
      if (action === "double_view") existing.repeatViews += 1;
      if (action === "save") existing.saves += 1;
      if (action === "share") existing.shares += 1;
      if (action === "double_tap_like") existing.doubleTapLikes += 1;
      next.listings[piece.id] = existing;
      add(next.categories, piece.category);
      add(next.colors, piece.color);
      add(next.brands, piece.brand);
      add(next.materials, piece.material);
      add(next.priceBands, priceBand(piece.listPriceCents));
      words(`${piece.name} ${piece.notes} ${piece.category} ${piece.color} ${piece.brand} ${piece.material}`).forEach((word) => add(next.terms, word));
      void AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, [consent, storageKey]);

  const rank = useCallback((pieces: ClosetPiece[], country: string) => {
    const code = country.toLowerCase();
    return [...pieces].sort((a, b) => score(b, code, profile) - score(a, code, profile));
  }, [profile]);

  return { profile, consent, ready, record, rank, setActivityConsent };
}

function score(piece: ClosetPiece, country: string, profile: PersonalizationProfile) {
  const signal = profile.listings[piece.id];
  const text = words(`${piece.name} ${piece.notes} ${piece.category} ${piece.color} ${piece.brand} ${piece.material}`);
  const termScore = text.reduce((sum, word) => sum + Math.min(profile.terms[word] || 0, 30), 0);
  const affinity = (profile.categories[piece.category?.toLowerCase()] || 0) + (profile.colors[piece.color?.toLowerCase()] || 0) + (profile.brands[piece.brand?.toLowerCase()] || 0) + (profile.materials[piece.material?.toLowerCase()] || 0) + (profile.priceBands[priceBand(piece.listPriceCents)] || 0);
  const repeatInterest = signal ? signal.views * 2 + signal.repeatViews * 8 + signal.saves * 7 + signal.shares * 8 + signal.doubleTapLikes * 10 : 0;
  const local = piece.country?.toLowerCase() === country ? 3 : 0;
  const fresh = Math.max(0, 3 - Math.floor(Math.max(0, Date.now() - (piece.createdAt || 0)) / (14 * DAY)));
  return termScore + affinity + repeatInterest + local + fresh;
}

export async function clearPersonalization(uid: string) {
  await AsyncStorage.removeItem(key(uid));
}
