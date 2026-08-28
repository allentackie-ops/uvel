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
import { useEffect, useState } from "react";
import { themeOf, type BrandTheme } from "./brandThemes";
import { reviewBrand, type BrandFiling } from "./brandVerify";
import { firebaseDb, firebaseReady } from "./firebase";
import { listedPieces } from "./wardrobe";
import { allOrders } from "./orders";

export type BrandStatus = "draft" | "pending" | "verified" | "rejected";
export type BrandReviewStatus = "not_started" | "review_pending" | "needs_information" | "human_review" | "uvel_reviewed" | "rejected";
export type PayoutStatus = "not_started" | "pending" | "enabled" | "needs_attention" | "unavailable";
export type MemberRole = "owner" | "admin" | "merchandiser" | "marketing" | "support" | "finance" | "viewer" | "poster";

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
  role?: Exclude<MemberRole, "owner">;
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
  /** Uvel marketplace review state; this is not legal registration or trademark clearance. */
  reviewStatus?: BrandReviewStatus;
  /** Payment-provider status, kept separate from Uvel review. */
  payoutStatus?: PayoutStatus;
  verifiedAt?: number;
  rejectReasons?: string[];
  rejectHeadline?: string;
  ownerId: string;
  ownerName: string;
  ownerPhoto?: string;
  analyticsShared: boolean;
  members: BrandMember[];
  /** Compact index used by Firestore read rules for team workspaces. */
  memberIds?: string[];
  /** Team members selected by the owner to receive buyer inquiries. */
  inquiryMemberIds?: string[];
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

export const DIRECTORY: BrandPerson[] = [
  { uid: "demo-ama", name: "Ama Mensah", email: "ama@uvel.app" },
  { uid: "demo-kofi", name: "Kofi Boateng", email: "kofi@uvel.app" },
  { uid: "demo-nana", name: "Nana Adjei", email: "nana@uvel.app" },
  { uid: "demo-lina", name: "Lina Okoye", email: "lina@uvel.app" },
  { uid: "demo-jules", name: "Jules Moreau", email: "jules@uvel.app" },
];

const DEMO_BRAND_IDS = new Set(["maison-found", "archive-1982", "atelier-no4"]);
const DEMO_BRAND_OWNER_IDS = new Set(["house-maison", "house-archive", "house-atelier"]);

let brands: Brand[] = [];
let invites: BrandInvite[] = [];
let brandsHydrated = false;
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

async function persist() {
  emit();
  await AsyncStorage.setItem(KEY, JSON.stringify(brands));
  await AsyncStorage.setItem(INV, JSON.stringify(invites));
}


async function hydrate() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const inv = await AsyncStorage.getItem(INV);
    const saved = raw
      ? (JSON.parse(raw) as Brand[]).filter((b) => !DEMO_BRAND_IDS.has(b.id) && !DEMO_BRAND_OWNER_IDS.has(b.ownerId))
      : [];
    invites = inv ? (JSON.parse(inv) as BrandInvite[]) : [];
    brands = saved;
  } catch {
    brands = [];
  }
  brandsHydrated = true;
  emit();
  void pullRemote();
}
void hydrate();

async function pushBrand(b: Brand) {
  if (!firebaseReady()) return;
  try {
    await setDoc(doc(firebaseDb(), "brands", b.id), { ...b, memberIds: b.members.map((member) => member.uid), updatedAt: serverTimestamp() }, { merge: true });
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
      const remote = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as object) }) as Brand)
        .filter((b) => !DEMO_BRAND_IDS.has(b.id) && !DEMO_BRAND_OWNER_IDS.has(b.ownerId));
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

export function useBrandsHydrated() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return brandsHydrated;
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

export function memberRoleLabel(role: MemberRole) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "merchandiser") return "Merchandiser";
  if (role === "marketing") return "Marketing";
  if (role === "support") return "Customer support";
  if (role === "finance") return "Finance";
  if (role === "viewer") return "Viewer";
  return "Poster";
}

export function canPost(brand: Brand, uid: string) {
  return brand.verified && Boolean(roleOn(brand, uid));
}

export function canAccessHQ(brand: Brand, uid: string) {
  return Boolean(roleOn(brand, uid));
}

export function canManageTeam(brand: Brand, uid: string) {
  const role = roleOn(brand, uid);
  return role === "owner" || role === "admin";
}

export function canManageCatalog(brand: Brand, uid: string) {
  const role = roleOn(brand, uid);
  return role === "owner" || role === "admin" || role === "merchandiser" || role === "poster";
}

export function canEditBrand(brand: Brand, uid: string) {
  const role = roleOn(brand, uid);
  return role === "owner" || role === "admin" || role === "marketing";
}

export function canViewOrders(brand: Brand, uid: string) {
  const role = roleOn(brand, uid);
  return role === "owner" || role === "admin" || role === "support" || role === "finance";
}

export function canManageOrders(brand: Brand, uid: string) {
  const role = roleOn(brand, uid);
  return role === "owner" || role === "admin" || role === "support";
}

export function canViewFinance(brand: Brand, uid: string) {
  const role = roleOn(brand, uid);
  return role === "owner" || role === "admin" || role === "finance";
}

export function canManagePayouts(brand: Brand, uid: string) {
  const role = roleOn(brand, uid);
  return role === "owner" || role === "admin";
}

export function canViewMarketing(brand: Brand, uid: string) {
  const role = roleOn(brand, uid);
  return role === "owner" || role === "admin" || role === "marketing" || role === "viewer";
}

export function canManageMarketing(brand: Brand, uid: string) {
  const role = roleOn(brand, uid);
  return role === "owner" || role === "admin" || role === "marketing";
}

export function canViewAudit(brand: Brand, uid: string) {
  const role = roleOn(brand, uid);
  return role === "owner" || role === "admin" || role === "merchandiser" || role === "support" || role === "finance" || role === "viewer";
}

export function canStudio(brand: Brand, uid: string) {
  return roleOn(brand, uid) === "owner";
}

export function canSeeAnalytics(brand: Brand, uid: string) {
  const role = roleOn(brand, uid);
  if (role === "owner") return true;
  return Boolean(role) && brand.analyticsShared;
}

export function inquiryRecipients(brand: Brand): string[] {
  const memberIds = new Set(brand.members.map((m) => m.uid));
  const selected = (brand.inquiryMemberIds || []).filter((uid) => memberIds.has(uid));
  return selected.length ? selected : [brand.ownerId];
}

export function canManageInquiryRecipients(brand: Brand, uid: string) {
  return brand.ownerId === uid;
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
    reviewStatus: "not_started",
    payoutStatus: "not_started",
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
  updateBrand(id, { status: "pending", reviewStatus: "review_pending", verified: false });
  const result = await reviewBrand(filing);
  if (result.decision === "uvel_reviewed" && result.ok) {
    updateBrand(id, {
      status: "verified",
      verified: true,
      reviewStatus: "uvel_reviewed",
      verifiedAt: Date.now(),
      rejectReasons: [],
      rejectHeadline: "",
    });
  } else if (result.decision === "rejected") {
    updateBrand(id, {
      status: "rejected",
      verified: false,
      reviewStatus: "rejected",
      rejectReasons: result.reasons,
      rejectHeadline: result.headline,
    });
  } else {
    updateBrand(id, {
      status: "pending",
      verified: false,
      reviewStatus: result.decision,
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

export function followedBrandIds(uid: string): string[] {
  if (!uid) return [];
  return brands.filter((b) => (b.followers || []).includes(uid)).map((b) => b.id);
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
  role?: Exclude<MemberRole, "owner">;
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
    role: input.role || "poster",
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
        members: [...brand.members, { uid, name, photo, role: invite.role || "poster", joinedAt: Date.now() }],
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
