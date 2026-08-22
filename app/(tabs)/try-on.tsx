import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Glass } from "../../components/Glass";
import { GARMENTS, getGarment, usd } from "../../lib/catalog";
import { useUvel } from "../../lib/store";
import { colors } from "../../lib/theme";

export default function TryOn() {
  const { g } = useLocalSearchParams<{ g?: string }>();
  const app = useUvel();
  const [picked, setPicked] = useState(g ?? GARMENTS[0].id);
  const [result, setResult] = useState(false);
  const [busy, setBusy] = useState(false);
  const garment = getGarment(picked);

  useEffect(() => {
    if (g) setPicked(g);
  }, [g]);

  async function addPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!res.canceled) {
      app.setPerson(res.assets[0].uri);
      setResult(false);
    }
  }

  async function run() {
    if (!app.personUri) return;
    if (!app.consumeTryOn()) {
      router.push("/plus");
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900));
    setResult(true);
    setBusy(false);
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>TRY ON</Text>
      <Text style={styles.title}>Before you buy.</Text>
      <Text style={styles.p}>A full-length photo in natural light works best. We keep your face and pose — only the clothes change.</Text>

      <View style={styles.pair}>
        <Pressable onPress={() => void addPhoto()} style={styles.half}>
          <Glass style={styles.well}>
            {app.personUri ? (
              <Image source={{ uri: app.personUri }} style={styles.fill} contentFit="cover" />
            ) : (
              <Text style={styles.placeholder}>Your photo</Text>
            )}
          </Glass>
        </Pressable>
        <Glass style={[styles.well, styles.half]}>
          {result && app.personUri ? (
            <View style={styles.fill}>
              <Image source={{ uri: app.personUri }} style={styles.fill} contentFit="cover" />
              {garment ? (
                <Image source={garment.image} style={styles.overlay} contentFit="contain" />
              ) : null}
            </View>
          ) : garment ? (
            <Image source={garment.image} style={styles.fill} contentFit="cover" />
          ) : null}
        </Glass>
      </View>

      <Text style={styles.meta}>CHOOSE A PIECE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {GARMENTS.map((item) => (
          <Pressable key={item.id} onPress={() => { setPicked(item.id); setResult(false); }} style={styles.pick}>
            <Image source={item.image} style={[styles.pickImg, picked === item.id && styles.pickOn]} contentFit="cover" />
            <Text style={styles.pickName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.p}>{usd(item.priceCents)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable onPress={() => void run()} style={{ marginTop: 20 }}>
        <Glass interactive style={styles.cta}>
          <Text style={styles.ctaText}>{busy ? "Dressing you…" : `Try on ${garment?.name ?? "this piece"}`}</Text>
        </Glass>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink },
  content: { padding: 20, paddingBottom: 48 },
  kicker: { color: colors.subtle, letterSpacing: 2, fontSize: 11 },
  title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, marginTop: 8 },
  p: { color: colors.muted, marginTop: 8, fontSize: 13, lineHeight: 18 },
  meta: { color: colors.subtle, letterSpacing: 1.4, fontSize: 11, marginTop: 20, marginBottom: 10 },
  pair: { flexDirection: "row", gap: 12, marginTop: 18 },
  half: { flex: 1 },
  well: { height: 260, borderRadius: 24, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  fill: { width: "100%", height: "100%" },
  overlay: { position: "absolute", width: "78%", height: "70%", top: "22%", alignSelf: "center", opacity: 0.78 },
  placeholder: { color: colors.subtle },
  pick: { width: 108, marginRight: 12 },
  pickImg: { width: 108, height: 148, borderRadius: 16 },
  pickOn: { borderWidth: 2, borderColor: colors.bone },
  pickName: { color: colors.bone, fontSize: 12, marginTop: 6 },
  cta: { backgroundColor: colors.pulse, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  ctaText: { color: colors.bone, fontWeight: "600" },
});
