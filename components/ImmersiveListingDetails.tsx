import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { GlassView } from "expo-glass-effect";
import { Modal, Platform, StyleSheet, Text, View, useWindowDimensions, type ImageStyle } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "./AccessiblePressable";
import { ListingAlertControls } from "./ListingAlertControls";
import { getMarket } from "../lib/markets";
import { shipsToLine } from "../lib/ships";
import type { ClosetPiece } from "../lib/wardrobe";
import { useColors } from "../lib/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  piece: ClosetPiece;
  brandLabel: string;
  sellerName: string;
  sellerPhoto: string | null;
  buyerCountry: string;
  price: string;
  originalPrice?: string;
};

export function ImmersiveListingDetails({
  visible,
  onClose,
  piece,
  brandLabel,
  sellerName,
  sellerPhoto,
  buyerCountry,
  price,
  originalPrice,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const light = colors.ink !== "#000000";
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const dragY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const panStartScrollY = useSharedValue(0);
  const contentScrollGesture = useMemo(() => Gesture.Native(), []);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(false);
  const originCode = piece.country || buyerCountry;
  const origin = getMarket(originCode);
  const rawAvailability = shipsToLine(originCode, piece.shipsTo);
  const availability = rawAvailability.startsWith("Sells in ")
    ? rawAvailability.replace("Sells in ", "Available in ")
    : rawAvailability.startsWith("On the ")
      ? rawAvailability.replace("On the ", "Available on the ")
      : rawAvailability;
  const size = piece.sizes?.filter(Boolean).join(" · ") || piece.size;
  const facts = [
    { label: "Condition", value: piece.condition },
    { label: "Size", value: size },
    { label: "Color", value: piece.color },
    { label: "Material", value: piece.material },
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value?.trim()));
  const fit = piece.measurements?.fit || piece.measurements?.length || "Not added yet";
  const measurements = Object.entries(piece.measurements || {}).filter(([label, value]) => Boolean(value) && label !== "fit" && label !== "length");
  const bottomPadding = Math.max(insets.bottom + 10, 16);
  const sheetChrome = 36 + 8 + bottomPadding;
  const maxSheetHeight = windowHeight - insets.top - 10;
  const maxScrollHeight = Math.max(150, maxSheetHeight - sheetChrome);
  const scrollHeight = Math.min(maxScrollHeight, Math.max(320, windowHeight * 0.72) - sheetChrome);
  const sheetHeight = scrollHeight + sheetChrome;

  useEffect(() => {
    if (visible) dragY.value = 0;
  }, [visible, dragY]);

  const dismissPan = useMemo(() => Gesture.Pan()
    .activeOffsetY(6)
    .failOffsetX([-18, 18])
    .simultaneousWithExternalGesture(contentScrollGesture)
    .onBegin(() => {
      panStartScrollY.value = scrollY.value;
    })
    .onUpdate((event) => {
      if (panStartScrollY.value <= 1) dragY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (panStartScrollY.value <= 1 && (event.translationY > 72 || event.velocityY > 700)) {
        dragY.value = withTiming(sheetHeight, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        dragY.value = withSpring(0, { damping: 22, stiffness: 240, overshootClamping: true });
      }
    }), [contentScrollGesture, dragY, onClose, panStartScrollY, scrollY, sheetHeight]);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.modalRoot}>
        <AccessiblePressable
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss listing details"
          accessibilityHint="Tap outside the panel to return to immersive shopping."
        >
          <View style={styles.backdrop} />
        </AccessiblePressable>
        <GestureDetector gesture={dismissPan}>
          <Animated.View
            style={[styles.sheet, { height: sheetHeight, paddingBottom: bottomPadding }, dragStyle]}
            accessibilityViewIsModal
          >
          <View pointerEvents="none" style={styles.glassLayer}>
            {!light && Platform.OS === "ios" ? <GlassView glassEffectStyle="regular" colorScheme="dark" style={styles.glassSurface} /> : <View style={styles.glassFallback} />}
            <View style={styles.warmTint} />
          </View>
          <View style={styles.sheetContent}>
            <View style={styles.dragCue} accessible accessibilityLabel="Swipe down to dismiss listing details" />
            <GestureDetector gesture={contentScrollGesture}>
              <Animated.ScrollView
                style={[styles.scroll, { height: scrollHeight, maxHeight: maxScrollHeight }]}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                bounces={false}
                overScrollMode="never"
                scrollEventThrottle={16}
                onScroll={scrollHandler}
            >
              {brandLabel.trim() && brandLabel.trim().toLowerCase() !== sellerName.trim().toLowerCase() ? (
                <Text style={styles.brand}>{brandLabel.toUpperCase()}</Text>
              ) : null}
              <Text style={styles.title}>{piece.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{price}</Text>
                {originalPrice ? <Text style={styles.originalPrice}>{originalPrice}</Text> : null}
              </View>

              {facts.length ? (
                <Text style={styles.factSummary}>
                  {facts.map((fact, index) => (
                    <Text key={fact.label}>
                      <Text style={styles.factLabel}>{fact.label}: </Text>
                      <Text style={styles.factValue}>{fact.value}</Text>
                      {index < facts.length - 1 ? <Text style={styles.factSeparator}>  ·  </Text> : null}
                    </Text>
                  ))}
                </Text>
              ) : null}

              {piece.notes?.trim() ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>About</Text>
                  <Text style={styles.description}>{piece.notes.trim()}</Text>
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Seller</Text>
                <View style={styles.sellerRow}>
                  {sellerPhoto ? (
                    <Image source={{ uri: sellerPhoto }} style={styles.avatar as ImageStyle} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>{(sellerName[0] || "U").toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.sellerInfo}>
                    <Text style={styles.sellerName} numberOfLines={1}>{sellerName}</Text>
                    <Text style={styles.sellerMeta}>Ships from {origin.name}</Text>
                  </View>
                </View>
                <View style={styles.availabilityRow}>
                  <Ionicons name="navigate-outline" size={17} color={colors.success} />
                  <Text style={styles.availabilityText}>{availability}</Text>
                </View>
              </View>

              <View style={styles.compactSection}>
                <AccessiblePressable onPress={() => setMeasurementsOpen((open) => !open)} style={styles.compactRow} accessibilityRole="button" accessibilityState={{ expanded: measurementsOpen }}>
                  <View style={styles.compactTitleWrap}><Ionicons name="resize-outline" size={17} color={colors.success} /><Text style={styles.compactTitle}>Measurements & fit</Text></View>
                  <Ionicons name={measurementsOpen ? "chevron-up" : "chevron-down"} size={17} color={colors.bone} />
                </AccessiblePressable>
                {measurementsOpen ? <View style={styles.compactContent}>
                  <View style={styles.measurementRow}><Text style={styles.measurementLabel}>Fit</Text><Text style={styles.measurementValue}>{fit}</Text></View>
                  {measurements.length ? measurements.map(([label, value]) => <View key={label} style={styles.measurementRow}><Text style={styles.measurementLabel}>{label.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ")}</Text><Text style={styles.measurementValue}>{value}</Text></View>) : <Text style={styles.compactBody}>No measurements added yet.</Text>}
                </View> : null}
              </View>
              <View style={styles.compactSection}>
                <AccessiblePressable onPress={() => setShippingOpen((open) => !open)} style={styles.compactRow} accessibilityRole="button" accessibilityState={{ expanded: shippingOpen }}>
                  <View style={styles.compactTitleWrap}><Ionicons name="cube-outline" size={17} color={colors.success} /><Text style={styles.compactTitle}>Shipping & returns</Text></View>
                  <Ionicons name={shippingOpen ? "chevron-up" : "chevron-down"} size={17} color={colors.bone} />
                </AccessiblePressable>
                {shippingOpen ? <View style={styles.compactContent}>
                  <Text style={styles.compactBody}>Ships to {availability.replace(/^Available /, "")}.</Text>
                  {piece.shippingMethod ? <Text style={styles.compactBody}>{piece.shippingMethod === "pickup" ? "Courier collection" : "Seller drop-off"} · {piece.shippingBuyerPays === false ? "Seller pays delivery" : "Buyer pays delivery"}</Text> : null}
                  <Text style={styles.compactBody}>Returns and delivery details are confirmed at checkout.</Text>
                </View> : null}
              </View>
              <ListingAlertControls key={piece.id} piece={piece} colors={colors} appearance="popup" collapsible />
              </Animated.ScrollView>
            </GestureDetector>
          </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  const light = colors.ink !== "#000000";
  return StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: "flex-end" },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.16)" },
    sheet: {
      width: "100%",
      backgroundColor: "transparent",
      borderTopLeftRadius: 27,
      borderTopRightRadius: 27,
      borderWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: 0,
      borderColor: light ? "rgba(24,23,20,0.14)" : "rgba(244,240,230,0.14)",
      paddingTop: 8,
      paddingHorizontal: 20,
      overflow: "hidden",
    },
    glassLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderTopLeftRadius: 27, borderTopRightRadius: 27 },
    glassSurface: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderTopLeftRadius: 27, borderTopRightRadius: 27 },
    glassFallback: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: light ? colors.surface : "rgba(25,23,21,0.92)" },
    warmTint: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: light ? "transparent" : "rgba(39,33,27,0.34)" },
    sheetContent: { flex: 1, minHeight: 0 },
    dragCue: { height: 28, alignItems: "center", justifyContent: "flex-start", paddingTop: 1 },
    grip: { width: 36, height: 4, borderRadius: 2, backgroundColor: light ? "rgba(24,23,20,0.35)" : "rgba(244,240,230,0.72)" },
    scroll: { flexGrow: 0, flexShrink: 1 },
    content: { paddingTop: 14, paddingBottom: 20 },
    brand: { color: colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.7, marginBottom: 8 },
    title: { color: colors.bone, fontSize: 24, lineHeight: 30, fontWeight: "800" },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 9, marginTop: 6, marginBottom: 14 },
    price: { color: colors.success, fontSize: 19, fontWeight: "800", fontVariant: ["tabular-nums"] },
    originalPrice: { color: light ? colors.muted : "rgba(244,240,230,0.63)", fontSize: 14, fontWeight: "600", textDecorationLine: "line-through" },
    factSummary: { color: colors.bone, fontSize: 12, lineHeight: 19 },
    factLabel: { color: light ? colors.muted : "rgba(244,240,230,0.62)", fontWeight: "600" },
    factValue: { color: colors.bone, fontWeight: "700" },
    factSeparator: { color: light ? colors.subtle : "rgba(244,240,230,0.38)" },
    section: { marginTop: 20 },
    sectionTitle: { color: colors.bone, fontSize: 14, fontWeight: "800", marginBottom: 9 },
    description: { color: light ? colors.muted : "rgba(244,240,230,0.84)", fontSize: 13, lineHeight: 19 },
    sellerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(30,25,20,0.55)" },
    avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.success },
    avatarInitial: { color: colors.ink, fontSize: 16, fontWeight: "900" },
    sellerInfo: { flex: 1 },
    sellerName: { color: colors.bone, fontSize: 13, fontWeight: "700" },
    sellerMeta: { color: light ? colors.muted : "rgba(244,240,230,0.69)", fontSize: 12, marginTop: 2 },
    availabilityRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 34, paddingTop: 11 },
    availabilityText: { color: light ? colors.bone : "rgba(244,240,230,0.88)", fontSize: 12, fontWeight: "600", flex: 1 },
    compactSection: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${colors.bone}18` },
    compactRow: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 4 },
    compactTitleWrap: { flexDirection: "row", alignItems: "center", gap: 9 },
    compactTitle: { color: colors.bone, fontSize: 13, fontWeight: "800" },
    compactContent: { paddingTop: 2, paddingBottom: 12 },
    compactBody: { color: light ? colors.muted : "rgba(244,240,230,0.72)", fontSize: 12, lineHeight: 19, paddingVertical: 4 },
    measurements: { paddingHorizontal: 1 },
    measurementRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 34, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(244,240,230,0.10)" },
    measurementLabel: { color: light ? colors.muted : "rgba(244,240,230,0.63)", fontSize: 12, textTransform: "capitalize" },
    measurementValue: { color: colors.bone, fontSize: 13, fontWeight: "600" },
  });
}
