import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Share as NativeShare, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBrand } from "../lib/brands";
import { addToCart, useCart } from "../lib/cart";
import { useFirstFind } from "../lib/firstFind";
import { convertCents, getMarket, moneyInMarket } from "../lib/markets";
import { shipsToLabel } from "../lib/ships";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { type ClosetPiece } from "../lib/wardrobe";
import type { PersonalizationAction } from "../lib/personalization";
import { VerifiedMark } from "./VerifiedMark";
import { FriendShareSheet, type FriendSharePayload } from "./FriendShareSheet";

export type ListingOrigin = { x: number; y: number; width: number; height: number };

const OPEN_SPRING = { damping: 24, stiffness: 260, mass: 0.78 };
const CLOSE_SPRING = { damping: 34, stiffness: 440, mass: 0.6, overshootClamping: true };
const SNAP = { damping: 26, stiffness: 320, mass: 0.7, overshootClamping: true };

export function TodayListingOverlay({
  piece,
  origin,
  onClose,
  onInteraction,
}: {
  piece: ClosetPiece;
  origin: ListingOrigin;
  onClose: () => void;
  onInteraction?: (action: PersonalizationAction, piece: ClosetPiece, query?: string, dwellSeconds?: number) => void;
}) {
  const colors = useColors();
  const styles = make(colors);
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const heroH = Math.round(Math.min(Math.max(screenH * 0.62, 420), 620));
  const chromeTop = insets.top + 54;
  const imgX = useSharedValue(origin.x);
  const imgY = useSharedValue(origin.y);
  const imgW = useSharedValue(origin.width);
  const imgH = useSharedValue(origin.height);
  const imgR = useSharedValue(18);
  const originX = useSharedValue(origin.x);
  const originY = useSharedValue(origin.y);
  const originW = useSharedValue(origin.width);
  const originH = useSharedValue(origin.height);
  const backdrop = useSharedValue(0);
  const chrome = useSharedValue(0);
  const sheet = useSharedValue(0);
  const dragY = useSharedValue(0);
  const closing = useSharedValue(0);
  const dismissing = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const [coverTop, setCoverTop] = useState(0);
  const [activePhoto, setActivePhoto] = useState(0);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const cart = useCart();
  const inBag = cart.has(piece.id);
  const lastImageTap = useRef(0);
  const imageTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedAt = useRef(Date.now());
  const dwellRecorded = useRef(false);
  const rootRef = useRef<View>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  useEffect(() => {
    originX.value = origin.x;
    originY.value = origin.y;
    originW.value = origin.width;
    originH.value = origin.height;
    imgX.value = origin.x;
    imgY.value = origin.y;
    imgW.value = origin.width;
    imgH.value = origin.height;
    imgR.value = 18;
    imgX.value = withSpring(0, OPEN_SPRING);
    imgY.value = withSpring(chromeTop, OPEN_SPRING);
    imgW.value = withSpring(screenW, OPEN_SPRING);
    imgH.value = withSpring(heroH, OPEN_SPRING);
    imgR.value = withSpring(0, OPEN_SPRING);
    backdrop.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    chrome.value = withTiming(1, { duration: 180 });
    sheet.value = withTiming(1, { duration: 220 });
  }, [backdrop, chrome, heroH, imgH, imgR, imgW, imgX, imgY, origin.height, origin.width, origin.x, origin.y, originH, originW, originX, originY, screenW, sheet]);

  const recordDwell = () => {
    if (dwellRecorded.current) return;
    const dwellSeconds = Math.round((Date.now() - openedAt.current) / 1000);
    if (dwellSeconds >= 10) onInteraction?.("dwell", piece, undefined, dwellSeconds);
    dwellRecorded.current = true;
  };

  const finishClose = () => onClose();

  const closeToPin = () => {
    if (closing.value) return;
    closing.value = 1;
    dismissing.value = 1;
    recordDwell();
    chrome.value = withTiming(0, { duration: 70 });
    sheet.value = withTiming(0, { duration: 80 });
    backdrop.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
    imgX.value = withSpring(originX.value, CLOSE_SPRING);
    imgY.value = withSpring(originY.value, CLOSE_SPRING);
    imgW.value = withSpring(originW.value, CLOSE_SPRING);
    imgH.value = withSpring(originH.value, CLOSE_SPRING);
    imgR.value = withSpring(18, CLOSE_SPRING, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      if (closing.value || dismissing.value) return;
      imgY.value = chromeTop - event.contentOffset.y;
    },
  });

  const pan = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetY([-16, 16])
    .onUpdate((event) => {
      if (closing.value) return;
      if (scrollY.value > 2 || event.translationY < 0) {
        dismissing.value = 0;
        dragY.value = 0;
        const next = Math.max(0, scrollY.value - event.changeY);
        scrollTo(scrollRef, 0, next, false);
        return;
      }
      dismissing.value = 1;
      const p = Math.min(Math.max(event.translationY, 0) / 280, 1);
      const s = 1 - p * 0.28;
      const w = screenW * s;
      const h = heroH * s;
      imgW.value = w;
      imgH.value = h;
      imgX.value = (screenW - w) / 2 + event.translationX * 0.4;
      imgY.value = chromeTop + event.translationY * 0.92;
      imgR.value = 20 * p;
      backdrop.value = 1 - p * 0.95;
      chrome.value = Math.max(0, 1 - p * 2.8);
      sheet.value = Math.max(0, 1 - p * 3.2);
      dragY.value = event.translationY;
    })
    .onEnd((event) => {
      if (closing.value) return;
      if (!dismissing.value) return;
      if (dragY.value > 70 || event.velocityY > 800) {
        closing.value = 1;
        runOnJS(recordDwell)();
        chrome.value = withTiming(0, { duration: 70 });
        sheet.value = withTiming(0, { duration: 80 });
        backdrop.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
        imgX.value = withSpring(originX.value, CLOSE_SPRING);
        imgY.value = withSpring(originY.value, CLOSE_SPRING);
        imgW.value = withSpring(originW.value, CLOSE_SPRING);
        imgH.value = withSpring(originH.value, CLOSE_SPRING);
        imgR.value = withSpring(18, CLOSE_SPRING, (finished) => {
          if (finished) runOnJS(finishClose)();
        });
        return;
      }
      dismissing.value = 0;
      dragY.value = 0;
      imgX.value = withSpring(0, SNAP);
      imgY.value = withSpring(chromeTop, SNAP);
      imgW.value = withSpring(screenW, SNAP);
      imgH.value = withSpring(heroH, SNAP);
      imgR.value = withSpring(0, SNAP);
      backdrop.value = withSpring(1, SNAP);
      chrome.value = withTiming(1, { duration: 140 });
      sheet.value = withTiming(1, { duration: 160 });
    });

  const photoStyle = useAnimatedStyle(() => ({
    top: imgY.value,
    left: imgX.value,
    width: imgW.value,
    height: imgH.value,
    borderRadius: imgR.value,
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value * 0.55 }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
  const pageStyle = useAnimatedStyle(() => ({ opacity: sheet.value }));

  const brand = piece.brandId ? getBrand(piece.brandId)?.name : piece.brand;
  const brandRecord = piece.brandId ? getBrand(piece.brandId) : undefined;
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
  const heartPopX = useSharedValue(screenW / 2);
  const heartPopY = useSharedValue(heroH / 2);
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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onInteraction?.("double_tap_like", piece);
    if (!liked) {
      onInteraction?.("save", piece);
      void app.toggleSaved(piece.id);
    }
    heartPopX.value = withSequence(withTiming(x, { duration: 1 }), withTiming(screenW - 38, { duration: 520 }));
    heartPopY.value = withSequence(withTiming(y, { duration: 1 }), withTiming(-38, { duration: 520 }));
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
    }, 280);
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
        <Animated.ScrollView
          ref={scrollRef}
          style={[styles.page, pageStyle]}
          contentContainerStyle={[styles.pageContent, { paddingTop: chromeTop + heroH, paddingBottom: insets.bottom + 120 }]}
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
          <Text style={styles.kicker}>{(brand || "UVEL").toUpperCase()}</Text>
          <Text style={styles.title}>{piece.name}</Text>
          {credit > 0 ? (
            <View style={styles.priceRow}>
              <Text style={styles.was}>{moneyInMarket(localPriceCents, market.currency, market)}</Text>
              <Text style={[styles.price, { marginTop: 0 }]}>{moneyInMarket(saleCents, market.currency, market)}</Text>
            </View>
          ) : (
            <Text style={styles.price}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>
          )}
          <Text style={styles.meta}>{[piece.size || piece.sizes?.[0] || "One size", piece.color, piece.condition].filter(Boolean).join(" · ")}</Text>
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
                  <Image source={{ uri: photo }} style={styles.thumbnailImage} contentFit="cover" />
                </Pressable>
              ))}
            </Animated.ScrollView>
          ) : null}
          <View style={styles.sellerCard}>
            {sellerPhoto ? (
              <Image source={{ uri: sellerPhoto }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{sellerName.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.sellerCopy}>
              <Text style={styles.sellerEyebrow}>{brandRecord ? "Sold by" : "Listed by"}</Text>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName} numberOfLines={1}>{sellerName}</Text>
                {brandRecord?.verified && brandRecord.status === "verified" ? <VerifiedMark size={15} /> : null}
              </View>
              <Text style={styles.sellerMeta} numberOfLines={1}>Ships from {sellerLocation}</Text>
            </View>
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
          <Text style={styles.section}>Listing details</Text>
          <View style={styles.facts}>
            {piece.category ? <Fact label="Category" value={piece.category} styles={styles} /> : null}
            {piece.material ? <Fact label="Material" value={piece.material} styles={styles} /> : null}
            <Fact label="Ships from" value={piece.country || app.country} styles={styles} />
          </View>
          <View style={styles.detailSections}>
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
                <Text style={styles.expandBody}>Returns and delivery details are confirmed at checkout.</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.trustRow}>
            <TrustItem icon="shield-checkmark-outline" label="Secure checkout" styles={styles} />
            <TrustItem icon="checkmark-circle-outline" label="Buyer protection" styles={styles} />
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => { onInteraction?.("try_on", piece); router.push({ pathname: "/try-on", params: { piece: piece.id } }); }} style={styles.tryAction} accessibilityRole="button" accessibilityLabel="Try this listing on">
              <Ionicons name="body-outline" size={18} color={colors.bone} />
              <Text style={styles.tryText}>Try it on</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (inBag) return;
                addToCart(piece.id);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
              }}
              style={styles.primaryAction}
              accessibilityRole="button"
              accessibilityLabel={inBag ? `${piece.name} is in your cart` : `Add ${piece.name} to cart`}
            >
              <Text style={styles.primaryText}>{inBag ? "In cart" : "Add to cart"}</Text>
              <Ionicons name={inBag ? "checkmark" : "bag-handle-outline"} size={17} color={colors.successInk} />
            </Pressable>
          </View>
        </Animated.ScrollView>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.photo, photoStyle]}>
            <Pressable
              style={styles.heroHit}
              onPress={(event) => onHeroPress(event.nativeEvent.locationX, event.nativeEvent.locationY)}
              accessibilityRole="image"
              accessibilityLabel={`Double tap to save ${piece.name}`}
            >
              <Image source={{ uri: currentPhoto }} style={styles.hero} contentFit="cover" />
              <Animated.Text pointerEvents="none" style={[styles.heartPop, heartPopStyle]}>♥</Animated.Text>
              {gallery.length > 1 ? (
                <View style={styles.photoCount} pointerEvents="none">
                  <Text style={styles.photoCountText}>{Math.min(activePhoto + 1, gallery.length)} / {gallery.length}</Text>
                </View>
              ) : null}
            </Pressable>
          </Animated.View>
        </GestureDetector>
        <Animated.View pointerEvents="box-none" style={[styles.topBar, { paddingTop: insets.top + 6 }, chromeStyle]}>
          <Pressable onPress={closeToPin} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Close listing">
            <Ionicons name="chevron-down" size={20} color={colors.ink} />
          </Pressable>
          <View style={styles.topActions} pointerEvents="box-none">
            <Pressable
              onPress={() => {
                onInteraction?.("share", piece);
                setShareOpen(true);
              }}
              hitSlop={10}
              style={styles.share}
              accessibilityRole="button"
              accessibilityLabel={`Share ${piece.name}`}
            >
              <Ionicons name="share-outline" size={20} color={colors.ink} />
            </Pressable>
            <Pressable
              onPress={() => {
                onInteraction?.("save", piece);
                void app.toggleSaved(piece.id);
              }}
              hitSlop={10}
              style={styles.save}
              accessibilityRole="button"
              accessibilityLabel={liked ? "Remove listing from saved" : "Save listing"}
            >
              <Ionicons name={liked ? "heart" : "heart-outline"} size={21} color={liked ? colors.success : colors.ink} />
              <Text style={styles.saveText}>{liked ? "Saved" : "Save"}</Text>
            </Pressable>
          </View>
        </Animated.View>
        <FriendShareSheet visible={shareOpen} payload={sharePayload} onClose={() => setShareOpen(false)} onExternalShare={() => { setShareOpen(false); void NativeShare.share({ title: piece.name, message: `Have a look at ${piece.name} on Uvel. uvel://piece/${piece.id}` }); }} />
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

function TrustItem({ icon, label, styles }: { icon: keyof typeof Ionicons.glyphMap; label: string; styles: ReturnType<typeof make> }) {
  return (
    <View style={styles.trustItem}>
      <Ionicons name={icon} size={16} color="#7F9BFF" />
      <Text style={styles.trustText}>{label}</Text>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, elevation: 100 },
    fill: { flex: 1 },
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#000" },
    page: { flex: 1, backgroundColor: colors.ink },
    pageContent: { paddingHorizontal: 22, paddingBottom: 40 },
    photo: { position: "absolute", overflow: "hidden", backgroundColor: colors.surface, zIndex: 4 },
    heroHit: { flex: 1 },
    hero: { width: "100%", height: "100%", backgroundColor: colors.surface },
    heartPop: { position: "absolute", left: 0, top: 0, zIndex: 5, color: colors.success, fontSize: 68, lineHeight: 72, textShadowColor: "rgba(0,0,0,0.22)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
    topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 8, paddingHorizontal: 18, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.bone },
    topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    save: { minHeight: 42, paddingHorizontal: 14, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.bone },
    share: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.bone },
    saveText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
    photoCount: { position: "absolute", right: 18, bottom: 18, minWidth: 48, height: 28, paddingHorizontal: 9, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.58)", alignItems: "center", justifyContent: "center" },
    photoCountText: { color: colors.bone, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
    kicker: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1.8 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 7 },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 12, flexWrap: "wrap" },
    price: { color: colors.success, fontSize: 19, fontWeight: "800", marginTop: 12 },
    was: { color: `${colors.bone}66`, fontSize: 16, fontWeight: "600", textDecorationLine: "line-through", fontVariant: ["tabular-nums"] },
    meta: { color: `${colors.bone}85`, fontSize: 13, marginTop: 7 },
    thumbRail: { gap: 8, paddingTop: 16, paddingBottom: 2 },
    thumbnail: { width: 58, height: 72, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: "transparent" },
    thumbnailActive: { borderColor: colors.success, borderWidth: 2 },
    thumbnailImage: { width: "100%", height: "100%", backgroundColor: colors.surface },
    conditionBlock: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: `${colors.surface}88` },
    conditionLabel: { color: colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
    notes: { color: `${colors.bone}B0`, fontSize: 14, lineHeight: 21, marginTop: 18 },
    sellerCard: { marginTop: 22, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: `${colors.bone}1F`, backgroundColor: `${colors.surface}B8`, flexDirection: "row", alignItems: "center", gap: 10 },
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
    rule: { height: 1, backgroundColor: `${colors.bone}20`, marginTop: 22 },
    section: { color: colors.bone, fontSize: 16, fontWeight: "800", marginTop: 18 },
    facts: { flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 13 },
    fact: { minWidth: "28%" },
    factLabel: { color: `${colors.bone}60`, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
    factValue: { color: colors.bone, fontSize: 13, marginTop: 4 },
    detailSections: { marginTop: 22, borderTopWidth: 1, borderTopColor: `${colors.bone}20` },
    expandRow: { minHeight: 54, borderBottomWidth: 1, borderBottomColor: `${colors.bone}20`, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    expandTitleWrap: { flexDirection: "row", alignItems: "center", gap: 9 },
    expandTitle: { color: colors.bone, fontSize: 14, fontWeight: "800" },
    expandContent: { paddingVertical: 14, gap: 10 },
    emptyDetail: { color: colors.muted, fontSize: 13, lineHeight: 20 },
    expandBody: { color: colors.muted, fontSize: 13, lineHeight: 20 },
    trustRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 18 },
    trustItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    trustText: { color: `${colors.bone}A8`, fontSize: 11, fontWeight: "700" },
    actions: { flexDirection: "row", gap: 10, marginTop: 26 },
    tryAction: { flex: 1, minHeight: 52, borderRadius: 26, paddingHorizontal: 12, borderWidth: 1, borderColor: `${colors.bone}32`, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    tryText: { color: colors.bone, fontSize: 14, fontWeight: "800" },
    primaryAction: { flex: 1.3, minHeight: 52, borderRadius: 26, paddingHorizontal: 12, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    primaryText: { color: colors.successInk, fontSize: 14, fontWeight: "800" },
  });
}
