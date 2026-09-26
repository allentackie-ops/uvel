import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useStripe } from "@stripe/stripe-react-native";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AccessiblePressable } from "./AccessiblePressable";
import { Sheet } from "./Sheet";
import {
  createGroupedCheckout,
  createGroupedStripePaymentIntent,
  paymentsExtra,
  validatePromotion,
  type PromotionQuote,
} from "../lib/pay";
import { loadAddress, type Address } from "../lib/orders";
import { removeManyFromCart } from "../lib/cart";
import { getBrand } from "../lib/brands";
import { brandMakes } from "../lib/brandMake";
import { shippingCents, uvelFeeCents } from "../lib/fees";
import { getMarket, moneyExact, convertCents } from "../lib/markets";
import { listingVisibleIn, restrictShipsTo, shipsToLabel, shipsToLine } from "../lib/ships";
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
  discountCents: number;
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
  const [priceBreakdownOpen, setPriceBreakdownOpen] = useState(false);
  const [policyPieceId, setPolicyPieceId] = useState("");
  const [expandedPieceId, setExpandedPieceId] = useState("");
  const [promoInputs, setPromoInputs] = useState<Record<string, string>>({});
  const [promoQuotes, setPromoQuotes] = useState<Record<string, PromotionQuote>>({});
  const [promoMessages, setPromoMessages] = useState<Record<string, string>>({});
  const [promoBusy, setPromoBusy] = useState<Record<string, boolean>>({});
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
      const discountCents = Math.min(
        promoQuotes[piece.id]?.discountCents || 0,
        Math.max(0, itemCents - creditCents),
      );
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
        discountCents,
        creditCents,
        feeCents,
        shipCents,
        totalCents: itemCents + feeCents + shipCents - creditCents - discountCents,
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
  }, [pieces, address, market, sync, shippingChoices, firstFind, promoQuotes]);

  const totalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const policyLine = lines.find((line) => line.piece.id === policyPieceId);
  const expandedLine = lines.find((line) => line.piece.id === expandedPieceId);
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
          promotionId: promoQuotes[line.piece.id]?.promotionId || "",
          promotionCode: promoQuotes[line.piece.id]?.code || "",
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
      promoQuotes,
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

  async function applyPromo(pieceId: string) {
    const line = lines.find((item) => item.piece.id === pieceId);
    const code = String(promoInputs[pieceId] || "").trim().toUpperCase();
    if (market.code !== "US") {
      setPromoMessages((current) => ({
        ...current,
        [pieceId]: "Promo codes are available with combined checkout in the US market.",
      }));
      return;
    }
    if (!line || !code || promoBusy[pieceId]) {
      if (!code) setPromoMessages((current) => ({ ...current, [pieceId]: "Enter a promo code first." }));
      return;
    }
    setPromoBusy((current) => ({ ...current, [pieceId]: true }));
    setPromoMessages((current) => ({ ...current, [pieceId]: "" }));
    try {
      const quote = await validatePromotion({
        brandId: line.piece.brandId || "",
        listingId: line.piece.id,
        code,
        currency: market.currency,
        itemCents: line.itemCents,
      });
      setPromoQuotes((current) => ({ ...current, [pieceId]: quote }));
      setPromoInputs((current) => ({ ...current, [pieceId]: quote.code }));
      setPromoMessages((current) => ({
        ...current,
        [pieceId]: `${quote.code} applied · ${moneyExact(quote.discountCents, market.currency)} off`,
      }));
    } catch (error) {
      setPromoQuotes((current) => {
        const next = { ...current };
        delete next[pieceId];
        return next;
      });
      setPromoMessages((current) => ({
        ...current,
        [pieceId]: error instanceof Error ? error.message : "That promo code does not apply to this item.",
      }));
    } finally {
      setPromoBusy((current) => ({ ...current, [pieceId]: false }));
    }
  }

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
          promotionId: promoQuotes[line.piece.id]?.promotionId || "",
          promotionCode: promoQuotes[line.piece.id]?.code || "",
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
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.itemRail}
          >
            {lines.map((line) => (
              <AccessiblePressable
                key={line.piece.id}
                onPress={() => setExpandedPieceId(line.piece.id)}
                style={styles.itemCard}
                accessibilityRole="button"
                accessibilityLabel={`View details for ${line.piece.name}`}
              >
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
                {line.discountCents > 0 ? (
                  <Text style={styles.itemDiscount}>
                    −{moneyExact(line.discountCents, market.currency)} promo
                  </Text>
                ) : null}
              </AccessiblePressable>
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
          {lines.some((line) => line.discountCents > 0) ? (
            <View style={styles.promoTotalRow}>
              <Text style={styles.promoTotalLabel}>Promo savings</Text>
              <Text style={styles.promoTotalValue}>
                −{moneyExact(lines.reduce((sum, line) => sum + line.discountCents, 0), market.currency)}
              </Text>
            </View>
          ) : null}
          <AccessiblePressable
            onPress={() => setPriceBreakdownOpen(true)}
            style={styles.totalRow}
            accessibilityRole="button"
            accessibilityLabel={`View price breakdown. Total ${moneyExact(totalCents, market.currency)}.`}
          >
            <View>
              <Text style={styles.totalTitle}>Total</Text>
              <Text style={styles.totalSub}>
                Tap for price breakdown
              </Text>
            </View>
            <Text style={styles.totalValue}>
              {moneyExact(totalCents, market.currency)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.success} />
          </AccessiblePressable>
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
          {paying ? (
            <Text style={styles.payButtonText}>Preparing checkout…</Text>
          ) : (
            <View style={styles.appleButtonContent}>
              <Text style={styles.payButtonText}>Buy with</Text>
              <Text style={styles.appleGlyph}></Text>
              <Text style={styles.payButtonText}>Pay</Text>
            </View>
          )}
        </AccessiblePressable>
        <Text style={styles.secureText}>
          This payment will be processed by Stripe
        </Text>
        <PaymentBrands styles={styles} />
      </View>
      <Sheet
        open={priceBreakdownOpen}
        onClose={() => setPriceBreakdownOpen(false)}
        expandable
      >
        <ScrollView
          style={styles.policyScroll}
          contentContainerStyle={styles.breakdownBody}
          showsVerticalScrollIndicator
        >
          <Text style={styles.sheetTitle}>Price breakdown</Text>
          <Text style={styles.sheetCopy}>
            A clear breakdown of each item and what you’ll pay at checkout.
          </Text>
          {lines.map((line) => (
            <View key={line.piece.id} style={styles.breakdownItem}>
              <Text style={styles.breakdownItemTitle} numberOfLines={2}>
                {line.piece.name}
              </Text>
              <Text style={styles.breakdownSeller}>{line.sellerName}</Text>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Item price</Text>
                <Text style={styles.breakdownValue}>
                  {moneyExact(line.itemCents, market.currency)}
                </Text>
              </View>
              {line.discountCents > 0 ? (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownDiscountLabel}>
                    Promo{promoQuotes[line.piece.id]?.code
                      ? ` · ${promoQuotes[line.piece.id].code}`
                      : ""}
                  </Text>
                  <Text style={styles.breakdownDiscountValue}>
                    −{moneyExact(line.discountCents, market.currency)}
                  </Text>
                </View>
              ) : null}
              {line.creditCents > 0 ? (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownDiscountLabel}>First Find credit</Text>
                  <Text style={styles.breakdownDiscountValue}>
                    −{moneyExact(line.creditCents, market.currency)}
                  </Text>
                </View>
              ) : null}
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Buyer protection</Text>
                <Text style={styles.breakdownValue}>
                  {moneyExact(line.feeCents, market.currency)}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Shipping</Text>
                <Text style={styles.breakdownValue}>
                  {moneyExact(line.shipCents, market.currency)}
                </Text>
              </View>
              <View style={styles.breakdownItemTotal}>
                <Text style={styles.breakdownItemTotalLabel}>Item total</Text>
                <Text style={styles.breakdownItemTotalValue}>
                  {moneyExact(line.totalCents, market.currency)}
                </Text>
              </View>
            </View>
          ))}
          {!address ? (
            <Text style={styles.breakdownNote}>
              Add a shipping address to calculate delivery costs.
            </Text>
          ) : null}
          <View style={styles.breakdownGrandTotal}>
            <Text style={styles.breakdownGrandLabel}>Total</Text>
            <Text style={styles.breakdownGrandValue}>
              {moneyExact(totalCents, market.currency)}
            </Text>
          </View>
        </ScrollView>
      </Sheet>
      <Sheet
        open={Boolean(expandedLine)}
        onClose={() => {
          setExpandedPieceId("");
          setPolicyPieceId("");
        }}
        expandable
      >
        {expandedLine ? (
          <ScrollView
            style={styles.policyScroll}
            contentContainerStyle={styles.detailsBody}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sheetTitle}>{expandedLine.piece.name}</Text>
            <Text style={styles.sheetCopy}>
              Sold by {expandedLine.sellerName}
            </Text>
            <Text style={styles.sheetCopy}>
              Based in {getMarket(expandedLine.piece.country || market.code).name}
            </Text>
            <Text style={styles.sheetCopy}>
              Ships from {getMarket(expandedLine.piece.country || market.code).name}
            </Text>
            <Text style={styles.sheetCopy}>
              Buyer destination {address
                ? [address.line1, address.city, address.region, address.postal]
                    .filter(Boolean)
                    .join(", ")
                : "Add a shipping address"}
            </Text>
            <Text style={styles.sheetCopy}>
              Ships to {shipsToLabel(
                expandedLine.piece.country || market.code,
                restrictShipsTo(
                  expandedLine.piece.country || market.code,
                  expandedLine.piece.shipsTo,
                  expandedLine.brand?.operatingCountries,
                ),
              )}
            </Text>

            <Text style={styles.detailsSectionTitle}>Promo code for this item</Text>
            <View style={styles.promoEntry}>
              <TextInput
                value={promoInputs[expandedLine.piece.id] || ""}
                onChangeText={(value) => {
                  const pieceId = expandedLine.piece.id;
                  setPromoInputs((current) => ({ ...current, [pieceId]: value.toUpperCase() }));
                  setPromoMessages((current) => ({ ...current, [pieceId]: "" }));
                  setPromoQuotes((current) => {
                    const next = { ...current };
                    delete next[pieceId];
                    return next;
                  });
                }}
                placeholder="Enter code"
                placeholderTextColor={colors.subtle}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                editable={!promoBusy[expandedLine.piece.id]}
                style={styles.promoInput}
                accessibilityLabel={`Promo code for ${expandedLine.piece.name}`}
              />
              <AccessiblePressable
                onPress={() => void applyPromo(expandedLine.piece.id)}
                disabled={Boolean(promoBusy[expandedLine.piece.id])}
                style={styles.promoButton}
                accessibilityRole="button"
                accessibilityLabel={`Apply promo code to ${expandedLine.piece.name}`}
              >
                <Text style={styles.promoButtonText}>
                  {promoBusy[expandedLine.piece.id]
                    ? "Checking…"
                    : promoQuotes[expandedLine.piece.id]
                      ? "Applied"
                      : "Apply"}
                </Text>
              </AccessiblePressable>
            </View>
            {promoMessages[expandedLine.piece.id] ? (
              <Text
                style={[
                  styles.promoMessage,
                  promoQuotes[expandedLine.piece.id]
                    ? styles.promoSuccess
                    : styles.promoError,
                ]}
              >
                {promoMessages[expandedLine.piece.id]}
              </Text>
            ) : null}
            {expandedLine.discountCents > 0 ? (
              <View style={styles.discountSummary}>
                <Text style={styles.discountLabel}>Discount at checkout</Text>
                <Text style={styles.discountAmount}>
                  −{moneyExact(expandedLine.discountCents, market.currency)}
                </Text>
              </View>
            ) : null}

            <AccessiblePressable
              onPress={() =>
                setPolicyPieceId((current) =>
                  current === expandedLine.piece.id ? "" : expandedLine.piece.id,
                )
              }
              style={styles.policyDisclosure}
              accessibilityRole="button"
              accessibilityLabel={`${expandedLine.policyName} returns policy`}
              accessibilityState={{ expanded: policyPieceId === expandedLine.piece.id }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.detailsSectionTitle}>
                  {expandedLine.policyName} returns policy
                </Text>
                <Text style={styles.policyHint}>
                  {expandedLine.policyMode === "final_sale"
                    ? "Final sale"
                    : `${expandedLine.policyWindow}-day returns`}
                </Text>
              </View>
              <Ionicons
                name={policyPieceId === expandedLine.piece.id ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.success}
              />
            </AccessiblePressable>
            {policyLine?.piece.id === expandedLine.piece.id ? (
              <View style={styles.policyDetails}>
                <Text style={styles.sheetCopy}>
                  {expandedLine.policyMode === "final_sale"
                    ? "This item is final sale, so change-of-mind returns are not accepted."
                    : `You can request a return within ${expandedLine.policyWindow} days after delivery.`}
                </Text>
                <Text style={styles.sheetCopy}>{expandedLine.policyShipping}</Text>
                {expandedLine.brand?.customerPolicyNote ? (
                  <Text style={styles.sheetCopy}>
                    Seller note: {expandedLine.brand.customerPolicyNote}
                  </Text>
                ) : null}
                <Text style={styles.sheetCopy}>
                  Items that arrive damaged, defective, or different from the listing can still be reported to Uvel.
                </Text>
              </View>
            ) : null}
            <View style={styles.detailsTotal}>
              <Text style={styles.discountLabel}>This item’s checkout total</Text>
              <Text style={styles.discountAmount}>
                {moneyExact(expandedLine.totalCents, market.currency)}
              </Text>
            </View>
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
    promotionId: string;
    promotionCode: string;
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
      choice.promotionId,
      choice.promotionCode,
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
    itemDiscount: { color: colors.success, fontSize: 12, fontWeight: "700", marginTop: 4 },
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
    promoTotalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
    promoTotalLabel: { color: colors.success, fontSize: 14, fontWeight: "700" },
    promoTotalValue: { color: colors.success, fontSize: 14, fontWeight: "800" },
    totalRow: {
      minHeight: 60,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
      paddingVertical: 6,
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
    disabled: { opacity: 0.52 },
    payButtonText: { color: colors.ink, fontSize: 17, fontWeight: "600" },
    appleButtonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
    appleGlyph: { color: colors.ink, fontSize: 25, lineHeight: 27, marginTop: -2 },
    secureText: {
      color: colors.bone,
      textAlign: "center",
      fontSize: 14,
      marginTop: 8,
      letterSpacing: 0.1,
    },
    paymentBrands: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 },
    brandTile: { width: 54, height: 36, borderRadius: 8, backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#9A9A9A", alignItems: "center", justifyContent: "center", overflow: "hidden" },
    appleBrand: { width: 46, height: 29 },
    visaBrand: { color: "#163A80", fontSize: 17, fontStyle: "italic", fontWeight: "900", letterSpacing: -1.4 },
    mastercardBrand: { flexDirection: "row", alignItems: "center", justifyContent: "center", width: 42, height: 26 },
    cardCircle: { width: 20, height: 20, borderRadius: 10, marginHorizontal: -3 },
    cardCircleRed: { backgroundColor: "#EB001B" },
    cardCircleOrange: { backgroundColor: "#F79E1B" },
    cardCircleBlue: { backgroundColor: "#2563C7" },
    amexTile: { width: 54, height: 36, borderRadius: 10, backgroundColor: "#2674C8", borderWidth: 2, borderColor: "#9DC7F2", alignItems: "center", justifyContent: "center" },
    amexBrand: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", letterSpacing: -0.5 },
    policyScroll: { flexShrink: 1 },
    policyBody: { paddingBottom: 8 },
    detailsBody: { paddingBottom: 12 },
    breakdownBody: { paddingBottom: 16 },
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
    breakdownItem: { marginTop: 18, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}18` },
    breakdownItemTitle: { color: colors.bone, fontSize: 16, lineHeight: 21, fontWeight: "800" },
    breakdownSeller: { color: colors.muted, fontSize: 13, marginTop: 3, marginBottom: 10 },
    breakdownRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6 },
    breakdownLabel: { color: colors.muted, fontSize: 14 },
    breakdownValue: { color: colors.bone, fontSize: 14, fontVariant: ["tabular-nums"] },
    breakdownDiscountLabel: { color: colors.success, fontSize: 14 },
    breakdownDiscountValue: { color: colors.success, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
    breakdownItemTotal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderColor: `${colors.bone}22`, marginTop: 6, paddingTop: 10 },
    breakdownItemTotalLabel: { color: colors.bone, fontSize: 14, fontWeight: "700" },
    breakdownItemTotalValue: { color: colors.bone, fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },
    breakdownNote: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 14 },
    breakdownGrandTotal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderColor: `${colors.bone}35`, marginTop: 18, paddingTop: 16 },
    breakdownGrandLabel: { color: colors.bone, fontSize: 18, fontWeight: "800" },
    breakdownGrandValue: { color: colors.bone, fontSize: 19, fontWeight: "800", fontVariant: ["tabular-nums"] },
    detailsSectionTitle: { color: colors.bone, fontSize: 16, fontWeight: "800", marginTop: 22 },
    promoEntry: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
    promoInput: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: `${colors.bone}30`, color: colors.bone, paddingHorizontal: 14, fontSize: 15 },
    promoButton: { minWidth: 82, height: 48, borderRadius: 14, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
    promoButtonText: { color: colors.successInk, fontSize: 14, fontWeight: "800" },
    promoMessage: { fontSize: 13, lineHeight: 19, marginTop: 8 },
    promoSuccess: { color: colors.success },
    promoError: { color: colors.danger },
    discountSummary: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingVertical: 10 },
    discountLabel: { color: colors.muted, fontSize: 14 },
    discountAmount: { color: colors.success, fontSize: 15, fontWeight: "800" },
    policyDisclosure: { minHeight: 66, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: `${colors.bone}24`, flexDirection: "row", alignItems: "center", marginTop: 22, gap: 12 },
    policyHint: { color: colors.muted, fontSize: 13, marginTop: 4 },
    policyDetails: { paddingBottom: 14 },
    detailsTotal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderColor: `${colors.bone}24`, paddingTop: 14, marginTop: 12 },
  });
}

function PaymentBrands({ styles }: { styles: ReturnType<typeof make> }) {
  return (
    <View style={styles.paymentBrands} accessibilityLabel="Accepted payment methods">
      <View style={styles.brandTile}>
        <Image source={require("../assets/pay/apple-pay.png")} style={styles.appleBrand} contentFit="contain" />
      </View>
      <View style={styles.brandTile}><Text style={styles.visaBrand}>VISA</Text></View>
      <View style={styles.brandTile}>
        <View style={styles.mastercardBrand}>
          <View style={[styles.cardCircle, styles.cardCircleRed]} />
          <View style={[styles.cardCircle, styles.cardCircleOrange]} />
        </View>
      </View>
      <View style={styles.brandTile}>
        <View style={styles.mastercardBrand}>
          <View style={[styles.cardCircle, styles.cardCircleRed]} />
          <View style={[styles.cardCircle, styles.cardCircleBlue]} />
        </View>
      </View>
      <View style={styles.amexTile}><Text style={styles.amexBrand}>AMEX</Text></View>
    </View>
  );
}
