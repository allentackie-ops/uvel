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
import { Glass, GlassContainer } from "../../components/Glass";
import { GARMENTS, usd, type Garment } from "../../lib/catalog";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";

const SOURCES = ["Camera", "Photos", "Instagram", "Pinterest", "TikTok", "Snapchat", "Link"];

export default function Find() {
  const colors = useColors();
  const styles = make(colors);
  const app = useUvel();
  const [source, setSource] = useState("Photos");
  const [preview, setPreview] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<Garment[] | null>(null);

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
    await new Promise((r) => setTimeout(r, 700));
    setHits([...GARMENTS].sort(() => 0.5 - Math.random()).slice(0, 3));
    setBusy(false);
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>FIND</Text>
      <Text style={styles.title}>Scan a look. Buy the real thing.</Text>
      <Text style={styles.p}>
        Camera, a screenshot from Instagram, Pinterest, TikTok, Snapchat — or paste a link. Uvel first, then Depop, Grailed, Vestiaire, eBay.
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

      <Pressable
        onPress={() => void pick(source === "Camera")}
        style={{ marginTop: 16 }}
      >
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
          <Text style={styles.ctaText}>{busy ? "Scanning marketplaces…" : "Find these pieces"}</Text>
        </Glass>
      </Pressable>

      {hits ? (
        <View style={{ marginTop: 28 }}>
          <Text style={styles.h2}>On Uvel</Text>
          {hits.map((g) => (
            <Pressable key={g.id} onPress={() => router.push(`/product/${g.id}`)}>
              <Glass style={styles.result}>
                <Image source={g.image} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.meta}>{g.brand}</Text>
                  <Text style={styles.resultName}>{g.name}</Text>
                  <Text style={styles.p}>
                    {usd(g.priceCents)} · {g.condition}
                  </Text>
                </View>
              </Glass>
            </Pressable>
          ))}
          <Text style={styles.h2}>Closest vintage online</Text>
          {[
            ["Depop", "https://www.depop.com/search/?q=vintage+jacket"],
            ["Grailed", "https://www.grailed.com/shop?query=vintage+jacket"],
            ["Vestiaire", "https://www.vestiairecollective.com/search/?q=vintage+jacket"],
            ["eBay", "https://www.ebay.com/sch/i.html?_nkw=vintage+jacket"],
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
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink },
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
  cta: { backgroundColor: colors.pulse, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  ctaText: { color: colors.bone, fontWeight: "600" },
  result: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 18, marginBottom: 10, alignItems: "center" },
  thumb: { width: 72, height: 96, borderRadius: 12 },
  meta: { color: colors.subtle, fontSize: 11 },
  resultName: { color: colors.bone, fontWeight: "600", marginTop: 2 },
  alt: { padding: 14, borderRadius: 18, marginBottom: 8 },
});
}
