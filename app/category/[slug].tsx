import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "../../components/ListingCard";
import { usePersonalization } from "../../lib/personalization";
import { useUvel } from "../../lib/store";
import { getMarket, moneyInMarket } from "../../lib/markets";
import { useColors } from "../../lib/theme";
import { shopFloor, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";

type CategoryPage = { title: string; category?: string; terms?: string[]; heroTitle: string; heroBody: string };
type SortMode = "curated" | "newest" | "price";

const CATEGORY_PAGES: Record<string, CategoryPage> = {
  outerwear: { title: "Outerwear", category: "Outerwear", heroTitle: "Layer up", heroBody: "The pieces that make the whole look feel intentional." },
  shoes: { title: "Shoes", category: "Shoes", heroTitle: "Start from the ground up", heroBody: "Good shoes change the mood of everything around them." },
  dresses: { title: "Dresses", category: "Dresses", heroTitle: "One piece, fully considered", heroBody: "Silhouettes for plans, places, and the in-between." },
  tailoring: { title: "Tailoring", terms: ["blazer", "tailored", "suit", "tuxedo"], heroTitle: "A cleaner line", heroBody: "Quiet structure for when the details need to speak." },
};
const CATEGORY_RAIL = [
  { slug: "outerwear", label: "Outerwear" },
  { slug: "dresses", label: "Dresses" },
  { slug: "shoes", label: "Shoes" },
  { slug: "tailoring", label: "Tailoring" },
];

export default function CategoryListings() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const app = useUvel();
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const personalization = usePersonalization(app.uid || "guest");
  const sync = useMarketplaceSyncState();
  useWardrobe();
  const listRef = useRef<FlatList<ClosetPiece>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>("curated");
  const activeSlug = String(slug || "outerwear").toLowerCase();
  const page = CATEGORY_PAGES[activeSlug] || CATEGORY_PAGES.outerwear;
  const live = shopFloor(app.country);
  const categoryRows = useMemo(() => live.filter((piece) => {
    if (page.category) return piece.category === page.category;
    const searchable = `${piece.name} ${piece.brand} ${piece.category} ${piece.material} ${piece.notes}`.toLowerCase();
    return page.terms?.some((term) => searchable.includes(term)) ?? false;
  }), [live, page]);
  const rows = useMemo(() => {
    const filtered = availableOnly ? categoryRows.filter((piece) => piece.stockQuantity == null || piece.stockQuantity > 0) : categoryRows;
    return [...filtered].sort((a, b) => sort === "price" ? a.listPriceCents - b.listPriceCents : sort === "newest" ? (b.createdAt || 0) - (a.createdAt || 0) : 0);
  }, [availableOnly, categoryRows, sort]);
  const hero = categoryRows[0];
  const curated = categoryRows.slice(0, 4);
  const market = getMarket(app.country);
  const sortLabel = sort === "curated" ? "Curated" : sort === "newest" ? "Newest" : "Price";
  function cycleSort() { setSort((current) => current === "curated" ? "newest" : current === "newest" ? "price" : "curated"); }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false, animation: "slide_from_right" }} />
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(piece) => piece.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 34 }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        snapToOffsets={[0, height * 0.52]}
        snapToAlignment="start"
        decelerationRate="fast"
        ListHeaderComponent={
          <View>
            {hero ? <View style={[styles.heroCard, { height }]}>
              <Image source={{ uri: hero.photo }} style={styles.heroImage} contentFit="contain" />
              <View style={styles.heroShade} />
              <View style={[styles.heroTop, { top: insets.top + 10 }]}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.heroBack} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="arrow-back" size={22} color={colors.bone} /></Pressable>
                <View style={styles.heroHeading}><Text style={styles.heroKicker}>SHOP ANY LISTING</Text><Text style={styles.heroPageTitle}>{page.title}</Text></View>
              </View>
              <Animated.View style={{ opacity: scrollY.interpolate({ inputRange: [0, height * 0.52], outputRange: [1, 0.35], extrapolate: "clamp" }) }}>
              <FlatList
                horizontal
                data={CATEGORY_RAIL}
                keyExtractor={(item) => item.slug}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.heroRail, { top: insets.top + 74 }]}
                renderItem={({ item }) => { const active = item.slug === activeSlug; return <Pressable onPress={() => router.replace({ pathname: "/category/[slug]", params: { slug: item.slug } })} style={[styles.railItem, active && styles.railItemOn]} accessibilityRole="tab" accessibilityState={{ selected: active }}><Text style={[styles.railText, active && styles.railTextOn]}>{item.label}</Text></Pressable>; }}
              />
              </Animated.View>
              <Animated.View style={[styles.heroCopy, { transform: [{ translateY: scrollY.interpolate({ inputRange: [0, height * 0.52], outputRange: [0, -height * 0.08], extrapolate: "clamp" }) }] }]}>
                <Text style={styles.heroTitle}>{page.heroTitle}</Text>
                <Text style={styles.heroBody}>{page.heroBody}</Text>
                <View style={styles.swipeCue}><View style={styles.swipeArrow}><Ionicons name="chevron-up" size={15} color={colors.successInk} /><Ionicons name="chevron-up" size={15} color={colors.successInk} /></View><Text style={styles.swipeText}>Swipe to browse</Text></View>
              </Animated.View>
              <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{hero.brand || "UVEL"}</Text></View>
            </View> : null}
            {curated.length ? <View style={styles.curatedSection}>
              <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>SELECTED FOR YOU</Text><Text style={styles.sectionTitle}>Featured pieces</Text></View><Pressable onPress={() => listRef.current?.scrollToOffset({ offset: height, animated: true })} hitSlop={10}><Text style={styles.seeAll}>See all <Ionicons name="arrow-forward" size={14} color={colors.success} /></Text></Pressable></View>
              <FlatList horizontal data={curated} keyExtractor={(piece) => `curated-${piece.id}`} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.curatedRail} renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: "/closet/[id]", params: { id: item.id } })} style={styles.curatedCard} accessibilityRole="button" accessibilityLabel={`Open ${item.name}`}><Image source={{ uri: item.photo }} style={styles.curatedImage} contentFit="cover" /><View style={styles.curatedMeta}><Text style={styles.curatedBrand} numberOfLines={1}>{item.brand || "UVEL"}</Text><Text style={styles.curatedName} numberOfLines={1}>{item.name}</Text><Text style={styles.curatedPrice}>{moneyInMarket(item.listPriceCents, item.currency || market.currency, market)}</Text></View></Pressable>} />
            </View> : null}
            <View style={styles.catalogHeader}>
              <View><Text style={styles.sectionKicker}>LIVE MARKETPLACE</Text><Text style={styles.sectionTitle}>{availableOnly ? "Available now" : "All listings"}</Text></View>
              <View style={styles.catalogControls}><Pressable onPress={cycleSort} style={styles.control} accessibilityRole="button" accessibilityLabel={`Sort listings by ${sortLabel}`}><Ionicons name="swap-vertical-outline" size={16} color={colors.bone} /><Text style={styles.controlText}>{sortLabel}</Text></Pressable><Pressable onPress={() => setAvailableOnly((value) => !value)} style={[styles.control, availableOnly && styles.controlOn]} accessibilityRole="button" accessibilityState={{ selected: availableOnly }}><Ionicons name="options-outline" size={16} color={availableOnly ? colors.successInk : colors.bone} /><Text style={[styles.controlText, availableOnly && styles.controlTextOn]}>Filter</Text></Pressable></View>
            </View>
          </View>
        }
        renderItem={({ item }) => <View style={styles.cell}><ListingCard piece={item} framed onInteraction={personalization.record} /></View>}
        ListEmptyComponent={sync === "loading" ? <ActivityIndicator color={colors.success} style={styles.empty} /> : <View style={styles.emptyWrap}><Ionicons name="search-outline" size={26} color={colors.subtle} /><Text style={styles.emptyTitle}>Nothing here yet</Text><Text style={styles.empty}>Try another category or come back soon.</Text></View>}
      />
    </View>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { flexGrow: 1, paddingHorizontal: 0 },
    heroCard: { width: "100%", overflow: "hidden", backgroundColor: colors.ink, marginBottom: 24 },
    heroImage: { ...StyleSheet.absoluteFillObject },
    heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.44)" },
    heroTop: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 10 },
    heroBack: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#00000070", alignItems: "center", justifyContent: "center" },
    heroHeading: { flex: 1 },
    heroKicker: { color: colors.success, fontSize: 10, letterSpacing: 1.6, fontWeight: "900" },
    heroPageTitle: { color: colors.bone, fontSize: 28, lineHeight: 32, fontWeight: "900", marginTop: 2 },
    heroRail: { position: "absolute", left: 16, right: 16, gap: 8 },
    railItem: { paddingHorizontal: 13, height: 32, borderRadius: 16, borderWidth: 1, borderColor: "#F4F0E640", backgroundColor: "#00000045", alignItems: "center", justifyContent: "center" },
    railItemOn: { backgroundColor: colors.bone, borderColor: colors.bone },
    railText: { color: colors.bone, fontSize: 11, fontWeight: "800" },
    railTextOn: { color: colors.ink },
    heroCopy: { position: "absolute", left: 22, right: 22, bottom: 28 },
    heroTitle: { color: colors.bone, fontSize: 36, lineHeight: 40, fontWeight: "900", letterSpacing: -0.7 },
    heroBody: { color: "#F4F0E6D9", fontSize: 14, lineHeight: 20, maxWidth: 290, marginTop: 6 },
    swipeCue: { alignSelf: "flex-start", minWidth: 166, height: 44, borderRadius: 22, backgroundColor: colors.success, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 9, marginTop: 16 },
    swipeArrow: { width: 20, height: 25, alignItems: "center", justifyContent: "center", marginTop: -3 },
    swipeText: { color: colors.successInk, fontSize: 13, fontWeight: "900", letterSpacing: 0.1 },
    heroBadge: { position: "absolute", top: 126, right: 16, borderRadius: 14, paddingHorizontal: 10, height: 28, justifyContent: "center", backgroundColor: "#00000080" },
    heroBadgeText: { color: colors.bone, fontSize: 9, letterSpacing: 1.2, fontWeight: "900" },
    curatedSection: { paddingHorizontal: 16, paddingBottom: 22 },
    sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 11 },
    sectionKicker: { color: colors.subtle, fontSize: 10, letterSpacing: 1.5, fontWeight: "900" },
    sectionTitle: { color: colors.bone, fontSize: 23, lineHeight: 27, fontWeight: "900", letterSpacing: -0.4, marginTop: 3 },
    seeAll: { color: colors.success, fontSize: 12, fontWeight: "800", paddingBottom: 3 },
    curatedRail: { gap: 10 },
    curatedCard: { width: 132, borderRadius: 17, backgroundColor: colors.surface, overflow: "hidden" },
    curatedImage: { width: 132, height: 148, backgroundColor: colors.neutral },
    curatedMeta: { padding: 10 },
    curatedBrand: { color: colors.subtle, fontSize: 9, letterSpacing: 1.1, fontWeight: "800" },
    curatedName: { color: colors.bone, fontSize: 12, fontWeight: "700", marginTop: 4 },
    curatedPrice: { color: colors.success, fontSize: 12, fontWeight: "800", marginTop: 6 },
    catalogHeader: { marginHorizontal: 16, borderTopWidth: 1, borderTopColor: `${colors.bone}16`, paddingTop: 18, paddingBottom: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    catalogControls: { flexDirection: "row", gap: 6 },
    control: { height: 32, borderRadius: 16, borderWidth: 1, borderColor: `${colors.bone}20`, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5 },
    controlOn: { backgroundColor: colors.success, borderColor: colors.success },
    controlText: { color: colors.bone, fontSize: 11, fontWeight: "800" },
    controlTextOn: { color: colors.successInk },
    row: { gap: 12, marginBottom: 14, paddingHorizontal: 16 },
    cell: { flex: 1 },
    emptyWrap: { alignItems: "center", paddingTop: 58, paddingHorizontal: 30 },
    emptyTitle: { color: colors.bone, fontSize: 18, fontWeight: "800", marginTop: 12 },
    empty: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center", paddingTop: 6 },
  });
}
