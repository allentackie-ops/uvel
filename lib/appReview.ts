import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

const STORAGE_KEY = "uvel-native-review-v1";
const MIN_SESSIONS = 3;
const MIN_LISTING_VIEWS = 5;
const REQUEST_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

type ReviewState = {
  sessions: number;
  listingViews: number;
  lastRequestedAt: number;
};

const EMPTY_STATE: ReviewState = { sessions: 0, listingViews: 0, lastRequestedAt: 0 };
let cachedState: ReviewState | null = null;
let loadPromise: Promise<ReviewState> | null = null;
let requestInFlight: Promise<boolean> | null = null;

function normalize(value: unknown): ReviewState {
  if (!value || typeof value !== "object") return { ...EMPTY_STATE };
  const saved = value as Partial<ReviewState>;
  return {
    sessions: Math.max(0, Number(saved.sessions) || 0),
    listingViews: Math.max(0, Number(saved.listingViews) || 0),
    lastRequestedAt: Math.max(0, Number(saved.lastRequestedAt) || 0),
  };
}

async function loadState(): Promise<ReviewState> {
  if (cachedState) return cachedState;
  if (loadPromise) return loadPromise;
  loadPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      cachedState = normalize(raw ? JSON.parse(raw) : null);
      return cachedState;
    })
    .catch(() => {
      cachedState = { ...EMPTY_STATE };
      return cachedState;
    })
    .finally(() => {
      loadPromise = null;
    });
  return loadPromise;
}

async function saveState(state: ReviewState) {
  cachedState = state;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
}

export async function recordReviewSession() {
  const state = await loadState();
  await saveState({ ...state, sessions: state.sessions + 1 });
}

export async function recordReviewListingView() {
  const state = await loadState();
  await saveState({ ...state, listingViews: state.listingViews + 1 });
}

export async function requestNativeReviewIfEligible(): Promise<boolean> {
  if (requestInFlight) return requestInFlight;
  requestInFlight = (async () => {
    const state = await loadState();
    const cooldownActive = state.lastRequestedAt > 0 && Date.now() - state.lastRequestedAt < REQUEST_COOLDOWN_MS;
    if (state.sessions < MIN_SESSIONS || state.listingViews < MIN_LISTING_VIEWS || cooldownActive) return false;
    try {
      if (!(await StoreReview.isAvailableAsync())) return false;
      // Mark before requesting: the OS may suppress the sheet, and we still should not
      // repeatedly ask during the same eligibility window.
      await saveState({ ...state, lastRequestedAt: Date.now() });
      await StoreReview.requestReview();
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    requestInFlight = null;
  });
  return requestInFlight;
}
