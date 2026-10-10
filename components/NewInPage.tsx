import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "../lib/haptics";
import { CATEGORIES, type Category } from "../lib/catalog";
import { getMarket, moneyInMarket } from "../lib/markets";
import type { BannerStory } from "../lib/todayBannerStories";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";
import { refreshMarketplaceListings, shopFloor, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../lib/wardrobe";
import { OrbitLoader } from "./OrbitLoader";
import { TodayListingOverlay, type ListingOrigin } from "./TodayListingOverlay";

const COLOR_FADE_STRIPS = Array.from({ length: 56 }, (_, index) => Math.pow(index / 55, 1.65));
const MAX_ITEMS_PER_CATEGORY = 10;

type CategorySection = { category: Category; items: ClosetPiece[] };
type PageMode = "new-in" | "deals";

function isAvailable(piece: ClosetPiece) {
  return piece.status === "listed" && !piece.sellerPaused && (piece.stockQuantity === undefined || piece.stockQuantity > 0) && Boolean(piece.photo);
}

export function NewInPage({ story, onClose }: { story: BannerStory; onClose: () => void }) {
  return <CategoryListingsPage story={story} onClose={onClose} mode="new-in" />;
}

export function DealsPage({ story, onClose }: { story: BannerStory; onClose: () => void }) {
  return <CategoryListingsPage story={story} onClose={onClose} mode="deals" />;
}

function CategoryListingsPage({ story, onClose, mode }: { story: BannerStory; onClose: () => void; mode: PageMode }) {
  const app = useUvel();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wardrobe = useWardrobe();
  const marketplaceSync = useMarketplaceSyncState();
  const market = useMemo(() => getMarket(app.country), [app.country]);
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

  const load = useCallback(async (showPullLoader = false) => {
    const currentRequest = ++requestId.current;
    setLoadError("");
    if (showPullLoader) setRefreshing(true);
    try {
      await refreshMarketplaceListings();
    } catch {
      if (currentRequest === requestId.current) setLoadError("New listings couldn’t refresh. Pull down to try again.");
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        if (showPullLoader) setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
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
          void load(true);
        }
      },
    },
  ), [load, pullOffset, refreshing, scrollY]);

  const sections = useMemo<CategorySection[]>(() => {
    const latest = shopFloor(market.code).filter((piece) => isAvailable(piece) && (mode === "new-in" || discounted(piece)));
    latest.sort((a, b) => mode === "new-in"
      ? (b.createdAt || 0) - (a.createdAt || 0)
      : discountPercent(b) - discountPercent(a) || (b.originalPriceCents - b.listPriceCents) - (a.originalPriceCents - a.listPriceCents));
    return CATEGORIES
      .filter((category): category is Category => category !== "All")
      .map((category) => ({ category, items: latest.filter((piece) => piece.category === category).slice(0, MAX_ITEMS_PER_CATEGORY) }))
      .filter((section) => section.items.length > 0);
  }, [market.code, mode, wardrobe]);

  const openListing = useCallback((piece: ClosetPiece, ref: { current: View | null }) => {
    const measure = (callback: (rect: { x: number; y: number; width: number; height: number }) => void) => {
      ref.current?.measureInWindow((x, y, width, height) => callback({ x, y, width, height }));
    };
    measure((rect) => {
      setOpenOrigin({ ...rect, photo: piece.photo, measure });
      setOpenPiece(piece);
    });
  }, []);

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
        <View style={styles.intro}>
          <Text style={[styles.pageTitle, { color: colors.bone }]}>{mode === "deals" ? "Deals" : "New in"}</Text>
          <Text style={[styles.pageSubtitle, { color: colors.muted }]}>{mode === "deals" ? "Price drops from sellers, organized by category." : "Freshly listed pieces, organized by category."}</Text>
        </View>

          {loading && !sections.length ? <LoadingOrbit /> : sections.length ? sections.map((section) => (
          <View key={section.category} style={styles.section}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.bone }]}>{mode === "deals" ? `Deals in ${section.category}` : `New in ${section.category}`}</Text>
                <Text style={[styles.sectionSub, { color: colors.muted }]}>{mode === "deals" ? `${section.items.length} reduced ${section.items.length === 1 ? "price" : "prices"}` : `Latest ${section.items.length} ${section.items.length === 1 ? "listing" : "listings"}`}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {section.items.map((piece) => <NewInCard key={piece.id} piece={piece} market={market} colors={colors} mode={mode} onOpen={openListing} />)}
            </ScrollView>
          </View>
        )) : (
          <View style={[styles.empty, { backgroundColor: colors.surface }]}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>{loadError || (marketplaceSync === "unavailable" ? "New listings couldn’t load from Supabase. Pull down to try again." : mode === "deals" ? "No reduced listings right now. Pull down to check again." : "No new listings yet. Pull down to check again.")}</Text>
          </View>
        )}
      </Animated.ScrollView>

      {refreshing ? <View pointerEvents="none" style={[styles.pullOrbitLayer, { top: insets.top + 64 }]}><OrbitLoader size={58} /></View> : null}
      {openPiece ? <TodayListingOverlay piece={openPiece} origin={openOrigin} onClose={() => setOpenPiece(null)} closeMode="instant" /> : null}
    </View>
  );
}

function discounted(piece: ClosetPiece) {
  return piece.originalPriceCents > piece.listPriceCents && piece.listPriceCents > 0;
}

function discountPercent(piece: ClosetPiece) {
  return piece.originalPriceCents > 0 ? (piece.originalPriceCents - piece.listPriceCents) / piece.originalPriceCents : 0;
}

function NewInCard({ piece, market, colors, mode, onOpen }: { piece: ClosetPiece; market: ReturnType<typeof getMarket>; colors: ReturnType<typeof useColors>; mode: PageMode; onOpen: (piece: ClosetPiece, ref: { current: View | null }) => void }) {
  const ref = useRef<View>(null);
  const was = moneyInMarket(piece.originalPriceCents, piece.currency || market.currency, market);
  const now = moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market);
  const discount = Math.round(discountPercent(piece) * 100);
  return (
    <Pressable ref={ref} onPress={() => onOpen(piece, ref)} style={[styles.card, { backgroundColor: colors.surface }]} accessibilityRole="button" accessibilityLabel={mode === "deals" ? `Open ${piece.name}, was ${was}, now ${now}, save ${discount} percent` : `Open ${piece.name}, ${now}`}>
      <View style={[styles.imageFrame, { backgroundColor: colors.neutral }]}>
        <Image source={{ uri: piece.photo }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" />
      </View>
      <Text style={[styles.brand, { color: colors.muted }]} numberOfLines={1}>{(piece.brand || "Uvel seller").toUpperCase()}</Text>
      <Text style={[styles.name, { color: colors.bone }]} numberOfLines={2}>{piece.name}</Text>
      {mode === "deals" ? (
        <View style={styles.priceRow}>
          <Text style={[styles.wasPrice, { color: colors.muted }]} numberOfLines={1}>{was}</Text>
          <Text style={[styles.priceInRow, { color: colors.success }]} numberOfLines={1}>{now}</Text>
        </View>
      ) : <Text style={[styles.price, { color: colors.bone }]}>{now}</Text>}
    </Pressable>
  );
}

function LoadingOrbit() {
  return <View style={styles.loadingRow}><OrbitLoader size={58} label="Loading listings" caption="Fetching from Supabase" /></View>;
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
  intro: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 8 },
  pageTitle: { fontSize: 27, lineHeight: 32, fontWeight: "900" },
  pageSubtitle: { fontSize: 14, lineHeight: 20, marginTop: 8 },
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
  priceRow: { flexDirection: "row", alignItems: "baseline", paddingHorizontal: 10, gap: 7, marginTop: 8 },
  wasPrice: { fontSize: 11, fontWeight: "600", textDecorationLine: "line-through", flexShrink: 1 },
  priceInRow: { fontSize: 15, lineHeight: 19, fontWeight: "900", flexShrink: 1 },
  empty: { marginHorizontal: 18, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 15, marginTop: 18 },
  emptyText: { flex: 1, fontSize: 12, lineHeight: 18 },
  loadingRow: { height: 210, alignItems: "center", justifyContent: "center" },
});
