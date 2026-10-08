import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { NativeModules } from "react-native";
import { AddressCollectionMode, CollectionMode } from "@stripe/stripe-react-native";
import type { Address as CheckoutAddress } from "./orders";
import {
  supabaseGroupedCheckout,
  supabaseGroupedStripeIntent,
  supabaseHostedCheckout,
  supabaseStripePaymentIntent,
  supabaseValidatePromotion,
} from "./supabaseCheckout";

type Extra = {
  payments?: {
    stripePk?: string;
    paystackPk?: string;
    merchantId?: string;
  };
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
export const paymentsExtra = extra.payments ?? {};
export const MERCHANT_ID = paymentsExtra.merchantId || "merchant.com.uvel.dressandshop";

export function stripeNativeReady() {
  return Boolean((NativeModules as { StripeSdk?: unknown }).StripeSdk);
}

export type PromotionQuote = {
  promotionId: string;
  code: string;
  kind: "percentage" | "fixed";
  value: number;
  currency: string;
  discountCents: number;
  minimumOrderCents: number;
  source?: "brand" | "listing";
};

export type CheckoutPay = {
  amountCents: number;
  currency: string;
  email: string;
  method: string;
  country: string;
  reference: string;
  name: string;
  orderId: string;
  listingId: string;
  brandId: string;
  variantKey?: string;
  campaignId?: string;
  collectionId?: string;
  promotionId?: string;
  promotionCode?: string;
};

export type CheckoutSession = {
  processor: "stripe" | "paystack";
  clientSecret?: string;
  url?: string;
  reference: string;
};

export type StripePaymentIntent = {
  clientSecret: string;
  paymentIntentId: string;
  customerId?: string;
  customerSessionClientSecret?: string;
};

export type GroupedCheckout = {
  checkoutBatchId: string;
  orderIds: Array<{ id: string; pieceId: string }>;
  amountCents: number;
};

export type GroupedStripePaymentIntent = {
  clientSecret: string;
  paymentIntentId: string;
  checkoutBatchId: string;
  customerId?: string;
  customerSessionClientSecret?: string;
  alreadyPaid?: boolean;
};

export function stripePaymentSheetAddress(address: CheckoutAddress, email?: string) {
  const clean = (value?: string) => String(value || "").trim() || undefined;
  const stripeAddress = {
    line1: clean(address.line1),
    line2: clean(address.line2),
    city: clean(address.city),
    state: clean(address.region),
    postalCode: clean(address.postal),
    country: clean(address.country)?.toUpperCase(),
  };
  return {
    defaultBillingDetails: {
      email: clean(email),
      name: clean(address.name),
      phone: clean(address.phone),
      address: stripeAddress,
    },
    defaultShippingDetails: {
      name: clean(address.name),
      phone: clean(address.phone),
      address: stripeAddress,
    },
    billingDetailsCollectionConfiguration: {
      name: CollectionMode.NEVER,
      email: CollectionMode.NEVER,
      phone: CollectionMode.NEVER,
      address: AddressCollectionMode.NEVER,
      attachDefaultsToPaymentMethod: true,
    },
  };
}

export async function createCheckoutSession(input: CheckoutPay): Promise<CheckoutSession> {
  return supabaseHostedCheckout(input);
}

export async function createStripePaymentIntent(orderId: string, amountCents?: number, currency?: string): Promise<StripePaymentIntent> {
  return supabaseStripePaymentIntent(orderId, amountCents, currency);
}

export async function createGroupedCheckout(input: { checkoutBatchId: string; listingIds: string[]; address: unknown; shippingChoices: Array<{ listingId: string; carrierId: string; creditCents: number; promotionId?: string; promotionCode?: string }> }): Promise<GroupedCheckout> {
  return supabaseGroupedCheckout(input as Parameters<typeof supabaseGroupedCheckout>[0]);
}

export async function createGroupedStripePaymentIntent(checkoutBatchId: string): Promise<GroupedStripePaymentIntent> {
  return supabaseGroupedStripeIntent(checkoutBatchId);
}

export async function validatePromotion(input: { brandId?: string; listingId: string; promotionId?: string; code?: string; currency: string; itemCents: number }): Promise<PromotionQuote> {
  return supabaseValidatePromotion(input);
}

export async function openHostedPay(url: string) {
  const result = await WebBrowser.openAuthSessionAsync(url, "uvel://pay");
  return result.type === "success";
}

export function processorFor(country: string, method: string): "paystack" | "stripe" {
  if (method === "apple") return "stripe";
  if (["GH", "NG", "KE", "ZA"].includes(country) && method !== "apple") return "paystack";
  return "stripe";
}
