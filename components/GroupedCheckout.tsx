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
import {
  createGroupedCheckout,
  createGroupedStripePaymentIntent,
  paymentsExtra,
} from "../lib/pay";
import { loadAddress, type Address } from "../lib/orders";
import { removeManyFromCart } from "../lib/cart";
import { getBrand } from "../lib/brands";
import { brandMakes } from "../lib/brandMake";
import { shippingCents, uvelFeeCents } from "../lib/fees";
import { getMarket, moneyExact, convertCents } from "../lib/markets";
import { listingVisibleIn, restrictShipsTo, shipsToLine } from "../lib/ships";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import {
  getPiece,
  isRemoteListedPiece,
  useMarketplaceSyncState,
  useWardrobe,
  type ClosetPiece,
} from "../lib/wardrobe";
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
  carrierOptions: Array<{
    id: string;
    name: string;
    speed: "standard" | "express";
  }>;
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
  const [shippingChoices, setShippingChoices] = useState<
    Record<string, { carrierId: string }>
  >({});
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");
  const [checkoutAttempt] = useState(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );

  useFocusEffect(
    useCallback(() => {
      void loadAddress().then(setAddress);
    }, []),
  );

  const pieces = useMemo(
    () =>
      ids
        .map((id) => getPiece(id))
        .filter((piece): piece is ClosetPiece => Boolean(piece)),
    [ids, sync],
  );
  const lines = useMemo<CheckoutLine[]>(() => {
    let firstFindAssigned = false;
    return pieces.map((piece) => {
      const brand = piece.brandId ? getBrand(piece.brandId) : undefined;
      const itemCurrency = piece.currency || market.currency;
      const itemCents = convertCents(
        piece.listPriceCents,
        itemCurrency,
        market,
      );
      const feeCents = uvelFeeCents(piece.listPriceCents, itemCurrency, market);
      const creditCents = firstFindAssigned
        ? 0
        : Math.min(1500, firstFind.applyTo(piece, itemCents));
      if (creditCents > 0) firstFindAssigned = true;
      const sameCountry = Boolean(
        address && address.country === (piece.country || market.code),
      );
      const madeByUvel = brandMakes(brand);
      const buyerPaysShipping = piece.shippingBuyerPays !== false || madeByUvel;
      const shipsTo = restrictShipsTo(
        piece.country || market.code,
        piece.shipsTo,
        brand?.operatingCountries,
      );
      const addressOk = Boolean(
        address &&
          listingVisibleIn({
            origin: piece.country || market.code,
            shipsTo,
            buyer: address.country,
          }),
      );
      const available =
        piece.status === "listed" &&
        !piece.sellerPaused &&
        isRemoteListedPiece(piece.id);
      const variants = Boolean(
        piece.brandId &&
          piece.sizeStock &&
          Object.keys(piece.sizeStock).length &&
          (piece.sizes?.length || piece.size),
      );
      const carrierOptions = !madeByUvel
        ? carriersForListing(
            piece.country || market.code,
            piece.shippingCarriers,
            piece.shippingMethod || "dropoff",
          ).map(({ id, name, speed }) => ({ id, name, speed }))
        : [];
      const choice = shippingChoices[piece.id];
      const carrier =
        carrierOptions.find((item) => item.id === choice?.carrierId) ||
        carrierOptions[0];
      const express = carrier?.speed === "express";
      const shipCents =
        address && addressOk && buyerPaysShipping
          ? shippingCents(sameCountry, express, market)
          : 0;
      const policyName =
        brand?.name ||
        (piece.brand && piece.brand !== "Unlabeled"
          ? piece.brand
          : piece.ownerName || "Seller");
      return {
        piece,
        brand,
        itemCents,
        creditCents,
        feeCents,
        shipCents,
        totalCents: itemCents + feeCents + shipCents - creditCents,
        sellerName:
          brand?.name ||
          piece.ownerName ||
          (piece.brand !== "Unlabeled" ? piece.brand : "Seller"),
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
        policyShipping:
          brand?.customerReturnShipping === "brand"
            ? "The seller covers return shipping."
            : "The buyer covers return shipping.",
      };
    });
  }, [pieces, address, market, sync, shippingChoices, firstFind]);

  const totalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const policyLine = lines.find((line) => line.piece.id === policyPieceId);
  const sameAddressForAll = Boolean(
    address &&
      address.name.trim() &&
      address.line1.trim() &&
      address.city.trim() &&
      address.postal.trim(),
  );
  const allAvailable =
    pieces.length === ids.length &&
    lines.length === ids.length &&
    lines.every((line) => line.available);
  const allShipHere = lines.every((line) => line.addressOk);
  const tooManyItems = ids.length > 8;
  const hasVariant = lines.some((line) => line.needsVariant);
  const hasMissingCarrier = lines.some(
    (line) => !line.madeByUvel && line.carrierOptions.length === 0,
  );
  const batchId = useMemo(
    () =>
      checkoutBatchId(
        checkoutAttempt,
        app.uid || "signed-out",
        ids,
        address,
        lines.map((line) => ({
          listingId: line.piece.id,
          carrierId: line.carrier?.id || "",
          creditCents: line.creditCents,
        })),
      ),
    [
      checkoutAttempt,
      app.uid,
      ids,
      address?.name,
      address?.phone,
      address?.line1,
      address?.line2,
      address?.city,
      address?.region,
      address?.postal,
      address?.country,
      lines,
    ],
  );
  const canPay = Boolean(
    app.uid &&
      address &&
      sameAddressForAll &&
      lines.length === ids.length &&
      totalCents > 0 &&
      !paying &&
      !tooManyItems &&
      allAvailable &&
      allShipHere &&
      !hasVariant &&
      !hasMissingCarrier &&
      market.code === "US" &&
      sync === "confirmed" &&
      paymentsExtra.stripePk,
  );

  async function payAll() {
    if (paying) return;
    if (market.code !== "US") {
      setMessage(
        "Combined checkout is currently available only for US-dollar orders. Use Checkout item for each item in this bag.",
      );
      return;
    }
    if (!app.uid) {
      setMessage("Sign in before checking out.");
      return;
    }
    if (!address || !sameAddressForAll) {
      setMessage("Add a complete shipping address before checking out.");
      return;
    }
    if (hasVariant) {
      setMessage(
        "A size must be selected for each size-tracked listing. Check those items out individually.",
      );
      return;
    }
    if (hasMissingCarrier) {
      setMessage(
        "A seller has not configured a shipping provider for this item. Check it out individually.",
      );
      return;
    }
    if (tooManyItems) {
      setMessage(
        "Combined checkout supports up to eight items. Check out some items individually.",
      );
      return;
    }
    if (!allAvailable || sync !== "confirmed") {
      setMessage(
        "Uvel could not confirm every listing is available. Refresh the bag and try again.",
      );
      return;
    }
    if (!allShipHere) {
      setMessage(
        "At least one seller does not ship to this address. Check those items out individually.",
      );
      return;
    }
    if (!paymentsExtra.stripePk) {
      setMessage("Stripe checkout is not configured for this app build.");
      return;
    }
    setPaying(true);
    setMessage("");
    try {
      const batch = await createGroupedCheckout({
        checkoutBatchId: batchId,
        listingIds: lines.map((line) => line.piece.id),
        address,
        shippingChoices: lines.map((line) => ({
          listingId: line.piece.id,
          carrierId: line.carrier?.id || "",
          creditCents: line.creditCents,
        })),
      });
      if (batch.amountCents !== totalCents)
        throw new Error(
          "A listing price or shipping amount changed. Return to your bag and refresh checkout.",
        );
      const intent = await createGroupedStripePaymentIntent(
        batch.checkoutBatchId,
      );
      if (intent.alreadyPaid) {
        removeManyFromCart(batch.orderIds.map((order) => order.pieceId));
        router.replace({
          pathname: "/order/[id]",
          params: { id: batch.orderIds[0].id },
        });
        return;
      }
      const initialized = await initPaymentSheet({
        merchantDisplayName: "Uvel",
        paymentIntentClientSecret: intent.clientSecret,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          email: app.email || undefined,
          name: address.name,
        },
        applePay: { merchantCountryCode: "US" },
      });
      if (initialized.error) throw new Error(initialized.error.message);
      const presented = await presentPaymentSheet();
      if (presented.error) {
        if (presented.error.code !== "Canceled")
          throw new Error(presented.error.message);
        return;
      }
      removeManyFromCart(batch.orderIds.map((order) => order.pieceId));
      router.replace({
        pathname: "/order/[id]",
        params: { id: batch.orderIds[0].id },
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not start checkout. Please try again.",
      );
    } finally {
      setPaying(false);
    }
  }

  return (
    <View style={styles.page}>
      <StatusBar style={colors.ink === "#000000" ? "light" : "dark"} />
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <AccessiblePressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.navBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to bag"
        >
          <Ionicons name="chevron-back" size={23} color={colors.bone} />
        </AccessiblePressable>
        <Text style={styles.navTitle}>Checkout</Text>
        <View style={styles.navBtn} />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 166 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!allAvailable || sync !== "confirmed" ? (
          <Text style={styles.notice}>
            {sync === "loading"
              ? "Checking availability…"
              : "Checkout is paused until the marketplace reconnects."}
          </Text>
        ) : null}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>{lines.length} items</Text>
            <Text style={styles.summaryCaption}>One payment</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.itemRail}
          >
            {lines.map((line) => (
              <View key={line.piece.id} style={styles.itemCard}>
                <Image
                  cachePolicy="memory-disk"
                  source={{ uri: line.piece.photo }}
                  style={styles.thumb}
                  contentFit="cover"
                />
                <Text style={styles.itemName} numberOfLines={2}>
                  {line.piece.name}
                </Text>
                <Text style={styles.itemMeta}>
                  {[line.piece.size, line.piece.color]
                    .filter(Boolean)
                    .join(" · ") || "One size"}
                </Text>
                <Text style={styles.itemPrice}>
                  {moneyExact(line.itemCents, market.currency)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
        <View style={styles.shipTogether}>
          <View style={styles.shipIcon}>
            <Ionicons name="cube-outline" size={19} color={colors.success} />
          </View>
          <Text style={styles.shipTogetherText}>
            Ships together to one address
          </Text>
        </View>
        <AccessiblePressable
          onPress={() => router.push("/address")}
          style={styles.actionRow}
          accessibilityRole="button"
          accessibilityLabel={
            address
              ? `Shipping to ${address.name}, ${address.city}. Edit address.`
              : "Add shipping address"
          }
        >
          <View style={styles.actionIcon}>
            <Ionicons
              name="location-outline"
              size={21}
              color={colors.success}
            />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Shipping address</Text>
            <Text style={styles.actionSub} numberOfLines={1}>
              {address
                ? [address.line1, address.city, address.region, address.postal]
                    .filter(Boolean)
                    .join(", ")
                : "Add your shipping address"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={21} color={colors.success} />
        </AccessiblePressable>
        <AccessiblePressable
          onPress={() => void payAll()}
          style={styles.actionRow}
          accessibilityRole="button"
          accessibilityLabel="Pay with Apple Pay"
          accessibilityState={{ disabled: !canPay, busy: paying }}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="card-outline" size={21} color={colors.success} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Payment</Text>
            <Text style={styles.actionSub}>Apple Pay</Text>
          </View>
          <Ionicons name="chevron-forward" size={21} color={colors.success} />
        </AccessiblePressable>
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalTitle}>Total</Text>
              <Text style={styles.totalSub}>
                Includes shipping and buyer protection
              </Text>
            </View>
            <Text style={styles.totalValue}>
              {moneyExact(totalCents, market.currency)}
            </Text>
          </View>
        </View>
        {market.code !== "US" ||
        hasVariant ||
        hasMissingCarrier ||
        tooManyItems ||
        !allShipHere ||
        message ? (
          <View style={styles.messages}>
            {market.code !== "US" ? (
              <Text style={styles.notice}>
                Combined checkout is currently available only for US-dollar
                orders.
              </Text>
            ) : null}
            {hasVariant ? (
              <Text style={styles.notice}>
                A size-tracked item needs its size selected first.
              </Text>
            ) : null}
            {hasMissingCarrier ? (
              <Text style={styles.notice}>
                A seller has not configured shipping for one item.
              </Text>
            ) : null}
            {tooManyItems ? (
              <Text style={styles.notice}>
                Combined checkout supports up to eight items.
              </Text>
            ) : null}
            {address && !allShipHere ? (
              <Text style={styles.notice}>
                Some items cannot be shipped to this address.
              </Text>
            ) : null}
            {message ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {message}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.dock, { paddingBottom: insets.bottom + 12 }]}>
        <AccessiblePressable
          onPress={() => void payAll()}
          disabled={!canPay}
          style={[styles.payButton, !canPay && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={
            paying
              ? "Processing payment"
              : `Buy ${lines.length} items for ${moneyExact(totalCents, market.currency)}`
          }
          accessibilityState={{ disabled: !canPay, busy: paying }}
        >
          <Text style={styles.payButtonText}>
            {paying ? "Preparing checkout…" : "Buy with Apple Pay"}
          </Text>
        </AccessiblePressable>
        <Text style={styles.safeText}>
          This payment will be processed by Stripe
        </Text>
        <Text style={styles.brandLine}>
          Apple Pay · Visa · Mastercard · Amex
        </Text>
      </View>
      <Sheet
        open={Boolean(policyLine)}
        onClose={() => setPolicyPieceId("")}
        expandable
      >
        {policyLine ? (
          <ScrollView
            style={styles.policyScroll}
            contentContainerStyle={styles.policyBody}
            showsVerticalScrollIndicator
          >
            <Text style={styles.sheetTitle}>
              {policyLine.policyName} returns policy
            </Text>
            <Text style={styles.sheetCopy}>
              {policyLine.policyMode === "final_sale"
                ? "This item is final sale, so change-of-mind returns are not accepted."
                : `You can request a return within ${policyLine.policyWindow} days after delivery.`}
            </Text>
            <Text style={styles.sheetCopy}>{policyLine.policyShipping}</Text>
          </ScrollView>
        ) : null}
      </Sheet>
    </View>
  );
}

function checkoutBatchId(
  attempt: string,
  uid: string,
  ids: string[],
  address: Address | null,
  shipping: Array<{
    listingId: string;
    carrierId: string;
    creditCents: number;
  }>,
) {
  const value = [
    attempt,
    uid,
    ...ids.slice().sort(),
    address?.name,
    address?.phone,
    address?.line1,
    address?.line2,
    address?.city,
    address?.region,
    address?.postal,
    address?.country,
    ...shipping.flatMap((choice) => [
      choice.listingId,
      choice.carrierId,
      choice.creditCents,
    ]),
  ].join("|");
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
    nav: {
      paddingHorizontal: 8,
      paddingBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    navBtn: {
      width: 42,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
    },
    navTitle: { color: colors.bone, fontSize: 18, fontWeight: "800" },
    notice: {
      color: colors.warning,
      fontSize: 12,
      lineHeight: 18,
      marginHorizontal: 20,
      marginTop: 12,
    },
    summaryCard: {
      marginHorizontal: 20,
      marginTop: 14,
      padding: 16,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: `${colors.bone}20`,
    },
    summaryHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    summaryTitle: { color: colors.bone, fontSize: 22, fontWeight: "800" },
    summaryCaption: {
      color: colors.success,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    itemRail: { gap: 12, paddingRight: 4 },
    itemCard: { width: 142 },
    thumb: {
      width: 142,
      height: 154,
      borderRadius: 14,
      backgroundColor: colors.ink,
    },
    itemName: {
      color: colors.bone,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "700",
      marginTop: 8,
    },
    itemMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
    itemPrice: {
      color: colors.bone,
      fontSize: 15,
      fontWeight: "800",
      marginTop: 6,
    },
    shipTogether: {
      marginHorizontal: 20,
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    shipIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: `${colors.success}18`,
      alignItems: "center",
      justifyContent: "center",
    },
    shipTogetherText: { color: colors.muted, fontSize: 14 },
    actionRow: {
      minHeight: 76,
      marginHorizontal: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: `${colors.bone}22`,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    actionIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    actionCopy: { flex: 1, minWidth: 0 },
    actionTitle: { color: colors.bone, fontSize: 16, fontWeight: "800" },
    actionSub: { color: colors.muted, fontSize: 13, marginTop: 4 },
    totalSection: {
      marginHorizontal: 20,
      paddingTop: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: `${colors.bone}22`,
    },
    totalRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
    },
    totalTitle: { color: colors.bone, fontSize: 18, fontWeight: "800" },
    totalSub: { color: colors.muted, fontSize: 13, marginTop: 4 },
    totalValue: {
      color: colors.bone,
      fontSize: 20,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
    messages: { marginBottom: 16 },
    error: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 19,
      marginHorizontal: 20,
      marginTop: 12,
    },
    dock: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.ink,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: `${colors.bone}24`,
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    payButton: {
      minHeight: 50,
      borderRadius: 25,
      backgroundColor: colors.bone,
      alignItems: "center",
      justifyContent: "center",
    },
    disabled: { opacity: 0.44 },
    payButtonText: { color: colors.ink, fontSize: 17, fontWeight: "600" },
    safeText: {
      color: colors.muted,
      textAlign: "center",
      fontSize: 12,
      marginTop: 8,
    },
    brandLine: {
      color: colors.subtle,
      textAlign: "center",
      fontSize: 10,
      marginTop: 5,
      marginBottom: 2,
    },
    policyScroll: { flexShrink: 1 },
    policyBody: { paddingBottom: 8 },
    sheetTitle: {
      color: colors.bone,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "800",
    },
    sheetCopy: {
      color: `${colors.bone}E0`,
      fontSize: 16,
      lineHeight: 24,
      marginTop: 12,
    },
  });
}
