import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [contentHeight, setContentHeight] = useState(0);
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
  const bottomPadding = Math.max(insets.bottom + 10, 16);
  const sheetChrome = 36 + 8 + bottomPadding;
  const maxSheetHeight = windowHeight - insets.top - 10;
  const maxScrollHeight = Math.max(150, maxSheetHeight - sheetChrome);
  const fallbackScrollHeight = Math.min(maxScrollHeight, windowHeight * 0.4);
  const scrollHeight = Math.min(maxScrollHeight, contentHeight || fallbackScrollHeight);
  const sheetHeight = scrollHeight + sheetChrome;

  useEffect(() => {
    if (visible) dragY.setValue(0);
  }, [visible, dragY]);

  useEffect(() => {
    setContentHeight(0);
  }, [piece.id]);

  const dismissPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_event, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => dragY.stopAnimation(),
    onPanResponderMove: (_event, gesture) => dragY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 72 || gesture.vy > 0.62) {
        RNAnimated.timing(dragY, { toValue: sheetHeight, duration: 170, useNativeDriver: true }).start(({ finished }) => {
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
          {...dismissPan.panHandlers}
          style={[
            styles.sheet,
            { height: sheetHeight, paddingBottom: bottomPadding },
            { transform: [{ translateY: dragY }] },
          ]}
          accessibilityViewIsModal
        >
          <View pointerEvents="none" style={styles.glassLayer}>
            {Platform.OS === "ios" ? <GlassView glassEffectStyle="regular" colorScheme="dark" style={styles.glassSurface} /> : <View style={styles.glassFallback} />}
            <View style={styles.warmTint} />
          </View>
          <View style={styles.sheetContent}>
            <View style={styles.dragCue} accessible accessibilityLabel="Swipe down to dismiss listing details" />
            <ScrollView
              style={[styles.scroll, { height: scrollHeight, maxHeight: maxScrollHeight }]}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={(_width, height) => {
                setContentHeight((current) => Math.abs(current - height) > 1 ? height : current);
              }}
            >
              <Text style={styles.brand}>{brandLabel.toUpperCase()}</Text>
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
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.16)" },
    sheet: {
      width: "100%",
      backgroundColor: "transparent",
      borderTopLeftRadius: 27,
      borderTopRightRadius: 27,
      borderWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: 0,
      borderColor: "rgba(244,240,230,0.14)",
      paddingTop: 8,
      paddingHorizontal: 20,
      overflow: "hidden",
    },
    glassLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderTopLeftRadius: 27, borderTopRightRadius: 27 },
    glassSurface: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderTopLeftRadius: 27, borderTopRightRadius: 27 },
    glassFallback: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: "rgba(25,23,21,0.36)" },
    warmTint: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(39,33,27,0.34)" },
    sheetContent: { flex: 1, minHeight: 0 },
    dragCue: { height: 28, alignItems: "center", justifyContent: "flex-start", paddingTop: 1 },
    grip: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(244,240,230,0.72)" },
    scroll: { flexGrow: 0, flexShrink: 1 },
    content: { paddingTop: 10, paddingBottom: 14 },
    brand: { color: colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.7, marginBottom: 5 },
    title: { color: colors.bone, fontSize: 24, lineHeight: 29, fontWeight: "800" },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 9, marginTop: 4, marginBottom: 10 },
    price: { color: colors.success, fontSize: 19, fontWeight: "800", fontVariant: ["tabular-nums"] },
    originalPrice: { color: "rgba(244,240,230,0.63)", fontSize: 14, fontWeight: "600", textDecorationLine: "line-through" },
    factSummary: { color: colors.bone, fontSize: 12, lineHeight: 19 },
    factLabel: { color: "rgba(244,240,230,0.62)", fontWeight: "600" },
    factValue: { color: colors.bone, fontWeight: "700" },
    factSeparator: { color: "rgba(244,240,230,0.38)" },
    section: { marginTop: 15 },
    sectionTitle: { color: colors.bone, fontSize: 14, fontWeight: "800", marginBottom: 7 },
    description: { color: "rgba(244,240,230,0.84)", fontSize: 13, lineHeight: 19 },
    sellerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(30,25,20,0.55)" },
    avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.success },
    avatarInitial: { color: colors.ink, fontSize: 16, fontWeight: "900" },
    sellerInfo: { flex: 1 },
    sellerName: { color: colors.bone, fontSize: 13, fontWeight: "700" },
    sellerMeta: { color: "rgba(244,240,230,0.69)", fontSize: 12, marginTop: 2 },
    availabilityRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 30, paddingTop: 8 },
    availabilityText: { color: "rgba(244,240,230,0.88)", fontSize: 12, fontWeight: "600", flex: 1 },
    measurements: { paddingHorizontal: 1 },
    measurementRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 34, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(244,240,230,0.10)" },
    measurementLabel: { color: "rgba(244,240,230,0.63)", fontSize: 12, textTransform: "capitalize" },
    measurementValue: { color: colors.bone, fontSize: 13, fontWeight: "600" },
  });
}
