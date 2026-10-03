import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Sheet } from "./Sheet";
import { ListingCard } from "./ListingCard";
import { CATEGORIES } from "../lib/catalog";
import type { ClosetPiece } from "../lib/wardrobe";
import { useColors } from "../lib/theme";

export function MirrorUvelPickerSheet({
  open,
  pieces,
  query,
  category,
  marketplaceUnavailable,
  retryingMarketplace,
  onClose,
  onQueryChange,
  onCategoryChange,
  onPickPiece,
  onRetryMarketplace,
}: {
  open: boolean;
  pieces: ClosetPiece[];
  query: string;
  category: (typeof CATEGORIES)[number];
  marketplaceUnavailable: boolean;
  retryingMarketplace: boolean;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: (typeof CATEGORIES)[number]) => void;
  onPickPiece: (piece: ClosetPiece) => void;
  onRetryMarketplace: () => void;
}) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const visiblePieces = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pieces.filter((piece) => {
      if (category !== "All" && piece.category !== category) return false;
      if (!needle) return true;
      return piece.name.toLowerCase().includes(needle)
        || (piece.brand || "").toLowerCase().includes(needle)
        || (piece.color || "").toLowerCase().includes(needle);
    });
  }, [category, pieces, query]);

  return (
    <Sheet open={open} onClose={onClose} surfaceColor={colors.ink}>
      <View style={styles.content}>
        <View style={styles.headingRow}>
          <View>
            <Text style={styles.title}>Choose a piece</Text>
            <Text style={styles.subtitle}>Pick something from Uvel</Text>
          </View>
          <Ionicons name="chevron-up" size={18} color={colors.subtle} />
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.subtle} />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search pieces"
            placeholderTextColor={colors.subtle}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search Uvel pieces"
          />
          {query ? (
            <Pressable onPress={() => onQueryChange("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.subtle} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          {CATEGORIES.map((value) => {
            const active = value === category;
            return (
              <Pressable key={value} onPress={() => onCategoryChange(value)} style={[styles.category, active && styles.categoryActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{value}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.resultsViewport}>
          {pieces.length ? (
            <ScrollView contentContainerStyle={styles.resultsContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {Array.from({ length: Math.ceil(visiblePieces.length / 2) }, (_, rowIndex) => {
                const row = visiblePieces.slice(rowIndex * 2, rowIndex * 2 + 2);
                return (
                  <View key={`uvel-row-${rowIndex}`} style={styles.row}>
                    {row.map((piece) => (
                      <View key={piece.id} style={styles.cell}>
                        <ListingCard piece={piece} framed onOpen={() => onPickPiece(piece)} />
                      </View>
                    ))}
                    {row.length === 1 ? <View style={[styles.cell, styles.spacer]} /> : null}
                  </View>
                );
              })}
              {!visiblePieces.length ? <Text style={styles.emptyText}>No pieces match that search.</Text> : null}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="shirt-outline" size={28} color={colors.success} />
              <Text style={styles.emptyText}>No Uvel pieces are available right now.</Text>
              {marketplaceUnavailable ? (
                <Pressable onPress={onRetryMarketplace} style={styles.retry} disabled={retryingMarketplace}>
                  <Text style={styles.retryText}>{retryingMarketplace ? "Reconnecting…" : "Retry connection"}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </View>
    </Sheet>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    content: { width: "100%" },
    headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    title: { color: colors.bone, fontSize: 21, fontWeight: "800" },
    subtitle: { color: `${colors.bone}9C`, fontSize: 13, marginTop: 3 },
    searchBox: { height: 46, borderRadius: 16, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, marginBottom: 10 },
    searchInput: { flex: 1, height: 46, color: colors.bone, fontSize: 15, paddingVertical: 0 },
    categories: { gap: 8, paddingBottom: 10 },
    category: { height: 34, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: `${colors.bone}2B`, alignItems: "center", justifyContent: "center" },
    categoryActive: { backgroundColor: colors.success, borderColor: colors.success },
    categoryText: { color: colors.bone, fontSize: 12, fontWeight: "700" },
    categoryTextActive: { color: colors.successInk },
    resultsViewport: { height: 410 },
    resultsContent: { paddingTop: 0, paddingBottom: 18 },
    row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    cell: { flex: 1, marginBottom: 10 },
    spacer: { opacity: 0 },
    emptyText: { color: `${colors.bone}91`, textAlign: "center", fontSize: 14, lineHeight: 20, padding: 20 },
    emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    retry: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.surface },
    retryText: { color: colors.success, fontSize: 13, fontWeight: "800" },
  });
}
