import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firebaseAuth, firebaseDb, firebaseFunctions, firebaseReady } from "./firebase";
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

export type FulfillmentStatus = "unfulfilled" | "processing" | "packed" | "shipped" | "delivered" | "canceled" | "returned";
export type ShipmentStatus = "label_pending" | "in_transit" | "out_for_delivery" | "delivered" | "exception" | "returned";
export type ShippingExceptionCode = "address_issue" | "carrier_delay" | "damaged" | "lost" | "recipient_unavailable" | "customs" | "other";

export type Shipment = {
  id: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  status: ShipmentStatus;
  estimatedDeliveryAt?: number;
  shippedAt?: number;
  deliveredAt?: number;
  lastEventAt?: number;
  lastLocation?: string;
  exceptionCode?: ShippingExceptionCode;
  exceptionNote?: string;
  createdAt: number;
  updatedAt: number;
};

export type ResolutionType = "cancellation" | "return";
export type ResolutionStatus = "requested" | "approved" | "rejected" | "item_sent" | "received" | "refund_pending" | "refunded" | "closed";
export type RefundStatus = "none" | "requested" | "processing" | "succeeded" | "failed";
export type RestockDecision = "pending" | "restock" | "no_restock" | "restocked";

export type OrderResolution = {
  type: ResolutionType;
  status: ResolutionStatus;
  reason: string;
  note?: string;
  requestedAt?: number;
  reviewedAt?: number;
  itemSentAt?: number;
  receivedAt?: number;
  refundRequestedAt?: number;
  refundedAt?: number;
  restockDecision: RestockDecision;
};

export type Order = {
  id: string;
  pieceId: string;
  pieceName: string;
  piecePhoto: string;
  brandId?: string;
  /** Exact size or variant selected by the buyer, when the listing has variants. */
  variantKey?: string;
  variantLabel?: string;
  inventoryReservationId?: string;
  inventoryReservationStatus?: "active" | "consumed" | "released" | "expired";
  inventoryReservationExpiresAt?: number;
  buyerId: string;
  sellerId: string;
  itemCents: number;
  feeCents: number;
  discountCents?: number;
  promotionId?: string;
  promotionCode?: string;
  shipCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  country: string;
  payMethod: string;
  delivery: string;
  address: Address;
  status: "pending" | "paid" | "failed";
  fulfillmentStatus?: FulfillmentStatus;
  carrier?: string;
  trackingNumber?: string;
  shipment?: Shipment;
  paymentIntentId?: string;
  paymentTransactionId?: string;
  refundStatus?: RefundStatus;
  refundProviderId?: string;
  refundAmountCents?: number;
  inventoryRestockedAt?: number;
  fulfillmentUpdatedAt?: number;
  resolution?: OrderResolution;
  paidAt?: number;
  createdAt: number;
};

const ADDR = "uvel-address-v1";
const ORDERS = "uvel-orders-v1";

let cache: Order[] = [];
const listeners = new Set<() => void>();

function normalizeOrder(order: Order): Order {
  return {
    ...order,
    fulfillmentStatus: order.fulfillmentStatus || (order.status === "paid" ? "unfulfilled" : undefined),
  };
}

async function hydrateOrders() {
  try {
    const raw = await AsyncStorage.getItem(ORDERS);
    cache = raw ? (JSON.parse(raw) as Order[]).map(normalizeOrder) : [];
  } catch {
    cache = [];
  }
  listeners.forEach((l) => l());
}
void hydrateOrders();

function emit() {
  listeners.forEach((l) => l());
}

function millis(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") return (value as { toMillis: () => number }).toMillis();
  return Date.now();
}

function remoteOrder(id: string, data: Record<string, unknown>): Order {
  const rawShipment = data.shipment as Shipment | undefined;
  const shipment = rawShipment ? { ...rawShipment, createdAt: millis(rawShipment.createdAt), updatedAt: millis(rawShipment.updatedAt), estimatedDeliveryAt: rawShipment.estimatedDeliveryAt == null ? undefined : millis(rawShipment.estimatedDeliveryAt), shippedAt: rawShipment.shippedAt == null ? undefined : millis(rawShipment.shippedAt), deliveredAt: rawShipment.deliveredAt == null ? undefined : millis(rawShipment.deliveredAt), lastEventAt: rawShipment.lastEventAt == null ? undefined : millis(rawShipment.lastEventAt) } : undefined;
  return normalizeOrder({
    ...(data as unknown as Order),
    id,
    shipment,
    createdAt: millis(data.createdAt),
    paidAt: data.paidAt == null ? undefined : millis(data.paidAt),
    fulfillmentUpdatedAt: data.fulfillmentUpdatedAt == null ? undefined : millis(data.fulfillmentUpdatedAt),
    inventoryReservationExpiresAt: data.inventoryReservationExpiresAt == null ? undefined : millis(data.inventoryReservationExpiresAt),
  });
}

function mergeRemoteOrders(remote: Order[]) {
  const byId = new Map(cache.map((order) => [order.id, order]));
  remote.forEach((order) => byId.set(order.id, order));
  cache = Array.from(byId.values());
  emit();
}

/** Read-only subscription used by Brand HQ; writes still go through the callable below. */
export function watchBrandOrders(brandId: string) {
  if (!firebaseReady() || !firebaseAuth().currentUser) return () => undefined;
  try {
    const ordersQuery = query(collection(firebaseDb(), "orders"), where("brandId", "==", brandId));
    return onSnapshot(ordersQuery, (snap) => {
      mergeRemoteOrders(snap.docs.map((item) => remoteOrder(item.id, item.data() as Record<string, unknown>)));
    }, () => undefined);
  } catch {
    return () => undefined;
  }
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

export function watchOrder(id: string, onStatus: (status: Order["status"] | null, fulfillmentStatus?: FulfillmentStatus | null) => void) {
  const local = cache.find((order) => order.id === id);
  onStatus(local?.status || null, local?.fulfillmentStatus || null);
  if (!firebaseReady()) return () => undefined;
  try {
    const user = firebaseAuth().currentUser;
    if (!user) return () => undefined;
    return onSnapshot(doc(firebaseDb(), "orders", id), (snap) => {
      const data = snap.data() || {};
      if (snap.exists()) mergeRemoteOrders([remoteOrder(snap.id, data as Record<string, unknown>)]);
      onStatus(
        snap.exists() ? ((data.status as Order["status"]) || null) : null,
        snap.exists() ? ((data.fulfillmentStatus as FulfillmentStatus) || null) : null,
      );
    }, () => onStatus(null, null));
  } catch {
    return () => undefined;
  }
}

export async function placeOrder(order: Omit<Order, "id" | "createdAt" | "status">): Promise<Order> {
  if (!firebaseReady() || !firebaseAuth().currentUser) {
    throw new Error("Orders are unavailable until Uvel reconnects to the marketplace service.");
  }
  const full: Order = {
    ...order,
    id: `o-${Date.now().toString(36)}`,
    createdAt: Date.now(),
    // A hosted checkout returning does not prove payment. Trusted payment
    // webhooks should be the only source that changes this to "paid".
    status: "pending",
    fulfillmentStatus: "unfulfilled",
  };
  try {
    await setDoc(doc(firebaseDb(), "orders", full.id), {
      ...full,
      createdAt: serverTimestamp(),
    });
  } catch {
    throw new Error("We couldn’t save this order securely, so no payment was started. Please try again when Uvel reconnects.");
  }
  try {
    const raw = await AsyncStorage.getItem(ORDERS);
    const list = raw ? (JSON.parse(raw) as Order[]) : [];
    await AsyncStorage.setItem(ORDERS, JSON.stringify([full, ...list]));
    cache = [full, ...list];
    emit();
  } catch {
    /* The remote order remains authoritative if local caching is unavailable. */
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

export type FulfillmentPatch = {
  fulfillmentStatus: FulfillmentStatus;
  carrier?: string;
  trackingNumber?: string;
};

/** Persists fulfillment through the trusted callable, then refreshes the local cache. */
export async function updateOrderFulfillment(orderId: string, patch: FulfillmentPatch) {
  const current = cache.find((order) => order.id === orderId);
  if (!current) throw new Error("Order not found.");
  if (!firebaseReady() || !firebaseAuth().currentUser) {
    throw new Error("Order updates require a signed-in connection to Uvel.");
  }
  try {
    const update = httpsCallable(firebaseFunctions(), "updateOrderFulfillment");
    await update({ orderId, fulfillmentStatus: patch.fulfillmentStatus, carrier: patch.carrier || "", trackingNumber: patch.trackingNumber || "" });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "The order service could not save this update.";
    throw new Error(message);
  }
  const next: Order = normalizeOrder({ ...current, ...patch, fulfillmentUpdatedAt: Date.now() });
  cache = cache.map((order) => (order.id === orderId ? next : order));
  emit();
  try {
    await AsyncStorage.setItem(ORDERS, JSON.stringify(cache));
  } catch {
    /* The server update succeeded; keep the in-memory order visible if local persistence is unavailable. */
  }
  return next;
}

export type ShipmentCreateInput = {
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  estimatedDeliveryAt?: number;
};

export async function createOrderShipment(orderId: string, input: ShipmentCreateInput) {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Shipment creation requires a signed-in connection to Uvel.");
  const call = httpsCallable(firebaseFunctions(), "createOrderShipment");
  await call({ orderId, ...input });
}

export async function updateOrderShipment(orderId: string, status: ShipmentStatus, details: { note?: string; location?: string; exceptionCode?: ShippingExceptionCode } = {}) {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Shipment updates require a signed-in connection to Uvel.");
  const call = httpsCallable(firebaseFunctions(), "updateOrderShipment");
  await call({ orderId, status, ...details });
}

export async function requestOrderResolution(orderId: string, type: ResolutionType, reason: string, note?: string) {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Resolution requests require a signed-in connection to Uvel.");
  const call = httpsCallable(firebaseFunctions(), "requestOrderResolution");
  await call({ orderId, type, reason, note: note || "" });
}

export async function reviewOrderResolution(orderId: string, decision: "approve" | "reject" | "mark_received" | "confirm_restock" | "skip_restock") {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Resolution reviews require a signed-in connection to Uvel.");
  const call = httpsCallable(firebaseFunctions(), "reviewOrderResolution");
  await call({ orderId, decision });
}

export async function confirmOrderReturnSent(orderId: string) {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Return updates require a signed-in connection to Uvel.");
  const call = httpsCallable(firebaseFunctions(), "confirmOrderReturnSent");
  await call({ orderId });
}
