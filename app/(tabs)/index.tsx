import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Glass, GlassContainer } from "../../components/Glass";
import { ProductCard } from "../../components/ProductCard";
import { GARMENTS, TRENDS, getGarment, type Trend } from "../../lib/catalog";
import { useColors, type Colors } from "../../lib/theme";

export default function Today() {
  const colors = useColors();
  const styles = make(colors);
  const [source, setSource] = useState<"All" | Trend["source"]>("All");
  const visible = source === "All" ? TRENDS : TRENDS.filter((t) => t.source === source);
  const featured = visible[0] ?? TRENDS[0];
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 48 }}>
      <View>
        <Image source={featured.image} style={styles.hero} contentFit="cover" />
        <Glass effect="clear" style={styles.heroCard}>
          <Text style={styles.kicker}>{today}</Text>
          <Text style={styles.title}>{featured.title}</Text>
          <Text style={styles.summary}>{featured.summary}</Text>
          <View style={styles.row}>
            <Glass style={styles.chip}>
              <Text style={styles.chipText}>{featured.source}</Text>
            </Glass>
            <Pressable onPress={() => router.push("/(tabs)/shop")} style={styles.ctaWrap}>
              <Glass effect="regular" interactive style={styles.cta}>
                <Text style={styles.ctaText}>Shop the look</Text>
              </Glass>
            </Pressable>
          </View>
        </Glass>
      </View>

      <View style={styles.body}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <GlassContainer spacing={8} style={styles.chips}>
            {(["All", "TikTok", "Instagram", "Snapchat", "X"] as const).map((s) => (
              <Pressable key={s} onPress={() => setSource(s)}>
                <Glass interactive style={[styles.filter, source === s && styles.filterOn]}>
                  <Text style={[styles.filterText, source === s && styles.filterTextOn]}>{s}</Text>
                </Glass>
              </Pressable>
            ))}
          </GlassContainer>
        </ScrollView>

        <Text style={styles.h2}>Today in fashion</Text>
        {visible.map((trend) => (
          <View key={trend.slug} style={{ marginBottom: 28 }}>
            <Image source={trend.image} style={styles.trendImg} contentFit="cover" />
            <Text style={styles.meta}>{trend.source} · Latest day</Text>
            <Text style={styles.h3}>{trend.title}</Text>
            <Text style={styles.p}>{trend.summary}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {trend.garmentIds.map((id) => {
                const g = getGarment(id);
                if (!g) return null;
                return (
                  <View key={id} style={{ width: 140, marginRight: 12 }}>
                    <ProductCard garment={g} />
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ))}

        <Text style={styles.h2}>On Uvel now</Text>
        <View style={styles.grid}>
          {GARMENTS.slice(0, 8).map((g) => (
            <View key={g.id} style={styles.cell}>
              <ProductCard garment={g} />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink },
  hero: { width: "100%", height: 560 },
  heroCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    borderRadius: 28,
    padding: 18,
  },
  kicker: { color: colors.muted, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  title: { color: colors.bone, fontSize: 32, fontFamily: "Georgia", marginTop: 6 },
  summary: { color: colors.bone, opacity: 0.9, marginTop: 8, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: colors.bone, fontSize: 12 },
  ctaWrap: { borderRadius: 999, overflow: "hidden" },
  cta: { backgroundColor: colors.pulse, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  ctaText: { color: colors.bone, fontWeight: "600", fontSize: 13 },
  body: { padding: 20 },
  chips: { flexDirection: "row", gap: 8, marginBottom: 8 },
  filter: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  filterOn: { backgroundColor: colors.pulse },
  filterText: { color: colors.bone, fontSize: 13 },
  filterTextOn: { color: colors.bone },
  h2: { color: colors.bone, fontFamily: "Georgia", fontSize: 26, marginTop: 18, marginBottom: 12 },
  h3: { color: colors.bone, fontFamily: "Georgia", fontSize: 22, marginTop: 8 },
  p: { color: colors.muted, marginTop: 6, lineHeight: 20 },
  meta: { color: colors.subtle, fontSize: 12, marginTop: 10 },
  trendImg: { width: "100%", height: 420, borderRadius: 28 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { width: "47%", flexGrow: 1 },
  });
}
