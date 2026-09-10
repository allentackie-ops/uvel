import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
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
import { getMarket, moneyInMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { type ClosetPiece } from "../lib/wardrobe";

export type ListingOrigin = { x: number; y: number; width: number; height: number };

const SPRING = { damping: 28, stiffness: 285, mass: 0.82 };
const RELEASE_DISTANCE = 124;
const RELEASE_VELOCITY = 900;

export function TodayListingOverlay({
  piece,
  origin,
  onClose,
}: {
  piece: ClosetPiece;
  origin: ListingOrigin;
  onClose: () => void;
}) {
  const colors = useColors();
  const styles = make(colors);
  const app = useUvel();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const top = useSharedValue(origin.y);
  const left = useSharedValue(origin.x);
  const boxWidth = useSharedValue(origin.width);
  const boxHeight = useSharedValue(origin.height);
  const progress = useSharedValue(0);
  const detailOpacity = useSharedValue(0);
  const chromeOpacity = useSharedValue(0);
  const radius = useSharedValue(18);

  useEffect(() => {
    top.value = withSpring(0, SPRING);
    left.value = withSpring(0, SPRING);
    boxWidth.value = withSpring(screenWidth, SPRING);
    boxHeight.value = withSpring(screenHeight, SPRING);
    progress.value = withTiming(1, { duration: 360 });
    detailOpacity.value = withTiming(1, { duration: 280 });
    chromeOpacity.value = withTiming(1, { duration: 300 });
    radius.value = withTiming(0, { duration: 300 });
  }, [boxHeight, boxWidth, chromeOpacity, detailOpacity, left, progress, radius, screenHeight, screenWidth, top]);

  const animateToOrigin = () => {
    top.value = withTiming(origin.y, { duration: 260 });
    left.value = withTiming(origin.x, { duration: 260 });
    boxWidth.value = withTiming(origin.width, { duration: 260 });
    boxHeight.value = withTiming(origin.height, { duration: 260 });
    progress.value = withTiming(0, { duration: 230 });
    detailOpacity.value = withTiming(0, { duration: 150 });
    chromeOpacity.value = withTiming(0, { duration: 120 });
    radius.value = withTiming(18, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const animateToScreen = () => {
    top.value = withSpring(0, SPRING);
    left.value = withSpring(0, SPRING);
    boxWidth.value = withSpring(screenWidth, SPRING);
    boxHeight.value = withSpring(screenHeight, SPRING);
    progress.value = withTiming(1, { duration: 250 });
    detailOpacity.value = withTiming(1, { duration: 220 });
    chromeOpacity.value = withTiming(1, { duration: 230 });
    radius.value = withTiming(0, { duration: 220 });
  };

  const gesture = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-28, 28])
    .onUpdate((event) => {
      const drag = Math.max(0, event.translationY);
      const dragProgress = Math.min(drag / (screenHeight * 0.72), 1);
      top.value = drag;
      left.value = interpolate(dragProgress, [0, 1], [0, origin.x], Extrapolation.CLAMP);
      boxWidth.value = interpolate(dragProgress, [0, 1], [screenWidth, origin.width], Extrapolation.CLAMP);
      boxHeight.value = interpolate(dragProgress, [0, 1], [screenHeight, origin.height], Extrapolation.CLAMP);
      progress.value = 1 - dragProgress;
      detailOpacity.value = 1 - dragProgress * 0.78;
      chromeOpacity.value = 1 - dragProgress;
      radius.value = interpolate(dragProgress, [0, 1], [0, 18], Extrapolation.CLAMP);
    })
    .onEnd((event) => {
      if (event.translationY > RELEASE_DISTANCE || event.velocityY > RELEASE_VELOCITY) {
        runOnJS(animateToOrigin)();
      } else {
        runOnJS(animateToScreen)();
      }
    });

  const surfaceStyle = useAnimatedStyle(() => ({
    top: top.value,
    left: left.value,
    width: boxWidth.value,
    height: boxHeight.value,
    borderRadius: radius.value,
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 1], [0, 0.58]) }));
  const detailStyle = useAnimatedStyle(() => ({ opacity: detailOpacity.value }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chromeOpacity.value }));

  const brand = piece.brandId ? getBrand(piece.brandId)?.name : piece.brand;
  const market = getMarket(app.country);
  const liked = app.saved.includes(piece.id);
  const gallery = piece.photos?.length ? piece.photos : [piece.photo];

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.surface, surfaceStyle]}>
          <Image source={{ uri: gallery[0] }} style={styles.hero} contentFit="cover" />
          <Animated.View style={[styles.chrome, chromeStyle]} pointerEvents="box-none">
            <Pressable onPress={animateToOrigin} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Close listing">
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
          <Animated.View style={[styles.detail, detailStyle]}>
            <Text style={styles.kicker}>{(brand || "UVEL").toUpperCase()}</Text>
            <Text style={styles.title}>{piece.name}</Text>
            <Text style={styles.price}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>
            <Text style={styles.meta}>{[piece.size || piece.sizes?.[0] || "One size", piece.color, piece.condition].filter(Boolean).join(" · ")}</Text>
            {piece.notes ? <Text style={styles.notes}>{piece.notes}</Text> : null}
            <View style={styles.rule} />
            <Text style={styles.section}>Listing details</Text>
            <View style={styles.facts}>
              {piece.category ? <Fact label="Category" value={piece.category} styles={styles} /> : null}
              {piece.material ? <Fact label="Material" value={piece.material} styles={styles} /> : null}
              <Fact label="Ships from" value={piece.country || app.country} styles={styles} />
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => app.toggleSaved(piece.id)} style={styles.secondaryAction} accessibilityRole="button">
                <Ionicons name={liked ? "heart" : "heart-outline"} size={18} color={colors.bone} />
                <Text style={styles.secondaryText}>{liked ? "Saved" : "Save listing"}</Text>
              </Pressable>
              <Pressable onPress={() => router.push({ pathname: "/checkout/[id]", params: { id: piece.id } })} style={styles.primaryAction} accessibilityRole="button" accessibilityLabel="Buy this listing">
                <Text style={styles.primaryText}>Buy this listing</Text>
                <Ionicons name="arrow-forward" size={17} color={colors.successInk} />
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function Fact({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof make> }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, elevation: 100 },
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#000" },
    surface: { position: "absolute", overflow: "hidden", backgroundColor: colors.ink },
    hero: { width: "100%", height: "59%", backgroundColor: colors.surface },
    chrome: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    back: { position: "absolute", top: 54, left: 18, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(244,240,230,0.84)" },
    save: { position: "absolute", top: 54, right: 18, minHeight: 42, paddingHorizontal: 14, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(244,240,230,0.84)" },
    saveText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
    detail: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 40 },
    kicker: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1.8 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 7 },
    price: { color: colors.bone, fontSize: 19, fontWeight: "800", marginTop: 12 },
    meta: { color: `${colors.bone}85`, fontSize: 13, marginTop: 7 },
    notes: { color: `${colors.bone}B0`, fontSize: 14, lineHeight: 21, marginTop: 18 },
    rule: { height: 1, backgroundColor: `${colors.bone}20`, marginTop: 22 },
    section: { color: colors.bone, fontSize: 16, fontWeight: "800", marginTop: 18 },
    facts: { flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 13 },
    fact: { minWidth: "28%" },
    factLabel: { color: `${colors.bone}60`, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
    factValue: { color: colors.bone, fontSize: 13, marginTop: 4 },
    actions: { gap: 10, marginTop: 26 },
    secondaryAction: { minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: `${colors.bone}32`, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    secondaryText: { color: colors.bone, fontSize: 14, fontWeight: "800" },
    primaryAction: { minHeight: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    primaryText: { color: colors.successInk, fontSize: 14, fontWeight: "800" },
  });
}
