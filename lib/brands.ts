import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { Image } from "react-native";
import { useEffect, useState } from "react";
import { themeOf, type BrandTheme } from "./brandThemes";
import { reviewBrand, type BrandFiling } from "./brandVerify";
import { firebaseDb, firebaseReady } from "./firebase";
import { addPiece, listedPieces, type ClosetPiece } from "./wardrobe";

export type BrandStatus = "draft" | "pending" | "verified" | "rejected";
export type MemberRole = "owner" | "poster";

export type BrandMember = {
  uid: string;
  name: string;
  photo?: string;
  role: MemberRole;
  joinedAt: number;
};

export type BrandInvite = {
  id: string;
  brandId: string;
  brandName: string;
  brandLogo?: string;
  fromUid: string;
  fromName: string;
  toUid?: string;
  toEmail?: string;
  toName?: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
};

export type Brand = {
  id: string;
  name: string;
  handle: string;
  tagline: string;
  story: string;
  vertical: string;
  website: string;
  instagram: string;
  phone: string;
  whatsapp: string;
  legalName: string;
  registrationId: string;
  contactEmail: string;
  country: string;
  logoUri: string;
  bannerKind: "image" | "video";
  bannerUri: string;
  themeId: string;
  custom?: Partial<BrandTheme>;
  status: BrandStatus;
  verified: boolean;
  verifiedAt?: number;
  rejectReasons?: string[];
  rejectHeadline?: string;
  ownerId: string;
  ownerName: string;
  ownerPhoto?: string;
  analyticsShared: boolean;
  members: BrandMember[];
  views: number;
  likes: number;
  follows: number;
  followers?: string[];
  createdAt: number;
};

export type BrandPerson = {
  uid: string;
  name: string;
  email: string;
  photo?: string;
};

const KEY = "uvel-brands-v1";
const INV = "uvel-brand-invites-v1";

const assets = {
  leatherTrench: require("../assets/catalog/leather-trench.jpg"),
  silkSlip: require("../assets/catalog/silk-slip.jpg"),
  woolBlazer: require("../assets/catalog/wool-blazer.jpg"),
  wideTrousers: require("../assets/catalog/wide-trousers.jpg"),
  vintageDenim: require("../assets/catalog/vintage-denim.jpg"),
  cashmereCrew: require("../assets/catalog/cashmere-crew.jpg"),
  cowboyBoots: require("../assets/catalog/cowboy-boots.jpg"),
  poetBlouse: require("../assets/catalog/poet-blouse.jpg"),
  suedeJacket: require("../assets/catalog/suede-jacket.jpg"),
  satinSkirt: require("../assets/catalog/satin-skirt.jpg"),
  fieldJacket: require("../assets/catalog/field-jacket.jpg"),
  loafer: require("../assets/catalog/loafer.jpg"),
  herringboneCoat: require("../assets/catalog/herringbone-coat.jpg"),
  bourgeois: require("../assets/catalog/trend-bourgeois.jpg"),
  western: require("../assets/catalog/trend-western.jpg"),
  romantic: require("../assets/catalog/trend-romantic.jpg"),
};

function uriOf(src: number) {
  return Image.resolveAssetSource(src)?.uri ?? "";
}

export const DIRECTORY: BrandPerson[] = [
  { uid: "demo-ama", name: "Ama Mensah", email: "ama@uvel.app" },
  { uid: "demo-kofi", name: "Kofi Boateng", email: "kofi@uvel.app" },
  { uid: "demo-nana", name: "Nana Adjei", email: "nana@uvel.app" },
  { uid: "demo-lina", name: "Lina Okoye", email: "lina@uvel.app" },
  { uid: "demo-jules", name: "Jules Moreau", email: "jules@uvel.app" },
];

function house(partial: Brand): Brand {
  return partial;
}

const SEED: Brand[] = [
  house({
    id: "maison-found",
    name: "Maison Found",
    handle: "maisonfound",
    tagline: "Knit, stone, and a bag that looks inherited.",
    story: "A quiet house for camel, cream, and the pieces you keep.",
    vertical: "Unisex",
    website: "https://maisonfound.example",
    instagram: "maisonfound",
    phone: "",
    whatsapp: "",
    legalName: "Maison Found Atelier Ltd",
    registrationId: "MF-1984",
    contactEmail: "desk@maisonfound.example",
    country: "GB",
    logoUri: uriOf(assets.cashmereCrew),
    bannerKind: "image",
    bannerUri: uriOf(assets.bourgeois),
    themeId: "olive",
    status: "verified",
    verified: true,
    verifiedAt: Date.now() - 86400000 * 40,
    ownerId: "house-maison",
    ownerName: "House desk",
    analyticsShared: true,
    members: [{ uid: "house-maison", name: "House desk", role: "owner", joinedAt: Date.now() - 86400000 * 40 }],
    views: 0,
    likes: 0,
    follows: 0,
    followers: [],
    createdAt: Date.now() - 86400000 * 40,
  }),
  house({
    id: "archive-1982",
    name: "Archive 1982",
    handle: "archive1982",
    tagline: "Leather, suede, and the western after 6.",
    story: "Deadstock and archive cuts. One western piece, not a costume.",
    vertical: "Archive",
    website: "https://archive1982.example",
    instagram: "archive1982",
    phone: "",
    whatsapp: "",
    legalName: "Archive 1982 LLC",
    registrationId: "AR-1982",
    contactEmail: "desk@archive1982.example",
    country: "US",
    logoUri: uriOf(assets.leatherTrench),
    bannerKind: "image",
    bannerUri: uriOf(assets.western),
    themeId: "noir",
    status: "verified",
    verified: true,
    verifiedAt: Date.now() - 86400000 * 70,
    ownerId: "house-archive",
    ownerName: "Archive desk",
    analyticsShared: false,
    members: [{ uid: "house-archive", name: "Archive desk", role: "owner", joinedAt: Date.now() - 86400000 * 70 }],
    views: 0,
    likes: 0,
    follows: 0,
    followers: [],
    createdAt: Date.now() - 86400000 * 70,
  }),
  house({
    id: "atelier-no4",
    name: "Atelier No. 4",
    handle: "atelierno4",
    tagline: "Ivory bias. Champagne satin. After dark.",
    story: "A small atelier for liquid evening — slips, poets, and silk that moves.",
    vertical: "Atelier",
    website: "https://atelier4.example",
    instagram: "atelierno4",
    phone: "",
    whatsapp: "",
    legalName: "Atelier No. 4 SARL",
    registrationId: "AT-0004",
    contactEmail: "desk@atelier4.example",
    country: "FR",
    logoUri: uriOf(assets.silkSlip),
    bannerKind: "image",
    bannerUri: uriOf(assets.romantic),
    themeId: "ivory",
    status: "verified",
    verified: true,
    verifiedAt: Date.now() - 86400000 * 22,
    ownerId: "house-atelier",
    ownerName: "Atelier desk",
    analyticsShared: true,
    members: [{ uid: "house-atelier", name: "Atelier desk", role: "owner", joinedAt: Date.now() - 86400000 * 22 }],
    views: 0,
    likes: 0,
    follows: 0,
    followers: [],
    createdAt: Date.now() - 86400000 * 22,
  }),
];

let brands: Brand[] = [];
let invites: BrandInvite[] = [];
let seededListings = false;
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

async function persist() {
  emit();
  await AsyncStorage.setItem(KEY, JSON.stringify(brands));
  await AsyncStorage.setItem(INV, JSON.stringify(invites));
}

function seedListings() {
  if (seededListings) return;
  seededListings = true;
  if (listedPieces().some((p) => p.brandId)) return;
  const rows: Array<Omit<ClosetPiece, "id" | "status" | "createdAt"> & { status?: ClosetPiece["status"] }> = [
    { photo: uriOf(assets.cashmereCrew), photos: [uriOf(assets.cashmereCrew)], name: "Camel cashmere crew", brand: "Maison Found", category: "Knitwear", color: "Camel", size: "M", sizes: ["XS", "S", "M", "L", "XL"], condition: "New", material: "Cashmere", notes: "A fine camel crew that sits close without clinging.", listPriceCents: 24500, originalPriceCents: 0, brandId: "maison-found", ownerId: "house-maison", ownerName: "Maison Found", country: "GB", currency: "GBP", shipsTo: "all" },
    { photo: uriOf(assets.wideTrousers), photos: [uriOf(assets.wideTrousers)], name: "Stone wide-leg trousers", brand: "Maison Found", category: "Trousers", color: "Stone", size: "M", sizes: ["S", "M", "L", "XL"], condition: "New", material: "Wool blend", notes: "Full-leg trousers in warm stone.", listPriceCents: 16800, originalPriceCents: 0, brandId: "maison-found", ownerId: "house-maison", ownerName: "Maison Found", country: "GB", currency: "GBP", shipsTo: "all" },
    { photo: uriOf(assets.loafer), photos: [uriOf(assets.loafer)], name: "Chocolate leather loafers", brand: "Maison Found", category: "Shoes", color: "Chocolate", size: "40", sizes: ["38", "39", "40", "41", "42"], condition: "New", material: "Calf leather", notes: "Unadorned chocolate loafers.", listPriceCents: 22000, originalPriceCents: 0, brandId: "maison-found", ownerId: "house-maison", ownerName: "Maison Found", country: "GB", currency: "GBP", shipsTo: "all" },
    { photo: uriOf(assets.leatherTrench), photos: [uriOf(assets.leatherTrench)], name: "Espresso leather trench", brand: "Archive 1982", category: "Outerwear", color: "Espresso", size: "M", sizes: ["S", "M", "L"], condition: "New", material: "Lamb leather", notes: "A belted trench in espresso lamb.", listPriceCents: 42000, originalPriceCents: 0, brandId: "archive-1982", ownerId: "house-archive", ownerName: "Archive 1982", country: "US", currency: "USD", shipsTo: "all" },
    { photo: uriOf(assets.suedeJacket), photos: [uriOf(assets.suedeJacket)], name: "Rust suede western jacket", brand: "Archive 1982", category: "Outerwear", color: "Rust", size: "M", sizes: ["S", "M", "L", "XL"], condition: "New", material: "Suede", notes: "A western cut in rust suede.", listPriceCents: 28000, originalPriceCents: 0, brandId: "archive-1982", ownerId: "house-archive", ownerName: "Archive 1982", country: "US", currency: "USD", shipsTo: "all" },
    { photo: uriOf(assets.cowboyBoots), photos: [uriOf(assets.cowboyBoots)], name: "Oxblood cowboy boots", brand: "Archive 1982", category: "Shoes", color: "Oxblood", size: "41", sizes: ["39", "40", "41", "42", "43"], condition: "New", material: "Leather", notes: "Stacked heel, pointed toe.", listPriceCents: 31000, originalPriceCents: 0, brandId: "archive-1982", ownerId: "house-archive", ownerName: "Archive 1982", country: "US", currency: "USD", shipsTo: "all" },
    { photo: uriOf(assets.vintageDenim), photos: [uriOf(assets.vintageDenim)], name: "Indigo vintage denim", brand: "Archive 1982", category: "Trousers", color: "Indigo", size: "30", sizes: ["28", "29", "30", "31", "32"], condition: "Limited run", material: "Cotton denim", notes: "High-rise vintage wash.", listPriceCents: 18000, originalPriceCents: 0, brandId: "archive-1982", ownerId: "house-archive", ownerName: "Archive 1982", country: "US", currency: "USD", shipsTo: "all" },
    { photo: uriOf(assets.silkSlip), photos: [uriOf(assets.silkSlip)], name: "Ivory bias silk slip", brand: "Atelier No. 4", category: "Dresses", color: "Ivory", size: "S", sizes: ["XS", "S", "M"], condition: "New", material: "Silk charmeuse", notes: "A bias-cut slip that moves like water.", listPriceCents: 26000, originalPriceCents: 0, brandId: "atelier-no4", ownerId: "house-atelier", ownerName: "Atelier No. 4", country: "FR", currency: "EUR", shipsTo: "all" },
    { photo: uriOf(assets.poetBlouse), photos: [uriOf(assets.poetBlouse)], name: "Cream silk poet blouse", brand: "Atelier No. 4", category: "Tops", color: "Cream", size: "S", sizes: ["XS", "S", "M", "L"], condition: "New", material: "Silk", notes: "Gathered cuffs, an open neck.", listPriceCents: 14000, originalPriceCents: 0, brandId: "atelier-no4", ownerId: "house-atelier", ownerName: "Atelier No. 4", country: "FR", currency: "EUR", shipsTo: "all" },
    { photo: uriOf(assets.satinSkirt), photos: [uriOf(assets.satinSkirt)], name: "Champagne satin midi", brand: "Atelier No. 4", category: "Skirts", color: "Champagne", size: "S", sizes: ["XS", "S", "M"], condition: "New", material: "Acetate satin", notes: "Bias midi in champagne satin.", listPriceCents: 16000, originalPriceCents: 0, brandId: "atelier-no4", ownerId: "house-atelier", ownerName: "Atelier No. 4", country: "FR", currency: "EUR", shipsTo: "all" },
  ];
  for (const row of rows) addPiece({ ...row, status: "listed" });
}

export function seedBrandFloor() {
  seedListings();
}

async function hydrate() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const inv = await AsyncStorage.getItem(INV);
    const saved = raw ? (JSON.parse(raw) as Brand[]) : [];
    invites = inv ? (JSON.parse(inv) as BrandInvite[]) : [];
    const byId = new Map(saved.map((b) => [b.id, b]));
    for (const s of SEED) if (!byId.has(s.id)) byId.set(s.id, s);
    brands = Array.from(byId.values());
  } catch {
    brands = [...SEED];
  }
  emit();
  void pullRemote();
}
void hydrate();

async function pushBrand(b: Brand) {
  if (!firebaseReady()) return;
  try {
    await setDoc(doc(firebaseDb(), "brands", b.id), { ...b, updatedAt: serverTimestamp() }, { merge: true });
  } catch {
    /* local still counts */
  }
}

async function pushInvite(i: BrandInvite) {
  if (!firebaseReady()) return;
  try {
    await setDoc(doc(firebaseDb(), "brandInvites", i.id), { ...i, updatedAt: serverTimestamp() }, { merge: true });
  } catch {
    /* local */
  }
}

async function pullRemote() {
  if (!firebaseReady()) return;
  try {
    const snap = await getDocs(collection(firebaseDb(), "brands"));
    if (!snap.empty) {
      const remote = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Brand[];
      const byId = new Map(brands.map((b) => [b.id, b]));
      for (const r of remote) byId.set(r.id, { ...byId.get(r.id), ...r } as Brand);
      brands = Array.from(byId.values());
    }
    const invSnap = await getDocs(collection(firebaseDb(), "brandInvites"));
    if (!invSnap.empty) {
      const remote = invSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as BrandInvite[];
      const byId = new Map(invites.map((i) => [i.id, i]));
      for (const r of remote) byId.set(r.id, r);
      invites = Array.from(byId.values());
    }
    emit();
  } catch {
    /* stay local */
  }
}

export function useBrands() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return brands;
}

export function useInvites() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return invites;
}

export function getBrand(id: string) {
  return brands.find((b) => b.id === id);
}

export function verifiedBrands() {
  return brands.filter((b) => b.verified && b.status === "verified");
}

export function ownedBrand(uid: string) {
  if (!uid) return undefined;
  return brands.find((b) => b.ownerId === uid);
}

export function memberBrands(uid: string) {
  if (!uid) return [];
  return brands.filter((b) => b.members.some((m) => m.uid === uid));
}

export function roleOn(brand: Brand, uid: string): MemberRole | null {
  if (!uid) return null;
  return brand.members.find((m) => m.uid === uid)?.role ?? null;
}

export function canPost(brand: Brand, uid: string) {
  return brand.verified && Boolean(roleOn(brand, uid));
}

export function canStudio(brand: Brand, uid: string) {
  return roleOn(brand, uid) === "owner";
}

export function canSeeAnalytics(brand: Brand, uid: string) {
  const role = roleOn(brand, uid);
  if (role === "owner") return true;
  return Boolean(role) && brand.analyticsShared;
}

export function brandListings(id: string) {
  return listedPieces().filter((p) => p.brandId === id);
}

export function themeFor(brand: Brand) {
  return themeOf(brand.themeId, brand.custom);
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
}

export function handleFree(handle: string, exceptId?: string) {
  const h = handle.toLowerCase().replace(/[^a-z0-9]/g, "");
  return !brands.some((b) => b.handle === h && b.id !== exceptId);
}

export async function createBrand(input: {
  name: string;
  handle: string;
  tagline: string;
  story: string;
  vertical: string;
  website: string;
  instagram: string;
  phone: string;
  whatsapp: string;
  legalName: string;
  registrationId: string;
  contactEmail: string;
  country: string;
  logoUri: string;
  ownerId: string;
  ownerName: string;
  ownerPhoto?: string;
}) {
  const handle = input.handle.toLowerCase().replace(/[^a-z0-9]/g, "") || slugify(input.name);
  const brand: Brand = {
    id: `b-${Date.now().toString(36)}`,
    name: input.name.trim(),
    handle,
    tagline: input.tagline.trim(),
    story: input.story.trim(),
    vertical: input.vertical,
    website: input.website.trim(),
    instagram: input.instagram.replace(/^@/, "").trim(),
    phone: input.phone.trim(),
    whatsapp: input.whatsapp.trim(),
    legalName: input.legalName.trim(),
    registrationId: input.registrationId.trim(),
    contactEmail: input.contactEmail.trim(),
    country: input.country,
    logoUri: input.logoUri,
    bannerKind: "image",
    bannerUri: "",
    themeId: "ink",
    status: "draft",
    verified: false,
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    ownerPhoto: input.ownerPhoto,
    analyticsShared: false,
    members: [
      {
        uid: input.ownerId,
        name: input.ownerName,
        photo: input.ownerPhoto,
        role: "owner",
        joinedAt: Date.now(),
      },
    ],
    views: 0,
    likes: 0,
    follows: 0,
    followers: [],
    createdAt: Date.now(),
  };
  brands = [brand, ...brands];
  void persist();
  void pushBrand(brand);
  return brand;
}

export function updateBrand(id: string, patch: Partial<Brand>) {
  brands = brands.map((b) => (b.id === id ? { ...b, ...patch } : b));
  const next = getBrand(id);
  void persist();
  if (next) void pushBrand(next);
  return next;
}

export async function submitForVerification(id: string, filing: BrandFiling) {
  updateBrand(id, { status: "pending" });
  const result = await reviewBrand(filing);
  if (result.ok) {
    updateBrand(id, {
      status: "verified",
      verified: true,
      verifiedAt: Date.now(),
      rejectReasons: [],
      rejectHeadline: "",
    });
  } else {
    updateBrand(id, {
      status: "rejected",
      verified: false,
      rejectReasons: result.reasons,
      rejectHeadline: result.headline,
    });
  }
  return result;
}

export function toggleFollow(id: string, uid: string) {
  const b = getBrand(id);
  if (!b || !uid) return false;
  const had = (b.followers || []).includes(uid);
  const followers = had ? (b.followers || []).filter((x) => x !== uid) : [uid, ...(b.followers || [])];
  updateBrand(id, { followers, follows: followers.length + (b.id.startsWith("b-") ? 0 : Math.max(0, b.follows - (b.followers || []).length)) });
  return !had;
}

export function isFollowing(id: string, uid: string) {
  const b = getBrand(id);
  return Boolean(uid && b?.followers?.includes(uid));
}

export async function findPeople(q: string): Promise<BrandPerson[]> {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const local = DIRECTORY.filter(
    (p) => p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle),
  );
  if (!firebaseReady() || !needle.includes("@")) return local;
  try {
    const snap = await getDocs(query(collection(firebaseDb(), "users"), where("email", "==", q.trim())));
    const remote = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        uid: d.id,
        name: String(data.name || data.email || "Uvel member"),
        email: String(data.email || ""),
        photo: typeof data.photo === "string" ? data.photo : undefined,
      };
    });
    const seen = new Set(remote.map((p) => p.uid));
    return [...remote, ...local.filter((p) => !seen.has(p.uid))];
  } catch {
    return local;
  }
}

export async function sendInvite(input: {
  brandId: string;
  fromUid: string;
  fromName: string;
  person: BrandPerson;
}) {
  const brand = getBrand(input.brandId);
  if (!brand) throw new Error("Brand missing.");
  const exists = invites.some(
    (i) => i.brandId === input.brandId && i.status === "pending" && (i.toUid === input.person.uid || i.toEmail === input.person.email),
  );
  if (exists) return;
  if (brand.members.some((m) => m.uid === input.person.uid)) return;
  const invite: BrandInvite = {
    id: `inv-${Date.now().toString(36)}`,
    brandId: brand.id,
    brandName: brand.name,
    brandLogo: brand.logoUri,
    fromUid: input.fromUid,
    fromName: input.fromName,
    toUid: input.person.uid,
    toEmail: input.person.email,
    toName: input.person.name,
    status: "pending",
    createdAt: Date.now(),
  };
  invites = [invite, ...invites];
  void persist();
  void pushInvite(invite);
  if (firebaseReady()) {
    try {
      const snap = await getDoc(doc(firebaseDb(), "users", input.person.uid));
      const token = snap.exists() ? String((snap.data() as { expoPushToken?: string }).expoPushToken || "") : "";
      if (token) {
        const { sendPush } = await import("./push");
        void sendPush(token, "Brand invite", `${input.fromName} invited you to post on ${brand.name}`, { brandId: brand.id });
      }
    } catch {
      /* ignore */
    }
  }
  return invite;
}

export function pendingInvitesFor(uid: string, email?: string) {
  return invites.filter(
    (i) => i.status === "pending" && (i.toUid === uid || (email && i.toEmail && i.toEmail.toLowerCase() === email.toLowerCase())),
  );
}

export function acceptInvite(id: string, uid: string, name: string, photo?: string) {
  const invite = invites.find((i) => i.id === id);
  if (!invite) return;
  invites = invites.map((i) => (i.id === id ? { ...i, status: "accepted" as const, toUid: uid } : i));
  const brand = getBrand(invite.brandId);
  if (brand && !brand.members.some((m) => m.uid === uid)) {
    updateBrand(brand.id, {
      members: [...brand.members, { uid, name, photo, role: "poster", joinedAt: Date.now() }],
    });
  }
  void persist();
  const next = invites.find((i) => i.id === id);
  if (next) void pushInvite(next);
}

export function declineInvite(id: string) {
  invites = invites.map((i) => (i.id === id ? { ...i, status: "declined" as const } : i));
  void persist();
  const next = invites.find((i) => i.id === id);
  if (next) void pushInvite(next);
}

export function removeMember(brandId: string, uid: string) {
  const brand = getBrand(brandId);
  if (!brand || brand.ownerId === uid) return;
  updateBrand(brandId, { members: brand.members.filter((m) => m.uid !== uid) });
}

export function watchBrand(id: string, cb: (b: Brand | undefined) => void) {
  cb(getBrand(id));
  const l = () => cb(getBrand(id));
  listeners.add(l);
  let unsub: (() => void) | undefined;
  if (firebaseReady()) {
    unsub = onSnapshot(doc(firebaseDb(), "brands", id), (snap) => {
      if (!snap.exists()) return;
      const remote = { id: snap.id, ...(snap.data() as object) } as Brand;
      brands = brands.map((b) => (b.id === id ? { ...b, ...remote } : b));
      cb(getBrand(id));
    });
  }
  return () => {
    listeners.delete(l);
    unsub?.();
  };
}
