import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type CartItem = { pieceId: string; addedAt: number };

const KEY = "uvel-today-cart-v1";
let items: CartItem[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

async function persist() {
  await AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => undefined);
}

export async function hydrateCart() {
  if (hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    items = raw ? (JSON.parse(raw) as CartItem[]) : [];
    if (!Array.isArray(items)) items = [];
  } catch {
    items = [];
  }
  hydrated = true;
  emit();
}

export function getCart() {
  return items;
}

export function addToCart(pieceId: string) {
  if (!pieceId || items.some((item) => item.pieceId === pieceId)) return items;
  items = [{ pieceId, addedAt: Date.now() }, ...items];
  void persist();
  emit();
  return items;
}

export function removeFromCart(pieceId: string) {
  items = items.filter((item) => item.pieceId !== pieceId);
  void persist();
  emit();
  return items;
}

export function removeManyFromCart(pieceIds: string[]) {
  const drop = new Set(pieceIds);
  items = items.filter((item) => !drop.has(item.pieceId));
  void persist();
  emit();
  return items;
}

export function inCart(pieceId: string) {
  return items.some((item) => item.pieceId === pieceId);
}

export function useCart() {
  const [, bump] = useState(0);
  useEffect(() => {
    void hydrateCart();
    const listener = () => bump((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return {
    items,
    count: items.length,
    add: addToCart,
    remove: removeFromCart,
    removeMany: removeManyFromCart,
    has: inCart,
  };
}
