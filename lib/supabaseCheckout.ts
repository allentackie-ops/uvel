import { firebaseAuth, firebaseReady } from "./firebase";
import { requireSupabase } from "./supabase";
import type { Address, Order } from "./orders";
import type { CheckoutPay, CheckoutSession, GroupedCheckout, GroupedStripePaymentIntent, PromotionQuote, StripePaymentIntent } from "./pay";

async function checkoutCall<T>(action: string, payload: Record<string, unknown> = {}) {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Sign in before checking out.");
  const token = await firebaseAuth().currentUser!.getIdToken();
  const { data, error } = await requireSupabase().functions.invoke("firebase-checkout-gateway", {
    body: { action, ...payload },
    headers: { "x-firebase-id-token": token },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

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
  return checkoutCall<GroupedCheckout>("grouped_create", { input });
}

export async function supabaseGroupedStripeIntent(checkoutBatchId: string) {
  return checkoutCall<GroupedStripePaymentIntent>("grouped_intent", { checkoutBatchId });
}

export async function supabaseValidatePromotion(input: { brandId?: string; listingId: string; promotionId?: string; code?: string; currency: string; itemCents: number }) {
  return checkoutCall<PromotionQuote>("promotion", { input });
}
