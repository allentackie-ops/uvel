import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Share as NativeShare, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Drawer } from "react-native-drawer-layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { FriendShareSheet, type FriendSharePayload } from "../components/FriendShareSheet";
import { ImmersiveListingDetails } from "../components/ImmersiveListingDetails";
import { TodayCartFab } from "../components/TodayCartFab";
import TodayToolsDrawer from "../components/TodayToolsDrawer";
import { OrbitLoader, useMinHold } from "../components/OrbitLoader";
import * as Haptics from "../lib/haptics";
import { addToCart, useCart } from "../lib/cart";
import { getBrand, isFollowing, toggleFollow, useBrands } from "../lib/brands";
import { useFirstFind } from "../lib/firstFind";
import { getMarket, moneyExact, moneyInMarket } from "../lib/markets";
import { hydrateFollowedSellers, isSellerFollowed, syncSellerFollow, toggleSellerFollow } from "../lib/sellers";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { useCopy } from "../lib/useCopy";
import { refreshMarketplaceListings, shopFloor, useWardrobe } from "../lib/wardrobe";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const MIN_REFRESH_MS = 1200;
const CATALOG_BRAND_IDS: Record<string, string> = {
  "Maison Found": "maison-found",
  "Archive 1982": "archive-1982",
  "Atelier No. 4": "atelier-no4",
};

export default function ImmersiveShopping() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const firstFind = useFirstFind();
  const C = useCopy();
  const taskbarHeight = 64 + Math.max(insets.bottom, 8);
  const contentHeight = Math.max(1, SCREEN_HEIGHT - taskbarHeight);
  useBrands();
  useEffect(() => { void hydrateFollowedSellers(); }, []);
  const wardrobePieces = useWardrobe();
  const [activeIndex, setActiveIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [findHint, setFindHint] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedEpoch, setFeedEpoch] = useState(0);
  const menuPressRef = useRef(false);
  const refreshInFlight = useRef(false);
  const swipeY = useSharedValue(0);
  const activeIndexShared = useSharedValue(0);
  const swipeLock = useSharedValue(0);
  const refreshTriggered = useSharedValue(0);
  const refreshActiveShared = useSharedValue(0);
  const refreshImageScale = useSharedValue(1);
  useEffect(() => {
    if (!findHint) return;
    const timer = setTimeout(() => setFindHint(false), 3200);
    return () => clearTimeout(timer);
  }, [findHint]);

  const pieces = useMemo(() => {
    return shopFloor(app.country);
  }, [app.country, feedEpoch, wardrobePieces]);

  const onRefresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    refreshActiveShared.value = 1;
    swipeLock.value = 1;
    setRefreshing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      await Promise.all([
        refreshMarketplaceListings(),
        new Promise<void>((resolve) => setTimeout(resolve, MIN_REFRESH_MS)),
      ]);
    } catch {
      // Keep the local feed usable if the marketplace refresh is unavailable.
    } finally {
      setFeedEpoch((n) => n + 1);
      setRefreshing(false);
      refreshInFlight.current = false;
      refreshActiveShared.value = 0;
      refreshImageScale.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
      swipeLock.value = 0;
    }
  }, [refreshActiveShared, refreshImageScale, swipeLock]);
  const orbitOn = useMinHold(refreshing, MIN_REFRESH_MS);

  useEffect(() => {
    activeIndexShared.value = activeIndex;
    swipeLock.value = 0;
  }, [activeIndex, activeIndexShared, swipeLock]);
  // Position cards by absolute item index, not by their React slot. During the
  // UI-thread handoff React can still hold the previous slot order for a frame.
  const currentCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: swipeY.value + (activeIndex - activeIndexShared.value) * contentHeight }],
  }));
  const nextCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: swipeY.value + (activeIndex + 1 - activeIndexShared.value) * contentHeight }],
  }));
  const previousCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: swipeY.value + (activeIndex - 1 - activeIndexShared.value) * contentHeight }],
  }));
  const commitSwipe = useCallback((nextIndex: number) => {
    setActiveIndex(nextIndex);
  }, []);
  const panGesture = useMemo(() => Gesture.Pan()
    .enabled(!drawerOpen && pieces.length > 0)
    .maxPointers(1)
    .activeOffsetY([-12, 12])
    .failOffsetX([-18, 18])
    .onBegin(() => {
      if (!refreshActiveShared.value) refreshTriggered.value = 0;
    })
    .onUpdate((event) => {
      const currentIndex = activeIndexShared.value;
      if (currentIndex === 0 && event.translationY > 0) {
        const pull = Math.min(180, event.translationY);
        swipeY.value = 0;
        if (!refreshTriggered.value || refreshActiveShared.value) {
          refreshImageScale.value = 1 + (pull / 180) * 0.22;
        }
        if (pull > 48 && !refreshTriggered.value) {
          refreshTriggered.value = 1;
          swipeLock.value = 1;
          runOnJS(onRefresh)();
        }
        return;
      }
      if (swipeLock.value) return;
      const direction = event.translationY < 0 ? 1 : -1;
      const atBoundary = (direction < 0 && activeIndexShared.value === 0)
        || (direction > 0 && activeIndexShared.value >= pieces.length - 1);
      const translation = atBoundary ? event.translationY * 0.2 : event.translationY;
      swipeY.value = Math.max(-contentHeight, Math.min(contentHeight, translation));
    })
    .onEnd((event) => {
      if (refreshTriggered.value) {
        swipeY.value = 0;
        swipeLock.value = refreshActiveShared.value ? 1 : 0;
        return;
      }
      if (swipeLock.value) return;

      const currentIndex = activeIndexShared.value;
      const direction = event.translationY < 0 ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(pieces.length - 1, currentIndex + direction));
      const enoughDistance = Math.abs(event.translationY) >= contentHeight * 0.2;
      const enoughVelocity = Math.abs(event.velocityY) >= 650;
      const shouldAdvance = nextIndex !== currentIndex && (enoughDistance || enoughVelocity);
      const target = shouldAdvance ? (direction > 0 ? -contentHeight : contentHeight) : 0;

      swipeLock.value = 1;
      swipeY.value = withTiming(target, {
        duration: shouldAdvance ? 240 : 180,
        easing: Easing.out(Easing.cubic),
      }, (finished) => {
        if (finished && shouldAdvance) {
          activeIndexShared.value = nextIndex;
          swipeY.value = 0;
          runOnJS(commitSwipe)(nextIndex);
        } else {
          swipeLock.value = 0;
        }
      });
    })
    .onFinalize(() => {
      if (refreshTriggered.value) {
        swipeY.value = 0;
        if (!refreshActiveShared.value) {
          swipeLock.value = 0;
          refreshImageScale.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
        }
        return;
      }
      if (!swipeLock.value && swipeY.value !== 0) {
        swipeY.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.cubic) });
      }
      refreshImageScale.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    }), [activeIndexShared, commitSwipe, contentHeight, drawerOpen, onRefresh, pieces.length, refreshActiveShared, refreshImageScale, refreshTriggered, swipeLock, swipeY]);
  const activePiece = pieces[activeIndex];
  const nextPiece = pieces[activeIndex + 1];
  const previousPiece = pieces[activeIndex - 1];

  useEffect(() => {
    // Keep the next couple of images warm so rapid swipes don't reveal an
    // unloaded image while the incoming card is already moving on screen.
    const imageUris = pieces
      .slice(activeIndex, activeIndex + 3)
      .map((piece) => piece.photo)
      .filter((uri): uri is string => /^https?:\/\//i.test(uri));
    if (imageUris.length) void Image.prefetch(imageUris, "memory-disk").catch(() => undefined);
  }, [activeIndex, pieces]);

  return (
    <Drawer
      open={drawerOpen}
      onOpen={() => {
        setDrawerOpen(true);
        if (menuPressRef.current) menuPressRef.current = false;
        else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      }}
      onClose={() => setDrawerOpen(false)}
      swipeEnabled
      swipeEdgeWidth={SCREEN_WIDTH}
      swipeMinDistance={10}
      swipeMinVelocity={100}
      drawerType="slide"
      drawerPosition="left"
      drawerStyle={{ width: Math.min(SCREEN_WIDTH * 0.78, 340), backgroundColor: colors.ink }}
      overlayStyle={{ backgroundColor: "rgba(0,0,0,0.32)" }}
      configureGestureHandler={(handler) => drawerOpen ? handler.activeOffsetX([-1, 1]) : handler.failOffsetX(-1).activeOffsetX(5)}
      renderDrawerContent={() => (
        <TodayToolsDrawer
          onClose={() => setDrawerOpen(false)}
          onOpenSell={() => { setDrawerOpen(false); router.push("/sell"); }}
          onOpenMirror={() => { setDrawerOpen(false); router.push("/mirror"); }}
        />
      )}
    >
      <GestureDetector gesture={panGesture}>
      <View style={styles.page}>
        {activePiece ? <>
          {previousPiece ? <Animated.View key={previousPiece.id} pointerEvents="none" style={[styles.cardLayer, { height: contentHeight }, previousCardStyle]}>
            <ImmersiveItem piece={previousPiece} active={false} colors={colors} styles={styles} insets={insets} app={app} firstFind={firstFind} contentHeight={contentHeight} refreshImageScale={refreshImageScale} onFirstFind={() => setFindHint(true)} firstFindLabel={C.firstFind} />
          </Animated.View> : null}
          <Animated.View key={activePiece.id} style={[styles.cardLayer, { height: contentHeight }, currentCardStyle]}>
          <ImmersiveItem
          piece={activePiece}
          active
          colors={colors}
          styles={styles}
          insets={insets}
          app={app}
          firstFind={firstFind}
          contentHeight={contentHeight}
          refreshImageScale={refreshImageScale}
          onFirstFind={() => setFindHint(true)}
          firstFindLabel={C.firstFind}
          />
          </Animated.View>
          {nextPiece ? <Animated.View key={nextPiece.id} pointerEvents="none" style={[styles.cardLayer, { height: contentHeight }, nextCardStyle]}>
            <ImmersiveItem piece={nextPiece} active={false} colors={colors} styles={styles} insets={insets} app={app} firstFind={firstFind} contentHeight={contentHeight} refreshImageScale={refreshImageScale} onFirstFind={() => setFindHint(true)} firstFindLabel={C.firstFind} />
          </Animated.View> : null}
        </> : <View style={[styles.empty, { height: contentHeight, paddingTop: insets.top + 24 }]}>
          <Text style={styles.emptyKicker}>IMMERSIVE SHOPPING</Text>
          <Text style={styles.emptyTitle}>The edit is quiet for now.</Text>
          <Text style={styles.emptyBody}>Come back soon for more pieces to discover.</Text>
        </View>}
        <View pointerEvents="box-none" style={[styles.topControls, { paddingTop: insets.top + 8 }]}>
          <AccessiblePressable onPress={() => { menuPressRef.current = true; setDrawerOpen(true); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); }} style={styles.menuButton} accessibilityRole="button" accessibilityLabel="Open Today drawer">
            <Ionicons name="menu" size={28} color={colors.bone} />
          </AccessiblePressable>
          <AccessiblePressable onPress={() => router.push("/search")} style={styles.menuButton} accessibilityRole="button" accessibilityLabel="Search">
            <Ionicons name="search-outline" size={23} color={colors.bone} />
          </AccessiblePressable>
        </View>
        {findHint ? <View pointerEvents="none" style={[styles.findToast, { top: insets.top + 68 }]} accessibilityLiveRegion="polite">
          <Text style={styles.findToastK}>{C.firstFind}</Text>
          <Text style={styles.findToastTxt}>{C.matchingPiece} · {moneyExact(firstFind.remaining, firstFind.currency)}</Text>
        </View> : null}
        {orbitOn ? <View pointerEvents="none" style={[styles.refreshOrbit, { top: insets.top + 68 }]}><OrbitLoader /></View> : null}
        <ImmersiveTaskbar colors={colors} C={C} insets={insets} styles={styles} />
        <TodayCartFab listingOpen />
      </View>
      </GestureDetector>
    </Drawer>
  );
}

function ImmersiveTaskbar({ colors, C, insets, styles }: { colors: Colors; C: ReturnType<typeof useCopy>; insets: { bottom: number }; styles: ReturnType<typeof make> }) {
  const tabs = [
    { route: "/" as const, icon: "compass" as const, inactive: "compass-outline" as const, label: C.today },
    { route: "/create" as const, icon: "pricetag" as const, inactive: "pricetag-outline" as const, label: C.create || "Create" },
    { route: "/you" as const, icon: "person-outline" as const, inactive: "person-outline" as const, label: C.you || "You" },
  ];
  return (
    <View style={[styles.taskbarWrap, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.ink }]}>
      <View style={[styles.taskbar, { backgroundColor: colors.ink }]}>
        {tabs.map((tab, index) => {
          const active = index === 0;
          return (
            <AccessiblePressable
              key={tab.route}
              onPress={() => router.navigate(tab.route)}
              style={({ pressed }) => [styles.taskbarTab, pressed && styles.taskbarTabPressed]}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
            >
              <View style={styles.taskbarIconSlot} accessibilityElementsHidden>
                <Ionicons name={active ? tab.icon : tab.inactive} size={26} color={active ? colors.success : colors.muted} />
              </View>
              <Text style={[styles.taskbarLabel, { color: active ? colors.success : colors.muted }]}>{tab.label}</Text>
            </AccessiblePressable>
          );
        })}
      </View>
    </View>
  );
}

function ImmersiveItem({ piece, active, colors, styles, insets, app, firstFind, contentHeight, refreshImageScale, onFirstFind, firstFindLabel }: any) {
  const [shareOpen, setShareOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const cart = useCart();
  const lastImageTap = useRef(0);
  const imageTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartX = useSharedValue(SCREEN_WIDTH / 2);
  const heartY = useSharedValue(SCREEN_HEIGHT / 2);
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const saveTargetX = useSharedValue(SCREEN_WIDTH - 42);
  const saveTargetY = useSharedValue(SCREEN_HEIGHT - insets.bottom - 148 - 99);
  const brandRecord = piece.brandId ? getBrand(piece.brandId) : undefined;
  const catalogBrandId = !brandRecord && piece.brand ? CATALOG_BRAND_IDS[piece.brand] : undefined;
  const followId = brandRecord?.id || piece.ownerId || piece.listedByUid || catalogBrandId || "";
  const isBrand = Boolean(brandRecord);
  const followTargetKey = `${isBrand ? "brand" : "seller"}:${followId}`;
  const [following, setFollowing] = useState(() => isBrand ? isFollowing(followId, app.uid) : isSellerFollowed(followId));
  const [showFollowingStatus, setShowFollowingStatus] = useState(false);
  const interactedFollowTarget = useRef<string | null>(null);
  const followingStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followingFeedbackOpacity = useSharedValue(1);
  const followingFeedbackScale = useSharedValue(1);
  const followingFeedbackY = useSharedValue(0);
  const followingFeedbackStyle = useAnimatedStyle(() => ({
    opacity: followingFeedbackOpacity.value,
    transform: [{ translateY: followingFeedbackY.value }, { scale: followingFeedbackScale.value }],
  }));
  useEffect(() => {
    // A quick first tap can beat this mount/auth sync; don't let its stale
    // snapshot undo the optimistic Follow state for the same listing.
    if (interactedFollowTarget.current === followTargetKey) return;
    setFollowing(isBrand ? isFollowing(followId, app.uid) : isSellerFollowed(followId));
  }, [app.uid, followId, followTargetKey, isBrand]);
  useEffect(() => () => {
    if (followingStatusTimer.current) clearTimeout(followingStatusTimer.current);
    cancelAnimation(followingFeedbackOpacity);
    cancelAnimation(followingFeedbackScale);
    cancelAnimation(followingFeedbackY);
  }, [followingFeedbackOpacity, followingFeedbackScale, followingFeedbackY]);
  const market = getMarket(app.country);
  const itemCurrency = piece.currency || getMarket(piece.country || app.country).currency;
  const localPrice = moneyInMarket(piece.listPriceCents, itemCurrency, market);
  const credit = firstFind.applyTo(piece, piece.listPriceCents);
  const sale = Math.max(0, piece.listPriceCents - credit);
  const salePrice = moneyInMarket(sale, market.currency, market);
  const liked = app.saved.includes(piece.id);
  const brand = piece.brand && piece.brand !== "Unlabeled" ? piece.brand : piece.category;
  const sellerName = brandRecord?.name || piece.ownerName || piece.listedByName || (piece.brand && piece.brand !== "Unlabeled" ? piece.brand : "Uvel seller");
  const sellerPhoto = brandRecord?.logoUri || piece.ownerPhoto || null;
  const sharePayload: FriendSharePayload = { kind: "listing", id: piece.id, title: piece.name, deepLink: `uvel://piece/${piece.id}`, imageUri: piece.photo, previewText: `Have a look at ${piece.name} on Uvel.` };
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [
      { translateX: heartX.value },
      { translateY: heartY.value },
      { translateX: -34 },
      { translateY: -34 },
      { scale: heartScale.value },
    ],
  }));
  const itemImageFrameStyle = useAnimatedStyle(() => ({
    height: contentHeight * (refreshImageScale ? refreshImageScale.value : 1),
  }));
  function doubleTapSave(x: number, y: number) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (!liked) void app.toggleSaved(piece.id);
    heartX.value = withSequence(withTiming(x, { duration: 1 }), withTiming(saveTargetX.value, { duration: 560 }));
    heartY.value = withSequence(withTiming(y, { duration: 1 }), withTiming(saveTargetY.value, { duration: 560 }));
    heartScale.value = withSequence(withSpring(1.12, { damping: 10, stiffness: 260 }), withTiming(0.55, { duration: 520 }));
    heartOpacity.value = withSequence(withTiming(1, { duration: 1 }), withTiming(0, { duration: 520 }));
  }
  function handleImagePress(x: number, y: number) {
    const now = Date.now();
    if (now - lastImageTap.current <= 450) {
      if (imageTapTimer.current) clearTimeout(imageTapTimer.current);
      lastImageTap.current = 0;
      doubleTapSave(x, y);
      return;
    }
    lastImageTap.current = now;
    if (imageTapTimer.current) clearTimeout(imageTapTimer.current);
    imageTapTimer.current = setTimeout(() => {
      lastImageTap.current = 0;
      imageTapTimer.current = null;
    }, 450);
  }
  function follow() {
    if (!followId) return;
    interactedFollowTarget.current = followTargetKey;
    const next = isBrand ? toggleFollow(followId, app.uid || "me") : toggleSellerFollow(followId);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    cancelAnimation(followingFeedbackOpacity);
    cancelAnimation(followingFeedbackScale);
    cancelAnimation(followingFeedbackY);
    setFollowing(next);
    if (followingStatusTimer.current) clearTimeout(followingStatusTimer.current);
    if (next) {
      followingFeedbackOpacity.value = 0;
      followingFeedbackScale.value = 0.88;
      followingFeedbackY.value = 5;
      setShowFollowingStatus(true);
      followingFeedbackOpacity.value = withTiming(1, { duration: 130 });
      followingFeedbackScale.value = withSequence(
        withTiming(1.08, { duration: 150 }),
        withSpring(1, { damping: 13, stiffness: 260 }),
      );
      followingFeedbackY.value = withSpring(0, { damping: 15, stiffness: 230 });
      followingStatusTimer.current = setTimeout(() => {
        followingFeedbackOpacity.value = withTiming(0, { duration: 200 });
        followingFeedbackScale.value = withTiming(0.94, { duration: 200 });
        followingFeedbackY.value = withTiming(-5, { duration: 200 });
        followingStatusTimer.current = setTimeout(() => {
          setShowFollowingStatus(false);
          followingFeedbackOpacity.value = 1;
          followingFeedbackScale.value = 1;
          followingFeedbackY.value = 0;
          followingStatusTimer.current = null;
        }, 200);
      }, 1300);
    } else {
      setShowFollowingStatus(false);
      followingFeedbackOpacity.value = 1;
      followingFeedbackScale.value = 1;
      followingFeedbackY.value = 0;
      followingStatusTimer.current = null;
    }
    if (!isBrand) void syncSellerFollow(app.uid, followId, next);
  }
  function openSeller() {
    if (brandRecord) router.push({ pathname: "/brand/[id]", params: { id: brandRecord.id } });
    else if (followId) router.push({ pathname: "/seller/[id]", params: { id: followId } });
  }

  return (
    <View
      style={[styles.item, { height: contentHeight }]}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    >
      <AccessiblePressable onPress={(event) => handleImagePress(event.nativeEvent.locationX, event.nativeEvent.locationY)} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={`${brand}, ${piece.name}, ${localPrice}. Double tap to save.`}>
        <Animated.View pointerEvents="none" style={[styles.itemImageFrame, { height: contentHeight }, itemImageFrameStyle]}>
          <Image source={{ uri: piece.photo }} style={styles.itemImage} contentFit="cover" cachePolicy="memory-disk" transition={0} accessible={false} />
        </Animated.View>
        <View pointerEvents="none" style={styles.itemShade} />
      </AccessiblePressable>
      <View pointerEvents="box-none" style={[styles.itemCopy, { paddingTop: insets.top + 24, paddingBottom: 24 }]}>
        <View style={styles.copySpacer} />
        <View>
          <AccessiblePressable onPress={() => router.back()} style={styles.copyBackButton} accessibilityRole="button" accessibilityLabel="Back to Today">
            <Ionicons name="arrow-back" size={23} color={colors.bone} />
          </AccessiblePressable>
          {firstFind.matches(piece) ? <AccessiblePressable onPress={onFirstFind} style={styles.firstFind} accessibilityRole="button" accessibilityLabel="What First Find is" accessibilityHint="Double tap to hear how First Find works on this piece.">
            <Text style={styles.firstFindText}>{firstFindLabel}</Text>
          </AccessiblePressable> : null}
          <AccessiblePressable
            onPress={() => setDetailsOpen(true)}
            style={styles.nameDetailsButton}
            accessibilityRole="button"
            accessibilityLabel={`View details for ${piece.name}`}
            accessibilityHint="Opens the listing description, seller location, and item details."
          >
            <Text style={styles.name} numberOfLines={2}>{piece.name}</Text>
            <Ionicons name="chevron-up" size={18} color={colors.bone} />
          </AccessiblePressable>
          {credit > 0 ? (
            <View style={styles.priceRow}><Text style={styles.was}>{localPrice}</Text><Text style={styles.price}>{salePrice}</Text></View>
          ) : <Text style={styles.price}>{localPrice}</Text>}
        </View>
      </View>
      <View style={[styles.actions, { bottom: 118 }]} onLayout={(event) => {
        const { x, y, width, height } = event.nativeEvent.layout;
        saveTargetX.value = x + width / 2;
        saveTargetY.value = y + height - 99;
      }}>
        {followId ? <View style={styles.profileRail}>
          <AccessiblePressable onPress={openSeller} style={styles.profileButton} accessibilityRole="button" accessibilityLabel={`View ${sellerName} profile`}>
            {sellerPhoto ? <Image source={{ uri: sellerPhoto }} style={styles.profileAvatar} contentFit="cover" /> : <View style={styles.profileFallback}><Text style={styles.sellerInitial}>{sellerName.slice(0, 1).toUpperCase()}</Text></View>}
          </AccessiblePressable>
          {!following || showFollowingStatus ? <Animated.View style={following && showFollowingStatus ? followingFeedbackStyle : undefined}>
            <AccessiblePressable onPress={follow} style={[styles.followButton, following && styles.followingButton]} accessibilityRole="button" accessibilityLabel={following ? `Unfollow ${sellerName}` : `Follow ${sellerName}`} accessibilityState={{ selected: following }}>
              <Ionicons name={following ? "checkmark" : "add"} size={15} color={following ? colors.bone : colors.successInk} />
              <Text style={[styles.followText, following && styles.followingText]}>{following ? "Following" : "Follow"}</Text>
            </AccessiblePressable>
          </Animated.View> : null}
        </View> : null}
        <Action
          icon={cart.has(piece.id) ? "checkmark" : "bag-handle-outline"}
          label={cart.has(piece.id) ? "In bag" : "Bag"}
          active={cart.has(piece.id)}
          onPress={() => {
            if (cart.has(piece.id)) return;
            addToCart(piece.id);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          }}
          styles={styles}
          colors={colors}
        />
        <Action
          icon="body-outline"
          label="Try it on"
          onPress={() => router.push({ pathname: "/try-on", params: { piece: piece.id } })}
          styles={styles}
          colors={colors}
        />
        <Action icon={liked ? "heart" : "heart-outline"} label="Save" active={liked} onPress={() => { if (!liked) app.likePiece(piece.id); else void app.toggleSaved(piece.id); }} styles={styles} colors={colors} />
        <Action icon="share-outline" label="Share" onPress={() => setShareOpen(true)} styles={styles} colors={colors} />
      </View>
      {active ? <Animated.Text pointerEvents="none" style={[styles.heartPop, heartStyle]}>♥</Animated.Text> : null}
      <FriendShareSheet visible={shareOpen} payload={sharePayload} onClose={() => setShareOpen(false)} onExternalShare={() => { setShareOpen(false); void NativeShare.share({ title: piece.name, message: `Have a look at ${piece.name} on Uvel. uvel://piece/${piece.id}` }); }} />
      <ImmersiveListingDetails
        visible={active && detailsOpen}
        onClose={() => setDetailsOpen(false)}
        piece={piece}
        brandLabel={brand}
        sellerName={sellerName}
        sellerPhoto={sellerPhoto}
        buyerCountry={app.country}
        price={credit > 0 ? salePrice : localPrice}
        originalPrice={credit > 0 ? localPrice : undefined}
      />
    </View>
  );
}

function Action({ icon, label, active, onPress, styles, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; onPress: () => void; styles: ReturnType<typeof make>; colors: Colors }) {
  return (
    <AccessiblePressable onPress={onPress} style={styles.action} accessibilityRole="button" accessibilityLabel={`${label} listing`} accessibilityState={{ selected: active }}>
      <Ionicons name={icon} size={24} color={active ? colors.success : colors.bone} />
      <Text style={styles.actionLabel}>{label}</Text>
    </AccessiblePressable>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink, overflow: "hidden" },
    cardLayer: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
    item: { width: SCREEN_WIDTH, backgroundColor: colors.ink, overflow: "hidden" },
    itemImageFrame: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
    itemImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    itemShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.20)" },
    topControls: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, zIndex: 12 },
    menuButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
    itemCopy: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, paddingHorizontal: 24, justifyContent: "space-between" },
    copySpacer: { flex: 1 },
    copyBackButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    firstFind: { alignSelf: "flex-start", backgroundColor: colors.success, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 7, marginBottom: 10 },
    brand: { color: `${colors.bone}B8`, fontSize: 11, fontWeight: "800", letterSpacing: 2.2, marginBottom: 5, textShadowColor: "#000", textShadowRadius: 6 },
    nameDetailsButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, maxWidth: "100%" },
    name: { color: colors.bone, fontSize: 31, lineHeight: 36, fontWeight: "800", maxWidth: "88%", textShadowColor: "#000", textShadowRadius: 8 },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 7 },
    price: { color: colors.success, fontSize: 19, fontWeight: "900", textShadowColor: "#000", textShadowRadius: 6 },
    was: { color: `${colors.bone}D0`, fontSize: 16, fontWeight: "700", textDecorationLine: "line-through", textShadowColor: "#000", textShadowRadius: 6 },
    profileRail: { alignItems: "center", gap: 7 },
    profileButton: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: colors.bone, overflow: "hidden" },
    profileAvatar: { width: "100%", height: "100%", backgroundColor: colors.surface },
    profileFallback: { width: "100%", height: "100%", backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    sellerInitial: { color: colors.successInk, fontSize: 14, fontWeight: "900" },
    sellerName: { color: colors.bone, fontSize: 14, fontWeight: "800", textShadowColor: "#000", textShadowRadius: 6 },
    followButton: { minHeight: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", gap: 4 },
    followingButton: { backgroundColor: "rgba(0,0,0,0.38)", borderWidth: 1, borderColor: `${colors.bone}70` },
    followText: { color: colors.successInk, fontSize: 12, fontWeight: "900" },
    followingText: { color: colors.bone },
    actions: { position: "absolute", right: 15, gap: 18, alignItems: "center", zIndex: 9 },
    action: { width: 54, minHeight: 54, alignItems: "center", justifyContent: "center", gap: 3 },
    actionLabel: { color: colors.bone, fontSize: 10, fontWeight: "700", textShadowColor: "#000", textShadowRadius: 5 },
    heartPop: { position: "absolute", left: 0, top: 0, zIndex: 20, color: colors.success, fontSize: 68, lineHeight: 72, textShadowColor: "rgba(0,0,0,0.22)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
    empty: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: 24 },
    emptyKicker: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1.7, marginTop: 80 },
    emptyTitle: { color: colors.bone, fontSize: 30, fontWeight: "800", marginTop: 12 },
    emptyBody: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 10 },
    firstFindText: { color: colors.successInk, fontSize: 11, fontWeight: "900", letterSpacing: 0.2 },
    findToast: { position: "absolute", left: 20, right: 20, zIndex: 20, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "rgba(12,11,9,0.88)", borderWidth: 1, borderColor: `${colors.success}66` },
    refreshOrbit: { position: "absolute", left: 0, right: 0, height: 58, alignItems: "center", justifyContent: "center", zIndex: 30 },
    findToastK: { color: colors.success, fontSize: 11, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
    findToastTxt: { color: colors.bone, fontSize: 13, fontWeight: "700", marginTop: 3 },
    taskbarWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 4, zIndex: 15 },
    taskbar: { minHeight: 60, flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
    taskbarTab: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 3 },
    taskbarTabPressed: { opacity: 0.76 },
    taskbarIconSlot: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
    taskbarLabel: { fontSize: 11, fontWeight: "700" },
  });
}
