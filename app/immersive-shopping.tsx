import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import PagerView from "react-native-pager-view";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Animated as RNAnimated, Dimensions, Share as NativeShare, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Drawer } from "react-native-drawer-layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { FriendShareSheet, type FriendSharePayload } from "../components/FriendShareSheet";
import { ImmersiveListingDetails } from "../components/ImmersiveListingDetails";
import { ListingOfferSheet } from "../components/ListingOfferSheet";
import { TodayCartFab } from "../components/TodayCartFab";
import TodayToolsDrawer from "../components/TodayToolsDrawer";
import { SellerProfileView } from "./seller/[id]";
import { BrandPageView } from "./brand/[id]";
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
import { fallbackShopFloor, refreshMarketplaceListings, shopFloor, useWardrobe } from "../lib/wardrobe";
import { feedItemAt } from "../lib/feedOrder";
import { usePersonalization, type RecommendationChoice } from "../lib/personalization";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const MIN_REFRESH_MS = 1200;
const IMMERSIVE_WELCOME_KEY = "uvel-immersive-welcome-seen-v1";
const CATALOG_BRAND_IDS: Record<string, string> = {
  "Maison Found": "maison-found",
  "Archive 1982": "archive-1982",
  "Atelier No. 4": "atelier-no4",
};

type ShopFloorPiece = ReturnType<typeof shopFloor>[number];

type FeedSession = { queue: ShopFloorPiece[]; repeat: ShopFloorPiece[]; seed: number };

function firstFeedPass(items: ShopFloorPiece[], seed: number, anchorId?: string) {
  const first = Array.from({ length: items.length }, (_, index) => feedItemAt(items, index, seed))
    .filter((piece): piece is ShopFloorPiece => Boolean(piece));
  if (anchorId && first.length > 1 && first[0]?.id === anchorId) return [...first.slice(1), first[0]];
  return first;
}

function sessionItemAt(session: FeedSession, index: number) {
  if (index < 0) return undefined;
  if (index < session.queue.length) return session.queue[index];
  if (!session.repeat.length) return undefined;
  return feedItemAt(session.repeat, session.repeat.length + index - session.queue.length, session.seed);
}

function randomPromptGap(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}



export default function ImmersiveShopping() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const overlayColor = colors.ink === "#000000" ? colors.bone : "#FFFFFF";
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const personalization = usePersonalization(app.uid || "guest");
  const {
    ready: personalizationReady,
    rank: rankPersonalized,
    record: recordPersonalization,
    hasRecommendationFeedback,
    hasPromptedRecently,
    markRecommendationPromptShown,
  } = personalization;
  const firstFind = useFirstFind();
  const C = useCopy();
  const taskbarHeight = 64 + Math.max(insets.bottom, 8);
  const contentHeight = Math.max(1, SCREEN_HEIGHT - taskbarHeight);
  useBrands();
  useEffect(() => { void hydrateFollowedSellers(); }, []);
  const wardrobePieces = useWardrobe();
  const bundledPieces = useMemo(() => fallbackShopFloor(), []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profilePiece, setProfilePiece] = useState<ShopFloorPiece | null>(null);
  const profilePagerRef = useRef<PagerView>(null);
  const [findHint, setFindHint] = useState(false);
  const [refreshState, setRefreshState] = useState<{ active: boolean; epoch: number; anchorId?: string }>({ active: false, epoch: 0 });
  const refreshing = refreshState.active;
  const [sessionSeed, setSessionSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const [feedSession, setFeedSession] = useState<FeedSession>({ queue: [], repeat: [], seed: 0 });
  const [feedbackPromptPieceId, setFeedbackPromptPieceId] = useState<string | null>(null);
  const [welcomeVisible, setWelcomeVisible] = useState<boolean | null>(null);
  const [guideStep, setGuideStep] = useState<number | null>(null);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ choice: RecommendationChoice; message: string } | null>(null);
  const menuPressRef = useRef(false);
  const refreshInFlight = useRef(false);
  const feedEpochRef = useRef(0);
  const refreshFeedSnapshot = useRef<ReturnType<typeof shopFloor> | null>(null);
  const refreshOriginId = useRef<string | undefined>(undefined);
  const visiblePieceId = useRef<string | undefined>(undefined);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const feedbackPromptRef = useRef<{ pieceId: string; index: number } | null>(null);
  const feedbackPromptTiming = useRef({ nextIndex: randomPromptGap(3, 6), shownThisSession: new Set<string>() });
  const feedbackToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeY = useSharedValue(0);
  const activeIndexShared = useSharedValue(0);
  const swipeLock = useSharedValue(0);
  const refreshTriggered = useSharedValue(0);
  const refreshActiveShared = useSharedValue(0);
  const refreshImageScale = useSharedValue(1);
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(IMMERSIVE_WELCOME_KEY).then((seen) => {
      if (mounted) setWelcomeVisible(seen !== "1");
    }).catch(() => {
      if (mounted) setWelcomeVisible(true);
    });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!findHint) return;
    const timer = setTimeout(() => setFindHint(false), 3200);
    return () => clearTimeout(timer);
  }, [findHint]);

  const pieces = useMemo(() => {
    if (refreshing && refreshFeedSnapshot.current) return refreshFeedSnapshot.current;
    const floor = shopFloor(app.country);
    if (floor.length) return floor;
    // Never render a blank immersive feed while Firestore is reconnecting or
    // a stale marketplace snapshot has not hydrated yet.
    const localListed = wardrobePieces.filter((piece) => piece.status === "listed" && !piece.sellerPaused);
    return localListed.length ? localListed : bundledPieces;
  }, [app.country, bundledPieces, refreshState, refreshing, wardrobePieces]);

  const rankedPieces = useMemo(() => rankPersonalized(pieces, app.country), [app.country, pieces, rankPersonalized]);
  const fallbackFeedSession = useMemo<FeedSession>(() => ({
    queue: firstFeedPass(rankedPieces, sessionSeed),
    repeat: rankedPieces,
    seed: sessionSeed,
  }), [rankedPieces, sessionSeed]);
  const activeFeedSession = feedSession.queue.length ? feedSession : fallbackFeedSession;

  const feedWindow = useMemo(() => {
    const itemAt = (index: number) => sessionItemAt(activeFeedSession, index);
    const current = itemAt(activeIndex);
    const next = itemAt(activeIndex + 1);
    return {
      previous: itemAt(activeIndex - 1),
      current,
      next,
      preload: [current, next, itemAt(activeIndex + 2)].filter((piece): piece is ShopFloorPiece => Boolean(piece)),
    };
  }, [activeFeedSession, activeIndex]);
  const previousPiece = feedWindow.previous;
  const activePiece = feedWindow.current;
  const nextPiece = feedWindow.next;
  visiblePieceId.current = activePiece?.id;
  const profileSource = profilePiece || activePiece;
  const profileBrand = profileSource?.brandId ? getBrand(profileSource.brandId) : undefined;
  const profileSellerId = profileSource && !profileBrand
    ? profileSource.ownerId || profileSource.listedByUid || (profileSource.brand ? CATALOG_BRAND_IDS[profileSource.brand] : "")
    : "";
  const openProfile = useCallback((piece: ShopFloorPiece) => {
    setProfilePiece(piece);
    setTimeout(() => profilePagerRef.current?.setPage(1), 0);
  }, []);
  const closeProfile = useCallback(() => {
    profilePagerRef.current?.setPage(0);
  }, []);

  useEffect(() => {
    if (!personalizationReady || refreshing || !rankedPieces.length) return;
    setFeedSession((current) => {
      const source = current.queue.length ? current : fallbackFeedSession;
      const prefix = Array.from({ length: Math.max(1, activeIndexRef.current + 1) }, (_, index) => sessionItemAt(source, index))
        .filter((piece): piece is ShopFloorPiece => Boolean(piece));
      const seen = new Set(prefix.map((piece) => piece.id));
      const future = rankedPieces.filter((piece) => !seen.has(piece.id));
      return { queue: [...prefix, ...future], repeat: rankedPieces, seed: current.queue.length ? current.seed : sessionSeed };
    });
  }, [fallbackFeedSession, personalizationReady, rankedPieces, refreshing, sessionSeed]);

  useEffect(() => () => {
    if (feedbackToastTimer.current) clearTimeout(feedbackToastTimer.current);
  }, []);

  useEffect(() => {
    if (!activePiece || !personalizationReady || refreshing || drawerOpen) return;
    const currentPrompt = feedbackPromptRef.current;
    if (currentPrompt?.pieceId === activePiece.id && currentPrompt.index === activeIndex) return;
    if (activeIndex < feedbackPromptTiming.current.nextIndex) return;
    const alreadyAsked = feedbackPromptTiming.current.shownThisSession.has(activePiece.id);
    const ineligible = activePiece.id.startsWith("test-")
      || Boolean(app.uid && (activePiece.ownerId || activePiece.listedByUid) === app.uid)
      || hasRecommendationFeedback(activePiece.id)
      || hasPromptedRecently(activePiece.id)
      || alreadyAsked;
    if (ineligible) {
      feedbackPromptTiming.current.nextIndex = activeIndex + randomPromptGap(2, 4);
      return;
    }
    feedbackPromptRef.current = { pieceId: activePiece.id, index: activeIndex };
    feedbackPromptTiming.current.shownThisSession.add(activePiece.id);
    markRecommendationPromptShown(activePiece.id);
    setFeedbackPromptPieceId(activePiece.id);
  }, [activeIndex, activePiece?.id, activePiece?.ownerId, activePiece?.listedByUid, app.uid, drawerOpen, hasPromptedRecently, hasRecommendationFeedback, markRecommendationPromptShown, personalizationReady, refreshing]);

  const respondToRecommendation = useCallback((piece: ShopFloorPiece, choice: RecommendationChoice) => {
    if (feedbackPromptRef.current?.pieceId !== piece.id) return;
    recordPersonalization(choice, piece);
    feedbackPromptRef.current = null;
    setFeedbackPromptPieceId(null);
    feedbackPromptTiming.current.nextIndex = activeIndexRef.current + randomPromptGap(4, 8);
    const message = choice === "interested"
      ? "We’ll suggest more listings like this."
      : "We’ll show you fewer listings like this.";
    setFeedbackToast({ choice, message });
    void Haptics.notificationAsync(choice === "interested" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    if (feedbackToastTimer.current) clearTimeout(feedbackToastTimer.current);
    feedbackToastTimer.current = setTimeout(() => {
      setFeedbackToast(null);
      feedbackToastTimer.current = null;
    }, 2600);
  }, [recordPersonalization]);

  const onRefresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    refreshFeedSnapshot.current = pieces;
    refreshOriginId.current = visiblePieceId.current;
    refreshActiveShared.value = 1;
    swipeLock.value = 1;
    setRefreshState((state) => ({ ...state, active: true }));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      await Promise.all([
        refreshMarketplaceListings(),
        new Promise<void>((resolve) => setTimeout(resolve, MIN_REFRESH_MS)),
      ]);
    } catch {
      // Keep the local feed usable if the marketplace refresh is unavailable.
    } finally {
      const nextEpoch = feedEpochRef.current + 1;
      const nextSeed = Math.floor(Math.random() * 0x7fffffff);
      const refreshedPieces = shopFloor(app.country);
      const refreshedRanked = rankPersonalized(refreshedPieces, app.country);
      const refreshedSession: FeedSession = {
        queue: firstFeedPass(refreshedRanked, nextSeed, refreshOriginId.current),
        repeat: refreshedRanked,
        seed: nextSeed,
      };
      const refreshedFeed = Array.from({ length: Math.min(3, refreshedSession.queue.length) }, (_, index) =>
        sessionItemAt(refreshedSession, index),
      ).filter((piece): piece is ShopFloorPiece => Boolean(piece));
      const incomingImages = refreshedFeed
        .slice(0, 3)
        .map((piece) => piece.photo)
        .filter((uri): uri is string => /^https?:\/\//i.test(uri));
      try {
        if (incomingImages.length) await Image.prefetch(incomingImages, "memory-disk");
      } catch {
        // The refreshed card can still load normally if prefetch is unavailable.
      }
      feedEpochRef.current = nextEpoch;
      setSessionSeed(nextSeed);
      setFeedSession(refreshedSession);
      setActiveIndex(0);
      activeIndexShared.value = 0;
      swipeY.value = 0;
      feedbackPromptRef.current = null;
      feedbackPromptTiming.current.nextIndex = randomPromptGap(3, 6);
      setFeedbackPromptPieceId(null);
      refreshFeedSnapshot.current = null;
      setRefreshState({ active: false, epoch: nextEpoch, anchorId: refreshOriginId.current });
      refreshInFlight.current = false;
      refreshActiveShared.value = 0;
      refreshImageScale.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
      swipeLock.value = 0;
    }
  }, [activeIndexShared, app.country, pieces, rankPersonalized, refreshActiveShared, refreshImageScale, swipeLock, swipeY]);
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
    const currentPrompt = feedbackPromptRef.current;
    if (currentPrompt && currentPrompt.index !== nextIndex) {
      feedbackPromptRef.current = null;
      setFeedbackPromptPieceId(null);
      if (nextIndex > currentPrompt.index) feedbackPromptTiming.current.nextIndex = nextIndex + randomPromptGap(4, 8);
    }
    setActiveIndex(nextIndex);
    if (nextIndex > 0 && welcomeVisible) {
      setWelcomeVisible(false);
      setGuideStep(Math.min(nextIndex, 6));
      setGuideDismissed(false);
      void AsyncStorage.setItem(IMMERSIVE_WELCOME_KEY, "1").catch(() => undefined);
    } else if (guideStep !== null) {
      setGuideStep(nextIndex >= 1 && nextIndex <= 6 ? nextIndex : null);
      setGuideDismissed(false);
    }
  }, [welcomeVisible]);
  const panGesture = useMemo(() => Gesture.Pan()
    .enabled(!drawerOpen && pieces.length > 0 && welcomeVisible !== null)
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
      const atBoundary = direction < 0 && activeIndexShared.value === 0;
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
      const nextIndex = direction > 0 ? currentIndex + 1 : Math.max(0, currentIndex - 1);
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
    }), [activeIndexShared, commitSwipe, contentHeight, drawerOpen, guideStep, onRefresh, pieces.length, refreshActiveShared, refreshImageScale, refreshTriggered, swipeLock, swipeY, welcomeVisible]);
  useEffect(() => {
    // Keep the next couple of images warm so rapid swipes don't reveal an
    // unloaded image while the incoming card is already moving on screen.
    const imageUris = feedWindow.preload
      .map((piece) => piece.photo)
      .filter((uri): uri is string => /^https?:\/\//i.test(uri));
    if (imageUris.length) void Image.prefetch(imageUris, "memory-disk").catch(() => undefined);
  }, [feedWindow]);

  return (
    <Drawer
      open={drawerOpen}
      onOpen={() => {
        setDrawerOpen(true);
        if (menuPressRef.current) menuPressRef.current = false;
        else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      }}
      onClose={() => setDrawerOpen(false)}
      swipeEnabled={!profilePiece}
      swipeEdgeWidth={SCREEN_WIDTH}
      swipeMinDistance={10}
      swipeMinVelocity={100}
      drawerType="slide"
      drawerPosition="left"
      drawerStyle={{ width: Math.min(SCREEN_WIDTH * 0.78, 340), backgroundColor: colors.ink }}
      overlayStyle={{ backgroundColor: "rgba(0,0,0,0.32)" }}
      configureGestureHandler={(handler) => drawerOpen ? handler.activeOffsetX([-1, 1]) : profilePiece ? handler.failOffsetX([0, 0]).failOffsetY([0, 0]) : handler.failOffsetX(-1).activeOffsetX(5)}
      renderDrawerContent={() => (
        <TodayToolsDrawer
          onClose={() => setDrawerOpen(false)}
          onOpenSell={() => { setDrawerOpen(false); router.push("/sell"); }}
          onOpenMirror={() => { setDrawerOpen(false); router.push("/mirror"); }}
        />
      )}
    >
      <PagerView
        ref={profilePagerRef}
        style={styles.pager}
        initialPage={0}
        scrollEnabled={!drawerOpen && Boolean(profileBrand || profileSellerId)}
        onPageSelected={(event) => {
          if (event.nativeEvent.position === 0) setProfilePiece(null);
          else if (!profilePiece && activePiece) setProfilePiece(activePiece);
        }}
      >
      <View key="immersive-feed" style={styles.pagerPage}>
      <GestureDetector gesture={panGesture}>
      <View style={styles.page}>
        <StatusBar style={colors.ink === "#000000" ? "light" : "dark"} />
        {activePiece ? <>
          {previousPiece ? <Animated.View key={`${activeIndex - 1}:${previousPiece.id}`} pointerEvents="none" style={[styles.cardLayer, { height: contentHeight }, previousCardStyle]}>
            <ImmersiveItem piece={previousPiece} active={false} colors={colors} styles={styles} insets={insets} app={app} firstFind={firstFind} contentHeight={contentHeight} refreshImageScale={refreshImageScale} onFirstFind={() => setFindHint(true)} firstFindLabel={C.firstFind} />
          </Animated.View> : null}
          <Animated.View key={`${activeIndex}:${activePiece.id}`} style={[styles.cardLayer, { height: contentHeight }, currentCardStyle]}>
          <ImmersiveItem
          piece={activePiece}
          active
          feedbackPrompted={feedbackPromptPieceId === activePiece.id}
          onRecommendationFeedback={respondToRecommendation}
          colors={colors}
          styles={styles}
          insets={insets}
          app={app}
          firstFind={firstFind}
          contentHeight={contentHeight}
          refreshImageScale={refreshImageScale}
          onFirstFind={() => setFindHint(true)}
          firstFindLabel={C.firstFind}
          onOpenSeller={openProfile}
          guideStep={activeIndex === guideStep && !guideDismissed ? guideStep : null}
          onGuideDismiss={() => setGuideDismissed(true)}
          />
          </Animated.View>
          {nextPiece ? <Animated.View key={`${activeIndex + 1}:${nextPiece.id}`} pointerEvents="none" style={[styles.cardLayer, { height: contentHeight }, nextCardStyle]}>
            <ImmersiveItem piece={nextPiece} active={false} colors={colors} styles={styles} insets={insets} app={app} firstFind={firstFind} contentHeight={contentHeight} refreshImageScale={refreshImageScale} onFirstFind={() => setFindHint(true)} firstFindLabel={C.firstFind} />
          </Animated.View> : null}
        </> : null}
        <View pointerEvents="box-none" style={[styles.topControls, { paddingTop: insets.top + 8 }]}>
          <AccessiblePressable onPress={() => { menuPressRef.current = true; setDrawerOpen(true); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); }} style={styles.menuButton} accessibilityRole="button" accessibilityLabel="Open Today drawer">
            <Ionicons name="menu" size={28} color={overlayColor} />
          </AccessiblePressable>
          <AccessiblePressable onPress={() => router.push("/search")} style={styles.menuButton} accessibilityRole="button" accessibilityLabel="Search">
            <Ionicons name="search-outline" size={23} color={overlayColor} />
          </AccessiblePressable>
        </View>
        {findHint ? <View pointerEvents="none" style={[styles.findToast, { top: insets.top + 68 }]} accessibilityLiveRegion="polite">
          <Text style={styles.findToastK}>{C.firstFind}</Text>
          <Text style={styles.findToastTxt}>{C.matchingPiece} · {moneyExact(firstFind.remaining, firstFind.currency)}</Text>
        </View> : null}
        {feedbackToast ? <View pointerEvents="none" style={[styles.preferenceToast, { top: insets.top + (findHint ? 132 : 68) }]} accessibilityLiveRegion="polite">
          <Ionicons name={feedbackToast.choice === "interested" ? "checkmark-circle" : "close-circle-outline"} size={20} color={feedbackToast.choice === "interested" ? colors.success : overlayColor} />
          <Text style={styles.preferenceToastText}>{feedbackToast.message}</Text>
        </View> : null}
        {orbitOn ? <View pointerEvents="none" style={[styles.refreshOrbit, { top: insets.top + 68 }]}><OrbitLoader /></View> : null}
        <ImmersiveTaskbar colors={colors} C={C} insets={insets} styles={styles} />
        <TodayCartFab listingOpen />
        {welcomeVisible ? <ImmersiveWelcomeOverlay /> : null}
      </View>
      </GestureDetector>
      </View>
      <View key="profile-page" style={styles.pagerPage}>
        {profileBrand ? (
          <BrandPageView routeId={profileBrand.id} onBack={closeProfile} />
        ) : profileSellerId ? (
          <SellerProfileView routeId={profileSellerId} onBack={closeProfile} />
        ) : (
          <View style={styles.page} />
        )}
      </View>
      </PagerView>
    </Drawer>
  );
}

function ImmersiveWelcomeOverlay() {
  const handY = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const hand = RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.timing(handY, { toValue: -28, duration: 900, useNativeDriver: true }),
      RNAnimated.timing(handY, { toValue: 0, duration: 700, useNativeDriver: true }),
      RNAnimated.delay(260),
    ]));
    hand.start();
    const pulse = setInterval(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 800);
    return () => {
      hand.stop();
      clearInterval(pulse);
    };
  }, [handY]);

  return (
    <View pointerEvents="none" style={welcomeStyles.overlay}>
      <View style={welcomeStyles.dim} />
      <View style={welcomeStyles.content} accessibilityRole="text" accessibilityLabel="Welcome to immersive shopping. Scroll to browse listings.">
        <Text style={welcomeStyles.kicker}>WELCOME TO</Text>
        <Text style={welcomeStyles.title}>Immersive Shopping</Text>
        <Text style={welcomeStyles.copy}>A new way of instant shopping. Scroll through listings and discover your next piece.</Text>
        <RNAnimated.View style={[welcomeStyles.gesture, { transform: [{ translateY: handY }] }]}>
          <View style={welcomeStyles.swipeTrail}>
            <View style={welcomeStyles.swipeTrailLine} />
            <Ionicons name="chevron-up" size={18} color="#B7F36B" />
          </View>
          <View style={welcomeStyles.hand}>
            <View style={welcomeStyles.handPalm} />
            <View style={welcomeStyles.handThumb} />
          </View>
          <Text style={welcomeStyles.scroll}>Scroll</Text>
        </RNAnimated.View>
      </View>
    </View>
  );
}

const welcomeStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 40, justifyContent: "center", alignItems: "center" },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.76)" },
  content: { width: "86%", alignItems: "center", paddingBottom: 76 },
  kicker: { color: "#B7F36B", fontSize: 11, fontWeight: "900", letterSpacing: 2.4, marginBottom: 12 },
  title: { color: "#F4F0E6", fontSize: 32, lineHeight: 38, fontWeight: "800", textAlign: "center", letterSpacing: -0.4 },
  copy: { color: "rgba(244,240,230,0.82)", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 12, maxWidth: 310 },
  gesture: { alignItems: "center", marginTop: 42, gap: 5 },
  swipeTrail: { height: 39, width: 26, alignItems: "center", justifyContent: "flex-end" },
  swipeTrailLine: { position: "absolute", top: 3, bottom: 5, width: 2, borderRadius: 2, backgroundColor: "rgba(183,243,107,0.48)" },
  hand: { width: 42, height: 50, position: "relative", alignItems: "center" },
  handPalm: { position: "absolute", bottom: 0, width: 34, height: 38, borderRadius: 17, backgroundColor: "#F4F0E6" },
  handThumb: { position: "absolute", right: -1, bottom: 8, width: 25, height: 16, borderRadius: 10, backgroundColor: "#F4F0E6", transform: [{ rotate: "-38deg" }] },
  scroll: { color: "#F4F0E6", fontSize: 16, fontWeight: "800", letterSpacing: 0.4 },
});

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
              onPress={() => index === 0 ? router.back() : router.navigate(tab.route)}
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

function ImmersiveItem({ piece, active, colors, styles, insets, app, firstFind, contentHeight, refreshImageScale, onFirstFind, firstFindLabel, feedbackPrompted, onRecommendationFeedback, onOpenSeller, guideStep, onGuideDismiss }: any) {
  const overlayColor = colors.ink === "#000000" ? colors.bone : "#FFFFFF";
  const [shareOpen, setShareOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
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
  const sellerId = piece.ownerId || piece.listedByUid || "";
  const canMakeOffer = !piece.brandId && !brandRecord && !catalogBrandId && Boolean(sellerId) && sellerId !== app.uid && piece.status === "listed" && piece.listPriceCents > 1;
  const hasFirstFindMatch = firstFind.matches(piece);
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
  function openSeller() {
    if (onOpenSeller) {
      onOpenSeller(piece);
      return;
    }
    if (brandRecord) router.push({ pathname: "/brand/[id]", params: { id: brandRecord.id } });
    else if (followId) router.push({ pathname: "/seller/[id]", params: { id: followId } });
  }
  function openOfferSheet() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setOfferOpen(true);
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
      {active && guideStep !== null ? <AccessiblePressable onPress={onGuideDismiss} style={styles.guideDismissLayer} accessibilityRole="button" accessibilityLabel="Dismiss shopping tip" /> : null}
      <View pointerEvents="box-none" style={[styles.itemCopy, { paddingTop: insets.top + 24, paddingBottom: feedbackPrompted ? 88 : 24 }]}>
        <View style={styles.copySpacer} />
        {canMakeOffer ? (
          <View style={styles.offerFooter}>
            <View style={styles.offerControlStack}>
              {hasFirstFindMatch ? <AccessiblePressable onPress={onFirstFind} style={[styles.firstFind, styles.firstFindInStack]} accessibilityRole="button" accessibilityLabel="What First Find is" accessibilityHint="Double tap to hear how First Find works on this piece.">
                <Text style={styles.firstFindText}>{firstFindLabel}</Text>
              </AccessiblePressable> : null}
              <AccessiblePressable onPress={openOfferSheet} style={styles.immersiveOfferControl} accessibilityRole="button" accessibilityLabel={`Make an offer for ${piece.name}`} accessibilityHint="Opens the offer form with a suggested price.">
                <Ionicons name="pricetag-outline" size={16} color={colors.success} />
                <Text style={styles.immersiveOfferText}>Offer</Text>
              </AccessiblePressable>
              <AccessiblePressable onPress={() => router.back()} style={styles.stackBackButton} accessibilityRole="button" accessibilityLabel="Back to Today">
                <Ionicons name="arrow-back" size={23} color={overlayColor} />
              </AccessiblePressable>
            </View>
            <View style={styles.listingCaption}>
              {guideStep === 1 ? <GuideBubble styles={styles} title="Tap here for more details" copy="See the listing info, seller, and item details." onDismiss={onGuideDismiss} /> : null}
              <AccessiblePressable
                onPress={() => { onGuideDismiss(); setDetailsOpen(true); }}
                style={styles.nameDetailsButton}
                accessibilityRole="button"
                accessibilityLabel={`View details for ${piece.name}`}
                accessibilityHint="Opens the listing description, seller location, and item details."
              >
                <Text style={styles.name} numberOfLines={2}>{piece.name}</Text>
                <Ionicons name="chevron-up" size={18} color={overlayColor} />
              </AccessiblePressable>
              {credit > 0 ? (
                <View style={styles.priceRow}><Text style={styles.was}>{localPrice}</Text><Text style={styles.price}>{salePrice}</Text></View>
              ) : <Text style={styles.price}>{localPrice}</Text>}
            </View>
          </View>
        ) : (
          <View>
            <AccessiblePressable onPress={() => router.back()} style={styles.copyBackButton} accessibilityRole="button" accessibilityLabel="Back to Today">
              <Ionicons name="arrow-back" size={23} color={overlayColor} />
            </AccessiblePressable>
            {hasFirstFindMatch ? <AccessiblePressable onPress={onFirstFind} style={styles.firstFind} accessibilityRole="button" accessibilityLabel="What First Find is" accessibilityHint="Double tap to hear how First Find works on this piece.">
              <Text style={styles.firstFindText}>{firstFindLabel}</Text>
            </AccessiblePressable> : null}
          {guideStep === 1 ? <GuideBubble styles={styles} title="Tap here for more details" copy="See the listing info, seller, and item details." onDismiss={onGuideDismiss} /> : null}
          <AccessiblePressable
            onPress={() => { onGuideDismiss(); setDetailsOpen(true); }}
            style={styles.nameDetailsButton}
            accessibilityRole="button"
            accessibilityLabel={`View details for ${piece.name}`}
            accessibilityHint="Opens the listing description, seller location, and item details."
          >
            <Text style={styles.name} numberOfLines={2}>{piece.name}</Text>
            <Ionicons name="chevron-up" size={18} color={overlayColor} />
          </AccessiblePressable>
          {credit > 0 ? (
            <View style={styles.priceRow}><Text style={styles.was}>{localPrice}</Text><Text style={styles.price}>{salePrice}</Text></View>
          ) : <Text style={styles.price}>{localPrice}</Text>}
          </View>
        )}
      </View>
      <View style={[styles.actions, { bottom: feedbackPrompted ? 164 : 118 }]} onLayout={(event) => {
        const { x, y, width, height } = event.nativeEvent.layout;
        saveTargetX.value = x + width / 2;
        saveTargetY.value = y + height - 99;
      }}>
        {followId ? <View style={styles.profileRail}>
          <AccessiblePressable onPress={openSeller} style={styles.profileButton} accessibilityRole="button" accessibilityLabel={`View ${sellerName} profile`}>
            {sellerPhoto ? <Image source={{ uri: sellerPhoto }} style={styles.profileAvatar} contentFit="cover" /> : <View style={styles.profileFallback}><Text style={styles.sellerInitial}>{sellerName.slice(0, 1).toUpperCase()}</Text></View>}
          </AccessiblePressable>
          <FollowControl followId={followId} isBrand={isBrand} sellerName={sellerName} uid={app.uid} colors={colors} styles={styles} />
        </View> : null}
        <View style={styles.actionGuideAnchor}>
          {guideStep === 2 ? <GuideBubble action styles={styles} title="Tap this to add to your bag" copy="Keep this listing close so you can find it again." onDismiss={onGuideDismiss} /> : null}
          <Action
            icon={cart.has(piece.id) ? "checkmark" : "bag-handle-outline"}
            label={cart.has(piece.id) ? "In bag" : "Bag"}
            active={cart.has(piece.id)}
            onPress={() => {
              onGuideDismiss();
              if (cart.has(piece.id)) return;
              addToCart(piece.id);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            }}
            styles={styles}
            colors={colors}
          />
        </View>
        <View style={styles.actionGuideAnchor}>
          {guideStep === 3 ? <GuideBubble action styles={styles} title="See how this fits on you" copy="Try this piece on in just one picture." onDismiss={onGuideDismiss} /> : null}
          <Action
            icon="body-outline"
            label="Try it on"
            onPress={() => { onGuideDismiss(); router.push({ pathname: "/try-on", params: { piece: piece.id } }); }}
            styles={styles}
            colors={colors}
          />
        </View>
        <View style={styles.actionGuideAnchor}>
          {guideStep === 4 ? <GuideBubble action styles={styles} title="Double-tap to save" copy="Save this listing so you can find it again." onDismiss={onGuideDismiss} /> : null}
          <Action icon={liked ? "heart" : "heart-outline"} label="Save" active={liked} onPress={() => { onGuideDismiss(); if (!liked) app.likePiece(piece.id); else void app.toggleSaved(piece.id); }} styles={styles} colors={colors} />
        </View>
        <View style={styles.actionGuideAnchor}>
          {guideStep === 5 ? <GuideBubble action styles={styles} title="Share this listing" copy="Send it to friends who would love it." onDismiss={onGuideDismiss} /> : null}
          <Action icon="share-outline" label="Share" onPress={() => { onGuideDismiss(); setShareOpen(true); }} styles={styles} colors={colors} />
        </View>
      </View>
      {active && feedbackPrompted ? <View style={styles.recommendationPrompt}>
        <AccessiblePressable
          onPress={() => onRecommendationFeedback(piece, "not_interested")}
          style={({ pressed }) => [styles.recommendationChoice, pressed && styles.recommendationChoicePressed]}
          accessibilityRole="button"
          accessibilityLabel="Not interested in this listing"
          accessibilityHint="We’ll show fewer listings with similar styles."
        >
          <Ionicons name="close-circle-outline" size={18} color={overlayColor} />
          <Text style={styles.recommendationChoiceText}>Not interested</Text>
        </AccessiblePressable>
        <AccessiblePressable
          onPress={() => onRecommendationFeedback(piece, "interested")}
          style={({ pressed }) => [styles.recommendationChoice, styles.recommendationChoiceInterested, pressed && styles.recommendationChoicePressed]}
          accessibilityRole="button"
          accessibilityLabel="Interested in this listing"
          accessibilityHint="We’ll suggest more listings with similar styles."
        >
          <Ionicons name="checkmark" size={18} color={colors.successInk} />
          <Text style={[styles.recommendationChoiceText, styles.recommendationChoiceInterestedText]}>Interested</Text>
        </AccessiblePressable>
      </View> : null}
      {active ? <Animated.Text pointerEvents="none" style={[styles.heartPop, heartStyle]}>♥</Animated.Text> : null}
      {active && guideStep === 6 ? <EnjoyGuide styles={styles} onDismiss={onGuideDismiss} /> : null}
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
      <ListingOfferSheet
        visible={active && offerOpen && canMakeOffer}
        piece={piece}
        onClose={() => setOfferOpen(false)}
        onGoToInbox={(threadId) => router.push({ pathname: "/ask/[id]", params: { id: piece.id, threadId, pieceName: piece.name, piecePhoto: piece.photo, piecePriceCents: String(piece.listPriceCents) } })}
      />
    </View>
  );
}

function FollowControl({ followId, isBrand, sellerName, uid, colors, styles }: { followId: string; isBrand: boolean; sellerName: string; uid: string; colors: Colors; styles: ReturnType<typeof make> }) {
  const overlayColor = colors.ink === "#000000" ? colors.bone : "#FFFFFF";
  const followUid = uid || "me";
  const [following, setFollowing] = useState(() => isBrand ? isFollowing(followId, followUid) : isSellerFollowed(followId));
  const [showStatus, setShowStatus] = useState(false);
  const followingRef = useRef(following);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackOpacity = useSharedValue(1);
  const feedbackScale = useSharedValue(1);
  const feedbackY = useSharedValue(0);
  const feedbackStyle = useAnimatedStyle(() => ({
    opacity: feedbackOpacity.value,
    transform: [{ translateY: feedbackY.value }, { scale: feedbackScale.value }],
  }));

  useEffect(() => {
    const stored = isBrand ? isFollowing(followId, followUid) : isSellerFollowed(followId);
    followingRef.current = stored;
    setFollowing(stored);
  }, [followId, followUid, isBrand]);

  useEffect(() => () => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    cancelAnimation(feedbackOpacity);
    cancelAnimation(feedbackScale);
    cancelAnimation(feedbackY);
  }, [feedbackOpacity, feedbackScale, feedbackY]);

  function pressFollow() {
    if (!followId) return;
    const next = !followingRef.current;
    followingRef.current = next;
    setFollowing(next);
    if (isBrand) toggleFollow(followId, followUid);
    else {
      toggleSellerFollow(followId);
      void syncSellerFollow(uid, followId, next);
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

    if (statusTimer.current) clearTimeout(statusTimer.current);
    cancelAnimation(feedbackOpacity);
    cancelAnimation(feedbackScale);
    cancelAnimation(feedbackY);
    if (!next) {
      setShowStatus(false);
      feedbackOpacity.value = 1;
      feedbackScale.value = 1;
      feedbackY.value = 0;
      statusTimer.current = null;
      return;
    }
    feedbackOpacity.value = 0;
    feedbackScale.value = 0.88;
    feedbackY.value = 5;
    setShowStatus(true);
    feedbackOpacity.value = withTiming(1, { duration: 130 });
    feedbackScale.value = withSequence(withTiming(1.08, { duration: 150 }), withSpring(1, { damping: 13, stiffness: 260 }));
    feedbackY.value = withSpring(0, { damping: 15, stiffness: 230 });
    statusTimer.current = setTimeout(() => {
      feedbackOpacity.value = withTiming(0, { duration: 200 });
      feedbackScale.value = withTiming(0.94, { duration: 200 });
      feedbackY.value = withTiming(-5, { duration: 200 });
      statusTimer.current = setTimeout(() => {
        setShowStatus(false);
        feedbackOpacity.value = 1;
        feedbackScale.value = 1;
        feedbackY.value = 0;
        statusTimer.current = null;
      }, 200);
    }, 1300);
  }

  if (!followId) return null;
  return !following || showStatus ? (
    <Animated.View style={following && showStatus ? feedbackStyle : undefined}>
      <AccessiblePressable onPress={pressFollow} style={[styles.followButton, following && styles.followingButton]} accessibilityRole="button" accessibilityLabel={following ? `Unfollow ${sellerName}` : `Follow ${sellerName}`} accessibilityState={{ selected: following }}>
        <Ionicons name={following ? "checkmark" : "add"} size={15} color={following ? overlayColor : colors.successInk} />
        <Text style={[styles.followText, following && styles.followingText]}>{following ? "Following" : "Follow"}</Text>
      </AccessiblePressable>
    </Animated.View>
  ) : null;
}

function GuideBubble({ styles, title, copy, onDismiss, action = false }: { styles: ReturnType<typeof make>; title: string; copy: string; onDismiss: () => void; action?: boolean }) {
  return (
    <AccessiblePressable onPress={onDismiss} style={action ? styles.actionGuideBubble : styles.detailsHint} accessibilityRole="button" accessibilityLabel="Dismiss shopping tip">
      <Text style={styles.detailsHintTitle}>{title}</Text>
      <Text style={styles.detailsHintCopy}>{copy}</Text>
      <View pointerEvents="none" style={action ? styles.actionGuideCaret : styles.detailsHintCaret} />
    </AccessiblePressable>
  );
}

function EnjoyGuide({ styles, onDismiss }: { styles: ReturnType<typeof make>; onDismiss: () => void }) {
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const rise = useRef(new RNAnimated.Value(10)).current;
  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      RNAnimated.timing(rise, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [opacity, rise]);
  return (
    <RNAnimated.View style={[styles.enjoyGuide, { opacity, transform: [{ translateY: rise }] }]}>
      <AccessiblePressable onPress={onDismiss} style={styles.enjoyGuideButton} accessibilityRole="button" accessibilityLabel="Dismiss immersive shopping message">
        <Text style={styles.enjoyGuideText}>Enjoy immersive shopping</Text>
      </AccessiblePressable>
    </RNAnimated.View>
  );
}

function Action({ icon, label, active, onPress, styles, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; onPress: () => void; styles: ReturnType<typeof make>; colors: Colors }) {
  const overlayColor = colors.ink === "#000000" ? colors.bone : "#FFFFFF";
  return (
    <AccessiblePressable onPress={onPress} style={styles.action} accessibilityRole="button" accessibilityLabel={`${label} listing`} accessibilityState={{ selected: active }}>
      <Ionicons name={icon} size={24} color={active ? colors.success : overlayColor} />
      <Text style={styles.actionLabel}>{label}</Text>
    </AccessiblePressable>
  );
}

function make(colors: Colors) {
  const overlayColor = colors.ink === "#000000" ? colors.bone : "#FFFFFF";
  return StyleSheet.create({
    pager: { flex: 1 },
    pagerPage: { flex: 1 },
    page: { flex: 1, backgroundColor: colors.ink, overflow: "hidden" },
    cardLayer: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
    item: { width: SCREEN_WIDTH, backgroundColor: colors.ink, overflow: "hidden" },
    itemImageFrame: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
    itemImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    itemShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.20)" },
    topControls: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, zIndex: 12 },
    menuButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
    itemCopy: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, paddingHorizontal: 24, justifyContent: "space-between", zIndex: 8 },
    guideDismissLayer: { ...StyleSheet.absoluteFill, zIndex: 7 },
    copySpacer: { flex: 1 },
    copyBackButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    firstFind: { alignSelf: "flex-start", backgroundColor: colors.success, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 7, marginBottom: 10 },
    offerFooter: { flexDirection: "column", alignItems: "flex-start" },
    offerControlStack: { alignItems: "flex-start", gap: 8, marginBottom: 12 },
    firstFindInStack: { marginBottom: 0 },
    immersiveOfferControl: { minHeight: 40, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: `${colors.success}B8`, backgroundColor: "rgba(0,0,0,0.48)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    immersiveOfferText: { color: overlayColor, fontSize: 12, fontWeight: "800" },
    stackBackButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "rgba(244,240,230,0.30)", backgroundColor: "rgba(0,0,0,0.46)", alignItems: "center", justifyContent: "center" },
    listingCaption: { maxWidth: "88%" },
    detailsHint: { alignSelf: "flex-start", maxWidth: 238, paddingHorizontal: 13, paddingVertical: 9, marginBottom: 9, borderRadius: 13, backgroundColor: "#F4F0E6", shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8, position: "relative" },
    detailsHintTitle: { color: "#171510", fontSize: 12, fontWeight: "900" },
    detailsHintCopy: { color: "#514D43", fontSize: 11, lineHeight: 15, marginTop: 2 },
    detailsHintCaret: { position: "absolute", bottom: -6, left: 22, width: 12, height: 12, backgroundColor: "#F4F0E6", transform: [{ rotate: "45deg" }] },
    actionGuideAnchor: { width: 54, minHeight: 54, position: "relative", zIndex: 10 },
    actionGuideBubble: { position: "absolute", right: 44, bottom: 38, width: 210, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 13, backgroundColor: "#F4F0E6", shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8, zIndex: 20 },
    actionGuideCaret: { position: "absolute", right: -6, top: "50%", marginTop: -6, width: 12, height: 12, backgroundColor: "#F4F0E6", transform: [{ rotate: "45deg" }] },
    enjoyGuide: { position: "absolute", left: 24, right: 24, top: "45%", alignItems: "center", zIndex: 25 },
    enjoyGuideButton: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, backgroundColor: "rgba(12,11,9,0.54)", borderWidth: 1, borderColor: "rgba(183,243,107,0.65)" },
    enjoyGuideText: { color: colors.success, fontSize: 17, fontWeight: "900", letterSpacing: 0.2 },
    brand: { color: `${overlayColor}E0`, fontSize: 11, fontWeight: "800", letterSpacing: 2.2, marginBottom: 5, textShadowColor: "#000", textShadowRadius: 6 },
    nameDetailsButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, maxWidth: "100%" },
    name: { color: overlayColor, fontSize: 31, lineHeight: 36, fontWeight: "800", maxWidth: "88%", textShadowColor: "#000", textShadowRadius: 8 },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 7 },
    price: { color: colors.success, fontSize: 19, fontWeight: "900", textShadowColor: "#000", textShadowRadius: 6 },
    was: { color: `${overlayColor}D0`, fontSize: 16, fontWeight: "700", textDecorationLine: "line-through", textShadowColor: "#000", textShadowRadius: 6 },
    profileRail: { alignItems: "center", gap: 7 },
    profileButton: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: overlayColor, overflow: "hidden" },
    profileAvatar: { width: "100%", height: "100%", backgroundColor: colors.surface },
    profileFallback: { width: "100%", height: "100%", backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    sellerInitial: { color: colors.successInk, fontSize: 14, fontWeight: "900" },
    sellerName: { color: overlayColor, fontSize: 14, fontWeight: "800", textShadowColor: "#000", textShadowRadius: 6 },
    followButton: { minHeight: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", gap: 4 },
    followingButton: { backgroundColor: "rgba(0,0,0,0.38)", borderWidth: 1, borderColor: `${colors.bone}70` },
    followText: { color: colors.successInk, fontSize: 12, fontWeight: "900" },
    followingText: { color: overlayColor },
    actions: { position: "absolute", right: 15, gap: 18, alignItems: "center", zIndex: 9 },
    action: { width: 54, minHeight: 54, alignItems: "center", justifyContent: "center", gap: 3 },
    actionLabel: { color: overlayColor, fontSize: 10, fontWeight: "700", textShadowColor: "#000", textShadowRadius: 5 },
    recommendationPrompt: { position: "absolute", left: 16, right: 16, bottom: 12, zIndex: 14, flexDirection: "row", gap: 9, padding: 4, borderRadius: 30, backgroundColor: "rgba(7,7,7,0.66)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)" },
    recommendationChoice: { flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.26)", backgroundColor: "rgba(255,255,255,0.06)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 8 },
    recommendationChoiceInterested: { backgroundColor: colors.success, borderColor: colors.success },
    recommendationChoicePressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
    recommendationChoiceText: { color: overlayColor, fontSize: 12, fontWeight: "800" },
    recommendationChoiceInterestedText: { color: colors.successInk },
    heartPop: { position: "absolute", left: 0, top: 0, zIndex: 20, color: colors.success, fontSize: 68, lineHeight: 72, textShadowColor: "rgba(0,0,0,0.22)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
    empty: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: 24 },
    emptyKicker: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1.7, marginTop: 80 },
    emptyTitle: { color: colors.bone, fontSize: 30, fontWeight: "800", marginTop: 12 },
    emptyBody: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 10 },
    firstFindText: { color: colors.successInk, fontSize: 11, fontWeight: "900", letterSpacing: 0.2 },
    findToast: { position: "absolute", left: 20, right: 20, zIndex: 20, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "rgba(12,11,9,0.88)", borderWidth: 1, borderColor: `${colors.success}66` },
    preferenceToast: { position: "absolute", left: 20, right: 20, zIndex: 21, borderRadius: 15, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: "rgba(12,11,9,0.92)", borderWidth: 1, borderColor: `${colors.success}70`, flexDirection: "row", alignItems: "center", gap: 10 },
    preferenceToastText: { flex: 1, color: overlayColor, fontSize: 14, fontWeight: "700", lineHeight: 19 },
    refreshOrbit: { position: "absolute", left: 0, right: 0, height: 58, alignItems: "center", justifyContent: "center", zIndex: 30 },
    findToastK: { color: colors.success, fontSize: 11, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
    findToastTxt: { color: overlayColor, fontSize: 13, fontWeight: "700", marginTop: 3 },
    taskbarWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 4, zIndex: 15 },
    taskbar: { minHeight: 60, flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
    taskbarTab: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 3 },
    taskbarTabPressed: { opacity: 0.76 },
    taskbarIconSlot: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
    taskbarLabel: { fontSize: 11, fontWeight: "700" },
  });
}
