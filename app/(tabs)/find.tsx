import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
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
      setErr(e instanceof Error ? e.message : "Couldn’t dress you in that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.page}>
      <View style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <View>
          <Text style={styles.kicker}>ON YOU</Text>
          <Text style={styles.head}>The mirror</Text>
        </View>
        <Pressable onPress={() => router.push("/scan")} hitSlop={12} style={styles.search} accessibilityLabel="Find the piece">
          <Text style={styles.searchTxt}>⌕</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 108 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.lede}>See yourself in it before you buy. From Uvel, or anything you point at.</Text>

        <View style={styles.hero}>
          {result ? (
            <Image source={{ uri: result }} style={styles.fill} contentFit="contain" />
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
          {busy ? (
            <View style={styles.spin}>
              <ActivityIndicator color="#D6E27A" />
              <Text style={styles.spinTxt}>Dressing you</Text>
            </View>
          ) : null}
        </View>

        {person ? (
          <Pressable onPress={askPerson} style={styles.change}>
            <Text style={styles.changeTxt}>Change photo</Text>
          </Pressable>
        ) : null}

        <Text style={styles.h2}>From Uvel</Text>
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
                  <Image source={{ uri: p.photo }} style={[styles.uvelImg, on && styles.uvelImgOn]} contentFit="cover" />
                  <Text style={styles.uvelName} numberOfLines={2}>
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={styles.empty}>When people list on Uvel, those pieces land here to try on.</Text>
        )}

        <Text style={styles.h2}>From anywhere</Text>
        <View style={styles.anywhere}>
          <Pressable onPress={() => void pickGarment(true)} style={styles.chip}>
            <Text style={styles.chipTxt}>Camera</Text>
          </Pressable>
          <Pressable onPress={() => void pickGarment(false)} style={styles.chip}>
            <Text style={styles.chipTxt}>Photos</Text>
          </Pressable>
          <Pressable onPress={() => setShowLink((v) => !v)} style={[styles.chip, showLink && styles.chipOn]}>
            <Text style={[styles.chipTxt, showLink && styles.chipTxtOn]}>Paste a look</Text>
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

        {picked ? (
          <View style={styles.picked}>
            <Image source={{ uri: garmentUri }} style={styles.pickedImg} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.pickedK}>{picked.kind === "uvel" ? "Uvel listing" : "Your pick"}</Text>
              <Text style={styles.pickedN} numberOfLines={2}>
                {garmentName}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setPicked(null);
                setResult(null);
              }}
            >
              <Text style={styles.clear}>Clear</Text>
            </Pressable>
          </View>
        ) : null}

        {err ? <Text style={styles.err}>{err}</Text> : null}
        {result ? <Text style={styles.caption}>You, in the {garmentName.toLowerCase()}.</Text> : null}

        <Pressable
          onPress={() => void run()}
          disabled={busy || !person || !picked}
          style={[styles.cta, (busy || !person || !picked) && styles.ctaOff]}
        >
          <Text style={[styles.ctaTxt, (busy || !person || !picked) && styles.ctaTxtOff]}>
            {busy ? "Dressing you…" : !person ? "Add your photo first" : !picked ? "Pick something to try" : "See me in this"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: "#0B0A08" },
    top: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    kicker: { color: "rgba(244,240,230,0.45)", letterSpacing: 1.8, fontSize: 11, fontWeight: "600" },
    head: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 28, marginTop: 2 },
    search: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#1A1915",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    searchTxt: { color: "#F4F0E6", fontSize: 22, fontWeight: "700", marginTop: -1 },
    lede: {
      color: "rgba(244,240,230,0.62)",
      fontSize: 15,
      lineHeight: 22,
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    hero: {
      marginHorizontal: 16,
      height: 460,
      borderRadius: 24,
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
    change: { alignSelf: "center", marginTop: 12, marginBottom: 8 },
    changeTxt: { color: "rgba(244,240,230,0.5)", fontSize: 14, textDecorationLine: "underline" },
    h2: {
      color: "#F4F0E6",
      fontFamily: "Georgia",
      fontSize: 24,
      marginTop: 22,
      marginBottom: 12,
      paddingHorizontal: 20,
    },
    strip: { paddingHorizontal: 16, gap: 10, paddingRight: 24 },
    uvelCard: { width: 120 },
    uvelOn: { opacity: 1 },
    uvelImg: {
      width: 120,
      height: 160,
      borderRadius: 16,
      backgroundColor: "#1A1915",
      borderWidth: 2,
      borderColor: "transparent",
    },
    uvelImgOn: { borderColor: "#F4F0E6" },
    uvelName: { color: "#F4F0E6", fontSize: 13, marginTop: 8, lineHeight: 16 },
    empty: { color: "rgba(244,240,230,0.5)", paddingHorizontal: 20, fontSize: 14, lineHeight: 20 },
    anywhere: { flexDirection: "row", gap: 8, paddingHorizontal: 16, flexWrap: "wrap" },
    chip: {
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    chipOn: { backgroundColor: "#F4F0E6", borderColor: "#F4F0E6" },
    chipTxt: { color: "#F4F0E6", fontWeight: "600", fontSize: 13 },
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
    picked: {
      marginHorizontal: 16,
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: "#1A1915",
      borderRadius: 16,
      padding: 10,
    },
    pickedImg: { width: 56, height: 72, borderRadius: 10, backgroundColor: "#111" },
    pickedK: { color: "rgba(244,240,230,0.45)", fontSize: 11, letterSpacing: 0.8, fontWeight: "700" },
    pickedN: { color: "#F4F0E6", fontSize: 15, fontWeight: "600", marginTop: 4 },
    clear: { color: "rgba(244,240,230,0.5)", fontSize: 13 },
    err: { color: "#C45C5C", marginTop: 14, marginHorizontal: 20, fontSize: 14, lineHeight: 20 },
    caption: { color: "#F4F0E6", marginTop: 14, marginHorizontal: 20, fontSize: 15 },
    cta: {
      marginHorizontal: 16,
      marginTop: 20,
      height: 54,
      borderRadius: 27,
      backgroundColor: "#F4F0E6",
      alignItems: "center",
      justifyContent: "center",
    },
    ctaOff: { backgroundColor: "#1A1915" },
    ctaTxt: { color: "#16140F", fontWeight: "700", fontSize: 16 },
    ctaTxtOff: { color: "rgba(244,240,230,0.4)" },
  });
}
