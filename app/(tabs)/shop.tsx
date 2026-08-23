import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard, ListingEmpty } from "../../components/ListingCard";
import { CATEGORIES } from "../../lib/catalog";
import { forYou, lensScan, matchListings } from "../../lib/lookMatch";
import { takeLookScan, clearLookScan } from "../../lib/lookSearch";
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
  const { q: qParam, look: lookParam, scan } = useLocalSearchParams<{ q?: string; look?: string; scan?: string }>();
  const [q, setQ] = useState(qParam ?? "");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const [aiIds, setAiIds] = useState<string[] | null>(null);
  const [terms, setTerms] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const [scanTitle, setScanTitle] = useState("");
  useWardrobe();

  const look = useMemo(
    () => (typeof lookParam === "string" ? bundledLooks().find((l) => l.id === lookParam) : undefined),
    [lookParam],
  );

  useEffect(() => {
    if (typeof qParam === "string") setQ(qParam);
  }, [qParam]);

  useEffect(() => {
    const grabbed = takeLookScan();
    if (grabbed.frame) {
      setFrame(grabbed.frame);
      setScanTitle(grabbed.title);
    } else if (look?.imageUrl) {
      setFrame(look.imageUrl);
    }
    return () => clearLookScan();
  }, [lookParam, scan, look?.imageUrl]);

  const live = listedPieces();

  useEffect(() => {
    if (!frame || !live.length) {
      setAiIds(null);
      setScanning(false);
      return;
    }
    let gone = false;
    setScanning(true);
    setAiIds(null);
    setTerms([]);
    void lensScan(frame, live).then((hit) => {
      if (gone) return;
      setAiIds(hit?.ids ?? []);
      setTerms(hit?.terms ?? []);
      setScanning(false);
    });
    return () => {
      gone = true;
    };
  }, [frame, live.length]);

  const scanningLook = Boolean(look || frame);

  const ranked = useMemo(() => {
    const query = terms.length ? terms.join(" ") : look?.shopQuery || look?.title || q;
    let rows = scanningLook
      ? matchListings({ title: query, summary: query, shopQuery: query }, live, taste)
      : look
        ? matchListings(look, live, taste)
        : forYou(live, taste, country);
    if (aiIds?.length) {
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
  }, [live, look, aiIds, terms, q, cat, taste, country, scanningLook]);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{scanningLook ? "Shop the look" : "Shop"}</Text>
      {scanningLook ? (
        <Text style={styles.look}>{scanTitle || look?.title || "This frame"}</Text>
      ) : (
        <Pressable onPress={() => router.push("/store")} style={styles.store}>
          <Text style={styles.storeTxt}>
            {market.name} · {market.currency}
          </Text>
          <Text style={styles.storeGo}>Change</Text>
        </Pressable>
      )}

      {frame ? <Image source={{ uri: frame }} style={styles.frame} contentFit="contain" /> : null}
      {scanning ? <Text style={styles.scanning}>Visual search · finding these clothes on Uvel…</Text> : null}

      <View style={styles.search}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          placeholder={scanningLook ? "Narrow this look" : "Search what’s listed"}
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
        {scanning
          ? "Looking at the clothes in this frame"
          : `${ranked.length} ${ranked.length === 1 ? "similar listing" : "similar listings"}`}
      </Text>

      <View style={styles.grid}>
        {scanning
          ? null
          : ranked.map((p) => (
              <View key={p.id} style={styles.cell}>
                <ListingCard piece={p} />
              </View>
            ))}
      </View>

      {!scanning && ranked.length === 0 ? (
        <ListingEmpty copy="Nothing listed yet that looks like this. When someone puts the piece up, it shows here." />
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
    frame: {
      marginTop: 16,
      height: 420,
      borderRadius: 16,
      backgroundColor: "#0B0A08",
    },
    scanning: { color: "#D6E27A", marginTop: 10, fontSize: 13, fontWeight: "600" },
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
