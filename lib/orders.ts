import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDb, firebaseReady } from "./firebase";
import { sendPush } from "./push";
import { readUserLite } from "./chat";

export type Address = {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};

export type Order = {
  id: string;
  pieceId: string;
  pieceName: string;
  piecePhoto: string;
  brandId?: string;
  buyerId: string;
  sellerId: string;
  itemCents: number;
  feeCents: number;
  shipCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  country: string;
  payMethod: string;
  delivery: string;
  address: Address;
  status: "pending" | "paid" | "failed";
  createdAt: number;
};

const ADDR = "uvel-address-v1";
const ORDERS = "uvel-orders-v1";

let cache: Order[] = [];
const listeners = new Set<() => void>();

async function hydrateOrders() {
  try {
    const raw = await AsyncStorage.getItem(ORDERS);
    cache = raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    cache = [];
  }
  listeners.forEach((l) => l());
}
void hydrateOrders();

function emit() {
  listeners.forEach((l) => l());
}

export function useOrders() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return cache;
}

export function allOrders() {
  return cache;
}

export async function loadAddress(): Promise<Address | null> {
  try {
    const raw = await AsyncStorage.getItem(ADDR);
    return raw ? (JSON.parse(raw) as Address) : null;
  } catch {
    return null;
  }
}

export async function saveAddress(a: Address) {
  await AsyncStorage.setItem(ADDR, JSON.stringify(a));
}

export function watchOrder(id: string, onStatus: (status: Order["status"] | null) => void) {
  if (!firebaseReady()) return () => undefined;
  try {
    const user = firebaseAuth().currentUser;
    if (!user) return () => undefined;
    return onSnapshot(doc(firebaseDb(), "orders", id), (snap) => {
      onStatus(snap.exists() ? ((snap.data().status as Order["status"]) || null) : null);
    }, () => onStatus(null));
  } catch {
    return () => undefined;
  }
}

export async function placeOrder(order: Omit<Order, "id" | "createdAt" | "status">): Promise<Order> {
  const full: Order = {
    ...order,
    id: `o-${Date.now().toString(36)}`,
    createdAt: Date.now(),
    // A hosted checkout returning does not prove payment. Trusted payment
    // webhooks should be the only source that changes this to "paid".
    status: "pending",
  };
  try {
    const raw = await AsyncStorage.getItem(ORDERS);
    const list = raw ? (JSON.parse(raw) as Order[]) : [];
    await AsyncStorage.setItem(ORDERS, JSON.stringify([full, ...list]));
    cache = [full, ...list];
    emit();
  } catch {
    /* ignore */
  }
  if (firebaseReady()) {
    try {
      await setDoc(doc(firebaseDb(), "orders", full.id), {
        ...full,
        createdAt: serverTimestamp(),
      });
    } catch {
      /* The checkout callable will reject an order that never reached Firestore. */
    }
  }
  if (order.sellerId && order.sellerId !== order.buyerId) {
    const other = await readUserLite(order.sellerId);
    const token = typeof other?.expoPushToken === "string" ? other.expoPushToken : "";
    if (token) {
      void sendPush(token, "Sold on Uvel", `${order.pieceName} just sold.`, { pieceId: order.pieceId });
    }
  }
  return full;
}
