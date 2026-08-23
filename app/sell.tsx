import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { pickListingPhoto, takeListingPhoto } from "../lib/photo";
import { reviewListingPhoto, type PhotoReview } from "../lib/photoCheck";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { addPiece, getPiece, listPiece, updatePiece, useWardrobe } from "../lib/wardrobe";

const MAX = 5;
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

type Slot = {
  uri: string;
  status: "checking" | "ok" | "warn";
  review?: PhotoReview;
};

export default function Sell() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  useWardrobe();
  const existing = id ? getPiece(id) : undefined;
  const { wardrobeUris } = useUvel();

  const [photos, setPhotos] = useState<Slot[]>(
    existing?.photos?.length
      ? existing.photos.map((uri) => ({ uri, status: "ok" as const }))
      : existing?.photo
        ? [{ uri: existing.photo, status: "ok" }]
        : [],
  );
  const [name, setName] = useState(existing?.name ?? "");
  const [brand, setBrand] = useState(existing?.brand ?? "");
  const [category, setCategory] = useState<Category>(existing?.category ?? "Tops");
  const [color, setColor] = useState(existing?.color ?? "");
  const [size, setSize] = useState(existing?.size ?? "");
  const [condition, setCondition] = useState(existing?.condition ?? "Excellent");
  const [material, setMaterial] = useState(existing?.material ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [price, setPrice] = useState(
    existing ? String(Math.round(existing.listPriceCents / 100)) : "",
  );
  const [was, setWas] = useState(
    existing?.originalPriceCents ? String(Math.round(existing.originalPriceCents / 100)) : "",
  );
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const warn = photos.find((p) => p.status === "warn");
  const checking = photos.some((p) => p.status === "checking");
  const canList = photos.length > 0 && name.trim() && Number(price) > 0 && !checking;

  useEffect(() => {
    if (!existing && photos.length === 1 && photos[0].status === "ok" && photos[0].review) {
      const r = photos[0].review;
      if (!name && r.title) setName(r.title);
      if (!brand && r.brand) setBrand(r.brand);
      if (r.category) setCategory(r.category);
      if (!color && r.color) setColor(r.color);
      if (!notes && r.description) setNotes(r.description);
      if (r.conditionGuess) setCondition(r.conditionGuess);
      if (!material && r.material) setMaterial(r.material);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  async function addUri(uri: string) {
    if (photos.length >= MAX) return;
    if (photos.some((p) => p.uri === uri)) return;
    const slot: Slot = { uri, status: "checking" };
    setPhotos((prev) => [...prev, slot]);
    try {
      const review = await reviewListingPhoto(uri);
      setPhotos((prev) =>
        prev.map((p) =>
          p.uri === uri
            ? { uri, status: review.ok ? "ok" : "warn", review }
            : p,
        ),
      );
    } catch {
      setPhotos((prev) => prev.map((p) => (p.uri === uri ? { uri, status: "ok" } : p)));
    }
  }

  async function fromCamera() {
    setPicker(false);
    try {
      const uri = await takeListingPhoto();
      if (uri) await addUri(uri);
    } catch (err) {
      Alert.alert("Camera", err instanceof Error ? err.message : "Couldn’t open camera.");
    }
  }

  async function fromLibrary() {
    setPicker(false);
    try {
      const uri = await pickListingPhoto();
      if (uri) await addUri(uri);
    } catch (err) {
      Alert.alert("Photos", err instanceof Error ? err.message : "Couldn’t open photos.");
    }
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  }

  function publish() {
    if (!canList) return;
    setSaving(true);
    const uris = photos.map((p) => p.uri);
    const draft = {
      photo: uris[0],
      photos: uris,
      name: name.trim(),
      brand: brand.trim() || "Unlabeled",
      category,
      color: color.trim(),
      size: size.trim(),
      condition,
      material: material.trim(),
      notes: notes.trim(),
      listPriceCents: Math.max(1, Number(price) || 0) * 100,
      originalPriceCents: Math.max(0, Number(was) || 0) * 100,
    };
    if (existing) {
      listPiece(existing.id, draft);
    } else {
      addPiece({ ...draft, status: "listed" });
    }
    setSaving(false);
    router.replace("/(tabs)/closet");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ink }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.kicker}>SELL</Text>
        <Text style={styles.title}>{existing ? "List this piece" : "List an item"}</Text>
        <Text style={styles.lede}>
          Up to 5 photos. We check each one so buyers can actually see what they’re getting.
        </Text>

        <View style={styles.slots}>
          {photos.map((p, i) => (
            <Pressable key={p.uri} onLongPress={() => removePhoto(p.uri)} style={styles.slot}>
              <Image source={{ uri: p.uri }} style={styles.slotImg} contentFit="cover" />
              {i === 0 ? <Text style={styles.cover}>Cover</Text> : null}
              {p.status === "checking" ? (
                <View style={styles.slotMask}>
                  <ActivityIndicator color="#16140F" />
                </View>
              ) : null}
              {p.status === "warn" ? <View style={styles.warnDot} /> : null}
              {p.status === "ok" ? <View style={styles.okDot} /> : null}
              <Pressable onPress={() => removePhoto(p.uri)} hitSlop={10} style={styles.x}>
                <Text style={styles.xTxt}>×</Text>
              </Pressable>
            </Pressable>
          ))}
          {photos.length < MAX ? (
            <Pressable onPress={() => setPicker((v) => !v)} style={styles.addSlot}>
              <Text style={styles.addPlus}>+</Text>
              <Text style={styles.addLbl}>{photos.length}/5</Text>
            </Pressable>
          ) : null}
        </View>

        {picker ? (
          <View style={styles.picker}>
            <Pressable onPress={() => void fromCamera()} style={styles.pickBtn}>
              <Text style={styles.pickTxt}>Camera</Text>
            </Pressable>
            <Pressable onPress={() => void fromLibrary()} style={styles.pickBtn}>
              <Text style={styles.pickTxt}>Library</Text>
            </Pressable>
            {wardrobeUris.length ? (
              <Text style={styles.hint}>Or a fit you already showed us</Text>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {wardrobeUris.map((uri) => (
                <Pressable key={uri} onPress={() => { setPicker(false); void addUri(uri); }}>
                  <Image source={{ uri }} style={styles.fit} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {warn?.review ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>This photo won’t sell the piece</Text>
            {warn.review.issues.map((line) => (
              <Text key={line} style={styles.warnP}>
                {line}
              </Text>
            ))}
            {warn.review.tip ? <Text style={styles.warnTip}>{warn.review.tip}</Text> : null}
            <Pressable onPress={() => removePhoto(warn.uri)} style={styles.warnCta}>
              <Text style={styles.warnCtaTxt}>Take another</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ivory silk slip"
          placeholderTextColor={colors.subtle}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.area]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Fit, fabric, any marks. What you’d tell a friend."
          placeholderTextColor={colors.subtle}
          multiline
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {CATS.map((c) => (
            <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipOn]}>
              <Text style={[styles.chipTxt, category === c && styles.chipTxtOn]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Brand</Text>
            <TextInput
              style={styles.input}
              value={brand}
              onChangeText={setBrand}
              placeholder="Unlabeled"
              placeholderTextColor={colors.subtle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Size</Text>
            <TextInput
              style={styles.input}
              value={size}
              onChangeText={setSize}
              placeholder="M / 28 / 8"
              placeholderTextColor={colors.subtle}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Colour</Text>
            <TextInput
              style={styles.input}
              value={color}
              onChangeText={setColor}
              placeholder="Ivory"
              placeholderTextColor={colors.subtle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Material</Text>
            <TextInput
              style={styles.input}
              value={material}
              onChangeText={setMaterial}
              placeholder="Silk, denim…"
              placeholderTextColor={colors.subtle}
            />
          </View>
        </View>

        <Text style={styles.label}>Condition</Text>
        <View style={styles.chips}>
          {CONDITIONS.map((c) => (
            <Pressable key={c} onPress={() => setCondition(c)} style={[styles.chip, condition === c && styles.chipOn]}>
              <Text style={[styles.chipTxt, condition === c && styles.chipTxtOn]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Price</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.subtle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Was (optional)</Text>
            <TextInput
              style={styles.input}
              value={was}
              onChangeText={setWas}
              keyboardType="number-pad"
              placeholder="Original"
              placeholderTextColor={colors.subtle}
            />
          </View>
        </View>

        <Pressable onPress={publish} disabled={!canList || saving} style={[styles.cta, !canList && styles.ctaOff]}>
          <Text style={styles.ctaTxt}>
            {saving
              ? "Listing…"
              : checking
                ? "Checking photos…"
                : `List${price ? ` for ${usd(Math.max(1, Number(price) || 0) * 100)}` : ""}`}
          </Text>
        </Pressable>
        <Text style={styles.fine}>Long-press a photo to remove it. Cover is the first one.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    kicker: { color: colors.subtle, letterSpacing: 2, fontSize: 11 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, marginTop: 8 },
    lede: { color: colors.muted, marginTop: 8, marginBottom: 18, lineHeight: 21, fontSize: 15 },
    slots: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    slot: { width: 88, height: 114, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surface },
    slotImg: { width: "100%", height: "100%" },
    slotMask: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(214,226,122,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    cover: {
      position: "absolute",
      left: 6,
      bottom: 6,
      color: "#16140F",
      backgroundColor: "#D6E27A",
      fontSize: 10,
      fontWeight: "700",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: "hidden",
    },
    okDot: {
      position: "absolute",
      right: 6,
      bottom: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#D6E27A",
    },
    warnDot: {
      position: "absolute",
      right: 6,
      bottom: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#C45C26",
    },
    x: { position: "absolute", top: 4, right: 6 },
    xTxt: { color: "#fff", fontSize: 18, textShadowColor: "#000", textShadowRadius: 6 },
    addSlot: {
      width: 88,
      height: 114,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.subtle + "55",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    addPlus: { color: colors.bone, fontSize: 28, marginTop: -4 },
    addLbl: { color: colors.subtle, fontSize: 11 },
    picker: { marginTop: 12, gap: 8 },
    pickBtn: {
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.subtle + "40",
      alignItems: "center",
      justifyContent: "center",
    },
    pickTxt: { color: colors.bone, fontWeight: "600" },
    hint: { color: colors.subtle, fontSize: 12, marginTop: 6 },
    fit: { width: 72, height: 96, borderRadius: 10, marginRight: 8, marginTop: 8 },
    warnBox: {
      marginTop: 14,
      padding: 14,
      borderRadius: 16,
      backgroundColor: "rgba(196,92,38,0.12)",
      gap: 6,
    },
    warnTitle: { color: colors.bone, fontWeight: "700", fontSize: 15 },
    warnP: { color: colors.muted, lineHeight: 20 },
    warnTip: { color: colors.bone, fontStyle: "italic", marginTop: 4 },
    warnCta: { alignSelf: "flex-start", marginTop: 8 },
    warnCtaTxt: { color: colors.bone, fontWeight: "700", textDecorationLine: "underline" },
    label: { color: colors.subtle, fontSize: 12, letterSpacing: 0.6, marginTop: 18, marginBottom: 8 },
    input: {
      height: 50,
      borderRadius: 14,
      paddingHorizontal: 16,
      color: colors.bone,
      backgroundColor: colors.surface,
      fontSize: 16,
    },
    area: { height: 110, paddingTop: 14, textAlignVertical: "top" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.subtle + "40",
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipOn: { backgroundColor: "#D6E27A", borderColor: "#D6E27A" },
    chipTxt: { color: colors.bone, fontSize: 13 },
    chipTxtOn: { color: "#16140F", fontWeight: "600" },
    row: { flexDirection: "row", gap: 10 },
    cta: {
      marginTop: 28,
      height: 54,
      borderRadius: 27,
      backgroundColor: "#D6E27A",
      alignItems: "center",
      justifyContent: "center",
    },
    ctaOff: { opacity: 0.38 },
    ctaTxt: { color: "#16140F", fontSize: 16, fontWeight: "600" },
    fine: { color: colors.subtle, fontSize: 12, textAlign: "center", marginTop: 12 },
  });
}
