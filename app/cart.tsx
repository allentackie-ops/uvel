import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FriendShareSheet, type FriendSharePayload } from "../components/FriendShareSheet";
import { restoreToCart, useCart, type CartItem } from "../lib/cart";
import { useFirstFind } from "../lib/firstFind";
import { convertCents, getMarket, moneyInMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { getPiece, useWardrobe } from "../lib/wardrobe";

type Removed = { item: CartItem; index: number; name: string };

export default function Cart() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const cart = useCart();
  useWardrobe();
  const find = useFirstFind();
  const market = getMarket(app.country);
  const rows = cart.items
    .map((item) => getPiece(item.pieceId))
    .filter((piece): piece is NonNullable<ReturnType<typeof getPiece>> => Boolean(piece));
  const priced = (() => {
    let leftover = find.remaining;
    return rows.map((piece) => {
      const local = convertCents(piece.listPriceCents, piece.currency || market.currency, market);
      const credit = leftover > 0 && find.matches(piece) ? Math.min(local, leftover) : 0;
      leftover -= credit;
      return { piece, local, credit, sale: Math.max(0, local - credit) };
    });
  })();
  const total = priced.reduce((sum, row) => sum + row.sale, 0);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const toastY = useRef(new Animated.Value(-28)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  function showRemovedToast(next: Removed) {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setRemoved(next);
    toastY.setValue(-28);
    toastOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(toastY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 260 }),
      Animated.timing(toastOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
    hideTimer.current = setTimeout(() => dismissToast(), 5200);
  }

  function dismissToast() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
    Animated.parallel([
      Animated.timing(toastY, { toValue: -24, duration: 180, useNativeDriver: true }),
      Animated.timing(toastOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setRemoved(null));
  }

  function removePiece(pieceId: string, name: string) {
    const index = cart.items.findIndex((item) => item.pieceId === pieceId);
    const item = cart.items[index];
    if (!item) return;
    cart.remove(pieceId);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    showRemovedToast({ item, index: Math.max(0, index), name });
  }

  function undoRemove() {
    if (!removed) return;
    restoreToCart(removed.item, removed.index);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    dismissToast();
  }

  function checkout() {
    if (!rows.length) return;
    router.push({
      pathname: "/checkout/[id]",
      params: { id: rows[0].id, ids: rows.map((piece) => piece.id).join(",") },
    });
  }

  const bagNames = priced.map(({ piece }) => piece.name);
  const sharePayload: FriendSharePayload | null = priced.length
    ? {
        kind: "listing",
        id: priced[0].piece.id,
        title: priced.length === 1 ? priced[0].piece.name : "My bag on Uvel",
        deepLink: priced.length === 1 ? `uvel://piece/${priced[0].piece.id}` : "uvel://cart",
        imageUri: priced[0].piece.photo,
        previewText: priced.length === 1
          ? `Have a look at ${priced[0].piece.name} in my bag on Uvel.`
          : `Have a look at my bag on Uvel.\n${bagNames.map((name) => `• ${name}`).join("\n")}`,
      }
    : null;

  return (
    <View style={styles.page}>
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Close bag">
          <Text style={styles.navBack}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>Your bag</Text>
        {sharePayload ? (
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              setShareOpen(true);
            }}
            hitSlop={10}
            style={styles.navBtn}
            accessibilityRole="button"
            accessibilityLabel="Share bag"
          >
            <Ionicons name="share-outline" size={22} color={colors.bone} />
          </Pressable>
        ) : (
          <View style={styles.navBtn} />
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 160 }]} showsVerticalScrollIndicator={false}>
        {rows.length ? (
          <>
            <Text style={styles.kicker}>{rows.length === 1 ? "1 PIECE" : `${rows.length} PIECES`}</Text>
            <Text style={styles.heading}>{rows.length === 1 ? "Ready when you are." : "Everything you picked."}</Text>
            {priced.map(({ piece, local, credit, sale }) => {
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
                    {credit > 0 ? (
                      <View style={styles.priceRow}>
                        <Text style={styles.was}>{moneyInMarket(local, market.currency, market)}</Text>
                        <Text style={[styles.price, { marginTop: 0 }]}>{moneyInMarket(sale, market.currency, market)}</Text>
                      </View>
                    ) : (
                      <Text style={styles.price}>{moneyInMarket(local, market.currency, market)}</Text>
                    )}
                    <Pressable onPress={() => removePiece(piece.id, piece.name)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${piece.name}`}>
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
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/");
              }}
              style={styles.emptyBtn}
              accessibilityRole="button"
              accessibilityLabel="Back to Today"
            >
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

      {removed ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.toastWrap, { top: insets.top + 8, opacity: toastOpacity, transform: [{ translateY: toastY }] }]}
        >
          <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Text style={styles.toastText} numberOfLines={2}>Item has been removed from cart</Text>
            <Pressable
              onPress={undoRemove}
              hitSlop={8}
              style={styles.undo}
              accessibilityRole="button"
              accessibilityLabel={`Undo removing ${removed.name}`}
            >
              <Text style={styles.undoText}>Undo</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
      {sharePayload ? (
        <FriendShareSheet
          visible={shareOpen}
          payload={sharePayload}
          onClose={() => setShareOpen(false)}
          onExternalShare={() => {
            setShareOpen(false);
            void Share.share({
              title: sharePayload.title,
              message: `${sharePayload.previewText}\n${sharePayload.deepLink}`,
            });
          }}
        />
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
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 10, flexWrap: "wrap" },
    price: { color: colors.success, fontSize: 16, fontWeight: "800", marginTop: 10, fontVariant: ["tabular-nums"] },
    was: { color: `${colors.bone}66`, fontSize: 14, fontWeight: "600", textDecorationLine: "line-through", fontVariant: ["tabular-nums"] },
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
    toastWrap: { position: "absolute", left: 16, right: 16, zIndex: 40 },
    toast: {
      minHeight: 48,
      paddingLeft: 16,
      paddingRight: 8,
      paddingVertical: 8,
      borderRadius: 24,
      backgroundColor: "#16140F",
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    toastText: { flex: 1, fontSize: 14, fontWeight: "700", color: "#F4F0E6" },
    undo: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: "#D6E27A", alignItems: "center", justifyContent: "center" },
    undoText: { color: "#16140F", fontSize: 13, fontWeight: "800" },
  });
}
