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
  select: (pieces: ClosetPiece[], trendingListingIds?: string[]) => ClosetPiece[];
  detailSelect?: (pieces: ClosetPiece[], trendingListingIds?: string[]) => ClosetPiece[];
};

function available(piece: ClosetPiece) {
  return piece.status === "listed" && !piece.sellerPaused && (piece.stockQuantity === undefined || piece.stockQuantity > 0);
}

function hasPhoto(piece: ClosetPiece) {
  return Boolean(piece.photo || piece.photos?.[0]);
}

function newest(a: ClosetPiece, b: ClosetPiece) {
  return (b.createdAt || 0) - (a.createdAt || 0);
}

function newestAvailable(pieces: ClosetPiece[]) {
  return pieces.filter((piece) => available(piece) && hasPhoto(piece)).sort(newest);
}

function category(pieces: ClosetPiece[], categories: ClosetPiece["category"][]) {
  return pieces.filter((piece) => categories.includes(piece.category));
}

function discounted(piece: ClosetPiece) {
  return piece.originalPriceCents > piece.listPriceCents && piece.listPriceCents > 0;
}

const EVERYDAY_CATEGORIES: ClosetPiece["category"][] = ["Tops", "Trousers", "Shoes", "Knitwear", "Outerwear", "Hats", "Hair", "Sunglasses", "Bags", "Watches", "Jewelry", "Belts", "Socks", "Accessories"];
const STATEMENT_STYLE = /\b(statement|sculptural|ornate|embellished|embroidered|sequined|sequin|rhinestone|beaded|crystal|fringe|studded|graphic|printed|patterned|novelty|oversized logo)\b/i;

export function isEverydayEssential(piece: ClosetPiece) {
  return EVERYDAY_CATEGORIES.includes(piece.category) && !STATEMENT_STYLE.test(piece.name);
}

export const TODAY_BANNER_TEMPLATES: TodayBannerTemplate[] = [
  {
    id: "trending-now",
    title: "Trending Now",
    subtitle: "The pieces Uvel is watching right now.",
    color: "#F05237",
    variant: "float",
    maxProducts: 4,
    select: (pieces, trendingListingIds = []) => {
      const candidates = new Map(newestAvailable(pieces).map((piece) => [piece.id, piece]));
      return trendingListingIds.flatMap((id) => {
        const piece = candidates.get(id);
        return piece ? [piece] : [];
      }).slice(0, 4);
    },
    detailSelect: (pieces, trendingListingIds = []) => {
      const candidates = new Map(newestAvailable(pieces).map((piece) => [piece.id, piece]));
      return trendingListingIds.flatMap((id) => {
        const piece = candidates.get(id);
        return piece ? [piece] : [];
      }).slice(0, 40);
    },
  },
  {
    id: "new-in",
    title: "New in",
    subtitle: "Freshly listed pieces, organized by category.",
    color: "#2762C5",
    variant: "slide",
    maxProducts: 4,
    select: (pieces) => newestAvailable(pieces).slice(0, 4),
    detailSelect: (pieces) => newestAvailable(pieces).slice(0, 40),
  },
  {
    id: "deals",
    title: "Early Prime Big Deals",
    subtitle: "Real price drops, organized by category.",
    color: "#A5B98A",
    variant: "explode",
    maxProducts: 4,
    select: (pieces) => newestAvailable(pieces.filter(discounted)).sort((a, b) => (b.originalPriceCents - b.listPriceCents) - (a.originalPriceCents - a.listPriceCents)).slice(0, 4),
  },
  {
    id: "accessories",
    title: "The finishing pieces",
    subtitle: "Bags, shoes, jewelry, and the small decisions that change the whole look.",
    color: "#20A79A",
    variant: "collage",
    maxProducts: 4,
    select: (pieces) => newestAvailable(category(pieces, ["Shoes", "Bags", "Accessories", "Jewelry", "Watches", "Belts", "Sunglasses", "Scarves", "Hats"])).slice(0, 4),
  },
  {
    id: "quiet-luxury",
    title: "Minimal, with presence",
    subtitle: "One strong piece. A quieter kind of statement.",
    color: "#CFF7C8",
    variant: "luxury",
    maxProducts: 4,
    select: (pieces) => newestAvailable(pieces.filter(isEverydayEssential)).slice(0, 4),
  },
];

export type CuratedTodayBanner = TodayBannerTemplate & { pieces: ClosetPiece[]; detailPieces: ClosetPiece[] };

export function curateTodayBanners(pieces: ClosetPiece[], trendingListingIds: string[] = []): CuratedTodayBanner[] {
  return TODAY_BANNER_TEMPLATES.map((template) => ({
    ...template,
    pieces: template.select(pieces, trendingListingIds).slice(0, template.maxProducts),
    detailPieces: (template.detailSelect ? template.detailSelect(pieces, trendingListingIds) : template.select(pieces, trendingListingIds)).slice(0, 40),
  }));
}
