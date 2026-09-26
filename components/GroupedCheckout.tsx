import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useStripe } from "@stripe/stripe-react-native";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AccessiblePressable } from "./AccessiblePressable";
import { Sheet } from "./Sheet";
import { createGroupedCheckout, createGroupedStripePaymentIntent, paymentsExtra } from "../lib/pay";
import { loadAddress, type Address } from "../lib/orders";
import { removeManyFromCart } from "../lib/cart";
import { getBrand } from "../lib/brands";
import { brandMakes } from "../lib/brandMake";
import { shippingCents, uvelFeeCents } from "../lib/fees";
import { getMarket, moneyExact, convertCents } from "../lib/markets";
import { listingVisibleIn, restrictShipsTo, shipsToLine } from "../lib/ships";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { getPiece, isRemoteListedPiece, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../lib/wardrobe";
import { carriersForListing } from "../lib/sellerShipping";
import { useFirstFind } from "../lib/firstFind";

type CheckoutLine = {
  piece: ClosetPiece;
  brand?: ReturnType<typeof getBrand>;
  itemCents: number;
  creditCents: number;
  feeCents: number;
  shipCents: number;
  totalCents: number;
  sellerName: string;
  carrier?: { id: string; name: string; speed: "standard" | "express" };
  carrierOptions: Array<{ id: string; name: string; speed: "standard" | "express" }>;
  express: boolean;
  delivery: string;
  sameCountry: boolean;
  addressOk: boolean;
  needsVariant: boolean;
  available: boolean;
  madeByUvel: boolean;
  policyName: string;
  policyMode: "final_sale" | "standard_returns";
  policyWindow: number;
  policyShipping: string;
};

export function GroupedCheckout({ ids }: { ids: string[] }) {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  useWardrobe();
  const firstFind = useFirstFind();
  const sync = useMarketplaceSyncState();
  const market = getMarket(app.country);
  const [address, setAddress] = useState<Address | null>(null);
  const [policyPieceId, setPolicyPieceId] = useState("");
  const [shippingChoices, setShippingChoices] = useState<Record<string, { carrierId: string }>>({});
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");
  const [checkoutAttempt] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  useFocusEffect(useCallback(() => {
    void loadAddress().then(setAddress);
  }, []));

  const pieces = useMemo(() => ids.map((id) => getPiece(id)).filter((piece): piece is ClosetPiece => Boolean(piece)), [ids, sync]);
  const lines = useMemo<CheckoutLine[]>(() => {
    let firstFindAssigned = false;
    return pieces.map((piece) => {
    const brand = piece.brandId ? getBrand(piece.brandId) : undefined;
    const itemCurrency = piece.currency || market.currency;
    const itemCents = convertCents(piece.listPriceCents, itemCurrency, market);
    const feeCents = uvelFeeCents(piece.listPriceCents, itemCurrency, market);
    const creditCents = firstFindAssigned ? 0 : Math.min(1500, firstFind.applyTo(piece, itemCents));
    if (creditCents > 0) firstFindAssigned = true;
    const sameCountry = Boolean(address && address.country === (piece.country || market.code));
    const madeByUvel = brandMakes(brand);
    const buyerPaysShipping = piece.shippingBuyerPays !== false || madeByUvel;
    const shipsTo = restrictShipsTo(piece.country || market.code, piece.shipsTo, brand?.operatingCountries);
    const addressOk = Boolean(address && listingVisibleIn({ origin: piece.country || market.code, shipsTo, buyer: address.country }));
    const available = piece.status === "listed" && !piece.sellerPaused && isRemoteListedPiece(piece.id);
    const variants = Boolean(piece.brandId && piece.sizeStock && Object.keys(piece.sizeStock).length && (piece.sizes?.length || piece.size));
    const carrierOptions = !madeByUvel ? carriersForListing(piece.country || market.code, piece.shippingCarriers, piece.shippingMethod || "dropoff").map(({ id, name, speed }) => ({ id, name, speed })) : [];
    const choice = shippingChoices[piece.id];
    const carrier = carrierOptions.find((item) => item.id === choice?.carrierId) || carrierOptions[0];
    const express = carrier?.speed === "express";
    const shipCents = address && addressOk && buyerPaysShipping ? shippingCents(sameCountry, express, market) : 0;
    const policyName = brand?.name || (piece.brand && piece.brand !== "Unlabeled" ? piece.brand : piece.ownerName || "Seller");
    return {
      piece,
      brand,
      itemCents,
      creditCents,
      feeCents,
      shipCents,
      totalCents: itemCents + feeCents + shipCents - creditCents,
      sellerName: brand?.name || piece.ownerName || (piece.brand !== "Unlabeled" ? piece.brand : "Seller"),
      carrier,
      carrierOptions,
      express,
      delivery: `${carrier ? `${carrier.name} · ` : ""}${express ? "express" : "standard"}${sameCountry ? "" : " · international"}`,
      sameCountry,
      addressOk,
      needsVariant: variants,
      available,
      madeByUvel,
      policyName,
      policyMode: brand?.customerPolicyMode || "standard_returns",
      policyWindow: brand?.customerReturnWindowDays || 14,
      policyShipping: brand?.customerReturnShipping === "brand" ? "The seller covers return shipping." : "The buyer covers return shipping.",
    };
  });
  }, [pieces, address, market, sync, shippingChoices, firstFind]);

  const totalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const policyLine = lines.find((line) => line.piece.id === policyPieceId);
  const sameAddressForAll = Boolean(address && address.name.trim() && address.line1.trim() && address.city.trim() && address.postal.trim());
  const allAvailable = pieces.length === ids.length && lines.length === ids.length && lines.every((line) => line.available);
  const allShipHere = lines.every((line) => line.addressOk);
  const tooManyItems = ids.length > 8;
  const hasVariant = lines.some((line) => line.needsVariant);
  const hasMissingCarrier = lines.some((line) => !line.madeByUvel && line.carrierOptions.length === 0);
  const batchId = useMemo(() => checkoutBatchId(checkoutAttempt, app.uid || "signed-out", ids, address, lines.map((line) => ({ listingId: line.piece.id, carrierId: line.carrier?.id || "", creditCents: line.creditCents }))), [checkoutAttempt, app.uid, ids, address?.name, address?.phone, address?.line1, address?.line2, address?.city, address?.region, address?.postal, address?.country, lines]);
  const canPay = Boolean(app.uid && address && sameAddressForAll && lines.length === ids.length && totalCents > 0 && !paying && !tooManyItems && allAvailable && allShipHere && !hasVariant && !hasMissingCarrier && market.code === "US" && sync === "confirmed" && paymentsExtra.stripePk);

  async function payAll() {
    if (paying) return;
    if (market.code !== "US") {
      setMessage("Combined checkout is currently available only for US-dollar orders. Use Checkout item for each item in this bag.");
      return;
    }
    if (!app.uid) { setMessage("Sign in before checking out."); return; }
    if (!address || !sameAddressForAll) { setMessage("Add a complete shipping address before checking out."); return; }
    if (hasVariant) { setMessage("A size must be selected for each size-tracked listing. Check those items out individually."); return; }
    if (hasMissingCarrier) { setMessage("A seller has not configured a shipping provider for this item. Check it out individually."); return; }
    if (tooManyItems) { setMessage("Combined checkout supports up to eight items. Check out some items individually."); return; }
    if (!allAvailable || sync !== "confirmed") { setMessage("Uvel could not confirm every listing is available. Refresh the bag and try again."); return; }
    if (!allShipHere) { setMessage("At least one seller does not ship to this address. Check those items out individually."); return; }
    if (!paymentsExtra.stripePk) { setMessage("Stripe checkout is not configured for this app build."); return; }
    setPaying(true);
    setMessage("");
    try {
      const batch = await createGroupedCheckout({
        checkoutBatchId: batchId,
        listingIds: lines.map((line) => line.piece.id),
        address,
        shippingChoices: lines.map((line) => ({ listingId: line.piece.id, carrierId: line.carrier?.id || "", creditCents: line.creditCents })),
      });
      if (batch.amountCents !== totalCents) throw new Error("A listing price or shipping amount changed. Return to your bag and refresh checkout.");
      const intent = await createGroupedStripePaymentIntent(batch.checkoutBatchId);
      if (intent.alreadyPaid) {
        removeManyFromCart(batch.orderIds.map((order) => order.pieceId));
        router.replace({ pathname: "/order/[id]", params: { id: batch.orderIds[0].id } });
        return;
      }
      const initialized = await initPaymentSheet({
        merchantDisplayName: "Uvel",
        paymentIntentClientSecret: intent.clientSecret,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: { email: app.email || undefined, name: address.name },
        applePay: { merchantCountryCode: "US" },
      });
      if (initialized.error) throw new Error(initialized.error.message);
      const presented = await presentPaymentSheet();
      if (presented.error) {
        if (presented.error.code !== "Canceled") throw new Error(presented.error.message);
        return;
      }
      removeManyFromCart(batch.orderIds.map((order) => order.pieceId));
      router.replace({ pathname: "/order/[id]", params: { id: batch.orderIds[0].id } });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start checkout. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <View style={styles.page}>
      <StatusBar style={colors.ink === "#000000" ? "light" : "dark"} />
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <AccessiblePressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Back to bag">
          <Ionicons name="chevron-back" size={23} color={colors.bone} />
        </AccessiblePressable>
        <Text style={styles.navTitle}>Checkout · {lines.length} items</Text>
        <View style={styles.navBtn} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 166 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>ONE PAYMENT · SEPARATE SELLER ORDERS</Text>
        <Text style={styles.intro}>Review each item and seller before you pay.</Text>

        <Text style={styles.sectionTitle}>Shipping address</Text>
        <AccessiblePressable onPress={() => router.push("/address")} style={styles.card} accessibilityRole="button" accessibilityLabel={address ? `Shipping to ${address.name}, ${address.city}. Edit address.` : "Add a shipping address"}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{address?.name || "Add your shipping address"}</Text>
            <Text style={styles.cardCopy}>{address ? [address.line1, address.line2, address.city, address.region, address.postal, getMarket(address.country).name].filter(Boolean).join(", ") : "One address will be used for all items."}</Text>
          </View>
          <Text style={styles.actionText}>{address ? "Edit" : "Add"}</Text>
        </AccessiblePressable>

        <Text style={styles.sectionTitle}>Order summary</Text>
        {lines.map((line) => (
          <View key={line.piece.id} style={styles.itemCard}>
            <View style={styles.itemTop}>
              <Image cachePolicy="memory-disk" source={{ uri: line.piece.photo }} style={styles.thumb} contentFit="cover" />
              <View style={styles.itemCopy}>
                <Text style={styles.seller} numberOfLines={1}>{line.sellerName}</Text>
                <Text style={styles.itemName} numberOfLines={2}>{line.piece.name}</Text>
                <Text style={styles.itemMeta}>{[line.piece.size, line.piece.color].filter(Boolean).join(" · ") || "One size"}</Text>
              </View>
              <Text style={styles.price}>{moneyExact(line.itemCents, market.currency)}</Text>
            </View>
            <View style={styles.rule} />
            {line.creditCents > 0 ? <View style={styles.line}><Text style={styles.discountLabel}>First Find</Text><Text style={styles.discountValue}>−{moneyExact(line.creditCents, market.currency)}</Text></View> : null}
            <View style={styles.line}><Text style={styles.lineLabel}>Buyer protection</Text><Text style={styles.lineValue}>{moneyExact(line.feeCents, market.currency)}</Text></View>
            <View style={styles.line}><Text style={styles.lineLabel}>{line.madeByUvel ? "Delivery" : "Shipping"}</Text><Text style={styles.lineValue}>{moneyExact(line.shipCents, market.currency)}</Text></View>
            {line.carrierOptions.length ? (
              <>
                {line.carrierOptions.length > 1 ? <>
                  <Text style={styles.optionLabel}>Carrier · delivery speed</Text>
                  <View style={styles.optionsRow}>{line.carrierOptions.map((carrier) => (
                    <AccessiblePressable key={carrier.id} onPress={() => setShippingChoices((prior) => ({ ...prior, [line.piece.id]: { carrierId: carrier.id } }))} style={[styles.optionButton, line.carrier?.id === carrier.id && styles.optionSelected]} accessibilityRole="button" accessibilityState={{ selected: line.carrier?.id === carrier.id }}>
                      <Text style={[styles.optionText, line.carrier?.id === carrier.id && styles.optionTextSelected]}>{carrier.name} · {carrier.speed}</Text>
                    </AccessiblePressable>
                  ))}</View>
                </> : null}
              </>
            ) : null}
            <View style={styles.line}><Text style={styles.lineLabel}>Delivery method</Text><Text style={styles.lineValue}>{line.delivery}</Text></View>
            <Text style={styles.shippingHint}>{address ? shipsToLine(line.piece.country || market.code, line.piece.shipsTo) : "Shipping availability will be confirmed when you add an address."}</Text>
            <AccessiblePressable onPress={() => setPolicyPieceId(line.piece.id)} style={styles.policyLink} accessibilityRole="button" accessibilityLabel={`${line.policyName} returns policy`} accessibilityHint="View this seller's returns policy.">
              <Text style={styles.policyLinkText}>{line.policyName} returns policy</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.success} />
            </AccessiblePressable>
          </View>
        ))}

        <View style={styles.totalCard}>
          <View style={styles.line}><Text style={styles.lineLabel}>Items ({lines.length})</Text><Text style={styles.lineValue}>{moneyExact(lines.reduce((sum, line) => sum + line.itemCents, 0), market.currency)}</Text></View>
          <View style={styles.line}><Text style={styles.lineLabel}>Buyer protection</Text><Text style={styles.lineValue}>{moneyExact(lines.reduce((sum, line) => sum + line.feeCents, 0), market.currency)}</Text></View>
          {lines.some((line) => line.creditCents > 0) ? <View style={styles.line}><Text style={styles.discountLabel}>First Find</Text><Text style={styles.discountValue}>−{moneyExact(lines.reduce((sum, line) => sum + line.creditCents, 0), market.currency)}</Text></View> : null}
          <View style={styles.line}><Text style={styles.lineLabel}>Shipping</Text><Text style={styles.lineValue}>{moneyExact(lines.reduce((sum, line) => sum + line.shipCents, 0), market.currency)}</Text></View>
          <View style={[styles.rule, { marginTop: 6 }]} />
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Total to pay</Text><Text style={styles.totalValue}>{moneyExact(totalCents, market.currency)}</Text></View>
          <Text style={styles.totalHint}>Each seller will have a separate order and pending wallet balance. Seller funds are available to withdraw according to Uvel’s delivery and release policy.</Text>
        </View>
        {market.code !== "US" ? <Text style={styles.notice}>Combined checkout is currently available only for US-dollar orders. Use the “Checkout item” option in your bag to buy items separately.</Text> : null}
        {hasVariant ? <Text style={styles.notice}>A size-tracked item needs its size selected before checkout. Check that item out individually.</Text> : null}
        {hasMissingCarrier ? <Text style={styles.notice}>A seller has not configured a shipping provider for at least one item. Check those items out individually.</Text> : null}
        {tooManyItems ? <Text style={styles.notice}>Combined checkout supports up to eight items. Use “Checkout item” in your bag for additional items.</Text> : null}
        {!allAvailable && lines.length ? <Text style={styles.notice}>{sync === "loading" ? "Checking listings…" : "One or more listings are unavailable. Refresh the bag before continuing."}</Text> : null}
        {address && !allShipHere ? <Text style={styles.notice}>Some items cannot be shipped to this address. Use individual checkout to review seller delivery options.</Text> : null}
        {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
      </ScrollView>
      <View style={[styles.dock, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{moneyExact(totalCents, market.currency)}</Text></View>
        <AccessiblePressable onPress={() => void payAll()} disabled={!canPay} style={[styles.payButton, !canPay && styles.disabled]} accessibilityRole="button" accessibilityLabel={paying ? "Starting grouped checkout" : `Pay ${moneyExact(totalCents, market.currency)} for ${lines.length} items`} accessibilityState={{ disabled: !canPay, busy: paying }}>
          <Text style={styles.payButtonText}>{paying ? "Preparing checkout…" : `Pay ${moneyExact(totalCents, market.currency)}`}</Text>
        </AccessiblePressable>
        <Text style={styles.safeText}>Payment is confirmed by Stripe before any seller balance is credited.</Text>
      </View>

      <Sheet open={Boolean(policyLine)} onClose={() => setPolicyPieceId("")} expandable>
        {policyLine ? <>
          <ScrollView style={styles.policyScroll} contentContainerStyle={styles.policyBody} showsVerticalScrollIndicator>
            <Text style={styles.sheetTitle}>{policyLine.policyName} returns policy</Text>
            {policyLine.policyMode === "final_sale" ? <>
              <Text style={styles.sheetCopy}>This item is final sale, so change-of-mind returns are not accepted.</Text>
              <Text style={styles.sheetCopy}>If the item arrives damaged, defective, or different from the listing, contact Uvel support and we’ll help review it.</Text>
            </> : <>
              <Text style={styles.sheetCopy}>You can request a return within {policyLine.policyWindow} days after delivery.</Text>
              <Text style={styles.sheetCopy}>{policyLine.policyShipping}</Text>
              <Text style={styles.sheetCopy}>Items that arrive damaged, defective, or different from the listing can still be reported to Uvel.</Text>
            </>}
            {policyLine.brand?.customerPolicyNote ? <Text style={styles.sheetCopy}>Seller note: {policyLine.brand.customerPolicyNote}</Text> : null}
          </ScrollView>
          <AccessiblePressable onPress={() => setPolicyPieceId("")} style={styles.sheetButton} accessibilityRole="button" accessibilityLabel="Close returns policy"><Text style={styles.sheetButtonText}>Got it</Text></AccessiblePressable>
        </> : null}
      </Sheet>
    </View>
  );
}

function checkoutBatchId(attempt: string, uid: string, ids: string[], address: Address | null, shipping: Array<{ listingId: string; carrierId: string; creditCents: number }>) {
  const value = [attempt, uid, ...ids.slice().sort(), address?.name, address?.phone, address?.line1, address?.line2, address?.city, address?.region, address?.postal, address?.country, ...shipping.flatMap((choice) => [choice.listingId, choice.carrierId, choice.creditCents])].join("|");
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ (code + i), 0x85ebca6b) >>> 0;
  }
  return `cb-${a.toString(36)}${b.toString(36)}`;
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    nav: { paddingHorizontal: 8, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    navBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
    navTitle: { color: colors.bone, fontSize: 17, fontWeight: "800" },
    kicker: { color: colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, paddingHorizontal: 20, marginTop: 8 },
    intro: { color: `${colors.bone}CC`, fontSize: 14, lineHeight: 20, paddingHorizontal: 20, marginTop: 5 },
    sectionTitle: { color: colors.bone, fontSize: 18, lineHeight: 24, fontWeight: "800", marginTop: 22, marginBottom: 9, paddingHorizontal: 20 },
    card: { marginHorizontal: 20, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: `${colors.bone}2E`, flexDirection: "row", alignItems: "center", gap: 12 },
    cardTitle: { color: colors.bone, fontSize: 15, lineHeight: 20, fontWeight: "700" },
    cardCopy: { color: `${colors.bone}B0`, fontSize: 13, lineHeight: 19, marginTop: 3 },
    actionText: { color: colors.success, fontSize: 14, fontWeight: "800" },
    itemCard: { marginHorizontal: 20, marginBottom: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: `${colors.bone}24`, backgroundColor: colors.surface },
    itemTop: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
    thumb: { width: 58, height: 68, borderRadius: 10, backgroundColor: colors.ink },
    itemCopy: { flex: 1, minWidth: 0 },
    seller: { color: colors.success, fontSize: 10, lineHeight: 14, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase" },
    itemName: { color: colors.bone, fontSize: 15, lineHeight: 20, fontWeight: "700", marginTop: 3 },
    itemMeta: { color: `${colors.bone}A0`, fontSize: 12, marginTop: 4 },
    price: { color: colors.bone, fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: `${colors.bone}28`, marginVertical: 9 },
    line: { minHeight: 29, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 14 },
    lineLabel: { color: `${colors.bone}B5`, fontSize: 13, lineHeight: 18, flex: 1 },
    lineValue: { color: colors.bone, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
    discountLabel: { color: colors.success, fontSize: 13, lineHeight: 18, flex: 1, fontWeight: "700" },
    discountValue: { color: colors.success, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
    optionLabel: { color: `${colors.bone}A0`, fontSize: 11, fontWeight: "700", marginTop: 8, marginBottom: 5 },
    optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    optionButton: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: `${colors.bone}38`, alignItems: "center", justifyContent: "center" },
    optionSelected: { backgroundColor: colors.success, borderColor: colors.success },
    optionText: { color: `${colors.bone}C0`, fontSize: 12, fontWeight: "700" },
    optionTextSelected: { color: colors.successInk },
    shippingHint: { color: `${colors.bone}8D`, fontSize: 11, lineHeight: 16, marginTop: 4 },
    policyLink: { minHeight: 40, marginTop: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${colors.bone}20`, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    policyLinkText: { color: colors.success, fontSize: 13, fontWeight: "700" },
    totalCard: { marginHorizontal: 20, marginTop: 8, padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}2E` },
    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
    totalLabel: { color: colors.bone, fontSize: 16, fontWeight: "800" },
    totalValue: { color: colors.bone, fontSize: 19, fontWeight: "800", fontVariant: ["tabular-nums"] },
    totalHint: { color: `${colors.bone}A8`, fontSize: 12, lineHeight: 18, marginTop: 10 },
    notice: { color: colors.warning, fontSize: 13, lineHeight: 19, marginHorizontal: 20, marginTop: 12 },
    error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginHorizontal: 20, marginTop: 12 },
    dock: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.ink, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${colors.bone}24`, paddingHorizontal: 20, paddingTop: 12 },
    payButton: { minHeight: 52, marginTop: 12, borderRadius: 26, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    disabled: { opacity: 0.44 },
    payButtonText: { color: colors.successInk, fontSize: 16, fontWeight: "800" },
    safeText: { color: `${colors.bone}7D`, textAlign: "center", fontSize: 10, lineHeight: 15, marginTop: 8 },
    policyScroll: { flexShrink: 1 },
    policyBody: { paddingBottom: 6 },
    sheetTitle: { color: colors.bone, fontSize: 24, lineHeight: 30, fontWeight: "800", letterSpacing: -0.3 },
    sheetCopy: { color: `${colors.bone}E0`, fontSize: 16, lineHeight: 24, marginTop: 12 },
    sheetButton: { minHeight: 50, marginTop: 18, borderRadius: 25, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    sheetButtonText: { color: colors.successInk, fontSize: 15, fontWeight: "800" },
  });
}
