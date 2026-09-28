import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "../../components/ListingCard";
import { usePersonalization } from "../../lib/personalization";
import { useUvel } from "../../lib/store";
import { useColors } from "../../lib/theme";
import { shopFloor, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";

type CategoryPage = {
  title: string;
  category?: string;
  terms?: string[];
};

const CATEGORY_PAGES: Record<string, CategoryPage> = {
  outerwear: { title: "Outerwear", category: "Outerwear" },
  shoes: { title: "Shoes", category: "Shoes" },
  dresses: { title: "Dresses", category: "Dresses" },
  tailoring: { title: "Tailoring", terms: ["blazer", "tailored", "suit", "tuxedo"] },
};

export default function CategoryListings() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const personalization = usePersonalization(app.uid || "guest");
  const sync = useMarketplaceSyncState();
  useWardrobe();

  const page = CATEGORY_PAGES[String(slug || "").toLowerCase()] || CATEGORY_PAGES.outerwear;
  const live = shopFloor(app.country);
  const rows = useMemo(() => {
    return live.filter((piece) => {
      if (page.category) return piece.category === page.category;
      const searchable = `${piece.name} ${piece.brand} ${piece.category} ${piece.material} ${piece.notes}`.toLowerCase();
      return page.terms?.some((term) => searchable.includes(term)) ?? false;
    });
  }, [live, page]);

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false, animation: "slide_from_right" }} />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to search">
          <Ionicons name="chevron-back" size={25} color={colors.bone} />
        </Pressable>
        <Text style={styles.title}>{page.title}</Text>
        <View style={styles.back} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(piece) => piece.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <ListingCard piece={item} framed onInteraction={personalization.record} />
          </View>
        )}
        ListEmptyComponent={
          sync === "loading" ? <ActivityIndicator color={colors.success} style={styles.empty} /> : <Text style={styles.empty}>No listings here yet.</Text>
        }
      />
    </View>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { minHeight: 58, paddingHorizontal: 8, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    title: { color: colors.bone, fontSize: 20, fontWeight: "800", letterSpacing: 0.2 },
    content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 10 },
    row: { gap: 12, marginBottom: 14 },
    cell: { flex: 1 },
    empty: { color: colors.muted, fontSize: 15, textAlign: "center", paddingTop: 48 },
  });
}
