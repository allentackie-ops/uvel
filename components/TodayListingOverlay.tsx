import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { LinkDisplay, PlatformPay, useStripe } from "@stripe/stripe-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "../lib/haptics";
import { getBrand, type Brand } from "../lib/brands";
import { addToCart, removeFromCart, useCart } from "../lib/cart";
import { convertCents, getMarket, moneyInMarket } from "../lib/markets";
import { payMethods, shippingCents, uvelFeeCents, type PayMethod } from "../lib/fees";
import { loadLastPaymentMethod, rememberLastPaymentMethod } from "../lib/paymentPreference";
import { loadAddress, placeOrder } from "../lib/orders";
import { createCheckoutSession, createStripePaymentIntent, openHostedPay, paymentsExtra, stripePaymentSheetAddress } from "../lib/pay";
import { mirrorCheckoutOrder } from "../lib/supabaseCheckout";
import { payWithWallet, useWallet } from "../lib/wallet";
import { listingVisibleIn, restrictShipsTo } from "../lib/ships";
import { carriersForListing } from "../lib/sellerShipping";
import { brandMakes } from "../lib/brandMake";
import { useUvel } from "../lib/store";
import { recordListingView } from "../lib/alerts";
import { recordListingTrendSignal, type TrendInteraction } from "../lib/trending";
import { shopFloor, useWardrobe, type ClosetPiece } from "../lib/wardrobe";
import type { PersonalizationAction } from "../lib/personalization";
import { MARKET_RED, useColors, type Colors } from "../lib/theme";
import { TodayCartFab } from "./TodayCartFab";
import { FriendShareSheet, type FriendSharePayload } from "./FriendShareSheet";

export type ListingOrigin = { x: number; y: number; width: number; height: number; radius?: number; radii?: [number, number, number, number]; photo?: string; measure?: (callback: (rect: { x: number; y: number; width: number; height: number }) => void) => void };
type Props = { piece: ClosetPiece; origin: ListingOrigin; onClose: () => void; onInteraction?: (action: PersonalizationAction, piece: ClosetPiece, query?: string, dwellSeconds?: number) => void; previewOnly?: boolean; showDoubleTapHint?: boolean; onDoubleTapHintDismiss?: () => void; firstListing?: boolean; reserveTabBarSpace?: boolean; closeMode?: "animated" | "instant" };
type TransitionRect = { x: number; y: number; width: number; height: number; radius: number };

export function TodayListingOverlay({ piece, origin, onClose, onInteraction, previewOnly = false, reserveTabBarSpace = false, closeMode = "animated" }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const colors = useColors();
  const styles = makeStyles(colors);
  const app = useUvel();
  const wardrobePieces = useWardrobe();
  useEffect(() => {
    const sellerUid = piece.ownerId || piece.listedByUid || "";
    if (!app.uid || previewOnly || (piece.status !== "listed" && piece.status !== "sold") || sellerUid === app.uid) return;
    void recordListingView(app.uid, piece.id);
  }, [app.uid, piece.id, piece.listedByUid, piece.ownerId, piece.status, previewOnly]);
  const { confirmPlatformPayPayment, initPaymentSheet, presentPaymentSheet } = useStripe();
  const cart = useCart();
  const brand = piece.brandId ? getBrand(piece.brandId) : undefined;
  const market = getMarket(app.country);
  const sellerId = piece.ownerId || piece.listedByUid || "";
  const trendOpenedAt = useRef(Date.now());
  const trendDwellRecorded = useRef(false);
  const recordTrendSignal = useCallback((interaction: Exclude<TrendInteraction, "qualified_view">) => {
    if (previewOnly || piece.status !== "listed" || (sellerId && sellerId === app.uid)) return;
    void recordListingTrendSignal({ listingId: piece.id, marketCode: market.code, interaction });
  }, [app.uid, market.code, piece.id, piece.status, previewOnly, sellerId]);
  const recordQualifiedDwell = useCallback(() => {
    if (trendDwellRecorded.current || previewOnly || piece.status !== "listed" || (sellerId && sellerId === app.uid)) return;
    const dwellSeconds = Math.floor((Date.now() - trendOpenedAt.current) / 1000);
    if (dwellSeconds < 10) return;
    trendDwellRecorded.current = true;
    void recordListingTrendSignal({ listingId: piece.id, marketCode: market.code, interaction: "qualified_view", dwellSeconds });
  }, [app.uid, market.code, piece.id, piece.status, previewOnly, sellerId]);
  useEffect(() => {
    trendOpenedAt.current = Date.now();
    trendDwellRecorded.current = false;
    return () => recordQualifiedDwell();
  }, [market.code, piece.id, piece.status, recordQualifiedDwell]);
  const methods = payMethods(market.code);
  const [paymentMethodId, setPaymentMethodId] = useState(methods[0]?.id || "card");
  const [paymentPreferenceReady, setPaymentPreferenceReady] = useState(false);
  useEffect(() => {
    let live = true;
    setPaymentPreferenceReady(false);
    setPaymentMethodId(methods[0]?.id || "card");
    void loadLastPaymentMethod(market.code).then((last) => {
      if (!live) return;
      if (last && methods.some((method) => method.id === last)) setPaymentMethodId(last);
      setPaymentPreferenceReady(true);
    });
    return () => { live = false; };
  }, [market.code]);
  const paymentMethod = methods.find((method) => method.id === paymentMethodId) || methods[0];
  const wallet = useWallet(market.currency);
  const [paying, setPaying] = useState(false);
  const footerBottom = reserveTabBarSpace ? 64 + Math.max(insets.bottom, 8) : 0;
  const footerBottomPadding = reserveTabBarSpace ? 0 : Math.max(insets.bottom, 8);
  const paymentButtonLabel = !paymentPreferenceReady
    ? "Loading payment…"
    : paymentMethod?.kind === "apple"
    ? "Pay"
    : paymentMethod?.kind === "card"
      ? "Pay with Card"
        : paymentMethod
        ? `Pay with ${paymentMethod.label}`
        : "Buy now";
  const paymentAccessibilityLabel = paymentMethod?.kind === "apple" ? "Pay with Apple Pay" : paymentButtonLabel;
  const sellerName = piece.ownerName || piece.listedByName || brand?.name || "Uvel seller";
  const moreSellerListings = useMemo(() => {
    const candidates = [...wardrobePieces, ...shopFloor(app.country)];
    const byId = new Map<string, ClosetPiece>();
    candidates.forEach((candidate) => {
      if (candidate.id === piece.id || candidate.status !== "listed" || candidate.sellerPaused) return;
      const belongsToSeller = brand?.id
        ? candidate.brandId === brand.id
        : Boolean(sellerId) && (candidate.ownerId === sellerId || candidate.listedByUid === sellerId);
      if (belongsToSeller) byId.set(candidate.id, candidate);
    });
    return [...byId.values()];
  }, [app.country, brand?.id, piece.id, sellerId, wardrobePieces]);
  const gallery = piece.photos?.length ? piece.photos : [piece.photo];
  const [activePhoto, setActivePhoto] = useState(0);
  const [selectedSize, setSelectedSize] = useState(piece.size || piece.sizes?.[0] || "One size");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lastPhotoTap = useRef(0);
  const [shareOpen, setShareOpen] = useState(false);
  const inBag = cart.has(piece.id);
  const currentPhoto = gallery[Math.min(activePhoto, gallery.length - 1)] || piece.photo;
  const sharePayload: FriendSharePayload = { kind: "listing", id: piece.id, title: piece.name, deepLink: `uvel://piece/${piece.id}`, imageUri: piece.photo, previewText: `Have a look at ${piece.name} on Uvel.`, listing: { id: piece.id, kind: "closet", name: piece.name, brand: piece.brand || piece.category || "Uvel", priceCents: piece.listPriceCents, currency: piece.currency, photoUri: piece.photo } };
  const initialOrigin: TransitionRect = origin.width <= 1 || origin.height <= 1
    ? { x: 0, y: 0, width: screenWidth, height: screenHeight, radius: 0 }
    : { x: origin.x, y: origin.y, width: origin.width, height: origin.height, radius: origin.radius || origin.radii?.[0] || 0 };
  const fromRect = useSharedValue(initialOrigin);
  const toRect = useSharedValue<TransitionRect>({ x: 0, y: 0, width: screenWidth, height: screenHeight, radius: 0 });
  const transitionProgress = useSharedValue(0);
  const [transitioning, setTransitioning] = useState(true);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const finishClose = () => onCloseRef.current();
  const backdropMotion = useAnimatedStyle(() => ({ opacity: transitionProgress.value }));
  const sheetMotion = useAnimatedStyle(() => {
    const progress = transitionProgress.value;
    const from = fromRect.value;
    const to = toRect.value;
    return {
      left: from.x + (to.x - from.x) * progress,
      top: from.y + (to.y - from.y) * progress,
      width: from.width + (to.width - from.width) * progress,
      height: from.height + (to.height - from.height) * progress,
      borderRadius: from.radius * (1 - progress),
      opacity: progress,
    };
  });
  useEffect(() => {
    transitionProgress.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setTransitioning)(false);
    });
  }, [transitionProgress]);
  const sizes = piece.sizes?.length ? piece.sizes : [piece.size || "One size"];
  const buyNow = async () => {
    if (previewOnly || paying || !paymentMethod) return;
    if (!app.uid) {
      Alert.alert("Sign in to buy", "Sign in before starting payment.");
      return;
    }
    setPaying(true);
    try {
      const address = await loadAddress();
      if (!address) {
        Alert.alert("Add a shipping address", "Save your shipping address once, then you can pay directly from the listing.");
        router.push("/address");
        return;
      }
      const effectiveShipsTo = restrictShipsTo(
        piece.country || market.code,
        piece.shipsTo,
        brand?.operatingCountries,
      );
      if (!listingVisibleIn({ origin: piece.country, shipsTo: effectiveShipsTo, buyer: address.country })) {
        throw new Error("This seller doesn’t ship this piece to that country.");
      }
      if (piece.status !== "listed" || piece.sellerPaused || (piece.stockQuantity !== undefined && piece.stockQuantity <= 0)) {
        throw new Error("This listing is no longer available.");
      }
      const currency = piece.currency || market.currency;
      const itemCents = convertCents(piece.listPriceCents, currency, market);
      const fee = uvelFeeCents(piece.listPriceCents, currency, market);
      const carrierOptions = !brand || !brandMakes(brand)
        ? carriersForListing(piece.country || market.code, piece.shippingCarriers, piece.shippingMethod || "dropoff")
        : [];
      const carrier = carrierOptions[0];
      const shippingSpeed = carrier?.speed === "express" ? "express" : "standard";
      const buyerPaysShipping = piece.shippingBuyerPays !== false || Boolean(brand && brandMakes(brand));
      const shipCost = buyerPaysShipping
        ? shippingCents(address.country === (piece.country || market.code), shippingSpeed === "express", market)
        : 0;
      const total = itemCents + fee + shipCost;
      if (total <= 0) throw new Error("This listing cannot be purchased right now.");
      const order = await placeOrder({
        pieceId: piece.id,
        pieceName: piece.name,
        piecePhoto: piece.photo,
        brandId: piece.brandId,
        variantKey: selectedSize || undefined,
        variantLabel: selectedSize || undefined,
        buyerId: app.uid,
        sellerId: sellerId || "seller",
        itemCents,
        feeCents: fee,
        shipCents: shipCost,
        taxCents: 0,
        totalCents: total,
        currency: market.currency,
        country: address.country,
        payMethod: paymentMethod.label,
        delivery: carrier ? `${carrier.name} · ${shippingSpeed}` : shippingSpeed,
        carrier: carrier?.name,
        address,
        madeByUvel: Boolean(brand && brandMakes(brand)),
      });
      void mirrorCheckoutOrder(order).catch(() => undefined);
      if (wallet.availableCents >= total && total > 0) {
        await payWithWallet(order.id);
        await rememberLastPaymentMethod(market.code, paymentMethod.id);
        removeFromCart(piece.id);
        router.replace({ pathname: "/order/[id]", params: { id: order.id } });
        return;
      }
      if (paymentMethod.kind === "apple" || market.code === "US") {
        if (!paymentsExtra.stripePk) throw new Error("Stripe checkout is not configured yet.");
        const intent = await createStripePaymentIntent(order.id);
        if (paymentMethod.kind === "apple") {
          const immediate = (label: string, amount: number): PlatformPay.CartSummaryItem => ({
            label,
            amount: (amount / 100).toFixed(2),
            paymentType: PlatformPay.PaymentType.Immediate,
          });
          const cartItems: PlatformPay.CartSummaryItem[] = [
            immediate(piece.name, itemCents),
            ...(fee > 0 ? [immediate("Buyer protection", fee)] : []),
            ...(shipCost > 0 ? [immediate("Shipping", shipCost)] : []),
            immediate("Uvel", total),
          ];
          const confirmed = await confirmPlatformPayPayment(intent.clientSecret, {
            applePay: { merchantCountryCode: market.code, currencyCode: market.currency, cartItems },
          });
          if (confirmed.error) {
            if (confirmed.error.code === "Canceled") return;
            throw new Error(confirmed.error.message);
          }
        } else {
          const initialized = await initPaymentSheet({
            merchantDisplayName: "Uvel",
            paymentIntentClientSecret: intent.clientSecret,
            ...(intent.customerId && intent.customerSessionClientSecret
              ? {
                  customerId: intent.customerId,
                  customerSessionClientSecret: intent.customerSessionClientSecret,
                }
              : {}),
            link: { display: LinkDisplay.AUTOMATIC },
            paymentMethodOrder: ["card", "link"],
            primaryButtonLabel: "Pay now",
            style: "alwaysDark",
            allowsDelayedPaymentMethods: false,
            ...stripePaymentSheetAddress(address, app.email || undefined),
          });
          if (initialized.error) throw new Error(initialized.error.message);
          const presented = await presentPaymentSheet();
          if (presented.error) {
            if (presented.error.code === "Canceled") return;
            throw new Error(presented.error.message);
          }
        }
        await rememberLastPaymentMethod(market.code, paymentMethod.id);
        removeFromCart(piece.id);
        router.replace({ pathname: "/order/[id]", params: { id: order.id } });
        return;
      }
      const session = await createCheckoutSession({
        amountCents: total,
        currency: market.currency,
        email: app.email || "pay@uvel.app",
        method: paymentMethod.id,
        country: market.code,
        reference: `uvel-${piece.id}-${Date.now()}`,
        name: piece.name,
        orderId: order.id,
        listingId: piece.id,
        brandId: piece.brandId || "",
        variantKey: selectedSize,
      });
      if (!session.url) throw new Error("That payment method isn’t live yet.");
      if (!(await openHostedPay(session.url))) return;
      await rememberLastPaymentMethod(market.code, paymentMethod.id);
      removeFromCart(piece.id);
      router.replace({ pathname: "/order/[id]", params: { id: order.id } });
    } catch (error) {
      Alert.alert("Payment", error instanceof Error ? error.message : "Couldn’t complete that.");
    } finally {
      setPaying(false);
    }
  };
  const addItem = () => { if (previewOnly || inBag) return; addToCart(piece.id); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); };
  const toggleSaved = () => { app.toggleSaved(piece.id); onInteraction?.("save", piece); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); };
  const saveFromPhotoDoubleTap = () => { if (!app.saved.includes(piece.id)) { app.toggleSaved(piece.id); onInteraction?.("save", piece); } void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); };
  const handlePhotoPress = () => { const now = Date.now(); if (lastPhotoTap.current !== 0 && now - lastPhotoTap.current <= 300) { lastPhotoTap.current = 0; saveFromPhotoDoubleTap(); return; } lastPhotoTap.current = now; };
  const closeListing = () => {
    if (closing.current) return;
    closing.current = true;
    recordQualifiedDwell();
    if (closeMode === "instant") {
      onCloseRef.current();
      return;
    }
    setTransitioning(true);
    const animateBack = (rect: TransitionRect) => {
      fromRect.value = rect;
      transitionProgress.value = withTiming(0, { duration: 420, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(finishClose)();
      });
    };
    const fallbackOrigin: TransitionRect = { x: origin.x, y: origin.y, width: origin.width, height: origin.height, radius: origin.radius || origin.radii?.[0] || 0 };
    if (!origin.measure) {
      animateBack(fallbackOrigin);
      return;
    }
    let started = false;
    const fallbackTimer = setTimeout(() => {
      if (started) return;
      started = true;
      animateBack(fallbackOrigin);
    }, 80);
    origin.measure((rect) => {
      if (started) return;
      started = true;
      clearTimeout(fallbackTimer);
      animateBack({ ...rect, radius: fallbackOrigin.radius });
    });
  };
  const openSeller = () => { if (sellerId) router.push({ pathname: "/seller/[id]", params: { id: sellerId } }); };
  return (
    <View style={styles.root}>
      <Animated.View style={[styles.backdrop, backdropMotion]}><Pressable style={StyleSheet.absoluteFill} onPress={closeListing} accessibilityRole="button" accessibilityLabel="Close listing details" /></Animated.View>
      <Animated.View style={[styles.sheet, { paddingTop: insets.top }, sheetMotion]} pointerEvents={transitioning ? "none" : "auto"}>
        <View style={styles.header}>
          <Pressable onPress={closeListing} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Close listing"><Ionicons name="chevron-down" size={27} color={colors.bone} /></Pressable>
        </View>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}><Pressable style={StyleSheet.absoluteFill} onPress={handlePhotoPress} accessibilityRole="image" accessibilityLabel={`${piece.name} photo`} accessibilityHint="Double tap to save this listing."><Image source={{ uri: currentPhoto }} style={styles.heroImage} contentFit="cover" /></Pressable>{gallery.length > 1 ? <View style={styles.dots}>{gallery.map((photo, index) => <Pressable key={`${photo}-${index}`} onPress={() => setActivePhoto(index)} style={[styles.dot, index === activePhoto && styles.dotActive]} accessibilityLabel={`View photo ${index + 1}`} />)}</View> : null}<Pressable onPress={toggleSaved} style={styles.like} accessibilityRole="button" accessibilityLabel="Like listing" accessibilityState={{ selected: app.saved.includes(piece.id) }}><Ionicons name={app.saved.includes(piece.id) ? "heart" : "heart-outline"} size={22} color={app.saved.includes(piece.id) ? MARKET_RED : colors.bone} /></Pressable><Pressable onPress={() => setShareOpen(true)} style={styles.share} accessibilityRole="button" accessibilityLabel={`Share ${piece.name}`}><Ionicons name="share-outline" size={22} color={colors.bone} /></Pressable></View>
          {gallery.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>{gallery.map((photo, index) => <Pressable key={`${photo}-thumb`} onPress={() => setActivePhoto(index)} style={[styles.thumb, index === activePhoto && styles.thumbActive]} accessibilityRole="button" accessibilityLabel={`View photo ${index + 1}`}><Image source={{ uri: photo }} style={styles.thumbImage} contentFit="cover" /></Pressable>)}</ScrollView> : null}
          <View style={styles.info}>
            <View style={styles.titleRow}><Text style={styles.title}>{piece.name}</Text></View>
            <View style={styles.priceRow}><Text style={styles.price}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text><Text style={styles.condition}>{piece.condition || "Excellent"}</Text><Text style={styles.available}>Available</Text></View>
            <Text style={styles.label}>Size</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sizeRail}>{sizes.map((size) => <Pressable key={size} onPress={() => setSelectedSize(size)} style={[styles.size, selectedSize === size && styles.sizeSelected]} accessibilityRole="button" accessibilityState={{ selected: selectedSize === size }}><Text style={[styles.sizeText, selectedSize === size && styles.sizeTextSelected]}>{size}</Text></Pressable>)}</ScrollView>
            <Pressable onPress={() => setDetailsOpen((open) => !open)} style={styles.details} accessibilityRole="button" accessibilityLabel="Product details"><View style={styles.detailsTitle}><Ionicons name="shirt-outline" size={18} color={colors.bone} /><Text style={styles.detailsText}>Product Details</Text></View><Ionicons name={detailsOpen ? "chevron-up" : "chevron-forward"} size={19} color={colors.bone} /></Pressable>
            {detailsOpen ? <View style={styles.detailsBody}><Fact styles={styles} label="Color" value={piece.color || "Original"} /><Fact styles={styles} label="Material" value={piece.material || "Not specified"} /><Fact styles={styles} label="Listed by" value={sellerName} /></View> : null}
            <View style={styles.seller}><View style={styles.sellerTop}><Pressable onPress={openSeller} disabled={!sellerId} style={styles.sellerTap} accessibilityRole={sellerId ? "button" : undefined}>{piece.ownerPhoto ? <Image source={{ uri: piece.ownerPhoto }} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{sellerName.slice(0, 1).toUpperCase()}</Text></View>}<View style={styles.sellerCopy}><Text style={styles.sellerLabel}>Listed by</Text><View style={styles.sellerNameRow}><Text style={styles.sellerName} numberOfLines={1}>{sellerName}</Text></View><Text style={styles.sellerMeta}>Trusted seller · buyer protection</Text></View></Pressable><Pressable onPress={() => router.push({ pathname: "/ask/[id]", params: { id: piece.id, pieceName: piece.name, piecePhoto: piece.photo, piecePriceCents: String(piece.listPriceCents), ...(brand?.id ? { brandId: brand.id } : {}) } })} style={styles.messageButton} accessibilityRole="button" accessibilityLabel={`Message ${sellerName}`}><Ionicons name="chatbubble-outline" size={17} color={colors.bone} /><Text style={styles.messageText}>Message</Text></Pressable></View><View style={styles.sellerRating}><Text style={styles.stars}>★★★★★</Text><Text style={styles.reviewCount}>({piece.likedBy?.length || 0})</Text></View></View>
            <View style={styles.descriptionSection}><Text style={styles.descriptionTitle}>Description</Text><Text style={styles.description}>{piece.notes?.trim() || "The seller hasn’t added a description yet."}</Text></View>
            {moreSellerListings.length ? <Pressable onPress={openSeller} style={styles.moreListings} accessibilityRole="button" accessibilityLabel={`View ${moreSellerListings.length} more listing${moreSellerListings.length === 1 ? "" : "s"} from ${sellerName}`}>
              <View style={styles.moreListingsCopy}><Text style={styles.moreListingsTitle}>More listings from {sellerName}</Text><Text style={styles.moreListingsBody}>{moreSellerListings.length} more {moreSellerListings.length === 1 ? "listing" : "listings"}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.success} />
            </Pressable> : null}
          </View>
        </ScrollView>
        {!previewOnly ? (
          <View
            style={[
              styles.footer,
              {
                bottom: footerBottom,
                paddingBottom: footerBottomPadding,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: `${colors.bone}20`,
                zIndex: 20,
                elevation: 20,
              },
            ]}
          >
            <Pressable
              onPress={() => void buyNow()}
              disabled={paying || !paymentPreferenceReady}
              style={[styles.buyButton, (paying || !paymentPreferenceReady) && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel={`${paymentAccessibilityLabel} for ${piece.name}`}
              accessibilityState={{ busy: paying, disabled: paying || !paymentPreferenceReady }}
            >
              <View style={[styles.buyContent, paymentMethod?.kind === "apple" && styles.appleBuyContent]}>
                <PaymentMark method={paymentMethod} colors={colors} />
                <Text style={[styles.buyText, paymentMethod?.kind === "apple" && styles.appleBuyText]}>
                  {paying ? "Processing…" : paymentButtonLabel}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={addItem}
              style={styles.bagButton}
              accessibilityRole="button"
              accessibilityLabel={inBag ? `${piece.name} is in your bag` : `Add ${piece.name} to bag`}
            >
              <Text style={styles.bagText}>{inBag ? "In bag" : "Add to cart"}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/try-on", params: { piece: piece.id } })}
              style={styles.tryOnButton}
              accessibilityRole="button"
              accessibilityLabel={`Try on ${piece.name}`}
              accessibilityHint="Opens the virtual try-on experience for this item."
            >
              <Ionicons name="body-outline" size={20} color={colors.bone} />
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
      <TodayCartFab listingOpen showWhileListing={!previewOnly} onBeforeOpen={onClose} />
      <FriendShareSheet visible={shareOpen} payload={sharePayload} onClose={() => setShareOpen(false)} onListingSignal={recordTrendSignal} onExternalShare={() => {
        setShareOpen(false);
        void Share.share({ title: piece.name, message: `Have a look at ${piece.name} on Uvel. uvel://piece/${piece.id}` })
          .then((result) => { if (result.action === Share.sharedAction) recordTrendSignal("share"); })
          .catch(() => undefined);
      }} />
    </View>
  );
}
function PaymentMark({ method, colors }: { method?: PayMethod; colors: Colors }) {
  if (!method) return null;
  const source = method.icon === "card" ? require("../assets/pay/card.png") : method.icon === "momo" ? require("../assets/pay/mtn-momo.png") : method.icon === "telecel" ? require("../assets/pay/telecel.png") : null;
  return (
    <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center", transform: [{ translateY: -2 }] }}>
      {method.icon === "apple" ? (
        <Ionicons name="logo-apple" size={20} color={colors.bone} />
      ) : source ? (
        <Image source={source} style={{ width: 22, height: 20 }} contentFit="contain" />
      ) : (
        <View style={{ width: 22, height: 18, borderRadius: 4, backgroundColor: colors.bone, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.ink, fontSize: 10, fontWeight: "900" }}>{method.label.slice(0, 1)}</Text>
        </View>
      )}
    </View>
  );
}
function Fact({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) { return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>; }
function makeStyles(colors: Colors) { return StyleSheet.create({ root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, elevation: 100 }, backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)" }, sheet: { position: "absolute", top: 0, left: 0, backgroundColor: colors.ink, overflow: "hidden", zIndex: 2, elevation: 10 }, header: { height: 48, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20` }, back: { width: 30, alignItems: "flex-start", justifyContent: "center" }, bag: { width: 27, alignItems: "flex-end" }, content: { flex: 1 }, contentContainer: { paddingBottom: 150 }, hero: { width: "100%", aspectRatio: 0.92, backgroundColor: colors.surface, position: "relative", overflow: "hidden" }, heroImage: { width: "100%", height: "100%" }, dots: { position: "absolute", bottom: 9, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.subtle }, dotActive: { backgroundColor: colors.bone, width: 12 }, like: { position: "absolute", left: 14, bottom: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 }, share: { position: "absolute", right: 14, bottom: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 }, thumbs: { gap: 7, paddingHorizontal: 12, paddingTop: 9 }, thumb: { width: 54, height: 54, borderRadius: 4, overflow: "hidden", borderWidth: 1, borderColor: colors.subtle }, thumbActive: { borderWidth: 2, borderColor: colors.bone }, thumbImage: { width: "100%", height: "100%" }, info: { paddingHorizontal: 16, paddingTop: 9 }, titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 }, title: { flex: 1, color: colors.bone, fontSize: 13, lineHeight: 17 }, rating: { flexDirection: "row", alignItems: "center", gap: 3 }, stars: { color: "#eeb100", fontSize: 15, letterSpacing: 0.5 }, reviewCount: { color: colors.bone, fontSize: 10, textDecorationLine: "underline" }, priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }, price: { color: MARKET_RED, fontSize: 17, fontWeight: "800" }, condition: { color: colors.bone, backgroundColor: colors.neutral, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, fontSize: 10, fontWeight: "700" }, available: { color: colors.muted, fontSize: 11 }, promo: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 6 }, promoStrong: { color: MARKET_RED, fontWeight: "800" }, label: { color: colors.bone, fontSize: 11, fontWeight: "800", marginTop: 13 }, sizeRail: { gap: 7, paddingTop: 8, paddingBottom: 2 }, size: { minWidth: 42, height: 36, paddingHorizontal: 9, borderWidth: 1, borderColor: colors.subtle, borderRadius: 4, alignItems: "center", justifyContent: "center" }, sizeSelected: { backgroundColor: colors.bone, borderColor: colors.bone }, sizeText: { color: colors.bone, fontSize: 11 }, sizeTextSelected: { color: colors.ink, fontWeight: "800" }, details: { height: 51, borderWidth: 1, borderColor: colors.subtle, borderRadius: 8, marginTop: 16, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, detailsTitle: { flexDirection: "row", alignItems: "center", gap: 8 }, detailsText: { color: colors.bone, fontSize: 13, fontWeight: "800" }, detailsBody: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderTopWidth: 0, borderColor: colors.subtle, paddingHorizontal: 12, paddingBottom: 6 }, fact: { width: "50%", paddingVertical: 10 }, factLabel: { color: colors.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8 }, factValue: { color: colors.bone, fontSize: 12, fontWeight: "700", marginTop: 3 }, seller: { marginTop: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: `${colors.bone}20` }, sellerTop: { flexDirection: "row", alignItems: "center", gap: 10 }, sellerTap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }, messageButton: { height: 36, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.subtle, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 5 }, messageText: { color: colors.bone, fontSize: 11, fontWeight: "800" }, sellerRating: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 50, marginTop: 8 }, avatar: { width: 40, height: 40, borderRadius: 20 }, avatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ded3c5", alignItems: "center", justifyContent: "center" }, avatarText: { color: colors.bone, fontSize: 17, fontWeight: "800" }, sellerCopy: { flex: 1 }, sellerLabel: { color: colors.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8 }, sellerNameRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }, sellerName: { color: colors.bone, fontSize: 13, fontWeight: "800", flexShrink: 1 }, sellerMeta: { color: colors.muted, fontSize: 10, marginTop: 3 }, descriptionSection: { marginTop: 4, paddingTop: 14, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${colors.bone}20` }, descriptionTitle: { color: colors.bone, fontSize: 13, fontWeight: "800", marginBottom: 6 }, description: { color: colors.muted, fontSize: 13, lineHeight: 20 }, moreListings: { marginTop: 14, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: `${colors.success}55`, backgroundColor: `${colors.success}0D`, flexDirection: "row", alignItems: "center", gap: 10 }, moreListingsCopy: { flex: 1 }, moreListingsTitle: { color: colors.bone, fontSize: 13, fontWeight: "800" }, moreListingsBody: { color: colors.muted, fontSize: 11, marginTop: 3 }, buyContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 5 }, appleBuyContent: { gap: 1 }, footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.ink, paddingHorizontal: 16, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }, buyButton: { width: 148, height: 48, borderWidth: 1, borderColor: colors.bone, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink }, buyText: { color: colors.bone, fontSize: 14, fontWeight: "800" }, appleBuyText: { fontSize: 17 }, bagButton: { flex: 1, height: 48, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: colors.bone }, tryOnButton: { width: 44, height: 48, borderWidth: 1, borderColor: colors.subtle, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink }, bagText: { color: colors.ink, fontSize: 14, fontWeight: "800" }, heartButton: { width: 48, height: 48, borderWidth: 1, borderColor: colors.subtle, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink } }); }
