import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OrbitLoader } from "../../components/OrbitLoader";
import { usd } from "../../lib/catalog";
import { pickFromLibrary, takePhoto } from "../../lib/photo";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { dressPerson } from "../../lib/tryon";
import { listedPieces, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";

type GarmentPick =
  | { kind: "uvel"; piece: ClosetPiece }
  | { kind: "photo"; uri: string; name: string };

export default function Mirror() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  useWardrobe();
  const live = listedPieces();
  const person = app.personUri;
  const [picked, setPicked] = useState<GarmentPick | null>(null);
  const [link, setLink] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showLink, setShowLink] = useState(false);

  const garmentUri = picked?.kind === "uvel" ? picked.piece.photo : picked?.uri;
  const garmentName = picked?.kind === "uvel" ? picked.piece.name : picked?.name ?? "this look";
  const garmentCat = picked?.kind === "uvel" ? picked.piece.category : "clothes";

  function askPerson() {
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

  async function pickGarment(fromCamera: boolean) {
    try {
      const uri = fromCamera ? await takePhoto(false) : await pickFromLibrary();
      if (!uri) return;
      setPicked({ kind: "photo", uri, name: "this look" });
      setResult(null);
      setErr("");
    } catch (e) {
      Alert.alert("Photo", e instanceof Error ? e.message : "Couldn’t open that.");
    }
  }

  function useLink() {
    const u = link.trim();
    if (!u) return;
    setPicked({ kind: "photo", uri: u, name: "this look" });
    setShowLink(false);
    setResult(null);
    setErr("");
  }

  function clearPick() {
    setPicked(null);
    setResult(null);
    setErr("");
    setShowLink(false);
  }

  async function run() {
    if (!person || !garmentUri) return;
    if (!app.isPlus && app.remainingTryOns <= 0) {
      router.push("/plus");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const dressed = await dressPerson({
        personUri: person,
        garment: { uri: garmentUri },
        garmentName,
        category: garmentCat,
      });
      app.consumeTryOn();
      setResult(dressed);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      setErr(
        /timeout|timed out|unexpectedexception|fetch failed|expo modules/i.test(raw)
          ? "That look took too long. Try again."
          : raw || "Couldn’t dress you in that.",
      );
    } finally {
      setBusy(false);
    }
  }

  const canTry = Boolean(person && picked && !busy);

  return (
    <View style={styles.page}>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>ON YOU</Text>
          <Text style={styles.head}>The mirror</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 108 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.lede}>See yourself in it before you buy. From Uvel, or anything you point at.</Text>

        <View style={styles.hero}>
          {result ? (
            <Image source={{ uri: result }} style={styles.fill} contentFit="cover" />
          ) : person ? (
            <Image source={{ uri: person }} style={styles.fill} contentFit="cover" />
          ) : (
            <View style={styles.need}>
              <Text style={styles.needH}>Your mirror pic</Text>
              <Text style={styles.needP}>Head to shoes. Same one from setup, or a new shot.</Text>
              <View style={styles.needRow}>
                <Pressable onPress={() => void fromCamera()} style={styles.needBtn}>
                  <Text style={styles.needBtnTxt}>Camera</Text>
                </Pressable>
                <Pressable onPress={() => void fromLibrary()} style={styles.needBtnGhost}>
                  <Text style={styles.needBtnGhostTxt}>Library</Text>
                </Pressable>
              </View>
            </View>
          )}
          {person && !busy ? (
            <View style={styles.changeWrap} pointerEvents="box-none">
              <Pressable onPress={askPerson} style={styles.change}>
                <Text style={styles.changeTxt}>📷  Change photo</Text>
              </Pressable>
            </View>
          ) : null}
          {busy ? (
            <View style={styles.spin}>
              <OrbitLoader />
            </View>
          ) : null}
        </View>

        <View style={styles.headRow}>
          <Text style={styles.h2}>From Uvel</Text>
          <Pressable onPress={() => router.push("/(tabs)/shop")}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {live.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {live.slice(0, 16).map((p) => {
              const on = picked?.kind === "uvel" && picked.piece.id === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setPicked({ kind: "uvel", piece: p });
                    setResult(null);
                    setErr("");
                  }}
                  style={[styles.uvelCard, on && styles.uvelOn]}
                >
                  <View>
                    <Image source={{ uri: p.photo }} style={styles.uvelImg} contentFit="cover" />
                    {on ? (
                      <View style={styles.trying}>
                        <Text style={styles.tryingTxt}>Trying</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.uvelMeta}>
                    <Text style={styles.uvelName} numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text style={styles.uvelPrice}>{usd(p.listPriceCents, p.currency || "USD")}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={styles.empty}>When people list on Uvel, those pieces land here to try on.</Text>
        )}

        <Text style={[styles.h2, { paddingHorizontal: 20, marginTop: 26 }]}>From anywhere</Text>
        <View style={styles.anywhere}>
          <Pressable onPress={() => void pickGarment(true)} style={[styles.chip, picked?.kind === "photo" && !showLink && styles.chipOn]}>
            <Text style={[styles.chipTxt, picked?.kind === "photo" && !showLink && styles.chipTxtOn]}>📷  Camera</Text>
          </Pressable>
          <Pressable onPress={() => void pickGarment(false)} style={styles.chip}>
            <Text style={styles.chipTxt}>🖼  Photos</Text>
          </Pressable>
          <Pressable onPress={() => setShowLink((v) => !v)} style={[styles.chip, showLink && styles.chipOn]}>
            <Text style={[styles.chipTxt, showLink && styles.chipTxtOn]}>📋  Paste</Text>
          </Pressable>
        </View>
        {showLink ? (
          <View style={styles.linkRow}>
            <TextInput
              placeholder="Image or post link"
              placeholderTextColor="rgba(244,240,230,0.35)"
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
              keyboardType="url"
              style={styles.input}
            />
            <Pressable onPress={useLink} style={styles.linkGo}>
              <Text style={styles.linkGoTxt}>Use</Text>
            </Pressable>
          </View>
        ) : null}

        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Pressable onPress={() => void run()} disabled={!canTry} style={[styles.cta, !canTry && styles.ctaOff]}>
          <Text style={[styles.ctaTxt, !canTry && styles.ctaTxtOff]}>
            {busy ? "Dressing you…" : "Try this look"}
          </Text>
        </Pressable>
        <Pressable onPress={clearPick} style={styles.ghostCta}>
          <Text style={styles.ghostCtaTxt}>Pick something else</Text>
        </Pressable>
        <Text style={styles.foot}>Point at any piece online or in real life.{"\n"}Uvel will show it on you.</Text>
      </ScrollView>
    </View>
  );
}

function make(_colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: "#0B0A08" },
    top: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 4,
    },
    kicker: { color: "rgba(244,240,230,0.42)", letterSpacing: 1.8, fontSize: 11, fontWeight: "600" },
    head: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 34, marginTop: 4, lineHeight: 38 },
    search: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.28)",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    searchTxt: { color: "#F4F0E6", fontSize: 18, fontWeight: "500" },
    lede: {
      color: "rgba(244,240,230,0.62)",
      fontSize: 16,
      lineHeight: 23,
      paddingHorizontal: 20,
      marginTop: 8,
      marginBottom: 18,
    },
    hero: {
      marginHorizontal: 16,
      height: 480,
      borderRadius: 22,
      overflow: "hidden",
      backgroundColor: "#1A1915",
    },
    fill: { width: "100%", height: "100%" },
    need: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 8 },
    needH: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 26 },
    needP: { color: "rgba(244,240,230,0.62)", textAlign: "center", marginBottom: 8 },
    needRow: { flexDirection: "row", gap: 10, marginTop: 8 },
    needBtn: {
      height: 44,
      paddingHorizontal: 20,
      borderRadius: 22,
      backgroundColor: "#F4F0E6",
      alignItems: "center",
      justifyContent: "center",
    },
    needBtnTxt: { color: "#16140F", fontWeight: "700" },
    needBtnGhost: {
      height: 44,
      paddingHorizontal: 20,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    needBtnGhostTxt: { color: "#F4F0E6", fontWeight: "600" },
    spin: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(11,10,8,0.5)",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    spinTxt: { color: "#F4F0E6", letterSpacing: 1.2, textTransform: "uppercase", fontSize: 12 },
    changeWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 16,
      alignItems: "center",
    },
    change: {
      backgroundColor: "rgba(18,17,14,0.82)",
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.18)",
      height: 36,
      paddingHorizontal: 16,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    changeTxt: { color: "#F4F0E6", fontSize: 13, fontWeight: "600" },
    headRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      marginTop: 26,
      marginBottom: 14,
    },
    h2: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 26 },
    seeAll: { color: "rgba(244,240,230,0.42)", fontSize: 15 },
    strip: { paddingHorizontal: 16, gap: 12, paddingRight: 28 },
    uvelCard: {
      width: 168,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: "#161512",
      borderWidth: 1,
      borderColor: "transparent",
    },
    uvelOn: { borderColor: "rgba(244,240,230,0.28)" },
    uvelImg: { width: 168, height: 210, backgroundColor: "#1A1915" },
    trying: {
      position: "absolute",
      top: 10,
      left: 10,
      backgroundColor: "#F4F0E6",
      paddingHorizontal: 10,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    tryingTxt: { color: "#16140F", fontSize: 11, fontWeight: "700" },
    uvelMeta: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
    uvelName: { color: "#F4F0E6", fontSize: 14, fontWeight: "600", lineHeight: 18 },
    uvelPrice: { color: "#F4F0E6", fontSize: 14, fontWeight: "700", marginTop: 4 },
    empty: { color: "rgba(244,240,230,0.5)", paddingHorizontal: 20, fontSize: 14, lineHeight: 20 },
    anywhere: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 14, flexWrap: "wrap" },
    chip: {
      height: 42,
      paddingHorizontal: 16,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.16)",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#141310",
    },
    chipOn: { backgroundColor: "#F4F0E6", borderColor: "#F4F0E6" },
    chipTxt: { color: "#F4F0E6", fontWeight: "600", fontSize: 14 },
    chipTxtOn: { color: "#16140F" },
    linkRow: {
      marginHorizontal: 16,
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#1A1915",
      borderRadius: 16,
      paddingLeft: 14,
    },
    input: { flex: 1, color: "#F4F0E6", height: 46, fontSize: 15 },
    linkGo: { paddingHorizontal: 16, height: 46, alignItems: "center", justifyContent: "center" },
    linkGoTxt: { color: "#D6E27A", fontWeight: "700" },
    err: { color: "#C45C5C", marginTop: 14, marginHorizontal: 20, fontSize: 14, lineHeight: 20 },
    cta: {
      marginHorizontal: 16,
      marginTop: 22,
      height: 54,
      borderRadius: 27,
      backgroundColor: "#F4F0E6",
      alignItems: "center",
      justifyContent: "center",
    },
    ctaOff: { opacity: 0.45 },
    ctaTxt: { color: "#16140F", fontWeight: "700", fontSize: 16 },
    ctaTxtOff: { color: "#16140F" },
    ghostCta: {
      marginHorizontal: 16,
      marginTop: 10,
      height: 54,
      borderRadius: 27,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.14)",
      backgroundColor: "#141310",
      alignItems: "center",
      justifyContent: "center",
    },
    ghostCtaTxt: { color: "#F4F0E6", fontWeight: "600", fontSize: 16 },
    foot: {
      color: "rgba(244,240,230,0.38)",
      textAlign: "center",
      fontSize: 13,
      lineHeight: 19,
      marginTop: 16,
      paddingHorizontal: 40,
    },
  });
}
