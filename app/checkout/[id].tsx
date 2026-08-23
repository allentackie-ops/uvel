import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { payMethods, shippingCents, uvelFeeCents } from "../../lib/fees";
import { convertCents, getMarket, moneyExact } from "../../lib/markets";
import { loadAddress, placeOrder, type Address } from "../../lib/orders";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { getPiece, markSold, useWardrobe } from "../../lib/wardrobe";

export default function Checkout() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  useWardrobe();
  const piece = getPiece(id);
  const app = useUvel();
  const market = getMarket(app.country);
  const methods = payMethods(market.code);
  const [address, setAddress] = useState<Address | null>(null);
  const [ship, setShip] = useState<"standard" | "express">("standard");
  const [pay, setPay] = useState(methods[0]?.id ?? "apple");
  const [paying, setPaying] = useState(false);
  const [feeInfo, setFeeInfo] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void loadAddress().then(setAddress);
    }, []),
  );

  if (!piece) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 24, paddingHorizontal: 20 }]}>
        <Text style={{ color: colors.muted }}>That listing isn’t here.</Text>
      </View>
    );
  }

  const currency = piece.currency || "USD";
  const item = piece.listPriceCents;
  const itemLocal = convertCents(item, currency, market);
  const fee = uvelFeeCents(item, currency, market);
  const same = Boolean(address && address.country === (piece.country || market.code));
  const shipCost = address ? shippingCents(same, ship === "express", market) : 0;
  const total = itemLocal + fee + shipCost;
  const method = methods.find((m) => m.id === pay) ?? methods[0];
  const ready = Boolean(address) && !paying && piece.status === "listed";

  async function payNow() {
    if (!address || !piece) return;
    setPaying(true);
    try {
      const order = await placeOrder({
        pieceId: piece.id,
        pieceName: piece.name,
        piecePhoto: piece.photo,
        buyerId: app.uid || "me",
        sellerId: piece.ownerId || "seller",
        itemCents: itemLocal,
        feeCents: fee,
        shipCents: shipCost,
        taxCents: 0,
        totalCents: total,
        currency: market.currency,
        country: market.code,
        payMethod: method.label,
        delivery: ship,
        address,
      });
      markSold(piece.id);
      router.replace({ pathname: "/order/[id]", params: { id: order.id } });
    } catch (e) {
      Alert.alert("Payment", e instanceof Error ? e.message : "Couldn’t complete that.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn}>
          <Text style={styles.navBack}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>Checkout</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
        <Text style={styles.h}>Address</Text>
        <Pressable onPress={() => router.push("/address")} style={styles.box}>
          {address ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.boxT}>{address.name}</Text>
              <Text style={styles.boxS}>
                {address.line1}, {address.city}
              </Text>
            </View>
          ) : (
            <Text style={styles.boxT}>Add your shipping address</Text>
          )}
          <Text style={styles.plus}>{address ? "Edit" : "+"}</Text>
        </Pressable>

        <Text style={styles.h}>Delivery option</Text>
        {address ? (
          <View style={styles.col}>
            <Pressable
              onPress={() => setShip("standard")}
              style={[styles.ship, ship === "standard" && styles.shipOn]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.boxT}>Standard</Text>
                <Text style={styles.boxS}>{same ? "3–5 business days" : "7–12 business days"}</Text>
              </View>
              <Text style={styles.boxT}>{moneyExact(shippingCents(same, false, market), market.currency)}</Text>
            </Pressable>
            <Pressable onPress={() => setShip("express")} style={[styles.ship, ship === "express" && styles.shipOn]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.boxT}>Express</Text>
                <Text style={styles.boxS}>{same ? "1–2 business days" : "3–6 business days"}</Text>
              </View>
              <Text style={styles.boxT}>{moneyExact(shippingCents(same, true, market), market.currency)}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.box}>
            <Text style={styles.dim}>Add your address to see delivery options.</Text>
          </View>
        )}

        <Text style={styles.h}>Payment</Text>
        <View style={styles.col}>
          {methods.map((m) => (
            <Pressable key={m.id} onPress={() => setPay(m.id)} style={[styles.box, pay === m.id && styles.boxOn]}>
              <View style={styles.payMark}>
                <Text style={styles.payMarkTxt}>{m.kind === "apple" ? " " : m.label.slice(0, 1)}</Text>
              </View>
              <Text style={styles.boxT}>{m.label}</Text>
              {pay === m.id ? <Text style={styles.tick}>✓</Text> : null}
            </Pressable>
          ))}
        </View>

        <Text style={styles.h}>Order summary</Text>
        <View style={styles.sum}>
          <View style={styles.item}>
            <Image source={{ uri: piece.photo }} style={styles.thumb} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemN} numberOfLines={1}>
                {piece.name}
              </Text>
              <Text style={styles.itemM}>{piece.brand === "Unlabeled" ? "Uvel" : piece.brand}</Text>
              <Text style={styles.itemM}>{[piece.size, piece.color].filter(Boolean).join(" / ")}</Text>
            </View>
            <Text style={styles.itemP}>{moneyExact(item, currency)}</Text>
          </View>

          <View style={styles.line}>
            <Pressable onPress={() => setFeeInfo(true)} style={styles.feeL}>
              <Text style={styles.lineL}>Uvel fee</Text>
              <Text style={styles.info}>i</Text>
            </Pressable>
            <Text style={styles.lineV}>{moneyExact(fee, market.currency)}</Text>
          </View>
          <View style={styles.line}>
            <Text style={styles.lineL}>Shipping</Text>
            <Text style={styles.lineV}>{moneyExact(shipCost, market.currency)}</Text>
          </View>
          <View style={styles.line}>
            <Text style={styles.lineL}>Sales tax</Text>
            <Text style={styles.muted}>To be confirmed</Text>
          </View>
          <Pressable onPress={() => setFeeInfo(true)}>
            <Text style={styles.protect}>Uvel protects every purchase.</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalL}>Total to pay</Text>
          <Text style={styles.totalV}>{moneyExact(total, market.currency)}</Text>
        </View>
        <Pressable onPress={() => void payNow()} disabled={!ready} style={[styles.payBtn, !ready && { opacity: 0.4 }]}>
          <Text style={styles.payTxt}>
            {paying ? "Paying…" : method?.kind === "apple" ? "Apple Pay" : `Pay with ${method?.label}`}
          </Text>
        </Pressable>
        <Text style={styles.lock}>Your payment details are encrypted and secure</Text>
      </View>

      {feeInfo ? (
        <Pressable style={styles.veil} onPress={() => setFeeInfo(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetH}>Uvel fee</Text>
            <Text style={styles.sheetP}>
              Buyer protection. Under $50 it’s $0.99, from $50 it’s $2.99, from $150 it’s $4.99, from $500 it’s $6.99,
              and $1,000+ is $8.99 — shown here in {market.currency}. The seller gets the full listing price. You get
              purchase protection on Uvel.
            </Text>
            <Pressable onPress={() => setFeeInfo(false)} style={styles.sheetBtn}>
              <Text style={styles.sheetBtnT}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    nav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 6,
      paddingBottom: 8,
    },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navBack: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    navTitle: { color: colors.bone, fontSize: 17, fontWeight: "600" },
    h: { color: colors.bone, fontSize: 18, fontWeight: "700", marginTop: 22, marginBottom: 10, paddingHorizontal: 20 },
    box: {
      marginHorizontal: 20,
      minHeight: 54,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.18)",
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    boxOn: { borderColor: "#D6E27A" },
    boxT: { color: colors.bone, fontSize: 15, flex: 1, fontWeight: "500" },
    boxS: { color: colors.muted, fontSize: 13, marginTop: 2 },
    dim: { color: colors.subtle, fontSize: 15, paddingVertical: 16 },
    plus: { color: colors.muted, fontSize: 15 },
    col: { gap: 10, paddingHorizontal: 20 },
    ship: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.18)",
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    shipOn: { borderColor: "#D6E27A" },
    payMark: {
      width: 36,
      height: 24,
      borderRadius: 4,
      backgroundColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
    payMarkTxt: { color: "#111", fontWeight: "800", fontSize: 11 },
    tick: { color: "#D6E27A", fontWeight: "700" },
    sum: { paddingHorizontal: 20, paddingTop: 4 },
    item: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 12 },
    thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.surface },
    itemN: { color: colors.bone, fontSize: 15, fontWeight: "600" },
    itemM: { color: colors.muted, fontSize: 13, marginTop: 2 },
    itemP: { color: colors.bone, fontSize: 15 },
    line: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
    feeL: { flexDirection: "row", alignItems: "center", gap: 8 },
    lineL: { color: colors.bone, fontSize: 15 },
    lineV: { color: colors.bone, fontSize: 15 },
    info: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.muted,
      textAlign: "center",
      fontSize: 10,
      lineHeight: 14,
      color: colors.muted,
      overflow: "hidden",
    },
    muted: { color: colors.muted, fontSize: 15 },
    protect: { color: "#8EB4FF", fontSize: 14, textDecorationLine: "underline", marginTop: 8 },
    dock: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.ink,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "rgba(244,240,230,0.12)",
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
    totalL: { color: colors.bone, fontSize: 17, fontWeight: "700" },
    totalV: { color: colors.bone, fontSize: 17, fontWeight: "700" },
    payBtn: {
      height: 52,
      borderRadius: 10,
      backgroundColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
    payTxt: { color: "#111", fontSize: 17, fontWeight: "700" },
    lock: { color: colors.subtle, textAlign: "center", fontSize: 11, marginTop: 10 },
    veil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 22,
    },
    sheetH: { color: colors.bone, fontFamily: "Georgia", fontSize: 24 },
    sheetP: { color: colors.muted, marginTop: 10, lineHeight: 22, fontSize: 15 },
    sheetBtn: {
      marginTop: 18,
      height: 48,
      borderRadius: 24,
      backgroundColor: "#D6E27A",
      alignItems: "center",
      justifyContent: "center",
    },
    sheetBtnT: { color: "#16140F", fontWeight: "700" },
  });
}
