import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../lib/cart";
import { getMarket, moneyInMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { getPiece, useWardrobe } from "../lib/wardrobe";

export default function Cart() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const cart = useCart();
  useWardrobe();
  const market = getMarket(app.country);
  const rows = cart.items
    .map((item) => getPiece(item.pieceId))
    .filter((piece): piece is NonNullable<ReturnType<typeof getPiece>> => Boolean(piece));
  const total = rows.reduce((sum, piece) => sum + piece.listPriceCents, 0);

  function checkout() {
    if (!rows.length) return;
    router.push({
      pathname: "/checkout/[id]",
      params: { id: rows[0].id, ids: rows.map((piece) => piece.id).join(",") },
    });
  }

  return (
    <View style={styles.page}>
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Close bag">
          <Text style={styles.navBack}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>Your bag</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 160 }]} showsVerticalScrollIndicator={false}>
        {rows.length ? (
          <>
            <Text style={styles.kicker}>{rows.length === 1 ? "1 PIECE" : `${rows.length} PIECES`}</Text>
            <Text style={styles.heading}>{rows.length === 1 ? "Ready when you are." : "Everything you picked."}</Text>
            {rows.map((piece) => {
              const brand = piece.brand && piece.brand !== "Unlabeled" ? piece.brand : "Unbranded";
              return (
                <View key={piece.id} style={styles.card}>
                  <Image source={{ uri: piece.photo }} style={styles.thumb} contentFit="cover" />
                  <View style={styles.copy}>
                    <Text style={styles.brand} numberOfLines={1}>{brand.toUpperCase()}</Text>
                    <Text style={styles.name} numberOfLines={2}>{piece.name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {[piece.size || piece.sizes?.[0] || "One size", piece.color, piece.condition].filter(Boolean).join("  ·  ")}
                    </Text>
                    <Text style={styles.price}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>
                    <Pressable onPress={() => cart.remove(piece.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${piece.name}`}>
                      <Text style={styles.remove}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={styles.heading}>Your bag is empty.</Text>
            <Text style={styles.empty}>Add pieces from Today. They’ll wait here until you’re ready to check out.</Text>
            <Pressable onPress={() => router.replace("/")} style={styles.emptyBtn} accessibilityRole="button" accessibilityLabel="Back to Today">
              <Text style={styles.emptyBtnText}>Back to Today</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {rows.length ? (
        <View style={[styles.dock, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.totalRow}>
            <Text style={styles.totalL}>{rows.length === 1 ? "1 piece" : `${rows.length} pieces`}</Text>
            <Text style={styles.totalV}>{moneyInMarket(total, market.currency, market)}</Text>
          </View>
          <Text style={styles.totalHint}>Buyer protection and shipping are added at checkout.</Text>
          <Pressable onPress={checkout} style={styles.pay} accessibilityRole="button" accessibilityLabel={`Checkout ${rows.length} ${rows.length === 1 ? "piece" : "pieces"}`}>
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
    nav: { paddingHorizontal: 6, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navBack: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    navTitle: { color: colors.bone, fontSize: 17, fontWeight: "600" },
    body: { paddingHorizontal: 20, paddingTop: 8 },
    kicker: { color: colors.subtle, fontSize: 11, letterSpacing: 1.8, fontWeight: "700" },
    heading: { color: colors.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 8, marginBottom: 18 },
    card: { flexDirection: "row", gap: 14, padding: 12, borderRadius: 18, backgroundColor: colors.surface, marginBottom: 12 },
    thumb: { width: 96, height: 124, borderRadius: 12, backgroundColor: colors.ink },
    copy: { flex: 1, minWidth: 0, paddingTop: 2 },
    brand: { color: `${colors.bone}6B`, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
    name: { color: colors.bone, fontSize: 17, fontWeight: "700", marginTop: 5, lineHeight: 22 },
    meta: { color: `${colors.bone}80`, fontSize: 12, marginTop: 6 },
    price: { color: colors.success, fontSize: 16, fontWeight: "800", marginTop: 10, fontVariant: ["tabular-nums"] },
    remove: { color: `${colors.bone}88`, fontSize: 13, fontWeight: "700", marginTop: 10, textDecorationLine: "underline" },
    emptyWrap: { paddingTop: 24 },
    empty: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
    emptyBtn: { marginTop: 22, alignSelf: "flex-start", minHeight: 48, paddingHorizontal: 18, borderRadius: 24, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    emptyBtnText: { color: colors.successInk, fontSize: 15, fontWeight: "800" },
    dock: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${colors.bone}1F`, backgroundColor: colors.ink },
    totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    totalL: { color: colors.muted, fontSize: 14, fontWeight: "700" },
    totalV: { color: colors.bone, fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
    totalHint: { color: `${colors.bone}70`, fontSize: 12, marginTop: 6, marginBottom: 14 },
    pay: { minHeight: 54, borderRadius: 27, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    payText: { color: colors.successInk, fontSize: 16, fontWeight: "800" },
  });
}
