import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usd } from "../lib/catalog";
import { getMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";
import type { ClosetPiece } from "../lib/wardrobe";

export function ListingCard({ piece, wide }: { piece: ClosetPiece; wide?: number }) {
  const colors = useColors();
  const styles = make(colors);
  const { country } = useUvel();
  const here = getMarket(country);
  const from = getMarket(piece.country || country);
  const local = from.code === here.code;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/closet/[id]", params: { id: piece.id, v: "buy" } })}
      style={[styles.wrap, wide ? { width: wide } : null]}
    >
      <Image source={{ uri: piece.photo }} style={styles.img} contentFit="cover" />
      <Text style={styles.brand} numberOfLines={1}>
        {local ? (piece.brand === "Unlabeled" ? "Uvel" : piece.brand) : from.name}
      </Text>
      <Text style={styles.name} numberOfLines={2}>
        {piece.name}
      </Text>
      <Text style={styles.price}>{usd(piece.listPriceCents, piece.currency || "USD")}</Text>
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
    brand: { color: colors.subtle, fontSize: 11, marginTop: 8, letterSpacing: 0.4 },
    name: { color: colors.bone, fontSize: 14, fontWeight: "600", marginTop: 3, lineHeight: 18 },
    price: { color: colors.bone, fontSize: 15, fontWeight: "700", marginTop: 4 },
  });
}

export function ListingEmpty({ copy }: { copy: string }) {
  const colors = useColors();
  return (
    <View style={{ paddingHorizontal: 4, paddingVertical: 12 }}>
      <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>{copy}</Text>
    </View>
  );
}
