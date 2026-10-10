import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "../lib/haptics";
import { OrbitLoader } from "./OrbitLoader";
import { TodayListingOverlay, type ListingOrigin } from "./TodayListingOverlay";
import { CATEGORIES, type Category } from "../lib/catalog";
import { getMarket, moneyInMarket } from "../lib/markets";
import { fetchTrendingScores, type TrendScore } from "../lib/trending";
import type { BannerStory } from "../lib/todayBannerStories";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";
import { refreshMarketplaceListings, shopFloor, useWardrobe, type ClosetPiece } from "../lib/wardrobe";

type RankedPiece = { piece: ClosetPiece; score: TrendScore };
const EMPTY_SCORES: TrendScore[] = [];
const COLOR_FADE_STRIPS = Array.from({ length: 56 }, (_, index) => Math.pow(index / 55, 1.65));

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
  const [windowDays, setWindowDays] = useState(7);
  const [minDwellSeconds, setMinDwellSeconds] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [openPiece, setOpenPiece] = useState<ClosetPiece | null>(null);
  const [openOrigin, setOpenOrigin] = useState<ListingOrigin>({ x: 0, y: 0, width: 0, height: 0 });
  const requestId = useRef(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const pullOffset = useRef(new Animated.Value(0)).current;
  const pullTriggered = useRef(false);
  const wasRefreshing = useRef(false);
  const bannerColor = story.headerColor || story.color;

  const load = useCallback(async (refreshListings: boolean, showPullLoader = false) => {
    const currentRequest = ++requestId.current;
    setLoadError("");
    if (showPullLoader) setRefreshing(true);
    if (refreshListings) await refreshMarketplaceListings().catch(() => undefined);
    try {
      const result = await fetchTrendingScores(market.code);
      if (currentRequest !== requestId.current) return;
      setMarketScores(result.marketScores);
      setWindowDays(result.windowDays);
      setMinDwellSeconds(result.minDwellSeconds);
    } catch {
      if (currentRequest === requestId.current) setLoadError("Trending could not load. Pull down to try again.");
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        if (showPullLoader) setRefreshing(false);
      }
    }
  }, [market.code]);

  useEffect(() => {
    void load(true);
    return () => { requestId.current += 1; };
  }, [load]);

  useEffect(() => {
    if (refreshing) {
      wasRefreshing.current = true;
      Animated.spring(pullOffset, { toValue: 72, damping: 22, stiffness: 180, mass: 0.8, useNativeDriver: true }).start();
    } else if (wasRefreshing.current) {
      wasRefreshing.current = false;
      Animated.timing(pullOffset, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => {
        pullTriggered.current = false;
      });
    }
  }, [pullOffset, refreshing]);

  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (event: { nativeEvent: { contentOffset: { y: number } } }) => {
        const y = event.nativeEvent.contentOffset.y;
        if (pullTriggered.current) return;
        if (y < 0) pullOffset.setValue(Math.min(72, -y));
        else pullOffset.setValue(0);
        if (y <= -60 && !refreshing) {
          pullTriggered.current = true;
          pullOffset.setValue(72);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          void load(true, true);
        }
      },
    },
  ), [load, pullOffset, refreshing, scrollY]);

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
      <View pointerEvents="none" style={styles.bannerColorField}>
        <View style={[styles.bannerColorLayer, { backgroundColor: bannerColor }]} />
        <View style={[styles.bannerColorFade, { height: 340 }]}>
          {COLOR_FADE_STRIPS.map((opacity, index) => <View key={index} style={[styles.bannerColorFadeStrip, { backgroundColor: colors.ink, opacity }]} />)}
        </View>
      </View>

      <View style={[styles.header, { paddingTop: insets.top + 8, height: insets.top + 64 }]}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Back to Today">
          <Ionicons name="arrow-back" size={24} color={colors.bone} />
        </Pressable>
        <Pressable onPress={() => router.push("/search")} style={[styles.headerSearch, { backgroundColor: colors.surface, borderColor: `${colors.bone}35` }]} accessibilityRole="button" accessibilityLabel="Search all clothing">
          <Ionicons name="search-outline" size={20} color={colors.muted} />
          <Text style={[styles.headerSearchText, { color: colors.subtle }]}>Search all clothing</Text>
        </Pressable>
      </View>

      <Animated.ScrollView
        style={{ transform: [{ translateY: pullOffset }] }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 34 }}
        alwaysBounceVertical
        bounces
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.bone }]}>Trending in {market.name}</Text>
              <Text style={[styles.sectionSub, { color: colors.muted }]}>Local listings · last {windowDays} days</Text>
            </View>
          </View>
          {loading && !topTen.length ? <LoadingOrbit /> : topTen.length
            ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {topTen.map((item) => <RankedCard key={item.piece.id} item={item} market={market} colors={colors} onOpen={openListing} />)}
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
                <Text style={[styles.sectionTitle, { color: colors.bone }]}>{section.category}</Text>
                <Text style={[styles.sectionSub, { color: colors.muted }]}>This store · top {section.items.length}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {section.items.map((item) => <RankedCard key={item.piece.id} item={item} market={market} colors={colors} onOpen={openListing} />)}
            </ScrollView>
          </View>
        ))}

      </Animated.ScrollView>

      {refreshing ? <View pointerEvents="none" style={[styles.pullOrbitLayer, { top: insets.top + 64 }]}><OrbitLoader size={58} /></View> : null}
      {openPiece ? <TodayListingOverlay piece={openPiece} origin={openOrigin} onClose={() => setOpenPiece(null)} closeMode="instant" /> : null}
    </View>
  );
}

function RankedCard({ item, market, colors, onOpen }: { item: RankedPiece; market: ReturnType<typeof getMarket>; colors: ReturnType<typeof useColors>; onOpen: (piece: ClosetPiece, ref: { current: View | null }) => void }) {
  const ref = useRef<View>(null);
  const piece = item.piece;
  return <Pressable ref={ref} onPress={() => onOpen(piece, ref)} style={[styles.card, { backgroundColor: colors.surface }]} accessibilityRole="button" accessibilityLabel={`Open ${piece.name}, ${moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}`}>
    <View style={[styles.imageFrame, { backgroundColor: colors.neutral }]}>
      {piece.photo ? <Image source={{ uri: piece.photo }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" /> : null}
    </View>
    <Text style={[styles.brand, { color: colors.muted }]} numberOfLines={1}>{(piece.brand || "Uvel seller").toUpperCase()}</Text>
    <Text style={[styles.name, { color: colors.bone }]} numberOfLines={2}>{piece.name}</Text>
    <Text style={[styles.price, { color: colors.bone }]}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>
  </Pressable>;
}

function LoadingOrbit() {
  return <View style={styles.loadingRow}><OrbitLoader size={58} /></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bannerColorField: { position: "absolute", top: 0, left: 0, right: 0, height: 480, overflow: "hidden" },
  bannerColorLayer: { position: "absolute", top: 0, left: 0, right: 0, height: 480, opacity: 0.24 },
  bannerColorFade: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "column" },
  bannerColorFadeStrip: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10, zIndex: 1 },
  headerButton: { width: 34, height: 42, alignItems: "center", justifyContent: "center" },
  headerSearch: { flex: 1, height: 50, borderRadius: 25, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 9 },
  headerSearchText: { fontSize: 15 },
  pullOrbitLayer: { position: "absolute", left: 0, right: 0, height: 72, alignItems: "center", justifyContent: "center", zIndex: 4 },
  section: { marginTop: 12, marginBottom: 22 },
  sectionHeading: { paddingHorizontal: 18, marginBottom: 12 },
  sectionTitle: { fontSize: 21, lineHeight: 26, fontWeight: "900" },
  sectionSub: { fontSize: 11, marginTop: 3 },
  rail: { paddingHorizontal: 18, gap: 12 },
  card: { width: 164, borderRadius: 12, overflow: "hidden", paddingBottom: 12 },
  imageFrame: { width: 164, height: 178, position: "relative", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  brand: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, paddingHorizontal: 10, marginTop: 9 },
  name: { fontSize: 13, lineHeight: 17, fontWeight: "700", paddingHorizontal: 10, marginTop: 4, minHeight: 34 },
  price: { fontSize: 16, fontWeight: "900", paddingHorizontal: 10, marginTop: 7 },
  empty: { marginHorizontal: 18, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  emptyText: { flex: 1, fontSize: 12, lineHeight: 18 },
  loadingRow: { height: 210, alignItems: "center", justifyContent: "center" },
});
