import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TodayListingOverlay, type ListingOrigin } from "./TodayListingOverlay";
import { CATEGORIES, type Category } from "../lib/catalog";
import { getMarket, moneyInMarket } from "../lib/markets";
import { fetchTrendingScores, type TrendScore, type TrendingBrandItem } from "../lib/trending";
import type { BannerStory } from "../lib/todayBannerStories";
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

export function TrendingNowPage({ story, onClose }: { story: BannerStory; onClose: () => void }) {
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
  const bannerColor = story.headerColor || story.color;

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
      if (currentRequest === requestId.current) setLoadError("Trending could not load. Pull down to try again.");
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

  const emptyMessage = `No listings are trending in ${market.name} yet. Open, share, or copy a listing to help it rise.`;

  return (
    <View style={[styles.root, { backgroundColor: colors.ink }]}>
      <LinearGradient
        colors={[bannerColor, `${bannerColor}AA`, colors.ink]}
        locations={[0, 0.34, 1]}
        style={styles.bannerGradient}
        pointerEvents="none"
      />
      <View style={[styles.header, { paddingTop: insets.top + 8, height: insets.top + 64 }]}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Back to Today">
          <Ionicons name="arrow-back" size={24} color={colors.bone} />
        </Pressable>
        <View style={styles.headerSearch}>
          <Ionicons name="search-outline" size={20} color="#111111" />
          <Text style={styles.headerSearchText}>Search Uvel</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.bone} colors={[colors.bone]} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 34 }}
      >
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.bone }]}>Trending in {market.name}</Text>
              <Text style={[styles.sectionSub, { color: colors.muted }]}>Top 10 · local listings · last {windowDays} days</Text>
            </View>
          </View>
          {loading && !topTen.length ? <LoadingRow colors={colors} /> : topTen.length
            ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {topTen.map((item, index) => <RankedCard key={item.piece.id} item={item} rank={index + 1} market={market} colors={colors} onOpen={openListing} />)}
            </ScrollView>
            : <View style={[styles.empty, { backgroundColor: colors.surface }]}>
              <Ionicons name="trending-up-outline" size={20} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>{loadError || emptyMessage} Activity counts when a shopper stays for {minDwellSeconds}+ seconds or shares a link.</Text>
            </View>}
        </View>

        {categorySections.map((section) => (
          <View key={section.category} style={styles.section}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.bone }]}>{section.category} trending in {market.name}</Text>
                <Text style={[styles.sectionSub, { color: colors.muted }]}>This store · top {section.items.length}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {section.items.map((item, index) => <RankedCard key={item.piece.id} item={item} rank={index + 1} market={market} colors={colors} onOpen={openListing} />)}
            </ScrollView>
          </View>
        ))}

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.bone }]}>Trending brand pieces</Text>
              <Text style={[styles.sectionSub, { color: colors.muted }]}>Across stores · available in {market.name}</Text>
            </View>
          </View>
          {rankedBrandItems.length
            ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {rankedBrandItems.map((item, index) => <BrandRankedCard key={item.piece.id} item={item} rank={index + 1} market={market} colors={colors} onOpen={openListing} />)}
            </ScrollView>
            : <View style={[styles.empty, { backgroundColor: colors.surface }]}>
              <Ionicons name="globe-outline" size={20} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>Newly published brand pieces that ship to {market.name} will appear here when shoppers engage with them.</Text>
            </View>}
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
  </Pressable>;
}

function LoadingRow({ colors }: { colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.empty, { backgroundColor: colors.surface }]}><Text style={[styles.emptyText, { color: colors.muted }]}>Loading this store’s live trends…</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  bannerGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 370 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10, zIndex: 1 },
  headerButton: { width: 34, height: 42, alignItems: "center", justifyContent: "center" },
  headerSearch: { flex: 1, height: 40, borderRadius: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 8, backgroundColor: "#FFFFFF" },
  headerSearchText: { fontSize: 13, color: "#111111" },
  section: { marginTop: 12, marginBottom: 22 },
  sectionHeading: { paddingHorizontal: 18, marginBottom: 12 },
  sectionTitle: { fontSize: 21, lineHeight: 26, fontWeight: "900" },
  sectionSub: { fontSize: 11, marginTop: 3 },
  rail: { paddingHorizontal: 18, gap: 12 },
  card: { width: 164, borderRadius: 12, overflow: "hidden", paddingBottom: 12 },
  imageFrame: { width: 164, height: 178, position: "relative", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  rankPill: { position: "absolute", top: 9, left: 9, height: 27, minWidth: 36, borderRadius: 14, backgroundColor: "#F5F6FA", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  rankText: { color: "#111111", fontSize: 11, fontWeight: "900" },
  brand: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, paddingHorizontal: 10, marginTop: 9 },
  name: { fontSize: 13, lineHeight: 17, fontWeight: "700", paddingHorizontal: 10, marginTop: 4, minHeight: 34 },
  price: { fontSize: 16, fontWeight: "900", paddingHorizontal: 10, marginTop: 7 },
  empty: { marginHorizontal: 18, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  emptyText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
