import AsyncStorage from "@react-native-async-storage/async-storage";
import { addDoc, collection } from "firebase/firestore";
import { firebaseDb, firebaseReady } from "./firebase";

const KEY = "uvel-feedback-v1";
const SHAKE_KEY = "uvel-shake-to-report-enabled-v1";

export type FeedbackReport = {
  id: string;
  body: string;
  screenshotUri?: string;
  category: "technical";
  screen: string;
  createdAt: number;
  userId?: string;
  userName?: string;
  syncStatus: "pending" | "synced";
};

export type FeedbackEntry = "prompt" | "compose";
const openListeners = new Set<(entry: FeedbackEntry) => void>();

export function requestFeedback(entry: FeedbackEntry) {
  openListeners.forEach((listener) => listener(entry));
}

export function subscribeToFeedbackRequest(listener: (entry: FeedbackEntry) => void) {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

export async function loadShakeToReportEnabled() {
  try {
    const value = await AsyncStorage.getItem(SHAKE_KEY);
    return value === null ? true : value === "1";
  } catch {
    return true;
  }
}

export async function saveShakeToReportEnabled(enabled: boolean) {
  try {
    await AsyncStorage.setItem(SHAKE_KEY, enabled ? "1" : "0");
  } catch {
    // The in-memory setting remains active for the current session.
  }
}

async function persist(reports: FeedbackReport[]) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(reports.slice(0, 50)));
  } catch {
    // Local persistence is best effort; the report was still accepted in memory.
  }
}

export async function submitFeedback(input: Omit<FeedbackReport, "id" | "createdAt" | "syncStatus">) {
  const report: FeedbackReport = {
    ...input,
    id: `feedback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    syncStatus: "pending",
  };

  let synced = false;
  if (firebaseReady()) {
    try {
      await addDoc(collection(firebaseDb(), "feedback"), report);
      synced = true;
    } catch {
      // Keep the report locally if the network or Firebase is unavailable.
    }
  }

  const saved = { ...report, syncStatus: synced ? ("synced" as const) : ("pending" as const) };
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const existing = raw ? (JSON.parse(raw) as FeedbackReport[]) : [];
    await persist([saved, ...existing]);
  } catch {
    // The remote write, when available, is already complete.
  }
  return saved;
}
