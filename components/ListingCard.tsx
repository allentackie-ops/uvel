import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usd } from "../lib/catalog";
import { getMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";
import type { ClosetPiece } from "../lib/wardrobe";

export function ListingCard({
  piece,
  wide,
  badge,
  framed,
}: {
  piece: ClosetPiece;
  wide?: number;
  badge?: string;
  framed?: boolean;
}) {
  const colors = useColors();
  const styles = make(colors);
  const { country } = useUvel();
  const here = getMarket(country);
  const from = getMarket(piece.country || country);
  const local = from.code === here.code;
  const brand = local ? (piece.brand === "Unlabeled" ? "Uvel" : piece.brand) : from.name;
  const fresh = Date.now() - (piece.createdAt || 0) < 1000 * 60 * 60 * 48;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/closet/[id]", params: { id: piece.id, v: "buy" } })}
      style={[styles.wrap, wide ? { width: wide, flex: undefined } : null, framed && styles.framed]}
    >
      <View>
        <Image
          source={{ uri: piece.photo }}
          style={[styles.img, wide ? { width: wide, borderRadius: framed ? 0 : 18 } : null, framed && styles.framedImg]}
          contentFit="cover"
        />
        {framed && fresh ? (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeTxt}>New</Text>
          </View>
        ) : null}
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={framed ? styles.framedMeta : undefined}>
        <Text style={[styles.brand, framed && styles.brandFramed]} numberOfLines={1}>
          {brand.toUpperCase()}
        </Text>
        <Text style={[styles.name, framed && styles.nameFramed]} numberOfLines={2}>
          {piece.name}
        </Text>
        <Text style={[styles.price, framed && styles.priceFramed]}>{usd(piece.listPriceCents, piece.currency || "USD")}</Text>
      </View>
    </Pressable>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    wrap: { flex: 1 },
    framed: {
      backgroundColor: "#161512",
      borderRadius: 18,
      overflow: "hidden",
    },
    img: {
      width: "100%",
      aspectRatio: 3 / 4,
      borderRadius: 18,
      backgroundColor: colors.surface,
    },
    framedImg: { borderRadius: 0, backgroundColor: "#1A1915" },
    newBadge: {
      position: "absolute",
      top: 10,
      left: 10,
      backgroundColor: "rgba(18,17,14,0.78)",
      paddingHorizontal: 10,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    newBadgeTxt: { color: "#F4F0E6", fontSize: 11, fontWeight: "700" },
    badge: {
      position: "absolute",
      left: 10,
      bottom: 10,
      backgroundColor: "rgba(244,240,230,0.94)",
      paddingHorizontal: 12,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeTxt: { color: "#16140F", fontWeight: "700", fontSize: 12 },
    framedMeta: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
    brand: { color: colors.subtle, fontSize: 11, marginTop: 8, letterSpacing: 0.4 },
    brandFramed: { marginTop: 0, letterSpacing: 1.3, fontWeight: "700", color: "rgba(244,240,230,0.42)" },
    name: { color: colors.bone, fontSize: 14, fontWeight: "600", marginTop: 3, lineHeight: 18 },
    nameFramed: { color: "#F4F0E6", marginTop: 4 },
    price: { color: colors.bone, fontSize: 15, fontWeight: "700", marginTop: 4 },
    priceFramed: { color: "#F4F0E6" },
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
