import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef } from "react";
import { GlassView } from "expo-glass-effect";
import { Animated as RNAnimated, Modal, PanResponder, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ImageStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "./AccessiblePressable";
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
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const dragY = useRef(new RNAnimated.Value(0)).current;
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
  const measurements = Object.entries(piece.measurements || {}).filter(([, value]) => Boolean(value));
  const sheetHeight = Math.min(windowHeight - insets.top - 10, Math.max(windowHeight * 0.76, 390));

  useEffect(() => {
    if (visible) dragY.setValue(0);
  }, [visible, dragY]);

  const dismissPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 7 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => dragY.stopAnimation(),
    onPanResponderMove: (_event, gesture) => dragY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 96 || gesture.vy > 0.75) {
        RNAnimated.timing(dragY, { toValue: sheetHeight, duration: 180, useNativeDriver: true }).start(({ finished }) => {
          if (finished) onClose();
        });
      } else {
        RNAnimated.spring(dragY, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 2 }).start();
      }
    },
    onPanResponderTerminate: () => {
      RNAnimated.spring(dragY, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 2 }).start();
    },
    onPanResponderTerminationRequest: () => false,
  }), [dragY, onClose, sheetHeight]);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <AccessiblePressable
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss listing details"
          accessibilityHint="Tap outside the panel to return to immersive shopping."
        >
          <View style={styles.backdrop} />
        </AccessiblePressable>
        <RNAnimated.View
          style={[
            styles.sheet,
            { height: sheetHeight, paddingBottom: Math.max(insets.bottom + 14, 20) },
            { transform: [{ translateY: dragY }] },
          ]}
          accessibilityViewIsModal
        >
          <View pointerEvents="none" style={styles.glassLayer}>
            {Platform.OS === "ios" ? <GlassView glassEffectStyle="regular" colorScheme="dark" style={styles.glassSurface} /> : <View style={styles.glassFallback} />}
            <View style={styles.warmTint} />
          </View>
          <View style={styles.sheetContent}>
            <View
              {...dismissPan.panHandlers}
              style={styles.dragCue}
              accessible
              accessibilityLabel="Swipe down to close listing details"
              accessibilityHint="Swipe down from the handle to dismiss this panel."
            >
              <View style={styles.grip} />
              <Text style={styles.swipeHint}>Swipe down to close</Text>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.brand}>{brandLabel.toUpperCase()}</Text>
              <Text style={styles.title}>{piece.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{price}</Text>
                {originalPrice ? <Text style={styles.originalPrice}>{originalPrice}</Text> : null}
              </View>

              {facts.length ? (
                <View style={styles.factGrid}>
                  {facts.map((fact) => (
                    <View key={fact.label} style={styles.factChip}>
                      <Text style={styles.factLabel}>{fact.label}</Text>
                      <Text style={styles.factValue} numberOfLines={2}>{fact.value}</Text>
                    </View>
                  ))}
                </View>
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
                  <Ionicons name="navigate-outline" size={18} color={colors.success} />
                  <Text style={styles.availabilityText}>{availability}</Text>
                </View>
              </View>

              {measurements.length ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Measurements</Text>
                  <View style={styles.measurements}>
                    {measurements.map(([label, value]) => (
                      <View key={label} style={styles.measurementRow}>
                        <Text style={styles.measurementLabel}>{label.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ")}</Text>
                        <Text style={styles.measurementValue}>{value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </RNAnimated.View>
      </View>
    </Modal>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: "flex-end" },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.34)" },
    sheet: {
      width: "100%",
      backgroundColor: "transparent",
      borderTopLeftRadius: 27,
      borderTopRightRadius: 27,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: "rgba(218,184,143,0.38)",
      paddingTop: 8,
      paddingHorizontal: 20,
      overflow: "hidden",
    },
    glassLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderTopLeftRadius: 27, borderTopRightRadius: 27 },
    glassSurface: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderTopLeftRadius: 27, borderTopRightRadius: 27 },
    glassFallback: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: "rgba(43,30,21,0.48)" },
    warmTint: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(53,37,25,0.76)" },
    sheetContent: { flex: 1, minHeight: 0 },
    dragCue: { minHeight: 45, alignItems: "center", justifyContent: "flex-start", paddingTop: 1 },
    grip: { width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(244,240,230,0.74)" },
    swipeHint: { color: "rgba(244,240,230,0.62)", fontSize: 11, fontWeight: "600", marginTop: 6, letterSpacing: 0.15 },
    scroll: { flex: 1 },
    content: { paddingTop: 11, paddingBottom: 16 },
    brand: { color: colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.7, marginBottom: 6 },
    title: { color: colors.bone, fontSize: 25, lineHeight: 31, fontWeight: "800" },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 9, marginTop: 5, marginBottom: 15 },
    price: { color: colors.success, fontSize: 19, fontWeight: "800", fontVariant: ["tabular-nums"] },
    originalPrice: { color: "rgba(244,240,230,0.63)", fontSize: 14, fontWeight: "600", textDecorationLine: "line-through" },
    factGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    factChip: { minHeight: 52, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(226,194,154,0.20)", backgroundColor: "rgba(33,29,25,0.54)", paddingHorizontal: 11, paddingVertical: 8, justifyContent: "center" },
    factLabel: { color: "rgba(244,240,230,0.58)", fontSize: 9, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
    factValue: { color: colors.bone, fontSize: 13, lineHeight: 17, fontWeight: "600", marginTop: 2 },
    section: { marginTop: 18 },
    sectionTitle: { color: colors.bone, fontSize: 15, fontWeight: "800", marginBottom: 8 },
    description: { color: "rgba(244,240,230,0.82)", fontSize: 14, lineHeight: 21 },
    sellerRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 2 },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(30,25,20,0.65)" },
    avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.success },
    avatarInitial: { color: colors.ink, fontSize: 17, fontWeight: "900" },
    sellerInfo: { flex: 1 },
    sellerName: { color: colors.bone, fontSize: 14, fontWeight: "700" },
    sellerMeta: { color: "rgba(244,240,230,0.67)", fontSize: 12, marginTop: 3 },
    availabilityRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(226,194,154,0.16)", backgroundColor: "rgba(33,29,25,0.42)", paddingHorizontal: 13, marginTop: 10 },
    availabilityText: { color: colors.bone, fontSize: 13, fontWeight: "600", flex: 1 },
    measurements: { backgroundColor: "rgba(33,29,25,0.38)", borderRadius: 13, paddingHorizontal: 13 },
    measurementRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 39, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(244,240,230,0.12)" },
    measurementLabel: { color: "rgba(244,240,230,0.63)", fontSize: 12, textTransform: "capitalize" },
    measurementValue: { color: colors.bone, fontSize: 13, fontWeight: "600" },
  });
}
