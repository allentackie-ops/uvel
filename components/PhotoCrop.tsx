import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, Image as RNImage, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SW, height: SH } = Dimensions.get("window");
export const LISTING_RATIO = 4 / 5;

type Props = {
  uri: string;
  onCancel: () => void;
  onDone: (uri: string) => void;
};

export function PhotoCrop({ uri, onCancel, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startS = useSharedValue(1);

  const frame = useMemo(() => {
    const avail = SH - insets.top - insets.bottom - 250;
    const h = Math.min(SW / LISTING_RATIO, Math.max(240, avail));
    const w = h * LISTING_RATIO;
    return { w, h };
  }, [insets.bottom, insets.top]);

  useEffect(() => {
    RNImage.getSize(uri, (w, h) => setNatural({ w, h }), () => setNatural({ w: 1200, h: 1500 }));
  }, [uri]);

  const minScale = natural ? Math.max(frame.w / natural.w, frame.h / natural.h) : 1;
  const pan = Gesture.Pan().onStart(() => {
    startX.value = tx.value;
    startY.value = ty.value;
  }).onUpdate((e) => {
    tx.value = startX.value + e.translationX;
    ty.value = startY.value + e.translationY;
  });
  const pinch = Gesture.Pinch().onStart(() => {
    startS.value = scale.value;
  }).onUpdate((e) => {
    scale.value = Math.max(1, startS.value * e.scale);
  });

  const imgStyle = useAnimatedStyle(() => {
    const s = minScale * scale.value;
    const w = (natural?.w ?? frame.w) * s;
    const h = (natural?.h ?? frame.h) * s;
    const maxX = Math.max(0, (w - frame.w) / 2);
    const maxY = Math.max(0, (h - frame.h) / 2);
    const x = Math.min(maxX, Math.max(-maxX, tx.value));
    const y = Math.min(maxY, Math.max(-maxY, ty.value));
    return { width: w, height: h, transform: [{ translateX: x }, { translateY: y }] };
  });

  async function search() {
    if (!natural || busy) return;
    setBusy(true);
    const s = minScale * scale.value;
    const w = natural.w * s;
    const h = natural.h * s;
    const maxX = Math.max(0, (w - frame.w) / 2);
    const maxY = Math.max(0, (h - frame.h) / 2);
    const x = Math.min(maxX, Math.max(-maxX, tx.value));
    const y = Math.min(maxY, Math.max(-maxY, ty.value));
    const originX = Math.max(0, Math.round(((w - frame.w) / 2 - x) / s));
    const originY = Math.max(0, Math.round(((h - frame.h) / 2 - y) / s));
    const cropW = Math.min(natural.w - originX, Math.max(1, Math.round(frame.w / s)));
    const cropH = Math.min(natural.h - originY, Math.max(1, Math.round(frame.h / s)));
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
          {natural ? (
            <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
              <Animated.View style={[styles.imgWrap, imgStyle]}>
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
              </Animated.View>
            </GestureDetector>
          ) : <ActivityIndicator color="#D6E27A" />}
          <View pointerEvents="none" style={styles.cropOverlay}>
            <View style={[styles.corner, styles.tl]} /><View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} /><View style={[styles.corner, styles.br]} />
          </View>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.hint}>For best results, focus on one item and drag the corners to adjust</Text>
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
  imgWrap: { alignItems: "center", justifyContent: "center" },
  cropOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  corner: { position: "absolute", width: 32, height: 32, borderColor: "#F4F0E6", borderWidth: 4 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  footer: { borderTopWidth: 1, borderTopColor: "#514D47", paddingHorizontal: 26, paddingTop: 28 },
  hint: { color: "#F4F0E6", fontSize: 16, lineHeight: 23, textAlign: "center", marginBottom: 24 },
  searchButton: { height: 68, borderRadius: 34, backgroundColor: "#F4F0E6", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  searchText: { color: "#16140F", fontSize: 20, fontWeight: "700" },
});
