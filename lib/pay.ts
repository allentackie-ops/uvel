import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { NativeModules } from "react-native";
import { httpsCallable } from "firebase/functions";
import { firebaseFunctions, firebaseReady } from "./firebase";

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

export type CheckoutPay = {
  amountCents: number;
  currency: string;
  email: string;
  method: string;
  country: string;
  reference: string;
  name: string;
};

export type CheckoutSession = {
  processor: "stripe" | "paystack";
  clientSecret?: string;
  url?: string;
  reference: string;
};

export async function createCheckoutSession(input: CheckoutPay): Promise<CheckoutSession> {
  if (!firebaseReady()) throw new Error("Payments aren’t connected yet.");
  const call = httpsCallable<CheckoutPay, CheckoutSession>(firebaseFunctions(), "createCheckout");
  const res = await call(input);
  return res.data;
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
