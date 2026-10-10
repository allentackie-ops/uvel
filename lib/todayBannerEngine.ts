import type { ClosetPiece } from "./wardrobe";

export type BannerVariant = "float" | "slide" | "explode" | "collage" | "luxury";
export type BannerTemplateId = "trending-now" | "new-in" | "deals" | "accessories" | "quiet-luxury";

export type TodayBannerTemplate = {
  id: BannerTemplateId;
  title: string;
  subtitle: string;
  color: string;
  variant: BannerVariant;
  maxProducts: number;
  select: (pieces: ClosetPiece[]) => ClosetPiece[];
  detailSelect?: (pieces: ClosetPiece[]) => ClosetPiece[];
};

function available(piece: ClosetPiece) {
  return piece.status === "listed" && !piece.sellerPaused && (piece.stockQuantity === undefined || piece.stockQuantity > 0);
}

function normal(piece: ClosetPiece) {
  return available(piece) && !piece.brandId;
}

function hasCutout(piece: ClosetPiece) {
  return Boolean(piece.cutoutPhoto);
}

function newest(a: ClosetPiece, b: ClosetPiece) {
  return (b.createdAt || 0) - (a.createdAt || 0);
}

function trending(a: ClosetPiece, b: ClosetPiece) {
  const bScore = Number(b.views || 0) + Number(b.likedBy?.length || 0) * 8;
  const aScore = Number(a.views || 0) + Number(a.likedBy?.length || 0) * 8;
  return bScore - aScore || newest(a, b);
}

function recentNormal(pieces: ClosetPiece[]) {
  return pieces.filter(normal).sort(newest);
}

function withCutouts(pieces: ClosetPiece[]) {
  return pieces.filter(hasCutout);
}

function category(pieces: ClosetPiece[], categories: ClosetPiece["category"][]) {
  return pieces.filter((piece) => categories.includes(piece.category));
}

function discounted(piece: ClosetPiece) {
  return piece.originalPriceCents > piece.listPriceCents && piece.listPriceCents > 0;
}

export const TODAY_BANNER_TEMPLATES: TodayBannerTemplate[] = [
  {
    id: "trending-now",
    title: "Trending Now",
    subtitle: "The pieces Uvel is watching right now.",
    color: "#F05237",
    variant: "float",
    maxProducts: 4,
    select: (pieces) => withCutouts(pieces.filter(available).sort(trending)).slice(0, 4),
    detailSelect: (pieces) => withCutouts(pieces.filter(available).sort(trending)).slice(0, 40),
  },
  {
    id: "new-in",
    title: "New in",
    subtitle: "Freshly listed pieces, organized by category.",
    color: "#2762C5",
    variant: "slide",
    maxProducts: 4,
    select: (pieces) => withCutouts(recentNormal(pieces)).slice(0, 4),
    detailSelect: (pieces) => withCutouts(recentNormal(pieces)).slice(0, 40),
  },
  {
    id: "deals",
    title: "Early Prime Big Deals",
    subtitle: "Premium pieces, better prices.",
    color: "#A5B98A",
    variant: "explode",
    maxProducts: 4,
    select: (pieces) => withCutouts(pieces.filter((piece) => available(piece) && discounted(piece)).sort((a, b) => (b.originalPriceCents - b.listPriceCents) - (a.originalPriceCents - a.listPriceCents))).slice(0, 4),
  },
  {
    id: "accessories",
    title: "The finishing pieces",
    subtitle: "Bags, shoes, jewelry, and the small decisions that change the whole look.",
    color: "#20A79A",
    variant: "collage",
    maxProducts: 4,
    select: (pieces) => withCutouts(category(pieces.filter(available), ["Shoes", "Bags", "Accessories", "Jewelry", "Watches", "Belts", "Sunglasses", "Scarves", "Hats"])).slice(0, 4),
  },
  {
    id: "quiet-luxury",
    title: "Minimal, with presence",
    subtitle: "One strong piece. A quieter kind of statement.",
    color: "#CFF7C8",
    variant: "luxury",
    maxProducts: 4,
    select: (pieces) => withCutouts(pieces.filter(available).sort((a, b) => (b.views || 0) - (a.views || 0))).slice(0, 4),
  },
];

export type CuratedTodayBanner = TodayBannerTemplate & { pieces: ClosetPiece[]; detailPieces: ClosetPiece[] };

export function curateTodayBanners(pieces: ClosetPiece[]): CuratedTodayBanner[] {
  return TODAY_BANNER_TEMPLATES.map((template) => ({
    ...template,
    pieces: template.select(pieces).slice(0, template.maxProducts),
    detailPieces: (template.detailSelect ? template.detailSelect(pieces) : template.select(pieces)).slice(0, 40),
  }));
}
