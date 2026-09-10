import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, Image as RNImage, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "./ListingCard";
import type { ClosetPiece } from "../lib/wardrobe";

const { width: SW, height: SH } = Dimensions.get("window");
const MIN_CROP_SIZE = 92;
const HANDLE_HIT_SIZE = 64;
type Mode = "move" | "tl" | "tr" | "bl" | "br";

type Props = {
  uri: string;
  onCancel: () => void;
  onPreview?: (uri: string) => void;
  previewStatus?: "idle" | "searching" | "ready";
  previewItems?: ClosetPiece[];
};

export function PhotoCrop({ uri, onCancel, onPreview, previewStatus = "idle", previewItems = [] }: Props) {
  const insets = useSafeAreaInsets();
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const frame = useMemo(() => {
    // Give the crop image more of the vertical space above the live-matches sheet.
    const avail = SH - insets.top - insets.bottom - 250;
    const h = Math.min(SW * 1.28, Math.max(220, avail));
    return { w: Math.min(SW - 20, h * 0.8), h };
  }, [insets.bottom, insets.top]);
  const imageBox = useMemo(() => {
    if (!natural) return { left: 0, top: 0, width: frame.w, height: frame.h };
    const scale = Math.min(frame.w / natural.w, frame.h / natural.h);
    const width = natural.w * scale;
    const height = natural.h * scale;
    return { left: (frame.w - width) / 2, top: (frame.h - height) / 2, width, height };
  }, [frame.h, frame.w, natural]);

  useEffect(() => {
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
  const sheetY = useSharedValue(150);
  const sheetStartY = useSharedValue(150);

  useEffect(() => {
    left.value = imageBox.left + imageBox.width * 0.12;
    top.value = imageBox.top + imageBox.height * 0.12;
    right.value = imageBox.left + imageBox.width * 0.88;
    bottom.value = imageBox.top + imageBox.height * 0.88;
  }, [imageBox.height, imageBox.left, imageBox.top, imageBox.width]);

  const cropStyle = useAnimatedStyle(() => ({ left: left.value, top: top.value, width: right.value - left.value, height: bottom.value - top.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));

  const cropImage = useCallback(async () => {
    if (!natural || !onPreview) return;
    const cropLeft = Math.max(imageBox.left, Math.min(imageBox.left + imageBox.width, left.value));
    const cropTop = Math.max(imageBox.top, Math.min(imageBox.top + imageBox.height, top.value));
    const cropRight = Math.max(cropLeft + 1, Math.min(imageBox.left + imageBox.width, right.value));
    const cropBottom = Math.max(cropTop + 1, Math.min(imageBox.top + imageBox.height, bottom.value));
    const originX = Math.round((cropLeft - imageBox.left) / imageBox.width * natural.w);
    const originY = Math.round((cropTop - imageBox.top) / imageBox.height * natural.h);
    const cropW = Math.max(1, Math.min(natural.w - originX, Math.round((cropRight - cropLeft) / imageBox.width * natural.w)));
    const cropH = Math.max(1, Math.min(natural.h - originY, Math.round((cropBottom - cropTop) / imageBox.height * natural.h)));
    try {
      const ImageManipulator = await import("expo-image-manipulator");
      const out = await ImageManipulator.manipulateAsync(uri, [{ crop: { originX, originY, width: cropW, height: cropH } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
      onPreview(out.uri);
    } catch {
      onPreview(uri);
    }
  }, [bottom, imageBox.height, imageBox.left, imageBox.top, imageBox.width, left, natural, onPreview, right, top, uri]);

  const cropGesture = Gesture.Pan().onStart((event) => {
    startLeft.value = left.value;
    startTop.value = top.value;
    startRight.value = right.value;
    startBottom.value = bottom.value;
    const nearLeft = Math.abs(event.x - left.value) <= HANDLE_HIT_SIZE;
    const nearRight = Math.abs(event.x - right.value) <= HANDLE_HIT_SIZE;
    const nearTop = Math.abs(event.y - top.value) <= HANDLE_HIT_SIZE;
    const nearBottom = Math.abs(event.y - bottom.value) <= HANDLE_HIT_SIZE;
    mode.value = nearLeft && nearTop ? "tl" : nearRight && nearTop ? "tr" : nearLeft && nearBottom ? "bl" : nearRight && nearBottom ? "br" : "move";
  }).onUpdate((event) => {
    const dx = event.translationX;
    const dy = event.translationY;
    if (mode.value === "move") {
      const width = startRight.value - startLeft.value;
      const height = startBottom.value - startTop.value;
      const nextLeft = Math.max(imageBox.left, Math.min(imageBox.left + imageBox.width - width, startLeft.value + dx));
      const nextTop = Math.max(imageBox.top, Math.min(imageBox.top + imageBox.height - height, startTop.value + dy));
      left.value = nextLeft;
      top.value = nextTop;
      right.value = nextLeft + width;
      bottom.value = nextTop + height;
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
    if (onPreview) runOnJS(cropImage)();
  });

  const sheetGesture = Gesture.Pan().onStart(() => {
    sheetStartY.value = sheetY.value;
  }).onUpdate((event) => {
    sheetY.value = Math.max(0, Math.min(150, sheetStartY.value + event.translationY));
  }).onEnd(() => {
    sheetY.value = withSpring(sheetY.value < 75 ? 0 : 150, { damping: 24, stiffness: 220 });
  });

  const liveText = previewStatus === "searching" ? "Looking for this on Uvel…" : previewStatus === "ready" ? `${previewItems.length} ${previewItems.length === 1 ? "match" : "matches"}` : "";

  return (
    <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.bar}>
        <Pressable onPress={onCancel} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back"><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>Focus your search</Text>
        <View style={styles.barSpacer} />
      </View>
      <View style={styles.stage}>
        <View style={[styles.frame, { width: frame.w, height: frame.h }]}>
          {natural ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" /> : <ActivityIndicator color="#D6E27A" />}
          <GestureDetector gesture={cropGesture}>
            <View style={styles.gestureSurface}>
              <Animated.View style={[styles.cropBox, cropStyle]}>
                <View pointerEvents="none" style={styles.grid}><View style={styles.gridV1} /><View style={styles.gridV2} /><View style={styles.gridH1} /><View style={styles.gridH2} /></View>
                <View pointerEvents="none" style={styles.cropBorder} />
                <View pointerEvents="none" style={[styles.handle, styles.tl]} /><View pointerEvents="none" style={[styles.handle, styles.tr]} />
                <View pointerEvents="none" style={[styles.handle, styles.bl]} /><View pointerEvents="none" style={[styles.handle, styles.br]} />
              </Animated.View>
            </View>
          </GestureDetector>
        </View>
      </View>
      <GestureDetector gesture={sheetGesture}>
        <Animated.View style={[styles.resultsSheet, sheetStyle]}>
          <View style={styles.sheetGrip} />
          <View style={styles.sheetHeader}>
            <View><Text style={styles.sheetTitle}>Live matches</Text><Text style={styles.sheetSubhead}>{liveText || "Move the crop to begin"}</Text></View>
            {previewStatus === "searching" ? <ActivityIndicator color="#D6E27A" /> : null}
          </View>
          {previewItems.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resultsRail} nestedScrollEnabled>
            {previewItems.map((piece) => <ListingCard key={piece.id} piece={piece} wide={164} framed />)}
          </ScrollView> : <Text style={styles.emptyResults}>{previewStatus === "ready" ? "No close Uvel listings yet." : "Matches will appear here as you frame an item."}</Text>}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { ...StyleSheet.absoluteFill, backgroundColor: "#0B0A08", zIndex: 40 },
  bar: { height: 66, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 28 },
  back: { color: "#F4F0E6", fontSize: 46, fontWeight: "200", lineHeight: 46 },
  title: { color: "#F4F0E6", fontWeight: "700", fontSize: 23 },
  barSpacer: { width: 30 },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", transform: [{ translateY: -96 }] },
  frame: { overflow: "hidden", backgroundColor: "#1A1814", alignItems: "center", justifyContent: "center" },
  gestureSurface: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  cropBox: { position: "absolute", minWidth: MIN_CROP_SIZE, minHeight: MIN_CROP_SIZE },
  cropBorder: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderWidth: 2, borderColor: "#F4F0E6" },
  grid: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  gridV1: { position: "absolute", top: 0, bottom: 0, left: "33.33%", borderLeftWidth: 1, borderColor: "rgba(244,240,230,0.52)" },
  gridV2: { position: "absolute", top: 0, bottom: 0, left: "66.66%", borderLeftWidth: 1, borderColor: "rgba(244,240,230,0.52)" },
  gridH1: { position: "absolute", left: 0, right: 0, top: "33.33%", borderTopWidth: 1, borderColor: "rgba(244,240,230,0.52)" },
  gridH2: { position: "absolute", left: 0, right: 0, top: "66.66%", borderTopWidth: 1, borderColor: "rgba(244,240,230,0.52)" },
  handle: { position: "absolute", width: 36, height: 36, borderColor: "#F4F0E6", borderWidth: 4 },
  tl: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0 },
  resultsSheet: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 360, backgroundColor: "#1A1916", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 16, zIndex: 20 },
  sheetGrip: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: "rgba(244,240,230,0.32)", marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sheetTitle: { color: "#F4F0E6", fontSize: 18, fontWeight: "700" },
  sheetSubhead: { color: "rgba(244,240,230,0.58)", fontSize: 13, marginTop: 3 },
  resultsRail: { gap: 12, paddingBottom: 14 },
  emptyResults: { color: "rgba(244,240,230,0.62)", fontSize: 14, lineHeight: 20, paddingVertical: 24 },
});
