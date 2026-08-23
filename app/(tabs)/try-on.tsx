import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Glass } from "../../components/Glass";
import { GARMENTS, getGarment, usd } from "../../lib/catalog";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { dressPerson } from "../../lib/tryon";

export default function TryOn() {
  const colors = useColors();
  const styles = make(colors);
  const { g } = useLocalSearchParams<{ g?: string }>();
  const app = useUvel();
  const [picked, setPicked] = useState(g ?? GARMENTS[0].id);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const garment = getGarment(picked);

  useEffect(() => {
    if (g) setPicked(g);
  }, [g]);

  async function addPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.55 });
    if (!res.canceled) {
      app.setPerson(res.assets[0].uri);
      setResult(null);
      setErr("");
    }
  }

  async function run() {
    if (!app.personUri || !garment) return;
    if (app.remainingTryOns <= 0) {
      router.push("/plus");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const dressed = await dressPerson({
        personUri: app.personUri,
        garment: garment.image,
        garmentName: garment.name,
        category: garment.category,
      });
      app.consumeTryOn();
      setResult(dressed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t dress you in that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>TRY ON</Text>
      <Text style={styles.title}>Before you buy.</Text>
      <Text style={styles.p}>
        A full-length mirror pic. We keep your face, body, and room — you come back wearing the piece.
      </Text>

      <View style={styles.hero}>
        {result ? (
          <Image source={{ uri: result }} style={styles.fill} contentFit="contain" />
        ) : app.personUri ? (
          <Image source={{ uri: app.personUri }} style={styles.fill} contentFit="contain" />
        ) : garment ? (
          <Image source={garment.image} style={styles.fill} contentFit="cover" />
        ) : (
          <Text style={styles.placeholder}>Your photo</Text>
        )}
        {busy ? (
          <View style={styles.spin}>
            <ActivityIndicator color={colors.bone} />
            <Text style={styles.spinTxt}>Dressing you</Text>
          </View>
        ) : null}
      </View>
      {result ? <Text style={styles.caption}>You, in the {garment?.name.toLowerCase()}.</Text> : null}

      <View style={styles.row}>
        <Pressable onPress={() => void addPhoto()} style={{ flex: 1 }}>
          <Glass interactive style={styles.chip}>
            <Text style={styles.chipText}>{app.personUri ? "Change photo" : "Add your photo"}</Text>
          </Glass>
        </Pressable>
      </View>

      <Text style={styles.meta}>CHOOSE A PIECE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {GARMENTS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              setPicked(item.id);
              setResult(null);
              setErr("");
            }}
            style={styles.pick}
          >
            <Image source={item.image} style={[styles.pickImg, picked === item.id && styles.pickOn]} contentFit="cover" />
            <Text style={styles.pickName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.price}>{usd(item.priceCents)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <Pressable onPress={() => void run()} style={{ marginTop: 20 }} disabled={busy || !app.personUri}>
        <Glass interactive style={[styles.cta, (!app.personUri || busy) && { opacity: 0.5 }]}>
          <Text style={styles.ctaText}>
            {busy ? "Dressing you…" : `See me in ${garment?.name ?? "this"}`}
          </Text>
        </Glass>
      </Pressable>
    </ScrollView>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { padding: 20, paddingBottom: 48 },
    kicker: { color: colors.subtle, letterSpacing: 2, fontSize: 11 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, marginTop: 8 },
    p: { color: colors.muted, marginTop: 8, fontSize: 15, lineHeight: 22 },
    meta: { color: colors.subtle, letterSpacing: 1.4, fontSize: 11, marginTop: 20, marginBottom: 10 },
    hero: {
      height: 460,
      borderRadius: 24,
      overflow: "hidden",
      marginTop: 18,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    fill: { width: "100%", height: "100%" },
    caption: { color: colors.bone, marginTop: 10, fontSize: 14 },
    placeholder: { color: colors.subtle },
    row: { flexDirection: "row", marginTop: 12 },
    chip: { paddingVertical: 12, alignItems: "center", borderRadius: 999 },
    chipText: { color: colors.bone, fontWeight: "600" },
    pick: { width: 108, marginRight: 12 },
    pickImg: { width: 108, height: 148, borderRadius: 16 },
    pickOn: { borderWidth: 2, borderColor: colors.bone },
    pickName: { color: colors.bone, fontSize: 12, marginTop: 6 },
    price: { color: colors.muted, fontSize: 12, marginTop: 2 },
    cta: { backgroundColor: colors.pulse, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
    ctaText: { color: "#F4F0E6", fontWeight: "600" },
    err: { color: "#C45C5C", marginTop: 14, fontSize: 14, lineHeight: 20 },
    spin: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: "rgba(18,20,10,0.45)",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    spinTxt: { color: colors.bone, letterSpacing: 1.2, textTransform: "uppercase", fontSize: 12 },
  });
}
