import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
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
import { OrbitLoader } from "../../components/OrbitLoader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShipsPicker } from "../../components/ShipsPicker";
import { SortablePhotoStrip } from "../../components/SortablePhotoStrip";
import { BRAND_CATEGORIES, type Category } from "../../lib/catalog";
import { hasBrandContact } from "../../lib/brandContact";
import { BRAND_CONDITIONS, SIZE_SYSTEMS, sizesOf, systemFor, type SizeSystem } from "../../lib/brandSizes";
import { canPost, getBrand, themeFor, useBrands } from "../../lib/brands";
import { BRAND_THEMES, adaptBrandThemeToAppearance } from "../../lib/brandThemes";
import { getMarket } from "../../lib/markets";
import { pickListingClip, pickListingPhotos, takeListingClip, takeListingPhoto } from "../../lib/photo";
import { reviewListingForFeed, reviewListingPhoto, type PhotoReview } from "../../lib/photoCheck";
import { encodeShipsTo, restrictShipsTo, type ShipsTo } from "../../lib/ships";
import { useUvel } from "../../lib/store";
import { recordAuditEvent } from "../../lib/audit";
import { addPiece, createBrandCatalogRemote } from "../../lib/wardrobe";
import { firebaseReady } from "../../lib/firebase";
import { takePendingListingSelection } from "../../lib/listingOptions";
import { useColors, useResolvedAppearance } from "../../lib/theme";

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
  const colors = useColors();
  const appearance = useResolvedAppearance();
  const insets = useSafeAreaInsets();
  const brandTheme = useMemo(
    () => adaptBrandThemeToAppearance(brand ? themeFor(brand) : BRAND_THEMES[0], appearance, colors),
    [brand, appearance, colors],
  );
  const styles = useMemo(() => makeStyles(brandTheme), [brandTheme]);
  const origin = brand?.country || app.country || "US";
  const market = getMarket(origin);
  const [photos, setPhotos] = useState<Slot[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [clipUri, setClipUri] = useState("");
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
  const brandShipsTo = brand?.operatingCountries || encodeShipsTo(origin, "home");
  const [shipsTo, setShipsTo] = useState<ShipsTo>(() => brandShipsTo);
  const [condition, setCondition] = useState<(typeof BRAND_CONDITIONS)[number]>("New");
  const [gate, setGate] = useState<Gate>({ phase: "idle" });
  const [stage, setStage] = useState(0);
  const [openSection, setOpenSection] = useState<"product" | "inventory" | "details" | "delivery" | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const previousPhotoCount = useRef(photos.length);
  const ph = brandTheme.muted;
  const cover = photos[0];
  const previewPhoto = photos[selectedPhotoIndex] || cover;
  const contactReady = hasBrandContact(brand || {});

  useEffect(() => {
    if (gate.phase !== "review") return;
    setStage(0);
    const t = setInterval(() => setStage((n) => (n + 1) % STAGES.length), 4200);
    return () => clearInterval(t);
  }, [gate.phase]);

  useEffect(() => {
    if (photos.length > 0 && previousPhotoCount.current === 0) setOpenSection("product");
    previousPhotoCount.current = photos.length;
  }, [photos.length]);

  useEffect(() => {
    setSelectedPhotoIndex((index) => Math.min(index, Math.max(0, photos.length - 1)));
  }, [photos.length]);

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

  if (brand.status === "rejected") {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backTxt}>‹</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.big}>Brand review needed</Text>
          <Text style={styles.p}>Open Brand HQ to update this brand before listing an item.</Text>
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
    const section = nextStep.key === "photo" || nextStep.key === "title" || nextStep.key === "price" || nextStep.key === "sku" || nextStep.key === "description"
      ? "product"
      : nextStep.key === "stock"
        ? "inventory"
        : nextStep.key === "category" || nextStep.key === "size" || nextStep.key === "color" || nextStep.key === "material" || nextStep.key === "condition"
          ? "details"
          : "delivery";
    setOpenSection(section);
    const stepIndex = steps.indexOf(nextStep);
    scrollRef.current?.scrollTo({ y: Math.max(0, stepIndex * 190), animated: true });
  }

  async function addUri(uri: string) {
    if (photos.length >= MAX) return;
    if (photos.some((photo) => photo.uri === uri)) return;
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

  async function fromLibrary() {
    const uris = await pickListingPhotos(MAX - photos.length);
    for (const uri of uris) await addUri(uri);
  }

  function chooseClip() {
    Keyboard.dismiss();
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Record a clip", "Choose from library", "Cancel"], cancelButtonIndex: 2, userInterfaceStyle: "dark" },
        (i) => {
          if (i === 0) void takeListingClip().then((uri) => { if (uri) setClipUri(uri); });
          if (i === 1) void pickListingClip().then((uri) => { if (uri) setClipUri(uri); });
        },
      );
      return;
    }
    Alert.alert("Add a clip", "Up to 15 seconds.", [
      { text: "Record a clip", onPress: () => void takeListingClip().then((uri) => { if (uri) setClipUri(uri); }) },
      { text: "Choose from library", onPress: () => void pickListingClip().then((uri) => { if (uri) setClipUri(uri); }) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function choosePhoto() {
    Keyboard.dismiss();
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Camera", "Library", "Cancel"], cancelButtonIndex: 2, userInterfaceStyle: "dark" },
        (i) => {
          if (i === 0) void takeListingPhoto().then((u) => { if (u) void addUri(u); });
          if (i === 1) void fromLibrary();
        },
      );
      return;
    }
    Alert.alert("Add a photo", undefined, [
      { text: "Camera", onPress: () => void takeListingPhoto().then((u) => { if (u) void addUri(u); }) },
      { text: "Library", onPress: () => void fromLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function removePhoto(uri: string) {
    const removedIndex = photos.findIndex((photo) => photo.uri === uri);
    setPhotos((prev) => prev.filter((photo) => photo.uri !== uri));
    if (removedIndex >= 0) {
      setSelectedPhotoIndex((index) => index > removedIndex ? index - 1 : Math.min(index, Math.max(0, photos.length - 2)));
    }
  }

  function reorderPhotos(from: number, to: number) {
    setPhotos((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setSelectedPhotoIndex((index) => index === from ? to : index > from && index <= to ? index - 1 : index < from && index >= to ? index + 1 : index);
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
    const needsReview = activeBrand.verified !== true;
    if (!needsReview) setGate({ phase: "review", line: STAGES[0] });
    const started = Date.now();
    let result;
    if (!needsReview) {
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
        clipUri: clipUri || undefined,
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
        shipsTo: restrictShipsTo(origin, shipsTo, activeBrand.operatingCountries || brandShipsTo),
        brandId: activeBrand.id,
        ownerId: activeBrand.ownerId,
        ownerName: activeBrand.name,
        ownerPhoto: activeBrand.logoUri,
        listedByUid: app.uid,
        listedByName: app.displayName,
        status: needsReview ? "review_pending" : "listed",
      });
      if (firebaseReady()) {
        const synced = await createBrandCatalogRemote(created, { uploadMedia: needsReview });
        if (!synced) throw new Error("The product was not connected to the brand catalog. Check your connection and try again.");
      }
      void recordAuditEvent({ brandId: activeBrand.id, action: "product_created", entity: "product", entityId: created.id, entityName: created.name, summary: needsReview ? "Product submitted for automated safety review." : "Product published from the brand listing form.", metadata: { sku: created.sku || "", stockUnits: created.stockQuantity || 0, moderationStatus: needsReview ? "review_pending" : "approved" } });
    } catch (err) {
      setGate({
        phase: "block",
        headline: "Couldn’t list this",
        reasons: [err instanceof Error ? err.message : "Try again in a moment."],
      });
      return;
    }
    if (needsReview) {
      Alert.alert("Your item is in review", "It only takes a few moments.", [{ text: "Done", onPress: () => router.replace({ pathname: "/brand/[id]", params: { id: activeBrand.id } }) }]);
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
        <View style={styles.progressLabels}>
          <Text style={[styles.progressLabel, photos.length > 0 && { color: brandTheme.accent }]}>Capture</Text>
          <Text style={[styles.progressLabel, name && price && sku && { color: brandTheme.accent }]}>Product</Text>
          <Text style={[styles.progressLabel, hasVariantStock && { color: brandTheme.accent }]}>Inventory</Text>
          <Text style={[styles.progressLabel, category && color && material && { color: brandTheme.accent }]}>Details</Text>
          <Text style={[styles.progressLabel, canList && { color: brandTheme.accent }]}>Publish</Text>
        </View>
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
              <Image cachePolicy="memory-disk" source={{ uri: previewPhoto?.uri || cover.uri }} style={styles.heroImg} contentFit="contain" />
            ) : (
              <View style={styles.heroEmpty}>
                <Text style={styles.heroPlus}>＋</Text>
                <Text style={styles.heroHint}>Show the piece clearly</Text>
                <Text style={styles.heroSub}>Add a cover photo to start</Text>
              </View>
            )}
            {cover?.status === "checking" ? (
              <View style={[styles.heroMask, { backgroundColor: `${brandTheme.accent}80` }]}>
                <OrbitLoader size={24} />
              </View>
            ) : null}
          </Pressable>
          <View style={styles.photoMetaRow}>
            <Text style={[styles.photoCount, { color: brandTheme.ink }]}>Photos · {photos.length}/{MAX}</Text>
            <Text style={[styles.photoHint, { color: brandTheme.muted }]}>Clear angles help shoppers decide</Text>
          </View>
          <View style={styles.slotRow}>
            <SortablePhotoStrip
              photos={photos}
              onPreview={setSelectedPhotoIndex}
              onReorder={reorderPhotos}
              contentContainerStyle={styles.photoRow}
              renderPhoto={(p, i) => (
                <View style={[styles.miniWrap, i === selectedPhotoIndex && styles.miniSelected]}>
                  <Image cachePolicy="memory-disk" source={{ uri: p.uri }} style={[styles.mini, { backgroundColor: brandTheme.card }]} contentFit="cover" />
                  <Pressable
                    onPress={() => removePhoto(p.uri)}
                    hitSlop={8}
                    style={styles.miniRemove}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${i + 1}`}
                    accessibilityHint="Double tap to remove this photo."
                  >
                    <Text style={styles.miniRemoveText}>×</Text>
                  </Pressable>
                </View>
              )}
            />
            {photos.length < MAX ? <Pressable onPress={choosePhoto} style={[styles.addPhotoTile, { borderColor: brandTheme.lineColor, backgroundColor: brandTheme.card }]}><Text style={[styles.addPhotoPlus, { color: brandTheme.accent }]}>＋</Text><Text style={[styles.addPhotoText, { color: brandTheme.ink }]}>{photos.length ? "Add more" : "Add photos"}</Text></Pressable> : null}
          </View>
          <Pressable onPress={chooseClip} style={[styles.clipRow, { borderColor: brandTheme.lineColor, backgroundColor: brandTheme.card }]}>
            <Text style={[styles.clipIcon, { color: brandTheme.accent }]}>▹</Text>
            <View style={{ flex: 1 }}><Text style={[styles.clipTitle, { color: brandTheme.ink }]}>{clipUri ? "Motion clip added" : "Add a motion clip"}</Text><Text style={[styles.clipBody, { color: brandTheme.muted }]}>{clipUri ? "Tap to replace · up to 15 seconds" : "Optional · show the piece in motion"}</Text></View>
            <Text style={[styles.clipArrow, { color: brandTheme.muted }]}>{clipUri ? "Replace" : "＋"}</Text>
          </Pressable>

          <View style={styles.sheet}>
            <Pressable onPress={() => setOpenSection((section) => section === "product" ? null : "product")} style={[styles.sectionHeader, openSection === "product" && styles.sectionHeaderOpen, { backgroundColor: brandTheme.card }]} accessibilityRole="button" accessibilityState={{ expanded: openSection === "product" }}>
              <View style={[styles.sectionIcon, { backgroundColor: `${brandTheme.accent}22` }]}><Ionicons name="shirt-outline" size={20} color={brandTheme.accent} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: brandTheme.ink }]}>Product</Text><Text style={[styles.sectionSummary, { color: brandTheme.muted }]}>{name || "Name, price, SKU, description"}</Text></View>
              <Text style={[styles.sectionChevron, { color: brandTheme.muted }]}>{openSection === "product" ? "⌄" : "›"}</Text>
            </Pressable>
            {openSection === "product" ? <View style={[styles.sectionBody, { backgroundColor: `${brandTheme.card}88` }] }>
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
            </View> : null}

            <Pressable onPress={() => setOpenSection((section) => section === "inventory" ? null : "inventory")} style={[styles.sectionHeader, openSection === "inventory" && styles.sectionHeaderOpen, { backgroundColor: brandTheme.card }]} accessibilityRole="button" accessibilityState={{ expanded: openSection === "inventory" }}>
              <View style={[styles.sectionIcon, { backgroundColor: `${brandTheme.accent}22` }]}><Text style={[styles.sectionIconText, { color: brandTheme.accent }]}>▦</Text></View>
              <View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: brandTheme.ink }]}>Inventory</Text><Text style={[styles.sectionSummary, { color: brandTheme.muted }]}>{picked.length ? `${picked.length} size${picked.length === 1 ? "" : "s"} selected` : "Units and size stock"}</Text></View>
              <Text style={[styles.sectionChevron, { color: brandTheme.muted }]}>{openSection === "inventory" ? "⌄" : "›"}</Text>
            </Pressable>
            {openSection === "inventory" ? <View style={[styles.sectionBody, { backgroundColor: `${brandTheme.card}88` }] }>
            <Text style={styles.sectionKicker}>INVENTORY</Text>
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
            </View> : null}

            <Pressable onPress={() => setOpenSection((section) => section === "delivery" ? null : "delivery")} style={[styles.sectionHeader, openSection === "delivery" && styles.sectionHeaderOpen, { backgroundColor: brandTheme.card }]} accessibilityRole="button" accessibilityState={{ expanded: openSection === "delivery" }}>
              <View style={[styles.sectionIcon, { backgroundColor: `${brandTheme.accent}22` }]}><Text style={[styles.sectionIconText, { color: brandTheme.accent }]}>↗</Text></View>
              <View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: brandTheme.ink }]}>Delivery & publish</Text><Text style={[styles.sectionSummary, { color: brandTheme.muted }]}>{shipsTo === "all" ? "All operating countries" : "Brand delivery settings"}</Text></View>
              <Text style={[styles.sectionChevron, { color: brandTheme.muted }]}>{openSection === "delivery" ? "⌄" : "›"}</Text>
            </Pressable>
            {openSection === "delivery" ? <View style={[styles.sectionBody, { backgroundColor: `${brandTheme.card}88` }] }>
            <Text style={styles.sectionKicker}>DELIVERY</Text>
            <View style={styles.marketSection}>
              <Text style={styles.hint}>Your brand delivery settings limit which countries this product can serve. International buyers pay the higher delivery rate at checkout.</Text>
              <ShipsPicker origin={origin} value={shipsTo} onChange={(next) => setShipsTo(restrictShipsTo(origin, next, activeBrand.operatingCountries || brandShipsTo))} accent={brandTheme.accent} accentInk={brandTheme.accentInk} />
            </View>
            </View> : null}

            <Pressable onPress={() => setOpenSection((section) => section === "details" ? null : "details")} style={[styles.sectionHeader, openSection === "details" && styles.sectionHeaderOpen, { backgroundColor: brandTheme.card }]} accessibilityRole="button" accessibilityState={{ expanded: openSection === "details" }}>
              <View style={[styles.sectionIcon, { backgroundColor: `${brandTheme.accent}22` }]}><Text style={[styles.sectionIconText, { color: brandTheme.accent }]}>⌘</Text></View>
              <View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: brandTheme.ink }]}>Details</Text><Text style={[styles.sectionSummary, { color: brandTheme.muted }]}>{category ? `${category} · ${color || "colour"} · ${material || "material"}` : "Category, sizes, colour, material"}</Text></View>
              <Text style={[styles.sectionChevron, { color: brandTheme.muted }]}>{openSection === "details" ? "⌄" : "›"}</Text>
            </Pressable>
            {openSection === "details" ? <View style={[styles.sectionBody, { backgroundColor: `${brandTheme.card}88` }] }>
            <Text style={styles.sectionKicker}>DETAILS</Text>
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
            </View> : null}
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
              <OrbitLoader size={24} />
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

function makeStyles(theme: ReturnType<typeof themeFor>) {
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.bg },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 8 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backTxt: { color: theme.ink, fontSize: 34, lineHeight: 36, marginTop: -4 },
  topTitle: { color: theme.ink, fontSize: 16, fontWeight: "600" },
  progressMeta: { height: 34, paddingHorizontal: 20, backgroundColor: theme.bg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressKicker: { color: theme.muted, fontSize: 10, letterSpacing: 1.6, fontWeight: "800" },
  progressCopy: { color: theme.muted, fontSize: 12, fontWeight: "600" },
  progressTrack: { height: 3, backgroundColor: theme.lineColor, marginHorizontal: 20, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 3, backgroundColor: theme.lineColor, borderRadius: 2 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginTop: 8 },
  progressLabel: { color: theme.muted, fontSize: 10, fontWeight: "800" },
  contactGate: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.lineColor, backgroundColor: theme.card },
  contactGateTitle: { color: theme.ink, fontWeight: "700", fontSize: 16 },
  contactGateText: { color: theme.muted, fontSize: 13, lineHeight: 18, marginTop: 6 },
  contactGateBtn: { marginTop: 12, alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: theme.accent },
  contactGateBtnText: { color: theme.accentInk, fontSize: 13, fontWeight: "700" },
  hero: { width: "auto", height: 220, marginHorizontal: 20, marginTop: 16, borderRadius: 20, overflow: "hidden", backgroundColor: theme.card },
  heroImg: { width: "100%", height: "100%" },
  heroEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8 },
  heroPlus: { color: theme.ink, fontSize: 30, fontWeight: "300" },
  heroHint: { color: theme.ink, fontFamily: "Georgia", fontSize: 14, textAlign: "center" },
  heroSub: { color: theme.muted, fontSize: 10, textAlign: "center", marginTop: 2 },
  heroMask: { ...StyleSheet.absoluteFill, backgroundColor: `${theme.bg}80`, alignItems: "center", justifyContent: "center" },
  photoMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12 },
  photoCount: { fontSize: 14, fontWeight: "800" },
  photoHint: { fontSize: 11 },
  slotRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  photoRow: { flexDirection: "row" },
  miniWrap: { width: 64, height: 80, borderRadius: 10, overflow: "hidden", position: "relative" },
  miniSelected: { borderWidth: 2, borderColor: theme.accent },
  mini: { width: 64, height: 80, borderRadius: 10, backgroundColor: theme.card },
  miniRemove: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.78)", alignItems: "center", justifyContent: "center" },
  miniRemoveText: { color: "#FFFFFF", fontSize: 16, lineHeight: 18, fontWeight: "700", marginTop: -1 },
  addPhotoTile: { width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  addPhotoPlus: { fontSize: 22, lineHeight: 24 },
  addPhotoText: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  clipRow: { minHeight: 64, marginHorizontal: 20, marginTop: 12, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  clipIcon: { fontSize: 26 },
  clipTitle: { fontSize: 14, fontWeight: "800" },
  clipBody: { fontSize: 12, marginTop: 3 },
  clipArrow: { fontSize: 13, fontWeight: "700" },
  sheet: { paddingHorizontal: 20, paddingTop: 18 },
  sectionHeader: { minHeight: 72, marginTop: 10, borderRadius: 18, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  sectionHeaderOpen: { borderBottomLeftRadius: 8, borderBottomRightRadius: 8, marginBottom: 0 },
  sectionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  sectionIconText: { fontSize: 18, fontWeight: "800" },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  sectionSummary: { fontSize: 12, marginTop: 3 },
  sectionChevron: { fontSize: 24, lineHeight: 24, marginTop: -3 },
  sectionBody: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 10, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  sectionKicker: { color: theme.muted, fontSize: 11, letterSpacing: 1.6, fontWeight: "800", marginBottom: 4 },
  sectionKickerLater: { color: theme.muted, fontSize: 11, letterSpacing: 1.6, fontWeight: "800", marginTop: 34, marginBottom: 4 },
  marketSection: { marginTop: 8 },
  label: { color: theme.muted, fontSize: 12, marginTop: 16, letterSpacing: 0.3 },
  hint: { color: theme.muted, fontSize: 13, marginTop: 4 },
  field: {
    marginTop: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.lineColor,
    color: theme.ink,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  titleField: { color: theme.ink, fontSize: 26, fontWeight: "800", lineHeight: 32, marginTop: 16, padding: 0 },
  body: {
    marginTop: 8,
    minHeight: 90,
    borderRadius: 14,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.lineColor,
    color: theme.ink,
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 16,
    textAlignVertical: "top",
  },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  dollar: { color: theme.ink, fontSize: 28, fontWeight: "700" },
  price: { flex: 1, color: theme.ink, fontSize: 32, fontWeight: "700", height: 48 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.lineColor,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipTxt: { color: theme.ink, fontSize: 13, fontWeight: "600" },
  chipTxtOn: { color: theme.accentInk },
  row: { flexDirection: "row", gap: 10 },
  selectionField: { marginTop: 8, minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectionValue: { flex: 1, fontSize: 15, fontWeight: "600" },
  selectionArrow: { fontSize: 26, lineHeight: 26, marginLeft: 6, fontWeight: "300" },
  variantStockBlock: { marginTop: 2 },
  variantStockRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  variantStockSize: { color: theme.ink, fontSize: 14, fontWeight: "700" },
  variantStockInput: { width: 92, height: 42, borderRadius: 12, borderWidth: 1, borderColor: theme.lineColor, color: theme.ink, paddingHorizontal: 12, textAlign: "right", fontSize: 15 },
  foot: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: theme.bg },
  cta: { height: 52, borderRadius: 26, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" },
  ctaOff: { backgroundColor: theme.accent },
  ctaTxt: { color: theme.accentInk, fontWeight: "800", fontSize: 16 },
  ctaTxtOff: { color: `${theme.accentInk}80` },
  gate: { ...StyleSheet.absoluteFill, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 12 },
  gateH: { color: theme.ink, fontFamily: "Georgia", fontSize: 28, textAlign: "center" },
  gateP: { color: theme.muted, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  big: { color: theme.ink, fontFamily: "Georgia", fontSize: 28, textAlign: "center" },
  p: { color: theme.muted, textAlign: "center", marginTop: 10, lineHeight: 22 },
});
}
