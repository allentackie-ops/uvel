import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  AppState,
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import type { Category } from "../lib/catalog";
import { usd } from "../lib/catalog";
import { uvelFeeCents } from "../lib/fees";
import { getMarket, getMarketByCurrency, moneyExact } from "../lib/markets";
import { takePendingListingPrice } from "../lib/listingPriceDraft";
import { clearListingDraft, loadListingDraft, saveListingDraft } from "../lib/listingDraft";
import { pickListingPhoto, takeListingPhoto } from "../lib/photo";
import { reviewListingForFeed, reviewListingPhoto, type PhotoReview } from "../lib/photoCheck";
import { encodeShipsTo, shipsToLabel, type ShipsTo } from "../lib/ships";
import { SHOP_LOOKS } from "../lib/shopLook";
import { takePendingListingSelection } from "../lib/listingOptions";
import { useUvel } from "../lib/store";
import { useCopy } from "../lib/useCopy";
import { useColors, type Colors } from "../lib/theme";
import { addPiece, getPiece, listPiece, updatePiece, useWardrobe } from "../lib/wardrobe";

const MAX = 5;
const W = Dimensions.get("window").width;
const LISTING_RATIO = 4 / 5;
const STAGES = [
  "Looking at the photos…",
  "Is this something we sell?",
  "Checking the listing…",
  "Looking for anything that shouldn’t be here…",
];

type Slot = {
  uri: string;
  status: "checking" | "ok" | "warn" | "unverified";
  review?: PhotoReview;
};

type Gate =
  | { phase: "idle" }
  | { phase: "review"; line: string }
  | { phase: "block"; headline: string; reasons: string[] }
  | { phase: "pass" };

export default function Sell({ embedded = false }: { embedded?: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { id, fits, draft: draftParam } = useLocalSearchParams<{ id?: string; fits?: string; draft?: string }>();
  useWardrobe();
  const existing = id ? getPiece(id) : undefined;
  const { wardrobeUris, uid, displayName, country, isPlus, personUri, avatarUri, appearance } = useUvel();
  const C = useCopy();
  const market = getMarket(country);
  const [draftOrigin, setDraftOrigin] = useState<string | undefined>();
  const [draftCurrency, setDraftCurrency] = useState<string | undefined>();
  const listingCurrency = existing?.currency || draftCurrency || market.currency;
  const listingMarket = getMarketByCurrency(listingCurrency);
  const origin = existing?.country || draftOrigin || market.code;

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
  const [fitsOpen, setFitsOpen] = useState(fits === "1");
  const [shopLook, setShopLook] = useState(existing?.shopLook || "uvel");
  const [shipsTo, setShipsTo] = useState<ShipsTo>(
    existing?.shipsTo ?? encodeShipsTo(origin, "home"),
  );
  const [gate, setGate] = useState<Gate>({ phase: "idle" });
  const [stage, setStage] = useState(0);
  const [draftReady, setDraftReady] = useState(draftParam !== "1");
  const [draftDisabled, setDraftDisabled] = useState(false);
  const priceKey = existing?.id || "new";
  const leaveSell = useCallback(() => {
    if (embedded) router.replace("/(tabs)/index");
    else router.back();
  }, [embedded]);

  useEffect(() => {
    if (existing || draftParam !== "1") return;
    let active = true;
    setDraftReady(false);
    void loadListingDraft().then((saved) => {
      if (!active) return;
      if (saved) {
        setDraftOrigin(saved.origin);
        setDraftCurrency(saved.currency);
        setPhotos(saved.photos.map((photo) => ({ uri: photo.uri, status: "ok" as const })));
        setName(saved.name || "");
        setBrand(saved.brand || "");
        setCategory(saved.category || null);
        setColor(saved.color || "");
        setSize(saved.size || "");
        setCondition(saved.condition || "");
        setMaterial(saved.material || "");
        setNotes(saved.notes || "");
        setPrice(saved.price || "");
        setWas(saved.was || "");
        setShopLook(saved.shopLook || "uvel");
        setShipsTo(saved.shipsTo || encodeShipsTo(saved.origin || market.code, "home"));
      }
      setDraftReady(true);
    });
    return () => {
      active = false;
    };
  }, [draftParam, existing?.id]);

  useFocusEffect(
    useCallback(() => {
      const selected = takePendingListingPrice(priceKey);
      if (selected !== undefined) setPrice(selected);
      const pendingCategory = takePendingListingSelection("category");
      if (pendingCategory) setCategory(pendingCategory);
      const pendingCondition = takePendingListingSelection("condition");
      if (pendingCondition) setCondition(pendingCondition);
      const pendingShipsTo = takePendingListingSelection("shipsTo");
      if (pendingShipsTo) setShipsTo(pendingShipsTo);
      return undefined;
    }, [priceKey]),
  );

  const persistDraft = useCallback(() => {
    if (existing || !draftReady || draftDisabled) return;
    void saveListingDraft({
      photos: photos.map((photo) => ({ uri: photo.uri })),
      name,
      brand,
      category,
      color,
      size,
      condition,
      material,
      notes,
      price,
      was,
      shopLook,
      shipsTo,
      origin,
      currency: listingCurrency,
      updatedAt: Date.now(),
    });
  }, [existing?.id, draftReady, draftDisabled, photos, name, brand, category, color, size, condition, material, notes, price, was, shopLook, shipsTo, origin, listingCurrency]);

  useEffect(() => {
    if (existing || !draftReady || draftDisabled) return;
    const timer = setTimeout(persistDraft, 250);
    return () => clearTimeout(timer);
  }, [existing?.id, draftReady, draftDisabled, persistDraft]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") persistDraft();
    });
    return () => subscription.remove();
  }, [persistDraft]);

  const cover = photos[0];
  const warn = photos.find((p) => p.status === "warn");
  const checking = photos.some((p) => p.status === "checking");
  const hasPhoto = photos.length > 0;
  const photoReadyForPricing = photos.some((photo) => photo.review?.analysisStatus === "complete" && photo.review.ok);
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
  const ph = "rgba(244,240,230,0.28)";
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
                    : "Complete";

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
        prev.map((p) => (p.uri === uri
          ? { uri, status: review.analysisStatus === "unavailable" ? "unverified" : review.ok ? "ok" : "warn", review }
          : p)),
      );
    } catch {
      setPhotos((prev) => prev.map((p) => (p.uri === uri ? { uri, status: "unverified" } : p)));
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
      Alert.alert(C.photos, err instanceof Error ? err.message : "Couldn’t open photos.");
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

  function openCategory() {
    router.push({ pathname: "/sell-category", params: { selected: category || "" } });
  }

  function openCondition() {
    router.push({ pathname: "/sell-condition", params: { selected: condition || "" } });
  }

  function openPrice() {
    if (!hasPhoto) {
      Alert.alert("Add a product photo first", "Uvel needs to analyze the product photo before it can show price recommendations.");
      return;
    }
    if (checking) {
      Alert.alert("Analyzing your photo", "Price recommendations will be available after the AI review finishes.");
      return;
    }
    if (!photoReadyForPricing) {
      Alert.alert("Photo analysis required", "Add a clear product photo that passes the AI review before opening price recommendations.");
      return;
    }
    router.push({
      pathname: "/price",
      params: {
        key: priceKey,
        ...(existing?.id ? { pieceId: existing.id } : {}),
        name,
        brand,
        category: category || "",
        color,
        material,
        size,
        condition,
        analysis: "complete",
        currency: listingCurrency,
        market: origin,
        price,
      },
    });
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
      country: origin,
      currency: listingCurrency,
      shipsTo,
      shopLook: isPlus ? shopLook : "uvel",
    };
    const face = avatarUri || personUri || existing?.ownerPhoto;
    const listed = {
      ...draft,
      ownerId: uid,
      ownerName: displayName,
      ownerPhoto: face || undefined,
      country: origin,
      currency: listingCurrency,
      shipsTo,
    };
    if (existing) listPiece(existing.id, listed);
    else {
      setDraftDisabled(true);
      void clearListingDraft();
      addPiece({ ...listed, status: "listed" });
    }
    setGate({ phase: "pass" });
    setTimeout(() => router.replace(embedded ? "/(tabs)/index" : "/(tabs)/closet"), 1100);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
          <View style={styles.backPlaceholder} />
          <Text style={styles.topTitle}>{C.newListing}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(progress / 9) * 100}%` }]} />
        </View>
        <Text style={styles.progressLbl}>{progress} of 9 ready</Text>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 232 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.label, styles.photosLabel]}>Photos *</Text>
          <View style={styles.photoGrid}>
            {photos.map((p, i) => (
              <View key={p.uri} style={styles.photoTile}>
                <Image source={{ uri: p.uri }} style={styles.photoImage} contentFit="cover" accessibilityRole="image" accessibilityLabel={`Photo ${i + 1}${i === 0 ? ", main photo" : ""}`} />
                {i === 0 ? (
                  <View style={styles.mainPhotoPill}>
                    <Text style={styles.mainPhotoTxt}>Main</Text>
                  </View>
                ) : null}
                {p.status === "warn" ? <View style={styles.warnDot} /> : null}
                {p.status === "unverified" ? <View style={styles.unverifiedDot} /> : null}
                {p.status === "checking" ? (
                  <View style={styles.photoCheck}>
                    <ActivityIndicator color="#16140F" />
                  </View>
                ) : null}
                <AccessiblePressable                  onPress={() => removePhoto(p.uri)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.photoX, pressed && { opacity: 0.92 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${i + 1}`}
                  accessibilityHint="Double tap to remove this photo from the listing."
                >
                  <Text style={styles.photoXTxt}>×</Text>
                </AccessiblePressable>
              </View>
            ))}
            {photos.length < MAX ? (
              <AccessiblePressable                onPress={choosePhoto}
                style={({ pressed }) => [styles.photoTile, styles.photoAdd, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel={`Add photo, ${photos.length} of ${MAX} added`}
                accessibilityHint="Double tap to choose a listing photo."
              >
                <Text style={styles.photoAddIcon}>＋</Text>
                <Text style={styles.photoAddTxt}>{C.addPhoto}</Text>
                <Text style={styles.photoCount}>{photos.length}/{MAX}</Text>
              </AccessiblePressable>
            ) : null}
          </View>

          {fitsOpen && wardrobeUris.length ? (
            <View style={styles.picker}>
              <View style={styles.fitHead}>
                <Text style={styles.fitLbl}>From your fits</Text>
                <AccessiblePressable onPress={() => setFitsOpen(false)}>
                  <Text style={styles.fitLbl}>Done</Text>
                </AccessiblePressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {wardrobeUris.map((uri) => (
                  <AccessiblePressable                    key={uri}
                    onPress={() => {
                      setFitsOpen(false);
                      void addUri(uri);
                    }}
                  >
                    <Image source={{ uri }} style={styles.fit} contentFit="cover" />
                  </AccessiblePressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {warn?.review ? (
            <View style={styles.warnBox} accessibilityLiveRegion="polite">
              <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.warnTitle}>Warning: this photo won’t sell it</Text>
              {warn.review.issues.map((line) => (
                <Text key={line} style={styles.warnP}>
                  {line}
                </Text>
              ))}
              {warn.review.tip ? <Text style={styles.warnTip}>{warn.review.tip}</Text> : null}
              <AccessiblePressable                onPress={() => removePhoto(warn.uri)}
                style={({ pressed }) => [pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel="Take another photo"
              >
                <Text style={styles.warnCta}>Take another</Text>
              </AccessiblePressable>
            </View>
          ) : null}

          {hasPhoto && !photoReadyForPricing && !checking ? (
            <View style={styles.analysisNotice} accessibilityLiveRegion="polite">
              <Text style={styles.analysisTitle}>AI review required for price recommendations</Text>
              <Text style={styles.analysisCopy}>Uvel will show recommendations only after a product photo has been analyzed successfully.</Text>
            </View>
          ) : null}

          <View style={styles.sheet}>
            <Text style={styles.priceLabel}>{C.price} *</Text>
            <AccessiblePressable              onPress={openPrice}
              style={({ pressed }) => [styles.priceRow, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel={`Listing price: ${price ? `${listingMarket.symbol}${price}` : "not set"}`}
              accessibilityHint="Double tap to set the listing price."
            >
              <Text style={[styles.dollar, !price && { color: ph }]}>{listingMarket.symbol}</Text>
              <Text style={[styles.price, !price && { color: ph }]}>{price || "0"}</Text>
            </AccessiblePressable>
            {Number(price) > 0 ? (
              <Text style={styles.feeNote}>
                Buyer pays a {moneyExact(uvelFeeCents(Number(price) * 100, listingCurrency, listingMarket), listingCurrency)}{" "}
                Uvel fee at checkout. You receive the full {usd(Number(price) * 100, listingCurrency)}.
              </Text>
            ) : null}

            <Text style={styles.label}>{C.title} *</Text>
            <TextInput
              style={styles.titleIn}
              value={name}
              onChangeText={setName}
              placeholder="What’s the piece?"
              placeholderTextColor={ph}
              accessibilityLabel="Listing title"
              accessibilityHint="Required. Enter the name buyers will see."
            />
            <Text style={styles.label}>{C.description} *</Text>
            <TextInput
              style={styles.bodyIn}
              value={notes}
              onChangeText={setNotes}
              placeholder="Fit, fabric, any marks"
              placeholderTextColor={ph}
              accessibilityLabel="Listing description"
              accessibilityHint="Required. Describe the fit, fabric, and any marks."
              multiline
            />

            <Text style={styles.label}>{C.category} *</Text>
            <AccessiblePressable
              onPress={openCategory}
              style={({ pressed }) => [styles.choiceRow, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel={`Category: ${category || "not selected"}`}
              accessibilityHint="Double tap to open the category picker."
            >
              <Text style={[styles.choiceValue, !category && styles.choicePlaceholder]}>{category || "Choose a category"}</Text>
              <Text style={styles.choiceArrow}>›</Text>
            </AccessiblePressable>

            <View style={styles.row}>
              <View style={{ flex: 1.2 }}>
                <Text style={styles.label}>{C.brand}</Text>
                <TextInput
                  style={styles.field}
                  value={brand}
                  onChangeText={setBrand}
                  placeholder="Optional"
                  placeholderTextColor={ph}
                  accessibilityLabel="Brand, optional"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{C.size} *</Text>
                <TextInput
                  style={styles.field}
                  value={size}
                  onChangeText={setSize}
                  placeholder=""
                  placeholderTextColor={ph}
                  accessibilityLabel="Size, required"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{C.color}</Text>
                <TextInput
                  style={styles.field}
                  value={color}
                  onChangeText={setColor}
                  placeholder=""
                  placeholderTextColor={ph}
                  accessibilityLabel="Colour, required"
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
                  accessibilityLabel="Material, required"
                />
              </View>
            </View>

            <Text style={styles.label}>{C.condition} *</Text>
            <AccessiblePressable
              onPress={openCondition}
              style={({ pressed }) => [styles.choiceRow, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel={`Condition: ${condition || "not selected"}`}
              accessibilityHint="Double tap to open the condition picker."
            >
              <Text style={[styles.choiceValue, !condition && styles.choicePlaceholder]}>{condition || "Choose a condition"}</Text>
              <Text style={styles.choiceArrow}>›</Text>
            </AccessiblePressable>
            <Text style={styles.label}>Original price</Text>
            <TextInput
              style={styles.field}
              value={was}
              onChangeText={(v) => setWas(v.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="Optional"
              placeholderTextColor={ph}
              accessibilityLabel="Original price, optional"
            />

            <View>
              <Text style={styles.label}>Where it sells</Text>
              <Text style={styles.sellsLede}>Choose which countries can see this listing.</Text>
              <AccessiblePressable
                onPress={() => router.push({ pathname: "/sell-countries", params: { origin, selected: shipsTo === "all" ? "all" : Array.isArray(shipsTo) ? shipsTo.join(",") : origin } })}
                style={({ pressed }) => [styles.choiceRow, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel={`Choose countries. Currently ${shipsToLabel(origin, shipsTo)}.`}
                accessibilityHint="Double tap to choose the countries where this listing can be seen."
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.choiceValue}>{shipsToLabel(origin, shipsTo)}</Text>
                  <Text style={styles.choiceSub}>Choose countries</Text>
                </View>
                <Text style={styles.choiceArrow}>›</Text>
              </AccessiblePressable>
            </View>

            <View style={styles.lookHead}>
              <Text style={styles.label}>Shop look</Text>
            </View>
            <Text style={styles.lookLede}>
              How buyers see this listing. Looks marked “Requires Uvel+” are available with a Plus plan.
            </Text>
            <View style={styles.lookGrid}>
              {SHOP_LOOKS.map((look) => {
                const on = shopLook === look.id;
                const locked = look.plus && !isPlus;
                return (
                  <AccessiblePressable                    key={look.id}
                    onPress={() => {
                      if (locked) {
                        router.push("/plus");
                        return;
                      }
                      setShopLook(look.id);
                      if (existing) updatePiece(existing.id, { shopLook: look.id });
                    }}
                    style={({ pressed }) => [styles.lookCard, on && styles.lookCardOn, locked && { opacity: 0.55 }, pressed && { opacity: 0.92 }]}
                    accessibilityRole="radio"
                    accessibilityLabel={`${look.name}${locked ? ", requires Uvel Plus" : ""}`}
                    accessibilityHint={locked ? "Double tap to view Uvel Plus." : "Double tap to choose this Shop the look style."}
                    accessibilityState={{ selected: on, disabled: locked }}
                  >
                    <View style={[styles.lookSwatch, { backgroundColor: look.page }]}>
                      <View style={[styles.lookDot, { backgroundColor: look.accent }]} />
                    </View>
                    <Text style={styles.lookName}>{look.name}</Text>
                    <Text style={styles.lookLine} numberOfLines={1}>
                      {locked ? "Requires Uvel+" : look.line}
                    </Text>
                  </AccessiblePressable>
                );
              })}
            </View>
            {existing ? (
              <AccessiblePressable                onPress={() =>
                  router.push({
                    pathname: "/closet/[id]",
                    params: { id: existing.id, v: "buy" },
                  })
                }
                style={styles.preview}
              >
                <Text style={styles.previewTxt}>Preview as a buyer →</Text>
              </AccessiblePressable>
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.foot, { paddingBottom: insets.bottom + (embedded ? 96 : 12) }]}>
          <AccessiblePressable            onPress={() => void publish()}
            disabled={!canList}
            style={({ pressed }) => [styles.cta, !canList && styles.ctaOff, pressed && { opacity: 0.92 }]}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            accessibilityState={{ disabled: !canList, busy: gate.phase === "review" }}
          >
            <Text style={[styles.ctaTxt, !canList && styles.ctaTxtOff]}>{ctaLabel}</Text>
          </AccessiblePressable>
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
              <AccessiblePressable                onPress={() => setGate({ phase: "idle" })}
                style={({ pressed }) => [styles.gateCta, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel="Fix listing"
              >
                <Text style={styles.ctaTxt}>Fix listing</Text>
              </AccessiblePressable>
            </>
          ) : null}
          {gate.phase === "pass" ? (
            <>
              <View style={styles.green} />
              <Text style={styles.gateH}>On the {getMarket(origin).name} floor.</Text>
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
    backPlaceholder: { width: 40, height: 40 },
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
    scrollContent: { flexGrow: 1 },
    photosLabel: { marginTop: 16, marginLeft: 20 },
    photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20, paddingTop: 10 },
    photoTile: { width: Math.round((W - 50) / 2), height: Math.round(((W - 50) / 2) * 1.25), borderRadius: 14, overflow: "hidden", backgroundColor: colors.surface, position: "relative" },
    photoImage: { width: "100%", height: "100%" },
    photoAdd: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.subtle + "88", alignItems: "center", justifyContent: "center" },
    photoAddIcon: { color: colors.bone, fontSize: 34, lineHeight: 38 },
    photoAddTxt: { color: colors.bone, fontSize: 12, fontWeight: "600", marginTop: 4 },
    photoCount: { color: colors.subtle, fontSize: 11, marginTop: 4 },
    mainPhotoPill: { position: "absolute", left: 10, bottom: 10, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: "rgba(11,10,8,0.76)", alignItems: "center", justifyContent: "center" },
    mainPhotoTxt: { color: colors.bone, fontSize: 12, fontWeight: "600" },
    photoCheck: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(214,226,122,0.52)", alignItems: "center", justifyContent: "center" },
    focused: { borderWidth: 2, borderColor: colors.success },
    photoX: { position: "absolute", top: 4, right: 4, minWidth: 44, minHeight: 44, borderRadius: 22, backgroundColor: colors.bone, alignItems: "center", justifyContent: "center" },
    photoXTxt: { color: colors.ink, fontSize: 19, lineHeight: 21, fontWeight: "700", marginTop: -1 },
    unverifiedDot: {
      position: "absolute",
      right: 4,
      top: 4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.subtle,
    },
    analysisNotice: {
      margin: 16,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.subtle + "44",
      gap: 6,
    },
    analysisTitle: { color: colors.bone, fontWeight: "700" },
    analysisCopy: { color: colors.muted, lineHeight: 20 },
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
    priceRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10 },
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
    sellsLede: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 10 },
    field: {
      height: 48,
      borderRadius: 14,
      paddingHorizontal: 14,
      color: colors.bone,
      backgroundColor: colors.surface,
      fontSize: 16,
    },
    choiceRow: {
      minHeight: 54,
      borderRadius: 14,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    choiceValue: { color: colors.bone, fontSize: 16 },
    choiceSub: { color: colors.muted, fontSize: 13, marginTop: 4 },
    choicePlaceholder: { color: colors.subtle },
    choiceArrow: { color: colors.subtle, fontSize: 28, lineHeight: 30, marginTop: -3 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      minHeight: 44,
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
    lookHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 },
    plusTag: { color: "#D6E27A", fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
    lookLede: { color: colors.muted, fontSize: 13, lineHeight: 18, marginBottom: 12 },
    lookGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    lookCard: {
      width: "48%",
      flexGrow: 1,
      borderRadius: 16,
      padding: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: "transparent",
    },
    lookCardOn: { borderColor: "#D6E27A" },
    lookSwatch: { height: 52, borderRadius: 12, justifyContent: "flex-end", alignItems: "flex-end", padding: 8 },
    lookDot: { width: 14, height: 14, borderRadius: 7 },
    lookName: { color: colors.bone, fontWeight: "700", fontSize: 14, marginTop: 8 },
    lookLine: { color: colors.muted, fontSize: 12, marginTop: 2 },
    preview: { marginTop: 14, marginBottom: 8 },
    previewTxt: { color: colors.bone, fontWeight: "600", fontSize: 14 },
    foot: {
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
