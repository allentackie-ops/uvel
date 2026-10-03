import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  ActivityIndicator,
  FlatList,
  Image as NativeImage,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "./ListingCard";
import { CATEGORIES } from "../lib/catalog";
import type { ClosetPiece } from "../lib/wardrobe";
import type { MirrorJobSource, MirrorJobStatus } from "../lib/mirrorJobs";
import { useColors, type Colors } from "../lib/theme";

export type MirrorStudioViewProps = {
  standalone: boolean;
  personUri: string | null;
  resultUri: string | null;
  garmentUri: string | null;
  garmentName: string;
  error: string;
  busy: boolean;
  jobStatus: MirrorJobStatus | null;
  sourceKind: MirrorJobSource | null;
  pieceId: string;
  pieces: ClosetPiece[];
  marketplaceUnavailable: boolean;
  retryingMarketplace: boolean;
  link: string;
  linkBusy: boolean;
  showLink: boolean;
  onBack: () => void;
  onAddPerson: () => void;
  onChangePerson: () => void;
  onPickPiece: (piece: ClosetPiece) => void;
  onPickPhoto: () => void;
  onClearGarment: () => void;
  onChangeLink: (value: string) => void;
  onOpenLink: () => void;
  onCloseLink: () => void;
  onUseLink: () => void;
  onTryOn: () => void;
  onTryAnother: () => void;
  onRate: (rating: number) => void;
  onAddToCart: () => boolean;
  onShare: () => void;
  onRetryMarketplace: () => void;
};

export function MirrorStudioView({
  standalone,
  personUri,
  resultUri,
  garmentUri,
  garmentName,
  error,
  busy,
  jobStatus,
  sourceKind,
  pieceId,
  pieces,
  marketplaceUnavailable,
  retryingMarketplace,
  link,
  linkBusy,
  showLink,
  onBack,
  onAddPerson,
  onChangePerson,
  onPickPiece,
  onPickPhoto,
  onClearGarment,
  onChangeLink,
  onOpenLink,
  onCloseLink,
  onUseLink,
  onTryOn,
  onTryAnother,
  onRate,
  onAddToCart,
  onShare,
  onRetryMarketplace,
}: MirrorStudioViewProps) {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [uvelPickerOpen, setUvelPickerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [drawerHeight, setDrawerHeight] = useState(0);
  const [rating, setRating] = useState(0);
  const [toast, setToast] = useState("");
  const [buyPromptDismissed, setBuyPromptDismissed] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayUri = resultUri || personUri;
  const isPending = busy || jobStatus === "queued" || jobStatus === "processing";
  const isUvelResult = Boolean(resultUri && sourceKind === "uvel" && pieceId);

  const zoom = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startZoom = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const viewportWidth = useSharedValue(screenWidth);
  const viewportHeight = useSharedValue(screenHeight);
  const renderedWidth = useSharedValue(screenWidth);
  const renderedHeight = useSharedValue(screenHeight);

  const imageTransform = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: zoom.value }],
  }));

  const panGesture = useMemo(() => Gesture.Pan()
    .maxPointers(1)
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const maxX = Math.max(0, (renderedWidth.value * zoom.value - viewportWidth.value) / 2);
      const maxY = Math.max(0, (renderedHeight.value * zoom.value - viewportHeight.value) / 2);
      translateX.value = Math.max(-maxX, Math.min(maxX, startX.value + event.translationX));
      translateY.value = Math.max(-maxY, Math.min(maxY, startY.value + event.translationY));
    }), [renderedHeight, renderedWidth, startX, startY, translateX, translateY, viewportHeight, viewportWidth, zoom]);

  const pinchGesture = useMemo(() => Gesture.Pinch()
    .onBegin((event) => {
      startZoom.value = zoom.value;
      startX.value = translateX.value;
      startY.value = translateY.value;
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    })
    .onUpdate((event) => {
      const nextZoom = Math.max(1, Math.min(4, startZoom.value * event.scale));
      const localX = (focalX.value - viewportWidth.value / 2 - startX.value) / startZoom.value;
      const localY = (focalY.value - viewportHeight.value / 2 - startY.value) / startZoom.value;
      const maxX = Math.max(0, (renderedWidth.value * nextZoom - viewportWidth.value) / 2);
      const maxY = Math.max(0, (renderedHeight.value * nextZoom - viewportHeight.value) / 2);
      translateX.value = Math.max(-maxX, Math.min(maxX, focalX.value - viewportWidth.value / 2 - localX * nextZoom));
      translateY.value = Math.max(-maxY, Math.min(maxY, focalY.value - viewportHeight.value / 2 - localY * nextZoom));
      zoom.value = nextZoom;
    }), [focalX, focalY, renderedHeight, renderedWidth, startX, startY, startZoom, translateX, translateY, viewportHeight, viewportWidth, zoom]);

  const imageGesture = useMemo(() => Gesture.Simultaneous(panGesture, pinchGesture), [panGesture, pinchGesture]);

  const visiblePieces = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pieces.filter((piece) => {
      if (category !== "All" && piece.category !== category) return false;
      if (!needle) return true;
      return piece.name.toLowerCase().includes(needle)
        || (piece.brand || "").toLowerCase().includes(needle)
        || (piece.color || "").toLowerCase().includes(needle);
    });
  }, [category, pieces, query]);

  useEffect(() => {
    viewportWidth.value = screenWidth;
    viewportHeight.value = screenHeight;
    if (!displayUri) {
      renderedWidth.value = screenWidth;
      renderedHeight.value = screenHeight;
      return;
    }
    zoom.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    let active = true;
    NativeImage.getSize(displayUri, (width, height) => {
      if (!active || width <= 0 || height <= 0) return;
      const scale = Math.max(screenWidth / width, screenHeight / height);
      renderedWidth.value = width * scale;
      renderedHeight.value = height * scale;
    }, () => {
      if (active) {
        renderedWidth.value = screenWidth;
        renderedHeight.value = screenHeight;
      }
    });
    return () => { active = false; };
  }, [displayUri, renderedHeight, renderedWidth, screenHeight, screenWidth, translateX, translateY, viewportHeight, viewportWidth, zoom]);

  useEffect(() => {
    setRating(0);
    setBuyPromptDismissed(false);
  }, [resultUri]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }

  function runPrimaryAction() {
    if (isPending) return;
    if (!personUri) {
      onAddPerson();
      return;
    }
    if (!garmentUri) {
      setUvelPickerOpen(true);
      return;
    }
    onTryOn();
  }

  function choosePiece(piece: ClosetPiece) {
    onPickPiece(piece);
    setUvelPickerOpen(false);
    setQuery("");
    setCategory("All");
  }

  function chooseRating(value: number) {
    setRating(value);
    onRate(value);
    showToast("Thank you for your feedback");
  }

  function addToBag() {
    showToast(onAddToCart() ? "Added to your bag" : "This piece is already in your bag");
  }

  const primaryLabel = busy
    ? "Starting your look…"
    : isPending
      ? "Creating your look…"
      : !personUri
        ? "Add your photo"
        : !garmentUri
          ? "Choose a piece"
          : "Try this look";

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      {displayUri ? (
        <GestureDetector gesture={imageGesture}>
          <Animated.View style={[StyleSheet.absoluteFill, imageTransform]}>
            <Image
              cachePolicy="memory-disk"
              source={{ uri: displayUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={160}
            />
          </Animated.View>
        </GestureDetector>
      ) : (
        <View style={styles.emptyCanvas}>
          <View style={styles.emptyIcon}>
            <Ionicons name="person-outline" size={36} color={colors.success} />
          </View>
          <Text style={styles.emptyTitle}>Your Mirror studio</Text>
          <Text style={styles.emptyCopy}>Add a full-length photo to preview a look on you.</Text>
          <Pressable onPress={onAddPerson} style={styles.emptyButton} accessibilityRole="button">
            <Ionicons name="camera-outline" size={18} color={colors.successInk} />
            <Text style={styles.emptyButtonText}>Add your photo</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {standalone ? (
          <Pressable onPress={onBack} style={styles.topButton} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={21} color={colors.bone} />
          </Pressable>
        ) : <View style={styles.topButtonGhost} />}
        <Text style={styles.topTitle}>Mirror</Text>
        <Pressable onPress={() => setHelpOpen(true)} style={styles.helpButton} accessibilityRole="button" accessibilityLabel="About Mirror" accessibilityHint="Learn how to create and save a Mirror look.">
          <Ionicons name="help-circle-outline" size={27} color={colors.bone} />
        </Pressable>
      </View>

      {personUri && !resultUri && !isPending ? (
        <View style={[styles.photoActions, { bottom: drawerHeight + 12 }]}>
          <Pressable onPress={onChangePerson} style={styles.photoAction} accessibilityRole="button" accessibilityLabel="Change your photo">
            <Ionicons name="image-outline" size={15} color={colors.bone} />
            <Text style={styles.photoActionText}>Change photo</Text>
          </Pressable>
        </View>
      ) : null}

      <View
        style={[styles.drawer, { paddingBottom: insets.bottom + 12, maxHeight: screenHeight * 0.68 }]}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.height;
          if (Math.abs(next - drawerHeight) > 1) setDrawerHeight(next);
        }}
      >
        <ScrollView
          style={{ maxHeight: screenHeight * 0.68 }}
          contentContainerStyle={styles.drawerContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.handle} />
          <View style={styles.drawerHeading}>
            <View style={styles.lookCopy}>
              <Text style={styles.eyebrow}>YOUR LOOK</Text>
              <Text style={styles.lookTitle} numberOfLines={1}>
                {resultUri ? garmentName : garmentUri ? garmentName : "Choose a piece to try"}
              </Text>
            </View>
            {garmentUri && !resultUri ? (
              <View style={styles.selectedWrap}>
                <Image source={{ uri: garmentUri }} style={styles.selectedImage} contentFit="cover" />
                <Pressable onPress={onClearGarment} style={styles.removeGarment} accessibilityRole="button" accessibilityLabel="Remove selected clothing">
                  <Ionicons name="close" size={13} color={colors.bone} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.selectedPlaceholder}><Ionicons name="shirt-outline" size={22} color={colors.success} /></View>
            )}
          </View>

          {resultUri ? (
            <View style={styles.resultPanel}>
              {isUvelResult ? (
                <>
                  {!buyPromptDismissed ? (
                    <>
                      <Text style={styles.resultPrompt}>Want to buy this piece?</Text>
                      <View style={styles.buyRow}>
                        <Pressable onPress={() => setBuyPromptDismissed(true)} style={styles.notNowButton} accessibilityRole="button">
                          <Text style={styles.notNowText}>Not now</Text>
                        </Pressable>
                        <Pressable onPress={addToBag} style={styles.addToBagButton} accessibilityRole="button">
                          <Ionicons name="bag-add-outline" size={17} color={colors.successInk} />
                          <Text style={styles.addToBagText}>Add to cart</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.resultSubtle}>Your look is ready whenever you are.</Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.resultPrompt}>Do you like this look?</Text>
                  <View style={styles.ratingRow} accessibilityRole="radiogroup" accessibilityLabel="Rate your Mirror look">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => chooseRating(value)}
                        style={styles.starButton}
                        accessibilityRole="radio"
                        accessibilityLabel={`${value} star${value === 1 ? "" : "s"}`}
                        accessibilityState={{ selected: rating === value }}
                      >
                        <Ionicons name={value <= rating ? "star" : "star-outline"} size={30} color={colors.success} />
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              <View style={styles.resultActions}>
                <Pressable onPress={onTryAnother} style={styles.tryAnotherButton} accessibilityRole="button">
                  <Ionicons name="refresh-outline" size={17} color={colors.bone} />
                  <Text style={styles.tryAnotherText}>Try another look</Text>
                </Pressable>
                <Pressable onPress={onShare} style={styles.shareButton} accessibilityRole="button" accessibilityLabel="Share your look">
                  <Ionicons name="share-outline" size={17} color={colors.bone} />
                </Pressable>
              </View>
            </View>
          ) : isPending ? (
            <View style={styles.pendingPanel}>
              <ActivityIndicator size="small" color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingTitle}>{busy ? "Starting your look…" : "Creating your look…"}</Text>
                {error ? <Text style={styles.errorText}>{error}</Text> : <Text style={styles.pendingCopy}>You can leave Mirror. We’ll let you know when it’s ready.</Text>}
              </View>
            </View>
          ) : (
            <>
              <View style={styles.sourceRow}>
                <Pressable onPress={() => setUvelPickerOpen(true)} style={styles.sourceButton} accessibilityRole="button" accessibilityLabel="Choose a piece from Uvel">
                  <Ionicons name="pricetag-outline" size={19} color={colors.success} />
                  <Text style={styles.sourceLabel}>From Uvel</Text>
                </Pressable>
                <Pressable onPress={onPickPhoto} style={styles.sourceButton} accessibilityRole="button" accessibilityLabel="Choose and crop a clothing photo">
                  <Ionicons name="images-outline" size={19} color={colors.success} />
                  <Text style={styles.sourceLabel}>Photos</Text>
                </Pressable>
                <Pressable onPress={onOpenLink} style={styles.sourceButton} accessibilityRole="button" accessibilityLabel="Paste a clothing item link">
                  <Ionicons name="link-outline" size={19} color={colors.success} />
                  <Text style={styles.sourceLabel}>Paste link</Text>
                </Pressable>
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable
                onPress={runPrimaryAction}
                disabled={busy}
                style={[styles.primaryButton, busy && styles.primaryButtonBusy]}
                accessibilityRole="button"
                accessibilityLabel={primaryLabel}
              >
                <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
                {!busy ? <Ionicons name="arrow-forward" size={18} color={colors.successInk} /> : <ActivityIndicator size="small" color={colors.successInk} />}
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>

      {toast ? (
        <View style={[styles.toastWrap, { top: insets.top + 58 }]} pointerEvents="none">
          <View style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      ) : null}

      <Modal visible={helpOpen} transparent animationType="fade" onRequestClose={() => setHelpOpen(false)}>
        <View style={styles.helpRoot}>
          <Pressable style={styles.helpBackdrop} onPress={() => setHelpOpen(false)} accessibilityRole="button" accessibilityLabel="Close Mirror help" />
          <View style={[styles.helpCard, { marginTop: insets.top + 36, marginBottom: insets.bottom + 20 }]}>
            <View style={styles.helpIcon}><Ionicons name="scan-outline" size={22} color={colors.success} /></View>
            <Text style={styles.helpTitle}>How Mirror works</Text>
            <Text style={styles.helpCopy}>Add a full-length photo, choose a Uvel piece, a clothing photo, or a product link, then tap “Try this look.” Pinch to zoom your photo. You can leave while your look is being created.</Text>
            <Text style={styles.helpPrivacy}>To create the preview, your photo and the selected clothing image are securely sent to OpenAI. Temporary processing uploads are deleted after the look is created. Your result stays private to your account.</Text>
            <Pressable onPress={() => setHelpOpen(false)} style={styles.helpDone} accessibilityRole="button">
              <Text style={styles.helpDoneText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={uvelPickerOpen} transparent animationType="slide" onRequestClose={() => setUvelPickerOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setUvelPickerOpen(false)} accessibilityRole="button" accessibilityLabel="Close Uvel picker" />
          <View style={[styles.pickerSheet, { height: Math.min(screenHeight * 0.84, 760), paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Choose a piece</Text>
                <Text style={styles.modalSubTitle}>Pick something from Uvel</Text>
              </View>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={colors.subtle} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search pieces"
                placeholderTextColor={colors.subtle}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Search Uvel pieces"
              />
              {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.subtle} /></Pressable> : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {CATEGORIES.map((value) => {
                const active = value === category;
                return (
                  <Pressable key={value} onPress={() => setCategory(value)} style={[styles.categoryChip, active && styles.categoryChipActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{value}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {pieces.length ? (
              <FlatList
                style={{ flex: 1 }}
                data={visiblePieces}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.pickerRow}
                contentContainerStyle={styles.pickerList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <View style={styles.pickerCell}>
                    <ListingCard piece={item} framed onOpen={() => choosePiece(item)} />
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyListText}>No pieces match that search.</Text>}
              />
            ) : (
              <View style={styles.noPieces}>
                <Ionicons name="shirt-outline" size={28} color={colors.success} />
                <Text style={styles.emptyListText}>No Uvel pieces are available right now.</Text>
                {marketplaceUnavailable ? (
                  <Pressable onPress={onRetryMarketplace} style={styles.retryButton} disabled={retryingMarketplace}>
                    <Text style={styles.retryText}>{retryingMarketplace ? "Reconnecting…" : "Retry connection"}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showLink} transparent animationType="slide" onRequestClose={onCloseLink}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.backdrop} onPress={onCloseLink} accessibilityRole="button" accessibilityLabel="Close link entry" />
          <View style={[styles.linkSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Paste a link</Text>
                <Text style={styles.modalSubTitle}>Use a clothing image or product page</Text>
              </View>
            </View>
            <View style={styles.linkInputRow}>
              <TextInput
                value={link}
                onChangeText={onChangeLink}
                placeholder="Paste the item URL"
                placeholderTextColor={colors.subtle}
                style={styles.linkInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={onUseLink}
                accessibilityLabel="Clothing item URL"
              />
              <Pressable onPress={onUseLink} disabled={linkBusy || !link.trim()} style={[styles.findLinkButton, (linkBusy || !link.trim()) && styles.findLinkButtonDisabled]}>
                {linkBusy ? <ActivityIndicator size="small" color={colors.successInk} /> : <Ionicons name="arrow-forward" size={18} color={colors.successInk} />}
              </Pressable>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    emptyCanvas: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingBottom: 240 },
    emptyIcon: { width: 76, height: 76, borderRadius: 24, borderWidth: 1, borderColor: `${colors.success}77`, backgroundColor: `${colors.success}12`, alignItems: "center", justifyContent: "center", marginBottom: 18 },
    emptyTitle: { color: colors.bone, fontSize: 25, fontWeight: "800", textAlign: "center" },
    emptyCopy: { color: `${colors.bone}A3`, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8, maxWidth: 270 },
    emptyButton: { height: 46, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 23, backgroundColor: colors.success, marginTop: 20 },
    emptyButtonText: { color: colors.successInk, fontWeight: "800", fontSize: 14 },
    topBar: { position: "absolute", zIndex: 3, top: 0, left: 0, right: 0, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    topButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.18)" },
    topButtonGhost: { width: 42, height: 42 },
    helpButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.12)" },
    topTitle: { color: colors.bone, fontSize: 18, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.55)", textShadowRadius: 8 },
    photoActions: { position: "absolute", zIndex: 3, left: 18 },
    photoAction: { height: 38, paddingHorizontal: 13, borderRadius: 19, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(11,10,8,0.78)", borderWidth: 1, borderColor: `${colors.bone}40` },
    photoActionText: { color: colors.bone, fontSize: 12, fontWeight: "700" },
    drawer: { position: "absolute", zIndex: 4, left: 0, right: 0, bottom: 0, paddingTop: 8, paddingHorizontal: 18, backgroundColor: colors.ink, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: `${colors.bone}20`, overflow: "hidden" },
    drawerContent: { paddingBottom: 2 },
    handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: `${colors.bone}45`, alignSelf: "center", marginBottom: 14 },
    drawerHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 },
    lookCopy: { flex: 1 },
    eyebrow: { color: colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
    lookTitle: { color: colors.bone, fontSize: 19, fontWeight: "800", marginTop: 4 },
    selectedWrap: { position: "relative" },
    selectedImage: { width: 48, height: 58, borderRadius: 12, backgroundColor: colors.surface },
    removeGarment: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}3A`, alignItems: "center", justifyContent: "center" },
    selectedPlaceholder: { width: 48, height: 58, borderRadius: 12, borderWidth: 1, borderColor: `${colors.success}4D`, backgroundColor: `${colors.success}10`, alignItems: "center", justifyContent: "center" },
    sourceRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    sourceButton: { flex: 1, minHeight: 60, paddingHorizontal: 5, borderRadius: 16, borderWidth: 1, borderColor: `${colors.bone}22`, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: 5 },
    sourceLabel: { color: colors.bone, fontSize: 11, fontWeight: "700" },
    errorText: { color: colors.danger, fontSize: 12, lineHeight: 17, marginBottom: 8 },
    primaryButton: { height: 52, borderRadius: 26, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    primaryButtonBusy: { opacity: 0.72 },
    primaryButtonText: { color: colors.successInk, fontSize: 15, fontWeight: "800" },
    resultPanel: { paddingHorizontal: 2, paddingTop: 1 },
    resultPrompt: { color: colors.bone, fontSize: 17, fontWeight: "800", marginBottom: 12 },
    resultSubtle: { color: colors.muted, fontSize: 13, marginBottom: 8 },
    buyRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
    notNowButton: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1, borderColor: `${colors.bone}35`, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    notNowText: { color: colors.bone, fontSize: 14, fontWeight: "800" },
    addToBagButton: { flex: 1.35, height: 48, borderRadius: 24, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    addToBagText: { color: colors.successInk, fontSize: 14, fontWeight: "800" },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 11 },
    starButton: { minWidth: 34, minHeight: 38, alignItems: "center", justifyContent: "center" },
    resultActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
    tryAnotherButton: { flex: 1, height: 45, borderRadius: 23, borderWidth: 1, borderColor: `${colors.bone}33`, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    tryAnotherText: { color: colors.bone, fontSize: 13, fontWeight: "800" },
    shareButton: { width: 45, height: 45, borderRadius: 23, borderWidth: 1, borderColor: `${colors.bone}33`, alignItems: "center", justifyContent: "center" },
    pendingPanel: { flexDirection: "row", gap: 12, alignItems: "center", padding: 14, borderRadius: 16, backgroundColor: colors.surface, marginBottom: 4 },
    pendingTitle: { color: colors.bone, fontSize: 14, fontWeight: "800" },
    pendingCopy: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
    toastWrap: { position: "absolute", zIndex: 8, left: 20, right: 20, alignItems: "center" },
    toast: { maxWidth: "100%", minHeight: 46, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.success}55`, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    toastText: { color: colors.bone, fontSize: 13, fontWeight: "700" },
    modalRoot: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.58)" },
    pickerSheet: { backgroundColor: colors.ink, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 22, paddingHorizontal: 16, borderWidth: 1, borderColor: `${colors.bone}20` },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    modalTitle: { color: colors.bone, fontSize: 21, fontWeight: "800" },
    modalSubTitle: { color: `${colors.bone}9C`, fontSize: 13, marginTop: 3 },
    searchBox: { height: 46, borderRadius: 16, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, marginBottom: 12 },
    searchInput: { flex: 1, height: 46, color: colors.bone, fontSize: 15, paddingVertical: 0 },
    categoryRow: { gap: 8, paddingBottom: 13 },
    categoryChip: { height: 34, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: `${colors.bone}2B`, alignItems: "center", justifyContent: "center" },
    categoryChipActive: { backgroundColor: colors.success, borderColor: colors.success },
    categoryText: { color: colors.bone, fontSize: 12, fontWeight: "700" },
    categoryTextActive: { color: colors.successInk },
    pickerList: { paddingBottom: 18 },
    pickerRow: { gap: 10 },
    pickerCell: { flex: 1, marginBottom: 10 },
    emptyListText: { color: `${colors.bone}91`, textAlign: "center", fontSize: 14, lineHeight: 20, padding: 20 },
    noPieces: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 50, gap: 12 },
    retryButton: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.surface },
    retryText: { color: colors.success, fontSize: 13, fontWeight: "800" },
    linkSheet: { backgroundColor: colors.ink, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 22, paddingHorizontal: 18, borderWidth: 1, borderColor: `${colors.bone}20` },
    linkInputRow: { flexDirection: "row", alignItems: "center", minHeight: 52, backgroundColor: colors.surface, borderRadius: 16, paddingLeft: 14, paddingRight: 6, marginTop: 4 },
    linkInput: { flex: 1, minHeight: 52, color: colors.bone, fontSize: 15, paddingVertical: 0 },
    findLinkButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    findLinkButtonDisabled: { opacity: 0.45 },
    helpRoot: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
    helpBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.64)" },
    helpCard: { width: "100%", maxWidth: 440, padding: 22, borderRadius: 26, backgroundColor: colors.ink, borderWidth: 1, borderColor: `${colors.bone}24` },
    helpIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: `${colors.success}14`, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    helpTitle: { color: colors.bone, fontSize: 22, fontWeight: "800" },
    helpCopy: { color: `${colors.bone}C4`, fontSize: 14, lineHeight: 21, marginTop: 9 },
    helpPrivacy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 12 },
    helpDone: { height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.success, marginTop: 20 },
    helpDoneText: { color: colors.successInk, fontSize: 14, fontWeight: "800" },
  });
}
