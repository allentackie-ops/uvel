import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { ListingCard } from "../components/ListingCard";
import { CATEGORIES } from "../lib/catalog";
import { pickForMirror } from "../lib/mirrorPick";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { shopFloor, useWardrobe, type ClosetPiece } from "../lib/wardrobe";

export default function MirrorBrowse() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  useWardrobe();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const live = shopFloor(app.country);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return live.filter((p) => {
      if (cat !== "All" && p.category !== cat) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        (p.brand || "").toLowerCase().includes(needle) ||
        (p.color || "").toLowerCase().includes(needle)
      );
    });
  }, [live, q, cat]);

  function choose(piece: ClosetPiece) {
    pickForMirror(piece.id);
    router.back();
  }

  return (
    <View style={styles.page}>
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Back to Mirror">
          <Text style={styles.navBack}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>From Uvel</Text>
        <View style={styles.navBtn} />
      </View>
      <View style={styles.search}>
        <Text style={styles.searchIcon} accessible={false}>⌕</Text>
        <TextInput
          accessibilityLabel="Search listings"
          placeholder="Search what’s listed"
          placeholderTextColor={colors.subtle}
          value={q}
          onChangeText={setQ}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
        />
        {q ? (
          <Pressable onPress={() => setQ("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Text style={styles.clear}>×</Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {CATEGORIES.map((c) => {
              const on = cat === c;
              return (
                <AccessiblePressable
                  key={c}
                  onPress={() => setCat(c)}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${c} category`}
                >
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{c}</Text>
                </AccessiblePressable>
              );
            })}
          </ScrollView>
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <ListingCard piece={item} framed onOpen={() => choose(item)} />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nothing matches that yet.</Text>}
      />
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    nav: { paddingHorizontal: 6, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navBack: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    navTitle: { color: colors.bone, fontSize: 17, fontWeight: "600" },
    search: {
      marginHorizontal: 16,
      marginBottom: 10,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      gap: 8,
    },
    searchIcon: { color: `${colors.bone}80`, fontSize: 18 },
    input: { flex: 1, color: colors.bone, fontSize: 16, paddingVertical: 0 },
    clear: { color: colors.bone, fontSize: 22, lineHeight: 22 },
    chips: { flexDirection: "row", gap: 8, paddingBottom: 14, paddingRight: 8 },
    chip: { height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: `${colors.bone}29`, justifyContent: "center" },
    chipOn: { backgroundColor: colors.success, borderColor: colors.success },
    chipTxt: { color: colors.bone, fontSize: 13, fontWeight: "700" },
    chipTxtOn: { color: colors.successInk },
    row: { gap: 10 },
    cell: { flex: 1, marginBottom: 10 },
    empty: { color: `${colors.bone}7A`, fontSize: 15, textAlign: "center", paddingTop: 40 },
  });
}
