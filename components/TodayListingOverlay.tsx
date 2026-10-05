import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "../lib/haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Share as NativeShare, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView as GHScrollView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBrand, themeFor } from "../lib/brands";
import { addToCart, useCart } from "../lib/cart";
import { useFirstFind } from "../lib/firstFind";
import { convertCents, getMarket, moneyInMarket } from "../lib/markets";
import { createListingOffer, suggestedOfferCents } from "../lib/offers";
import { shipsToLabel } from "../lib/ships";
import { shopLookOf } from "../lib/shopLook";
import { useUvel } from "../lib/store";
import { useColors, useResolvedAppearance, type Colors } from "../lib/theme";
import { type ClosetPiece } from "../lib/wardrobe";
import type { PersonalizationAction } from "../lib/personalization";
import { ListingAlertControls } from "./ListingAlertControls";
import { BrandVerifiedMark } from "./VerifiedMark";
import { FriendShareSheet, type FriendSharePayload } from "./FriendShareSheet";

const AnimatedScrollView = Animated.createAnimatedComponent(GHScrollView);

type ListingRect = { x: number; y: number; width: number; height: number };
export type ListingOrigin = ListingRect & { radius?: number; radii?: [number, number, number, number]; photo?: string; measure?: (callback: (rect: ListingRect) => void) => void };

const PHOTO_MORPH_DURATION = 280;
const CLOSE_NAV_DELAY = PHOTO_MORPH_DURATION + 80;
const PHOTO_MORPH = { duration: PHOTO_MORPH_DURATION, easing: Easing.out(Easing.cubic) };
const SNAP = { damping: 26, stiffness: 320, mass: 0.7, overshootClamping: true };

export function TodayListingOverlay({
  piece,
  origin,
  onClose,
  onInteraction,
  previewOnly = false,
  showDoubleTapHint = false,
  onDoubleTapHintDismiss,
  firstListing = false,
}: {
  piece: ClosetPiece;
  origin: ListingOrigin;
  onClose: () => void;
  onInteraction?: (action: PersonalizationAction, piece: ClosetPiece, query?: string, dwellSeconds?: number) => void;
  previewOnly?: boolean;
  showDoubleTapHint?: boolean;
  onDoubleTapHintDismiss?: () => void;
  firstListing?: boolean;
}) {
  const baseColors = useColors();
  const appearance = useResolvedAppearance();
  const app = useUvel();
  const brandRecord = piece.brandId ? getBrand(piece.brandId) : undefined;
  const sellerId = piece.ownerId || piece.listedByUid || "";
  const customLook = piece.shopLook || brandRecord
    ? shopLookOf(piece.shopLook, brandRecord ? themeFor(brandRecord) : null)
    : null;
  // Keep the popup on the same page as its listing card instead of falling
  // back to the app's default black background.
  const colors: Colors = customLook
    ? {
        ...baseColors,
        ink: customLook.page,
        surface: customLook.surface,
        bone: customLook.bone,
        muted: customLook.muted,
        subtle: customLook.muted,
        pulse: customLook.accent,
        pulseInk: customLook.accentInk,
        success: customLook.accent,
        successInk: customLook.accentInk,
      }
    : baseColors;
  const likeColor = appearance === "light" ? baseColors.danger : colors.success;
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const popupWidth = Math.max(0, Math.min(screenW - 32, 440));
  const popupHeight = Math.max(0, Math.min(Math.floor(screenH * 0.5), screenH - insets.top - insets.bottom - 32));
  const popupLeft = Math.round((screenW - popupWidth) / 2);
  const popupTop = Math.round((screenH - popupHeight) / 2);
  const modalHeaderHeight = 46;
  const footerHeight = 76;
  const quickImageSize = Math.max(88, Math.min(184, Math.round(Math.min(popupWidth * 0.51, popupHeight * 0.44))));
  const imageTargetX = popupLeft + 13;
  const imageTargetY = popupTop + modalHeaderHeight + 13;
  const imgX = useSharedValue(origin.x);
  const imgY = useSharedValue(origin.y);
  const imgW = useSharedValue(origin.width);
  const imgH = useSharedValue(origin.height);
  const imgTL = useSharedValue(origin.radii?.[0] ?? origin.radius ?? 18);
  const imgTR = useSharedValue(origin.radii?.[1] ?? origin.radius ?? 18);
  const imgBR = useSharedValue(origin.radii?.[2] ?? origin.radius ?? 18);
  const imgBL = useSharedValue(origin.radii?.[3] ?? origin.radius ?? 18);
  const originX = useSharedValue(origin.x);
  const originY = useSharedValue(origin.y);
  const originW = useSharedValue(origin.width);
  const originH = useSharedValue(origin.height);
  const originTL = useSharedValue(origin.radii?.[0] ?? origin.radius ?? 18);
  const originTR = useSharedValue(origin.radii?.[1] ?? origin.radius ?? 18);
  const originBR = useSharedValue(origin.radii?.[2] ?? origin.radius ?? 18);
  const originBL = useSharedValue(origin.radii?.[3] ?? origin.radius ?? 18);
  const backdrop = useSharedValue(0);
  const sheet = useSharedValue(0);
  const photoFitProgress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const modalDragY = useSharedValue(0);
  const closing = useSharedValue(0);
  const dismissing = useSharedValue(0);
  const settled = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const tryOnHintTriggered = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const [coverTop, setCoverTop] = useState(0);
  const [activePhoto, setActivePhoto] = useState(0);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerSent, setOfferSent] = useState(false);
  const [offerValue, setOfferValue] = useState("");
  const [offerBusy, setOfferBusy] = useState(false);
  const [offerThreadId, setOfferThreadId] = useState("");
  const [showTryOnHint, setShowTryOnHint] = useState(false);
  const cart = useCart();
  const inBag = cart.has(piece.id);
  const canMakeOffer = !previewOnly && !piece.brandId && !brandRecord && Boolean(sellerId) && sellerId !== app.uid && piece.status === "listed" && piece.listPriceCents > 1;
  const offerCurrency = piece.currency || getMarket(app.country).currency;
  const suggestedCents = suggestedOfferCents(piece.listPriceCents);
  const zeroDecimalOffer = ["ARS", "COP", "CLP", "NGN", "JPY", "KRW", "IDR", "VND"].includes(offerCurrency.toUpperCase());
  function openOfferSheet() {
    const suggested = suggestedCents / 100;
    setOfferValue(suggested.toFixed(zeroDecimalOffer ? 0 : 2));
    setOfferSent(false);
    setOfferOpen(true);
  }
  async function submitListingOffer() {
    const amountCents = Math.round(Number(offerValue.replace(/,/g, "")) * 100);
    if (!app.uid) {
      Alert.alert("Sign in to make an offer", "Create or sign in to your Uvel account first.");
      return;
    }
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents >= piece.listPriceCents) {
      Alert.alert("Enter a valid offer", "Your offer must be a positive amount below the listed price.");
      return;
    }
    setOfferBusy(true);
    try {
      const result = await createListingOffer(piece.id, amountCents);
      setOfferThreadId(result.threadId);
      setOfferSent(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/^Firebase: /, "") : "Please try again.";
      Alert.alert("Offer not sent", message);
    } finally {
      setOfferBusy(false);
    }
  }
  const lastImageTap = useRef(0);
  const imageTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedAt = useRef(Date.now());
  const dwellRecorded = useRef(false);
  const rootRef = useRef<View>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const detailsOffset = useRef(0);

  useEffect(() => {
    originX.value = origin.x;
    originY.value = origin.y;
    originW.value = origin.width;
    originH.value = origin.height;
    originTL.value = origin.radii?.[0] ?? origin.radius ?? 18;
    originTR.value = origin.radii?.[1] ?? origin.radius ?? 18;
    originBR.value = origin.radii?.[2] ?? origin.radius ?? 18;
    originBL.value = origin.radii?.[3] ?? origin.radius ?? 18;
    imgX.value = origin.x;
    imgY.value = origin.y;
    imgW.value = origin.width;
    imgH.value = origin.height;
    imgTL.value = origin.radii?.[0] ?? origin.radius ?? 18;
    imgTR.value = origin.radii?.[1] ?? origin.radius ?? 18;
    imgBR.value = origin.radii?.[2] ?? origin.radius ?? 18;
    imgBL.value = origin.radii?.[3] ?? origin.radius ?? 18;
    modalDragY.value = 0;
    imgX.value = withTiming(imageTargetX, PHOTO_MORPH);
    imgY.value = withTiming(imageTargetY, PHOTO_MORPH, (finished) => {
      if (finished) settled.value = 1;
    });
    imgW.value = withTiming(quickImageSize, PHOTO_MORPH);
    imgH.value = withTiming(quickImageSize, PHOTO_MORPH);
    imgTL.value = withTiming(14, PHOTO_MORPH);
    imgTR.value = withTiming(14, PHOTO_MORPH);
    imgBR.value = withTiming(14, PHOTO_MORPH);
    imgBL.value = withTiming(14, PHOTO_MORPH);
    photoFitProgress.value = withTiming(1, PHOTO_MORPH);
    backdrop.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    sheet.value = withTiming(1, { duration: 220 });
  }, [backdrop, imageTargetX, imageTargetY, imgBL, imgBR, imgH, imgTL, imgTR, imgW, imgX, imgY, modalDragY, origin.height, origin.radius, origin.radii, origin.width, origin.x, origin.y, originBL, originBR, originH, originTL, originTR, originW, originX, originY, photoFitProgress, quickImageSize, sheet]);

  useEffect(() => {
    if (!showDoubleTapHint || !onDoubleTapHintDismiss) return;
    const timeout = setTimeout(onDoubleTapHintDismiss, 10000);
    return () => clearTimeout(timeout);
  }, [onDoubleTapHintDismiss, showDoubleTapHint]);

  const recordDwell = () => {
    if (dwellRecorded.current) return;
    const dwellSeconds = Math.round((Date.now() - openedAt.current) / 1000);
    if (dwellSeconds >= 10) onInteraction?.("dwell", piece, undefined, dwellSeconds);
    dwellRecorded.current = true;
  };

  const finishClose = () => onClose();

  const startCloseTransition = (measured?: ListingRect) => {
    if (measured && measured.width > 0 && measured.height > 0) {
      originX.value = measured.x;
      originY.value = measured.y;
      originW.value = measured.width;
      originH.value = measured.height;
    }
    settled.value = 0;
    imgX.value = imageTargetX;
    imgY.value = imageTargetY + modalDragY.value - scrollY.value;
    imgW.value = quickImageSize;
    imgH.value = quickImageSize;
    imgTL.value = 14;
    imgTR.value = 14;
    imgBR.value = 14;
    imgBL.value = 14;
    sheet.value = withTiming(0, PHOTO_MORPH);
    backdrop.value = withTiming(0, PHOTO_MORPH);
    imgX.value = withTiming(originX.value, PHOTO_MORPH);
    imgY.value = withTiming(originY.value, PHOTO_MORPH, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
    imgW.value = withTiming(originW.value, PHOTO_MORPH);
    imgH.value = withTiming(originH.value, PHOTO_MORPH);
    imgTL.value = withTiming(originTL.value, PHOTO_MORPH);
    imgTR.value = withTiming(originTR.value, PHOTO_MORPH);
    imgBR.value = withTiming(originBR.value, PHOTO_MORPH);
    imgBL.value = withTiming(originBL.value, PHOTO_MORPH);
    photoFitProgress.value = withTiming(0, PHOTO_MORPH);
  };

  const closeToPin = () => {
    if (previewOnly) {
      recordDwell();
      onClose();
      return;
    }
    if (closing.value) return;
    closing.value = 1;
    dismissing.value = 1;
    recordDwell();
    let started = false;
    const start = (measured?: ListingRect) => {
      if (started) return;
      started = true;
      startCloseTransition(measured);
    };
    if (origin.measure) {
      try {
        origin.measure(start);
        setTimeout(() => start(), 60);
      } catch {
        start();
      }
    } else {
      start();
    }
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      if (firstListing && event.contentOffset.y > 100 && !tryOnHintTriggered.value) {
        tryOnHintTriggered.value = 1;
        runOnJS(setShowTryOnHint)(true);
      }
    },
  });

  useEffect(() => {
    if (!showTryOnHint) return;
    const timeout = setTimeout(() => setShowTryOnHint(false), 6500);
    return () => clearTimeout(timeout);
  }, [showTryOnHint]);

  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((event) => {
      touchStartX.value = event.allTouches[0]?.absoluteX ?? 0;
      touchStartY.value = event.allTouches[0]?.absoluteY ?? 0;
    })
    .onTouchesMove((event, state) => {
      if (closing.value) {
        state.fail();
        return;
      }
      const x = event.allTouches[0]?.absoluteX ?? touchStartX.value;
      const y = event.allTouches[0]?.absoluteY ?? touchStartY.value;
      const dx = x - touchStartX.value;
      const dy = y - touchStartY.value;
      if (scrollY.value > 4) {
        state.fail();
        return;
      }
      if (dy < -8) {
        state.fail();
        return;
      }
      if (dy > 8 && dy > Math.abs(dx) * 1.2) {
        state.activate();
        return;
      }
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.max(dy, 0) * 1.2) {
        state.fail();
      }
    })
    .onStart(() => {
      if (closing.value || scrollY.value > 4) {
        dismissing.value = 0;
        return;
      }
      dismissing.value = 1;
    })
    .onUpdate((event) => {
      if (closing.value || !dismissing.value) return;
      const translationY = Math.max(event.translationY, 0);
      const p = Math.min(translationY / 240, 1);
      modalDragY.value = translationY;
      backdrop.value = 1 - p * 0.95;
      sheet.value = Math.max(0.4, 1 - p * 0.6);
      dragY.value = translationY;
    })
    .onEnd((event) => {
      if (closing.value || !dismissing.value) return;
      if (dragY.value > 48 || event.velocityY > 600) {
        runOnJS(closeToPin)();
        return;
      }
      dismissing.value = 0;
      dragY.value = 0;
      modalDragY.value = withSpring(0, SNAP);
      backdrop.value = withSpring(1, SNAP);
      sheet.value = withTiming(1, { duration: 140 });
    });

  const photoStyle = useAnimatedStyle(() => ({
    top: imgY.value,
    left: imgX.value,
    width: imgW.value,
    height: imgH.value,
    borderTopLeftRadius: imgTL.value,
    borderTopRightRadius: imgTR.value,
    borderBottomRightRadius: imgBR.value,
    borderBottomLeftRadius: imgBL.value,
    opacity: 1 - settled.value,
  }));
  const coverPhotoStyle = useAnimatedStyle(() => ({ opacity: 1 - photoFitProgress.value }));
  const containPhotoStyle = useAnimatedStyle(() => ({ opacity: photoFitProgress.value }));
  const inFlowStyle = useAnimatedStyle(() => ({ opacity: settled.value }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value * 0.55 }));
  const pageStyle = useAnimatedStyle(() => ({ opacity: sheet.value }));
  const modalDragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: modalDragY.value }] }));

  const brand = brandRecord?.name || piece.brand;
  const sellerName = brandRecord?.name || piece.ownerName || piece.listedByName || "Uvel seller";
  const sellerPhoto = brandRecord?.logoUri || piece.ownerPhoto || null;
  const sellerLocation = piece.country ? getMarket(piece.country).name : getMarket(app.country).name;
  const market = getMarket(app.country);
  const find = useFirstFind();
  const itemCurrency = piece.currency || market.currency;
  const localPriceCents = convertCents(piece.listPriceCents, itemCurrency, market);
  const credit = find.applyTo(piece, localPriceCents);
  const saleCents = Math.max(0, localPriceCents - credit);
  const liked = app.saved.includes(piece.id);
  const gallery = piece.photos?.length ? piece.photos : [piece.photo];
  const measurementEntries = Object.entries(piece.measurements || {}).filter(([, value]) => Boolean(value));
  const currentPhoto = gallery[Math.min(activePhoto, gallery.length - 1)] || piece.photo;
  const originPhoto = origin.photo || piece.photo;
  const heartPopX = useSharedValue(screenW / 2);
  const heartPopY = useSharedValue(imageTargetY + quickImageSize / 2);
  const heartPopScale = useSharedValue(0);
  const heartPopOpacity = useSharedValue(0);
  const sharePayload: FriendSharePayload = { kind: "listing", id: piece.id, title: piece.name, deepLink: `uvel://piece/${piece.id}`, imageUri: piece.photo, previewText: `Have a look at ${piece.name} on Uvel.` };

  const heartPopStyle = useAnimatedStyle(() => ({
    opacity: heartPopOpacity.value,
    transform: [
      { translateX: heartPopX.value },
      { translateY: heartPopY.value },
      { translateX: -34 },
      { translateY: -34 },
      { scale: heartPopScale.value },
    ],
  }));

  function doubleTapLike(x: number, y: number) {
    onDoubleTapHintDismiss?.();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onInteraction?.("double_tap_like", piece);
    if (!liked) {
      onInteraction?.("save", piece);
      void app.toggleSaved(piece.id);
    }
    heartPopX.value = withSequence(withTiming(imageTargetX + x, { duration: 1 }), withTiming(screenW - 56, { duration: 560 }));
    heartPopY.value = withSequence(withTiming(imageTargetY + modalDragY.value + y - scrollY.value, { duration: 1 }), withTiming(insets.top + 28, { duration: 560 }));
    heartPopScale.value = withSequence(withSpring(1.12, { damping: 10, stiffness: 260 }), withTiming(0.55, { duration: 520 }));
    heartPopOpacity.value = withSequence(withTiming(1, { duration: 1 }), withTiming(0, { duration: 520 }));
  }

  function onHeroPress(x: number, y: number) {
    const now = Date.now();
    if (now - lastImageTap.current <= 450) {
      if (imageTapTimer.current) clearTimeout(imageTapTimer.current);
      lastImageTap.current = 0;
      doubleTapLike(x, y);
      return;
    }
    lastImageTap.current = now;
    if (imageTapTimer.current) clearTimeout(imageTapTimer.current);
    imageTapTimer.current = setTimeout(() => {
      lastImageTap.current = 0;
      imageTapTimer.current = null;
    }, 450);
  }

  function openMessage() {
    closeToPin();
    setTimeout(() => {
      router.push({
        pathname: "/ask/[id]",
        params: {
          id: piece.id,
          pieceName: piece.name,
          piecePhoto: piece.photo,
          piecePriceCents: String(piece.listPriceCents),
          ...(piece.brandId ? { brandId: piece.brandId } : {}),
        },
      });
    }, CLOSE_NAV_DELAY);
  }

  function openSeller() {
    if (!brandRecord && !sellerId) return;
    closeToPin();
    setTimeout(() => {
      if (brandRecord) router.push({ pathname: "/brand/[id]", params: { id: brandRecord.id } });
      else router.push({ pathname: "/seller/[id]", params: { id: sellerId } });
    }, CLOSE_NAV_DELAY);
  }

  function openCheckout() {
    if (previewOnly) return;
    closeToPin();
    setTimeout(() => {
      router.push({ pathname: "/checkout/[id]", params: { id: piece.id } });
    }, CLOSE_NAV_DELAY);
  }

  return (
    <GestureHandlerRootView style={[styles.root, coverTop ? { top: -coverTop, height: screenH } : null]}>
      <View
        ref={rootRef}
        style={styles.fill}
        collapsable={false}
        onLayout={() => {
          rootRef.current?.measureInWindow((_x, y) => {
            if (y > 1) setCoverTop(y);
          });
        }}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
        <Pressable
          style={styles.backdropTap}
          onPress={closeToPin}
          accessibilityRole="button"
          accessibilityLabel="Close listing details"
        />
        <GestureDetector gesture={pan}>
        <Animated.View style={[styles.popup, { left: popupLeft, top: popupTop, width: popupWidth, height: popupHeight }, pageStyle, modalDragStyle]}>
          <View style={[styles.modalHeader, { height: modalHeaderHeight }]}>
            <Text style={styles.kicker} numberOfLines={1}>{(brand || "UVEL").toUpperCase()}</Text>
            <View style={styles.modalHeaderActions}>
              <Pressable
                onPress={() => {
                  onInteraction?.("share", piece);
                  setShareOpen(true);
                }}
                style={styles.headerAction}
                accessibilityRole="button"
                accessibilityLabel={`Share ${piece.name}`}
              >
                <Ionicons name="share-outline" size={17} color={colors.bone} />
              </Pressable>
              <Pressable
                onPress={() => {
                  onInteraction?.("save", piece);
                  void app.toggleSaved(piece.id);
                }}
                style={styles.headerAction}
                accessibilityRole="button"
                accessibilityLabel={liked ? "Remove listing from saved" : "Save listing"}
                accessibilityState={{ selected: liked }}
              >
                <Ionicons name={liked ? "heart" : "heart-outline"} size={18} color={liked ? likeColor : colors.bone} />
              </Pressable>
              <Pressable onPress={closeToPin} hitSlop={6} style={styles.headerAction} accessibilityRole="button" accessibilityLabel="Close listing">
                <Ionicons name="close" size={20} color={colors.bone} />
              </Pressable>
            </View>
          </View>
        <AnimatedScrollView
          ref={scrollRef}
          style={[styles.popupScroll, { top: modalHeaderHeight, bottom: footerHeight + (showTryOnHint ? 74 : 0) }]}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          contentInsetAdjustmentBehavior="never"
          contentInset={{ top: 0, left: 0, right: 0, bottom: 0 }}
          scrollEventThrottle={16}
          onScroll={scrollHandler}
        >
          <View style={styles.popupContent}>
          <View style={styles.summaryRow}>
          <Animated.View style={[styles.heroSlot, { width: quickImageSize, height: quickImageSize }, inFlowStyle]}>
            <Pressable
              style={styles.heroHit}
              onPress={(event) => onHeroPress(event.nativeEvent.locationX, event.nativeEvent.locationY)}
              accessibilityRole="image"
              accessibilityLabel={`Double tap to save ${piece.name}`}
            >
              <Image cachePolicy="memory-disk" source={{ uri: currentPhoto }} style={styles.hero} contentFit="contain" />
              {gallery.length > 1 ? (
                <View style={[styles.photoCount, styles.photoCountCompact]} pointerEvents="none">
                  <Text style={styles.photoCountText}>{Math.min(activePhoto + 1, gallery.length)} / {gallery.length}</Text>
                </View>
              ) : null}
            </Pressable>
          </Animated.View>
          <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle} numberOfLines={3}>{piece.name}</Text>
          {credit > 0 ? (
            <View style={[styles.priceRow, styles.summaryPriceRow]}>
              <Text style={styles.was}>{moneyInMarket(localPriceCents, market.currency, market)}</Text>
              <Text style={[styles.price, { marginTop: 0 }]}>{moneyInMarket(saleCents, market.currency, market)}</Text>
            </View>
          ) : (
            <Text style={[styles.price, styles.summaryPrice]}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>
          )}
          <Text style={styles.meta} numberOfLines={2}>{[
            piece.size || piece.sizes?.length ? `Size: ${piece.size || piece.sizes?.join(", ")}` : null,
            piece.color ? `Color: ${piece.color}` : null,
            piece.condition,
          ].filter(Boolean).join(" · ")}</Text>
          </View>
          </View>
          {showDoubleTapHint ? (
            <View style={styles.inlineHint}>
              <Ionicons name="heart-outline" size={14} color={likeColor} />
              <Text style={styles.inlineHintText}>Double-tap the photo to save</Text>
            </View>
          ) : null}
          {gallery.length > 1 ? (
            <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRail}>
              {gallery.map((photo, index) => (
                <Pressable
                  key={`${photo}-${index}`}
                  onPress={() => setActivePhoto(index)}
                  style={[styles.thumbnail, index === activePhoto && styles.thumbnailActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`View listing photo ${index + 1} of ${gallery.length}`}
                  accessibilityState={{ selected: index === activePhoto }}
                >
                  <Image cachePolicy="memory-disk" source={{ uri: photo }} style={styles.thumbnailImage} contentFit="cover" />
                </Pressable>
              ))}
            </Animated.ScrollView>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.scrollCue, pressed && styles.scrollCuePressed]}
            onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, detailsOffset.current - 8), animated: true })}
            accessibilityRole="button"
            accessibilityLabel="More listing details"
            accessibilityHint="Scrolls to measurements, shipping, and listing information."
          >
            <Text style={styles.scrollCueText}>More listing details</Text>
            <Ionicons name="chevron-down" size={16} color={colors.muted} />
          </Pressable>
          {!previewOnly ? (
            <Pressable
              onPress={() => {
                setShowTryOnHint(false);
                onInteraction?.("try_on", piece);
                router.push({ pathname: "/try-on", params: { piece: piece.id } });
              }}
              style={[styles.tryAction, showTryOnHint && styles.tryActionHighlighted]}
              accessibilityRole="button"
              accessibilityLabel="Try this listing on"
            >
              <Ionicons name="body-outline" size={18} color={colors.bone} />
              <Text style={styles.tryText}>Try it on</Text>
            </Pressable>
          ) : null}
          <View style={styles.sellerCard}>
            <Pressable
              onPress={openSeller}
              disabled={!brandRecord && !sellerId}
              style={styles.sellerTap}
              accessibilityRole={brandRecord || sellerId ? "button" : undefined}
              accessibilityLabel={brandRecord ? `Open ${sellerName} brand page` : `Open ${sellerName} seller page`}
            >
              {sellerPhoto ? (
                <Image cachePolicy="memory-disk" source={{ uri: sellerPhoto }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{sellerName.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.sellerCopy}>
                <Text style={styles.sellerEyebrow}>{brandRecord ? "Sold by" : "Listed by"}</Text>
                <View style={styles.sellerNameRow}>
                  <Text style={styles.sellerName} numberOfLines={1}>{sellerName}</Text>
                  <BrandVerifiedMark brand={brandRecord} size={15} />
                </View>
                <Text style={styles.sellerMeta} numberOfLines={1}>Ships from {sellerLocation}</Text>
              </View>
            </Pressable>
            <Pressable onPress={openMessage} style={styles.messageButton} accessibilityRole="button" accessibilityLabel={`Message ${sellerName}`}>
              <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.bone} />
              <Text style={styles.messageText}>Message</Text>
            </Pressable>
          </View>
          {piece.notes ? (
            <View style={styles.conditionBlock}>
              <Text style={styles.conditionLabel}>Condition notes</Text>
              <Text style={styles.notes}>{piece.notes}</Text>
            </View>
          ) : null}
          <View style={styles.rule} />
          {piece.category || piece.material ? (
            <View style={styles.facts}>
              {piece.category ? <Fact label="Category" value={piece.category} styles={styles} /> : null}
              {piece.material ? <Fact label="Material" value={piece.material} styles={styles} /> : null}
            </View>
          ) : null}
          <View
            style={styles.detailSections}
            onLayout={(event) => {
              detailsOffset.current = event.nativeEvent.layout.y;
            }}
          >
            <Pressable onPress={() => setMeasurementsOpen((open) => !open)} style={styles.expandRow} accessibilityRole="button" accessibilityState={{ expanded: measurementsOpen }}>
              <View style={styles.expandTitleWrap}>
                <Ionicons name="resize-outline" size={18} color={colors.success} />
                <Text style={styles.expandTitle}>Measurements & fit</Text>
              </View>
              <Ionicons name={measurementsOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.bone} />
            </Pressable>
            {measurementsOpen ? (
              <View style={styles.expandContent}>
                {measurementEntries.length ? measurementEntries.map(([label, value]) => (
                  <Fact key={label} label={label} value={value} styles={styles} />
                )) : <Text style={styles.emptyDetail}>The seller hasn’t added measurements yet. Message them for fit details.</Text>}
              </View>
            ) : null}
            <Pressable onPress={() => setShippingOpen((open) => !open)} style={styles.expandRow} accessibilityRole="button" accessibilityState={{ expanded: shippingOpen }}>
              <View style={styles.expandTitleWrap}>
                <Ionicons name="cube-outline" size={18} color={colors.success} />
                <Text style={styles.expandTitle}>Shipping & returns</Text>
              </View>
              <Ionicons name={shippingOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.bone} />
            </Pressable>
            {shippingOpen ? (
              <View style={styles.expandContent}>
                <Text style={styles.expandBody}>Ships to {shipsToLabel(piece.country || app.country, piece.shipsTo)}.</Text>
                {piece.shippingMethod ? <Text style={styles.expandBody}>{piece.shippingMethod === "pickup" ? "Courier collects the parcel." : "Seller drops the parcel off."} {piece.shippingBuyerPays === false ? "Seller pays delivery." : "Buyer pays delivery."}</Text> : null}
                <Text style={styles.expandBody}>Returns and delivery details are confirmed at checkout.</Text>
              </View>
            ) : null}
            {!previewOnly && (!app.uid || sellerId !== app.uid) ? (
              <>
                <Pressable onPress={() => setAlertsOpen((open) => !open)} style={styles.expandRow} accessibilityRole="button" accessibilityState={{ expanded: alertsOpen }}>
                  <View style={styles.expandTitleWrap}>
                    <Ionicons name="notifications-outline" size={18} color={colors.success} />
                    <Text style={styles.expandTitle}>Price & restock alerts</Text>
                  </View>
                  <Ionicons name={alertsOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.bone} />
                </Pressable>
                {alertsOpen ? (
                  <View style={styles.expandContent}>
                    <ListingAlertControls piece={piece} colors={colors} appearance="popup" />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
          {canMakeOffer ? (
            <View style={styles.actions}>
              <Pressable onPress={openOfferSheet} style={styles.offerCta} accessibilityRole="button" accessibilityLabel={`Offer ${moneyInMarket(suggestedCents, offerCurrency, market)} for ${piece.name}`}>
                <View style={styles.offerCtaCopy}>
                  <Text style={styles.offerCtaTitle}>Offer this</Text>
                  <Text style={styles.offerCtaHint}>Suggested · 25% below asking</Text>
                </View>
                <Text style={styles.offerCtaPrice}>{moneyInMarket(suggestedCents, offerCurrency, market)}</Text>
                <Ionicons name="arrow-forward" size={17} color={colors.successInk} />
              </Pressable>
            </View>
          ) : null}
          </View>
        </AnimatedScrollView>
        <Animated.View pointerEvents="box-none" style={[styles.stickyFooter, { paddingBottom: 12 }]}>
          {showTryOnHint ? (
            <View pointerEvents="none" style={styles.tryOnHint}>
              <View style={styles.tryOnHintCopy}>
                <Text style={styles.tryOnHintText}>See how this looks on you right now</Text>
                <Text style={styles.tryOnHintSubtext}>Try it on is in the listing details</Text>
              </View>
              <Ionicons name="arrow-up" size={22} color={colors.success} />
            </View>
          ) : null}
          <View style={styles.footerRow}>
            <Pressable onPress={openCheckout} disabled={previewOnly} style={[styles.buyNowAction, previewOnly && styles.actionDisabled]} accessibilityRole="button" accessibilityState={{ disabled: previewOnly }} accessibilityLabel={`Buy ${piece.name} now`}>
              <Text style={styles.buyNowText}>Buy Now</Text>
            </Pressable>
            <Pressable
              onPress={previewOnly ? undefined : () => {
                if (inBag) return;
                addToCart(piece.id);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
              }}
              disabled={previewOnly}
              style={[styles.primaryAction, previewOnly && styles.actionDisabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: previewOnly }}
              accessibilityLabel={inBag ? `${piece.name} is in your cart` : `Add ${piece.name} to cart`}
            >
              <Text style={[styles.primaryText, previewOnly && styles.primaryTextDisabled]}>{inBag ? "In cart" : "Add to cart"}</Text>
            </Pressable>
          </View>
        </Animated.View>
        </Animated.View>
        </GestureDetector>
        <Animated.View pointerEvents="none" style={[styles.photo, photoStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, coverPhotoStyle]}>
            <Image cachePolicy="memory-disk" source={{ uri: originPhoto }} style={styles.hero} contentFit="cover" />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, containPhotoStyle]}>
            <Image cachePolicy="memory-disk" source={{ uri: currentPhoto }} style={styles.hero} contentFit="contain" />
          </Animated.View>
        </Animated.View>
        <Animated.Text pointerEvents="none" style={[styles.heartPop, { color: likeColor }, heartPopStyle]}>♥</Animated.Text>
        <FriendShareSheet visible={shareOpen} payload={sharePayload} onClose={() => setShareOpen(false)} onExternalShare={() => { setShareOpen(false); void NativeShare.share({ title: piece.name, message: `Have a look at ${piece.name} on Uvel. uvel://piece/${piece.id}` }); }} />
        {offerOpen ? (
          <View style={styles.offerBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!offerBusy) setOfferOpen(false); }} accessibilityRole="button" accessibilityLabel="Close offer sheet" />
            <View style={[styles.offerSheet, { paddingBottom: insets.bottom + 18 }]}>
              {offerSent ? (
                <>
                  <View style={styles.offerSentIcon}><Ionicons name="checkmark" size={23} color={colors.successInk} /></View>
                  <Text style={styles.offerSheetTitle}>Offer sent</Text>
                  <Text style={styles.offerSheetBody}>The seller has 24 hours to respond. If they accept, you’ll get a checkout link in your inbox at the agreed price.</Text>
                  <Pressable onPress={() => { setOfferOpen(false); closeToPin(); setTimeout(() => router.push({ pathname: "/ask/[id]", params: { id: piece.id, threadId: offerThreadId, pieceName: piece.name, piecePhoto: piece.photo, piecePriceCents: String(piece.listPriceCents) } }), CLOSE_NAV_DELAY); }} style={styles.offerSubmit} accessibilityRole="button">
                    <Text style={styles.offerSubmitText}>Go to inbox</Text>
                    <Ionicons name="arrow-forward" size={17} color={colors.successInk} />
                  </Pressable>
                  <Pressable onPress={() => setOfferOpen(false)} style={styles.offerCancel} accessibilityRole="button"><Text style={styles.offerCancelText}>Done</Text></Pressable>
                </>
              ) : (
                <>
                  <View style={styles.offerSheetTop}><Text style={styles.offerSheetTitle}>Make an offer</Text><Pressable onPress={() => setOfferOpen(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={23} color={colors.muted} /></Pressable></View>
                  <Text style={styles.offerSheetBody}>Listed at {moneyInMarket(piece.listPriceCents, offerCurrency, market)}. The seller can accept or decline in their inbox.</Text>
                  <Pressable onPress={() => setOfferValue((suggestedCents / 100).toFixed(zeroDecimalOffer ? 0 : 2))} style={styles.offerSuggestion} accessibilityRole="button" accessibilityLabel="Use suggested offer, 25 percent below asking">
                    <Text style={styles.offerSuggestionLabel}>Suggested · 25% off</Text><Text style={styles.offerSuggestionValue}>{moneyInMarket(suggestedCents, offerCurrency, market)}</Text>
                  </Pressable>
                  <View style={styles.offerInputWrap}>
                    <Text style={styles.offerCurrency}>{offerCurrency}</Text>
                    <TextInput value={offerValue} onChangeText={(value) => setOfferValue(value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 12))} keyboardType="decimal-pad" style={styles.offerInput} placeholder={zeroDecimalOffer ? "0" : "0.00"} placeholderTextColor={colors.subtle} accessibilityLabel="Your offer amount" editable={!offerBusy} />
                  </View>
                  <Pressable onPress={() => void submitListingOffer()} disabled={offerBusy} style={[styles.offerSubmit, offerBusy && { opacity: 0.6 }]} accessibilityRole="button">
                    <Text style={styles.offerSubmitText}>{offerBusy ? "Sending…" : "Send offer"}</Text>
                    {!offerBusy ? <Ionicons name="arrow-forward" size={17} color={colors.successInk} /> : null}
                  </Pressable>
                  <Pressable onPress={() => setOfferOpen(false)} disabled={offerBusy} style={styles.offerCancel} accessibilityRole="button"><Text style={styles.offerCancelText}>Cancel</Text></Pressable>
                </>
              )}
            </View>
          </View>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

function Fact({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof make> }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, elevation: 100 },
    fill: { flex: 1 },
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#000" },
    backdropTap: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1 },
    popup: { position: "absolute", zIndex: 2, elevation: 18, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: `${colors.bone}18`, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 22, shadowOffset: { width: 0, height: 12 } },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20` },
    modalHeaderActions: { flexDirection: "row", alignItems: "center", gap: 6 },
    headerAction: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: `${colors.bone}28`, backgroundColor: `${colors.bone}08`, alignItems: "center", justifyContent: "center" },
    popupScroll: { position: "absolute", left: 0, right: 0 },
    popupContent: { paddingBottom: 8 },
    summaryRow: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, flexDirection: "row", alignItems: "flex-start", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20` },
    summaryCopy: { flex: 1, minWidth: 0, justifyContent: "center" },
    summaryTitle: { color: colors.bone, fontSize: 16, lineHeight: 20, fontWeight: "800", letterSpacing: -0.2 },
    summaryPrice: { fontSize: 18, marginTop: 6 },
    summaryPriceRow: { marginTop: 6, gap: 6 },
    scrollCue: { minHeight: 38, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}18` },
    scrollCuePressed: { opacity: 0.68 },
    scrollCueText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    inlineHint: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingTop: 8 },
    inlineHintText: { color: colors.muted, fontSize: 11, fontWeight: "600" },
    heroSlot: { backgroundColor: colors.surface, position: "relative", borderRadius: 14, overflow: "hidden", flexShrink: 0 },
    photo: { position: "absolute", overflow: "hidden", backgroundColor: colors.surface, zIndex: 4 },
    heroHit: { flex: 1 },
    hero: { width: "100%", height: "100%", backgroundColor: colors.surface },
    heartPop: { position: "absolute", left: 0, top: 0, zIndex: 20, fontSize: 68, lineHeight: 72, textShadowColor: "rgba(0,0,0,0.22)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
    photoCount: { position: "absolute", right: 18, bottom: 18, minWidth: 48, height: 28, paddingHorizontal: 9, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.58)", alignItems: "center", justifyContent: "center" },
    photoCountCompact: { right: 6, bottom: 6, minWidth: 36, height: 22, paddingHorizontal: 6, borderRadius: 11 },
    photoCountText: { color: colors.bone, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
    kicker: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1.8 },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 12, flexWrap: "wrap" },
    price: { color: colors.success, fontSize: 19, fontWeight: "800", marginTop: 12, fontVariant: ["tabular-nums"] },
    was: { color: `${colors.bone}66`, fontSize: 16, fontWeight: "600", textDecorationLine: "line-through", fontVariant: ["tabular-nums"] },
    meta: { color: `${colors.bone}85`, fontSize: 11, lineHeight: 15, marginTop: 6 },
    thumbRail: { gap: 8, paddingTop: 12, paddingBottom: 2, paddingHorizontal: 12 },
    thumbnail: { width: 58, height: 72, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: "transparent" },
    thumbnailActive: { borderColor: colors.success, borderWidth: 2 },
    thumbnailImage: { width: "100%", height: "100%", backgroundColor: colors.surface },
    conditionBlock: { marginTop: 14, marginHorizontal: 12, padding: 14, borderRadius: 14, backgroundColor: `${colors.surface}88` },
    conditionLabel: { color: colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
    notes: { color: `${colors.bone}B0`, fontSize: 14, lineHeight: 21, marginTop: 18 },
    sellerCard: { marginTop: 16, marginHorizontal: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: `${colors.bone}1F`, backgroundColor: `${colors.surface}B8`, flexDirection: "row", alignItems: "center", gap: 9 },
    sellerTap: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
    avatarImage: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface },
    avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    avatarInitial: { color: colors.ink, fontSize: 18, fontWeight: "800" },
    sellerCopy: { flex: 1, minWidth: 0 },
    sellerEyebrow: { color: `${colors.bone}70`, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.1 },
    sellerNameRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
    sellerName: { color: colors.bone, fontSize: 14, fontWeight: "800", flexShrink: 1 },
    sellerMeta: { color: `${colors.bone}80`, fontSize: 11, marginTop: 4 },
    messageButton: { minHeight: 36, paddingHorizontal: 11, borderRadius: 18, borderWidth: 1, borderColor: `${colors.bone}36`, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
    messageText: { color: colors.bone, fontSize: 11, fontWeight: "800" },
    rule: { height: 1, backgroundColor: `${colors.bone}20`, marginTop: 16, marginHorizontal: 12 },
    section: { color: colors.bone, fontSize: 16, fontWeight: "800", marginTop: 18 },
    facts: { flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 12, marginHorizontal: 12 },
    fact: { minWidth: "28%" },
    factLabel: { color: `${colors.bone}60`, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
    factValue: { color: colors.bone, fontSize: 13, marginTop: 4 },
    detailSections: { marginTop: 14, marginHorizontal: 12, borderTopWidth: 1, borderTopColor: `${colors.bone}20` },
    expandRow: { minHeight: 54, borderBottomWidth: 1, borderBottomColor: `${colors.bone}20`, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    expandTitleWrap: { flexDirection: "row", alignItems: "center", gap: 9 },
    expandTitle: { color: colors.bone, fontSize: 14, fontWeight: "800" },
    expandContent: { paddingVertical: 14, gap: 10 },
    emptyDetail: { color: colors.muted, fontSize: 13, lineHeight: 20 },
    expandBody: { color: colors.muted, fontSize: 13, lineHeight: 20 },
    actions: { marginTop: 16, marginHorizontal: 12 },
    tryAction: { alignSelf: "flex-start", minWidth: 150, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, borderWidth: 1, borderColor: `${colors.bone}32`, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, marginHorizontal: 12 },
    actionDisabled: { opacity: 0.42 },
    actionTextDisabled: { color: colors.muted },
    tryActionHighlighted: { borderColor: colors.success, borderWidth: 2, backgroundColor: `${colors.success}22`, shadowColor: colors.success, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6 },
    tryText: { color: colors.bone, fontSize: 14, fontWeight: "800" },
    tryOnHint: { minHeight: 62, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: `${colors.success}88`, backgroundColor: `${colors.success}18`, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
    tryOnHintCopy: { flex: 1 },
    tryOnHintText: { color: colors.bone, fontSize: 14, lineHeight: 19, fontWeight: "800" },
    tryOnHintSubtext: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
    stickyFooter: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 7, paddingHorizontal: 12, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${colors.bone}20` },
    footerRow: { flexDirection: "row", gap: 8 },
    buyNowAction: { flex: 1, minHeight: 48, borderRadius: 24, paddingHorizontal: 8, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    buyNowText: { color: colors.successInk, fontSize: 14, fontWeight: "800" },
    primaryAction: { flex: 1, minHeight: 48, borderRadius: 24, paddingHorizontal: 8, backgroundColor: colors.pulse, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    primaryText: { color: colors.pulseInk, fontSize: 14, fontWeight: "800" },
    primaryTextDisabled: { color: colors.muted },
    offerCta: { minHeight: 58, borderRadius: 29, paddingHorizontal: 18, backgroundColor: colors.success, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 },
    offerCtaCopy: { flex: 1 },
    offerCtaTitle: { color: colors.successInk, fontSize: 15, fontWeight: "900" },
    offerCtaHint: { color: `${colors.successInk}B8`, fontSize: 11, fontWeight: "700", marginTop: 2 },
    offerCtaPrice: { color: colors.successInk, fontSize: 15, fontWeight: "900", fontVariant: ["tabular-nums"] },
    offerBackdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.52)" },
    offerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 23, borderTopRightRadius: 23, paddingHorizontal: 22, paddingTop: 22 },
    offerSheetTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    offerSheetTitle: { color: colors.bone, fontFamily: "Georgia", fontSize: 25 },
    offerSheetBody: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 9 },
    offerSuggestion: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: `${colors.success}18`, borderWidth: 1, borderColor: `${colors.success}66` },
    offerSuggestionLabel: { color: colors.success, fontSize: 13, fontWeight: "800" },
    offerSuggestionValue: { color: colors.bone, fontSize: 14, fontWeight: "800" },
    offerInputWrap: { minHeight: 62, marginTop: 12, borderRadius: 14, backgroundColor: colors.ink, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
    offerCurrency: { color: colors.muted, fontSize: 15, fontWeight: "700" },
    offerInput: { flex: 1, color: colors.bone, fontSize: 25, fontWeight: "800", paddingVertical: 10 },
    offerSubmit: { minHeight: 52, borderRadius: 26, marginTop: 16, paddingHorizontal: 18, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
    offerSubmitText: { color: colors.successInk, fontSize: 15, fontWeight: "900" },
    offerCancel: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 3 },
    offerCancelText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
    offerSentIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.success, marginBottom: 12 },
  });
}
