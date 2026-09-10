import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, Image as RNImage, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SW, height: SH } = Dimensions.get("window");
export const LISTING_RATIO = 4 / 5;
const MIN_CROP_SIZE = 92;

type Props = {
  uri: string;
  onCancel: () => void;
  onDone: (uri: string) => void;
};

type Point = { x: number; y: number };

export function PhotoCrop({ uri, onCancel, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const frame = useMemo(() => {
    const avail = SH - insets.top - insets.bottom - 250;
    const h = Math.min(SW / LISTING_RATIO, Math.max(240, avail));
    return { w: h * LISTING_RATIO, h };
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

  const left = useSharedValue(imageBox.left + imageBox.width * 0.12);
  const top = useSharedValue(imageBox.top + imageBox.height * 0.12);
  const right = useSharedValue(imageBox.left + imageBox.width * 0.88);
  const bottom = useSharedValue(imageBox.top + imageBox.height * 0.88);
  const start = { left: useSharedValue(0), top: useSharedValue(0), right: useSharedValue(0), bottom: useSharedValue(0) };

  useEffect(() => {
    if (!natural) return;
    left.value = imageBox.left + imageBox.width * 0.12;
    top.value = imageBox.top + imageBox.height * 0.12;
    right.value = imageBox.left + imageBox.width * 0.88;
    bottom.value = imageBox.top + imageBox.height * 0.88;
  }, [imageBox.height, imageBox.left, imageBox.top, imageBox.width, natural]);

  const cropStyle = useAnimatedStyle(() => ({
    left: left.value,
    top: top.value,
    width: right.value - left.value,
    height: bottom.value - top.value,
  }));
  const moveStart = { left: useSharedValue(0), top: useSharedValue(0), right: useSharedValue(0), bottom: useSharedValue(0) };

  const clampX = (value: number) => Math.max(imageBox.left, Math.min(imageBox.left + imageBox.width, value));
  const clampY = (value: number) => Math.max(imageBox.top, Math.min(imageBox.top + imageBox.height, value));

  const move = Gesture.Pan().onStart(() => {
    moveStart.left.value = left.value;
    moveStart.top.value = top.value;
    moveStart.right.value = right.value;
    moveStart.bottom.value = bottom.value;
  }).onUpdate((event) => {
    const width = moveStart.right.value - moveStart.left.value;
    const height = moveStart.bottom.value - moveStart.top.value;
    const nextLeft = Math.max(imageBox.left, Math.min(imageBox.left + imageBox.width - width, moveStart.left.value + event.translationX));
    const nextTop = Math.max(imageBox.top, Math.min(imageBox.top + imageBox.height - height, moveStart.top.value + event.translationY));
    left.value = nextLeft;
    top.value = nextTop;
    right.value = nextLeft + width;
    bottom.value = nextTop + height;
  });

  const cornerGesture = (corner: "tl" | "tr" | "bl" | "br") => Gesture.Pan().onStart(() => {
    start.left.value = left.value;
    start.top.value = top.value;
    start.right.value = right.value;
    start.bottom.value = bottom.value;
  }).onUpdate((event) => {
    const dx = event.translationX;
    const dy = event.translationY;
    if (corner.includes("l")) left.value = Math.min(clampX(start.left.value + dx), start.right.value - MIN_CROP_SIZE);
    if (corner.includes("r")) right.value = Math.max(clampX(start.right.value + dx), start.left.value + MIN_CROP_SIZE);
    if (corner.includes("t")) top.value = Math.min(clampY(start.top.value + dy), start.bottom.value - MIN_CROP_SIZE);
    if (corner.includes("b")) bottom.value = Math.max(clampY(start.bottom.value + dy), start.top.value + MIN_CROP_SIZE);
  });

  async function search() {
    if (!natural || busy) return;
    setBusy(true);
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
      const out = await ImageManipulator.manipulateAsync(uri, [{ crop: { originX, originY, width: cropW, height: cropH } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
      onDone(out.uri);
    } catch {
      onDone(uri);
    } finally {
      setBusy(false);
    }
  }

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
          <GestureDetector gesture={move}>
            <Animated.View style={[styles.cropBox, cropStyle]}>
              <View pointerEvents="none" style={styles.shadeTop} />
              <View style={styles.cropBorder} pointerEvents="none" />
              <GestureDetector gesture={cornerGesture("tl")}><View style={[styles.handle, styles.tl]} /></GestureDetector>
              <GestureDetector gesture={cornerGesture("tr")}><View style={[styles.handle, styles.tr]} /></GestureDetector>
              <GestureDetector gesture={cornerGesture("bl")}><View style={[styles.handle, styles.bl]} /></GestureDetector>
              <GestureDetector gesture={cornerGesture("br")}><View style={[styles.handle, styles.br]} /></GestureDetector>
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.hint}>Focus on one item, drag the corners to resize, or drag inside to move the crop</Text>
        <Pressable onPress={() => void search()} disabled={busy || !natural} style={({ pressed }) => [styles.searchButton, pressed && { opacity: 0.86 }, (busy || !natural) && { opacity: 0.55 }]} accessibilityRole="button" accessibilityLabel="Search Uvel with this crop">
          {busy ? <ActivityIndicator color="#16140F" /> : <Text style={styles.searchText}>Search</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { ...StyleSheet.absoluteFill, backgroundColor: "#0B0A08", zIndex: 40 },
  bar: { height: 66, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 28 },
  back: { color: "#F4F0E6", fontSize: 46, fontWeight: "200", lineHeight: 46 },
  title: { color: "#F4F0E6", fontWeight: "700", fontSize: 23 },
  barSpacer: { width: 30 },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  frame: { overflow: "hidden", backgroundColor: "#1A1814", alignItems: "center", justifyContent: "center" },
  cropBox: { position: "absolute", minWidth: MIN_CROP_SIZE, minHeight: MIN_CROP_SIZE },
  cropBorder: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderWidth: 2, borderColor: "#F4F0E6" },
  shadeTop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.10)" },
  handle: { position: "absolute", width: 48, height: 48, borderColor: "#F4F0E6", borderWidth: 4, zIndex: 4 },
  tl: { top: -4, left: -4, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: -4, right: -4, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: -4, left: -4, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: -4, right: -4, borderLeftWidth: 0, borderTopWidth: 0 },
  footer: { borderTopWidth: 1, borderTopColor: "#514D47", paddingHorizontal: 26, paddingTop: 28 },
  hint: { color: "#F4F0E6", fontSize: 16, lineHeight: 23, textAlign: "center", marginBottom: 24 },
  searchButton: { height: 68, borderRadius: 34, backgroundColor: "#F4F0E6", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  searchText: { color: "#16140F", fontSize: 20, fontWeight: "700" },
});
