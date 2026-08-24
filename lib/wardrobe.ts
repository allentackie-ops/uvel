import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import type { Category } from "./catalog";
import { reviewListingPhoto } from "./photoCheck";
import { listingVisibleIn, type ShipsTo } from "./ships";

export type ClosetStatus = "owned" | "listed" | "sold";

export type ClosetPiece = {
  id: string;
  photo: string;
  photos: string[];
  name: string;
  brand: string;
  category: Category;
  color: string;
  size: string;
  sizes?: string[];
  sizeStock?: Record<string, number>;
  condition: string;
  material: string;
  notes: string;
  listPriceCents: number;
  originalPriceCents: number;
  status: ClosetStatus;
  createdAt: number;
  ownerId?: string;
  ownerName?: string;
  ownerPhoto?: string;
  country?: string;
  currency?: string;
  shipsTo?: ShipsTo;
  shopLook?: string;
  likedBy?: Liker[];
  brandId?: string;
  listedByUid?: string;
  listedByName?: string;
  views?: number;
};

export type Liker = {
  uid: string;
  name: string;
  photo?: string;
  at: number;
};

const KEY = "uvel-wardrobe-v1";
const CATS: Category[] = [
  "Outerwear",
  "Dresses",
  "Tops",
  "Trousers",
  "Knitwear",
  "Skirts",
  "Shoes",
  "Bags",
  "Accessories",
  "Jewelry",
  "Watches",
  "Hats",
  "Belts",
  "Sunglasses",
  "Scarves",
  "Hair",
  "Lingerie",
  "Swim",
  "Activewear",
  "Socks",
  "Ties",
  "Gloves",
];
const NAMES: Record<Category, string[]> = {
  Outerwear: ["Wool overcoat", "Leather jacket", "Field jacket", "Trench"],
  Dresses: ["Bias slip", "Shirt dress", "Knit dress", "Wrap dress"],
  Tops: ["Oxford shirt", "Silk blouse", "Poet blouse", "Tank"],
  Trousers: ["Wide trousers", "Tailored pant", "Vintage denim", "Pleated trouser"],
  Knitwear: ["Cashmere crew", "Cardigan", "Turtleneck", "Polo knit"],
  Skirts: ["Satin skirt", "Pencil skirt", "Wrap skirt", "Pleated skirt"],
  Shoes: ["Leather loafer", "Boot", "Slingback", "Sneaker"],
  Bags: ["Leather tote", "Shoulder bag", "Mini bag", "Weekend bag"],
  Accessories: ["Silk scarf", "Belt", "Gold hoops", "Wool beanie"],
  Jewelry: ["Gold cuff", "Pearl studs", "Chain", "Signet"],
  Watches: ["Tank watch", "Field watch", "Dress watch", "Bracelet watch"],
  Hats: ["Wool fedora", "Beret", "Cap", "Bucket"],
  Belts: ["Leather belt", "Sculptural belt", "Webbing belt", "Cinch"],
  Sunglasses: ["Acetate frames", "Wire rims", "Shield", "Clip"],
  Scarves: ["Silk square", "Wool wrap", "Bandana", "Stole"],
  Hair: ["Claw clip", "Silk scrunchie", "Barrette", "Comb"],
  Lingerie: ["Silk set", "Soft bra", "Slip", "Robe"],
  Swim: ["Maillot", "Wrap", "Trunk", "Sarong"],
  Activewear: ["Track pant", "Studio set", "Hoodie", "Short"],
  Socks: ["Merino crew", "Silk sock", "Rib ankle", "Over-the-calf"],
  Ties: ["Knit tie", "Silk tie", "Bow", "Ascot"],
  Gloves: ["Leather glove", "Cashmere glove", "Driving glove", "Mitt"],
};

let pieces: ClosetPiece[] = [];
const listeners = new Set<() => void>();

function normalize(p: ClosetPiece): ClosetPiece {
  const photos = p.photos?.length ? p.photos : p.photo ? [p.photo] : [];
  return {
    ...p,
    photos,
    photo: photos[0] ?? p.photo ?? "",
    material: p.material ?? "",
    originalPriceCents: p.originalPriceCents ?? 0,
  };
}

async function hydrate() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) pieces = (JSON.parse(raw) as ClosetPiece[]).map(normalize);
  listeners.forEach((l) => l());
  void import("./brands").then((m) => m.seedBrandFloor());
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

/** Live listings a buyer in this country is allowed to see. */
export function shopFloor(buyerCountry: string) {
  return listedPieces().filter((p) =>
    listingVisibleIn({ origin: p.country, shipsTo: p.shipsTo, buyer: buyerCountry }),
  );
}

export async function analyzePhoto(photo: string): Promise<Omit<ClosetPiece, "id" | "status" | "createdAt">> {
  try {
    const review = await reviewListingPhoto(photo);
    return {
      photo,
      photos: [photo],
      name: review.title || "Your piece",
      brand: review.brand || "Unlabeled",
      category: review.category,
      color: review.color || "",
      size: "",
      condition: review.conditionGuess || "Excellent",
      material: review.material,
      notes: review.description,
      listPriceCents: 4800,
      originalPriceCents: 0,
    };
  } catch {
    const n = photo.length;
    const category = CATS[n % CATS.length];
    return {
      photo,
      photos: [photo],
      name: NAMES[category][n % NAMES[category].length],
      brand: "Unlabeled",
      category,
      color: ["Ink", "Ivory", "Camel", "Olive", "Clay"][n % 5],
      size: "M",
      condition: "Excellent",
      material: "",
      notes: "",
      listPriceCents: 4800 + (n % 16) * 800,
      originalPriceCents: 0,
    };
  }
}

export function addPiece(
  draft: Omit<ClosetPiece, "id" | "status" | "createdAt" | "photos" | "material" | "originalPriceCents"> & {
    photos?: string[];
    material?: string;
    originalPriceCents?: number;
    status?: ClosetStatus;
  },
) {
  const photos = draft.photos?.length ? draft.photos : draft.photo ? [draft.photo] : [];
  const piece: ClosetPiece = {
    ...draft,
    photos,
    photo: photos[0] ?? draft.photo,
    material: draft.material ?? "",
    originalPriceCents: draft.originalPriceCents ?? 0,
    id: `w-${Date.now().toString(36)}`,
    status: draft.status ?? "owned",
    createdAt: Date.now(),
  };
  pieces = [piece, ...pieces];
  void persist();
  return piece;
}

export function stampMine(uid: string, patch: Partial<ClosetPiece>) {
  pieces = pieces.map((p) => {
    if (p.ownerId && p.ownerId !== uid) return p;
    return { ...p, ...patch };
  });
  void persist();
}

export function likeCount(p: ClosetPiece, saved: string[] = []) {
  const n = p.likedBy?.length ?? 0;
  if (n > 0) return n;
  return saved.includes(p.id) ? 1 : 0;
}

export function toggleLiker(id: string, liker: Liker): { liked: boolean; piece?: ClosetPiece } {
  const piece = pieces.find((p) => p.id === id);
  if (!piece) return { liked: false };
  const had = (piece.likedBy || []).some((l) => l.uid === liker.uid);
  const likedBy = had
    ? (piece.likedBy || []).filter((l) => l.uid !== liker.uid)
    : [{ ...liker, at: Date.now() }, ...(piece.likedBy || [])];
  updatePiece(id, { likedBy });
  return { liked: !had, piece: getPiece(id) };
}

export function syncSavedLikes(ids: string[], liker: Liker) {
  if (!ids.length || !pieces.length) return;
  let changed = false;
  pieces = pieces.map((p) => {
    if (!ids.includes(p.id)) return p;
    if ((p.likedBy || []).some((l) => l.uid === liker.uid)) return p;
    changed = true;
    return { ...p, likedBy: [{ ...liker, at: p.createdAt || Date.now() }, ...(p.likedBy || [])] };
  });
  if (changed) void persist();
}

export function likesOnMine(uid: string, saved: string[] = [], me?: Pick<Liker, "uid" | "name" | "photo">) {
  const rows = pieces.flatMap((p) => (p.likedBy || []).map((l) => ({ ...l, piece: p })));
  if (me) {
    for (const id of saved) {
      const p = pieces.find((x) => x.id === id);
      if (!p) continue;
      if (rows.some((r) => r.piece.id === id && r.uid === me.uid)) continue;
      rows.push({ ...me, at: p.createdAt || Date.now(), piece: p });
    }
  }
  return rows.sort((a, b) => b.at - a.at);
}

export function updatePiece(id: string, patch: Partial<ClosetPiece>) {
  pieces = pieces.map((p) => {
    if (p.id !== id) return p;
    const next = { ...p, ...patch };
    if (patch.photos) {
      next.photo = patch.photos[0] ?? next.photo;
    }
    return next;
  });
  void persist();
}

export function listPiece(id: string, patch: Partial<ClosetPiece> = {}) {
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
