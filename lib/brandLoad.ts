import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";

const MIN_MS = 820;
const listeners = new Set<(on: boolean) => void>();

let on = false;
let gen = 0;
let shownAt = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function emit(next: boolean) {
  on = next;
  listeners.forEach((l) => l(next));
}

export function showBrandLoad() {
  gen += 1;
  shownAt = Date.now();
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  emit(true);
  return gen;
}

export function hideBrandLoad(id?: number) {
  if (id && id !== gen) return;
  const waitId = gen;
  const left = MIN_MS - (Date.now() - shownAt);
  const done = () => {
    if (waitId !== gen) return;
    hideTimer = null;
    emit(false);
  };
  if (left > 0) {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(done, left);
    return;
  }
  done();
}

export function openWithLoad(href: Href) {
  const id = showBrandLoad();
  router.push(href);
  hideBrandLoad(id);
}

export async function withBrandLoad<T>(fn: () => Promise<T>): Promise<T> {
  const id = showBrandLoad();
  try {
    return await fn();
  } finally {
    hideBrandLoad(id);
  }
}

export function useBrandLoadOn() {
  const [v, set] = useState(on);
  useEffect(() => {
    listeners.add(set);
    return () => {
      listeners.delete(set);
    };
  }, []);
  return v;
}
