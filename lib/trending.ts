import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ClosetPiece } from "./wardrobe";
import { requireSupabase } from "./supabase";

export type TrendInteraction = "qualified_view" | "share" | "copy_link";
export type TrendScore = {
  listingId: string;
  score: number;
  qualifiedViews: number;
  shares: number;
  copiedLinks: number;
};
export type TrendingBrandItem = { piece: ClosetPiece; score: number; qualifiedViews: number; shares: number; copiedLinks: number };
export type TrendingScores = {
  marketScores: TrendScore[];
  globalScores: TrendScore[];
  brandItems: TrendingBrandItem[];
  windowDays: number;
  minDwellSeconds: number;
};

const ACTOR_STORAGE_KEY = "uvel-trending-anonymous-actor-v1";
export const TREND_WINDOW_DAYS = 7;
export const TREND_MIN_DWELL_SECONDS = 10;

let actorIdPromise: Promise<string> | null = null;

function createAnonymousActorId() {
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

async function anonymousActorId() {
  if (!actorIdPromise) {
    actorIdPromise = (async () => {
      const saved = await AsyncStorage.getItem(ACTOR_STORAGE_KEY);
      if (saved) return saved;
      const created = createAnonymousActorId();
      await AsyncStorage.setItem(ACTOR_STORAGE_KEY, created);
      return created;
    })().catch((error) => {
      actorIdPromise = null;
      throw error;
    });
  }
  return actorIdPromise;
}

export async function recordListingTrendSignal(input: {
  listingId: string;
  marketCode: string;
  interaction: TrendInteraction;
  dwellSeconds?: number;
}) {
  if (!input.listingId || !/^[A-Z]{2}$/i.test(input.marketCode)) return;
  try {
    const actorId = await anonymousActorId();
    const { error } = await requireSupabase().functions.invoke("today-marketplace-feed", {
      body: {
        action: "record-trend",
        listingId: input.listingId,
        market: input.marketCode.toUpperCase(),
        interaction: input.interaction,
        actorId,
        ...(input.interaction === "qualified_view" ? { dwellSeconds: input.dwellSeconds } : {}),
      },
    });
    if (error) console.warn("Could not record Uvel trend signal.");
  } catch {
    // Trend tracking is best-effort; it must never interrupt shopping.
  }
}

export async function fetchTrendingScores(marketCode: string): Promise<TrendingScores> {
  const market = marketCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(market)) throw new Error("Choose a valid store before loading trends.");
  const { data, error } = await requireSupabase().functions.invoke("today-marketplace-feed", {
    body: { action: "trending", market },
  });
  if (error) throw error;
  if (!data || !Array.isArray(data.marketScores) || !Array.isArray(data.globalScores) || !Array.isArray(data.brandItems)) {
    throw new Error("Supabase returned an invalid Trending response.");
  }
  return {
    marketScores: data.marketScores as TrendScore[],
    globalScores: data.globalScores as TrendScore[],
    brandItems: data.brandItems as TrendingBrandItem[],
    windowDays: Number(data.windowDays) || TREND_WINDOW_DAYS,
    minDwellSeconds: Number(data.minDwellSeconds) || TREND_MIN_DWELL_SECONDS,
  };
}
