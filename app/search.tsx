import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, FlatList, Keyboard, Pressable, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "../components/ListingCard";
import { usePersonalization } from "../lib/personalization";
import { useCopy } from "../lib/useCopy";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { fallbackShopFloor, listedPieces, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../lib/wardrobe";
import { addRecentSearch, loadRecentSearches, saveRecentSearches } from "../lib/searchHistory";

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
  const [submittedTerm, setSubmittedTerm] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>("All");
  const tabIndex = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const tabWidth = Math.max(1, (width - 36) / TABS.length);
  const needle = term.trim().toLowerCase();
  const submittedNeedle = submittedTerm.trim().toLowerCase();
  const showResults = Boolean(submittedNeedle && needle === submittedNeedle);
  const showRecentSearches = searchFocused && !needle && !submittedNeedle;

  useEffect(() => {
    void loadRecentSearches().then(setRecentSearches);
  }, []);

  const rows = useMemo(() => {
    const words = submittedNeedle.split(/\s+/).filter(Boolean);
    return live.filter((piece) => {
      const searchable = [piece.name, piece.brand, piece.category, piece.color, piece.material, piece.notes, piece.size, ...(piece.sizes || [])].filter(Boolean).join(" ").toLowerCase();
      return matchesTab(piece, activeTab) && (!words.length || words.every((word) => searchable.includes(word)));
    });
  }, [activeTab, live, submittedNeedle]);

  const suggestionCategories = activeTab === "All"
    ? ["Women’s clothing", "Men’s clothing", "Brand pieces"]
    : [`${activeTab} clothing`, `${activeTab} tops`, `${activeTab} new arrivals`];
  const popularSuggestions = [`${term.trim()} outfits`, `${term.trim()} for ${activeTab === "All" ? "everyone" : activeTab.toLowerCase()}`, `${term.trim()} vintage`, `${term.trim()} sale`];

  useEffect(() => {
    if (!submittedNeedle || !showResults) return;
    const timer = setTimeout(() => personalization.record("search", undefined, submittedNeedle), 700);
    return () => clearTimeout(timer);
  }, [personalization.record, showResults, submittedNeedle]);

  function chooseTab(tab: SearchTab) {
    const nextIndex = TABS.indexOf(tab);
    setActiveTab(tab);
    Animated.spring(tabIndex, { toValue: nextIndex, useNativeDriver: true, damping: 20, stiffness: 220 }).start();
  }

  function submitSearch() {
    const nextTerm = term.trim();
    if (!nextTerm) return;
    rememberSearch(nextTerm);
    setSubmittedTerm(nextTerm);
    Keyboard.dismiss();
  }

  function rememberSearch(value: string) {
    const next = addRecentSearch(recentSearches, value);
    setRecentSearches(next);
    void saveRecentSearches(next);
  }

  function chooseTrending(value: string) {
    rememberSearch(value);
    setTerm(value);
    setSubmittedTerm(value);
    Keyboard.dismiss();
  }

  function chooseSuggestion(value: string) {
    rememberSearch(value);
    setTerm(value);
    setSubmittedTerm(value);
    Keyboard.dismiss();
  }

  function chooseRecent(value: string) {
    setTerm(value);
    setSubmittedTerm(value);
    Keyboard.dismiss();
  }

  function removeRecent(value: string) {
    const next = recentSearches.filter((item) => item.toLowerCase() !== value.toLowerCase());
    setRecentSearches(next);
    void saveRecentSearches(next);
  }

  function startVoiceSearch() {
    inputRef.current?.focus();
    Alert.alert("Voice search", "Voice search is ready to connect to speech recognition. Type your search for now.");
  }

  const resultRows = showResults ? Array.from({ length: Math.ceil(rows.length / 2) }, (_, index) => rows.slice(index * 2, index * 2 + 2)) : [];

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
                onSubmitEditing={submitSearch}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder={`Search ${activeTab === "All" ? "all clothing" : activeTab === "Brand" ? "brand pieces" : `${activeTab.toLowerCase()}'s clothing`}`}
                placeholderTextColor={colors.subtle}
                accessibilityLabel={copy.searchListings}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={colors.success}
                style={styles.input}
              />
              {term ? <Pressable onPress={() => { setTerm(""); setSubmittedTerm(""); }} hitSlop={8} style={styles.clearButton} accessibilityRole="button" accessibilityLabel={copy.clearSearch}><Ionicons name="close-circle" size={19} color={colors.muted} /></Pressable> : null}
              <Pressable onPress={startVoiceSearch} style={styles.voiceButton} accessibilityRole="button" accessibilityLabel="Search by voice">
                <Ionicons name="mic-outline" size={23} color={colors.bone} />
              </Pressable>
              <Pressable onPress={() => router.push("/lens-search")} style={styles.cameraButton} accessibilityRole="button" accessibilityLabel="Search with a photo">
                <View style={styles.cameraIconWrap}>
                  <Ionicons name="camera-outline" size={23} color={colors.bone} />
                  <Ionicons name="sparkles" size={11} color={colors.bone} style={styles.cameraSparkle} />
                </View>
              </Pressable>
            </View>
            {showResults ? (
              <View style={styles.resultsHeading}><Text style={styles.resultTitle}>{activeTab} results</Text><Text style={styles.resultCount}>{rows.length} {rows.length === 1 ? "piece" : "pieces"}</Text></View>
            ) : needle ? (
              <View style={styles.suggestionsPanel}>
                <Text style={styles.suggestionHeading}>Categories</Text>
                <View style={styles.suggestionChips}>{suggestionCategories.map((suggestion) => <Pressable key={suggestion} onPress={() => chooseSuggestion(suggestion)} style={styles.suggestionChip} accessibilityRole="button"><Text style={styles.suggestionChipText}>{suggestion}</Text></Pressable>)}</View>
                <Text style={styles.suggestionHeading}>Popular</Text>
                <View style={styles.popularList}>{popularSuggestions.map((suggestion) => <Pressable key={suggestion} onPress={() => chooseSuggestion(suggestion)} style={styles.popularRow} accessibilityRole="button"><Ionicons name="search-outline" size={17} color={colors.muted} /><Text style={styles.popularText}>{suggestion}</Text><Text style={styles.popularCount}>{live.filter((piece) => [piece.name, piece.brand, piece.category, piece.notes].join(" ").toLowerCase().includes(term.trim().toLowerCase())).length}</Text></Pressable>)}</View>
              </View>
            ) : showRecentSearches ? (
              <View style={styles.recentPanel}>
                <View style={styles.recentHeadingRow}><Text style={styles.sectionTitle}>Recent searches</Text><Pressable onPress={() => { setRecentSearches([]); void saveRecentSearches([]); }} accessibilityRole="button" accessibilityLabel="Clear recent searches"><Text style={styles.clearRecent}>Clear all</Text></Pressable></View>
                {recentSearches.length ? recentSearches.map((search) => (
                  <View key={search.toLowerCase()} style={styles.recentRow}>
                    <Pressable onPress={() => chooseRecent(search)} style={styles.recentValue} accessibilityRole="button" accessibilityLabel={`Search again for ${search}`}>
                      <Ionicons name="time-outline" size={19} color={colors.muted} />
                      <Text style={styles.recentText} numberOfLines={1}>{search}</Text>
                    </Pressable>
                    <Pressable onPress={() => removeRecent(search)} hitSlop={8} style={styles.removeRecent} accessibilityRole="button" accessibilityLabel={`Remove ${search} from recent searches`}><Ionicons name="close-circle-outline" size={22} color={colors.muted} /></Pressable>
                  </View>
                )) : <Text style={styles.emptyRecent}>Your recent searches will appear here.</Text>}
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Trending searches</Text>
                <View style={styles.trendingWrap}>
                  {TRENDING_SEARCHES.map((search) => <Pressable key={search} onPress={() => chooseTrending(search)} style={styles.trendingChip} accessibilityRole="button" accessibilityLabel={`Search for ${search}`}><Text style={styles.trendingText}>{search}</Text></Pressable>)}
                </View>
              </>
            )}
          </>
        }
        renderItem={({ item }) => <View style={styles.resultRow}>{item.map((piece) => <View key={piece.id} style={styles.resultCell}><ListingCard piece={piece} framed onInteraction={personalization.record} /></View>)}{item.length === 1 ? <View style={styles.resultCell} /> : null}</View>}
        ListEmptyComponent={showResults ? <View style={styles.empty}>{syncState === "loading" ? <ActivityIndicator color={colors.success} /> : <><Text style={styles.emptyTitle}>Nothing here yet.</Text><Text style={styles.emptyText}>{syncState === "unavailable" ? copy.searchUnavailable ?? "Search is unavailable right now." : `Try another search in ${activeTab}.`}</Text></>}</View> : null}
      />
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingHorizontal: 14 },
    tabs: { height: 46, flexDirection: "row", position: "relative", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20` },
    tab: { flex: 1, height: 46, alignItems: "center", justifyContent: "center" },
    tabText: { color: colors.muted, fontSize: 14, fontWeight: "800" },
    tabTextActive: { color: colors.bone },
    tabIndicator: { position: "absolute", bottom: 0, left: 0, height: 2, borderRadius: 2, backgroundColor: colors.bone },
    searchBox: { minHeight: 50, marginTop: 12, borderRadius: 25, borderWidth: 1, borderColor: `${colors.bone}35`, backgroundColor: colors.surface, paddingLeft: 4, paddingRight: 5, flexDirection: "row", alignItems: "center", gap: 6 },
    backButton: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
    input: { flex: 1, minHeight: 44, color: colors.bone, fontSize: 15, paddingVertical: 0 },
    clearButton: { width: 26, height: 36, alignItems: "center", justifyContent: "center" },
    voiceButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    cameraButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    cameraIconWrap: { width: 28, height: 28, alignItems: "center", justifyContent: "center", position: "relative" },
    cameraSparkle: { position: "absolute", top: -3, right: -4 },
    sectionTitle: { color: colors.bone, fontSize: 16, fontWeight: "800", marginTop: 24, marginBottom: 10 },
    recentPanel: { marginTop: 8 },
    recentHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    clearRecent: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 24, marginBottom: 10 },
    recentRow: { minHeight: 52, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20` },
    recentValue: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", gap: 11 },
    recentText: { flex: 1, color: colors.bone, fontSize: 15, fontWeight: "600" },
    removeRecent: { width: 36, height: 44, alignItems: "flex-end", justifyContent: "center" },
    emptyRecent: { color: colors.muted, fontSize: 14, paddingVertical: 18 },
    trendingWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    trendingChip: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: `${colors.bone}35`, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    trendingText: { color: colors.bone, fontSize: 13 },
    suggestionsPanel: { marginTop: 24 },
    suggestionHeading: { color: colors.bone, fontSize: 15, fontWeight: "800", marginBottom: 10 },
    suggestionChips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 22 },
    suggestionChip: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: `${colors.bone}30`, backgroundColor: colors.surface, justifyContent: "center" },
    suggestionChipText: { color: colors.bone, fontSize: 13 },
    popularList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${colors.bone}20` },
    popularRow: { minHeight: 43, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20` },
    popularText: { flex: 1, color: colors.bone, fontSize: 14 },
    popularCount: { color: colors.muted, fontSize: 12 },
    resultsHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 24, marginBottom: 12 },
    resultTitle: { color: colors.bone, fontSize: 18, fontWeight: "800" },
    resultCount: { color: colors.muted, fontSize: 13 },
    resultRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
    resultCell: { flex: 1, minWidth: 0 },
    empty: { minHeight: 230, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
    emptyTitle: { color: colors.bone, fontSize: 17, fontWeight: "800" },
    emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8 },
  });
}
