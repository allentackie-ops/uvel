import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMemo } from "react";
import { Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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
  const originCode = piece.country || buyerCountry;
  const origin = getMarket(originCode);
  const availability = shipsToLine(originCode, piece.shipsTo);
  const size = piece.sizes?.filter(Boolean).join(" · ") || piece.size || "Not listed";
  const facts = [
    { label: "Condition", value: piece.condition || "Not listed" },
    { label: "Size", value: size },
    { label: "Color", value: piece.color || "Not listed" },
    { label: "Material", value: piece.material || "Not listed" },
    { label: "Category", value: piece.category || "Not listed" },
  ];
  const measurements = Object.entries(piece.measurements || {}).filter(([, value]) => Boolean(value));
  const sheetHeight = Math.min(windowHeight - insets.top - 10, Math.max(windowHeight * 0.76, 390));

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <AccessiblePressable
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close listing details"
          accessibilityHint="Double tap to return to immersive shopping."
        >
          <View style={styles.backdrop} />
        </AccessiblePressable>
        <View
          style={[styles.sheet, { height: sheetHeight, paddingBottom: Math.max(insets.bottom + 14, 20) }]}
          accessibilityViewIsModal
        >
          <View style={styles.grip} />
          <View style={styles.header}>
            <Text style={styles.headerLabel}>LISTING DETAILS</Text>
            <AccessiblePressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close listing details"
            >
              <Ionicons name="close" size={22} color={colors.bone} />
            </AccessiblePressable>
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

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>The details</Text>
              <View style={styles.factGrid}>
                {facts.map((fact) => (
                  <View key={fact.label} style={styles.factCard}>
                    <Text style={styles.factLabel}>{fact.label}</Text>
                    <Text style={styles.factValue} numberOfLines={2}>{fact.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {piece.notes?.trim() ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About this piece</Text>
                <Text style={styles.description}>{piece.notes.trim()}</Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Seller & availability</Text>
              <View style={styles.sellerCard}>
                {sellerPhoto ? (
                  <Image source={{ uri: sellerPhoto }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{(sellerName[0] || "U").toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.sellerInfo}>
                  <Text style={styles.sellerLabel}>SOLD BY</Text>
                  <Text style={styles.sellerName} numberOfLines={1}>{sellerName}</Text>
                  <Text style={styles.sellerMeta}>Ships from {origin.name}</Text>
                </View>
              </View>
              <View style={styles.deliveryCard}>
                <Ionicons name="navigate-outline" size={17} color={colors.success} />
                <View style={styles.deliveryCopy}>
                  <Text style={styles.factLabel}>Availability</Text>
                  <Text style={styles.factValue}>{availability}</Text>
                </View>
              </View>
              {piece.shippingMethod ? (
                <Text style={styles.shippingNote}>
                  Delivery: {piece.shippingMethod === "pickup" ? "Local pickup" : "Seller drop-off"}
                </Text>
              ) : null}
              {typeof piece.shippingBuyerPays === "boolean" ? (
                <Text style={styles.shippingNote}>
                  Shipping paid by {piece.shippingBuyerPays ? "the buyer" : "the seller"}
                </Text>
              ) : null}
            </View>

            {measurements.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Measurements</Text>
                <View style={styles.measurements}>
                  {measurements.map(([label, value]) => (
                    <View key={label} style={styles.measurementRow}>
                      <Text style={styles.factLabel}>{label.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ")}</Text>
                      <Text style={styles.factValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: "flex-end" },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.58)" },
    sheet: {
      width: "100%",
      backgroundColor: colors.ink,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.surface,
      paddingTop: 9,
      paddingHorizontal: 20,
      overflow: "hidden",
    },
    grip: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: colors.subtle, marginBottom: 10 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 38, marginBottom: 2 },
    headerLabel: { color: colors.subtle, fontSize: 10, fontWeight: "800", letterSpacing: 1.8 },
    closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    scroll: { flex: 1 },
    content: { paddingTop: 5, paddingBottom: 16 },
    brand: { color: colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.7, marginBottom: 6 },
    title: { color: colors.bone, fontSize: 25, lineHeight: 31, fontWeight: "800" },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 9, marginTop: 6, marginBottom: 18 },
    price: { color: colors.success, fontSize: 19, fontWeight: "800", fontVariant: ["tabular-nums"] },
    originalPrice: { color: colors.subtle, fontSize: 14, fontWeight: "600", textDecorationLine: "line-through" },
    section: { marginBottom: 17 },
    sectionTitle: { color: colors.bone, fontSize: 15, fontWeight: "800", marginBottom: 9 },
    factGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    factCard: { width: "48%", minHeight: 61, borderRadius: 13, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" },
    factLabel: { color: colors.subtle, fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
    factValue: { color: colors.bone, fontSize: 13, lineHeight: 18, fontWeight: "600", marginTop: 3 },
    description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
    sellerCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 15, padding: 12, backgroundColor: colors.surface },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.ink },
    avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.success },
    avatarInitial: { color: colors.ink, fontSize: 18, fontWeight: "900" },
    sellerInfo: { flex: 1 },
    sellerLabel: { color: colors.subtle, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
    sellerName: { color: colors.bone, fontSize: 14, fontWeight: "700", marginTop: 3 },
    sellerMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
    deliveryCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 13, padding: 12, marginTop: 8, backgroundColor: colors.surface },
    deliveryCopy: { flex: 1 },
    shippingNote: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8, marginLeft: 3 },
    measurements: { backgroundColor: colors.surface, borderRadius: 13, paddingHorizontal: 13 },
    measurementRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.ink },
  });
}
