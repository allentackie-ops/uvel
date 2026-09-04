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
import { shopFloor, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";

type GarmentPick =
  | { kind: "uvel"; piece: ClosetPiece }
  | { kind: "photo"; uri: string; name: string };

export default function Mirror() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  useWardrobe();
  const marketplaceSync = useMarketplaceSyncState();
  const live = shopFloor(app.country);
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

  function fromCamera() {
    router.push("/mirror-camera");
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

  function chooseGarmentPhoto() {
    const options = ["Take clothing photo", "Choose clothing photo", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2, title: "Add a clothing piece" },
        (i) => {
          if (i === 0) void pickGarment(true);
          if (i === 1) void pickGarment(false);
        },
      );
      return;
    }
    Alert.alert("Add a clothing piece", "Choose a clothing photo to try on.", [
      { text: "Take clothing photo", onPress: () => void pickGarment(true) },
      { text: "Choose clothing photo", onPress: () => void pickGarment(false) },
      { text: "Cancel", style: "cancel" },
    ]);
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

  function clearPerson() {
    app.setPerson(null);
    setResult(null);
    setErr("");
  }

  async function run() {
    if (!person || !garmentUri) return;
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
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 152, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={[styles.hero, !person && styles.heroNeed]}>
          {result ? (
            <Image source={{ uri: result }} style={styles.fill} contentFit="contain" />
          ) : person ? (
            <Image source={{ uri: person }} style={styles.fill} contentFit="contain" />
          ) : (
            <View style={styles.need}>
              <Text style={styles.needH}>Add your full-length photo</Text>
              <Text style={styles.needP}>Then see how a look works on you before you buy.</Text>
              <View style={styles.needRow}>
                <Pressable onPress={() => void fromCamera()} style={styles.needBtn}>
                  <Text style={styles.needBtnTxt}>Take my photo</Text>
                </Pressable>
                <Pressable onPress={() => void fromLibrary()} style={styles.needBtnGhost}>
                  <Text style={styles.needBtnGhostTxt}>Choose my photo</Text>
                </Pressable>
              </View>
            </View>
          )}
          {person && !busy ? (
            <View style={styles.changeWrap} pointerEvents="box-none">
              <Pressable onPress={askPerson} style={styles.change}>
                <Text style={styles.changeTxt}>📷  Change photo</Text>
              </Pressable>
              <Pressable onPress={clearPerson} style={styles.removePhoto} accessibilityRole="button" accessibilityLabel="Remove photo" accessibilityHint="Double tap to remove your saved Mirror photo.">
                <Text style={styles.removePhotoTxt}>Remove</Text>
              </Pressable>
            </View>
          ) : null}
          {busy ? (
            <View style={styles.spin}>
              <OrbitLoader />
            </View>
          ) : null}
        </View>

        <View style={styles.sourceCard}>
          <View style={styles.sourceHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sourceKicker}>START HERE</Text>
              <Text style={styles.sourceTitle}>{person ? "Choose something to try" : "Add your photo to begin"}</Text>
              <Text style={styles.sourceCopy}>{person ? "Bring in a look from anywhere, or choose a piece from Uvel." : "Once your photo is ready, choose a piece from Uvel or anywhere else."}</Text>
            </View>
            {person ? <Text style={styles.step}>1 of 2</Text> : null}
          </View>
          <View style={styles.anywhere}>
            <Pressable onPress={chooseGarmentPhoto} style={[styles.chip, picked?.kind === "photo" && styles.chipOn]}>
              <Text style={[styles.chipTxt, picked?.kind === "photo" && styles.chipTxtOn]}>Add clothing photo</Text>
            </Pressable>
            <Pressable onPress={() => setShowLink((v) => !v)} style={[styles.chip, showLink && styles.chipOn]}>
              <Text style={[styles.chipTxt, showLink && styles.chipTxtOn]}>Paste product link</Text>
            </Pressable>
          </View>
          {showLink ? (
            <View style={styles.linkRow}>
              <TextInput
                placeholder="Paste an image or product link"
                placeholderTextColor={`59`}
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
        </View>

        {live.length ? (
          <View style={styles.headRow}>
            <Text style={styles.h2}>From Uvel</Text>
            <Pressable onPress={() => router.push("/(tabs)/shop")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
        ) : null}
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
          <View style={styles.emptySource}>
            <Text style={styles.empty}>{marketplaceSync === "confirmed" ? "No Uvel pieces are live yet. Bring in a look from anywhere and try it here." : "Uvel pieces are temporarily unavailable. You can still bring in a look from anywhere and try it here."}</Text>
            <Pressable onPress={() => router.push("/")} style={styles.emptyLink}>
              <Text style={styles.emptyLinkTxt}>Explore Today’s edit</Text>
            </Pressable>
          </View>
        )}

        {picked ? (
          <View style={styles.selected}>
            <Text style={styles.selectedKicker}>READY TO TRY</Text>
            <Text style={styles.selectedTitle}>{garmentName}</Text>
            <Text style={styles.selectedCopy}>Your photo and this piece are ready for a preview.</Text>
          </View>
        ) : null}

        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Pressable onPress={() => void run()} disabled={!canTry} style={[styles.cta, !canTry && styles.ctaOff]}>
          <Text style={[styles.ctaTxt, !canTry && styles.ctaTxtOff]}>
            {busy ? "Dressing you…" : !person ? "Add your photo" : !picked ? "Choose a piece" : "Try this look"}
          </Text>
        </Pressable>
        {picked ? (
          <Pressable onPress={clearPick} style={styles.ghostCta}>
            <Text style={styles.ghostCtaTxt}>Pick something else</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    syncNotice: { color: `${colors.bone}9E`, fontSize: 12, lineHeight: 18, marginHorizontal: 20, marginTop: 10, marginBottom: 4 },
    lede: { color: `${colors.bone}A3`, fontSize: 16, lineHeight: 23, paddingHorizontal: 20, marginTop: 8, marginBottom: 18 },
    heroNeed: { height: 360 },
    sourceCard: { marginTop: 24, marginHorizontal: 16, padding: 16, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}1F` },
    sourceHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    sourceKicker: { color: colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
    sourceTitle: { color: colors.bone, fontSize: 19, fontWeight: "800", marginTop: 5 },
    sourceCopy: { color: `${colors.bone}94`, fontSize: 13, lineHeight: 19, marginTop: 4 },
    step: { color: `${colors.bone}6B`, fontSize: 11, fontWeight: "800" },

    search: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: `${colors.bone}47`,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    searchTxt: { color: colors.bone, fontSize: 18, fontWeight: "500" },
    hero: {
      marginHorizontal: 16,
      height: 560,
      borderRadius: 22,
      overflow: "hidden",
      backgroundColor: colors.surface,
    },
    fill: { width: "100%", height: "100%" },
    need: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 8 },
    needH: { color: colors.bone, fontFamily: "Georgia", fontSize: 26 },
    needP: { color: `${colors.bone}9E`, textAlign: "center", marginBottom: 8 },
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
    needBtnGhost: {
      height: 44,
      paddingHorizontal: 20,
      borderRadius: 22,
      backgroundColor: `${colors.surface}F2`,
      alignItems: "center",
      justifyContent: "center",
    },
    needBtnGhostTxt: { color: colors.bone, fontWeight: "600" },
    spin: {
      ...StyleSheet.absoluteFill,
      backgroundColor: `${colors.ink}80`,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    spinTxt: { color: colors.bone, letterSpacing: 1.2, textTransform: "uppercase", fontSize: 12 },
    changeWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 16,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
    },
    change: {
      backgroundColor: `${colors.surface}D1`,
      borderWidth: 1,
      borderColor: `${colors.bone}2E`,
      height: 36,
      paddingHorizontal: 16,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    changeTxt: { color: colors.bone, fontSize: 13, fontWeight: "600" },
    removePhoto: { backgroundColor: `${colors.surface}D1`, borderWidth: 1, borderColor: `${colors.bone}2E`, height: 36, paddingHorizontal: 16, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    removePhotoTxt: { color: `${colors.bone}B8`, fontSize: 13, fontWeight: "600" },
    headRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      marginTop: 26,
      marginBottom: 14,
    },
    h2: { color: colors.bone, fontFamily: "Georgia", fontSize: 26 },
    seeAll: { color: `${colors.bone}6B`, fontSize: 15 },
    strip: { paddingHorizontal: 16, gap: 12, paddingRight: 28 },
    uvelCard: {
      width: 168,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: "transparent",
    },
    uvelOn: { borderColor: `${colors.bone}47` },
    uvelImg: { width: 168, height: 210, backgroundColor: colors.surface },
    trying: {
      position: "absolute",
      top: 10,
      left: 10,
      backgroundColor: colors.success,
      paddingHorizontal: 10,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    tryingTxt: { color: colors.successInk, fontSize: 11, fontWeight: "700" },
    uvelMeta: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
    uvelName: { color: colors.bone, fontSize: 14, fontWeight: "600", lineHeight: 18 },
    uvelPrice: { color: colors.bone, fontSize: 14, fontWeight: "700", marginTop: 4 },
    empty: { color: `${colors.bone}94`, fontSize: 13, lineHeight: 19 },
    emptySource: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: 16, backgroundColor: colors.surface },
    emptyLink: { marginTop: 10 },
    emptyLinkTxt: { color: colors.success, fontSize: 13, fontWeight: "800" },
    anywhere: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
    selected: { marginHorizontal: 20, marginTop: 24, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: `${colors.success}47`, backgroundColor: `${colors.success}0F` },
    selectedKicker: { color: colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
    selectedTitle: { color: colors.bone, fontSize: 18, fontWeight: "800", marginTop: 5 },
    selectedCopy: { color: `${colors.bone}94`, fontSize: 13, marginTop: 4 },
    allowance: { color: `${colors.bone}7A`, textAlign: "center", fontSize: 12, marginTop: 10 },
    trust: { color: `${colors.bone}57`, textAlign: "center", fontSize: 11, lineHeight: 16, paddingHorizontal: 28, marginTop: 10 },
    chip: {
      height: 42,
      paddingHorizontal: 16,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: `${colors.bone}29`,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${colors.surface}F2`,
    },
    chipOn: { backgroundColor: colors.success, borderColor: colors.success },
    chipTxt: { color: colors.bone, fontWeight: "600", fontSize: 14 },
    chipTxtOn: { color: colors.successInk },
    linkRow: {
      marginHorizontal: 16,
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingLeft: 14,
    },
    input: { flex: 1, color: colors.bone, height: 46, fontSize: 15 },
    linkGo: { paddingHorizontal: 16, height: 46, alignItems: "center", justifyContent: "center" },
    linkGoTxt: { color: colors.success, fontWeight: "700" },
    err: { color: colors.danger, marginTop: 14, marginHorizontal: 20, fontSize: 14, lineHeight: 20 },
    cta: {
      marginHorizontal: 16,
      marginTop: 22,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaOff: { opacity: 0.45 },
    ctaTxt: { color: colors.successInk, fontWeight: "700", fontSize: 16 },
    ctaTxtOff: { color: colors.successInk },
    ghostCta: {
      marginHorizontal: 16,
      marginTop: 10,
      height: 54,
      borderRadius: 27,
      borderWidth: 1,
      borderColor: `${colors.bone}24`,
      backgroundColor: `${colors.surface}F2`,
      alignItems: "center",
      justifyContent: "center",
    },
    ghostCtaTxt: { color: colors.bone, fontWeight: "600", fontSize: 16 },
    foot: {
      color: `${colors.bone}61`,
      textAlign: "center",
      fontSize: 13,
      lineHeight: 19,
      marginTop: 16,
      paddingHorizontal: 40,
    },
  });
}
