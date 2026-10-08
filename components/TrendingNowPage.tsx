import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TodayListingOverlay, type ListingOrigin } from "./TodayListingOverlay";
import { CATEGORIES, type Category } from "../lib/catalog";
import { getMarket, moneyInMarket } from "../lib/markets";
import { fetchTrendingScores, type TrendScore, type TrendingBrandItem } from "../lib/trending";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";
import { refreshMarketplaceListings, shopFloor, useWardrobe, type ClosetPiece } from "../lib/wardrobe";
import { listingVisibleIn } from "../lib/ships";

type RankedPiece = { piece: ClosetPiece; score: TrendScore };
const EMPTY_SCORES: TrendScore[] = [];

function rankPieces(pieces: ClosetPiece[], scores: TrendScore[]): RankedPiece[] {
  const byId = new Map(scores.map((score) => [score.listingId, score]));
  return pieces
    .flatMap((piece) => {
      const score = byId.get(piece.id);
      return score && score.score > 0 ? [{ piece, score }] : [];
    })
    .sort((a, b) => b.score.score - a.score.score || b.piece.createdAt - a.piece.createdAt);
}

export function TrendingNowPage({ onClose }: { onClose: () => void }) {
  const app = useUvel();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wardrobe = useWardrobe();
  const market = useMemo(() => getMarket(app.country), [app.country]);
  const [marketScores, setMarketScores] = useState<TrendScore[]>(EMPTY_SCORES);
  const [brandItems, setBrandItems] = useState<TrendingBrandItem[]>([]);
  const [windowDays, setWindowDays] = useState(7);
  const [minDwellSeconds, setMinDwellSeconds] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [openPiece, setOpenPiece] = useState<ClosetPiece | null>(null);
  const [openOrigin, setOpenOrigin] = useState<ListingOrigin>({ x: 0, y: 0, width: 0, height: 0 });
  const requestId = useRef(0);

  const load = useCallback(async (refreshListings: boolean) => {
    const currentRequest = ++requestId.current;
    setLoadError("");
    setRefreshing(true);
    if (refreshListings) await refreshMarketplaceListings().catch(() => undefined);
    try {
      const result = await fetchTrendingScores(market.code);
      if (currentRequest !== requestId.current) return;
      setMarketScores(result.marketScores);
      setBrandItems(result.brandItems);
      setWindowDays(result.windowDays);
      setMinDwellSeconds(result.minDwellSeconds);
    } catch {
      if (currentRequest === requestId.current) setLoadError("Trending signals couldn’t be loaded. Pull down to try again.");
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [market.code]);

  useEffect(() => {
    void load(true);
    return () => { requestId.current += 1; };
  }, [load]);

  const localPieces = useMemo(() => shopFloor(market.code).filter((piece) =>
    !piece.brandId && (piece.country || "").toUpperCase() === market.code,
  ), [market.code, wardrobe]);
  const rankedLocal = useMemo(() => rankPieces(localPieces, marketScores), [localPieces, marketScores]);
  const topTen = useMemo(() => rankedLocal.slice(0, 10), [rankedLocal]);
  const categorySections = useMemo(() => CATEGORIES
    .filter((category): category is Category => category !== "All")
    .map((category) => ({
      category,
      items: rankedLocal.filter(({ piece }) => piece.category === category).slice(0, 10),
    }))
    .filter((section) => section.items.length > 0), [rankedLocal]);
  const rankedBrandItems = useMemo(() => brandItems
    .filter(({ piece }) => piece.brandId && listingVisibleIn({ origin: piece.country, shipsTo: piece.shipsTo, buyer: market.code }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10), [brandItems, market.code]);

  const openListing = useCallback((piece: ClosetPiece, ref: { current: View | null }) => {
    const measure = (callback: (rect: { x: number; y: number; width: number; height: number }) => void) => {
      ref.current?.measureInWindow((x, y, width, height) => callback({ x, y, width, height }));
    };
    measure((rect) => {
      setOpenOrigin({ ...rect, photo: piece.photo, measure });
      setOpenPiece(piece);
    });
  }, []);

  const emptyMessage = `Items rise into the top 10 when shoppers in ${market.name} open a listing for ${minDwellSeconds}+ seconds, share it, or copy its link. Only activity from the last ${windowDays} days counts.`;

  return (
    <View style={[styles.root, { backgroundColor: colors.ink }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: `${colors.bone}18` }]}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to Today">
          <Ionicons name="arrow-back" size={23} color={colors.bone} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>TODAY · {market.name.toUpperCase()}</Text>
          <Text style={[styles.headerTitle, { color: colors.bone }]}>Trending now</Text>
        </View>
        <Pressable onPress={() => void load(true)} hitSlop={12} style={styles.refreshButton} accessibilityRole="button" accessibilityLabel="Refresh trends">
          <Ionicons name="refresh" size={18} color={colors.bone} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.bone} colors={[colors.bone]} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 34 }}
      >
        <View style={styles.intro}>
          <Text style={[styles.title, { color: colors.bone }]}>What’s moving in {market.name}</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Live, store-specific rankings from real listing opens and shares.</Text>
        </View>

        {loadError ? <View style={[styles.notice, { backgroundColor: colors.surface }]}><Text style={[styles.noticeText, { color: colors.muted }]}>{loadError}</Text></View> : null}

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View><Text style={[styles.sectionTitle, { color: colors.bone }]}>Trending in {market.name}</Text><Text style={[styles.sectionSub, { color: colors.muted }]}>Top 10 · local listings · last {windowDays} days</Text></View>
            <Text style={[styles.sectionIndex, { color: colors.muted }]}>01</Text>
          </View>
          {loading && !topTen.length ? <LoadingRow colors={colors} /> : topTen.length
            ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {topTen.map((item, index) => <RankedCard key={item.piece.id} item={item} rank={index + 1} market={market} colors={colors} onOpen={openListing} />)}
            </ScrollView>
            : <View style={[styles.empty, { backgroundColor: colors.surface }]}><Ionicons name="trending-up-outline" size={20} color={colors.muted} /><Text style={[styles.emptyText, { color: colors.muted }]}>{loadError || emptyMessage}</Text></View>}
        </View>

        {categorySections.map((section, sectionIndex) => (
          <View key={section.category} style={styles.section}>
            <View style={styles.sectionHeading}>
              <View><Text style={[styles.sectionTitle, { color: colors.bone }]}>{section.category} trending in {market.name}</Text><Text style={[styles.sectionSub, { color: colors.muted }]}>Top {section.items.length} · this store</Text></View>
              <Text style={[styles.sectionIndex, { color: colors.muted }]}>{String(sectionIndex + 2).padStart(2, "0")}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {section.items.map((item, index) => <RankedCard key={item.piece.id} item={item} rank={index + 1} market={market} colors={colors} onOpen={openListing} />)}
            </ScrollView>
          </View>
        ))}

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View><Text style={[styles.sectionTitle, { color: colors.bone }]}>Trending brand pieces</Text><Text style={[styles.sectionSub, { color: colors.muted }]}>Cross-country interest · available in {market.name}</Text></View>
            <Text style={[styles.sectionIndex, { color: colors.muted }]}>{String(categorySections.length + 2).padStart(2, "0")}</Text>
          </View>
          {rankedBrandItems.length
            ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {rankedBrandItems.map((item, index) => <BrandRankedCard key={item.piece.id} item={item} rank={index + 1} market={market} colors={colors} onOpen={openListing} />)}
            </ScrollView>
            : <View style={[styles.empty, { backgroundColor: colors.surface }]}><Ionicons name="globe-outline" size={20} color={colors.muted} /><Text style={[styles.emptyText, { color: colors.muted }]}>Newly published brand products that ship to {market.name} will appear here after they attract trend activity across stores.</Text></View>}
        </View>
      </ScrollView>

      {openPiece ? <TodayListingOverlay piece={openPiece} origin={openOrigin} onClose={() => setOpenPiece(null)} closeMode="instant" /> : null}
    </View>
  );
}

function RankedCard({ item, rank, market, colors, onOpen }: { item: RankedPiece; rank: number; market: ReturnType<typeof getMarket>; colors: ReturnType<typeof useColors>; onOpen: (piece: ClosetPiece, ref: { current: View | null }) => void }) {
  const ref = useRef<View>(null);
  const piece = item.piece;
  return <Pressable ref={ref} onPress={() => onOpen(piece, ref)} style={[styles.card, { backgroundColor: colors.surface }]} accessibilityRole="button" accessibilityLabel={`Rank ${rank}, ${piece.name}, ${moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}`}>
    <View style={[styles.imageFrame, { backgroundColor: colors.neutral }]}>
      {piece.photo ? <Image source={{ uri: piece.photo }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" /> : null}
      <View style={styles.rankPill}><Text style={styles.rankText}>#{rank}</Text></View>
    </View>
    <Text style={[styles.brand, { color: colors.muted }]} numberOfLines={1}>{(piece.brand || "Uvel seller").toUpperCase()}</Text>
    <Text style={[styles.name, { color: colors.bone }]} numberOfLines={2}>{piece.name}</Text>
    <Text style={[styles.price, { color: colors.bone }]}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>
    <Text style={[styles.score, { color: colors.muted }]}>{item.score.score} trend points</Text>
  </Pressable>;
}

function BrandRankedCard({ item, rank, market, colors, onOpen }: { item: TrendingBrandItem; rank: number; market: ReturnType<typeof getMarket>; colors: ReturnType<typeof useColors>; onOpen: (piece: ClosetPiece, ref: { current: View | null }) => void }) {
  const ref = useRef<View>(null);
  const piece = item.piece;
  return <Pressable ref={ref} onPress={() => onOpen(piece, ref)} style={[styles.card, { backgroundColor: colors.surface }]} accessibilityRole="button" accessibilityLabel={`Rank ${rank}, ${piece.brand}, ${piece.name}`}>
    <View style={[styles.imageFrame, { backgroundColor: colors.neutral }]}>
      {piece.photo ? <Image source={{ uri: piece.photo }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" /> : null}
      <View style={styles.rankPill}><Text style={styles.rankText}>#{rank}</Text></View>
    </View>
    <Text style={[styles.brand, { color: colors.muted }]} numberOfLines={1}>{(piece.brand || "Brand").toUpperCase()}</Text>
    <Text style={[styles.name, { color: colors.bone }]} numberOfLines={2}>{piece.name}</Text>
    <Text style={[styles.price, { color: colors.bone }]}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>
    <Text style={[styles.score, { color: colors.muted }]}>{item.score} cross-store points</Text>
  </Pressable>;
}

function LoadingRow({ colors }: { colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.empty, { backgroundColor: colors.surface }]}><Text style={[styles.emptyText, { color: colors.muted }]}>Loading this store’s live trend signals…</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 66, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 38, height: 42, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, justifyContent: "center" },
  eyebrow: { fontSize: 9, letterSpacing: 1.25, fontWeight: "800" },
  headerTitle: { fontSize: 16, fontWeight: "800", marginTop: 2 },
  refreshButton: { width: 38, height: 42, alignItems: "center", justifyContent: "center" },
  intro: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 18 },
  title: { fontSize: 28, lineHeight: 33, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 7 },
  section: { marginTop: 10, marginBottom: 23 },
  sectionHeading: { paddingHorizontal: 20, marginBottom: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: "900" },
  sectionSub: { fontSize: 11, marginTop: 3 },
  sectionIndex: { fontSize: 11, letterSpacing: 1, fontWeight: "800", paddingBottom: 2 },
  rail: { paddingHorizontal: 20, gap: 12 },
  card: { width: 164, borderRadius: 11, overflow: "hidden", paddingBottom: 11 },
  imageFrame: { width: 164, height: 178, position: "relative", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  rankPill: { position: "absolute", top: 9, left: 9, height: 27, minWidth: 36, borderRadius: 14, backgroundColor: "#F5F6FA", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  rankText: { color: "#111111", fontSize: 11, fontWeight: "900" },
  brand: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, paddingHorizontal: 10, marginTop: 9 },
  name: { fontSize: 13, lineHeight: 17, fontWeight: "700", paddingHorizontal: 10, marginTop: 4, minHeight: 34 },
  price: { fontSize: 16, fontWeight: "900", paddingHorizontal: 10, marginTop: 7 },
  score: { fontSize: 10, paddingHorizontal: 10, marginTop: 3 },
  empty: { marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  emptyText: { flex: 1, fontSize: 12, lineHeight: 18 },
  notice: { marginHorizontal: 20, borderRadius: 10, padding: 12, marginBottom: 8 },
  noticeText: { fontSize: 12, lineHeight: 18 },
});
