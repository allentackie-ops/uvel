import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OrbitLoader } from "../components/OrbitLoader";
import { GARMENTS, getGarment } from "../lib/catalog";
import { pickFromLibrary, takePhoto } from "../lib/photo";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { dressPerson } from "../lib/tryon";
import { getPiece, useWardrobe } from "../lib/wardrobe";

export default function TryOn() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { g, piece: pieceId } = useLocalSearchParams<{ g?: string; piece?: string }>();
  const app = useUvel();
  useWardrobe();
  const closet = pieceId ? getPiece(pieceId) : undefined;
  const [picked, setPicked] = useState(g ?? GARMENTS[0].id);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const asked = useRef(false);
  const garment = closet ? null : getGarment(picked);
  const pieceName = closet?.name ?? garment?.name;
  const pieceCategory = closet?.category ?? garment?.category;
  const pieceImage = closet ? { uri: closet.photo } : garment?.image;
  const person = app.personUri;

  useEffect(() => {
    if (g) setPicked(g);
  }, [g]);

  useEffect(() => {
    if (asked.current || person || !app.hydrated) return;
    asked.current = true;
    askPhoto();
  }, [person, app.hydrated]);

  function askPhoto() {
    const options = ["Camera", "Library", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2, title: "Full-length photo of you" },
        (i) => {
          if (i === 0) void fromCamera();
          if (i === 1) void fromLibrary();
        },
      );
      return;
    }
    Alert.alert("Full-length photo of you", "Mirror pic, head to shoes.", [
      { text: "Camera", onPress: () => void fromCamera() },
      { text: "Library", onPress: () => void fromLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function fromCamera() {
    try {
      const uri = await takePhoto(false);
      if (uri) {
        app.setPerson(uri);
        setResult(null);
      }
    } catch (e) {
      Alert.alert("Camera", e instanceof Error ? e.message : "Couldn’t open camera.");
    }
  }

  async function fromLibrary() {
    try {
      const uri = await pickFromLibrary();
      if (uri) {
        app.setPerson(uri);
        setResult(null);
      }
    } catch (e) {
      Alert.alert("Photos", e instanceof Error ? e.message : "Couldn’t open photos.");
    }
  }

  async function run() {
    if (!person || !pieceImage) return;
    setErr("");
    setBusy(true);
    try {
      const dressed = await dressPerson({
        personUri: person,
        garment: pieceImage,
        garmentName: pieceName,
        category: pieceCategory,
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
    <View style={styles.page}>
      <StatusBar style={colors.ink === "#000000" ? "light" : "dark"} />
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.back}>
          <Text style={styles.backTxt}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle}>Try on me</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{pieceName ?? "Before you buy"}</Text>
        <Text style={styles.p}>
          {person
            ? "We’ll keep your face, body, and room — you come back wearing the piece."
            : "Need a full-length mirror pic of you first. Head to shoes."}
        </Text>

        <View style={styles.hero}>
          {result ? (
            <Image source={{ uri: result }} style={styles.fill} contentFit="contain" />
          ) : person ? (
            <Image source={{ uri: person }} style={styles.fill} contentFit="cover" />
          ) : pieceImage ? (
            <Image source={pieceImage} style={styles.fill} contentFit="cover" />
          ) : (
            <Text style={styles.placeholder}>Your photo</Text>
          )}
          {busy ? (
            <View style={styles.spin}>
              <OrbitLoader />
            </View>
          ) : null}
          {!person && !busy ? (
            <View style={styles.need}>
              <Text style={styles.needH}>Add your photo</Text>
              <Text style={styles.needP}>The one from setup, or a new mirror shot.</Text>
              <View style={styles.needRow}>
                <Pressable onPress={() => void fromCamera()} style={styles.needBtn}>
                  <Text style={styles.needBtnTxt}>Camera</Text>
                </Pressable>
                <Pressable onPress={() => void fromLibrary()} style={styles.needBtn}>
                  <Text style={styles.needBtnTxt}>Library</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {result ? <Text style={styles.caption}>You, in the {pieceName?.toLowerCase()}.</Text> : null}
        {person && !result ? (
          <Pressable onPress={askPhoto} style={styles.change}>
            <Text style={styles.changeTxt}>Change photo</Text>
          </Pressable>
        ) : null}

        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Pressable onPress={() => void run()} disabled={busy || !person} style={[styles.cta, (!person || busy) && styles.ctaOff]}>
          <Text style={[styles.ctaTxt, (!person || busy) && styles.ctaTxtOff]}>
            {busy ? "Dressing you…" : person ? `See me in this` : "Add a photo first"}
          </Text>
        </Pressable>
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
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 28, lineHeight: 34 },
    p: { color: colors.muted, marginTop: 8, fontSize: 15, lineHeight: 22, marginBottom: 16 },
    hero: {
      height: 480,
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    fill: { width: "100%", height: "100%" },
    caption: { color: colors.bone, marginTop: 12, fontSize: 15 },
    placeholder: { color: colors.subtle },
    change: { alignSelf: "center", marginTop: 12 },
    changeTxt: { color: colors.subtle, fontSize: 14, textDecorationLine: "underline" },
    cta: {
      marginTop: 24,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaOff: { backgroundColor: colors.surface },
    ctaTxt: { color: colors.successInk, fontWeight: "700", fontSize: 16 },
    ctaTxtOff: { color: colors.muted },
    err: { color: colors.danger, marginTop: 14, fontSize: 14, lineHeight: 20 },
    spin: {
      ...StyleSheet.absoluteFill,
      backgroundColor: `${colors.surface}80`,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    spinTxt: { color: colors.bone, letterSpacing: 1.2, textTransform: "uppercase", fontSize: 12 },
    need: {
      ...StyleSheet.absoluteFill,
      backgroundColor: `${colors.surface}B8`,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      gap: 8,
    },
    needH: { color: colors.bone, fontFamily: "Georgia", fontSize: 24 },
    needP: { color: `${colors.bone}B2`, textAlign: "center", marginBottom: 8 },
    needRow: { flexDirection: "row", gap: 10, marginTop: 8 },
    needBtn: {
      height: 44,
      paddingHorizontal: 20,
      borderRadius: 22,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    needBtnTxt: { color: colors.successInk, fontWeight: "700" },
  });
}
