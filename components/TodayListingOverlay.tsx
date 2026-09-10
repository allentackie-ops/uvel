import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Share as NativeShare, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBrand } from "../lib/brands";
import { getMarket, moneyInMarket } from "../lib/markets";
import { shipsToLabel } from "../lib/ships";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { type ClosetPiece } from "../lib/wardrobe";
import type { PersonalizationAction } from "../lib/personalization";
import { VerifiedMark } from "./VerifiedMark";

export type ListingOrigin = { x: number; y: number; width: number; height: number };

const SPRING = { damping: 28, stiffness: 285, mass: 0.82 };

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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const top = useSharedValue(origin.y);
  const left = useSharedValue(origin.x);
  const boxWidth = useSharedValue(origin.width);
  const boxHeight = useSharedValue(origin.height);
  const progress = useSharedValue(0);
  const detailOpacity = useSharedValue(0);
  const chromeOpacity = useSharedValue(0);
  const radius = useSharedValue(18);
  const [activePhoto, setActivePhoto] = useState(0);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(false);
  const lastImageTap = useRef(0);
  const imageTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedAt = useRef(Date.now());
  const dwellRecorded = useRef(false);

  useEffect(() => {
    top.value = withSpring(0, SPRING);
    left.value = withSpring(0, SPRING);
    boxWidth.value = withSpring(screenWidth, SPRING);
    boxHeight.value = withSpring(screenHeight, SPRING);
    progress.value = withTiming(1, { duration: 360 });
    detailOpacity.value = withTiming(1, { duration: 280 });
    chromeOpacity.value = withTiming(1, { duration: 300 });
    radius.value = withTiming(0, { duration: 300 });
  }, [boxHeight, boxWidth, chromeOpacity, detailOpacity, left, progress, radius, screenHeight, screenWidth, top]);

  const animateToOrigin = () => {
    if (!dwellRecorded.current) {
      const dwellSeconds = Math.round((Date.now() - openedAt.current) / 1000);
      if (dwellSeconds >= 10) onInteraction?.("dwell", piece, undefined, dwellSeconds);
      dwellRecorded.current = true;
    }
    top.value = withTiming(origin.y, { duration: 260 });
    left.value = withTiming(origin.x, { duration: 260 });
    boxWidth.value = withTiming(origin.width, { duration: 260 });
    boxHeight.value = withTiming(origin.height, { duration: 260 });
    progress.value = withTiming(0, { duration: 230 });
    detailOpacity.value = withTiming(0, { duration: 150 });
    chromeOpacity.value = withTiming(0, { duration: 120 });
    radius.value = withTiming(18, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const animateToScreen = () => {
    top.value = withSpring(0, SPRING);
    left.value = withSpring(0, SPRING);
    boxWidth.value = withSpring(screenWidth, SPRING);
    boxHeight.value = withSpring(screenHeight, SPRING);
    progress.value = withTiming(1, { duration: 250 });
    detailOpacity.value = withTiming(1, { duration: 220 });
    chromeOpacity.value = withTiming(1, { duration: 230 });
    radius.value = withTiming(0, { duration: 220 });
  };

  const surfaceStyle = useAnimatedStyle(() => ({
    top: top.value,
    left: left.value,
    width: boxWidth.value,
    height: boxHeight.value,
    borderRadius: radius.value,
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 1], [0, 0.58]) }));
  const detailStyle = useAnimatedStyle(() => ({ opacity: detailOpacity.value }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chromeOpacity.value }));

  const brand = piece.brandId ? getBrand(piece.brandId)?.name : piece.brand;
  const brandRecord = piece.brandId ? getBrand(piece.brandId) : undefined;
  const sellerName = brandRecord?.name || piece.ownerName || piece.listedByName || "Uvel seller";
  const sellerPhoto = brandRecord?.logoUri || piece.ownerPhoto || null;
  const sellerLocation = piece.country ? getMarket(piece.country).name : getMarket(app.country).name;
  const market = getMarket(app.country);
  const liked = app.saved.includes(piece.id);
  const gallery = piece.photos?.length ? piece.photos : [piece.photo];
  const measurementEntries = Object.entries(piece.measurements || {}).filter(([, value]) => Boolean(value));
  const currentPhoto = gallery[Math.min(activePhoto, gallery.length - 1)] || piece.photo;
  const heroHeight = Math.min(Math.max(screenHeight * 0.5, 320), 480);
  const heartPopX = useSharedValue(screenWidth / 2);
  const heartPopY = useSharedValue(heroHeight / 2);
  const heartPopScale = useSharedValue(0);
  const heartPopOpacity = useSharedValue(0);

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
    heartPopX.value = withSequence(withTiming(x, { duration: 1 }), withTiming(screenWidth - 38, { duration: 520 }));
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
    onClose();
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
    }, 300);
  }

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
      <Animated.View style={[styles.surface, surfaceStyle]}>
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            nestedScrollEnabled
            decelerationRate="normal"
            onScrollEndDrag={(event) => {
              if (event.nativeEvent.contentOffset.y < -96) animateToOrigin();
            }}
          >
            <Animated.View style={[styles.topBar, { height: insets.top + 76, paddingTop: insets.top }, chromeStyle]}>
              <Pressable onPress={animateToOrigin} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Close listing">
                <Ionicons name="chevron-down" size={20} color={colors.ink} />
              </Pressable>
              <View style={styles.topActions}>
                <Pressable
                  onPress={() => {
                    onInteraction?.("share", piece);
                    void NativeShare.share({ title: piece.name, message: `Have a look at ${piece.name} on Uvel.` });
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
            <Pressable
              style={[styles.heroGesture, { height: heroHeight }]}
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
            <Animated.View style={[styles.detail, detailStyle]}>
              <Text style={styles.kicker}>{(brand || "UVEL").toUpperCase()}</Text>
              <Text style={styles.title}>{piece.name}</Text>
              <Text style={styles.price}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>
              <Text style={styles.meta}>{[piece.size || piece.sizes?.[0] || "One size", piece.color, piece.condition].filter(Boolean).join(" · ")}</Text>
              {gallery.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRail}>
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
                </ScrollView>
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
                <Pressable
                  onPress={openMessage}
                  style={styles.messageButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${sellerName}`}
                >
                  <Ionicons name="chatbubble-outline" size={16} color={colors.bone} />
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
                <Pressable onPress={() => router.push({ pathname: "/checkout/[id]", params: { id: piece.id } })} style={styles.primaryAction} accessibilityRole="button" accessibilityLabel="Buy this listing">
                  <Text style={styles.primaryText}>Add to cart</Text>
                  <Ionicons name="arrow-forward" size={17} color={colors.successInk} />
                </Pressable>
              </View>
            </Animated.View>
          </ScrollView>
      </Animated.View>
    </View>
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
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#000" },
    surface: { position: "absolute", overflow: "hidden", backgroundColor: colors.ink },
    heroGesture: { width: "100%", height: "54%" },
    hero: { width: "100%", height: "100%", backgroundColor: colors.surface },
    heartPop: { position: "absolute", left: 0, top: 0, zIndex: 5, color: colors.success, fontSize: 68, lineHeight: 72, textShadowColor: "rgba(0,0,0,0.22)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
    chrome: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    topBar: { paddingHorizontal: 18, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.ink },
    back: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.bone },
    topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    save: { minHeight: 42, paddingHorizontal: 14, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.bone },
    share: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.bone },
    saveText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
    photoCount: { position: "absolute", right: 18, bottom: 18, minWidth: 48, height: 28, paddingHorizontal: 9, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.58)", alignItems: "center", justifyContent: "center" },
    photoCountText: { color: colors.bone, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
    bodyScroll: { flex: 1 },
    bodyContent: { paddingBottom: 132 },
    detail: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 40 },
    kicker: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1.8 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 7 },
    price: { color: colors.bone, fontSize: 19, fontWeight: "800", marginTop: 12 },
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
