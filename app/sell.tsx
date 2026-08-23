import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Category } from "../lib/catalog";
import { usd } from "../lib/catalog";
import { uvelFeeCents } from "../lib/fees";
import { getMarket, moneyExact } from "../lib/markets";
import { pickListingPhoto, takeListingPhoto } from "../lib/photo";
import { reviewListingForFeed, reviewListingPhoto, type PhotoReview } from "../lib/photoCheck";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { addPiece, getPiece, listPiece, useWardrobe } from "../lib/wardrobe";

const MAX = 5;
const W = Dimensions.get("window").width;
const LISTING_RATIO = 4 / 5;
const CATS: Category[] = [
  "Outerwear",
  "Dresses",
  "Tops",
  "Trousers",
  "Knitwear",
  "Skirts",
  "Shoes",
  "Bags",
  "Accessories",
];
const CONDITIONS = ["New with tags", "Like new", "Excellent", "Good", "Fair"];
const STAGES = [
  "Looking at the photos…",
  "Is this something we sell?",
  "Checking the listing…",
  "Looking for anything that shouldn’t be here…",
];

type Slot = {
  uri: string;
  status: "checking" | "ok" | "warn";
  review?: PhotoReview;
};

type Gate =
  | { phase: "idle" }
  | { phase: "review"; line: string }
  | { phase: "block"; headline: string; reasons: string[] }
  | { phase: "pass" };

export default function Sell() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  useWardrobe();
  const existing = id ? getPiece(id) : undefined;
  const { wardrobeUris, appearance, uid, displayName, country } = useUvel();
  const market = getMarket(country);

  const [photos, setPhotos] = useState<Slot[]>(
    existing?.photos?.length
      ? existing.photos.map((uri) => ({ uri, status: "ok" as const }))
      : existing?.photo
        ? [{ uri: existing.photo, status: "ok" }]
        : [],
  );
  const [name, setName] = useState(existing?.name ?? "");
  const [brand, setBrand] = useState(existing?.brand && existing.brand !== "Unlabeled" ? existing.brand : "");
  const [category, setCategory] = useState<Category | null>(existing?.category ?? null);
  const [color, setColor] = useState(existing?.color ?? "");
  const [size, setSize] = useState(existing?.size ?? "");
  const [condition, setCondition] = useState(existing?.condition ?? "");
  const [material, setMaterial] = useState(existing?.material ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [price, setPrice] = useState(
    existing && existing.listPriceCents ? String(Math.round(existing.listPriceCents / 100)) : "",
  );
  const [was, setWas] = useState(
    existing?.originalPriceCents ? String(Math.round(existing.originalPriceCents / 100)) : "",
  );
  const [fitsOpen, setFitsOpen] = useState(false);
  const [gate, setGate] = useState<Gate>({ phase: "idle" });
  const [stage, setStage] = useState(0);

  const cover = photos[0];
  const warn = photos.find((p) => p.status === "warn");
  const checking = photos.some((p) => p.status === "checking");
  const hasPhoto = photos.length > 0;
  const hasTitle = Boolean(name.trim());
  const hasNotes = Boolean(notes.trim());
  const hasPrice = Number(price) > 0;
  const hasCat = Boolean(category);
  const hasSize = Boolean(size.trim());
  const hasColor = Boolean(color.trim());
  const hasMaterial = Boolean(material.trim());
  const hasCond = Boolean(condition);
  const canList =
    hasPhoto &&
    hasTitle &&
    hasNotes &&
    hasPrice &&
    hasCat &&
    hasSize &&
    hasColor &&
    hasMaterial &&
    hasCond &&
    !checking &&
    gate.phase === "idle";
  const progress = [hasPhoto, hasPrice, hasTitle, hasNotes, hasCat, hasSize, hasColor, hasMaterial, hasCond].filter(
    Boolean,
  ).length;
  const ph = appearance === "dark" ? "rgba(244,240,230,0.28)" : "rgba(22,20,15,0.32)";
  const ctaLabel = checking
    ? "Checking photos…"
    : !hasPhoto
      ? "Add a photo"
      : !hasTitle
        ? "Add a title"
        : !hasNotes
          ? "Add a description"
          : !hasPrice
          ? "Add a price"
          : !hasCat
            ? "Pick a category"
            : !hasSize
              ? "Add a size"
              : !hasColor
                ? "Add a colour"
                : !hasMaterial
                  ? "Add a material"
                  : !hasCond
                    ? "Pick a condition"
                    : `List for ${usd(Math.max(1, Number(price) || 0) * 100, market.currency)}`;

  useEffect(() => {
    if (!existing && photos.length === 1 && photos[0].status === "ok" && photos[0].review) {
      const r = photos[0].review;
      if (!name && r.title) setName(r.title);
      if (!brand && r.brand) setBrand(r.brand);
      if (!color && r.color) setColor(r.color);
      if (!notes && r.description) setNotes(r.description);
      if (!material && r.material) setMaterial(r.material);
    }
    // first photo only fills empty fields
  }, [photos]);

  useEffect(() => {
    if (gate.phase !== "review") return;
    setStage(0);
    const t = setInterval(() => setStage((n) => (n + 1) % STAGES.length), 5000);
    return () => clearInterval(t);
  }, [gate.phase]);

  async function addUri(uri: string) {
    if (photos.length >= MAX) return;
    if (photos.some((p) => p.uri === uri)) return;
    setPhotos((prev) => [...prev, { uri, status: "checking" }]);
    try {
      const review = await reviewListingPhoto(uri);
      setPhotos((prev) =>
        prev.map((p) => (p.uri === uri ? { uri, status: review.ok ? "ok" : "warn", review } : p)),
      );
    } catch {
      setPhotos((prev) => prev.map((p) => (p.uri === uri ? { uri, status: "ok" } : p)));
    }
  }

  async function fromCamera() {
    Keyboard.dismiss();
    try {
      const uri = await takeListingPhoto();
      if (uri) await addUri(uri);
    } catch (err) {
      Alert.alert("Camera", err instanceof Error ? err.message : "Couldn’t open camera.");
    }
  }

  async function fromLibrary() {
    Keyboard.dismiss();
    try {
      const uri = await pickListingPhoto();
      if (uri) await addUri(uri);
    } catch (err) {
      Alert.alert("Photos", err instanceof Error ? err.message : "Couldn’t open photos.");
    }
  }

  function choosePhoto() {
    if (photos.length >= MAX) return;
    Keyboard.dismiss();
    const hasFits = wardrobeUris.length > 0;
    if (Platform.OS === "ios") {
      const options = hasFits ? ["Camera", "Library", "From your fits", "Cancel"] : ["Camera", "Library", "Cancel"];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          userInterfaceStyle: appearance,
        },
        (i) => {
          if (i === 0) void fromCamera();
          else if (i === 1) void fromLibrary();
          else if (hasFits && i === 2) setFitsOpen(true);
        },
      );
      return;
    }
    Alert.alert("Add a photo", undefined, [
      { text: "Camera", onPress: () => void fromCamera() },
      { text: "Library", onPress: () => void fromLibrary() },
      ...(hasFits ? [{ text: "From your fits", onPress: () => setFitsOpen(true) }] : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  }

  async function publish() {
    if (!canList) return;
    setGate({ phase: "review", line: STAGES[0] });
    const started = Date.now();
    let result;
    try {
      result = await reviewListingForFeed({
        photos: photos.map((p) => p.uri),
        name: name.trim(),
        notes: notes.trim(),
        category: category ?? "Tops",
        brand: brand.trim() || "Unlabeled",
        color: color.trim(),
        size: size.trim(),
        condition: condition || "Excellent",
        price,
      });
    } catch {
      result = {
        ok: false,
        headline: "Couldn’t finish the check",
        reasons: ["Try again in a moment. Nothing went on the floor."],
      };
    }
    const wait = Math.max(0, 20000 - (Date.now() - started));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    if (!result.ok) {
      setGate({ phase: "block", headline: result.headline, reasons: result.reasons });
      return;
    }
    const uris = photos.map((p) => p.uri);
    const draft = {
      photo: uris[0],
      photos: uris,
      name: name.trim(),
      brand: brand.trim() || "Unlabeled",
      category: category as Category,
      color: color.trim(),
      size: size.trim(),
      condition,
      material: material.trim(),
      notes: notes.trim(),
      listPriceCents: Math.max(1, Number(price) || 0) * 100,
      originalPriceCents: Math.max(0, Number(was) || 0) * 100,
      country: market.code,
      currency: market.currency,
    };
    if (existing) listPiece(existing.id, { ...draft, ownerId: uid, ownerName: displayName, country: market.code, currency: market.currency });
    else addPiece({ ...draft, status: "listed", ownerId: uid, ownerName: displayName, country: market.code, currency: market.currency });
    setGate({ phase: "pass" });
    setTimeout(() => router.replace("/(tabs)/closet"), 1100);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={() => router.back()} hitSlop={16} style={styles.back}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>New listing</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(progress / 9) * 100}%` }]} />
        </View>
        <Text style={styles.progressLbl}>{progress} of 9 ready</Text>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={cover ? undefined : choosePhoto} style={styles.hero}>
            {cover ? (
              <>
                <Image source={{ uri: cover.uri }} style={styles.heroImg} contentFit="cover" />
                <Pressable onPress={() => removePhoto(cover.uri)} hitSlop={8} style={styles.heroX}>
                  <Text style={styles.heroXTxt}>×</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.heroEmpty}>
                <Text style={styles.heroPlus}>＋</Text>
                <Text style={styles.heroHint}>Tap to add a photo</Text>
                <Text style={styles.heroSub}>Hang it, lay it flat, or a clear mirror shot</Text>
              </View>
            )}
            {cover?.status === "checking" ? (
              <View style={styles.heroMask}>
                <ActivityIndicator color="#16140F" />
                <Text style={styles.heroCheck}>Checking this shot</Text>
              </View>
            ) : null}
          </Pressable>

          <Text style={[styles.label, { marginTop: 16, marginLeft: 20 }]}>Photos *</Text>
          <View style={styles.slotRow}>
            {photos.map((p, i) => (
              <View key={p.uri} style={{ position: "relative" }}>
                <Image source={{ uri: p.uri }} style={[styles.mini, i === 0 && styles.miniOn]} contentFit="cover" />
                {p.status === "warn" ? <View style={styles.warnDot} /> : null}
                <Pressable onPress={() => removePhoto(p.uri)} hitSlop={8} style={styles.miniX}>
                  <Text style={styles.miniXTxt}>×</Text>
                </Pressable>
              </View>
            ))}
            {photos.length < MAX ? (
              <Pressable onPress={choosePhoto} style={styles.miniAdd}>
                <Text style={styles.miniPlus}>+</Text>
                <Text style={styles.miniCount}>{photos.length}/5</Text>
              </Pressable>
            ) : null}
          </View>

          {fitsOpen && wardrobeUris.length ? (
            <View style={styles.picker}>
              <View style={styles.fitHead}>
                <Text style={styles.fitLbl}>From your fits</Text>
                <Pressable onPress={() => setFitsOpen(false)}>
                  <Text style={styles.fitLbl}>Done</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {wardrobeUris.map((uri) => (
                  <Pressable
                    key={uri}
                    onPress={() => {
                      setFitsOpen(false);
                      void addUri(uri);
                    }}
                  >
                    <Image source={{ uri }} style={styles.fit} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {warn?.review ? (
            <View style={styles.warnBox}>
              <Text style={styles.warnTitle}>This photo won’t sell it</Text>
              {warn.review.issues.map((line) => (
                <Text key={line} style={styles.warnP}>
                  {line}
                </Text>
              ))}
              {warn.review.tip ? <Text style={styles.warnTip}>{warn.review.tip}</Text> : null}
              <Pressable onPress={() => removePhoto(warn.uri)}>
                <Text style={styles.warnCta}>Take another</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.sheet}>
            <Text style={styles.priceLabel}>Price *</Text>
            <View style={styles.priceRow}>
              <Text style={[styles.dollar, !price && { color: ph }]}>{market.symbol}</Text>
              <TextInput
                style={styles.price}
                value={price}
                onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={ph}
                autoFocus={false}
              />
            </View>
            {Number(price) > 0 ? (
              <Text style={styles.feeNote}>
                Buyer pays a {moneyExact(uvelFeeCents(Number(price) * 100, market.currency, market), market.currency)}{" "}
                Uvel fee at checkout. You receive the full {usd(Number(price) * 100, market.currency)}.
              </Text>
            ) : null}

            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.titleIn}
              value={name}
              onChangeText={setName}
              placeholder="What’s the piece?"
              placeholderTextColor={ph}
            />
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={styles.bodyIn}
              value={notes}
              onChangeText={setNotes}
              placeholder="Fit, fabric, any marks"
              placeholderTextColor={ph}
              multiline
            />

            <Text style={styles.label}>Category *</Text>
            <View style={styles.chips}>
              {CATS.map((c) => (
                <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipOn]}>
                  <Text style={[styles.chipTxt, category === c && styles.chipTxtOn]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1.2 }}>
                <Text style={styles.label}>Brand</Text>
                <TextInput
                  style={styles.field}
                  value={brand}
                  onChangeText={setBrand}
                  placeholder="Optional"
                  placeholderTextColor={ph}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Size *</Text>
                <TextInput
                  style={styles.field}
                  value={size}
                  onChangeText={setSize}
                  placeholder=""
                  placeholderTextColor={ph}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Colour *</Text>
                <TextInput
                  style={styles.field}
                  value={color}
                  onChangeText={setColor}
                  placeholder=""
                  placeholderTextColor={ph}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Material *</Text>
                <TextInput
                  style={styles.field}
                  value={material}
                  onChangeText={setMaterial}
                  placeholder=""
                  placeholderTextColor={ph}
                />
              </View>
            </View>

            <Text style={styles.label}>Condition *</Text>
            <View style={styles.chips}>
              {CONDITIONS.map((c) => (
                <Pressable key={c} onPress={() => setCondition(c)} style={[styles.chip, condition === c && styles.chipOn]}>
                  <Text style={[styles.chipTxt, condition === c && styles.chipTxtOn]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Original price</Text>
            <TextInput
              style={styles.field}
              value={was}
              onChangeText={(v) => setWas(v.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="Optional"
              placeholderTextColor={ph}
            />
          </View>
        </ScrollView>

        <View style={[styles.foot, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={() => void publish()}
            disabled={!canList}
            style={[styles.cta, !canList && styles.ctaOff]}
          >
            <Text style={[styles.ctaTxt, !canList && styles.ctaTxtOff]}>{ctaLabel}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {gate.phase !== "idle" ? (
        <View style={[styles.gate, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
          {cover ? (
            <Image source={{ uri: cover.uri }} style={styles.gateImg} contentFit="cover" />
          ) : null}
          {gate.phase === "review" ? (
            <>
              <ActivityIndicator color="#D6E27A" />
              <Text style={styles.gateH}>{STAGES[stage]}</Text>
              <Text style={styles.gateP}>About 20 seconds. Nothing goes live until this is clean.</Text>
            </>
          ) : null}
          {gate.phase === "block" ? (
            <>
              <Text style={styles.gateH}>{gate.headline}</Text>
              {gate.reasons.map((r) => (
                <Text key={r} style={styles.gateP}>
                  {r}
                </Text>
              ))}
              <Pressable onPress={() => setGate({ phase: "idle" })} style={styles.gateCta}>
                <Text style={styles.ctaTxt}>Fix listing</Text>
              </Pressable>
            </>
          ) : null}
          {gate.phase === "pass" ? (
            <>
              <View style={styles.green} />
              <Text style={styles.gateH}>You’re on the floor.</Text>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
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
    progressTrack: {
      height: 3,
      marginHorizontal: 20,
      borderRadius: 2,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    progressFill: { height: 3, backgroundColor: "#D6E27A", borderRadius: 2 },
    progressLbl: { color: colors.subtle, fontSize: 11, marginTop: 6, marginBottom: 8, marginLeft: 20 },
    hero: {
      width: W,
      height: W / LISTING_RATIO,
      backgroundColor: colors.surface,
    },
    heroImg: { width: "100%", height: "100%" },
    heroX: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(14,13,11,0.72)",
      alignItems: "center",
      justifyContent: "center",
    },
    heroXTxt: { color: "#F4F0E6", fontSize: 22, lineHeight: 24, marginTop: -1 },
    heroEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 28 },
    heroPlus: { color: colors.bone, fontSize: 44 },
    heroHint: { color: colors.bone, fontFamily: "Georgia", fontSize: 22 },
    heroSub: { color: colors.muted, textAlign: "center", lineHeight: 20 },
    heroMask: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(214,226,122,0.5)",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    heroCheck: { color: "#16140F", fontWeight: "600" },
    slotRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12 },
    mini: { width: 52, height: 65, borderRadius: 10, backgroundColor: colors.surface },
    miniOn: { borderWidth: 2, borderColor: "#D6E27A" },
    miniAdd: {
      width: 52,
      height: 65,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.subtle + "55",
      alignItems: "center",
      justifyContent: "center",
    },
    miniPlus: { color: colors.bone, fontSize: 20, marginTop: -2 },
    miniCount: { color: colors.subtle, fontSize: 10 },
    miniX: {
      position: "absolute",
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "#16140F",
      alignItems: "center",
      justifyContent: "center",
    },
    miniXTxt: { color: "#F4F0E6", fontSize: 14, lineHeight: 16, fontWeight: "700" },
    warnDot: {
      position: "absolute",
      right: 4,
      top: 4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#C45C26",
    },
    picker: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
    fitHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    fitLbl: { color: colors.subtle, fontSize: 12, marginTop: 4 },
    fit: { width: 64, height: 86, borderRadius: 10, marginRight: 8, marginTop: 8 },
    warnBox: {
      margin: 16,
      padding: 14,
      borderRadius: 16,
      backgroundColor: "rgba(196,92,38,0.12)",
      gap: 6,
    },
    warnTitle: { color: colors.bone, fontWeight: "700" },
    warnP: { color: colors.muted, lineHeight: 20 },
    warnTip: { color: colors.bone, fontStyle: "italic" },
    warnCta: { color: colors.bone, fontWeight: "700", textDecorationLine: "underline", marginTop: 6 },
    sheet: { paddingHorizontal: 20, paddingTop: 8 },
    priceLabel: { color: colors.subtle, fontSize: 12, letterSpacing: 0.8, marginTop: 12, marginBottom: 6 },
    priceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    feeNote: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 10 },
    dollar: {
      color: colors.bone,
      fontWeight: "700",
      fontSize: 34,
      lineHeight: 40,
      includeFontPadding: false,
    },
    price: {
      flex: 1,
      color: colors.bone,
      fontWeight: "700",
      fontSize: 34,
      lineHeight: 40,
      height: 40,
      padding: 0,
      includeFontPadding: false,
    },
    titleIn: {
      color: colors.bone,
      fontFamily: "Georgia",
      fontSize: 28,
      lineHeight: 34,
      marginTop: 8,
    },
    bodyIn: { color: colors.bone, fontSize: 16, lineHeight: 22, minHeight: 88, marginTop: 0, textAlignVertical: "top" },
    label: { color: colors.subtle, fontSize: 12, letterSpacing: 0.8, marginTop: 20, marginBottom: 8 },
    field: {
      height: 48,
      borderRadius: 14,
      paddingHorizontal: 14,
      color: colors.bone,
      backgroundColor: colors.surface,
      fontSize: 16,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.subtle + "40",
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipOn: { backgroundColor: "#D6E27A", borderColor: "#D6E27A" },
    chipTxt: { color: colors.muted, fontSize: 13 },
    chipTxtOn: { color: "#16140F", fontWeight: "600" },
    row: { flexDirection: "row", gap: 10 },
    foot: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 10,
      backgroundColor: colors.ink,
    },
    cta: {
      height: 54,
      borderRadius: 27,
      backgroundColor: "#D6E27A",
      alignItems: "center",
      justifyContent: "center",
    },
    ctaOff: { backgroundColor: colors.surface },
    ctaTxt: { color: "#16140F", fontSize: 16, fontWeight: "600" },
    ctaTxtOff: { color: colors.muted },
    gate: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "#12140A",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      gap: 12,
    },
    gateImg: { width: 120, height: 160, borderRadius: 16, marginBottom: 16, opacity: 0.9 },
    gateH: {
      color: "#F4F0E6",
      fontFamily: "Georgia",
      fontSize: 28,
      textAlign: "center",
      lineHeight: 34,
    },
    gateP: { color: "rgba(244,240,230,0.7)", textAlign: "center", lineHeight: 22, fontSize: 15 },
    gateCta: {
      marginTop: 18,
      height: 50,
      paddingHorizontal: 28,
      borderRadius: 25,
      backgroundColor: "#D6E27A",
      alignItems: "center",
      justifyContent: "center",
    },
    green: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#D6E27A", marginBottom: 6 },
  });
}
