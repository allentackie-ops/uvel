import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, FlatList, Keyboard, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { OrbitLoader, useMinHold } from "../components/OrbitLoader";
import { ListingCard } from "../components/ListingCard";
import { usePersonalization } from "../lib/personalization";
import { useCopy } from "../lib/useCopy";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { useBrands, type Brand } from "../lib/brands";
import { refreshMarketplaceListings, shopFloor, useMarketplaceSyncState, useWardrobe } from "../lib/wardrobe";

const VISUALS = {
  hero: require("../assets/catalog/hero.jpg"),
  trench: require("../assets/catalog/leather-trench.jpg"),
  boots: require("../assets/catalog/cowboy-boots.jpg"),
  silk: require("../assets/catalog/silk-slip.jpg"),
  tailoring: require("../assets/catalog/wool-blazer.jpg"),
  utility: require("../assets/catalog/field-jacket.jpg"),
  denim: require("../assets/catalog/vintage-denim.jpg"),
  cashmere: require("../assets/catalog/cashmere-crew.jpg"),
};
const RECENT_SEARCHES = ["espresso leather", "silk slip", "western boots"];
const MIN_REFRESH_MS = 650;
const CATEGORIES = [
  { label: "Outerwear", image: VISUALS.trench, slug: "outerwear" },
  { label: "Shoes", image: VISUALS.boots, slug: "shoes" },
  { label: "Dresses", image: VISUALS.silk, slug: "dresses" },
  { label: "Tailoring", image: VISUALS.tailoring, slug: "tailoring" },
];

export default function Search() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const C = useCopy();
  useWardrobe();
  const brands = useBrands();
  const marketplaceSync = useMarketplaceSyncState();
  const personalization = usePersonalization(app.uid || "guest");
  const [term, setTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSize, setSelectedSize] = useState("Any size");
  const [sort, setSort] = useState("Relevance");
  const [refreshing, setRefreshing] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [searchActive, setSearchActive] = useState(false);
  const refreshTriggered = useRef(false);
  const hapticTriggered = useRef(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollOffset = useRef(0);
  const heroPull = useRef(new Animated.Value(0)).current;
  const needle = term.trim().toLowerCase();
  const live = shopFloor(app.country);

  const rows = useMemo(() => {
    const words = needle.split(/\s+/).filter(Boolean);
    return live.filter((piece) => {
      const searchable = [piece.name, piece.brand, piece.category, piece.color, piece.material, piece.notes, piece.size, ...(piece.sizes || [])].filter(Boolean).join(" ").toLowerCase();
      return (!words.length || words.every((word) => searchable.includes(word))) &&
        (selectedCategory === "All" || piece.category === selectedCategory) &&
        (selectedSize === "Any size" || piece.size === selectedSize || piece.sizes?.includes(selectedSize));
    });
  }, [live, needle, selectedCategory, selectedSize]);

  useEffect(() => {
    if (needle.length < 3) return;
    const timer = setTimeout(() => personalization.record("search", undefined, needle), 700);
    return () => clearTimeout(timer);
  }, [needle, personalization.record]);

  function chooseSearch(value: string) {
    setSearchActive(true);
    setTerm(value);
    setSelectedCategory("All");
    Keyboard.dismiss();
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshMarketplaceListings(),
        new Promise<void>((resolve) => setTimeout(resolve, MIN_REFRESH_MS)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = event.nativeEvent.contentOffset.y;
    scrollOffset.current = y;
    scrollY.setValue(y);
    if (y > -10) {
      refreshTriggered.current = false;
      hapticTriggered.current = false;
    }
    if (y < -48 && !hapticTriggered.current) {
      hapticTriggered.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    if (y < -48 && !refreshing && !refreshTriggered.current) {
      refreshTriggered.current = true;
      void onRefresh();
    }
  }, [onRefresh, refreshing, scrollY]);

  const scrollHeroHeight = scrollY.interpolate({ inputRange: [-180, 0], outputRange: [640, 460], extrapolateLeft: "extend", extrapolateRight: "clamp" });
  const stretchedHeroHeight = Animated.add(scrollHeroHeight, heroPull);
  const heroOffset = scrollY.interpolate({ inputRange: [-180, 0], outputRange: [-180, 0], extrapolateLeft: "extend", extrapolateRight: "clamp" });
  const heroDotsTop = 414;
  const heroPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture) => scrollOffset.current <= 1 && gesture.dy > 8 && gesture.dy > Math.abs(gesture.dx) * 1.2,
    onPanResponderMove: (_event, gesture) => heroPull.setValue(Math.max(0, Math.min(180, gesture.dy))),
    onPanResponderRelease: () => Animated.spring(heroPull, { toValue: 0, useNativeDriver: false, damping: 18, stiffness: 180 }).start(),
    onPanResponderTerminate: () => Animated.spring(heroPull, { toValue: 0, useNativeDriver: false, damping: 18, stiffness: 180 }).start(),
    onPanResponderTerminationRequest: () => false,
  }), [heroPull]);
  const orbitOn = useMinHold(refreshing, MIN_REFRESH_MS);
  const hasQuery = searchActive || Boolean(needle);
  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: "Find", headerShown: false, animation: "slide_from_right" }} />
      <FlatList
        data={hasQuery ? rows : []}
        keyExtractor={(piece) => piece.id}
        numColumns={2}
        columnWrapperStyle={styles.resultsRow}
        contentContainerStyle={[styles.results, { paddingBottom: insets.bottom + 34 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        alwaysBounceVertical
        bounces
        scrollEventThrottle={16}
        onScroll={onScroll}
        ListHeaderComponent={hasQuery ? <QueryHeader topInset={insets.top} colors={colors} styles={styles} term={term} setTerm={setTerm} copy={C} rows={rows} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} setFilterOpen={setFilterOpen} sort={sort} setSort={setSort} /> : <DiscoveryHero onSearch={chooseSearch} onSearchFocus={() => setSearchActive(true)} colors={colors} styles={styles} term={term} setTerm={setTerm} copy={C} brands={brands} activeSlide={activeSlide} onActiveSlideChange={setActiveSlide} heroHeight={stretchedHeroHeight} heroOffset={heroOffset} panHandlers={heroPanResponder.panHandlers} heroDotsTop={heroDotsTop} />}
        ListFooterComponent={!hasQuery ? <DiscoveryContent onSearch={chooseSearch} colors={colors} styles={styles} brands={brands} heroPull={heroPull} /> : null}
        renderItem={({ item }) => <View style={styles.cell}><ListingCard piece={item} framed onInteraction={personalization.record} /></View>}
        ListEmptyComponent={hasQuery && Boolean(needle) ? <View style={styles.empty}>{marketplaceSync === "loading" ? <ActivityIndicator color={colors.success} /> : <><Text style={styles.emptyTitle}>Nothing here yet.</Text><Text style={styles.emptyText}>{marketplaceSync === "unavailable" ? C.searchUnavailable ?? "Search is unavailable right now." : "Try a wider mood, color or material."}</Text></>}</View> : null}
      />
      {orbitOn ? <View pointerEvents="none" style={[styles.refreshOrbit, { top: insets.top + 72 }]}><OrbitLoader /></View> : null}
      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}><View style={styles.modalBackdrop}><View style={styles.sheet}><View style={styles.sheetHandle} /><View style={styles.sheetTitleRow}><Text style={styles.sheetTitle}>Tune your find</Text><Pressable onPress={() => setFilterOpen(false)} hitSlop={10}><Ionicons name="close" size={24} color={colors.bone} /></Pressable></View><Text style={styles.filterLabel}>CATEGORY</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>{["All", ...CATEGORIES.map((item) => item.label)].map((category) => <Pressable key={category} onPress={() => setSelectedCategory(category)} style={[styles.filterChip, selectedCategory === category && styles.filterChipActive]}><Text style={[styles.filterChipText, selectedCategory === category && styles.filterChipTextActive]}>{category}</Text></Pressable>)}</ScrollView><Text style={styles.filterLabel}>SIZE</Text><View style={styles.sizeGrid}>{["Any size", "XS", "S", "M", "L", "XL"].map((size) => <Pressable key={size} onPress={() => setSelectedSize(size)} style={[styles.sizeChip, selectedSize === size && styles.sizeChipActive]}><Text style={[styles.sizeText, selectedSize === size && styles.sizeTextActive]}>{size}</Text></Pressable>)}</View><Pressable onPress={() => setFilterOpen(false)} style={styles.applyButton}><Text style={styles.applyText}>Show pieces</Text><Ionicons name="arrow-forward" size={18} color={colors.successInk} /></Pressable></View></View></Modal>
    </View>
  );
}

type BrandSlide = { id?: string; name: string; tagline: string; image: any; query: string };

function buildBrandSlides(brands: Brand[]): BrandSlide[] {
  const fallback: BrandSlide[] = [
    { name: "Archive 1982", tagline: "Pieces with a past.", image: VISUALS.trench, query: "archive leather" },
    { name: "Atelier No. 4", tagline: "Cut for the long way around.", image: VISUALS.silk, query: "atelier silk" },
    { name: "Deadstock", tagline: "The good stuff, still here.", image: VISUALS.boots, query: "deadstock boots" },
  ];
  return brands.slice(0, 3).length ? brands.slice(0, 3).map((brand, index) => ({ id: brand.id, name: brand.name, tagline: brand.tagline || "Find the pieces worth keeping.", image: brand.bannerUri ? { uri: brand.bannerUri } : [VISUALS.trench, VISUALS.silk, VISUALS.boots][index], query: brand.name })) : fallback;
}

function openBrandSlide(slide: BrandSlide, onSearch: (value: string) => void) {
  if (slide.id) router.push({ pathname: "/brand/[id]", params: { id: slide.id } });
  else onSearch(slide.query);
}

function QueryHeader({ topInset, colors, styles, term, setTerm, copy, rows, selectedCategory, setSelectedCategory, setFilterOpen, sort, setSort }: { topInset: number; colors: Colors; styles: ReturnType<typeof make>; term: string; setTerm: (value: string) => void; copy: ReturnType<typeof useCopy>; rows: any[]; selectedCategory: string; setSelectedCategory: (value: string) => void; setFilterOpen: (value: boolean) => void; sort: string; setSort: (value: string) => void }) {
  return <View style={{ paddingTop: topInset + 12 }}><View style={styles.searchBox}><AccessiblePressable onPress={() => router.back()} hitSlop={10} style={styles.searchBackButton} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={25} color={colors.bone} /></AccessiblePressable><Ionicons name="search-outline" size={21} color={colors.success} accessible={false} /><TextInput autoFocus value={term} onChangeText={setTerm} onSubmitEditing={Keyboard.dismiss} accessibilityLabel={copy.searchListings} placeholder="Search anything" placeholderTextColor={colors.subtle} returnKeyType="search" autoCapitalize="none" autoCorrect={false} selectionColor={colors.success} style={styles.input} />{term ? <AccessiblePressable onPress={() => setTerm("")} hitSlop={8} style={styles.clearButton} accessibilityRole="button" accessibilityLabel={copy.clearSearch}><Ionicons name="close-circle" size={19} color={colors.muted} /></AccessiblePressable> : null}<AccessiblePressable onPress={() => router.push("/scan")} style={styles.cameraButton} accessibilityRole="button" accessibilityLabel="Search with a photo"><Ionicons name="camera-outline" size={21} color={colors.ink} /></AccessiblePressable></View><View style={styles.queryHeader}><View><Text style={styles.resultEyebrow}>RESULTS FOR</Text><Text style={styles.queryTitle}>“{term.trim()}”</Text></View><Text style={styles.resultCount}>{rows.length} pieces</Text></View><View style={styles.controlsRow}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlScroll}><Pressable onPress={() => setFilterOpen(true)} style={styles.control}><Ionicons name="options-outline" size={16} color={colors.bone} /><Text style={styles.controlText}>Filter</Text></Pressable><Pressable onPress={() => setSort(sort === "Relevance" ? "Newest" : "Relevance")} style={styles.control}><Ionicons name="swap-vertical-outline" size={16} color={colors.bone} /><Text style={styles.controlText}>{sort}</Text></Pressable>{selectedCategory !== "All" ? <Pressable onPress={() => setSelectedCategory("All")} style={styles.activeControl}><Text style={styles.activeControlText}>{selectedCategory} ×</Text></Pressable> : null}</ScrollView></View></View>;
}

function DiscoveryHero({ onSearch, onSearchFocus, colors, styles, term, setTerm, copy, brands, activeSlide, onActiveSlideChange, heroHeight, heroOffset, panHandlers, heroDotsTop }: { onSearch: (value: string) => void; onSearchFocus: () => void; colors: Colors; styles: ReturnType<typeof make>; term: string; setTerm: (value: string) => void; copy: ReturnType<typeof useCopy>; brands: Brand[]; activeSlide: number; onActiveSlideChange: (slide: number) => void; heroHeight: any; heroOffset: any; panHandlers: any; heroDotsTop: number }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const slides = buildBrandSlides(brands);
  return (
    <View style={styles.heroLayout}>
      <Animated.View {...panHandlers} style={[styles.hero, { height: heroHeight, transform: [{ translateY: heroOffset }] }]}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={StyleSheet.absoluteFill} onMomentumScrollEnd={(event) => onActiveSlideChange(Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1)))}>
          {slides.map((slide) => <AccessiblePressable key={`${slide.id || slide.name}`} onPress={() => openBrandSlide(slide, onSearch)} accessibilityRole="button" accessibilityLabel={`Open ${slide.name} brand page`} style={[styles.heroSlide, { width }]}><Image source={slide.image} contentFit="cover" style={styles.heroImage} /><View style={styles.heroShade} /></AccessiblePressable>)}
        </ScrollView>
        <View style={[styles.overlaySearch, { top: insets.top + 12 }]}>
          <AccessiblePressable onPress={() => router.back()} hitSlop={10} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={25} color={colors.bone} /></AccessiblePressable>
          <Ionicons name="search-outline" size={19} color={colors.muted} accessible={false} />
          <TextInput ref={inputRef} value={term} onChangeText={setTerm} onFocus={() => { setVoiceActive(false); onSearchFocus(); }} onSubmitEditing={Keyboard.dismiss} accessibilityLabel={copy.searchListings} placeholder={voiceActive ? "Speak your search…" : "Search anything"} placeholderTextColor={colors.subtle} returnKeyType="search" autoCapitalize="none" autoCorrect={false} selectionColor={colors.success} style={styles.overlayInput} />
          {term ? <Pressable onPress={() => setTerm("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
          <AccessiblePressable onPress={() => { setVoiceActive(true); inputRef.current?.focus(); }} style={styles.overlayToolButton} accessibilityRole="button" accessibilityLabel="Voice search"><Ionicons name="mic-outline" size={19} color={voiceActive ? colors.success : colors.bone} /></AccessiblePressable>
          <AccessiblePressable onPress={() => router.push("/scan")} style={styles.overlayCamera} accessibilityRole="button" accessibilityLabel="Search with a photo"><Ionicons name="camera-outline" size={19} color={colors.ink} /></AccessiblePressable>
        </View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.heroDots, { top: heroDotsTop }]}>{Array.from({ length: slides.length }, (_, index) => <View key={`hero-dot-${index}`} style={index === activeSlide ? styles.dotActive : styles.dot} />)}</Animated.View>
      <Animated.View pointerEvents="none" style={[styles.heroCopy, { transform: [{ translateY: heroOffset }] }]}><Text style={styles.heroTitle}>{slides[activeSlide]?.name.toUpperCase()}</Text><Text style={styles.heroSubtitle}>{slides[activeSlide]?.tagline}</Text></Animated.View>
    </View>
  );
}

function DiscoveryContent({ onSearch, colors, styles, brands, heroPull }: { onSearch: (value: string) => void; colors: Colors; styles: ReturnType<typeof make>; brands: Brand[]; heroPull: Animated.Value }) {
  const { width } = useWindowDimensions();
  const slides = buildBrandSlides(brands);
  return <Animated.View style={[styles.discoveryContent, { transform: [{ translateY: heroPull }] }]}><View style={styles.lookCard}><View style={styles.lookTitleRow}><Text style={styles.lookTitle}>Discover your next look in brands</Text><MaterialCommunityIcons name="check-decagram" size={24} color={colors.success} accessible accessibilityLabel="New" /></View><Text style={styles.lookSubtitle}>Get inspired by pieces.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={Math.max(width - 70, 280)} decelerationRate="fast" contentContainerStyle={styles.lookImages}>{slides.map((slide) => <AccessiblePressable key={`brand-${slide.id || slide.name}`} onPress={() => openBrandSlide(slide, onSearch)} accessibilityRole="button" accessibilityLabel={`Open ${slide.name} brand page`} style={[styles.lookImageWrap, { width: Math.max(width - 70, 280) }]}><Image source={slide.image} contentFit="cover" style={styles.lookImage} /><Text style={styles.lookBrand}>{slide.name.toUpperCase()}</Text></AccessiblePressable>)}</ScrollView><Pressable onPress={() => onSearch("outfit")} style={styles.lookButton}><Text style={styles.lookButtonText}>Browse outfits</Text><Ionicons name="arrow-forward" size={18} color={colors.bone} /></Pressable></View><Text style={styles.sectionTitle}>Shop any listing</Text><View style={styles.categoryGrid}>{CATEGORIES.map((category) => <Pressable key={category.label} onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: category.slug } })} style={styles.categoryRowItem}><Image source={category.image} contentFit="cover" style={styles.categoryRowImage} /><View style={styles.categoryRowShade} /><Text style={styles.categoryText}>{category.label}</Text><Ionicons name="arrow-forward" size={17} color={colors.bone} /></Pressable>)}</View><Text style={styles.sectionTitle}>Recent searches</Text><View style={styles.recentList}>{RECENT_SEARCHES.map((search) => <Pressable key={search} onPress={() => onSearch(search)} style={styles.recentRow}><Ionicons name="time-outline" size={17} color={colors.subtle} /><Text style={styles.recentText}>{search}</Text><Ionicons name="arrow-up-left-box" size={17} color={colors.subtle} /></Pressable>)}</View></Animated.View>;
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink }, refreshOrbit: { position: "absolute", left: 0, right: 0, height: 58, alignItems: "center", justifyContent: "flex-start", zIndex: 30 }, results: { flexGrow: 1, paddingHorizontal: 18 }, topLine: { paddingTop: 12, marginBottom: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, eyebrow: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 2 }, searchBox: { minHeight: 58, borderRadius: 18, paddingLeft: 16, paddingRight: 7, borderWidth: 1, borderColor: `${colors.success}55`, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 10 }, input: { flex: 1, minHeight: 54, paddingVertical: 0, color: colors.bone, fontSize: 16 }, searchBackButton: { width: 34, height: 42, alignItems: "center", justifyContent: "center" }, clearButton: { width: 30, height: 40, alignItems: "center", justifyContent: "center" }, cameraButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" }, heroLayout: { height: 460, marginTop: -18, marginHorizontal: -18, position: "relative", overflow: "visible", zIndex: 1 }, hero: { position: "absolute", top: 0, left: 0, right: 0, height: 460, borderRadius: 0, overflow: "hidden", zIndex: 1 }, heroSlide: { height: "100%", position: "relative" }, heroImage: { ...StyleSheet.absoluteFill }, heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.2)" }, overlaySearch: { position: "absolute", left: 14, right: 14, minHeight: 54, borderRadius: 17, paddingLeft: 4, paddingRight: 6, backgroundColor: "rgba(28,26,22,0.88)", flexDirection: "row", alignItems: "center", gap: 8, zIndex: 2 }, backButton: { width: 36, height: 42, alignItems: "center", justifyContent: "center" }, overlayInput: { flex: 1, minHeight: 48, color: colors.bone, fontSize: 15 }, overlayToolButton: { width: 34, height: 40, alignItems: "center", justifyContent: "center" }, overlayCamera: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" }, heroCopy: { position: "absolute", left: 20, right: 20, bottom: 68, alignItems: "center", zIndex: 2, elevation: 2 }, heroTitle: { color: colors.bone, fontSize: 31, fontWeight: "900", letterSpacing: 0.5 }, heroSubtitle: { color: colors.bone, fontSize: 16, marginTop: 4 }, heroDots: { position: "absolute", left: 0, right: 0, height: 6, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5, zIndex: 30, elevation: 30 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: `${colors.bone}66` }, dotActive: { width: 21, height: 6, borderRadius: 3, backgroundColor: colors.bone }, discoveryContent: { marginTop: -38, marginHorizontal: -18, paddingHorizontal: 18, paddingTop: 44, borderTopLeftRadius: 40, borderTopRightRadius: 40, backgroundColor: colors.ink, zIndex: 3, elevation: 3, overflow: "hidden" }, lookCard: { marginTop: 0, marginHorizontal: 0, borderRadius: 22, backgroundColor: colors.surface, padding: 17 }, lookTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 }, lookTitle: { flexShrink: 1, color: colors.bone, fontSize: 18, fontWeight: "800" }, lookSubtitle: { color: colors.muted, fontSize: 14, marginTop: 6 }, lookImages: { gap: 10, marginTop: 14 }, lookImageWrap: { height: 132, borderRadius: 12, overflow: "hidden", position: "relative" }, lookImage: { ...StyleSheet.absoluteFill }, lookBrand: { position: "absolute", left: 10, bottom: 10, color: colors.bone, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }, lookButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: `${colors.bone}55`, marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, lookButtonText: { color: colors.bone, fontSize: 14, fontWeight: "800" }, categoryGrid: { gap: 12 }, categoryRowItem: { height: 74, borderRadius: 16, overflow: "hidden", position: "relative", justifyContent: "center", paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }, categoryRowImage: { ...StyleSheet.absoluteFill }, categoryRowShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.42)" }, categoryText: { flex: 1, color: colors.bone, fontSize: 16, fontWeight: "800" }, sectionTitle: { color: colors.bone, fontSize: 20, fontWeight: "800", marginTop: 30, marginBottom: 14 }, recentList: { borderTopWidth: 1, borderTopColor: `${colors.bone}18`, marginBottom: 8 }, recentRow: { minHeight: 50, borderBottomWidth: 1, borderBottomColor: `${colors.bone}18`, flexDirection: "row", alignItems: "center", gap: 12 }, recentText: { flex: 1, color: colors.muted, fontSize: 15 }, queryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 30, marginBottom: 18 }, resultEyebrow: { color: colors.subtle, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 }, queryTitle: { color: colors.bone, fontSize: 27, fontWeight: "800", marginTop: 3 }, resultCount: { color: colors.muted, fontSize: 13, paddingBottom: 3 }, controlsRow: { marginBottom: 18 }, controlScroll: { gap: 8 }, control: { height: 38, paddingHorizontal: 13, borderRadius: 19, borderWidth: 1, borderColor: `${colors.bone}28`, flexDirection: "row", alignItems: "center", gap: 6 }, controlText: { color: colors.bone, fontSize: 13, fontWeight: "700" }, activeControl: { height: 38, paddingHorizontal: 13, borderRadius: 19, backgroundColor: colors.success, justifyContent: "center" }, activeControlText: { color: colors.successInk, fontSize: 13, fontWeight: "800" }, resultsRow: { gap: 12 }, cell: { flex: 1, marginBottom: 14 }, empty: { minHeight: 230, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }, emptyTitle: { color: colors.bone, fontSize: 19, fontWeight: "800" }, emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 }, modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" }, sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30 }, sheetHandle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: `${colors.bone}35`, marginBottom: 20 }, sheetTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sheetTitle: { color: colors.bone, fontSize: 25, fontWeight: "800" }, filterLabel: { color: colors.subtle, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginTop: 26, marginBottom: 12 }, filterChips: { gap: 8 }, filterChip: { paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: "center", borderWidth: 1, borderColor: `${colors.bone}22` }, filterChipActive: { backgroundColor: colors.success, borderColor: colors.success }, filterChipText: { color: colors.muted, fontSize: 13, fontWeight: "700" }, filterChipTextActive: { color: colors.successInk }, sizeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, sizeChip: { height: 40, minWidth: 54, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: `${colors.bone}22`, alignItems: "center", justifyContent: "center" }, sizeChipActive: { backgroundColor: colors.success, borderColor: colors.success }, sizeText: { color: colors.muted, fontSize: 13, fontWeight: "700" }, sizeTextActive: { color: colors.successInk }, applyButton: { height: 54, borderRadius: 17, backgroundColor: colors.success, marginTop: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, applyText: { color: colors.successInk, fontSize: 15, fontWeight: "800" },
  });
}
