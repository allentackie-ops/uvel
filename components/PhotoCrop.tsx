import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, Image as RNImage, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, type Colors } from "../lib/theme";

const { width: SW, height: SH } = Dimensions.get("window");
export const LISTING_RATIO = 4 / 5;

type Props = {
  uri: string;
  onCancel: () => void;
  onDone: (uri: string) => void;
};

export function PhotoCrop({ uri, onCancel, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startS = useSharedValue(1);

  const frame = useMemo(() => {
    const avail = SH - insets.top - insets.bottom - 108;
    const h = Math.min(SW / LISTING_RATIO, avail);
    const w = h * LISTING_RATIO;
    return { w, h };
  }, [insets.bottom, insets.top]);

  useEffect(() => {
    RNImage.getSize(
      uri,
      (w, h) => setNatural({ w, h }),
      () => setNatural({ w: 1200, h: 1500 }),
    );
  }, [uri]);

  const minScale = natural ? Math.max(frame.w / natural.w, frame.h / natural.h) : 1;

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startS.value = scale.value;
    })
    .onUpdate((e) => {
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

  async function useIt() {
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
      const out = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: { originX, originY, width: cropW, height: cropH } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
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
        <Pressable onPress={onCancel} hitSlop={12}>
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Crop</Text>
        <Pressable onPress={() => void useIt()} hitSlop={12}>
          <Text style={styles.use}>{busy ? "…" : "Use"}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>This is the listing frame. Drag to fill it. Pinch to zoom.</Text>
      <View style={styles.stage}>
        <View style={[styles.frame, { width: frame.w, height: frame.h }]}>
          {natural ? (
            <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
              <Animated.View style={[styles.imgWrap, imgStyle]}>
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
              </Animated.View>
            </GestureDetector>
          ) : (
            <ActivityIndicator color={colors.success} />
          )}
        </View>
      </View>
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.legacyInk} />
        </View>
      ) : null}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
  page: { ...StyleSheet.absoluteFill, backgroundColor: colors.ink, zIndex: 40 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    height: 48,
  },
  link: { color: colors.muted, fontSize: 16 },
  title: { color: colors.bone, fontWeight: "600", fontSize: 16 },
  use: { color: colors.successInk, fontWeight: "700", fontSize: 16 },
  hint: { color: colors.subtle, textAlign: "center", fontSize: 13, marginBottom: 12 },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  frame: { overflow: "hidden", backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  imgWrap: { alignItems: "center", justifyContent: "center" },
  busy: {
    ...StyleSheet.absoluteFill,
    backgroundColor: `${colors.success}59`,
    alignItems: "center",
    justifyContent: "center",
  },
  });
}
