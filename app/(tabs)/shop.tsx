import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "../../components/ProductCard";
import { CATEGORIES, GARMENTS, usd } from "../../lib/catalog";
import { useColors, type Colors } from "../../lib/theme";
import { listedPieces, useWardrobe } from "../../lib/wardrobe";

export default function Shop() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  useWardrobe();

  const live = listedPieces().filter((p) => {
    if (cat !== "All" && p.category !== cat) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return (
      p.name.toLowerCase().includes(needle) ||
      p.brand.toLowerCase().includes(needle) ||
      p.color.toLowerCase().includes(needle)
    );
  });

  const catalog = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return GARMENTS.filter((g) => {
      if (cat !== "All" && g.category !== cat) return false;
      if (!needle) return true;
      return (
        g.name.toLowerCase().includes(needle) ||
        g.brand.toLowerCase().includes(needle) ||
        g.color.toLowerCase().includes(needle) ||
        g.tags.some((t) => t.includes(needle))
      );
    });
  }, [q, cat]);

  const total = live.length + catalog.length;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Shop</Text>
      <Text style={styles.sub}>Clothes, shoes, bags — try it on before you buy.</Text>

      <View style={styles.search}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          placeholder="Search"
          placeholderTextColor={colors.subtle}
          value={q}
          onChangeText={setQ}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
        />
        {q ? (
          <Pressable onPress={() => setQ("")} hitSlop={8}>
            <Text style={styles.clear}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CATEGORIES.map((c) => {
          const on = cat === c;
          return (
            <Pressable key={c} onPress={() => setCat(c)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.count}>
        {total} {total === 1 ? "item" : "items"}
        {cat !== "All" ? ` · ${cat}` : ""}
      </Text>

      <View style={styles.grid}>
        {live.map((p) => (
          <Pressable
            key={p.id}
            style={styles.cell}
            onPress={() => router.push({ pathname: "/closet/[id]", params: { id: p.id, v: "buy" } })}
          >
            <Image source={{ uri: p.photo }} style={styles.img} contentFit="cover" />
            <Text style={styles.brand} numberOfLines={1}>
              {p.brand === "Unlabeled" ? "Uvel" : p.brand}
            </Text>
            <Text style={styles.name} numberOfLines={2}>
              {p.name}
            </Text>
            <Text style={styles.price}>{usd(p.listPriceCents)}</Text>
          </Pressable>
        ))}
        {catalog.map((g) => (
          <View key={g.id} style={styles.cell}>
            <ProductCard garment={g} />
          </View>
        ))}
      </View>

      {total === 0 ? <Text style={styles.empty}>Nothing in {cat === "All" ? "shop" : cat} for that search.</Text> : null}
    </ScrollView>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingHorizontal: 16, paddingBottom: 48 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 36 },
    sub: { color: colors.muted, marginTop: 6, fontSize: 15, lineHeight: 21 },
    search: {
      marginTop: 18,
      height: 46,
      borderRadius: 12,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      gap: 8,
    },
    searchIcon: { color: colors.subtle, fontSize: 18, marginTop: -1 },
    input: { flex: 1, color: colors.bone, fontSize: 16, height: 46 },
    clear: { color: colors.muted, fontSize: 22, paddingHorizontal: 4 },
    chips: { gap: 8, paddingVertical: 16 },
    chip: {
      height: 34,
      paddingHorizontal: 14,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.22)",
      alignItems: "center",
      justifyContent: "center",
    },
    chipOn: { backgroundColor: "#F4F0E6", borderColor: "#F4F0E6" },
    chipTxt: { color: colors.bone, fontSize: 13, fontWeight: "600" },
    chipTxtOn: { color: "#16140F" },
    count: { color: colors.subtle, fontSize: 12, letterSpacing: 0.4, marginBottom: 12 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    cell: { width: "47.4%" },
    img: {
      width: "100%",
      aspectRatio: 3 / 4,
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    brand: { color: colors.subtle, fontSize: 11, marginTop: 8, letterSpacing: 0.4 },
    name: { color: colors.bone, fontSize: 14, fontWeight: "600", marginTop: 3, lineHeight: 18 },
    price: { color: colors.bone, fontSize: 15, fontWeight: "700", marginTop: 4 },
    empty: { color: colors.muted, marginTop: 28, textAlign: "center" },
  });
}
