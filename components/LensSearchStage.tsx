import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image as RNImage, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard, ListingCardSkeleton } from "./ListingCard";
import { LensHeroClip } from "./LensHeroClip";
import { Sheet } from "./Sheet";
import { OrbitLoader } from "./OrbitLoader";
import type { ClosetPiece } from "../lib/wardrobe";
import type { NormalizedBox } from "../lib/lookMatch";
import { MARKET_RED, useColors, useResolvedAppearance, type Colors } from "../lib/theme";

const MIN_CROP_SIZE = 56;
const HANDLE_HIT_SIZE = 42;
type Mode = "move" | "tl" | "tr" | "bl" | "br";
type SearchStatus = "idle" | "detecting" | "searching" | "ready" | "error";
type FilterKind = "sort" | "size" | "color" | "filter";

type Props = {
  uri: string | null;
  box: NormalizedBox | null;
  detectionDone: boolean;
  status: SearchStatus;
  detectedItem: string;
  items: ClosetPiece[];
  onBack: () => void;
  onChangePhoto: () => void;
  onTakePhoto: () => void;
  onPickPhotos: () => void;
  onPickFiles: () => void;
  onCropChange: (uri: string) => void;
};

export function LensSearchStage({ uri, box, detectionDone, status, detectedItem, items, onBack, onChangePhoto, onTakePhoto, onPickPhotos, onPickFiles, onCropChange }: Props) {
  const colors = useColors();
  const appearance = useResolvedAppearance();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const heroHeight = Math.max(220, Math.min(screenWidth * 1.08, screenHeight * 0.42));
  const frameHeight = uri ? Math.min(500, screenHeight * 0.46) : Math.max(190, Math.min(screenWidth * 1.24, screenHeight - insets.top - insets.bottom - 390));
  const frame = useMemo(() => ({ width: uri ? screenWidth - 28 : Math.min(screenWidth - 28, frameHeight * 0.82), height: frameHeight }), [frameHeight, screenWidth, uri]);
  const resultWidth = Math.max(136, (screenWidth - 45) / 2);
  const [openFilter, setOpenFilter] = useState<FilterKind | null>(null);
  const [sortBy, setSortBy] = useState("Relevance");
  const [sizeFilter, setSizeFilter] = useState("Any size");
  const [colorFilter, setColorFilter] = useState("Any color");
  const [availabilityFilter, setAvailabilityFilter] = useState("All pieces");
  const filteredItems = useMemo(() => {
    const next = items.filter((piece) => {
      const sizes = [piece.size, ...(piece.sizes || [])].filter(Boolean).map((value) => String(value).toLowerCase());
      const color = String(piece.color || "").toLowerCase();
      const sizeMatch = sizeFilter === "Any size" || sizes.includes(sizeFilter.toLowerCase());
      const colorMatch = colorFilter === "Any color" || color.includes(colorFilter.toLowerCase());
      const availabilityMatch = availabilityFilter === "All pieces" || (availabilityFilter === "In stock" ? piece.stockQuantity !== 0 : Date.now() - (piece.createdAt || 0) < 14 * 24 * 60 * 60 * 1000);
      return sizeMatch && colorMatch && availabilityMatch;
    });
    return next.sort((a, b) => sortBy === "Price low" ? a.listPriceCents - b.listPriceCents : sortBy === "Price high" ? b.listPriceCents - a.listPriceCents : sortBy === "Newest" ? b.createdAt - a.createdAt : 0);
  }, [availabilityFilter, colorFilter, items, sizeFilter, sortBy]);
  const resultRows = useMemo(() => Array.from({ length: Math.ceil(filteredItems.length / 2) }, (_, index) => filteredItems.slice(index * 2, index * 2 + 2)), [filteredItems]);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const imageBox = useMemo(() => {
    if (!natural) return { left: 0, top: 0, width: frame.width, height: frame.height };
    const scale = Math.min(frame.width / natural.w, frame.height / natural.h);
    const imageWidth = natural.w * scale;
    const imageHeight = natural.h * scale;
    return { left: (frame.width - imageWidth) / 2, top: (frame.height - imageHeight) / 2, width: imageWidth, height: imageHeight };
  }, [frame.height, frame.width, natural]);

  useEffect(() => {
    if (!uri) {
      setNatural(null);
      return;
    }
    RNImage.getSize(uri, (w, h) => setNatural({ w, h }), () => setNatural({ w: 1200, h: 1500 }));
  }, [uri]);

  const left = useSharedValue(0);
  const top = useSharedValue(0);
  const right = useSharedValue(0);
  const bottom = useSharedValue(0);
  const startLeft = useSharedValue(0);
  const startTop = useSharedValue(0);
  const startRight = useSharedValue(0);
  const startBottom = useSharedValue(0);
  const mode = useSharedValue<Mode>("move");
  const changed = useSharedValue(0);
  const sheetHeight = Math.max(420, screenHeight - insets.top - insets.bottom - 70);
  const photoBottom = insets.top + 60 + frameHeight + 16;
  const collapsedVisibleHeight = Math.max(250, screenHeight - photoBottom - insets.bottom + 56);
  const sheetCollapsed = Math.max(0, sheetHeight - collapsedVisibleHeight);
  const sheetY = useSharedValue(sheetCollapsed);
  const sheetStartY = useSharedValue(sheetCollapsed);
  useEffect(() => {
    sheetY.value = withSpring(sheetCollapsed, { damping: 28, stiffness: 240 });
  }, [sheetCollapsed, sheetY]);
  const sheetAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
  const sheetPan = Gesture.Pan().onStart(() => {
    sheetStartY.value = sheetY.value;
  }).onUpdate((event) => {
    sheetY.value = Math.max(0, Math.min(sheetCollapsed, sheetStartY.value + event.translationY));
  }).onEnd((event) => {
    const shouldExpand = sheetY.value < sheetCollapsed / 2 || event.velocityY < -700;
    sheetY.value = withSpring(shouldExpand ? 0 : sheetCollapsed, { damping: 28, stiffness: 240 });
  });

  useEffect(() => {
    if (!uri || !natural) return;
    const initial = box ?? { left: 0.12, top: 0.12, right: 0.88, bottom: 0.88 };
    left.value = imageBox.left + imageBox.width * initial.left;
    top.value = imageBox.top + imageBox.height * initial.top;
    right.value = imageBox.left + imageBox.width * initial.right;
    bottom.value = imageBox.top + imageBox.height * initial.bottom;
  }, [box, bottom, imageBox, left, natural, right, top, uri]);

  const cropStyle = useAnimatedStyle(() => ({ left: left.value, top: top.value, width: right.value - left.value, height: bottom.value - top.value }));
  const topMaskStyle = useAnimatedStyle(() => ({ left: imageBox.left, top: imageBox.top, width: imageBox.width, height: Math.max(0, top.value - imageBox.top) }));
  const leftMaskStyle = useAnimatedStyle(() => ({ left: imageBox.left, top: top.value, width: Math.max(0, left.value - imageBox.left), height: bottom.value - top.value }));
  const rightMaskStyle = useAnimatedStyle(() => ({ left: right.value, top: top.value, width: Math.max(0, imageBox.left + imageBox.width - right.value), height: bottom.value - top.value }));
  const bottomMaskStyle = useAnimatedStyle(() => ({ left: imageBox.left, top: bottom.value, width: imageBox.width, height: Math.max(0, imageBox.top + imageBox.height - bottom.value) }));

  const cropImage = useCallback(async () => {
    if (!uri || !natural) return;
    const cropLeft = Math.max(imageBox.left, Math.min(imageBox.left + imageBox.width, left.value));
    const cropTop = Math.max(imageBox.top, Math.min(imageBox.top + imageBox.height, top.value));
    const cropRight = Math.max(cropLeft + 1, Math.min(imageBox.left + imageBox.width, right.value));
    const cropBottom = Math.max(cropTop + 1, Math.min(imageBox.top + imageBox.height, bottom.value));
    const originX = Math.round((cropLeft - imageBox.left) / imageBox.width * natural.w);
    const originY = Math.round((cropTop - imageBox.top) / imageBox.height * natural.h);
    const cropW = Math.max(1, Math.min(natural.w - originX, Math.round((cropRight - cropLeft) / imageBox.width * natural.w)));
    const cropH = Math.max(1, Math.min(natural.h - originY, Math.round((cropBottom - cropTop) / imageBox.height * natural.h)));
    try {
      const context = ImageManipulator.manipulate(uri);
      context.crop({ originX, originY, width: cropW, height: cropH });
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ compress: 0.78, format: SaveFormat.JPEG });
      onCropChange(saved.uri);
    } catch {
      onCropChange(uri);
    }
  }, [bottom, imageBox.height, imageBox.left, imageBox.top, imageBox.width, left, natural, onCropChange, right, top, uri]);

  const cropGesture = Gesture.Pan().onStart((event) => {
    startLeft.value = left.value;
    startTop.value = top.value;
    startRight.value = right.value;
    startBottom.value = bottom.value;
    changed.value = 0;
    const nearLeft = Math.abs(event.x - left.value) <= HANDLE_HIT_SIZE;
    const nearRight = Math.abs(event.x - right.value) <= HANDLE_HIT_SIZE;
    const nearTop = Math.abs(event.y - top.value) <= HANDLE_HIT_SIZE;
    const nearBottom = Math.abs(event.y - bottom.value) <= HANDLE_HIT_SIZE;
    mode.value = nearLeft && nearTop ? "tl" : nearRight && nearTop ? "tr" : nearLeft && nearBottom ? "bl" : nearRight && nearBottom ? "br" : "move";
  }).onUpdate((event) => {
    const dx = event.translationX;
    const dy = event.translationY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) changed.value = 1;
    if (mode.value === "move") {
      const cropWidth = startRight.value - startLeft.value;
      const cropHeight = startBottom.value - startTop.value;
      const nextLeft = Math.max(imageBox.left, Math.min(imageBox.left + imageBox.width - cropWidth, startLeft.value + dx));
      const nextTop = Math.max(imageBox.top, Math.min(imageBox.top + imageBox.height - cropHeight, startTop.value + dy));
      left.value = nextLeft;
      top.value = nextTop;
      right.value = nextLeft + cropWidth;
      bottom.value = nextTop + cropHeight;
      return;
    }
    const minX = imageBox.left;
    const maxX = imageBox.left + imageBox.width;
    const minY = imageBox.top;
    const maxY = imageBox.top + imageBox.height;
    if (mode.value.includes("l")) left.value = Math.max(minX, Math.min(startRight.value - MIN_CROP_SIZE, startLeft.value + dx));
    if (mode.value.includes("r")) right.value = Math.min(maxX, Math.max(startLeft.value + MIN_CROP_SIZE, startRight.value + dx));
    if (mode.value.includes("t")) top.value = Math.max(minY, Math.min(startBottom.value - MIN_CROP_SIZE, startTop.value + dy));
    if (mode.value.includes("b")) bottom.value = Math.min(maxY, Math.max(startTop.value + MIN_CROP_SIZE, startBottom.value + dy));
  }).onEnd(() => {
    if (changed.value) runOnJS(cropImage)();
  });

  const filterOptions = openFilter === "sort"
    ? ["Relevance", "Newest", "Price low", "Price high"]
    : openFilter === "size"
      ? ["Any size", "XS", "S", "M", "L", "XL"]
      : openFilter === "color"
        ? ["Any color", "Black", "White", "Green", "Blue", "Red"]
        : ["All pieces", "In stock", "New this week"];
  function chooseFilter(value: string) {
    if (openFilter === "sort") setSortBy(value);
    if (openFilter === "size") setSizeFilter(value);
    if (openFilter === "color") setColorFilter(value);
    if (openFilter === "filter") setAvailabilityFilter(value);
    setOpenFilter(null);
  }

  const statusText = status === "detecting"
    ? "Finding the clothing item…"
    : status === "searching"
      ? "Searching Uvel for similar pieces…"
      : status === "error"
        ? "Search could not finish. Adjust the frame to retry."
          : status === "ready"
          ? box ? detectedItem || `${items.length} ${items.length === 1 ? "match" : "matches"}` : "No garment detected — adjust the frame to search."
          : "Matches appear here automatically.";

  return (
    <View style={styles.page}>
      <StatusBar style={appearance === "dark" ? "light" : "dark"} />
      {!uri ? (
        <View style={[styles.hero, { height: heroHeight }]}>
          <LensHeroClip />
        </View>
      ) : null}
      <View style={[styles.header, !uri && styles.headerOverHero, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={onBack} style={styles.headerButton} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={26} color={colors.bone} />
        </Pressable>
        <Text style={styles.headerTitle}>Search with a photo</Text>
        <View style={styles.headerButton} />
      </View>

      {!uri ? (
        <View style={[styles.empty, { paddingBottom: 12 }]}>
          <Text style={styles.title}>Find it on Uvel.</Text>
          <View style={styles.sourceList}>
            <SourceButton icon="camera-outline" label="Take a photo" onPress={onTakePhoto} primary colors={colors} styles={styles} />
            <SourceButton icon="images-outline" label="Choose from Photos" onPress={onPickPhotos} colors={colors} styles={styles} />
            <SourceButton icon="folder-open-outline" label="Choose from Files" onPress={onPickFiles} colors={colors} styles={styles} />
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.photoArea, { height: frameHeight + 16 }]}>
            <View style={[styles.frame, { width: frame.width, height: frame.height }]}>
              <Image cachePolicy="memory-disk" source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
              {!natural ? <View style={styles.loadingImage}><OrbitLoader size={42} /></View> : null}
              {natural && detectionDone ? (
                <GestureDetector gesture={cropGesture}>
                  <View style={styles.gestureSurface}>
                    <Animated.View pointerEvents="none" style={[styles.outsideMask, topMaskStyle]} />
                    <Animated.View pointerEvents="none" style={[styles.outsideMask, leftMaskStyle]} />
                    <Animated.View pointerEvents="none" style={[styles.outsideMask, rightMaskStyle]} />
                    <Animated.View pointerEvents="none" style={[styles.outsideMask, bottomMaskStyle]} />
                    <Animated.View pointerEvents="none" style={[styles.cropBox, cropStyle]}>
                      <View style={styles.grid}><View style={styles.gridV1} /><View style={styles.gridV2} /><View style={styles.gridH1} /><View style={styles.gridH2} /></View>
                      <View style={styles.cropBorder} />
                      <View style={[styles.handle, styles.tl]} /><View style={[styles.handle, styles.tr]} />
                      <View style={[styles.handle, styles.bl]} /><View style={[styles.handle, styles.br]} />
                    </Animated.View>
                  </View>
                </GestureDetector>
              ) : null}
              {natural && !detectionDone ? (
                <View pointerEvents="none" style={styles.scanningOverlay}>
                  <View style={styles.scanningPill}><OrbitLoader size={22} /><Text style={styles.scanningText}>Finding the item</Text></View>
                </View>
              ) : null}
            </View>
          </View>
          <Animated.View style={[styles.resultsSheet, { height: sheetHeight, paddingBottom: 10 }, sheetAnimatedStyle]}>
            <GestureDetector gesture={sheetPan}>
              <View style={styles.sheetHandle}><View style={styles.sheetGrip} /><Text style={styles.sheetHandleText}>Swipe up for all matches</Text></View>
            </GestureDetector>
            <View style={styles.addSearchBox}>
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput placeholder="Add to your search" placeholderTextColor={colors.subtle} style={styles.addSearchInput} />
            </View>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeading}>
                <Text style={styles.sheetTitle}>Live matches</Text>
                <Text numberOfLines={1} style={styles.sheetSubhead}>{statusText}</Text>
              </View>
              {status === "detecting" || status === "searching" ? <OrbitLoader size={28} /> : <Ionicons name="sparkles-outline" size={21} color={colors.success} />}
            </View>
            <View style={styles.filterRow}>
              {[['Sort', sortBy], ['Size', sizeFilter], ['Color', colorFilter], ['Filter', availabilityFilter]].map(([label, value]) => <Pressable key={label} onPress={() => setOpenFilter(label.toLowerCase() as FilterKind)} style={[styles.filterChip, value !== label && value !== ({ Sort: 'Relevance', Size: 'Any size', Color: 'Any color', Filter: 'All pieces' } as Record<string, string>)[label] && styles.filterChipActive]}><Text style={styles.filterChipText} numberOfLines={1}>{label}</Text><Ionicons name="chevron-down" size={13} color={colors.muted} /></Pressable>)}
            </View>
            {filteredItems.length ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.resultsGrid}>
                {resultRows.map((row, rowIndex) => <View key={`result-row-${rowIndex}`} style={styles.resultRow}>{row.map((piece) => <View key={piece.id} style={{ width: resultWidth }}><ListingCard piece={piece} wide={resultWidth} framed /></View>)}{row.length === 1 ? <View style={{ width: resultWidth }} /> : null}</View>)}
              </ScrollView>
            ) : status === "detecting" || status === "searching" ? (
              <View style={styles.resultsGrid}><View style={styles.resultRow}><View style={{ width: resultWidth }}><ListingCardSkeleton wide={resultWidth} framed /></View><View style={{ width: resultWidth }}><ListingCardSkeleton wide={resultWidth} framed /></View></View></View>
            ) : (
              <View style={styles.emptyMatches}>
                <Text style={styles.emptyMatchesText}>{status === "ready" ? box ? "No close Uvel listings yet." : "No garment was detected automatically." : status === "error" ? "Search could not finish. Try another photo." : "Similar pieces will appear here as the scan finishes."}</Text>
              </View>
            )}
            <Text style={styles.adjustHint}>Matches update automatically as Uvel finds better pieces.</Text>
          </Animated.View>
        </>
      )}
      <Sheet open={Boolean(openFilter)} onClose={() => setOpenFilter(null)}>
        <Text style={styles.filterSheetTitle}>{openFilter === "sort" ? "Sort matches" : openFilter === "size" ? "Choose a size" : openFilter === "color" ? "Choose a color" : "Filter matches"}</Text>
        <View style={styles.filterOptions}>{filterOptions.map((option) => <Pressable key={option} onPress={() => chooseFilter(option)} style={styles.filterOption}><Text style={styles.filterOptionText}>{option}</Text><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>)}</View>
      </Sheet>
    </View>
  );
}

function SourceButton({ icon, label, onPress, primary, colors, styles }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; primary?: boolean; colors: Colors; styles: ReturnType<typeof make> }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.sourceButton, primary && styles.sourceButtonPrimary, pressed && styles.sourcePressed]} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={21} color={primary ? colors.ink : colors.success} />
      <Text style={[styles.sourceLabel, primary && styles.sourceLabelPrimary]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={primary ? colors.ink : colors.muted} />
    </Pressable>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    hero: { width: "100%", overflow: "hidden", backgroundColor: colors.ink },
    header: { minHeight: 54, paddingHorizontal: 12, paddingBottom: 5, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerOverHero: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2 },
    headerButton: { width: 48, height: 44, alignItems: "center", justifyContent: "center" },
    headerTitle: { color: colors.bone, fontSize: 16, fontWeight: "700" },
    changeButton: { minWidth: 48, alignItems: "flex-end", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 4 },
    changeText: { color: colors.success, fontSize: 14, fontWeight: "700" },
    empty: { flex: 1, justifyContent: "flex-start", paddingHorizontal: 26, paddingTop: 22 },
    title: { color: colors.bone, fontSize: 34, fontWeight: "700", textAlign: "center" },
    sourceList: { gap: 10, marginTop: 22 },
    sourceButton: { height: 58, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 13, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.045)" },
    sourceButtonPrimary: { backgroundColor: colors.success, borderColor: colors.success },
    sourcePressed: { opacity: 0.78 },
    sourceLabel: { color: colors.bone, fontSize: 15, fontWeight: "600", flex: 1 },
    sourceLabelPrimary: { color: colors.ink },
    photoArea: { alignItems: "center", justifyContent: "center", paddingVertical: 8 },
    frame: { overflow: "hidden", backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderRadius: 18 },
    loadingImage: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
    gestureSurface: { ...StyleSheet.absoluteFill },
    outsideMask: { position: "absolute", backgroundColor: "rgba(4,4,4,0.54)" },
    cropBox: { position: "absolute", minWidth: MIN_CROP_SIZE, minHeight: MIN_CROP_SIZE, backgroundColor: "rgba(165,34,49,0.035)" },
    cropBorder: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderWidth: 2, borderColor: colors.success },
    grid: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    gridV1: { position: "absolute", top: 0, bottom: 0, left: "33.33%", borderLeftWidth: 1, borderColor: "rgba(255,255,255,0.52)" },
    gridV2: { position: "absolute", top: 0, bottom: 0, left: "66.66%", borderLeftWidth: 1, borderColor: "rgba(255,255,255,0.52)" },
    gridH1: { position: "absolute", left: 0, right: 0, top: "33.33%", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.52)" },
    gridH2: { position: "absolute", left: 0, right: 0, top: "66.66%", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.52)" },
    handle: { position: "absolute", width: 20, height: 20, borderColor: MARKET_RED, borderWidth: 3, backgroundColor: colors.ink },
    tl: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
    tr: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
    bl: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
    br: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
    scanningOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
    scanningPill: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 15, paddingVertical: 11, backgroundColor: `${colors.surface}F2`, borderRadius: 999, borderWidth: 1, borderColor: `${colors.bone}20` },
    scanningText: { color: colors.bone, fontSize: 13, fontWeight: "600" },
    resultsSheet: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 20, minHeight: 284, paddingTop: 8, paddingHorizontal: 14, backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
    sheetHandle: { alignItems: "center", justifyContent: "center", minHeight: 34, marginBottom: 4 },
    sheetGrip: { width: 42, height: 4, borderRadius: 2, backgroundColor: `${colors.muted}88` },
    sheetHandleText: { color: colors.subtle, fontSize: 10, fontWeight: "700", marginTop: 5 },
    addSearchBox: { minHeight: 46, borderRadius: 23, borderWidth: 1, borderColor: `${colors.bone}28`, backgroundColor: colors.ink, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    addSearchInput: { flex: 1, minHeight: 42, color: colors.bone, fontSize: 14, paddingVertical: 0 },
    sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 11 },
    sheetHeading: { flex: 1 },
    sheetTitle: { color: colors.bone, fontSize: 18, fontWeight: "700" },
    sheetSubhead: { color: colors.muted, fontSize: 12, marginTop: 4 },
    filterRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    filterChip: { minHeight: 30, paddingHorizontal: 9, borderRadius: 15, borderWidth: 1, borderColor: `${colors.bone}20`, flexDirection: "row", alignItems: "center", gap: 3 },
    filterChipActive: { borderColor: MARKET_RED, backgroundColor: `${MARKET_RED}18` },
    filterChipText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
    resultsGrid: { gap: 12, paddingBottom: 24 },
    resultRow: { flexDirection: "row", gap: 12 },
    hotspotLayer: { ...StyleSheet.absoluteFill },
    hotspot: { position: "absolute", width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: 11, borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: MARKET_RED, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 5, elevation: 4 },
    emptyMatches: { minHeight: 132, justifyContent: "center", alignItems: "center", paddingHorizontal: 12 },
    emptyMatchesText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
    adjustHint: { color: colors.subtle, fontSize: 11, lineHeight: 15, marginTop: 4, textAlign: "center" },
    filterSheetTitle: { color: colors.bone, fontSize: 22, fontWeight: "800", marginTop: 4, marginBottom: 12 },
    filterOptions: { gap: 2 },
    filterOption: { minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}18`, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    filterOptionText: { color: colors.bone, fontSize: 15, fontWeight: "700" },
  });
}
