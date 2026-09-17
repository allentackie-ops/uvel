import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
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
import { ShipsPicker } from "../../components/ShipsPicker";
import { BRAND_CATEGORIES, type Category } from "../../lib/catalog";
import { hasBrandContact } from "../../lib/brandContact";
import { BRAND_CONDITIONS, SIZE_SYSTEMS, sizesOf, systemFor, type SizeSystem } from "../../lib/brandSizes";
import { brandApproved, canPost, getBrand, themeFor, useBrands } from "../../lib/brands";
import { getMarket } from "../../lib/markets";
import { pickListingPhoto, takeListingPhoto } from "../../lib/photo";
import { reviewListingForFeed, reviewListingPhoto, type PhotoReview } from "../../lib/photoCheck";
import { encodeShipsTo, type ShipsTo } from "../../lib/ships";
import { useUvel } from "../../lib/store";
import { recordAuditEvent } from "../../lib/audit";
import { addPiece, createBrandCatalogRemote } from "../../lib/wardrobe";
import { firebaseReady } from "../../lib/firebase";
import { takePendingListingSelection } from "../../lib/listingOptions";

const COVER_W = 112;
const COVER_H = 140;
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
  const origin = brand?.country || app.country || "US";
  const market = getMarket(origin);
  const [photos, setPhotos] = useState<Slot[]>([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [system, setSystem] = useState<SizeSystem>("clothing");
  const [picked, setPicked] = useState<string[]>([]);
  const [sizeStock, setSizeStock] = useState<Record<string, string>>({});
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [shipsTo, setShipsTo] = useState<ShipsTo>(() => encodeShipsTo(origin, "home"));
  const [condition, setCondition] = useState<(typeof BRAND_CONDITIONS)[number]>("New");
  const [gate, setGate] = useState<Gate>({ phase: "idle" });
  const [stage, setStage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const ph = "rgba(244,240,230,0.32)";
  const cover = photos[0];
  const contactReady = hasBrandContact(brand || {});

  useEffect(() => {
    if (gate.phase !== "review") return;
    setStage(0);
    const t = setInterval(() => setStage((n) => (n + 1) % STAGES.length), 4200);
    return () => clearInterval(t);
  }, [gate.phase]);

  useFocusEffect(useCallback(() => {
    const selectedColor = takePendingListingSelection("color");
    const selectedMaterial = takePendingListingSelection("material");
    if (selectedColor) setColor(selectedColor);
    if (selectedMaterial) setMaterial(selectedMaterial);
  }, []));

  const hasVariantStock = picked.length > 0 && picked.every((size) => Number(sizeStock[size]) > 0);
  const canList =
    Boolean(brand && canPost(brand, app.uid)) &&
    contactReady &&
    photos.length > 0 &&
    Boolean(name.trim()) &&
    Boolean(sku.trim()) &&
    Boolean(notes.trim()) &&
    Number(price) > 0 &&
    hasVariantStock &&
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

  if (!brandApproved(brand)) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backTxt}>‹</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.big}>Verification first</Text>
          <Text style={styles.p}>A brand posts after it is accepted. Open Brand HQ.</Text>
          <Pressable onPress={() => router.push({ pathname: "/brand/hq", params: { id: brand.id } })} style={styles.cta}>
            <Text style={styles.ctaTxt}>Open Brand HQ</Text>
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

  const activeBrand = brand;
  const brandTheme = themeFor(activeBrand);
  const pageIndicator = { backgroundColor: brandTheme.accent, borderColor: brandTheme.accent };
  const pageIndicatorText = { color: brandTheme.accentInk };
  const steps = [
    { key: "photo", done: photos.length > 0, label: "Add a photo" },
    { key: "title", done: Boolean(name.trim()), label: "Add an item name" },
    { key: "price", done: Number(price) > 0, label: "Add a price" },
    { key: "sku", done: Boolean(sku.trim()), label: "Add an SKU" },
    { key: "stock", done: hasVariantStock, label: "Add inventory" },
    { key: "description", done: Boolean(notes.trim()), label: "Add a description" },
    { key: "category", done: Boolean(category), label: "Pick a category" },
    { key: "size", done: picked.length > 0, label: "Add a size" },
    { key: "color", done: Boolean(color.trim()), label: "Add a colour" },
    { key: "material", done: Boolean(material.trim()), label: "Add a material" },
    { key: "condition", done: Boolean(condition), label: "Pick a condition" },
  ] as const;
  const nextStep = steps.find((step) => !step.done);
  const progress = steps.filter((step) => step.done).length;
  const ctaLabel = nextStep?.label ?? "Complete";
  const ctaReady = gate.phase === "idle";

  function goNext() {
    if (!nextStep) {
      void publish();
      return;
    }
    const stepIndex = steps.indexOf(nextStep);
    scrollRef.current?.scrollTo({ y: Math.max(0, stepIndex * 190), animated: true });
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
          if (i === 0) void takeListingPhoto().then((u) => { if (u) void addUri(u); });
          if (i === 1) void pickListingPhoto().then((u) => { if (u) void addUri(u); });
        },
      );
      return;
    }
    Alert.alert("Add a photo", undefined, [
      { text: "Camera", onPress: () => void takeListingPhoto().then((u) => { if (u) void addUri(u); }) },
      { text: "Library", onPress: () => void pickListingPhoto().then((u) => { if (u) void addUri(u); }) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function pickCat(c: Category) {
    setCategory(c);
    const sys = systemFor(c);
    setSystem(sys);
    setPicked([]);
    setSizeStock({});
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
        brand: activeBrand.name,
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
    const variantStock = Object.fromEntries(
      picked.map((size) => [size, Math.max(0, Math.round(Number(sizeStock[size] || stockQuantity) || 0))]),
    );
    const totalStock = Object.values(variantStock).reduce((sum, value) => sum + value, 0);
    if (!totalStock) {
      setGate({ phase: "block", headline: "Add inventory first", reasons: ["Enter at least one unit for every selected size."] });
      return;
    }
    try {
      const created = addPiece({
        photo: uris[0],
        photos: uris,
        name: name.trim(),
        brand: activeBrand.name,
        sku: sku.trim().toUpperCase(),
        category,
        color: color.trim(),
        size: picked[0],
        sizes: picked,
        condition,
        material: material.trim(),
        notes: notes.trim(),
        listPriceCents: Math.max(1, Number(price) || 0) * 100,
        originalPriceCents: 0,
        stockQuantity: totalStock,
        sizeStock: variantStock,
        country: origin,
        currency: market.currency,
        shipsTo,
        brandId: activeBrand.id,
        ownerId: activeBrand.ownerId,
        ownerName: activeBrand.name,
        ownerPhoto: activeBrand.logoUri,
        listedByUid: app.uid,
        listedByName: app.displayName,
        status: "listed",
      });
      if (firebaseReady()) {
        const synced = await createBrandCatalogRemote(created);
        if (!synced) throw new Error("The product was not connected to the brand catalog. Check your connection and try again.");
      }
      void recordAuditEvent({ brandId: activeBrand.id, action: "product_created", entity: "product", entityId: created.id, entityName: created.name, summary: "Product published from the brand listing form.", metadata: { sku: created.sku || "", stockUnits: created.stockQuantity || 0 } });
    } catch (err) {
      setGate({
        phase: "block",
        headline: "Couldn’t list this",
        reasons: [err instanceof Error ? err.message : "Try again in a moment."],
      });
      return;
    }
    setGate({ phase: "pass" });
    setTimeout(() => router.replace({ pathname: "/brand/[id]", params: { id: activeBrand.id } }), 1100);
  }

  return (
    <View style={[styles.page, { backgroundColor: brandTheme.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
              <Text style={styles.topTitle}>List on {activeBrand.name}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.progressMeta, { backgroundColor: brandTheme.bg }]}><Text style={styles.progressKicker}>NEW PRODUCT</Text><Text style={styles.progressCopy}>{progress}/{steps.length} ready</Text></View>
        <View style={[styles.progressTrack, { backgroundColor: brandTheme.lineColor }]}><View style={[styles.progressFill, { width: `${(progress / steps.length) * 100}%`, backgroundColor: brandTheme.accent }]} /></View>
          <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {!contactReady ? (
            <View style={styles.contactGate}>
              <Text style={styles.contactGateTitle}>Add a brand contact first</Text>
              <Text style={styles.contactGateText}>Before publishing a listing, add at least one reachable phone, WhatsApp, Instagram, email, or website to this brand.</Text>
              <Pressable
                onPress={() => router.push({ pathname: "/brand/hq", params: { id: activeBrand.id } })}
                style={[styles.contactGateBtn, pageIndicator]}
              >
                <Text style={[styles.contactGateBtnText, pageIndicatorText]}>Open Brand HQ</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable onPress={cover ? undefined : choosePhoto} style={[styles.hero, { backgroundColor: brandTheme.card }]}>
            {cover ? (
              <Image cachePolicy="memory-disk" source={{ uri: cover.uri }} style={styles.heroImg} contentFit="contain" />
            ) : (
              <View style={styles.heroEmpty}>
                <Text style={styles.heroPlus}>＋</Text>
                <Text style={styles.heroHint}>Show the piece clearly</Text>
                <Text style={styles.heroSub}>Add a cover photo to start</Text>
              </View>
            )}
            {cover?.status === "checking" ? (
              <View style={[styles.heroMask, { backgroundColor: `${brandTheme.accent}80` }]}>
                <ActivityIndicator color="#16140F" />
              </View>
            ) : null}
          </Pressable>
          <View style={styles.slotRow}>
            {photos.map((p) => (
              <Pressable key={p.uri} onPress={() => setPhotos((prev) => prev.filter((x) => x.uri !== p.uri))}>
                <Image cachePolicy="memory-disk" source={{ uri: p.uri }} style={[styles.mini, { backgroundColor: brandTheme.card }]} contentFit="cover" />
              </Pressable>
            ))}
          </View>

          <View style={styles.sheet}>
            <Text style={styles.sectionKicker}>THE PIECE</Text>
            <TextInput style={styles.titleField} value={name} onChangeText={setName} placeholder="What’s the item called?" placeholderTextColor={ph} />
            <Text style={styles.label}>Price *</Text>
            <View style={styles.priceRow}>
              <Text style={styles.dollar}>{market.symbol}</Text>
              <TextInput style={styles.price} value={price} onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" placeholderTextColor={ph} />
            </View>
            <Text style={styles.label}>SKU *</Text>
            <Text style={styles.hint}>A unique product code for your team and inventory system.</Text>
            <TextInput style={styles.field} value={sku} onChangeText={(v) => setSku(v.replace(/[^a-z0-9-]/gi, "").toUpperCase())} placeholder="e.g. AT4-SLIP-001" placeholderTextColor={ph} autoCapitalize="characters" />

            <Text style={styles.sectionKickerLater}>INVENTORY</Text>
            <Text style={styles.label}>Default units per size</Text>
            <Text style={styles.hint}>Optional shortcut used to prefill each selected size below.</Text>
            <TextInput
              style={styles.field}
              value={stockQuantity}
              onChangeText={(v) => setStockQuantity(v.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="e.g. 12"
              placeholderTextColor={ph}
            />

            <Text style={styles.sectionKickerLater}>SELLING</Text>
            <View style={styles.marketSection}>
              <ShipsPicker origin={origin} value={shipsTo} onChange={setShipsTo} accent={brandTheme.accent} accentInk={brandTheme.accentInk} />
            </View>
            <Text style={styles.label}>Description *</Text>
            <TextInput style={styles.body} value={notes} onChangeText={setNotes} placeholder="Cloth, make, how it sits" placeholderTextColor={ph} multiline />

            <Text style={styles.label}>Category *</Text>
            <Text style={styles.hint}>Clothes, shoes, jewelry, hats, swim, the whole rack.</Text>
            <View style={styles.chips}>
              {BRAND_CATEGORIES.map((c) => (
                <Pressable key={c} onPress={() => pickCat(c)} style={[styles.chip, category === c && pageIndicator]}>
                  <Text style={[styles.chipTxt, category === c && pageIndicatorText]}>{c}</Text>
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
                    setSizeStock({});
                  }}
                  style={[styles.chip, system === s.id && pageIndicator]}
                >
                  <Text style={[styles.chipTxt, system === s.id && pageIndicatorText]}>{s.label}</Text>
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
                    onPress={() => {
                      setPicked((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]));
                      if (!on) setSizeStock((prev) => ({ ...prev, [s]: prev[s] || stockQuantity }));
                    }}
                    style={[styles.chip, on && pageIndicator]}
                  >
                    <Text style={[styles.chipTxt, on && pageIndicatorText]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>
            {picked.length ? (
              <View style={styles.variantStockBlock}>
                <Text style={styles.label}>Stock by size *</Text>
                <Text style={styles.hint}>Enter the sellable units for every selected size.</Text>
                {picked.map((size) => (
                  <View key={size} style={styles.variantStockRow}>
                    <Text style={styles.variantStockSize}>{size}</Text>
                    <TextInput
                      style={styles.variantStockInput}
                      value={sizeStock[size] || ""}
                      onChangeText={(value) => setSizeStock((prev) => ({ ...prev, [size]: value.replace(/[^0-9]/g, "") }))}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={ph}
                    />
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Colour *</Text>
                <Pressable
                  onPress={() => router.push({ pathname: "/brand/list-option", params: { id: activeBrand.id, kind: "color", value: color } })}
                  style={[styles.selectionField, { borderColor: color ? brandTheme.accent : brandTheme.lineColor, backgroundColor: brandTheme.card }]}
                  accessibilityRole="button"
                  accessibilityLabel={color ? `Colour, ${color}` : "Choose a colour"}
                >
                  <Text style={[styles.selectionValue, { color: color ? brandTheme.ink : ph }]} numberOfLines={1}>{color || "Choose colour"}</Text>
                  <Text style={[styles.selectionArrow, { color: brandTheme.accent }]}>›</Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Material *</Text>
                <Pressable
                  onPress={() => router.push({ pathname: "/brand/list-option", params: { id: activeBrand.id, kind: "material", value: material } })}
                  style={[styles.selectionField, { borderColor: material ? brandTheme.accent : brandTheme.lineColor, backgroundColor: brandTheme.card }]}
                  accessibilityRole="button"
                  accessibilityLabel={material ? `Material, ${material}` : "Choose a material"}
                >
                  <Text style={[styles.selectionValue, { color: material ? brandTheme.ink : ph }]} numberOfLines={1}>{material || "Choose material"}</Text>
                  <Text style={[styles.selectionArrow, { color: brandTheme.accent }]}>›</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.label}>Availability</Text>
            <View style={styles.chips}>
              {BRAND_CONDITIONS.map((c) => (
                <Pressable key={c} onPress={() => setCondition(c)} style={[styles.chip, condition === c && pageIndicator]}>
                  <Text style={[styles.chipTxt, condition === c && pageIndicatorText]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
        <View style={[styles.foot, { paddingBottom: insets.bottom + 12, backgroundColor: brandTheme.bg }]}>
          <Pressable
            onPress={goNext}
            disabled={!ctaReady}
            style={[styles.cta, { backgroundColor: ctaReady ? brandTheme.accent : `${brandTheme.accent}55` }]}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            accessibilityState={{ disabled: !ctaReady, busy: gate.phase === "review" }}
          >
            <Text style={[styles.ctaTxt, { color: ctaReady ? brandTheme.accentInk : `${brandTheme.accentInk}80` }]}>{ctaLabel}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {gate.phase !== "idle" ? (
        <View style={[styles.gate, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
          {gate.phase === "review" ? (
            <>
              <ActivityIndicator color={brandTheme.accent} />
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
          {gate.phase === "pass" ? <Text style={styles.gateH}>On {activeBrand.name}.</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#000000" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 8 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backTxt: { color: "#F4F0E6", fontSize: 34, lineHeight: 36, marginTop: -4 },
  topTitle: { color: "#F4F0E6", fontSize: 16, fontWeight: "600" },
  progressMeta: { height: 34, paddingHorizontal: 20, backgroundColor: "#000000", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressKicker: { color: "rgba(244,240,230,0.48)", fontSize: 10, letterSpacing: 1.6, fontWeight: "800" },
  progressCopy: { color: "rgba(244,240,230,0.55)", fontSize: 12, fontWeight: "600" },
  progressTrack: { height: 3, backgroundColor: "#2A2824", marginHorizontal: 20, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 3, backgroundColor: "#2A2824", borderRadius: 2 },
  contactGate: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#2A2824", backgroundColor: "#1A1814" },
  contactGateTitle: { color: "#F4F0E6", fontWeight: "700", fontSize: 16 },
  contactGateText: { color: "rgba(244,240,230,0.6)", fontSize: 13, lineHeight: 18, marginTop: 6 },
  contactGateBtn: { marginTop: 12, alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "#2A2824" },
  contactGateBtnText: { color: "#F4F0E6", fontSize: 13, fontWeight: "700" },
  hero: { width: COVER_W, height: COVER_H, marginHorizontal: 20, marginTop: 16, borderRadius: 16, overflow: "hidden", backgroundColor: "#161512" },
  heroImg: { width: "100%", height: "100%" },
  heroEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8 },
  heroPlus: { color: "#F4F0E6", fontSize: 30, fontWeight: "300" },
  heroHint: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 14, textAlign: "center" },
  heroSub: { color: "rgba(244,240,230,0.42)", fontSize: 10, textAlign: "center", marginTop: 2 },
  heroMask: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(42,40,36,0.5)", alignItems: "center", justifyContent: "center" },
  slotRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  mini: { width: 64, height: 80, borderRadius: 10, backgroundColor: "#161512" },
  sheet: { paddingHorizontal: 20, paddingTop: 28 },
  sectionKicker: { color: "rgba(244,240,230,0.48)", fontSize: 11, letterSpacing: 1.6, fontWeight: "800", marginBottom: 4 },
  sectionKickerLater: { color: "rgba(244,240,230,0.48)", fontSize: 11, letterSpacing: 1.6, fontWeight: "800", marginTop: 34, marginBottom: 4 },
  marketSection: { marginTop: 8 },
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
  titleField: { color: "#F4F0E6", fontSize: 26, fontWeight: "800", lineHeight: 32, marginTop: 16, padding: 0 },
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
  chipOn: { backgroundColor: "#2A2824", borderColor: "#2A2824" },
  chipTxt: { color: "#F4F0E6", fontSize: 13, fontWeight: "600" },
  chipTxtOn: { color: "#16140F" },
  row: { flexDirection: "row", gap: 10 },
  selectionField: { marginTop: 8, minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectionValue: { flex: 1, fontSize: 15, fontWeight: "600" },
  selectionArrow: { fontSize: 26, lineHeight: 26, marginLeft: 6, fontWeight: "300" },
  variantStockBlock: { marginTop: 2 },
  variantStockRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  variantStockSize: { color: "#F4F0E6", fontSize: 14, fontWeight: "700" },
  variantStockInput: { width: 92, height: 42, borderRadius: 12, borderWidth: 1, borderColor: "rgba(244,240,230,0.22)", color: "#F4F0E6", paddingHorizontal: 12, textAlign: "right", fontSize: 15 },
  foot: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: "#000000" },
  cta: { height: 52, borderRadius: 26, backgroundColor: "#2A2824", alignItems: "center", justifyContent: "center" },
  ctaOff: { backgroundColor: "#2A2824" },
  ctaTxt: { color: "#16140F", fontWeight: "800", fontSize: 16 },
  ctaTxtOff: { color: "rgba(244,240,230,0.35)" },
  gate: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(11,10,8,0.96)", alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 12 },
  gateH: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 28, textAlign: "center" },
  gateP: { color: "rgba(244,240,230,0.6)", textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  big: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 28, textAlign: "center" },
  p: { color: "rgba(244,240,230,0.58)", textAlign: "center", marginTop: 10, lineHeight: 22 },
});
