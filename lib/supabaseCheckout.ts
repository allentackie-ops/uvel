import { firebaseAuth, firebaseReady } from "./firebase";
import { requireSupabase } from "./supabase";
import type { Order } from "./orders";

async function invokeErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : String(error || "Checkout request failed.");
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
    // Keep the SDK error if the gateway didn't return JSON.
  }
  return fallback;
}

async function checkoutCall<T>(payload: Record<string, unknown> = {}) {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Sign in before checking out.");
  const token = await firebaseAuth().currentUser!.getIdToken();
  const { data, error } = await requireSupabase().functions.invoke("firebase-checkout-gateway", {
    body: { action: "mirror_order", ...payload },
    headers: { "x-firebase-id-token": token },
  });
  if (error) throw new Error(await invokeErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

/** Supabase receives an optional checkout mirror; Firebase remains the order source of truth. */
export async function mirrorCheckoutOrder(order: Order) {
  return checkoutCall<{ order: { id: string; firebase_order_id: string; status: string } }>({ order });
}
