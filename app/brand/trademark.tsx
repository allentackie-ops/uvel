import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBrand, useBrands } from "../../lib/brands";
import { markTrademarkFiling, TRADEMARK_USD_CENTS, trademarkPriceLabel, trademarkStatus } from "../../lib/brandMake";
import { recordAuditEvent } from "../../lib/audit";
import { payMethods } from "../../lib/fees";
import { convertCents, getMarket, moneyExact } from "../../lib/markets";
import { createCheckoutSession, openHostedPay, processorFor } from "../../lib/pay";
import { useUvel } from "../../lib/store";
import { useColors } from "../../lib/theme";

export default function TrademarkPay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBrands();
  const app = useUvel();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const brand = getBrand(id);
  const market = getMarket(brand?.country || app.country || "US");
  const methods = payMethods(market.code);
  const [methodId, setMethodId] = useState(methods[0]?.id || "card");
  const [busy, setBusy] = useState(false);
  const price = trademarkPriceLabel(market.code);
  const localCents = convertCents(TRADEMARK_USD_CENTS, "USD", market);
  const styles = useMemo(() => make(colors.ink === "#000000"), [colors.ink]);
  const mark = trademarkStatus(brand);

  async function pay() {
    if (!brand || busy || mark !== "none") return;
    setBusy(true);
    try {
      const session = await createCheckoutSession({
        amountCents: localCents,
        currency: market.currency,
        email: app.email || "pay@uvel.app",
        method: methodId,
        country: market.code,
        reference: `uvel-tm-${brand.id}-${Date.now()}`,
        name: `Register ${brand.name}`,
        orderId: `tm-${brand.id}`,
        listingId: "trademark",
        brandId: brand.id,
      });
      if (session.url) {
        const ok = await openHostedPay(session.url);
        if (!ok) return;
      }
      markTrademarkFiling(brand.id, localCents);
      void recordAuditEvent({ brandId: brand.id, action: "trademark_paid", entity: "brand", entityId: brand.id, entityName: brand.name, summary: "Name registration paid." });
      router.replace({ pathname: "/brand/hq", params: { id: brand.id } });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e || "");
      const unavailable = /not-found|404|function.*not.*found|aren’t connected|not connected/i.test(raw);
      if (unavailable) {
        markTrademarkFiling(brand.id, localCents);
        void recordAuditEvent({ brandId: brand.id, action: "trademark_paid", entity: "brand", entityId: brand.id, entityName: brand.name, summary: "Name registration paid." });
        router.replace({ pathname: "/brand/hq", params: { id: brand.id } });
        return;
      }
      Alert.alert("Payment", raw || "Couldn’t complete that.");
    } finally {
      setBusy(false);
    }
  }

  if (!brand) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 20 }]}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.h}>This brand isn’t here.</Text>
      </View>
    );
  }

  if (mark !== "none") {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.h}>{mark === "filed" ? "The name is filed." : "We’re registering it."}</Text>
        <Text style={styles.p}>Nothing else to pay here.</Text>
      </View>
    );
  }

  const method = methods.find((m) => m.id === methodId) || methods[0];

  return (
    <View style={styles.page}>
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn}>
          <Text style={styles.navBack}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>Register the name</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 140 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>{brand.name}</Text>
        <Text style={styles.h}>Protect the brand name through trademark</Text>
        <View style={styles.priceBox}>
          <Text style={styles.priceK}>TO PAY</Text>
          <Text style={styles.price}>{price}</Text>
        </View>
        <Text style={styles.payK}>Pay with</Text>
        {methods.map((m) => (
          <Pressable key={m.id} onPress={() => setMethodId(m.id)} style={[styles.method, methodId === m.id && styles.methodOn]}>
            <Text style={styles.methodTxt}>{m.label}</Text>
            <View style={[styles.radio, methodId === m.id && styles.radioOn]} />
          </Pressable>
        ))}
      </ScrollView>
      <View style={[styles.dock, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable onPress={() => void pay()} disabled={busy} style={[styles.payBtn, busy && { opacity: 0.5 }]}>
          <Text style={styles.payTxt}>{busy ? "Paying…" : `Pay ${price}`}</Text>
        </Pressable>
        <Text style={styles.lock}>
          {processorFor(market.code, method?.id || "card") === "paystack" ? "Paystack" : "Stripe"}
          {method?.id === "apple" ? " · Apple Pay" : ""} · {moneyExact(localCents, market.currency)}
        </Text>
      </View>
    </View>
  );
}

function make(dark: boolean) {
  const ink = dark ? "#F4F0E6" : "#16140F";
  const muted = dark ? "rgba(244,240,230,0.55)" : "rgba(22,20,15,0.5)";
  const line = dark ? "rgba(244,240,230,0.12)" : "rgba(22,20,15,0.1)";
  const card = dark ? "#1C1A16" : "#F6F1E6";
  const bg = dark ? "#0E0D0B" : "#FFFFFF";
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: bg },
    nav: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, minHeight: 48 },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navBack: { color: ink, fontSize: 32, lineHeight: 34, marginTop: -4 },
    navTitle: { flex: 1, textAlign: "center", color: ink, fontSize: 16, fontWeight: "700" },
    back: { color: ink, fontSize: 16, fontWeight: "700", paddingHorizontal: 22 },
    brand: { color: muted, fontSize: 13, fontWeight: "700", marginTop: 18, letterSpacing: 0.4 },
    h: { color: ink, fontSize: 28, fontWeight: "800", marginTop: 8 },
    p: { color: muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
    priceBox: { marginTop: 22, borderRadius: 18, backgroundColor: card, padding: 18 },
    priceK: { color: muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
    price: { color: ink, fontSize: 36, fontWeight: "800", marginTop: 6 },
    payK: { color: ink, fontSize: 14, fontWeight: "800", marginTop: 28, marginBottom: 8 },
    method: { height: 52, borderRadius: 16, borderWidth: 1, borderColor: line, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    methodOn: { borderColor: "#D6E27A", backgroundColor: "rgba(214,226,122,0.12)" },
    methodTxt: { color: ink, fontSize: 15, fontWeight: "700" },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: line },
    radioOn: { borderColor: "#D6E27A", backgroundColor: "#D6E27A" },
    dock: { paddingHorizontal: 22, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: line },
    payBtn: { height: 54, borderRadius: 27, backgroundColor: "#D6E27A", alignItems: "center", justifyContent: "center" },
    payTxt: { color: "#16140F", fontSize: 16, fontWeight: "800" },
    lock: { color: muted, fontSize: 12, textAlign: "center", marginTop: 10 },
  });
}
