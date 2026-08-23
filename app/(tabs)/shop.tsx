import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Glass, GlassContainer } from "../../components/Glass";
import { ProductCard } from "../../components/ProductCard";
import { CATEGORIES, GARMENTS, usd } from "../../lib/catalog";
import { useColors, type Colors } from "../../lib/theme";
import { listedPieces, useWardrobe } from "../../lib/wardrobe";

export default function Shop() {
  const colors = useColors();
  const styles = make(colors);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  useWardrobe();
  const fromClosets = listedPieces().filter((p) => {
    if (cat !== "All" && p.category !== cat) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return (
      p.name.toLowerCase().includes(needle) ||
      p.brand.toLowerCase().includes(needle) ||
      p.color.toLowerCase().includes(needle)
    );
  });
  const filtered = useMemo(() => {
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

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>SHOP</Text>
      <Text style={styles.title}>The floor</Text>
      <Text style={styles.p}>Vintage and deadstock, graded for condition. Try it on before it leaves.</Text>
      <Glass style={styles.search}>
        <TextInput
          placeholder="Search leather, slip, camel…"
          placeholderTextColor={colors.subtle}
          value={q}
          onChangeText={setQ}
          style={styles.input}
        />
      </Glass>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
        <GlassContainer spacing={8} style={styles.row}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} onPress={() => setCat(c)}>
              <Glass interactive style={[styles.chip, cat === c && styles.chipOn]}>
                <Text style={[styles.chipText, cat === c && styles.chipTextOn]}>{c}</Text>
              </Glass>
            </Pressable>
          ))}
        </GlassContainer>
      </ScrollView>
      <View style={styles.grid}>
        {fromClosets.map((p) => (
          <Pressable key={p.id} style={styles.cell} onPress={() => router.push(`/closet/${p.id}`)}>
            <Image source={{ uri: p.photo }} style={styles.live} contentFit="cover" />
            <Text style={styles.liveBrand}>{p.brand}</Text>
            <Text style={styles.liveName} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={styles.livePrice}>{usd(p.listPriceCents)}</Text>
          </Pressable>
        ))}
        {filtered.map((g) => (
          <View key={g.id} style={styles.cell}>
            <ProductCard garment={g} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink },
  content: { padding: 20, paddingBottom: 48 },
  kicker: { color: colors.subtle, letterSpacing: 2, fontSize: 11 },
  title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, marginTop: 8 },
  p: { color: colors.muted, marginTop: 8, marginBottom: 16 },
  search: { borderRadius: 999, paddingHorizontal: 16 },
  input: { color: colors.bone, height: 48 },
  row: { flexDirection: "row", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.pulse },
  chipText: { color: colors.bone, fontSize: 13 },
  chipTextOn: { color: colors.bone },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 20 },
  cell: { width: "47%", flexGrow: 1 },
  live: { width: "100%", aspectRatio: 2 / 3, borderRadius: 18, backgroundColor: colors.surface },
  liveBrand: { color: colors.subtle, fontSize: 11, marginTop: 8 },
  liveName: { color: colors.bone, fontWeight: "600", marginTop: 4 },
  livePrice: { color: colors.bone, marginTop: 4 },
});
}
