import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { usd, type Garment } from "../lib/catalog";
import { useColors } from "../lib/theme";

export function ProductCard({ garment }: { garment: Garment }) {
  const colors = useColors();
  const styles = make(colors);
  return (
    <Pressable onPress={() => router.push(`/product/${garment.id}`)} style={styles.wrap}>
      <Image source={garment.image} style={styles.img} contentFit="cover" />
      <Text style={styles.brand} numberOfLines={1}>
        {garment.brand}
      </Text>
      <Text style={styles.name} numberOfLines={2}>
        {garment.name}
      </Text>
      <Text style={styles.price}>{usd(garment.priceCents)}</Text>
    </Pressable>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    wrap: { flex: 1 },
    img: {
      width: "100%",
      aspectRatio: 3 / 4,
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    brand: {
      color: colors.subtle,
      fontSize: 11,
      marginTop: 8,
      letterSpacing: 0.4,
    },
    name: { color: colors.bone, fontSize: 14, fontWeight: "600", marginTop: 3, lineHeight: 18 },
    price: { color: colors.bone, fontSize: 15, fontWeight: "700", marginTop: 4 },
  });
}
