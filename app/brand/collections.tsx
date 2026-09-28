import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBrand, useBrands } from "../../lib/brands";
import { removePiece, updatePiece, useWardrobe } from "../../lib/wardrobe";
import { useColors, useResolvedAppearance } from "../../lib/theme";
import { adaptBrandThemeToAppearance } from "../../lib/brandThemes";
import { themeFor } from "../../lib/brands";

export default function BrandCollections() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBrands();
  const brand = getBrand(id);
  const baseColors = useColors();
  const appearance = useResolvedAppearance();
  const colors = useMemo(() => {
    if (!brand) return baseColors;
    const theme = adaptBrandThemeToAppearance(themeFor(brand), appearance, baseColors);
    return { ...baseColors, ink: theme.bg, bone: theme.ink, muted: theme.muted, surface: theme.card, subtle: theme.muted, success: theme.accent, successInk: theme.accentInk };
  }, [appearance, baseColors, brand]);
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const pieces = useWardrobe();
  const catalog = pieces.filter((piece) => piece.brandId === id || (piece.brand === brand?.name && piece.listedByUid));

  if (!brand) return <View style={styles.page}><Text style={styles.title}>Brand not found</Text></View>;

  const openActions = (piece: (typeof catalog)[number]) => {
    const paused = piece.status !== "listed";
    Alert.alert(piece.name, "Manage this item on your brand page.", [
      { text: paused ? "Resume item" : "Pause item", onPress: () => updatePiece(piece.id, { status: paused ? "listed" : "draft" }) },
      { text: "Delete from brand page", style: "destructive", onPress: () => Alert.alert("Delete this item?", "This removes the item from your brand catalog.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => removePiece(piece.id) }]) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return <View style={styles.page}>
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}><Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="arrow-back" size={21} color={colors.bone} /></Pressable></View>
      <View style={styles.intro}><Text style={styles.title}>Your brand items</Text><Text style={styles.copy}>Every item listed by {brand.name} lives here. Use the three dots to pause an item or remove it from the brand page.</Text></View>
      <View style={styles.summary}><View><Text style={styles.summaryValue}>{catalog.length}</Text><Text style={styles.summaryLabel}>TOTAL ITEMS</Text></View><View><Text style={styles.summaryValue}>{catalog.filter((piece) => piece.status === "listed").length}</Text><Text style={styles.summaryLabel}>LIVE NOW</Text></View><View><Text style={styles.summaryValue}>{catalog.filter((piece) => piece.status !== "listed").length}</Text><Text style={styles.summaryLabel}>PAUSED</Text></View></View>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>All items</Text><Text style={styles.sectionHint}>{catalog.length ? "Tap the dots to manage" : "No items yet"}</Text></View>
      {catalog.length ? catalog.map((piece) => <CatalogItem key={piece.id} piece={piece} colors={colors} styles={styles} onMenu={() => openActions(piece)} />) : <View style={styles.empty}><Ionicons name="shirt-outline" size={29} color={colors.success} /><Text style={styles.emptyTitle}>No brand items yet</Text><Text style={styles.emptyBody}>List your first product and it will appear here.</Text><Pressable onPress={() => router.push({ pathname: "/brand/list", params: { id: brand.id } })} style={styles.emptyButton}><Text style={styles.emptyButtonText}>List an item</Text></Pressable></View>}
    </ScrollView>
  </View>;
}
function CatalogItem({ piece, colors, styles, onMenu }: { piece: ReturnType<typeof useWardrobe>[number]; colors: ReturnType<typeof useColors>; styles: ReturnType<typeof make>; onMenu: () => void }) {
  const isLive = piece.status === "listed";
  const stock = piece.stockQuantity ?? 0;
  return <View style={styles.item}><View style={styles.itemImageWrap}>{piece.photo ? <Image source={{ uri: piece.photo }} style={styles.itemImage} contentFit="cover" cachePolicy="memory-disk" /> : <View style={styles.itemImage} />}<View style={[styles.statusPill, { backgroundColor: isLive ? colors.success : colors.subtle }]}><Text style={[styles.statusText, { color: isLive ? colors.successInk : colors.bone }]}>{isLive ? "LIVE" : "PAUSED"}</Text></View></View><View style={styles.itemDetails}><Text style={styles.itemName} numberOfLines={2}>{piece.name}</Text><Text style={styles.itemMeta}>{piece.category || "Product"}{piece.listPriceCents ? ` · ${piece.currency || "USD"} ${(piece.listPriceCents / 100).toFixed(2)}` : ""}</Text><Text style={styles.itemStock}>{stock ? `${stock} in stock` : "Inventory not added"}</Text></View><Pressable onPress={onMenu} style={styles.menu} accessibilityRole="button" accessibilityLabel={`Manage ${piece.name}`} hitSlop={8}><Ionicons name="ellipsis-vertical" size={21} color={colors.bone} /></Pressable></View>;
}
function make(colors: ReturnType<typeof useColors>) { return StyleSheet.create({ page: { flex: 1, backgroundColor: colors.ink }, content: { paddingHorizontal: 20 }, topBar: { flexDirection: "row", alignItems: "center", minHeight: 44 }, back: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" }, pageName: { color: colors.bone, fontSize: 17, fontWeight: "800", marginLeft: 2 }, topSpacer: { flex: 1 }, intro: { marginTop: 25, marginBottom: 22 }, title: { color: colors.bone, fontSize: 32, lineHeight: 37, fontWeight: "800", letterSpacing: -0.7 }, copy: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 9 }, summary: { flexDirection: "row", gap: 9, marginBottom: 29 }, summaryValue: { color: colors.bone, fontSize: 23, fontWeight: "900" }, summaryLabel: { color: colors.subtle, fontSize: 9, letterSpacing: 1.2, fontWeight: "900", marginTop: 3 }, sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }, sectionTitle: { color: colors.bone, fontSize: 22, fontWeight: "800" }, sectionHint: { color: colors.subtle, fontSize: 11 }, item: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 17, padding: 10, marginBottom: 10, minHeight: 106 }, itemImageWrap: { width: 82, height: 86, position: "relative" }, itemImage: { width: "100%", height: "100%", borderRadius: 12, backgroundColor: colors.ink }, statusPill: { position: "absolute", left: 5, bottom: 5, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 }, statusText: { fontSize: 8, letterSpacing: 0.8, fontWeight: "900" }, itemDetails: { flex: 1, minWidth: 0, paddingHorizontal: 12 }, itemName: { color: colors.bone, fontSize: 15, lineHeight: 19, fontWeight: "800" }, itemMeta: { color: colors.muted, fontSize: 12, marginTop: 6 }, itemStock: { color: colors.subtle, fontSize: 11, marginTop: 5 }, menu: { width: 34, height: 50, alignItems: "center", justifyContent: "center" }, empty: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 18, padding: 27, marginTop: 4 }, emptyTitle: { color: colors.bone, fontSize: 17, fontWeight: "800", marginTop: 10 }, emptyBody: { color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 19, marginTop: 6 }, emptyButton: { backgroundColor: colors.success, borderRadius: 13, paddingHorizontal: 17, paddingVertical: 12, marginTop: 17 }, emptyButtonText: { color: colors.successInk, fontSize: 13, fontWeight: "900" } }); }
