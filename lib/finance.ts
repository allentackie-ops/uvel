import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { Order } from "./orders";
import { firebaseAuth, firebaseDb, firebaseFunctions, firebaseReady } from "./firebase";

export type SettlementStatus = "pending" | "available" | "refunded" | "void";
export type PayoutStatus = "requested" | "processing" | "paid" | "failed" | "reversed";

export type SettlementEntry = {
  id: string;
  brandId: string;
  orderId: string;
  orderDate: number;
  buyerId: string;
  productName: string;
  productPhoto: string;
  currency: string;
  grossCents: number;
  feeCents: number;
  refundCents: number;
  netCents: number;
  status: SettlementStatus;
};

export type Payout = {
  id: string;
  brandId: string;
  currency: string;
  amountCents: number;
  status: PayoutStatus;
  requestedAt: number;
  processedAt?: number;
  failureReason?: string;
};

export type FinanceTotals = {
  currency: string;
  grossCents: number;
  feesCents: number;
  refundsCents: number;
  netCents: number;
  pendingCents: number;
  availableCents: number;
  paidOutCents: number;
};

function millis(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") return (value as { toMillis: () => number }).toMillis();
  return Date.now();
}

export function settlementEntry(order: Order, brandId: string): SettlementEntry | null {
  if (order.brandId !== brandId || order.status !== "paid") return null;
  const currency = String(order.currency || "USD").toUpperCase();
  const grossCents = Math.max(0, Math.floor(Number(order.itemCents) || 0));
  const feeCents = Math.max(0, Math.floor(Number(order.feeCents) || 0));
  const hasRefund = order.refundStatus === "processing" || order.refundStatus === "succeeded";
  const refundCents = hasRefund ? Math.min(grossCents, Math.max(0, Math.floor(Number(order.refundAmountCents || order.itemCents) || 0))) : 0;
  const status: SettlementStatus = order.fulfillmentStatus === "canceled" ? "void" : order.refundStatus === "succeeded" ? "refunded" : order.fulfillmentStatus === "delivered" ? "available" : "pending";
  return {
    id: `order-${order.id}`,
    brandId,
    orderId: order.id,
    orderDate: millis(order.createdAt),
    buyerId: order.buyerId,
    productName: order.pieceName,
    productPhoto: order.piecePhoto,
    currency,
    grossCents,
    feeCents,
    refundCents,
    netCents: status === "void" ? 0 : Math.max(0, grossCents - feeCents - refundCents),
    status,
  };
}

export function settlementLedger(orders: Order[], brandId: string, since?: number) {
  return orders.map((order) => settlementEntry(order, brandId)).filter((entry): entry is SettlementEntry => Boolean(entry) && (!since || (entry as SettlementEntry).orderDate >= since)).sort((a, b) => b.orderDate - a.orderDate);
}

export function financeTotals(entries: SettlementEntry[], payouts: Payout[], currency: string): FinanceTotals {
  const rows = entries.filter((entry) => entry.currency === currency);
  const paidOutCents = payouts.filter((payout) => payout.currency === currency && ["requested", "paid", "processing"].includes(payout.status)).reduce((sum, payout) => sum + Math.max(0, payout.amountCents), 0);
  const grossCents = rows.reduce((sum, row) => sum + row.grossCents, 0);
  const feesCents = rows.reduce((sum, row) => sum + row.feeCents, 0);
  const refundsCents = rows.reduce((sum, row) => sum + row.refundCents, 0);
  const netCents = rows.reduce((sum, row) => sum + row.netCents, 0);
  const pendingCents = rows.filter((row) => row.status === "pending").reduce((sum, row) => sum + row.netCents, 0);
  const availableBeforePayout = rows.filter((row) => row.status === "available").reduce((sum, row) => sum + row.netCents, 0);
  return { currency, grossCents, feesCents, refundsCents, netCents, pendingCents, availableCents: Math.max(0, availableBeforePayout - paidOutCents), paidOutCents };
}

const payoutCache: Record<string, Payout[]> = {};
const payoutWatches = new Set<string>();
const listeners = new Set<() => void>();

export function usePayouts(brandId: string) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    if (brandId && !payoutWatches.has(brandId) && firebaseReady() && firebaseAuth().currentUser) {
      payoutWatches.add(brandId);
      const stop = onSnapshot(query(collection(firebaseDb(), "payouts"), where("brandId", "==", brandId)), (snap) => {
        payoutCache[brandId] = snap.docs.map((item) => {
          const data = item.data() as Payout;
          return { ...data, id: item.id, requestedAt: millis(data.requestedAt), processedAt: data.processedAt == null ? undefined : millis(data.processedAt) };
        }).sort((a, b) => b.requestedAt - a.requestedAt);
        listeners.forEach((notify) => notify());
      }, () => undefined);
      return () => { listeners.delete(listener); payoutWatches.delete(brandId); stop(); };
    }
    return () => { listeners.delete(listener); };
  }, [brandId]);
  return payoutCache[brandId] || [];
}

export async function requestBrandPayout(brandId: string, currency: string, amountCents: number) {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Payout requests require a signed-in connection to Uvel.");
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error("A valid payout amount is required.");
  const call = httpsCallable(firebaseFunctions(), "requestBrandPayout");
  return call({ brandId, currency, amountCents });
}
