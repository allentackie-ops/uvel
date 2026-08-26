import type { BrandCampaign, BrandCollection, BrandPromotion } from "./marketing";
import type { Order } from "./orders";
import type { ClosetPiece } from "./wardrobe";

export type ProductGrowthInsight = {
  id: string;
  name: string;
  photo: string;
  views: number;
  likes: number;
  sold: number;
  available: number;
  returnRate: number;
  conversion: number;
};

export type MarketGrowthInsight = {
  country: string;
  currency: string;
  orders: number;
  sold: number;
  grossCents: number;
  netCents: number;
};

export type GrowthRecommendation = {
  id: string;
  title: string;
  detail: string;
  tone: "accent" | "neutral" | "warning";
};

export type GrowthSnapshot = {
  currency: string;
  grossCents: number;
  feeCents: number;
  refundCents: number;
  netCents: number;
  paidOrders: number;
  soldUnits: number;
  returningBuyers: number;
  conversion: number;
  averageOrderValueCents: number;
  liveListings: number;
  totalAvailableUnits: number;
  lowStockListings: number;
  returnRate: number;
  products: ProductGrowthInsight[];
  markets: MarketGrowthInsight[];
  recommendations: GrowthRecommendation[];
  campaignCount: number;
  liveCampaignCount: number;
  activePromotionCount: number;
};

function successful(order: Order) {
  return order.status === "paid" && !["canceled", "returned"].includes(order.fulfillmentStatus || "");
}

function percent(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

export function buildGrowthSnapshot(brandId: string, orders: Order[], pieces: ClosetPiece[], currency: string, collections: BrandCollection[] = [], campaigns: BrandCampaign[] = [], promotions: BrandPromotion[] = []): GrowthSnapshot {
  const brandOrders = orders.filter((order) => order.brandId === brandId && order.currency === currency);
  const paid = brandOrders.filter((order) => order.status === "paid");
  const completed = paid.filter(successful);
  const grossCents = paid.reduce((sum, order) => sum + Math.max(0, (order.itemCents || 0) - (order.discountCents || 0)), 0);
  const feeCents = paid.reduce((sum, order) => sum + Math.max(0, order.feeCents || 0), 0);
  const refundCents = paid.reduce((sum, order) => sum + Math.max(0, order.refundAmountCents || 0), 0);
  const netCents = Math.max(0, grossCents - feeCents - refundCents);
  const uniqueBuyers = new Set(paid.map((order) => order.buyerId).filter(Boolean));
  const buyerCounts = new Map<string, number>();
  paid.forEach((order) => buyerCounts.set(order.buyerId, (buyerCounts.get(order.buyerId) || 0) + 1));
  const returningBuyers = Array.from(buyerCounts.values()).filter((count) => count > 1).length;
  const livePieces = pieces.filter((piece) => piece.brandId === brandId && piece.status === "listed");
  const byProduct = new Map<string, { sold: number; refunds: number }>();
  paid.forEach((order) => {
    const row = byProduct.get(order.pieceId) || { sold: 0, refunds: 0 };
    row.sold += successful(order) ? 1 : 0;
    row.refunds += order.refundAmountCents ? 1 : 0;
    byProduct.set(order.pieceId, row);
  });
  const products = livePieces.map((piece) => {
    const orderStats = byProduct.get(piece.id) || { sold: 0, refunds: 0 };
    const views = Math.max(0, piece.views || 0);
    const likes = piece.likedBy?.length || 0;
    const available = Math.max(0, piece.stockQuantity || 0);
    return { id: piece.id, name: piece.name, photo: piece.photo, views, likes, sold: orderStats.sold, available, returnRate: percent(orderStats.refunds, Math.max(1, orderStats.sold)), conversion: percent(orderStats.sold, Math.max(1, views)) };
  }).sort((a, b) => (b.sold * 1000 + b.views) - (a.sold * 1000 + a.views));
  const marketMap = new Map<string, MarketGrowthInsight>();
  paid.forEach((order) => {
    const key = `${order.country || "Unknown"}:${order.currency}`;
    const row = marketMap.get(key) || { country: order.country || "Unknown", currency: order.currency, orders: 0, sold: 0, grossCents: 0, netCents: 0 };
    row.orders += 1;
    row.sold += successful(order) ? 1 : 0;
    const paidItemCents = Math.max(0, (order.itemCents || 0) - (order.discountCents || 0));
    row.grossCents += paidItemCents;
    row.netCents += successful(order) ? Math.max(0, paidItemCents - (order.feeCents || 0) - (order.refundAmountCents || 0)) : 0;
    marketMap.set(key, row);
  });
  const totalAvailableUnits = livePieces.reduce((sum, piece) => sum + Math.max(0, piece.stockQuantity || 0), 0);
  const lowStockListings = livePieces.filter((piece) => typeof piece.stockQuantity === "number" && piece.stockQuantity > 0 && piece.stockQuantity <= 10).length;
  const recommendations: GrowthRecommendation[] = [];
  const lowStockWinner = products.find((product) => product.available > 0 && product.available <= 10 && product.sold > 0);
  if (lowStockWinner) recommendations.push({ id: "restock-winner", title: `Restock ${lowStockWinner.name}`, detail: `${lowStockWinner.sold} sold with only ${lowStockWinner.available} available.`, tone: "accent" });
  const highInterest = products.find((product) => product.views >= 10 && product.sold === 0);
  if (highInterest) recommendations.push({ id: "feature-interest", title: `Merchandise ${highInterest.name}`, detail: `${highInterest.views} views but no recorded sale yet. Try a featured placement or clearer product story.`, tone: "neutral" });
  const highReturns = products.find((product) => product.sold > 1 && product.returnRate >= 20);
  if (highReturns) recommendations.push({ id: "review-returns", title: `Review ${highReturns.name}`, detail: `${highReturns.returnRate}% of its completed sales have a refund record.`, tone: "warning" });
  if (!livePieces.length) recommendations.push({ id: "publish-catalog", title: "Publish a first product", detail: "Your brand has no live listings to convert discovery into orders.", tone: "warning" });
  if (!recommendations.length) recommendations.push({ id: "keep-learning", title: "Keep learning from the floor", detail: "More product views, orders, and campaign activity will unlock sharper recommendations.", tone: "neutral" });
  const liveCampaignCount = campaigns.filter((item) => item.status === "live").length;
  return { currency, grossCents, feeCents, refundCents, netCents, paidOrders: paid.length, soldUnits: completed.length, returningBuyers, conversion: percent(completed.length, uniqueBuyers.size), averageOrderValueCents: paid.length ? Math.round(grossCents / paid.length) : 0, liveListings: livePieces.length, totalAvailableUnits, lowStockListings, returnRate: percent(paid.filter((order) => Boolean(order.refundAmountCents)).length, Math.max(1, completed.length)), products, markets: Array.from(marketMap.values()).sort((a, b) => b.netCents - a.netCents), recommendations, campaignCount: campaigns.length + collections.length, liveCampaignCount, activePromotionCount: promotions.filter((item) => item.status === "live").length };
}
