import { firebaseAuth, firebaseReady } from "./firebase";
import { requireSupabase } from "./supabase";

export async function promotionErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : String(error || "Promotion request failed.");
  const context = (error as { context?: { clone?: () => { text?: () => Promise<string> } } } | null)?.context;
  const response = context?.clone?.();
  if (!response?.text) return fallback;
  const raw = await response.text().catch(() => "");
  if (!raw) return fallback;
  try {
    const body = JSON.parse(raw) as { error?: unknown; message?: unknown; details?: unknown };
    const nested = body.error;
    const detail = typeof nested === "string"
      ? nested
      : nested && typeof nested === "object"
        ? (nested as { message?: unknown; details?: unknown }).message || (nested as { details?: unknown }).details
        : body.message || body.details;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
  } catch {
    // Keep the SDK error if the gateway did not return JSON.
  }
  return fallback;
}

export async function supabasePromotionCall<T>(action: string, payload: Record<string, unknown> = {}) {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Sign in before using promotions.");
  const token = await firebaseAuth().currentUser!.getIdToken();
  const { data, error } = await requireSupabase().functions.invoke("promotion-gateway", {
    body: { action, ...payload },
    headers: { "x-firebase-id-token": token },
  });
  if (error) throw new Error(await promotionErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}
