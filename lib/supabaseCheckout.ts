import { firebaseAuth, firebaseReady } from "./firebase";
import { requireSupabase } from "./supabase";
import { supabasePromotionCall } from "./supabasePromotion";
import type { Address, Order } from "./orders";
import type { CheckoutPay, CheckoutSession, GroupedCheckout, GroupedStripePaymentIntent, PromotionQuote, StripePaymentIntent } from "./pay";

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

async function checkoutCall<T>(action: string, payload: Record<string, unknown> = {}) {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Sign in before checking out.");
  const token = await firebaseAuth().currentUser!.getIdToken();
  const { data, error } = await requireSupabase().functions.invoke("firebase-checkout-gateway", {
    body: { action, ...payload },
    headers: { "x-firebase-id-token": token },
  });
  if (error) throw new Error(await invokeErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

async function groupedCheckoutCall<T>(action: string, payload: Record<string, unknown> = {}) {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Sign in before checking out.");
  const token = await firebaseAuth().currentUser!.getIdToken();
  const { data, error } = await requireSupabase().functions.invoke("supabase-checkout-gateway", {
    body: { action, ...payload },
    headers: { "x-firebase-id-token": token },
  });
  if (error) throw new Error(await invokeErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

/** Supabase is the source of truth for grouped checkout records. */
export async function mirrorCheckoutOrder(order: Order) {
  return checkoutCall<{ order: { id: string; firebase_order_id: string; status: string } }>("mirror_order", { order });
}

export async function supabaseStripePaymentIntent(orderId: string, amountCents?: number, currency?: string) {
  return checkoutCall<StripePaymentIntent>("stripe_intent", { orderId, amountCents, currency });
}

export async function supabaseHostedCheckout(input: CheckoutPay) {
  return checkoutCall<CheckoutSession>("hosted_checkout", { input });
}

export async function supabaseGroupedCheckout(input: { checkoutBatchId: string; listingIds: string[]; address: Address; shippingChoices: Array<{ listingId: string; carrierId: string; creditCents: number; promotionId?: string; promotionCode?: string }> }) {
  return groupedCheckoutCall<GroupedCheckout>("grouped_create", { input });
}

export async function supabaseGroupedStripeIntent(checkoutBatchId: string) {
  return groupedCheckoutCall<GroupedStripePaymentIntent>("grouped_intent", { checkoutBatchId });
}

export async function supabaseValidatePromotion(input: { brandId?: string; listingId: string; promotionId?: string; code?: string; currency: string; itemCents: number }) {
  return supabasePromotionCall<PromotionQuote>("validate", { input });
}
