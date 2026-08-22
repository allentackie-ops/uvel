import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Glass } from "./Glass";
import { usd, type Garment } from "../lib/catalog";
import { useColors } from "../lib/theme";

export function ProductCard({ garment }: { garment: Garment }) {
  const colors = useColors();
  const styles = make(colors);
  return (
    <Pressable onPress={() => router.push(`/product/${garment.id}`)} style={styles.wrap}>
      <View style={styles.frame}>
        <Image source={garment.image} style={styles.img} contentFit="cover" />
        <Glass effect="clear" style={styles.cap}>
          <Text style={styles.brand} numberOfLines={1}>
            {garment.brand}
          </Text>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {garment.name}
            </Text>
            <Text style={styles.price}>{usd(garment.priceCents)}</Text>
          </View>
        </Glass>
      </View>
    </Pressable>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    wrap: { flex: 1 },
    frame: {
      borderRadius: 22,
      overflow: "hidden",
      backgroundColor: colors.surface,
    },
    img: { width: "100%", aspectRatio: 2 / 3 },
    cap: { position: "absolute", left: 6, right: 6, bottom: 6, borderRadius: 14, padding: 10 },
    brand: { color: colors.muted, fontSize: 10 },
    row: { flexDirection: "row", justifyContent: "space-between", gap: 6, marginTop: 2 },
    name: { color: colors.bone, fontSize: 12, flex: 1, fontWeight: "500" },
    price: { color: colors.bone, fontSize: 12, fontVariant: ["tabular-nums"] },
  });
}
