import { Image } from "expo-image";
import { router } from "expo-router";
import {  StyleSheet, Text } from "react-native";
import { AccessiblePressable } from "./AccessiblePressable";
import { usd, type Garment } from "../lib/catalog";
import { getMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";

export function ProductCard({ garment }: { garment: Garment }) {
  const colors = useColors();
  const styles = make(colors);
  const { country } = useUvel();
  const here = getMarket(country);
  const from = getMarket(garment.country);
  const local = from.code === here.code;
  return (
    <AccessiblePressable      onPress={() => router.push(`/product/${garment.id}`)}
      style={({ pressed }) => [styles.wrap, pressed && styles.focused]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${garment.name} by ${local ? garment.brand : from.name}, ${usd(garment.priceCents)}`}
      accessibilityHint="Double tap to view this listing."
    >
      <Image source={garment.image} style={styles.img} contentFit="cover" accessible={false} />
      <Text style={styles.brand} numberOfLines={1}>
        {local ? garment.brand : from.name}
      </Text>
      <Text style={styles.name} numberOfLines={2}>
        {garment.name}
      </Text>
      <Text style={styles.price}>{usd(garment.priceCents)}</Text>
    </AccessiblePressable>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    wrap: { flex: 1, borderRadius: 14 },
    focused: { borderWidth: 2, borderColor: colors.success },
    img: {
      width: "100%",
      aspectRatio: 3 / 4,
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    brand: { color: colors.subtle, fontSize: 11, marginTop: 8, letterSpacing: 0.4 },
    name: { color: colors.bone, fontSize: 14, fontWeight: "600", marginTop: 3, lineHeight: 18 },
    price: { color: colors.bone, fontSize: 15, fontWeight: "700", marginTop: 4 },
  });
}