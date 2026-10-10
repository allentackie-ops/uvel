import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { deleteField, doc, getDoc, runTransaction, updateDoc } from "firebase/firestore";
import { dnaIsSet, scorePieceAgainstDna, type Dna } from "./styleDna";
import { genderBoost } from "./lookMatch";
import type { ClosetPiece } from "./wardrobe";
import { firebaseAuth, firebaseDb, firebaseReady } from "./firebase";
import { filterNotInterestedListings, scoreShopFeedback, type ShopFeedbackSignal } from "./shopFeedbackMath";
import { readRecommendationSignals, recordRecommendationEvent, type RecommendationSignal } from "./recommendationSignals";

export type RecommendationChoice = "interested" | "not_interested";
export type PersonalizationAction = "view" | "save" | "share" | "search" | "double_view" | "double_tap_like" | "try_on" | "dwell" | RecommendationChoice;
export type PersonalizationConsent = "unset" | "allowed" | "declined";

type RecommendationFeedback = ShopFeedbackSignal;

type ListingSignal = {
  views: number;
  repeatViews: number;
  saves: number;
  shares: number;
  doubleTapLikes: number;
  dwellSeconds: number;
  engagedViews: number;
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
  recommendationFeedback: Record<string, RecommendationFeedback>;
  recommendationPromptedAt: Record<string, number>;
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
  recommendationFeedback: {},
  recommendationPromptedAt: {},
};
const PROFILE_PREFIX = "uvel-personalization-v1:";
const MAX_TERM_LENGTH = 36;
const MAX_FEEDBACK_LISTINGS = 250;
const PROMPT_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const REMOTE_FEEDBACK_FIELD = "shopFeedFeedbackV1";

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

function normalizeValue(value: unknown, maxLength = 80) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, maxLength) : "";
}

function normalizeRecommendationFeedback(raw: unknown): Record<string, RecommendationFeedback> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, RecommendationFeedback> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || id.length > 160 || !value || typeof value !== "object") continue;
    const item = value as Partial<RecommendationFeedback>;
    if (item.choice !== "interested" && item.choice !== "not_interested") continue;
    const createdAt = Number(item.createdAt);
    if (!Number.isFinite(createdAt) || createdAt <= 0) continue;
    result[id] = {
      listingId: id,
      choice: item.choice,
      createdAt,
      category: normalizeValue(item.category),
      color: normalizeValue(item.color),
      brand: normalizeValue(item.brand),
      material: normalizeValue(item.material),
      priceBand: normalizeValue(item.priceBand),
      terms: Array.isArray(item.terms)
        ? [...new Set(item.terms.map((term) => normalizeValue(term, MAX_TERM_LENGTH)).filter(Boolean))].slice(0, 8)
        : [],
    };
  }
  return trimFeedback(result);
}

function trimFeedback(feedback: Record<string, RecommendationFeedback>) {
  return Object.fromEntries(
    Object.entries(feedback)
      .sort((a, b) => b[1].createdAt - a[1].createdAt)
      .slice(0, MAX_FEEDBACK_LISTINGS),
  );
}

function mergeFeedback(
  first: Record<string, RecommendationFeedback>,
  second: Record<string, RecommendationFeedback>,
) {
  const merged = { ...first };
  for (const [id, candidate] of Object.entries(second)) {
    if (!merged[id] || candidate.createdAt > merged[id].createdAt) merged[id] = candidate;
  }
  return trimFeedback(merged);
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
    recommendationFeedback: { ...profile.recommendationFeedback },
    recommendationPromptedAt: { ...profile.recommendationPromptedAt },
  };
}

function normalize(raw: unknown): PersonalizationProfile {
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const parsed = raw as Partial<PersonalizationProfile>;
  return {
    version: 1,
    events: Number(parsed.events) || 0,
    listings: Object.fromEntries(Object.entries(parsed.listings || {}).map(([id, value]) => [id, {
      views: Number(value?.views) || 0,
      repeatViews: Number(value?.repeatViews) || 0,
      saves: Number(value?.saves) || 0,
      shares: Number(value?.shares) || 0,
      doubleTapLikes: Number(value?.doubleTapLikes) || 0,
      dwellSeconds: Number(value?.dwellSeconds) || 0,
      engagedViews: Number(value?.engagedViews) || 0,
      lastViewedAt: Number(value?.lastViewedAt) || 0,
    }])),
    terms: parsed.terms || {},
    categories: parsed.categories || {},
    colors: parsed.colors || {},
    brands: parsed.brands || {},
    materials: parsed.materials || {},
    priceBands: parsed.priceBands || {},
    recommendationFeedback: normalizeRecommendationFeedback(parsed.recommendationFeedback),
    recommendationPromptedAt: Object.fromEntries(
      Object.entries(parsed.recommendationPromptedAt || {})
        .filter(([id, at]) => id.length <= 160 && Number.isFinite(Number(at)) && Number(at) > 0)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, MAX_FEEDBACK_LISTINGS)
        .map(([id, at]) => [id, Number(at)]),
    ),
  };
}

function feedbackFromUserDocument(raw: unknown) {
  if (!raw || typeof raw !== "object") return {};
  const value = raw as Record<string, unknown>;
  return normalizeRecommendationFeedback(value.recommendations);
}

function feedbackFeatures(piece: ClosetPiece, now: number): RecommendationFeedback {
  return {
    listingId: piece.id,
    choice: "interested",
    createdAt: now,
    category: normalizeValue(piece.category),
    color: normalizeValue(piece.color),
    brand: normalizeValue(piece.brandId || piece.brand),
    material: normalizeValue(piece.material),
    priceBand: priceBand(piece.listPriceCents),
    terms: [...new Set(words(`${piece.name} ${piece.notes} ${piece.category} ${piece.color} ${piece.brand} ${piece.material}`))].slice(0, 8),
  };
}

export function usePersonalization(uid: string) {
  const storageKey = useMemo(() => key(uid), [uid]);
  const [profile, setProfile] = useState<PersonalizationProfile>(EMPTY);
  const [sharedSignals, setSharedSignals] = useState<Record<string, RecommendationSignal>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribeAuth: (() => void) | undefined;
    setReady(false);
    setProfile({ ...EMPTY });
    void AsyncStorage.getItem(storageKey).then((raw) => {
      if (!active) return;
      let local = EMPTY;
      try {
        local = normalize(raw ? JSON.parse(raw) : null);
      } catch {
        local = { ...EMPTY };
      }
      setProfile(local);
      setReady(true);

      if (!uid || uid === "guest" || !firebaseReady()) return;
      const loadRemote = () => {
        void getDoc(doc(firebaseDb(), "users", uid)).then((snapshot) => {
          if (!active || !snapshot.exists()) return;
          const remote = feedbackFromUserDocument(snapshot.data()?.[REMOTE_FEEDBACK_FIELD]);
          if (!Object.keys(remote).length) return;
          setProfile((current) => {
            const merged = {
              ...current,
              recommendationFeedback: mergeFeedback(current.recommendationFeedback, remote),
            };
            void AsyncStorage.setItem(storageKey, JSON.stringify(merged)).catch(() => undefined);
            return merged;
          });
        }).catch(() => undefined);
      };
      const auth = firebaseAuth();
      if (auth.currentUser?.uid === uid) loadRemote();
      else unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (user?.uid !== uid) return;
        unsubscribeAuth?.();
        unsubscribeAuth = undefined;
        loadRemote();
      });
    }).catch(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
      unsubscribeAuth?.();
    };
  }, [storageKey, uid]);

  const record = useCallback((action: PersonalizationAction, piece?: ClosetPiece, query?: string, dwellSeconds = 0) => {
    setProfile((current) => {
      const next = copyProfile(current);
      next.events += 1;
      const isRecommendationAction = action === "interested" || action === "not_interested";
      const dwellDelta = action === "dwell" ? Math.min(12, Math.max(1, Math.floor(dwellSeconds / 10))) : 0;
      const delta = action === "view" ? 1
        : action === "double_view" ? 3
          : action === "save" ? 5
            : action === "share" ? 6
              : action === "double_tap_like" ? 7
                : action === "try_on" ? 4
                  : action === "interested" ? 7
                    : action === "not_interested" ? -8
                      : action === "dwell" ? dwellDelta : 2;
      const add = (bucket: Record<string, number>, value?: string) => {
        if (!value) return;
        const normalized = value.toLowerCase();
        bucket[normalized] = (bucket[normalized] || 0) + delta;
      };
      if (query) words(query).forEach((word) => add(next.terms, word));
      if (!piece) {
        void AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => undefined);
        return next;
      }
      const existing = next.listings[piece.id] || { views: 0, repeatViews: 0, saves: 0, shares: 0, doubleTapLikes: 0, dwellSeconds: 0, engagedViews: 0, lastViewedAt: 0 };
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
      if (action === "dwell") {
        existing.dwellSeconds += Math.max(0, Math.round(dwellSeconds));
        existing.engagedViews += 1;
      }
      next.listings[piece.id] = existing;

      if (isRecommendationAction) {
        const recommendation = feedbackFeatures(piece, now);
        recommendation.choice = action;
        next.recommendationFeedback[piece.id] = recommendation;
        next.recommendationFeedback = trimFeedback(next.recommendationFeedback);
      } else {
        add(next.categories, piece.category);
        add(next.colors, piece.color);
        add(next.brands, piece.brand);
        add(next.materials, piece.material);
        add(next.priceBands, priceBand(piece.listPriceCents));
        words(`${piece.name} ${piece.notes} ${piece.category} ${piece.color} ${piece.brand} ${piece.material}`).forEach((word) => add(next.terms, word));
      }

      void AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => undefined);
      if (isRecommendationAction && uid && uid !== "guest" && firebaseReady() && firebaseAuth().currentUser?.uid === uid) {
        void (async () => {
          const reference = doc(firebaseDb(), "users", uid);
          let merged = next.recommendationFeedback;
          try {
            merged = await runTransaction(firebaseDb(), async (transaction) => {
              const snapshot = await transaction.get(reference);
              const remote = snapshot.exists() ? feedbackFromUserDocument(snapshot.data()?.[REMOTE_FEEDBACK_FIELD]) : {};
              const combined = mergeFeedback(next.recommendationFeedback, remote);
              transaction.set(reference, {
                [REMOTE_FEEDBACK_FIELD]: { version: 1, recommendations: combined },
              }, { mergeFields: [REMOTE_FEEDBACK_FIELD] });
              return combined;
            });
          } catch {
            // Device-local recommendations continue to work if the cloud is unavailable.
          }
          setProfile((current) => {
            const recommendationFeedback = mergeFeedback(current.recommendationFeedback, merged);
            const latest = { ...current, recommendationFeedback };
            void AsyncStorage.setItem(storageKey, JSON.stringify(latest)).catch(() => undefined);
            return latest;
          });
        })();
      }
      return next;
    });
    const sharedActions = ["view", "dwell", "save", "share", "try_on", "interested", "not_interested"] as const;
    if (piece && uid && uid !== "guest" && (sharedActions as readonly string[]).includes(action)) {
      void recordRecommendationEvent({ listingId: piece.id, action: action as (typeof sharedActions)[number], seconds: dwellSeconds, surface: "today_for_you" }).catch(() => undefined);
    }
  }, [storageKey, uid]);

  const refreshSharedSignals = useCallback(async (listingIds: string[]) => {
    if (!uid || uid === "guest" || !listingIds.length) return;
    try {
      const next = await readRecommendationSignals(listingIds);
      setSharedSignals((current) => ({ ...current, ...next }));
    } catch {
      // Local personalization remains the fallback when the backend is unavailable.
    }
  }, [uid]);

  const rank = useCallback((pieces: ClosetPiece[], country: string, dna?: Dna) => {
    const candidates = filterNotInterestedListings(pieces, profile.recommendationFeedback);
    const scored = candidates
      .map((piece) => ({ piece, score: score(piece, country.toLowerCase(), profile, dna, sharedSignals[piece.id]) }))
      .sort((a, b) => b.score - a.score || b.piece.createdAt - a.piece.createdAt);
    return diversifyRanked(scored, profile);
  }, [profile, sharedSignals]);

  const hasRecommendationFeedback = useCallback((listingId: string) => Boolean(profile.recommendationFeedback[listingId]), [profile]);
  const hasPromptedRecently = useCallback((listingId: string) => {
    const promptedAt = profile.recommendationPromptedAt[listingId] || 0;
    return promptedAt > 0 && Date.now() - promptedAt < PROMPT_COOLDOWN_MS;
  }, [profile]);
  const markRecommendationPromptShown = useCallback((listingId: string) => {
    if (!listingId) return;
    setProfile((current) => {
      const prompted = { ...current.recommendationPromptedAt, [listingId]: Date.now() };
      const recommendationPromptedAt = Object.fromEntries(
        Object.entries(prompted).sort((a, b) => b[1] - a[1]).slice(0, MAX_FEEDBACK_LISTINGS),
      );
      const next = { ...current, recommendationPromptedAt };
      void AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, [storageKey]);

  return { profile, consent: "allowed" as const, ready, record, rank, refreshSharedSignals, hasRecommendationFeedback, hasPromptedRecently, markRecommendationPromptShown };
}

function dnaBoost(piece: ClosetPiece, dna: Dna | undefined, events: number) {
  if (!dna || !dnaIsSet(dna)) return 0;
  const raw = scorePieceAgainstDna(piece, dna);
  if (!raw) return 0;
  // Style DNA is a gentle preference signal, not the primary ranking engine.
  // Behaviour, saves, purchases, feedback, freshness, and peer quality remain
  // stronger signals in the final Today order.
  const weight = events < 6 ? 0.72 : events < 20 ? 0.6 : 0.48;
  return Math.min(18, raw * weight);
}

function score(piece: ClosetPiece, country: string, profile: PersonalizationProfile, dna?: Dna, shared?: RecommendationSignal) {
  const signal = profile.listings[piece.id];
  const text = words(`${piece.name} ${piece.notes} ${piece.category} ${piece.color} ${piece.brand} ${piece.material}`);
  const termScore = text.reduce((sum, word) => sum + Math.min(profile.terms[word] || 0, 30), 0);
  const affinity = (profile.categories[piece.category?.toLowerCase()] || 0) + (profile.colors[piece.color?.toLowerCase()] || 0) + (profile.brands[piece.brand?.toLowerCase()] || 0) + (profile.materials[piece.material?.toLowerCase()] || 0) + (profile.priceBands[priceBand(piece.listPriceCents)] || 0);
  const repeatInterest = signal ? signal.views * 2 + signal.repeatViews * 8 + signal.saves * 7 + signal.shares * 8 + signal.doubleTapLikes * 10 + Math.min(36, signal.dwellSeconds / 10) + signal.engagedViews * 4 : 0;
  const local = piece.country?.toLowerCase() === country ? 3 : 0;
  const age = Math.max(0, Date.now() - (piece.createdAt || 0));
  const fresh = age < 2 * DAY ? 18 : age < 14 * DAY ? 10 : age < 30 * DAY ? 4 : 0;
  const peer = shared ? Math.min(12, Math.max(0, shared.peerQualityScore)) : 0;
  return termScore + affinity + repeatInterest + local + fresh + peer + dnaBoost(piece, dna, profile.events) + genderBoost(piece, dna?.gender) + scoreShopFeedback(piece, profile.recommendationFeedback);
}

function diversifyRanked(rows: { piece: ClosetPiece; score: number }[], profile: PersonalizationProfile) {
  const remaining = rows.slice();
  const selected: ClosetPiece[] = [];
  const categoryCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();
  const colorCounts = new Map<string, number>();
  const cap = (value?: string) => (value || "unknown").trim().toLowerCase();

  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    remaining.forEach((row, index) => {
      const category = cap(row.piece.category);
      const brand = cap(row.piece.brandId || row.piece.brand);
      const color = cap(row.piece.color);
      const repeated = (categoryCounts.get(category) || 0) + (brandCounts.get(brand) || 0) + (colorCounts.get(color) || 0);
      const seen = profile.listings[row.piece.id]?.views || 0;
      const novelty = seen === 0 ? Math.min(5, selected.length * 0.45) : 0;
      const adjusted = row.score - Math.min(8, repeated * 1.25) + novelty;
      if (adjusted > bestScore) {
        bestScore = adjusted;
        bestIndex = index;
      }
    });
    const [winner] = remaining.splice(bestIndex, 1);
    selected.push(winner.piece);
    const category = cap(winner.piece.category);
    const brand = cap(winner.piece.brandId || winner.piece.brand);
    const color = cap(winner.piece.color);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
    colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
  }
  return selected;
}

export async function clearPersonalization(uid: string) {
  await AsyncStorage.removeItem(key(uid));
  if (uid && uid !== "guest" && firebaseReady() && firebaseAuth().currentUser?.uid === uid) {
    await updateDoc(doc(firebaseDb(), "users", uid), { [REMOTE_FEEDBACK_FIELD]: deleteField() }).catch(() => undefined);
  }
}
