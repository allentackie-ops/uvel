import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "uvel-last-payment-method-v1";

type StoredPayment = { country: string; methodId: string; updatedAt: number };

export async function rememberLastPaymentMethod(country: string, methodId: string) {
  if (!country || !methodId) return;
  await AsyncStorage.setItem(KEY, JSON.stringify({ country, methodId, updatedAt: Date.now() } satisfies StoredPayment)).catch(() => undefined);
}

export async function loadLastPaymentMethod(country: string) {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<StoredPayment>) : null;
    return saved?.country === country && typeof saved.methodId === "string" ? saved.methodId : null;
  } catch {
    return null;
  }
}
