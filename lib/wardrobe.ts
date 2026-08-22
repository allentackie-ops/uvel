import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import type { Category } from "./catalog";

export type ClosetStatus = "owned" | "listed" | "sold";

export type ClosetPiece = {
  id: string;
  photo: string;
  name: string;
  brand: string;
  category: Category;
  color: string;
  size: string;
  condition: string;
  notes: string;
  listPriceCents: number;
  status: ClosetStatus;
  createdAt: number;
};

const KEY = "uvel-wardrobe-v1";
const CATS: Category[] = ["Outerwear", "Dresses", "Tops", "Trousers", "Knitwear", "Skirts", "Shoes"];
const NAMES: Record<Category, string[]> = {
  Outerwear: ["Wool overcoat", "Leather jacket", "Field jacket", "Trench"],
  Dresses: ["Bias slip", "Shirt dress", "Knit dress", "Wrap dress"],
  Tops: ["Oxford shirt", "Silk blouse", "Poet blouse", "Tank"],
  Trousers: ["Wide trousers", "Tailored pant", "Vintage denim", "Pleated trouser"],
  Knitwear: ["Cashmere crew", "Cardigan", "Turtleneck", "Polo knit"],
  Skirts: ["Satin skirt", "Pencil skirt", "Wrap skirt", "Pleated skirt"],
  Shoes: ["Leather loafer", "Boot", "Slingback", "Sneaker"],
};

let pieces: ClosetPiece[] = [];
const listeners = new Set<() => void>();

async function hydrate() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) pieces = JSON.parse(raw) as ClosetPiece[];
  listeners.forEach((l) => l());
}
void hydrate();

async function persist() {
  listeners.forEach((l) => l());
  await AsyncStorage.setItem(KEY, JSON.stringify(pieces));
}

export function useWardrobe() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return pieces;
}

export function getPiece(id: string) {
  return pieces.find((p) => p.id === id);
}

export function listedPieces() {
  return pieces.filter((p) => p.status === "listed");
}

export async function analyzePhoto(photo: string): Promise<Omit<ClosetPiece, "id" | "status" | "createdAt">> {
  await new Promise((r) => setTimeout(r, 800));
  const n = photo.length;
  const category = CATS[n % CATS.length];
  const name = NAMES[category][n % NAMES[category].length];
  return {
    photo,
    name,
    brand: "Your wardrobe",
    category,
    color: ["Ink", "Ivory", "Camel", "Olive", "Clay"][n % 5],
    size: "M",
    condition: "Excellent",
    notes: "",
    listPriceCents: 4800 + (n % 16) * 800,
  };
}

export function addPiece(draft: Omit<ClosetPiece, "id" | "status" | "createdAt">) {
  const piece: ClosetPiece = {
    ...draft,
    id: `w-${Date.now().toString(36)}`,
    status: "owned",
    createdAt: Date.now(),
  };
  pieces = [piece, ...pieces];
  void persist();
  return piece;
}

export function updatePiece(id: string, patch: Partial<ClosetPiece>) {
  pieces = pieces.map((p) => (p.id === id ? { ...p, ...patch } : p));
  void persist();
}

export function listPiece(id: string, patch: Partial<ClosetPiece>) {
  updatePiece(id, { ...patch, status: "listed" });
}

export function unlistPiece(id: string) {
  updatePiece(id, { status: "owned" });
}

export function markSold(id: string) {
  updatePiece(id, { status: "sold" });
}

export function removePiece(id: string) {
  pieces = pieces.filter((p) => p.id !== id);
  void persist();
}
