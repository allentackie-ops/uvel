import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Glass, GlassContainer } from "../../components/Glass";
import { ProductCard } from "../../components/ProductCard";
import { CATEGORIES, GARMENTS } from "../../lib/catalog";
import { colors } from "../../lib/theme";

export default function Shop() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
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
        {filtered.map((g) => (
          <View key={g.id} style={styles.cell}>
            <ProductCard garment={g} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink },
  content: { padding: 20, paddingBottom: 48 },
  kicker: { color: colors.subtle, letterSpacing: 2, fontSize: 11 },
  title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, marginTop: 8 },
  p: { color: colors.muted, marginTop: 8, marginBottom: 16 },
  search: { borderRadius: 999, paddingHorizontal: 16 },
  input: { color: colors.bone, height: 48 },
  row: { flexDirection: "row", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.bone },
  chipText: { color: colors.bone, fontSize: 13 },
  chipTextOn: { color: colors.ink },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 20 },
  cell: { width: "47%", flexGrow: 1 },
});
