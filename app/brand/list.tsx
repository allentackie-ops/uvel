import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
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
import { BRAND_CATEGORIES, usd, type Category } from "../../lib/catalog";
import { hasBrandContact } from "../../lib/brandContact";
import { BRAND_CONDITIONS, SIZE_SYSTEMS, sizesOf, systemFor, type SizeSystem } from "../../lib/brandSizes";
import { canPost, getBrand, useBrands } from "../../lib/brands";
import { getMarket } from "../../lib/markets";
import { pickListingPhoto, takeListingPhoto } from "../../lib/photo";
import { reviewListingForFeed, reviewListingPhoto, type PhotoReview } from "../../lib/photoCheck";
import { encodeShipsTo } from "../../lib/ships";
import { useUvel } from "../../lib/store";
import { addPiece } from "../../lib/wardrobe";

const W = Dimensions.get("window").width;
const MAX = 5;
const STAGES = ["Looking at the photos…", "Is this fashion?", "Checking the listing…", "Looking for anything that shouldn’t be here…"];

type Slot = { uri: string; status: "checking" | "ok" | "warn"; review?: PhotoReview };
type Gate = { phase: "idle" } | { phase: "review"; line: string } | { phase: "block"; headline: string; reasons: string[] } | { phase: "pass" };

export default function BrandList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBrands();
  const brand = getBrand(id);
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const market = getMarket(brand?.country || app.country);
  const [photos, setPhotos] = useState<Slot[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [system, setSystem] = useState<SizeSystem>("clothing");
  const [picked, setPicked] = useState<string[]>([]);
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<(typeof BRAND_CONDITIONS)[number]>("New");
  const [gate, setGate] = useState<Gate>({ phase: "idle" });
  const [stage, setStage] = useState(0);
  const ph = "rgba(244,240,230,0.32)";
  const cover = photos[0];
  const contactReady = hasBrandContact(brand || {});

  useEffect(() => {
    if (gate.phase !== "review") return;
    setStage(0);
    const t = setInterval(() => setStage((n) => (n + 1) % STAGES.length), 4200);
    return () => clearInterval(t);
  }, [gate.phase]);

  const canList =
    Boolean(brand && canPost(brand, app.uid)) &&
    contactReady &&
    photos.length > 0 &&
    Boolean(name.trim()) &&
    Boolean(notes.trim()) &&
    Number(price) > 0 &&
    Boolean(category) &&
    picked.length > 0 &&
    Boolean(color.trim()) &&
    Boolean(material.trim()) &&
    gate.phase === "idle";

  if (!brand) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 20, paddingHorizontal: 20 }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backTxt}>‹ Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!brand.verified) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backTxt}>‹</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.big}>Verification first</Text>
          <Text style={styles.p}>A brand posts after the blue check. Finish the filing.</Text>
          <Pressable onPress={() => router.push("/brand/apply")} style={styles.cta}>
            <Text style={styles.ctaTxt}>Open filing</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!canPost(brand, app.uid)) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backTxt}>‹</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.big}>Team only</Text>
          <Text style={styles.p}>Only the owner and invited posters list on {brand.name}.</Text>
        </View>
      </View>
    );
  }

  async function addUri(uri: string) {
    if (photos.length >= MAX) return;
    setPhotos((prev) => [...prev, { uri, status: "checking" }]);
    try {
      const review = await reviewListingPhoto(uri);
      setPhotos((prev) => prev.map((p) => (p.uri === uri ? { uri, status: review.ok ? "ok" : "warn", review } : p)));
      if (!name && review.title) setName(review.title);
      if (!color && review.color) setColor(review.color);
      if (!notes && review.description) setNotes(review.description);
      if (!material && review.material) setMaterial(review.material);
      if (!category && review.category) {
        setCategory(review.category);
        const sys = systemFor(review.category);
        setSystem(sys);
      }
    } catch {
      setPhotos((prev) => prev.map((p) => (p.uri === uri ? { uri, status: "ok" } : p)));
    }
  }

  function choosePhoto() {
    Keyboard.dismiss();
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Camera", "Library", "Cancel"], cancelButtonIndex: 2, userInterfaceStyle: "dark" },
        (i) => {
          if (i === 0) void takeListingPhoto().then((u) => u && addUri(u));
          if (i === 1) void pickListingPhoto().then((u) => u && addUri(u));
        },
      );
      return;
    }
    Alert.alert("Add a photo", undefined, [
      { text: "Camera", onPress: () => void takeListingPhoto().then((u) => u && addUri(u)) },
      { text: "Library", onPress: () => void pickListingPhoto().then((u) => u && addUri(u)) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function pickCat(c: Category) {
    setCategory(c);
    const sys = systemFor(c);
    setSystem(sys);
    setPicked([]);
  }

  async function publish() {
    if (!canList || !category) return;
    setGate({ phase: "review", line: STAGES[0] });
    const started = Date.now();
    let result;
    try {
      result = await reviewListingForFeed({
        photos: photos.map((p) => p.uri),
        name: name.trim(),
        notes: notes.trim(),
        category,
        brand: brand.name,
        color: color.trim(),
        size: picked.join(", "),
        condition,
        price,
      });
    } catch {
      result = { ok: false, headline: "Couldn’t finish the check", reasons: ["Try again in a moment."] };
    }
    const wait = Math.max(0, 16000 - (Date.now() - started));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    if (!result.ok) {
      setGate({ phase: "block", headline: result.headline, reasons: result.reasons });
      return;
    }
    const uris = photos.map((p) => p.uri);
    try {
      addPiece({
        photo: uris[0],
        photos: uris,
        name: name.trim(),
        brand: brand.name,
        category,
        color: color.trim(),
        size: picked[0],
        sizes: picked,
        condition,
        material: material.trim(),
        notes: notes.trim(),
        listPriceCents: Math.max(1, Number(price) || 0) * 100,
        originalPriceCents: 0,
        country: brand.country || app.country,
        currency: market.currency,
        shipsTo: encodeShipsTo(brand.country || app.country || "", "all"),
        brandId: brand.id,
        ownerId: brand.ownerId,
        ownerName: brand.name,
        ownerPhoto: brand.logoUri,
        listedByUid: app.uid,
        listedByName: app.displayName,
        status: "listed",
      });
    } catch (err) {
      setGate({
        phase: "block",
        headline: "Couldn’t list this",
        reasons: [err instanceof Error ? err.message : "Try again in a moment."],
      });
      return;
    }
    setGate({ phase: "pass" });
    setTimeout(() => router.replace({ pathname: "/brand/[id]", params: { id: brand.id } }), 1100);
  }

  return (
    <View style={styles.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>List on {brand.name}</Text>
          <View style={{ width: 40 }} />
        </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {!contactReady ? (
            <View style={styles.contactGate}>
              <Text style={styles.contactGateTitle}>Add a brand contact first</Text>
              <Text style={styles.contactGateText}>Before publishing a listing, add at least one reachable phone, WhatsApp, Instagram, email, or website to this brand.</Text>
              <Pressable onPress={() => router.push({ pathname: "/brand/apply", params: { id: brand.id } })} style={styles.contactGateBtn}>
                <Text style={styles.contactGateBtnText}>Open brand details</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable onPress={cover ? undefined : choosePhoto} style={styles.hero}>
            {cover ? (
              <Image source={{ uri: cover.uri }} style={styles.heroImg} contentFit="cover" />
            ) : (
              <View style={styles.heroEmpty}>
                <Text style={styles.heroPlus}>＋</Text>
                <Text style={styles.heroHint}>Product photo</Text>
              </View>
            )}
            {cover?.status === "checking" ? (
              <View style={styles.heroMask}>
                <ActivityIndicator color="#16140F" />
              </View>
            ) : null}
          </Pressable>
          <View style={styles.slotRow}>
            {photos.map((p) => (
              <Pressable key={p.uri} onPress={() => setPhotos((prev) => prev.filter((x) => x.uri !== p.uri))}>
                <Image source={{ uri: p.uri }} style={styles.mini} contentFit="cover" />
              </Pressable>
            ))}
            {photos.length < MAX ? (
              <Pressable onPress={choosePhoto} style={styles.miniAdd}>
                <Text style={styles.miniPlus}>+</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.sheet}>
            <Text style={styles.label}>Price *</Text>
            <View style={styles.priceRow}>
              <Text style={styles.dollar}>{market.symbol}</Text>
              <TextInput style={styles.price} value={price} onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" placeholderTextColor={ph} />
            </View>
            <Text style={styles.label}>Title *</Text>
            <TextInput style={styles.field} value={name} onChangeText={setName} placeholder="The piece" placeholderTextColor={ph} />
            <Text style={styles.label}>Description *</Text>
            <TextInput style={styles.body} value={notes} onChangeText={setNotes} placeholder="Cloth, make, how it sits" placeholderTextColor={ph} multiline />

            <Text style={styles.label}>Category *</Text>
            <Text style={styles.hint}>Clothes, shoes, jewelry, hats, swim, the whole rack.</Text>
            <View style={styles.chips}>
              {BRAND_CATEGORIES.map((c) => (
                <Pressable key={c} onPress={() => pickCat(c)} style={[styles.chip, category === c && styles.chipOn]}>
                  <Text style={[styles.chipTxt, category === c && styles.chipTxtOn]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Size system</Text>
            <View style={styles.chips}>
              {SIZE_SYSTEMS.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    setSystem(s.id);
                    setPicked([]);
                  }}
                  style={[styles.chip, system === s.id && styles.chipOn]}
                >
                  <Text style={[styles.chipTxt, system === s.id && styles.chipTxtOn]}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Available sizes *</Text>
            <View style={styles.chips}>
              {sizesOf(system).map((s) => {
                const on = picked.includes(s);
                return (
                  <Pressable
                    key={s}
                    onPress={() => setPicked((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]))}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Colour *</Text>
                <TextInput style={styles.field} value={color} onChangeText={setColor} placeholderTextColor={ph} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Material *</Text>
                <TextInput style={styles.field} value={material} onChangeText={setMaterial} placeholderTextColor={ph} />
              </View>
            </View>
            <Text style={styles.label}>Availability</Text>
            <View style={styles.chips}>
              {BRAND_CONDITIONS.map((c) => (
                <Pressable key={c} onPress={() => setCondition(c)} style={[styles.chip, condition === c && styles.chipOn]}>
                  <Text style={[styles.chipTxt, condition === c && styles.chipTxtOn]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
        <View style={[styles.foot, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={() => void publish()} disabled={!canList} style={[styles.cta, !canList && styles.ctaOff]}>
            <Text style={[styles.ctaTxt, !canList && styles.ctaTxtOff]}>
              {Number(price) > 0 ? `List for ${usd(Number(price) * 100, market.currency)}` : "List this item"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {gate.phase !== "idle" ? (
        <View style={[styles.gate, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
          {gate.phase === "review" ? (
            <>
              <ActivityIndicator color="#D6E27A" />
              <Text style={styles.gateH}>{STAGES[stage]}</Text>
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
              <Pressable onPress={() => setGate({ phase: "idle" })} style={styles.cta}>
                <Text style={styles.ctaTxt}>Fix listing</Text>
              </Pressable>
            </>
          ) : null}
          {gate.phase === "pass" ? <Text style={styles.gateH}>On {brand.name}.</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0B0A08" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 8 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backTxt: { color: "#F4F0E6", fontSize: 34, lineHeight: 36, marginTop: -4 },
  topTitle: { color: "#F4F0E6", fontSize: 16, fontWeight: "600" },
  contactGate: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#D6E27A66", backgroundColor: "#1A1C12" },
  contactGateTitle: { color: "#F4F0E6", fontWeight: "700", fontSize: 16 },
  contactGateText: { color: "rgba(244,240,230,0.6)", fontSize: 13, lineHeight: 18, marginTop: 6 },
  contactGateBtn: { marginTop: 12, alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "#D6E27A" },
  contactGateBtnText: { color: "#16140F", fontSize: 13, fontWeight: "700" },
  hero: { width: W, height: W * 1.15, backgroundColor: "#161512" },
  heroImg: { width: "100%", height: "100%" },
  heroEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  heroPlus: { color: "#F4F0E6", fontSize: 44 },
  heroHint: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 22 },
  heroMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(214,226,122,0.5)", alignItems: "center", justifyContent: "center" },
  slotRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  mini: { width: 56, height: 70, borderRadius: 8, backgroundColor: "#161512" },
  miniAdd: { width: 56, height: 70, borderRadius: 8, borderWidth: 1, borderColor: "rgba(244,240,230,0.16)", alignItems: "center", justifyContent: "center" },
  miniPlus: { color: "#F4F0E6", fontSize: 22 },
  sheet: { paddingHorizontal: 20, paddingTop: 8 },
  label: { color: "rgba(244,240,230,0.45)", fontSize: 12, marginTop: 16, letterSpacing: 0.3 },
  hint: { color: "rgba(244,240,230,0.4)", fontSize: 13, marginTop: 4 },
  field: {
    marginTop: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#161512",
    borderWidth: 1,
    borderColor: "rgba(244,240,230,0.12)",
    color: "#F4F0E6",
    paddingHorizontal: 14,
    fontSize: 16,
  },
  body: {
    marginTop: 8,
    minHeight: 90,
    borderRadius: 14,
    backgroundColor: "#161512",
    borderWidth: 1,
    borderColor: "rgba(244,240,230,0.12)",
    color: "#F4F0E6",
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 16,
    textAlignVertical: "top",
  },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  dollar: { color: "#F4F0E6", fontSize: 28, fontWeight: "700" },
  price: { flex: 1, color: "#F4F0E6", fontSize: 32, fontWeight: "700", height: 48 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
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
  chipTxt: { color: "#F4F0E6", fontSize: 13, fontWeight: "600" },
  chipTxtOn: { color: "#16140F" },
  row: { flexDirection: "row", gap: 10 },
  foot: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: "#0B0A08" },
  cta: { height: 52, borderRadius: 26, backgroundColor: "#F4F0E6", alignItems: "center", justifyContent: "center" },
  ctaOff: { backgroundColor: "#2A2824" },
  ctaTxt: { color: "#16140F", fontWeight: "800", fontSize: 16 },
  ctaTxtOff: { color: "rgba(244,240,230,0.35)" },
  gate: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,10,8,0.96)", alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 12 },
  gateH: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 28, textAlign: "center" },
  gateP: { color: "rgba(244,240,230,0.6)", textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  big: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 28, textAlign: "center" },
  p: { color: "rgba(244,240,230,0.58)", textAlign: "center", marginTop: 10, lineHeight: 22 },
});
