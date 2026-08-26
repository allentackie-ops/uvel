export type AnalyticsDisplayState = "loading" | "confirmed" | "unavailable" | "no_activity";

export function analyticsDisplayState<T extends { views?: number; likes?: number; follows?: number; sold?: number; earningsCents?: number }>(loading: boolean, data: T | null | undefined): AnalyticsDisplayState {
  if (loading) return "loading";
  if (!data) return "unavailable";
  const activity = [data.views, data.likes, data.follows, data.sold, data.earningsCents].some((value) => Number(value || 0) > 0);
  return activity ? "confirmed" : "no_activity";
}

export function analyticsValue(value: number | null | undefined, state: AnalyticsDisplayState, empty = "No activity yet") {
  if (state === "loading") return "Loading…";
  if (state === "unavailable") return "Unavailable";
  if (state === "no_activity" && !value) return empty;
  return String(value ?? 0);
}

export function analyticsCurrencyValue(valueCents: number | null | undefined, state: AnalyticsDisplayState, format: (cents: number) => string) {
  if (state === "loading") return "Loading…";
  if (state === "unavailable") return "Unavailable";
  if (state === "no_activity" && !valueCents) return "No confirmed revenue yet";
  return format(Math.max(0, Number(valueCents) || 0));
}

export function analyticsDisclosure(state: AnalyticsDisplayState) {
  if (state === "loading") return "Checking confirmed analytics…";
  if (state === "unavailable") return "Analytics are unavailable until the backend analytics service is connected.";
  if (state === "no_activity") return "No confirmed activity has been recorded yet.";
  return "Confirmed backend analytics. Revenue and purchases reflect recorded transactions, not predictions.";
}
