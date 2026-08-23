import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass, GlassContainer } from "../components/Glass";
import { withBrandLoad } from "../lib/brandLoad";
import { ListingCard, ListingEmpty } from "../components/ListingCard";
import { matchLookImage } from "../lib/lookMatch";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { listedPieces, useWardrobe, type ClosetPiece } from "../lib/wardrobe";

const SOURCES = ["Camera", "Photos", "Instagram", "Pinterest", "TikTok", "Snapchat", "Link"];

export default function ScanLook() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  useWardrobe();
  const [source, setSource] = useState("Photos");
  const [preview, setPreview] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<ClosetPiece[] | null>(null);

  async function pick(fromCamera: boolean) {
    const fn = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const res = await fn({ mediaTypes: ["images", "videos"], quality: 0.8 });
    if (!res.canceled) setPreview(res.assets[0].uri);
  }

  async function scan() {
    if (!preview && !url.trim()) return;
    if (!app.consumeFind()) {
      router.push("/plus");
      return;
    }
    setBusy(true);
    try {
      await withBrandLoad(async () => {
        const live = listedPieces();
        const image = preview || url.trim();
        const ai =
          image.startsWith("http") || image.startsWith("file") || image.startsWith("ph://") || image.startsWith("content:")
            ? await matchLookImage(image, live)
            : null;
        const picked = ai?.length ? live.filter((p) => ai.includes(p.id)) : [];
        setHits(picked);
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.page}>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.back}>
          <Text style={styles.backTxt}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle}>Find the piece</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>FIND</Text>
        <Text style={styles.title}>Scan a look. Buy the real thing.</Text>
        <Text style={styles.p}>
          Photo or video still from the camera roll, Instagram, TikTok, Pinterest — Uvel searches what’s actually listed.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }}>
          <GlassContainer spacing={8} style={styles.row}>
            {SOURCES.map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  setSource(s);
                  if (s === "Camera") void pick(true);
                  if (s === "Photos") void pick(false);
                }}
              >
                <Glass interactive style={[styles.chip, source === s && styles.chipOn]}>
                  <Text style={[styles.chipText, source === s && styles.chipTextOn]}>{s}</Text>
                </Glass>
              </Pressable>
            ))}
          </GlassContainer>
        </ScrollView>

        <Pressable onPress={() => void pick(source === "Camera")} style={{ marginTop: 16 }}>
          <Glass style={styles.well}>
            {preview ? (
              <Image source={{ uri: preview }} style={styles.preview} contentFit="cover" />
            ) : (
              <View style={styles.empty}>
                <Text style={styles.h3}>Drop a look</Text>
                <Text style={styles.p}>Photo, video still, or a screenshot</Text>
              </View>
            )}
          </Glass>
        </Pressable>

        {["Instagram", "Pinterest", "TikTok", "Snapchat", "Link"].includes(source) ? (
          <Glass style={styles.inputWrap}>
            <TextInput
              placeholder="Paste the post link"
              placeholderTextColor={colors.subtle}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
              style={styles.input}
            />
          </Glass>
        ) : null}

        <Pressable onPress={() => void scan()} style={{ marginTop: 16 }}>
          <Glass interactive style={styles.cta}>
            <Text style={styles.ctaText}>{busy ? "Scanning listings…" : "Find these pieces"}</Text>
          </Glass>
        </Pressable>

        {hits ? (
          <View style={{ marginTop: 28 }}>
            <Text style={styles.h2}>On Uvel</Text>
            {hits.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {hits.map((p) => (
                  <View key={p.id} style={{ width: "47.4%" }}>
                    <ListingCard piece={p} />
                  </View>
                ))}
              </View>
            ) : (
              <ListingEmpty copy="Nobody’s listed this yet. When they do, it shows here." />
            )}
            <Text style={styles.h2}>Closest vintage online</Text>
            {[
              ["Depop", `https://www.depop.com/search/?q=${encodeURIComponent(url || "vintage")}`],
              ["Grailed", `https://www.grailed.com/shop?query=${encodeURIComponent(url || "vintage")}`],
              ["Vestiaire", `https://www.vestiairecollective.com/search/?q=${encodeURIComponent(url || "vintage")}`],
              ["eBay", `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(url || "vintage")}`],
            ].map(([market, href]) => (
              <Pressable key={market} onPress={() => WebBrowser.openBrowserAsync(href)}>
                <Glass style={styles.alt}>
                  <Text style={styles.resultName}>{market}</Text>
                  <Text style={styles.p}>Open listings ranked by price</Text>
                </Glass>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    top: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingBottom: 8,
    },
    back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    backTxt: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    topTitle: { color: colors.bone, fontSize: 16, fontWeight: "600" },
    content: { padding: 20, paddingBottom: 48 },
    kicker: { color: colors.subtle, letterSpacing: 2, fontSize: 11 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, marginTop: 8 },
    p: { color: colors.muted, marginTop: 8, lineHeight: 20, fontSize: 14 },
    h2: { color: colors.bone, fontFamily: "Georgia", fontSize: 24, marginTop: 18, marginBottom: 10 },
    h3: { color: colors.bone, fontFamily: "Georgia", fontSize: 22 },
    row: { flexDirection: "row", gap: 8 },
    chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
    chipOn: { backgroundColor: colors.pulse },
    chipText: { color: colors.bone, fontSize: 13 },
    chipTextOn: { color: colors.bone },
    well: { height: 420, borderRadius: 28, overflow: "hidden" },
    preview: { width: "100%", height: "100%" },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    inputWrap: { marginTop: 12, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 4 },
    input: { color: colors.bone, height: 44 },
    cta: { borderRadius: 999, paddingVertical: 16, alignItems: "center" },
    ctaText: { color: colors.ink, fontWeight: "700", fontSize: 16 },
    resultName: { color: colors.bone, fontWeight: "700", fontSize: 16 },
    alt: { padding: 16, borderRadius: 16, marginBottom: 8 },
  });
}
