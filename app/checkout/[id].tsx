import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useStripe } from "@stripe/stripe-react-native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../../components/AccessiblePressable";
import { Sheet } from "../../components/Sheet";
import {
  payMethods,
  shippingCents,
  uvelFeeCents,
  type PayMethod,
} from "../../lib/fees";
import { getMarket, moneyExact, convertCents } from "../../lib/markets";
import { listingVisibleIn, restrictShipsTo } from "../../lib/ships";
import { loadAddress, placeOrder, type Address } from "../../lib/orders";
import {
  createCheckoutSession,
  createStripePaymentIntent,
  openHostedPay,
  paymentsExtra,
  validatePromotion,
  type PromotionQuote,
} from "../../lib/pay";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import {
  getPiece,
  isRemoteListedPiece,
  useMarketplaceSyncState,
  useWardrobe,
} from "../../lib/wardrobe";
import { recordCampaignAttribution } from "../../lib/attribution";
import { removeFromCart } from "../../lib/cart";
import { payWithWallet, useWallet } from "../../lib/wallet";
import { useFirstFind } from "../../lib/firstFind";
import { getBrand } from "../../lib/brands";
import { brandMakes } from "../../lib/brandMake";
import { carriersForListing } from "../../lib/sellerShipping";
import { GroupedCheckout } from "../../components/GroupedCheckout";

export default function Checkout() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const {
    id,
    ids: idsParam,
    variantKey: variantParam,
    variantLabel: variantLabelParam,
    campaignId,
    collectionId,
    promotionId,
    campaignChannel,
  } = useLocalSearchParams<{
    id: string;
    ids?: string | string[];
    variantKey?: string;
    variantLabel?: string;
    campaignId?: string;
    collectionId?: string;
    promotionId?: string;
    campaignChannel?: string;
  }>();
  const checkoutIds = useMemo(() => {
    const supplied = Array.isArray(idsParam)
      ? idsParam
      : typeof idsParam === "string"
        ? idsParam.split(",")
        : [];
    const normalized = Array.from(
      new Set(supplied.map((value) => value.trim()).filter(Boolean)),
    );
    return normalized.length ? normalized : id ? [id] : [];
  }, [idsParam, id]);
  useWardrobe();
  const marketplaceSync = useMarketplaceSyncState();
  const piece = getPiece(id);
  const brand = piece?.brandId ? getBrand(piece.brandId) : undefined;
  const making = Boolean(brand && brandMakes(brand));
  const selectedVariant = typeof variantParam === "string" ? variantParam : "";
  const selectedVariantLabel =
    typeof variantLabelParam === "string" ? variantLabelParam : selectedVariant;
  const app = useUvel();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const market = getMarket(app.country);
  const methods = payMethods(market.code);
  const [address, setAddress] = useState<Address | null>(null);
  const [ship, setShip] = useState<"standard" | "express">("standard");
  const [carrierId, setCarrierId] = useState("");
  const [pay, setPay] = useState(methods[0]?.id ?? "apple");
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [feeInfo, setFeeInfo] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionQuote, setPromotionQuote] = useState<PromotionQuote | null>(
    null,
  );
  const [promotionBusy, setPromotionBusy] = useState(false);
  const [promotionMessage, setPromotionMessage] = useState("");

  useFocusEffect(
    useCallback(() => {
      void loadAddress().then(setAddress);
    }, []),
  );

  const currency = piece?.currency || "USD";
  const item = piece?.listPriceCents || 0;
  const itemLocal = piece ? convertCents(item, currency, market) : 0;
  const fee = piece ? uvelFeeCents(item, currency, market) : 0;
  const discountCents = Math.min(itemLocal, promotionQuote?.discountCents || 0);
  const discountedItem = Math.max(0, itemLocal - discountCents);
  const firstFind = useFirstFind();
  const creditCents = piece ? firstFind.applyTo(piece, discountedItem) : 0;
  const billedItem = Math.max(0, discountedItem - creditCents);
  const effectiveShipsTo = piece
    ? restrictShipsTo(
        piece.country || market.code,
        piece.shipsTo,
        brand?.operatingCountries,
      )
    : undefined;
  const sellsHere = piece
    ? listingVisibleIn({
        origin: piece.country,
        shipsTo: effectiveShipsTo,
        buyer: market.code,
      })
    : false;
  const addressOk =
    piece && address
      ? listingVisibleIn({
          origin: piece.country,
          shipsTo: effectiveShipsTo,
          buyer: address.country,
        })
      : false;
  const availabilityConfirmed =
    marketplaceSync === "confirmed" && isRemoteListedPiece(piece?.id || "");
  const same = Boolean(
    address && piece && address.country === (piece.country || market.code),
  );
  const carrierOptions =
    piece && !making
      ? carriersForListing(
          piece.country || market.code,
          piece.shippingCarriers,
          piece.shippingMethod || "dropoff",
        )
      : [];
  const selectedCarrier =
    carrierOptions.find((carrier) => carrier.id === carrierId) ||
    carrierOptions[0];
  const effectiveShip = selectedCarrier?.speed || ship;
  const buyerPaysShipping = piece?.shippingBuyerPays !== false || making;
  const shipCost =
    address && addressOk && buyerPaysShipping
      ? shippingCents(same, effectiveShip === "express", market)
      : 0;
  const total = billedItem + fee + shipCost;
  const wallet = useWallet(market.currency);
  const walletCovers = wallet.availableCents >= total && total > 0;
  const method = methods.find((m) => m.id === pay) ?? methods[0];
  const policyName = brand?.name || piece?.brand || "Brand";
  const policyMode = brand?.customerPolicyMode || "standard_returns";
  const policyWindow = brand?.customerReturnWindowDays || 14;
  const policyShipping =
    brand?.customerReturnShipping === "brand"
      ? "The brand covers return shipping."
      : "The buyer covers return shipping.";

  useEffect(() => {
    const linkedPromotionId =
      typeof promotionId === "string" ? promotionId.trim() : "";
    if (!linkedPromotionId || !piece || promotionQuote || promotionBusy) return;
    setPromotionBusy(true);
    void validatePromotion({
      brandId: piece.brandId || "",
      listingId: piece.id,
      promotionId: linkedPromotionId,
      currency: market.currency,
      itemCents: itemLocal,
    })
      .then((quote) => {
        setPromotionQuote(quote);
        setPromotionCode(quote.code);
        setPromotionMessage(
          `${quote.code} applied · ${quote.kind === "percentage" ? `${quote.value}% off` : `${moneyExact(quote.discountCents, market.currency)} off`}`,
        );
      })
      .catch(() =>
        setPromotionMessage(
          "The campaign promotion is not active for this listing.",
        ),
      )
      .finally(() => setPromotionBusy(false));
  }, [promotionId, piece?.brandId, piece?.id, market.currency, itemLocal]);

  useEffect(() => {
    if (
      carrierOptions.length &&
      !carrierOptions.some((carrier) => carrier.id === carrierId)
    )
      setCarrierId(carrierOptions[0].id);
  }, [carrierOptions.map((carrier) => carrier.id).join(",")]);

  if (checkoutIds.length > 1) return <GroupedCheckout ids={checkoutIds} />;

  async function applyPromotion() {
    if (!piece || promotionBusy) return;
    const code = promotionCode.trim().toUpperCase();
    const linkedPromotionId =
      !code && typeof promotionId === "string" ? promotionId.trim() : "";
    if (!code && !linkedPromotionId) {
      setPromotionMessage("Enter a promotion code first.");
      return;
    }
    setPromotionBusy(true);
    setPromotionMessage("");
    try {
      const quote = await validatePromotion({
        brandId: piece.brandId || "",
        listingId: piece.id,
        promotionId: linkedPromotionId || undefined,
        code: code || undefined,
        currency: market.currency,
        itemCents: itemLocal,
      });
      setPromotionQuote(quote);
      setPromotionCode(quote.code);
      setPromotionMessage(
        `${quote.code} applied · ${quote.kind === "percentage" ? `${quote.value}% off` : `${moneyExact(quote.discountCents, market.currency)} off`}`,
      );
    } catch (error) {
      setPromotionQuote(null);
      const raw = error instanceof Error ? error.message : String(error || "");
      setPromotionMessage(
        /not-found|404|not connected|unavailable/i.test(raw)
          ? "Promotions will be available when Firebase checkout is deployed."
          : raw || "That promotion is not valid for this listing.",
      );
    } finally {
      setPromotionBusy(false);
    }
  }

  if (!piece) {
    return (
      <View
        style={[
          styles.page,
          { paddingTop: insets.top + 24, paddingHorizontal: 20 },
        ]}
      >
        <Text style={{ color: colors.muted }}>That listing isn’t here.</Text>
      </View>
    );
  }

  const variantTracked = Boolean(piece.brandId && piece.sizeStock);
  const selectedStock =
    selectedVariant && piece.sizeStock
      ? piece.sizeStock[selectedVariant]
      : piece.stockQuantity;
  const inventoryAvailable =
    !variantTracked || (typeof selectedStock === "number" && selectedStock > 0);
  const needsVariant =
    variantTracked &&
    Boolean(piece.sizes?.length || piece.size) &&
    !selectedVariant;
  const ready =
    Boolean(address) &&
    addressOk &&
    sellsHere &&
    !paying &&
    piece.status === "listed" &&
    inventoryAvailable &&
    !needsVariant;

  async function payNow() {
    if (!address || !piece) return;
    if (piece.sellerPaused) {
      Alert.alert(
        "Listing unavailable",
        "This listing is currently unavailable while the seller has paused their listings.",
      );
      return;
    }
    if (!availabilityConfirmed) {
      Alert.alert(
        "Availability unavailable",
        marketplaceSync === "loading"
          ? "Uvel is still checking this listing. Try again in a moment."
          : "Uvel could not confirm this listing with the marketplace service. Checkout is paused.",
      );
      return;
    }
    if (!sellsHere || !addressOk) {
      Alert.alert(
        "Wrong store",
        "This seller doesn’t ship this piece to that country.",
      );
      return;
    }
    if (needsVariant) {
      Alert.alert(
        "Choose a size",
        "Go back to the listing and choose an available size first.",
      );
      return;
    }
    if (!inventoryAvailable) {
      Alert.alert("Sold out", "That size is no longer available.");
      return;
    }
    setPaying(true);
    try {
      if (!app.uid) throw new Error("Sign in before checking out.");
      const order = await placeOrder({
        pieceId: piece.id,
        pieceName: piece.name,
        piecePhoto: piece.photo,
        brandId: piece.brandId,
        variantKey: selectedVariant || undefined,
        variantLabel: selectedVariantLabel || undefined,
        buyerId: app.uid,
        sellerId: piece.ownerId || "seller",
        itemCents: itemLocal,
        feeCents: fee,
        discountCents: discountCents || undefined,
        creditCents: creditCents || undefined,
        promotionId: promotionQuote?.promotionId,
        promotionCode: promotionQuote?.code,
        promotionSource: promotionQuote?.source,
        shipCents: shipCost,
        taxCents: 0,
        totalCents: total,
        currency: market.currency,
        country: address.country,
        payMethod: method.label,
        delivery: selectedCarrier
          ? `${selectedCarrier.name} · ${effectiveShip}`
          : ship,
        carrier: selectedCarrier?.name,
        address,
        madeByUvel: making,
      });
      if (piece.brandId && typeof campaignId === "string" && campaignId)
        void recordCampaignAttribution({
          brandId: piece.brandId,
          campaignId,
          channel: campaignChannel === "shop" ? "shop" : "brand_page",
          collectionId:
            typeof collectionId === "string" ? collectionId : undefined,
          promotionId:
            typeof promotionId === "string" ? promotionId : undefined,
          type: "checkout_started",
          listingId: piece.id,
          orderId: order.id,
          currency: market.currency,
          eventId: `checkout_started_${order.id}`,
        }).catch(() => undefined);
      if (walletCovers) {
        await payWithWallet(order.id);
        removeFromCart(piece.id);
        router.replace({ pathname: "/order/[id]", params: { id: order.id } });
        return;
      }
      if (market.code === "US") {
        if (!paymentsExtra.stripePk)
          throw new Error("Stripe checkout is not configured yet.");
        const intent = await createStripePaymentIntent(order.id);
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
        if (presented.error) throw new Error(presented.error.message);
        removeFromCart(piece.id);
        router.replace({ pathname: "/order/[id]", params: { id: order.id } });
        return;
      }
      const session = await createCheckoutSession({
        amountCents: total,
        currency: market.currency,
        email: app.email || "pay@uvel.app",
        method: method.id,
        country: market.code,
        reference: `uvel-${piece.id}-${Date.now()}`,
        name: piece.name,
        orderId: order.id,
        listingId: piece.id,
        brandId: piece.brandId || "",
        variantKey: selectedVariant,
        campaignId: typeof campaignId === "string" ? campaignId : undefined,
        collectionId:
          typeof collectionId === "string" ? collectionId : undefined,
        promotionId: promotionQuote?.promotionId,
        promotionCode: promotionQuote?.code,
      });
      if (!session.url) throw new Error("That payment method isn’t live yet.");
      const ok = await openHostedPay(session.url);
      if (!ok) return;
      // Hosted checkout returning only means the payment page completed.
      // A trusted payment webhook must confirm payment before marking inventory sold.
      removeFromCart(piece.id);
      router.replace({ pathname: "/order/[id]", params: { id: order.id } });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e || "");
      const unavailable = /not-found|404|function.*not.*found/i.test(raw);
      Alert.alert(
        "Payment",
        unavailable
          ? "Stripe checkout is not connected yet. The Firebase payment function has not been deployed. Upgrade Firebase to Blaze, deploy the Functions, then try again."
          : raw || "Couldn’t complete that.",
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
          accessibilityLabel="Go back"
        >
          <Text style={styles.navBack}>‹</Text>
        </AccessiblePressable>
        <Text style={styles.navTitle}>Checkout</Text>
        <View style={styles.navBtn} />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 390 }}
        showsVerticalScrollIndicator={false}
      >
        {!availabilityConfirmed ? (
          <Text style={[styles.notice, { color: colors.warning }]}>
            {marketplaceSync === "loading"
              ? "Checking availability…"
              : "Checkout is paused until the marketplace reconnects."}
          </Text>
        ) : null}
        {!sellsHere ? (
          <Text style={[styles.notice, { color: colors.danger }]}>
            This piece isn’t on the {market.name} floor.
          </Text>
        ) : null}
        {address && !addressOk ? (
          <Text style={[styles.notice, { color: colors.danger }]}>
            This seller doesn’t ship to {getMarket(address.country).name}.
          </Text>
        ) : null}
        <View style={styles.productHero}>
          <Image
            cachePolicy="memory-disk"
            source={{ uri: piece.photo }}
            style={styles.heroImage}
            contentFit="cover"
          />
          <View style={styles.priceBadge}>
            <Text style={styles.priceBadgeText}>
              {moneyExact(itemLocal, market.currency)}
            </Text>
          </View>
        </View>
        <Text style={styles.heroName} numberOfLines={2}>
          {piece.name}
        </Text>
        <Text style={styles.heroMeta}>
          {[
            selectedVariantLabel || piece.size,
            piece.color,
            piece.brand === "Unlabeled" ? "Uvel" : piece.brand,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <View style={styles.detailRow}>
          <View style={styles.detailCopy}>
            <Text style={styles.detailLabel}>Total</Text>
            <Text style={styles.detailSub}>
              {promotionQuote
                ? `${promotionQuote.code} applied · includes shipping and buyer protection`
                : "Includes shipping and buyer protection"}
            </Text>
          </View>
          <Text style={styles.detailValue}>
            {moneyExact(walletCovers ? 0 : total, market.currency)}
          </Text>
          <AccessiblePressable
            onPress={() => setFeeInfo(true)}
            style={styles.chevronButton}
            accessibilityRole="button"
            accessibilityLabel="View price details"
          >
            <Text style={styles.chevron}>›</Text>
          </AccessiblePressable>
        </View>
        <View style={styles.rule} />
        <AccessiblePressable
          onPress={() => router.push("/address")}
          style={styles.detailRow}
          accessibilityRole="button"
          accessibilityLabel={
            address
              ? `Shipping to ${address.name}, ${address.city}. Edit address.`
              : "Add shipping address"
          }
        >
          <View style={styles.detailCopy}>
            <Text style={styles.detailLabel}>Ships to</Text>
            <Text style={styles.detailSub} numberOfLines={1}>
              {address
                ? `${address.line1}, ${address.city}`
                : "Add your shipping address"}
            </Text>
            {address && addressOk ? (
              <Text style={styles.detailMeta}>
                {selectedCarrier
                  ? `${selectedCarrier.name} · ${effectiveShip === "express" ? "Express" : "Standard"} · ${moneyExact(shipCost, market.currency)}`
                  : `${effectiveShip === "express" ? "Express" : "Standard"} delivery · ${moneyExact(shipCost, market.currency)}`}
              </Text>
            ) : null}
          </View>
          <Text style={styles.chevron}>›</Text>
        </AccessiblePressable>
        <View style={styles.rule} />
        <View style={styles.paymentHeading}>
          <Text style={styles.detailLabel}>Payment</Text>
        </View>
        <AccessiblePressable
          onPress={() => setPayOpen(true)}
          style={styles.paymentRow}
          accessibilityRole="button"
          accessibilityLabel={`Payment method: ${method.label}. Change payment method.`}
        >
          <PayMark method={method} />
          <Text style={styles.paymentName}>{method.label}</Text>
          <Text style={styles.changeText}>Change</Text>
        </AccessiblePressable>
        <View style={styles.rule} />
        <AccessiblePressable
          onPress={() => setPolicyOpen(true)}
          style={styles.secondaryRow}
          accessibilityRole="button"
          accessibilityLabel={`${policyName} returns policy`}
        >
          <Text style={styles.secondaryText}>
            {policyMode === "final_sale"
              ? "Final sale"
              : `${policyWindow}-day returns`}{" "}
            · Purchase protection
          </Text>
          <Text style={styles.chevron}>›</Text>
        </AccessiblePressable>
        <AccessiblePressable
          onPress={() => setPromotionOpen(true)}
          style={styles.secondaryRow}
          accessibilityRole="button"
          accessibilityLabel="Enter a promotion code"
        >
          <Text style={styles.secondaryText}>
            {promotionQuote
              ? `${promotionQuote.code} applied`
              : "Have a promo code?"}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </AccessiblePressable>
      </ScrollView>
      <View
        style={[styles.purchasePanel, { paddingBottom: insets.bottom + 14 }]}
      >
        <AccessiblePressable
          onPress={() => void payNow()}
          disabled={!ready || !availabilityConfirmed}
          style={[
            styles.payBtn,
            (!ready || !availabilityConfirmed) && styles.payDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            paying
              ? "Processing payment"
              : `Pay ${moneyExact(total, market.currency)} with ${method.label}`
          }
          accessibilityState={{
            disabled: !ready || !availabilityConfirmed,
            busy: paying,
          }}
        >
          {paying ? (
            <Text style={styles.payTxt}>Paying…</Text>
          ) : walletCovers ? (
            <Text style={styles.payTxt}>Pay with Uvel balance</Text>
          ) : method.kind === "apple" ? (
            <View style={styles.appleButtonContent}>
              <Text style={styles.payTxt}>Buy with</Text>
              <Text style={styles.appleGlyph}></Text>
              <Text style={styles.payTxt}>Pay</Text>
            </View>
          ) : (
            <Text style={styles.payTxt}>Pay with {method.label}</Text>
          )}
        </AccessiblePressable>
        <Text style={styles.secureText}>
          This payment will be processed by Stripe
        </Text>
        <PaymentBrands styles={styles} />
      </View>
      {feeInfo ? (
        <Sheet open={feeInfo} onClose={() => setFeeInfo(false)}>
          <Text style={styles.sheetH}>Price details</Text>
          <View style={styles.sheetLine}>
            <Text style={styles.sheetLineLabel}>Item</Text>
            <Text style={styles.sheetLineValue}>
              {moneyExact(itemLocal, market.currency)}
            </Text>
          </View>
          {discountCents > 0 ? (
            <View style={styles.sheetLine}>
              <Text style={styles.sheetLineLabel}>Promotion</Text>
              <Text style={styles.discountValue}>
                −{moneyExact(discountCents, market.currency)}
              </Text>
            </View>
          ) : null}
          {creditCents > 0 ? (
            <View style={styles.sheetLine}>
              <Text style={styles.sheetLineLabel}>First Find</Text>
              <Text style={styles.discountValue}>
                −{moneyExact(creditCents, market.currency)}
              </Text>
            </View>
          ) : null}
          <View style={styles.sheetLine}>
            <Text style={styles.sheetLineLabel}>Buyer protection</Text>
            <Text style={styles.sheetLineValue}>
              {moneyExact(fee, market.currency)}
            </Text>
          </View>
          <View style={styles.sheetLine}>
            <Text style={styles.sheetLineLabel}>Shipping</Text>
            <Text style={styles.sheetLineValue}>
              {moneyExact(shipCost, market.currency)}
            </Text>
          </View>
          <View style={styles.sheetTotalLine}>
            <Text style={styles.sheetTotalLabel}>Total</Text>
            <Text style={styles.sheetTotalValue}>
              {moneyExact(walletCovers ? 0 : total, market.currency)}
            </Text>
          </View>
          <AccessiblePressable
            onPress={() => setFeeInfo(false)}
            style={styles.sheetBtn}
            accessibilityRole="button"
            accessibilityLabel="Close price details"
          >
            <Text style={styles.sheetBtnT}>Done</Text>
          </AccessiblePressable>
        </Sheet>
      ) : null}
      <Sheet open={policyOpen} onClose={() => setPolicyOpen(false)} expandable>
        <ScrollView
          style={styles.policyScroll}
          contentContainerStyle={styles.policyContent}
          showsVerticalScrollIndicator
        >
          <Text style={styles.sheetH}>{policyName} returns policy</Text>
          {policyMode === "final_sale" ? (
            <>
              <Text style={styles.sheetP}>
                This item is final sale, so change-of-mind returns are not
                accepted.
              </Text>
              <Text style={styles.sheetP}>
                If the item arrives damaged, defective, or different from the
                listing, contact Uvel support and we’ll help review it.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.sheetP}>
                You can request a return within {policyWindow} days after
                delivery.
              </Text>
              <Text style={styles.sheetP}>{policyShipping}</Text>
              <Text style={styles.sheetP}>
                Items that arrive damaged, defective, or different from the
                listing can still be reported to Uvel.
              </Text>
            </>
          )}
          {brand?.customerPolicyNote ? (
            <Text style={styles.sheetP}>
              Brand note: {brand.customerPolicyNote}
            </Text>
          ) : null}
        </ScrollView>
        <AccessiblePressable
          onPress={() => setPolicyOpen(false)}
          style={styles.sheetBtn}
          accessibilityRole="button"
          accessibilityLabel="Close returns policy"
        >
          <Text style={styles.sheetBtnT}>Done</Text>
        </AccessiblePressable>
      </Sheet>
      <Sheet open={promotionOpen} onClose={() => setPromotionOpen(false)}>
        <Text style={styles.sheetH}>Promotion code</Text>
        <Text style={styles.sheetP}>
          Apply a code to this item before you pay.
        </Text>
        <View style={styles.promotionBox}>
          <TextInput
            value={promotionCode}
            onChangeText={(value) => {
              setPromotionCode(value.toUpperCase());
              if (promotionQuote) {
                setPromotionQuote(null);
                setPromotionMessage("");
              }
            }}
            placeholder="Enter code"
            placeholderTextColor={colors.subtle}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            style={styles.promotionInput}
            editable={!promotionBusy}
            accessibilityLabel="Promotion code"
          />
          <AccessiblePressable
            onPress={() => void applyPromotion()}
            disabled={promotionBusy}
            style={styles.promotionButton}
            accessibilityRole="button"
            accessibilityLabel="Apply promotion code"
          >
            <Text style={styles.promotionButtonTxt}>
              {promotionBusy
                ? "Checking…"
                : promotionQuote
                  ? "Applied"
                  : "Apply"}
            </Text>
          </AccessiblePressable>
        </View>
        {promotionMessage ? (
          <Text
            style={[
              styles.promotionMessage,
              promotionQuote ? styles.promotionGood : styles.promotionBad,
            ]}
          >
            {promotionMessage}
          </Text>
        ) : null}
        <AccessiblePressable
          onPress={() => setPromotionOpen(false)}
          style={styles.sheetBtn}
          accessibilityRole="button"
          accessibilityLabel="Close promotion code"
        >
          <Text style={styles.sheetBtnT}>Done</Text>
        </AccessiblePressable>
      </Sheet>
      <Sheet open={payOpen} onClose={() => setPayOpen(false)}>
        <Text style={styles.sheetH}>Payment method</Text>
        <Text style={styles.sheetP}>Choose how you’d like to pay.</Text>
        {methods.map((m) => (
          <AccessiblePressable
            key={m.id}
            onPress={() => {
              setPay(m.id);
              setPayOpen(false);
            }}
            style={styles.pick}
            accessibilityRole="radio"
            accessibilityLabel={m.label}
            accessibilityState={{ selected: pay === m.id }}
          >
            <PayMark method={m} />
            <Text style={styles.paymentName}>{m.label}</Text>
            {pay === m.id ? <Text style={styles.tick}>✓</Text> : null}
          </AccessiblePressable>
        ))}
      </Sheet>
    </View>
  );
}

function PayMark({ method }: { method: PayMethod }) {
  const src =
    method.icon === "apple"
      ? require("../../assets/pay/apple-pay.png")
      : method.icon === "momo"
        ? require("../../assets/pay/mtn-momo.png")
        : method.icon === "telecel"
          ? require("../../assets/pay/telecel.png")
          : method.icon === "card"
            ? require("../../assets/pay/card.png")
            : null;
  if (!src) {
    return (
      <View style={mark.box}>
        <Text style={mark.txt}>{method.label.slice(0, 1)}</Text>
      </View>
    );
  }
  const apple = method.icon === "apple";
  const card = method.icon === "card";
  return (
    <View style={[mark.wrap, apple && { backgroundColor: "transparent" }]}>
      <Image
        cachePolicy="memory-disk"
        source={src}
        style={apple ? mark.apple : card ? mark.card : mark.sq}
        contentFit="contain"
      />
    </View>
  );
}

function PaymentBrands({ styles }: { styles: ReturnType<typeof make> }) {
  return (
    <View
      style={styles.paymentBrands}
      accessibilityLabel="Accepted payment methods"
    >
      <View style={styles.brandTile}>
        <Image
          source={require("../../assets/pay/apple-pay.png")}
          style={styles.appleBrand}
          contentFit="contain"
        />
      </View>
      <View style={styles.brandTile}>
        <Text style={styles.visaBrand}>VISA</Text>
      </View>
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
      <View style={styles.amexTile}>
        <Text style={styles.amexBrand}>AMEX</Text>
      </View>
    </View>
  );
}

const mark = StyleSheet.create({
  wrap: {
    height: 28,
    minWidth: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  apple: { width: 46, height: 28 },
  card: { width: 52, height: 22 },
  sq: { width: 28, height: 28 },
  box: {
    width: 36,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  txt: { color: "#111", fontWeight: "800", fontSize: 11 },
});

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    nav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingBottom: 8,
    },
    navBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    navBack: {
      color: colors.bone,
      fontSize: 36,
      lineHeight: 38,
      marginTop: -4,
    },
    navTitle: { color: colors.bone, fontSize: 18, fontWeight: "700" },
    notice: {
      marginHorizontal: 20,
      marginBottom: 8,
      fontSize: 12,
      lineHeight: 17,
    },
    productHero: {
      marginHorizontal: 20,
      height: 360,
      borderRadius: 28,
      overflow: "hidden",
      backgroundColor: colors.surface,
      position: "relative",
    },
    heroImage: { width: "100%", height: "100%" },
    priceBadge: {
      position: "absolute",
      right: 16,
      top: 16,
      minWidth: 76,
      paddingHorizontal: 14,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    priceBadgeText: {
      color: colors.successInk,
      fontSize: 16,
      fontWeight: "800",
    },
    heroName: {
      color: colors.bone,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "700",
      marginHorizontal: 24,
      marginTop: 16,
    },
    heroMeta: {
      color: colors.muted,
      fontSize: 14,
      marginHorizontal: 24,
      marginTop: 5,
      marginBottom: 12,
    },
    detailRow: {
      minHeight: 70,
      marginHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    detailCopy: { flex: 1, minWidth: 0 },
    detailLabel: { color: colors.bone, fontSize: 17, fontWeight: "700" },
    detailSub: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 3,
    },
    detailMeta: {
      color: colors.subtle,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },
    detailValue: {
      color: colors.bone,
      fontSize: 18,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
    chevronButton: {
      width: 26,
      height: 44,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    chevron: {
      color: colors.success,
      fontSize: 32,
      lineHeight: 34,
      fontWeight: "300",
    },
    rule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: `${colors.bone}24`,
      marginHorizontal: 20,
    },
    paymentHeading: {
      marginHorizontal: 20,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    paymentRow: {
      minHeight: 64,
      marginHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    paymentName: {
      color: colors.bone,
      fontSize: 16,
      fontWeight: "600",
      flex: 1,
    },
    changeText: { color: colors.muted, fontSize: 14 },
    secondaryRow: {
      minHeight: 52,
      marginHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    secondaryText: { color: colors.muted, fontSize: 14 },
    appliedPromo: {
      color: colors.success,
      marginHorizontal: 20,
      fontSize: 12,
      marginBottom: 12,
    },
    purchasePanel: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "#262626",
      paddingHorizontal: 20,
      paddingTop: 14,
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 18,
      elevation: 12,
    },
    payBtn: {
      height: 56,
      borderRadius: 28,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },
    payDisabled: { opacity: 0.42 },
    payTxt: { color: "#111111", fontSize: 18, fontWeight: "500" },
    appleButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    appleGlyph: {
      color: "#111111",
      fontSize: 27,
      lineHeight: 29,
      marginTop: -2,
    },
    secureText: {
      color: "#F4F4F4",
      textAlign: "center",
      fontSize: 14,
      marginTop: 12,
      letterSpacing: 0.1,
    },
    paymentBrands: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 11,
    },
    brandTile: {
      width: 60,
      height: 42,
      borderRadius: 8,
      backgroundColor: "#FFFFFF",
      borderWidth: 2,
      borderColor: "#9A9A9A",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    appleBrand: { width: 50, height: 32 },
    visaBrand: {
      color: "#163A80",
      fontSize: 19,
      fontStyle: "italic",
      fontWeight: "900",
      letterSpacing: -1.4,
    },
    mastercardBrand: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      width: 46,
      height: 30,
    },
    cardCircle: {
      width: 23,
      height: 23,
      borderRadius: 12,
      marginHorizontal: -4,
    },
    cardCircleRed: { backgroundColor: "#EB001B" },
    cardCircleOrange: { backgroundColor: "#F79E1B" },
    cardCircleBlue: { backgroundColor: "#2563C7" },
    amexTile: {
      width: 60,
      height: 42,
      borderRadius: 12,
      backgroundColor: "#2674C8",
      borderWidth: 2,
      borderColor: "#9DC7F2",
      alignItems: "center",
      justifyContent: "center",
    },
    amexBrand: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    sheetH: {
      color: colors.bone,
      fontSize: 25,
      lineHeight: 31,
      fontWeight: "800",
      letterSpacing: -0.35,
    },
    sheetP: {
      color: `${colors.bone}E0`,
      marginTop: 12,
      lineHeight: 24,
      fontSize: 16,
    },
    sheetLine: {
      minHeight: 42,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sheetLineLabel: { color: colors.muted, fontSize: 15 },
    sheetLineValue: {
      color: colors.bone,
      fontSize: 15,
      fontVariant: ["tabular-nums"],
    },
    sheetTotalLine: {
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: `${colors.bone}2E`,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    sheetTotalLabel: { color: colors.bone, fontSize: 17, fontWeight: "800" },
    sheetTotalValue: { color: colors.bone, fontSize: 18, fontWeight: "800" },
    discountValue: { color: colors.success, fontSize: 15, fontWeight: "700" },
    sheetBtn: {
      minHeight: 50,
      marginTop: 18,
      borderRadius: 25,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetBtnT: { color: colors.successInk, fontWeight: "800" },
    policyScroll: { flexShrink: 1 },
    policyContent: { paddingBottom: 6 },
    promotionBox: {
      minHeight: 52,
      marginTop: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.subtle,
      backgroundColor: colors.neutral,
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 14,
      overflow: "hidden",
    },
    promotionInput: {
      flex: 1,
      height: 50,
      color: colors.bone,
      fontSize: 15,
      fontWeight: "600",
    },
    promotionButton: {
      alignSelf: "stretch",
      minWidth: 78,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.success,
      paddingHorizontal: 13,
    },
    promotionButtonTxt: {
      color: colors.successInk,
      fontSize: 13,
      fontWeight: "800",
    },
    promotionMessage: { marginTop: 8, fontSize: 12, lineHeight: 16 },
    promotionGood: { color: colors.success },
    promotionBad: { color: colors.danger },
    pick: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: `${colors.bone}1A`,
    },
    tick: { color: colors.success, fontWeight: "700" },
  });
}
