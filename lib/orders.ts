import AsyncStorage from "@react-native-async-storage/async-storage";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseDb, firebaseReady } from "./firebase";
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
  status: "paid" | "failed";
  createdAt: number;
};

const ADDR = "uvel-address-v1";
const ORDERS = "uvel-orders-v1";

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

export async function placeOrder(order: Omit<Order, "id" | "createdAt" | "status">): Promise<Order> {
  const full: Order = {
    ...order,
    id: `o-${Date.now().toString(36)}`,
    createdAt: Date.now(),
    status: "paid",
  };
  try {
    const raw = await AsyncStorage.getItem(ORDERS);
    const list = raw ? (JSON.parse(raw) as Order[]) : [];
    await AsyncStorage.setItem(ORDERS, JSON.stringify([full, ...list]));
  } catch {
    /* ignore */
  }
  if (firebaseReady()) {
    try {
      const ref = await addDoc(collection(firebaseDb(), "orders"), {
        ...full,
        createdAt: serverTimestamp(),
      });
      full.id = ref.id;
      await setDoc(doc(firebaseDb(), "orders", ref.id), { id: ref.id }, { merge: true });
    } catch {
      /* local copy is enough */
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
