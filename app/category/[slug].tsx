import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "../../components/ListingCard";
import { usePersonalization } from "../../lib/personalization";
import { useUvel } from "../../lib/store";
import { getMarket, moneyInMarket } from "../../lib/markets";
import { useColors } from "../../lib/theme";
import { shopFloor, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";

type CategoryPage = {
  title: string;
  category?: string;
  terms?: string[];
  eyebrow: string;
  heroTitle: string;
  heroBody: string;
};

type SortMode = "curated" | "newest" | "price";

const CATEGORY_PAGES: Record<string, CategoryPage> = {
  outerwear: { title: "Outerwear", category: "Outerwear", eyebrow: "THE LAYERING EDIT", heroTitle: "Layer up", heroBody: "The pieces that make the whole look feel intentional." },
  shoes: { title: "Shoes", category: "Shoes", eyebrow: "THE EVERYDAY EDIT", heroTitle: "Start from the ground up", heroBody: "Good shoes change the mood of everything around them." },
  dresses: { title: "Dresses", category: "Dresses", eyebrow: "THE OCCASION EDIT", heroTitle: "One piece, fully considered", heroBody: "Silhouettes for plans, places, and the in-between." },
  tailoring: { title: "Tailoring", terms: ["blazer", "tailored", "suit", "tuxedo"], eyebrow: "THE SHARP EDIT", heroTitle: "A cleaner line", heroBody: "Quiet structure for when the details need to speak." },
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
  const app = useUvel();
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const personalization = usePersonalization(app.uid || "guest");
  const sync = useMarketplaceSyncState();
  useWardrobe();
  const listRef = useRef<FlatList<ClosetPiece>>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>("curated");

  const page = CATEGORY_PAGES[String(slug || "").toLowerCase()] || CATEGORY_PAGES.outerwear;
  const live = shopFloor(app.country);
  const categoryRows = useMemo(() => live.filter((piece) => {
    if (page.category) return piece.category === page.category;
    const searchable = `${piece.name} ${piece.brand} ${piece.category} ${piece.material} ${piece.notes}`.toLowerCase();
    return page.terms?.some((term) => searchable.includes(term)) ?? false;
  }), [live, page]);
  const rows = useMemo(() => {
    const filtered = availableOnly ? categoryRows.filter((piece) => piece.stockQuantity == null || piece.stockQuantity > 0) : categoryRows;
    return [...filtered].sort((a, b) => {
      if (sort === "price") return a.listPriceCents - b.listPriceCents;
      if (sort === "newest") return (b.createdAt || 0) - (a.createdAt || 0);
      return 0;
    });
  }, [availableOnly, categoryRows, sort]);
  const hero = categoryRows[0];
  const curated = categoryRows.slice(0, 4);
  const market = getMarket(app.country);
  const sortLabel = sort === "curated" ? "Curated" : sort === "newest" ? "Newest" : "Price";

  function cycleSort() {
    setSort((current) => current === "curated" ? "newest" : current === "newest" ? "price" : "curated");
  }

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
        ListHeaderComponent={
          <View>
            <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
              <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back to search">
                <Ionicons name="arrow-back" size={22} color={colors.bone} />
              </Pressable>
              <Pressable style={styles.searchBar} accessibilityRole="button" accessibilityLabel="Search or ask Uvel">
                <Ionicons name="search-outline" size={18} color={colors.subtle} />
                <Text style={styles.searchText}>Search or ask Uvel</Text>
                <Ionicons name="sparkles-outline" size={18} color={colors.success} />
              </Pressable>
              <Pressable onPress={() => router.push("/inbox")} hitSlop={12} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Open inbox">
                <Ionicons name="bag-outline" size={21} color={colors.bone} />
              </Pressable>
            </View>

            <View style={styles.headingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>SHOP ANY LISTING</Text>
                <Text style={styles.title}>{page.title}</Text>
              </View>
              <Pressable onPress={() => setAvailableOnly((value) => !value)} style={[styles.availabilityPill, availableOnly && styles.availabilityPillOn]} accessibilityRole="button" accessibilityState={{ selected: availableOnly }}>
                <View style={[styles.statusDot, availableOnly && styles.statusDotOn]} />
                <Text style={[styles.availabilityText, availableOnly && styles.availabilityTextOn]}>Available now</Text>
              </Pressable>
            </View>

            <FlatList
              horizontal
              data={CATEGORY_RAIL}
              keyExtractor={(item) => item.slug}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
              renderItem={({ item }) => {
                const active = item.slug === String(slug || "").toLowerCase();
                return <Pressable onPress={() => router.replace({ pathname: "/category/[slug]", params: { slug: item.slug } })} style={[styles.railItem, active && styles.railItemOn]} accessibilityRole="tab" accessibilityState={{ selected: active }}><Text style={[styles.railText, active && styles.railTextOn]}>{item.label}</Text></Pressable>;
              }}
            />

            {hero ? <Pressable onPress={() => router.push({ pathname: "/closet/[id]", params: { id: hero.id } })} style={styles.heroCard} accessibilityRole="button" accessibilityLabel={`Open ${hero.name}`}>
              <Image source={{ uri: hero.photo }} style={styles.heroImage} contentFit="cover" />
              <View style={styles.heroShade} />
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>{page.eyebrow}</Text>
                <Text style={styles.heroTitle}>{page.heroTitle}</Text>
                <Text style={styles.heroBody}>{page.heroBody}</Text>
                <View style={styles.heroCta}><Text style={styles.heroCtaText}>Shop the edit</Text><Ionicons name="arrow-forward" size={16} color={colors.successInk} /></View>
              </View>
              <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{hero.brand || "UVEL EDIT"}</Text></View>
            </Pressable> : null}

            {curated.length ? <View style={styles.curatedSection}>
              <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>SELECTED FOR YOU</Text><Text style={styles.sectionTitle}>The edit</Text></View><Pressable onPress={() => listRef.current?.scrollToOffset({ offset: 520, animated: true })} hitSlop={10}><Text style={styles.seeAll}>See all <Ionicons name="arrow-forward" size={14} color={colors.success} /></Text></Pressable></View>
              <FlatList
                horizontal
                data={curated}
                keyExtractor={(piece) => `curated-${piece.id}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.curatedRail}
                renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: "/closet/[id]", params: { id: item.id } })} style={styles.curatedCard} accessibilityRole="button" accessibilityLabel={`Open ${item.name}`}><Image source={{ uri: item.photo }} style={styles.curatedImage} contentFit="cover" /><View style={styles.curatedMeta}><Text style={styles.curatedBrand} numberOfLines={1}>{item.brand || "UVEL"}</Text><Text style={styles.curatedName} numberOfLines={1}>{item.name}</Text><Text style={styles.curatedPrice}>{moneyInMarket(item.listPriceCents, item.currency || market.currency, market)}</Text></View></Pressable>}
              />
            </View> : null}

            <View style={styles.catalogHeader}>
              <View><Text style={styles.sectionKicker}>LIVE MARKETPLACE</Text><Text style={styles.sectionTitle}>{availableOnly ? "Available now" : "All listings"}</Text></View>
              <View style={styles.catalogControls}>
                <Pressable onPress={cycleSort} style={styles.control} accessibilityRole="button" accessibilityLabel={`Sort listings by ${sortLabel}`}><Ionicons name="swap-vertical-outline" size={16} color={colors.bone} /><Text style={styles.controlText}>{sortLabel}</Text></Pressable>
                <Pressable onPress={() => setAvailableOnly((value) => !value)} style={[styles.control, availableOnly && styles.controlOn]} accessibilityRole="button" accessibilityState={{ selected: availableOnly }}><Ionicons name="options-outline" size={16} color={availableOnly ? colors.successInk : colors.bone} /><Text style={[styles.controlText, availableOnly && styles.controlTextOn]}>Filter</Text></Pressable>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => <View style={styles.cell}><ListingCard piece={item} framed onInteraction={personalization.record} /></View>}
        ListEmptyComponent={sync === "loading" ? <ActivityIndicator color={colors.success} style={styles.empty} /> : <View style={styles.emptyWrap}><Ionicons name="search-outline" size={26} color={colors.subtle} /><Text style={styles.emptyTitle}>Nothing here yet</Text><Text style={styles.empty}>Try another edit or come back soon.</Text></View>}
      />
    </View>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 4 },
    topBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 12 },
    iconButton: { width: 36, height: 42, alignItems: "center", justifyContent: "center" },
    searchBar: { flex: 1, height: 42, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}18`, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, gap: 8 },
    searchText: { flex: 1, color: colors.muted, fontSize: 13, fontWeight: "600" },
    headingRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingTop: 8, paddingBottom: 13 },
    kicker: { color: colors.success, fontSize: 10, letterSpacing: 1.6, fontWeight: "900" },
    title: { color: colors.bone, fontSize: 34, lineHeight: 38, fontWeight: "900", letterSpacing: -0.8, marginTop: 3 },
    availabilityPill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: `${colors.bone}22`, paddingHorizontal: 10, height: 30, borderRadius: 15, marginBottom: 3 },
    availabilityPillOn: { backgroundColor: colors.success, borderColor: colors.success },
    statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.subtle },
    statusDotOn: { backgroundColor: colors.successInk },
    availabilityText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
    availabilityTextOn: { color: colors.successInk },
    rail: { gap: 8, paddingBottom: 16 },
    railItem: { paddingHorizontal: 14, height: 34, borderRadius: 17, borderWidth: 1, borderColor: `${colors.bone}20`, alignItems: "center", justifyContent: "center" },
    railItemOn: { backgroundColor: colors.bone, borderColor: colors.bone },
    railText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    railTextOn: { color: colors.ink },
    heroCard: { height: 315, borderRadius: 24, overflow: "hidden", backgroundColor: colors.surface, marginBottom: 22 },
    heroImage: { ...StyleSheet.absoluteFillObject },
    heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)" },
    heroCopy: { position: "absolute", left: 22, right: 22, bottom: 22 },
    heroEyebrow: { color: colors.success, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
    heroTitle: { color: colors.bone, fontSize: 30, lineHeight: 34, fontWeight: "900", marginTop: 5, letterSpacing: -0.5 },
    heroBody: { color: "#F4F0E6D9", fontSize: 13, lineHeight: 18, maxWidth: 265, marginTop: 5 },
    heroCta: { alignSelf: "flex-start", height: 38, borderRadius: 19, backgroundColor: colors.success, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
    heroCtaText: { color: colors.successInk, fontSize: 12, fontWeight: "900" },
    heroBadge: { position: "absolute", top: 16, right: 16, borderRadius: 14, paddingHorizontal: 10, height: 28, justifyContent: "center", backgroundColor: "#00000080" },
    heroBadgeText: { color: colors.bone, fontSize: 9, letterSpacing: 1.2, fontWeight: "900" },
    curatedSection: { paddingBottom: 22 },
    sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 11 },
    sectionKicker: { color: colors.subtle, fontSize: 10, letterSpacing: 1.5, fontWeight: "900" },
    sectionTitle: { color: colors.bone, fontSize: 25, lineHeight: 29, fontWeight: "900", letterSpacing: -0.4, marginTop: 3 },
    seeAll: { color: colors.success, fontSize: 12, fontWeight: "800", paddingBottom: 3 },
    curatedRail: { gap: 10 },
    curatedCard: { width: 132, borderRadius: 17, backgroundColor: colors.surface, overflow: "hidden" },
    curatedImage: { width: 132, height: 148, backgroundColor: colors.neutral },
    curatedMeta: { padding: 10 },
    curatedBrand: { color: colors.subtle, fontSize: 9, letterSpacing: 1.1, fontWeight: "800" },
    curatedName: { color: colors.bone, fontSize: 12, fontWeight: "700", marginTop: 4 },
    curatedPrice: { color: colors.success, fontSize: 12, fontWeight: "800", marginTop: 6 },
    catalogHeader: { borderTopWidth: 1, borderTopColor: `${colors.bone}16`, paddingTop: 20, paddingBottom: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    catalogControls: { flexDirection: "row", gap: 6 },
    control: { height: 32, borderRadius: 16, borderWidth: 1, borderColor: `${colors.bone}20`, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5 },
    controlOn: { backgroundColor: colors.success, borderColor: colors.success },
    controlText: { color: colors.bone, fontSize: 11, fontWeight: "800" },
    controlTextOn: { color: colors.successInk },
    row: { gap: 12, marginBottom: 14 },
    cell: { flex: 1 },
    emptyWrap: { alignItems: "center", paddingTop: 58, paddingHorizontal: 30 },
    emptyTitle: { color: colors.bone, fontSize: 18, fontWeight: "800", marginTop: 12 },
    empty: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center", paddingTop: 6 },
  });
}
