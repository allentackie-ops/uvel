import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { brandApproved, brandCheck, getBrand, ownedBrand, updateBrand, useBrands } from "./brands";
import { allOrders, useOrders, type Order } from "./orders";
import { notifyUser } from "./push";

export const FOUNDER_SALES_FOR_CHECK = 2;
const NOTICE_KEY = "uvel-founder-check-notice-v1";

export type FounderCheckNotice = { brandId: string; name: string };

let notice: FounderCheckNotice | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

async function hydrate() {
  try {
    const raw = await AsyncStorage.getItem(NOTICE_KEY);
    notice = raw ? (JSON.parse(raw) as FounderCheckNotice) : null;
    emit();
  } catch {
    notice = null;
  }
}
void hydrate();

async function persist() {
  emit();
  if (notice) await AsyncStorage.setItem(NOTICE_KEY, JSON.stringify(notice));
  else await AsyncStorage.removeItem(NOTICE_KEY);
}

function saleCounts(order: Order, brandId: string) {
  if (order.brandId !== brandId) return false;
  if (order.status !== "paid") return false;
  if (order.refundStatus === "succeeded") return false;
  if (order.fulfillmentStatus === "canceled" || order.fulfillmentStatus === "returned") return false;
  return order.fulfillmentStatus === "delivered" || Boolean(order.deliveredAt) || Boolean(order.buyerConfirmedAt);
}

export function successfulBrandSales(brandId: string) {
  return allOrders().filter((order) => saleCounts(order, brandId)).length;
}

export async function maybeAwardFounderCheck(brandId: string) {
  const brand = getBrand(brandId);
  if (!brand || brand.origin !== "founder") return false;
  if (!brandApproved(brand)) return false;
  if (brandCheck(brand) !== "none") return false;
  if (successfulBrandSales(brandId) < FOUNDER_SALES_FOR_CHECK) return false;
  updateBrand(brandId, { check: "lime", verified: true, checkAwardedAt: Date.now() });
  notice = { brandId, name: brand.name };
  await persist();
  await notifyUser(brand.ownerId, `${brand.name} is verified`, "The green check is on your name now. Two sales did that.", {
    kind: "founder_check",
    brandId,
  });
  return true;
}

export function useFounderCheckNotice() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return notice;
}

export function dismissFounderCheckNotice() {
  notice = null;
  void persist();
}

export function useFounderCheckSync(uid: string) {
  useBrands();
  useOrders();
  useEffect(() => {
    const mine = ownedBrand(uid);
    if (!mine) return;
    void maybeAwardFounderCheck(mine.id);
  }, [uid, allOrders().map((o) => `${o.id}:${o.fulfillmentStatus}:${o.buyerConfirmedAt || 0}`).join("|")]);
}
