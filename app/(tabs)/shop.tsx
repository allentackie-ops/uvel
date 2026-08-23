import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard, ListingEmpty } from "../../components/ListingCard";
import { CATEGORIES } from "../../lib/catalog";
import { forYou, matchListings, matchLookImage } from "../../lib/lookMatch";
import { getMarket } from "../../lib/markets";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { bundledLooks } from "../../lib/trends";
import { listedPieces, useWardrobe } from "../../lib/wardrobe";

export default function Shop() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const { country, styles: taste } = useUvel();
  const market = getMarket(country);
  const { q: qParam, look: lookParam } = useLocalSearchParams<{ q?: string; look?: string }>();
  const [q, setQ] = useState(qParam ?? "");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const [aiIds, setAiIds] = useState<string[] | null>(null);
  useWardrobe();

  const look = useMemo(
    () => (typeof lookParam === "string" ? bundledLooks().find((l) => l.id === lookParam) : undefined),
    [lookParam],
  );

  useEffect(() => {
    if (typeof qParam === "string") setQ(qParam);
  }, [qParam]);

  const live = listedPieces();

  useEffect(() => {
    if (!look?.imageUrl || !live.length) {
      setAiIds(null);
      return;
    }
    let gone = false;
    void matchLookImage(look.imageUrl, live).then((ids) => {
      if (!gone && ids) setAiIds(ids);
    });
    return () => {
      gone = true;
    };
  }, [look?.id, live.length]);

  const ranked = useMemo(() => {
    let rows = look ? matchListings(look, live, taste) : forYou(live, taste, country);
    if (look && aiIds?.length) {
      const hit = new Set(aiIds);
      rows = [...rows.filter((p) => hit.has(p.id)), ...rows.filter((p) => !hit.has(p.id))];
    }
    const needle = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (cat !== "All" && p.category !== cat) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        p.brand.toLowerCase().includes(needle) ||
        p.color.toLowerCase().includes(needle) ||
        p.notes.toLowerCase().includes(needle)
      );
    });
  }, [live, look, aiIds, q, cat, taste, country]);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{look ? "Shop the look" : "Shop"}</Text>
      {look ? (
        <Text style={styles.look}>{look.title}</Text>
      ) : (
        <Pressable onPress={() => router.push("/store")} style={styles.store}>
          <Text style={styles.storeTxt}>
            {market.name} · {market.currency}
          </Text>
          <Text style={styles.storeGo}>Change</Text>
        </Pressable>
      )}

      <View style={styles.search}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          placeholder={look ? "Narrow this look" : "Search what’s listed"}
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
        {ranked.length} {ranked.length === 1 ? "listing" : "listings"} · real people selling
      </Text>

      <View style={styles.grid}>
        {ranked.map((p) => (
          <View key={p.id} style={styles.cell}>
            <ListingCard piece={p} />
          </View>
        ))}
      </View>

      {ranked.length === 0 ? (
        <ListingEmpty copy="Nothing listed yet that matches. When someone puts a piece up, it shows here — not catalog filler." />
      ) : null}
    </ScrollView>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingHorizontal: 16, paddingBottom: 48 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 36 },
    look: { color: colors.muted, marginTop: 6, fontSize: 16 },
    store: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
    storeTxt: { color: colors.muted, fontSize: 15 },
    storeGo: { color: "#D6E27A", fontSize: 13, fontWeight: "700" },
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
  });
}
