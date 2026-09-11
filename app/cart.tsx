import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../lib/cart";
import { getMarket, moneyInMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { getPiece } from "../lib/wardrobe";

export default function Cart() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const cart = useCart();
  const market = getMarket(app.country);
  const rows = cart.items
    .map((item) => getPiece(item.pieceId))
    .filter((piece): piece is NonNullable<ReturnType<typeof getPiece>> => Boolean(piece));
  const total = rows.reduce((sum, piece) => sum + piece.listPriceCents, 0);

  function checkout() {
    const first = rows[0];
    if (!first) return;
    router.push({ pathname: "/checkout/[id]", params: { id: first.id } });
  }

  return (
    <View style={styles.page}>
      <View style={[styles.nav, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Close cart">
          <Ionicons name="chevron-back" size={24} color={colors.bone} />
        </Pressable>
        <Text style={styles.navTitle}>Cart</Text>
        <View style={styles.navBtn} />
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 140 }]} showsVerticalScrollIndicator={false}>
        {rows.length ? rows.map((piece) => (
          <View key={piece.id} style={styles.row}>
            <Pressable
              onPress={() => router.push({ pathname: "/checkout/[id]", params: { id: piece.id } })}
              style={styles.rowMain}
              accessibilityRole="button"
              accessibilityLabel={`Checkout ${piece.name}`}
            >
              <Image source={{ uri: piece.photo }} style={styles.thumb} contentFit="cover" />
              <View style={styles.copy}>
                <Text style={styles.brand} numberOfLines={1}>{(piece.brand && piece.brand !== "Unlabeled" ? piece.brand : "Unbranded").toUpperCase()}</Text>
                <Text style={styles.name} numberOfLines={2}>{piece.name}</Text>
                <Text style={styles.price}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => cart.remove(piece.id)} hitSlop={10} style={styles.remove} accessibilityRole="button" accessibilityLabel={`Remove ${piece.name} from cart`}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
        )) : (
          <Text style={styles.empty}>Your cart is empty.</Text>
        )}
      </ScrollView>
      {rows.length ? (
        <View style={[styles.dock, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.totalRow}>
            <Text style={styles.totalL}>{rows.length === 1 ? "1 piece" : `${rows.length} pieces`}</Text>
            <Text style={styles.totalV}>{moneyInMarket(total, market.currency, market)}</Text>
          </View>
          <Pressable onPress={checkout} style={styles.pay} accessibilityRole="button" accessibilityLabel="Checkout">
            <Text style={styles.payText}>Checkout</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.successInk} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    nav: { paddingHorizontal: 10, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navTitle: { color: colors.bone, fontSize: 16, fontWeight: "700" },
    body: { paddingHorizontal: 20, paddingTop: 8 },
    row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: `${colors.bone}18` },
    rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
    thumb: { width: 72, height: 90, borderRadius: 12, backgroundColor: colors.surface },
    copy: { flex: 1, minWidth: 0 },
    brand: { color: `${colors.bone}6B`, fontSize: 11, fontWeight: "700", letterSpacing: 1.1 },
    name: { color: colors.bone, fontSize: 16, fontWeight: "700", marginTop: 4 },
    price: { color: colors.success, fontSize: 15, fontWeight: "800", marginTop: 6, fontVariant: ["tabular-nums"] },
    remove: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    empty: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 24 },
    dock: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: `${colors.bone}18`, backgroundColor: colors.ink },
    totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    totalL: { color: colors.muted, fontSize: 14, fontWeight: "700" },
    totalV: { color: colors.bone, fontSize: 18, fontWeight: "800", fontVariant: ["tabular-nums"] },
    pay: { minHeight: 54, borderRadius: 27, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    payText: { color: colors.successInk, fontSize: 16, fontWeight: "800" },
  });
}
