import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { ListingCard } from "../components/ListingCard";
import { usePersonalization } from "../lib/personalization";
import { useCopy } from "../lib/useCopy";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { shopFloor, useMarketplaceSyncState, useWardrobe } from "../lib/wardrobe";

const RECENT_SEARCHES = ["espresso leather", "silk slip", "western boots"];
const MOODS = [
  { label: "Quiet luxury", query: "cashmere" },
  { label: "After dark", query: "silk" },
  { label: "Soft tailoring", query: "blazer" },
  { label: "Western city", query: "western" },
];
const CATEGORIES = ["Outerwear", "Tops", "Trousers", "Shoes", "Dresses", "Accessories"];

export default function Search() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const C = useCopy();
  useWardrobe();
  const marketplaceSync = useMarketplaceSyncState();
  const personalization = usePersonalization(app.uid || "guest");
  const [term, setTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSize, setSelectedSize] = useState("Any size");
  const [sort, setSort] = useState("Relevance");
  const needle = term.trim().toLowerCase();
  const live = shopFloor(app.country);

  const rows = useMemo(() => {
    const words = needle.split(/\s+/).filter(Boolean);
    return live.filter((piece) => {
      const searchable = [piece.name, piece.brand, piece.category, piece.color, piece.material, piece.notes, piece.size, ...(piece.sizes || [])]
        .filter(Boolean).join(" ").toLowerCase();
      const matchesTerm = !words.length || words.every((word) => searchable.includes(word));
      const matchesCategory = selectedCategory === "All" || piece.category === selectedCategory;
      const matchesSize = selectedSize === "Any size" || piece.size === selectedSize || piece.sizes?.includes(selectedSize);
      return matchesTerm && matchesCategory && matchesSize;
    });
  }, [live, needle, selectedCategory, selectedSize]);

  useEffect(() => {
    if (needle.length < 3) return;
    const timer = setTimeout(() => personalization.record("search", undefined, needle), 700);
    return () => clearTimeout(timer);
  }, [needle, personalization.record]);

  function chooseSearch(value: string) {
    setTerm(value);
    setSelectedCategory("All");
    Keyboard.dismiss();
  }

  const hasQuery = Boolean(needle);

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
        ListHeaderComponent={
          <View>
            <View style={styles.topLine}>
              <Text style={styles.eyebrow}>UVEL / FIND</Text>
              <AccessiblePressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close search">
                <Ionicons name="close" size={25} color={colors.bone} />
              </AccessiblePressable>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={21} color={colors.success} accessible={false} />
              <TextInput
                autoFocus
                value={term}
                onChangeText={setTerm}
                onSubmitEditing={Keyboard.dismiss}
                accessibilityLabel={C.searchListings}
                placeholder="Search pieces, brands, moods"
                placeholderTextColor={colors.subtle}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={colors.success}
                style={styles.input}
              />
              {term ? (
                <AccessiblePressable onPress={() => setTerm("")} hitSlop={8} style={styles.clearButton} accessibilityRole="button" accessibilityLabel={C.clearSearch}>
                  <Ionicons name="close-circle" size={19} color={colors.muted} />
                </AccessiblePressable>
              ) : null}
              <AccessiblePressable onPress={() => router.push("/visual-search")} style={styles.cameraButton} accessibilityRole="button" accessibilityLabel="Search with a photo">
                <Ionicons name="camera-outline" size={21} color={colors.ink} />
              </AccessiblePressable>
            </View>
            {hasQuery ? (
              <View style={styles.queryHeader}>
                <View>
                  <Text style={styles.resultEyebrow}>RESULTS FOR</Text>
                  <Text style={styles.queryTitle}>“{term.trim()}”</Text>
                </View>
                <Text style={styles.resultCount}>{rows.length} pieces</Text>
              </View>
            ) : (
              <DiscoveryHeader onSearch={chooseSearch} colors={colors} styles={styles} />
            )}
            {hasQuery ? (
              <View style={styles.controlsRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlScroll}>
                  <Pressable onPress={() => setFilterOpen(true)} style={styles.control} accessibilityRole="button" accessibilityLabel="Open filters">
                    <Ionicons name="options-outline" size={16} color={colors.bone} /><Text style={styles.controlText}>Filter</Text>
                  </Pressable>
                  <Pressable onPress={() => setSort(sort === "Relevance" ? "Newest" : "Relevance")} style={styles.control} accessibilityRole="button" accessibilityLabel="Change sort order">
                    <Ionicons name="swap-vertical-outline" size={16} color={colors.bone} /><Text style={styles.controlText}>{sort}</Text>
                  </Pressable>
                  {selectedCategory !== "All" ? <Pressable onPress={() => setSelectedCategory("All")} style={styles.activeControl}><Text style={styles.activeControlText}>{selectedCategory} ×</Text></Pressable> : null}
                </ScrollView>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cell}><ListingCard piece={item} framed onInteraction={personalization.record} /></View>
        )}
        ListEmptyComponent={hasQuery ? (
          <View style={styles.empty}>
            {marketplaceSync === "loading" ? <ActivityIndicator color={colors.success} /> : <><Text style={styles.emptyTitle}>Nothing here yet.</Text><Text style={styles.emptyText}>{marketplaceSync === "unavailable" ? C.searchUnavailable ?? "Search is unavailable right now." : "Try a wider mood, color or material."}</Text></>}
          </View>
        ) : null}
      />
      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}><Text style={styles.sheetTitle}>Tune your find</Text><Pressable onPress={() => setFilterOpen(false)} hitSlop={10}><Ionicons name="close" size={24} color={colors.bone} /></Pressable></View>
          <Text style={styles.filterLabel}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>{["All", ...CATEGORIES].map((category) => <Pressable key={category} onPress={() => setSelectedCategory(category)} style={[styles.filterChip, selectedCategory === category && styles.filterChipActive]}><Text style={[styles.filterChipText, selectedCategory === category && styles.filterChipTextActive]}>{category}</Text></Pressable>)}</ScrollView>
          <Text style={styles.filterLabel}>SIZE</Text>
          <View style={styles.sizeGrid}>{["Any size", "XS", "S", "M", "L", "XL"].map((size) => <Pressable key={size} onPress={() => setSelectedSize(size)} style={[styles.sizeChip, selectedSize === size && styles.sizeChipActive]}><Text style={[styles.sizeText, selectedSize === size && styles.sizeTextActive]}>{size}</Text></Pressable>)}</View>
          <Pressable onPress={() => setFilterOpen(false)} style={styles.applyButton}><Text style={styles.applyText}>Show pieces</Text><Ionicons name="arrow-forward" size={18} color={colors.successInk} /></Pressable>
        </View></View>
      </Modal>
    </View>
  );
}

function DiscoveryHeader({ onSearch, colors, styles }: { onSearch: (value: string) => void; colors: Colors; styles: ReturnType<typeof make> }) {
  return <View>
    <Text style={styles.heroKicker}>A better way to browse</Text>
    <Text style={styles.heroTitle}>Find your next{`\n`}favorite thing.</Text>
    <Text style={styles.heroCopy}>Search the Uvel floor by piece, feeling or point of view.</Text>
    <AccessiblePressable onPress={() => router.push("/visual-search")} style={styles.visualCard} accessibilityRole="button" accessibilityLabel="Search Uvel with a photo">
      <View style={styles.visualIcon}><Ionicons name="scan-outline" size={25} color={colors.successInk} /></View><View style={styles.visualCopy}><Text style={styles.visualTitle}>Search with a photo</Text><Text style={styles.visualSubtitle}>See it. Find the feeling.</Text></View><Ionicons name="arrow-up-right-box" size={22} color={colors.success} />
    </AccessiblePressable>
    <Text style={styles.sectionTitle}>Search by mood</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodRow}>{MOODS.map((mood) => <Pressable key={mood.label} onPress={() => onSearch(mood.query)} style={styles.moodChip}><Text style={styles.moodLabel}>{mood.label}</Text><Text style={styles.moodQuery}>{mood.query} ↗</Text></Pressable>)}</ScrollView>
    <Text style={styles.sectionTitle}>Browse the floor</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>{CATEGORIES.map((category, index) => <Pressable key={category} onPress={() => onSearch(category)} style={[styles.categoryCard, { backgroundColor: ["#2A320E", "#28231C", "#193536", "#422C27", "#302A46", "#33321E"][index] }]}><Text style={styles.categoryIndex}>0{index + 1}</Text><Text style={styles.categoryText}>{category}</Text><Ionicons name="arrow-up-right-box" size={18} color={colors.success} /></Pressable>)}</ScrollView>
    <Text style={styles.sectionTitle}>Recent searches</Text>
    <View style={styles.recentList}>{RECENT_SEARCHES.map((search) => <Pressable key={search} onPress={() => onSearch(search)} style={styles.recentRow}><Ionicons name="time-outline" size={17} color={colors.subtle} /><Text style={styles.recentText}>{search}</Text><Ionicons name="arrow-up-left-box" size={17} color={colors.subtle} /></Pressable>)}</View>
  </View>;
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink }, results: { flexGrow: 1, paddingHorizontal: 18 }, topLine: { paddingTop: 12, marginBottom: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, eyebrow: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 2 }, searchBox: { minHeight: 58, borderRadius: 18, paddingLeft: 16, paddingRight: 7, borderWidth: 1, borderColor: `${colors.success}55`, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 10 }, input: { flex: 1, minHeight: 54, paddingVertical: 0, color: colors.bone, fontSize: 16 }, clearButton: { width: 30, height: 40, alignItems: "center", justifyContent: "center" }, cameraButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" }, heroKicker: { color: colors.success, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, marginTop: 34, marginBottom: 10 }, heroTitle: { color: colors.bone, fontSize: 40, lineHeight: 42, fontWeight: "800", letterSpacing: -1.4 }, heroCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 14, maxWidth: 310 }, visualCard: { minHeight: 84, borderRadius: 20, backgroundColor: colors.pulse, marginTop: 24, padding: 16, flexDirection: "row", alignItems: "center", gap: 13 }, visualIcon: { width: 49, height: 49, borderRadius: 16, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" }, visualCopy: { flex: 1 }, visualTitle: { color: colors.bone, fontSize: 16, fontWeight: "800" }, visualSubtitle: { color: colors.muted, fontSize: 13, marginTop: 4 }, sectionTitle: { color: colors.bone, fontSize: 18, fontWeight: "800", marginTop: 30, marginBottom: 13 }, moodRow: { gap: 9, paddingRight: 18 }, moodChip: { borderRadius: 16, borderWidth: 1, borderColor: `${colors.bone}20`, padding: 14, minWidth: 136, backgroundColor: colors.surface }, moodLabel: { color: colors.bone, fontSize: 14, fontWeight: "700" }, moodQuery: { color: colors.success, fontSize: 12, marginTop: 10 }, categoryRow: { gap: 10, paddingRight: 18 }, categoryCard: { width: 142, height: 125, borderRadius: 18, padding: 14, justifyContent: "space-between" }, categoryIndex: { color: `${colors.bone}88`, fontSize: 11, fontWeight: "700" }, categoryText: { color: colors.bone, fontSize: 18, fontWeight: "800" }, recentList: { borderTopWidth: 1, borderTopColor: `${colors.bone}18`, marginBottom: 8 }, recentRow: { minHeight: 50, borderBottomWidth: 1, borderBottomColor: `${colors.bone}18`, flexDirection: "row", alignItems: "center", gap: 12 }, recentText: { flex: 1, color: colors.muted, fontSize: 15 }, queryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 30, marginBottom: 18 }, resultEyebrow: { color: colors.subtle, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 }, queryTitle: { color: colors.bone, fontSize: 27, fontWeight: "800", marginTop: 3 }, resultCount: { color: colors.muted, fontSize: 13, paddingBottom: 3 }, controlsRow: { marginBottom: 18 }, controlScroll: { gap: 8 }, control: { height: 38, paddingHorizontal: 13, borderRadius: 19, borderWidth: 1, borderColor: `${colors.bone}28`, flexDirection: "row", alignItems: "center", gap: 6 }, controlText: { color: colors.bone, fontSize: 13, fontWeight: "700" }, activeControl: { height: 38, paddingHorizontal: 13, borderRadius: 19, backgroundColor: colors.success, justifyContent: "center" }, activeControlText: { color: colors.successInk, fontSize: 13, fontWeight: "800" }, resultsRow: { gap: 12 }, cell: { flex: 1, marginBottom: 14 }, empty: { minHeight: 230, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }, emptyTitle: { color: colors.bone, fontSize: 19, fontWeight: "800" }, emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 }, modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" }, sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30 }, sheetHandle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: `${colors.bone}35`, marginBottom: 20 }, sheetTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sheetTitle: { color: colors.bone, fontSize: 25, fontWeight: "800" }, filterLabel: { color: colors.subtle, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginTop: 26, marginBottom: 12 }, filterChips: { gap: 8 }, filterChip: { paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: "center", borderWidth: 1, borderColor: `${colors.bone}22` }, filterChipActive: { backgroundColor: colors.success, borderColor: colors.success }, filterChipText: { color: colors.muted, fontSize: 13, fontWeight: "700" }, filterChipTextActive: { color: colors.successInk }, sizeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, sizeChip: { height: 40, minWidth: 54, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: `${colors.bone}22`, alignItems: "center", justifyContent: "center" }, sizeChipActive: { backgroundColor: colors.success, borderColor: colors.success }, sizeText: { color: colors.muted, fontSize: 13, fontWeight: "700" }, sizeTextActive: { color: colors.successInk }, applyButton: { height: 54, borderRadius: 17, backgroundColor: colors.success, marginTop: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, applyText: { color: colors.successInk, fontSize: 15, fontWeight: "800" },
  });
}
