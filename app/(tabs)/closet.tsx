import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Glass } from "../../components/Glass";
import { usd } from "../../lib/catalog";
import {
  addPiece,
  analyzePhoto,
  useWardrobe,
  type ClosetPiece,
} from "../../lib/wardrobe";
import { useColors, type Colors } from "../../lib/theme";

export default function Closet() {
  const colors = useColors();
  const styles = make(colors);
  const pieces = useWardrobe();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Omit<ClosetPiece, "id" | "status" | "createdAt"> | null>(null);

  async function shoot(camera: boolean) {
    const fn = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const res = await fn({ mediaTypes: ["images"], quality: 0.8 });
    if (!res.canceled) {
      setPreview(res.assets[0].uri);
      setDraft(null);
    }
  }

  async function scan() {
    if (!preview) return;
    setBusy(true);
    try {
      setDraft(await analyzePhoto(preview));
    } finally {
      setBusy(false);
    }
  }

  const owned = pieces.filter((p) => p.status === "owned");
  const listed = pieces.filter((p) => p.status === "listed");

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>CLOSET</Text>
      <Text style={styles.title}>Your wardrobe</Text>
      <Text style={styles.p}>Photograph a piece you own. Uvel files it. List it when you want it gone.</Text>

      <View style={styles.row}>
        <Pressable onPress={() => void shoot(true)}>
          <Glass interactive style={styles.chip}>
            <Text style={styles.chipText}>Camera</Text>
          </Glass>
        </Pressable>
        <Pressable onPress={() => void shoot(false)}>
          <Glass interactive style={styles.chip}>
            <Text style={styles.chipText}>Photos</Text>
          </Glass>
        </Pressable>
      </View>

      {preview ? (
        <View style={{ marginTop: 16 }}>
          <Image source={{ uri: preview }} style={styles.preview} contentFit="cover" />
          {!draft ? (
            <Pressable onPress={() => void scan()} disabled={busy}>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>{busy ? "Reading the piece…" : "Scan into wardrobe"}</Text>
              </View>
            </Pressable>
          ) : (
            <View style={{ marginTop: 14, gap: 10 }}>
              <Text style={styles.meta}>AI read. Correct anything that’s off.</Text>
              <TextInput style={styles.input} value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
              <TextInput style={styles.input} value={draft.color} onChangeText={(color) => setDraft({ ...draft, color })} />
              <TextInput style={styles.input} value={draft.size} onChangeText={(size) => setDraft({ ...draft, size })} />
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={String(Math.round(draft.listPriceCents / 100))}
                onChangeText={(v) =>
                  setDraft({ ...draft, listPriceCents: Math.max(1, Number(v) || 0) * 100 })
                }
              />
              <Pressable
                onPress={() => {
                  addPiece(draft);
                  setPreview(null);
                  setDraft(null);
                }}
              >
                <View style={styles.cta}>
                  <Text style={styles.ctaText}>File in wardrobe</Text>
                </View>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}

      {pieces.length === 0 && !preview ? (
        <Text style={[styles.p, { marginTop: 28 }]}>
          Nothing in here yet. Lay a jacket on the bed, shoot it, and Uvel keeps it.
        </Text>
      ) : null}

      {owned.length > 0 ? (
        <>
          <Text style={styles.h2}>In closet</Text>
          <Grid pieces={owned} colors={colors} />
        </>
      ) : null}
      {listed.length > 0 ? (
        <>
          <Text style={styles.h2}>Listed</Text>
          <Grid pieces={listed} colors={colors} />
        </>
      ) : null}
    </ScrollView>
  );
}

function Grid({ pieces, colors }: { pieces: ClosetPiece[]; colors: Colors }) {
  const styles = make(colors);
  return (
    <View style={styles.grid}>
      {pieces.map((p) => (
        <Pressable key={p.id} style={styles.cell} onPress={() => router.push(`/closet/${p.id}`)}>
          <Image source={{ uri: p.photo }} style={styles.thumb} contentFit="cover" />
          <Text style={styles.meta}>{p.brand}</Text>
          <Text style={styles.h3}>{p.name}</Text>
          <Text style={styles.meta}>{p.status === "listed" ? usd(p.listPriceCents) : p.color}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { padding: 20, paddingBottom: 48 },
    kicker: { color: colors.subtle, letterSpacing: 2, fontSize: 11 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, marginTop: 8 },
    p: { color: colors.muted, marginTop: 8, lineHeight: 20, fontSize: 14 },
    row: { flexDirection: "row", gap: 8, marginTop: 16 },
    chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
    chipText: { color: colors.bone, fontSize: 13 },
    preview: { width: "100%", aspectRatio: 3 / 4, borderRadius: 28 },
    cta: { marginTop: 14, backgroundColor: colors.pulse, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
    ctaText: { color: colors.pulseInk, fontWeight: "600" },
    input: {
      height: 48,
      borderRadius: 999,
      paddingHorizontal: 16,
      color: colors.bone,
      backgroundColor: colors.surface,
    },
    h2: { color: colors.bone, fontFamily: "Georgia", fontSize: 24, marginTop: 28, marginBottom: 12 },
    h3: { color: colors.bone, fontWeight: "600", marginTop: 6 },
    meta: { color: colors.subtle, fontSize: 11, marginTop: 6 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    cell: { width: "47%", flexGrow: 1 },
    thumb: { width: "100%", aspectRatio: 2 / 3, borderRadius: 18 },
  });
}
