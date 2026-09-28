import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { ListingCard } from "../components/ListingCard";
import { usePersonalization } from "../lib/personalization";
import { useCopy } from "../lib/useCopy";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { shopFloor, useMarketplaceSyncState, useWardrobe } from "../lib/wardrobe";

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
  const needle = term.trim().toLowerCase();
  const live = shopFloor(app.country);

  const rows = useMemo(() => {
    if (!needle) return [];
    const words = needle.split(/\s+/).filter(Boolean);
    return live.filter((piece) => {
      const searchable = [
        piece.name,
        piece.brand,
        piece.category,
        piece.color,
        piece.material,
        piece.notes,
        piece.size,
        ...(piece.sizes || []),
      ].filter(Boolean).join(" ").toLowerCase();
      return words.every((word) => searchable.includes(word));
    });
  }, [live, needle]);

  useEffect(() => {
    if (needle.length < 3) return;
    const timer = setTimeout(() => personalization.record("search", undefined, needle), 700);
    return () => clearTimeout(timer);
  }, [needle, personalization.record]);

  return (
    <View style={styles.page}>
      <Stack.Screen
        options={{
          title: C.searchListings,
          headerShown: true,
          animation: "slide_from_right",
        }}
      />
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color={colors.muted} accessible={false} />
        <TextInput
          autoFocus
          value={term}
          onChangeText={setTerm}
          onSubmitEditing={Keyboard.dismiss}
          accessibilityLabel={C.searchListings}
          placeholder={C.searchListed}
          placeholderTextColor={colors.subtle}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={colors.success}
          style={styles.input}
        />
        {term ? (
          <AccessiblePressable
            onPress={() => setTerm("")}
            hitSlop={8}
            style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.65 }]}
            accessibilityRole="button"
            accessibilityLabel={C.clearSearch}
          >
            <Text style={styles.clearText}>×</Text>
          </AccessiblePressable>
        ) : null}
      </View>
      <FlatList
        data={rows}
        keyExtractor={(piece) => piece.id}
        numColumns={2}
        columnWrapperStyle={styles.resultsRow}
        contentContainerStyle={[styles.results, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <ListingCard piece={item} framed onInteraction={personalization.record} />
          </View>
        )}
        ListEmptyComponent={needle ? (
          <View style={styles.empty}>
            {marketplaceSync === "loading" ? (
              <ActivityIndicator color={colors.success} />
            ) : (
              <Text style={styles.emptyText}>
                {marketplaceSync === "unavailable"
                  ? C.searchUnavailable ?? "Search is unavailable right now."
                  : C.noSearchResults ?? "No listings match that search."}
              </Text>
            )}
          </View>
        ) : null}
      />
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    searchBox: {
      minHeight: 52,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 12,
      paddingLeft: 16,
      paddingRight: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.bone}1A`,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    input: { flex: 1, minHeight: 48, paddingVertical: 0, color: colors.bone, fontSize: 16 },
    clearButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
    clearText: { color: colors.muted, fontSize: 26, lineHeight: 30, fontWeight: "400" },
    results: { flexGrow: 1, paddingHorizontal: 16 },
    resultsRow: { gap: 12 },
    cell: { flex: 1, marginBottom: 12 },
    empty: { minHeight: 170, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
    emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  });
}
