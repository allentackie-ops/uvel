import { httpsCallable } from "firebase/functions";
import { firebaseFunctions, firebaseReady } from "./firebase";

export type AnalyticsEventType =
  | "brand_view"
  | "listing_view"
  | "listing_like"
  | "listing_unlike"
  | "brand_follow"
  | "brand_unfollow";

export type AnalyticsEventInput = {
  type: AnalyticsEventType;
  brandId: string;
  listingId?: string;
  listingName?: string;
  listingPhoto?: string;
  eventId?: string;
};

export async function recordAnalyticsEvent(input: AnalyticsEventInput) {
  if (!firebaseReady() || !input.brandId) return;
  const call = httpsCallable(firebaseFunctions(), "recordAnalyticsEvent");
  await call({
    ...input,
    eventId: input.eventId || `${input.type}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  });
}

export type SharedFeedAction = "like" | "skip";

export type SharedFeedSignal = {
  like: number;
  skip: number;
};

export async function recordSharedFeedSignal(input: { lookId: string; action: SharedFeedAction; actorId: string }) {
  if (!firebaseReady() || !input.lookId || !input.actorId) return;
  const call = httpsCallable(firebaseFunctions(), "recordFeedFeedback");
  await call(input);
}

export async function readSharedFeedSignals(lookIds: string[]) {
  if (!firebaseReady() || !lookIds.length) return {} as Record<string, SharedFeedSignal>;
  const call = httpsCallable<{ lookIds: string[] }, { signals: Record<string, SharedFeedSignal> }>(firebaseFunctions(), "readFeedFeedback");
  const result = await call({ lookIds: [...new Set(lookIds)].slice(0, 100) });
  return result.data.signals || {};
}

export async function readBrandAnalytics(brandId: string, currency = "USD") {
  if (!firebaseReady()) return null;
  const call = httpsCallable<{ brandId: string; currency: string }, { data: unknown }>(firebaseFunctions(), "getBrandAnalytics");
  const result = await call({ brandId, currency });
  return result.data.data as {
    views: number;
    unique: number;
    likes: number;
    follows: number;
    listings: number;
    sold: number;
    earningsCents: number;
    currency: string;
    conversion: number;
    daily: { day: string; views: number; likes: number; sales: number; earnings: number }[];
    top: { id: string; name: string; photo: string; views: number; likes: number; sold: number }[];
  };
}
