import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Look, Source } from "./trends";

export type FeedInteraction = "shop" | "source" | "save" | "like" | "skip";

type FeedProfile = {
  source: Partial<Record<Exclude<Source, "All">, number>>;
  country: Record<string, number>;
  topics: Record<string, number>;
  events: number;
};

const PROFILE_PREFIX = "uvel-feed-profile-v1:";
const EMPTY_PROFILE: FeedProfile = { source: {}, country: {}, topics: {}, events: 0 };
const ACTION_WEIGHT: Record<FeedInteraction, number> = { shop: 5, source: 4, save: 4, like: 5, skip: -6 };

function profileKey(uid: string) {
  return `${PROFILE_PREFIX}${uid || "guest"}`;
}

function copyProfile(profile: FeedProfile): FeedProfile {
  return {
    source: { ...profile.source },
    country: { ...profile.country },
    topics: { ...profile.topics },
    events: profile.events,
  };
}

function words(look: Look) {
  return [look.title, look.summary, look.shopQuery, look.handle]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 24);
}

function score(look: Look, country: string, profile: FeedProfile) {
  const sourceInterest = profile.source[look.source] || 0;
  const countryInterest = look.country ? profile.country[look.country] || 0 : 0;
  const topicInterest = words(look).reduce((sum, word) => sum + (profile.topics[word] || 0), 0);
  const countryCode = country.toUpperCase();
  const localBoost = look.country === countryCode ? 22 : 0;
  const usBoost = look.country === "US" && countryCode !== "US" ? 6 : 0;
  const globalPenalty = look.country && look.country !== countryCode && look.country !== "US" ? -2 : 0;
  return sourceInterest * 1.4 + countryInterest * 1.2 + Math.min(18, topicInterest) + localBoost + usBoost + globalPenalty;
}

function orderGroup(group: Look[], country: string, profile: FeedProfile) {
  return [...group].sort((a, b) => score(b, country, profile) - score(a, country, profile));
}

export function rankForUser(looks: Look[], country: string, profile: FeedProfile): Look[] {
  if (!looks.length) return [];
  const code = country.toUpperCase();
  const ranked = looks.map((look) => ({ look, value: score(look, code, profile) })).sort((a, b) => b.value - a.value).map(({ look }) => look);
  if (code === "US") return ranked;

  const local = orderGroup(looks.filter((look) => look.country === code), code, profile);
  const us = orderGroup(looks.filter((look) => look.country === "US"), code, profile);
  const global = orderGroup(looks.filter((look) => look.country !== code && look.country !== "US"), code, profile);
  const unknown = orderGroup(looks.filter((look) => !look.country), code, profile);
  const used = new Set<string>();
  const out: Look[] = [];
  const take = (row?: Look) => {
    if (!row || used.has(row.id)) return false;
    used.add(row.id);
    out.push(row);
    return true;
  };
  const localQuota = Math.min(local.length, Math.max(1, Math.ceil(looks.length * 0.6)));
  let localPlaced = 0;
  let usIndex = 0;
  let localIndex = 0;
  let globalIndex = 0;
  let unknownIndex = 0;
  for (let slot = 0; out.length < looks.length; slot += 1) {
    if (us.length && (slot === 4 || (slot > 4 && (slot - 4) % 5 === 0))) {
      if (take(us[usIndex++])) continue;
    }
    if (localPlaced < localQuota && take(local[localIndex++])) {
      localPlaced += 1;
      continue;
    }
    if (take(global[globalIndex++])) continue;
    if (take(unknown[unknownIndex++])) continue;
    if (take(local[localIndex++])) continue;
    if (take(us[usIndex++])) continue;
    if (take(ranked.find((look) => !used.has(look.id)))) continue;
    break;
  }
  return out;
}

export function useFeedPersonalization(uid: string, country: string) {
  const key = useMemo(() => profileKey(uid), [uid]);
  const [profile, setProfile] = useState<FeedProfile>(EMPTY_PROFILE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    setReady(false);
    void AsyncStorage.getItem(key)
      .then((raw) => {
        if (!active) return;
        try {
          const parsed = raw ? JSON.parse(raw) as Partial<FeedProfile> : {};
          setProfile({
            source: parsed.source || {},
            country: parsed.country || {},
            topics: parsed.topics || {},
            events: Number(parsed.events) || 0,
          });
        } catch {
          setProfile(EMPTY_PROFILE);
        }
        setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [key]);

  const track = useCallback((look: Look, action: FeedInteraction) => {
    setProfile((current) => {
      const next = copyProfile(current);
      const delta = ACTION_WEIGHT[action];
      next.events += 1;
      next.source[look.source] = (next.source[look.source] || 0) + delta;
      if (look.country) next.country[look.country] = (next.country[look.country] || 0) + delta;
      for (const word of words(look).slice(0, 10)) next.topics[word] = (next.topics[word] || 0) + delta;
      void AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, [key]);

  const rank = useCallback((looks: Look[]) => rankForUser(looks, country, profile), [country, profile]);
  return { profile, ready, rank, track };
}
