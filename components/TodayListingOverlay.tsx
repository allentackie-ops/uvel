import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { getBrand } from "../lib/brands";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { getMarket, moneyInMarket } from "../lib/markets";
import { type ClosetPiece } from "../lib/wardrobe";

const DISMISS_DISTANCE = 132;
const DISMISS_VELOCITY = 950;

export function TodayListingOverlay({ piece, onClose, onOpenFull }: { piece: ClosetPiece; onClose: () => void; onOpenFull: () => void }) {
  const colors = useColors();
  const styles = make(colors);
  const app = useUvel();
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const backdrop = useSharedValue(1);
  const contentOpacity = useSharedValue(1);
  const radius = useSharedValue(0);

  useEffect(() => {
    translateY.value = 26;
    scale.value = 0.96;
    backdrop.value = 0;
    contentOpacity.value = 0;
    radius.value = 22;
    translateY.value = withSpring(0, { damping: 24, stiffness: 260, mass: 0.82 });
    scale.value = withSpring(1, { damping: 24, stiffness: 260, mass: 0.82 });
    backdrop.value = withTiming(1, { duration: 230 });
    contentOpacity.value = withTiming(1, { duration: 190 });
    radius.value = withTiming(0, { duration: 230 });
  }, [backdrop, contentOpacity, radius, scale, translateY]);

  const close = () => {
    translateY.value = withTiming(height * 0.92, { duration: 230 });
    scale.value = withTiming(0.82, { duration: 230 });
    backdrop.value = withTiming(0, { duration: 180 });
    contentOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const gesture = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      const y = Math.max(0, event.translationY);
      translateY.value = y;
      const progress = Math.min(y / height, 1);
      scale.value = 1 - progress * 0.2;
      backdrop.value = 1 - progress * 0.78;
      contentOpacity.value = 1 - progress * 0.35;
      radius.value = progress * 26;
    })
    .onEnd((event) => {
      const shouldDismiss = event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        translateY.value = withTiming(height * 0.92, { duration: 230 });
        scale.value = withTiming(0.82, { duration: 230 });
        backdrop.value = withTiming(0, { duration: 180 });
        contentOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
        return;
      }
      translateY.value = withSpring(0, { damping: 23, stiffness: 280, mass: 0.78 });
      scale.value = withSpring(1, { damping: 23, stiffness: 280, mass: 0.78 });
      backdrop.value = withTiming(1, { duration: 180 });
      contentOpacity.value = withTiming(1, { duration: 160 });
      radius.value = withTiming(0, { duration: 180 });
    });

  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    borderRadius: radius.value,
  }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: backdrop.value * 0.62 }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  const brand = piece.brandId ? getBrand(piece.brandId)?.name : piece.brand;
  const market = getMarket(app.country);
  const liked = app.saved.includes(piece.id);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veilStyle]} pointerEvents="none" />
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.surface, surfaceStyle]}>
          <Image source={{ uri: piece.photo }} style={styles.hero} contentFit="cover" />
          <Animated.View style={[styles.chrome, chromeStyle]} pointerEvents="box-none">
            <Pressable onPress={close} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Close listing">
              <Ionicons name="chevron-down" size={28} color={colors.ink} />
            </Pressable>
            <Pressable
              onPress={() => app.toggleSaved(piece.id)}
              hitSlop={10}
              style={styles.save}
              accessibilityRole="button"
              accessibilityLabel={liked ? "Remove listing from saved" : "Save listing"}
            >
              <Ionicons name={liked ? "heart" : "heart-outline"} size={21} color={liked ? colors.success : colors.ink} />
              <Text style={styles.saveText}>{liked ? "Saved" : "Save"}</Text>
            </Pressable>
          </Animated.View>
          <Animated.View style={[styles.info, chromeStyle]}>
            <Text style={styles.kicker}>{(brand || "UVEL").toUpperCase()}</Text>
            <Text style={styles.title}>{piece.name}</Text>
            <Text style={styles.price}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>
            <Text style={styles.meta}>{[piece.size || piece.sizes?.[0] || "One size", piece.condition || "Condition not listed"].join(" · ")}</Text>
            <Pressable onPress={onOpenFull} style={styles.fullButton} accessibilityRole="button" accessibilityLabel="View full listing">
              <Text style={styles.fullButtonText}>View full listing</Text>
              <Ionicons name="arrow-forward" size={17} color={colors.successInk} />
            </Pressable>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, elevation: 100 },
    veil: { backgroundColor: "#000" },
    surface: { flex: 1, overflow: "hidden", backgroundColor: colors.ink },
    hero: { width: "100%", height: "59%", backgroundColor: colors.surface },
    chrome: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    back: { position: "absolute", top: 54, left: 18, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(244,240,230,0.82)" },
    save: { position: "absolute", top: 54, right: 18, minHeight: 42, paddingHorizontal: 14, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(244,240,230,0.82)" },
    saveText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
    info: { flex: 1, paddingHorizontal: 22, paddingTop: 22 },
    kicker: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1.8 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 7 },
    price: { color: colors.bone, fontSize: 19, fontWeight: "800", marginTop: 12 },
    meta: { color: `${colors.bone}85`, fontSize: 13, marginTop: 7 },
    fullButton: { minHeight: 50, marginTop: 22, borderRadius: 25, paddingHorizontal: 18, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    fullButtonText: { color: colors.successInk, fontSize: 14, fontWeight: "800" },
  });
}
