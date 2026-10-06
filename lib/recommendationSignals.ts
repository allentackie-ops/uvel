import { httpsCallable } from "firebase/functions";
import { firebaseFunctions, firebaseReady } from "./firebase";

export type RecommendationAction = "view" | "dwell" | "save" | "share" | "try_on" | "interested" | "not_interested";

export type RecommendationSignal = {
  qualifiedUserCount: number;
  peerQualityScore: number;
  peerConsensus: boolean;
  lastQualifiedAt: number;
};

export async function readRecommendationSignals(listingIds: string[]) {
  if (!firebaseReady() || !listingIds.length) return {} as Record<string, RecommendationSignal>;
  const call = httpsCallable<{ listingIds: string[] }, { signals: Record<string, RecommendationSignal> }>(firebaseFunctions(), "readRecommendationSignals");
  const result = await call({ listingIds: [...new Set(listingIds)].slice(0, 100) });
  return result.data.signals || {};
}

export async function recordRecommendationEvent(input: {
  listingId: string;
  action: RecommendationAction;
  seconds?: number;
  surface?: "today_for_you" | "search" | "category" | "immersive";
}) {
  if (!firebaseReady() || !input.listingId) return;
  const call = httpsCallable(firebaseFunctions(), "recordRecommendationEvent");
  await call({
    listingId: input.listingId,
    action: input.action,
    seconds: Math.min(120, Math.max(0, Math.floor(input.seconds || 0))),
    surface: input.surface || "today_for_you",
  });
}
