import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Keyboard, Pressable, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "../components/ListingCard";
import { usePersonalization } from "../lib/personalization";
import { useCopy } from "../lib/useCopy";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { fallbackShopFloor, listedPieces, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../lib/wardrobe";

const TABS = ["All", "Women", "Men", "Brand"] as const;
type SearchTab = (typeof TABS)[number];

const TRENDING_SEARCHES = [
  "leather",
  "denim",
  "western",
  "silk",
  "boots",
  "tailoring",
  "summer dresses",
];

const NON_BRAND_NAMES = new Set(["unlabeled", "unbranded", "private label", ""]);
const WOMEN_CATEGORIES = new Set(["Dresses", "Skirts", "Lingerie", "Swim", "Hair"]);
const MEN_CATEGORIES = new Set(["Ties"]);

function isBrandPiece(piece: ClosetPiece) {
  return Boolean(piece.brandId) || !NON_BRAND_NAMES.has(piece.brand.trim().toLowerCase());
}

function audienceForPiece(piece: ClosetPiece): "women" | "men" | "unisex" {
  const searchable = [piece.name, piece.brand, piece.category, piece.notes].join(" ").toLowerCase();
  if (/\b(women|woman|womens|ladies|lady)\b/.test(searchable)) return "women";
  if (/\b(men|man|mens|gentlemen|gentleman)\b/.test(searchable)) return "men";
  if (WOMEN_CATEGORIES.has(piece.category)) return "women";
  if (MEN_CATEGORIES.has(piece.category)) return "men";
  return "unisex";
}

function matchesTab(piece: ClosetPiece, tab: SearchTab) {
  if (tab === "All") return true;
  if (tab === "Brand") return isBrandPiece(piece);
  return audienceForPiece(piece) === tab.toLowerCase();
}

export default function Search() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const app = useUvel();
  const copy = useCopy();
  const personalization = usePersonalization(app.uid || "guest");
  const syncState = useMarketplaceSyncState();
  useWardrobe();
  const remotePieces = listedPieces();
  const live = remotePieces.length ? remotePieces : fallbackShopFloor();
  const [term, setTerm] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("All");
  const tabIndex = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const tabWidth = Math.max(1, (width - 36) / TABS.length);
  const needle = term.trim().toLowerCase();

  const rows = useMemo(() => {
    const words = needle.split(/\s+/).filter(Boolean);
    return live.filter((piece) => {
      const searchable = [piece.name, piece.brand, piece.category, piece.color, piece.material, piece.notes, piece.size, ...(piece.sizes || [])].filter(Boolean).join(" ").toLowerCase();
      return matchesTab(piece, activeTab) && (!words.length || words.every((word) => searchable.includes(word)));
    });
  }, [activeTab, live, needle]);

  useEffect(() => {
    if (needle.length < 3) return;
    const timer = setTimeout(() => personalization.record("search", undefined, needle), 700);
    return () => clearTimeout(timer);
  }, [needle, personalization.record]);

  function chooseTab(tab: SearchTab) {
    const nextIndex = TABS.indexOf(tab);
    setActiveTab(tab);
    Animated.spring(tabIndex, { toValue: nextIndex, useNativeDriver: true, damping: 20, stiffness: 220 }).start();
  }

  function chooseTrending(value: string) {
    setTerm(value);
    inputRef.current?.focus();
  }

  const resultRows = Array.from({ length: Math.ceil(rows.length / 2) }, (_, index) => rows.slice(index * 2, index * 2 + 2));

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: "Search", headerShown: false, animation: "slide_from_right" }} />
      <StatusBar barStyle={colors.ink === "#0B0D12" ? "light-content" : "dark-content"} />
      <FlatList
        data={resultRows}
        keyExtractor={(_, index) => `search-row-${index}`}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.tabs}>
              {TABS.map((tab) => (
                <Pressable key={tab} onPress={() => chooseTab(tab)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab }}>
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                </Pressable>
              ))}
              <Animated.View style={[styles.tabIndicator, { width: tabWidth, transform: [{ translateX: tabIndex.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [0, tabWidth, tabWidth * 2, tabWidth * 3] }) }] }]} />
            </View>
            <View style={styles.searchBox}>
              <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
                <Ionicons name="arrow-back" size={24} color={colors.bone} />
              </Pressable>
              <TextInput
                ref={inputRef}
                value={term}
                onChangeText={setTerm}
                onSubmitEditing={Keyboard.dismiss}
                placeholder={`Search ${activeTab === "All" ? "all clothing" : activeTab === "Brand" ? "brand pieces" : `${activeTab.toLowerCase()}'s clothing`}`}
                placeholderTextColor={colors.subtle}
                accessibilityLabel={copy.searchListings}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={colors.success}
                style={styles.input}
              />
              {term ? <Pressable onPress={() => setTerm("")} hitSlop={8} style={styles.clearButton} accessibilityRole="button" accessibilityLabel={copy.clearSearch}><Ionicons name="close-circle" size={19} color={colors.muted} /></Pressable> : null}
              <Pressable onPress={() => router.push("/lens-search")} style={styles.cameraButton} accessibilityRole="button" accessibilityLabel="Search with a photo">
                <Ionicons name="camera-outline" size={22} color={colors.successInk} />
              </Pressable>
            </View>
            <Text style={styles.sectionTitle}>Trending searches</Text>
            <View style={styles.trendingWrap}>
              {TRENDING_SEARCHES.map((search) => <Pressable key={search} onPress={() => chooseTrending(search)} style={styles.trendingChip} accessibilityRole="button" accessibilityLabel={`Search for ${search}`}><Text style={styles.trendingText}>{search}</Text></Pressable>)}
            </View>
            {needle ? <View style={styles.resultsHeading}><Text style={styles.resultTitle}>{activeTab} results</Text><Text style={styles.resultCount}>{rows.length} {rows.length === 1 ? "piece" : "pieces"}</Text></View> : null}
          </>
        }
        renderItem={({ item }) => <View style={styles.resultRow}>{item.map((piece) => <View key={piece.id} style={styles.resultCell}><ListingCard piece={piece} framed onInteraction={personalization.record} /></View>)}{item.length === 1 ? <View style={styles.resultCell} /> : null}</View>}
        ListEmptyComponent={needle ? <View style={styles.empty}>{syncState === "loading" ? <ActivityIndicator color={colors.success} /> : <><Text style={styles.emptyTitle}>Nothing here yet.</Text><Text style={styles.emptyText}>{syncState === "unavailable" ? copy.searchUnavailable ?? "Search is unavailable right now." : `Try another search in ${activeTab}.`}</Text></>}</View> : null}
      />
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingHorizontal: 18 },
    tabs: { height: 52, flexDirection: "row", position: "relative", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20` },
    tab: { flex: 1, height: 52, alignItems: "center", justifyContent: "center" },
    tabText: { color: colors.muted, fontSize: 15, fontWeight: "800" },
    tabTextActive: { color: colors.bone },
    tabIndicator: { position: "absolute", bottom: 0, left: 0, height: 3, borderRadius: 2, backgroundColor: colors.bone },
    searchBox: { minHeight: 58, marginTop: 16, borderRadius: 29, borderWidth: 1, borderColor: `${colors.bone}35`, backgroundColor: colors.surface, paddingLeft: 5, paddingRight: 6, flexDirection: "row", alignItems: "center", gap: 8 },
    backButton: { width: 42, height: 44, alignItems: "center", justifyContent: "center" },
    input: { flex: 1, minHeight: 52, color: colors.bone, fontSize: 16, paddingVertical: 0 },
    clearButton: { width: 28, height: 40, alignItems: "center", justifyContent: "center" },
    cameraButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    sectionTitle: { color: colors.bone, fontSize: 18, fontWeight: "800", marginTop: 30, marginBottom: 14 },
    trendingWrap: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    trendingChip: { minHeight: 38, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: `${colors.bone}35`, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    trendingText: { color: colors.bone, fontSize: 14 },
    resultsHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 30, marginBottom: 16 },
    resultTitle: { color: colors.bone, fontSize: 20, fontWeight: "800" },
    resultCount: { color: colors.muted, fontSize: 13 },
    resultRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
    resultCell: { flex: 1, minWidth: 0 },
    empty: { minHeight: 230, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
    emptyTitle: { color: colors.bone, fontSize: 19, fontWeight: "800" },
    emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },
  });
}
