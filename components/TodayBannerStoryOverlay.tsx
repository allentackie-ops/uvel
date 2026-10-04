import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView as GHScrollView } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ClosetPiece } from "../lib/wardrobe";
import { todayProductImage } from "../lib/todayProductImage";
import { moneyInMarket, getMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";

const AnimatedScrollView = Animated.createAnimatedComponent(GHScrollView);
const OPEN_SPRING = { damping: 24, stiffness: 260, mass: 0.78 };
const CLOSE_SPRING = { damping: 34, stiffness: 440, mass: 0.6, overshootClamping: true };
const SNAP = { damping: 26, stiffness: 320, mass: 0.7, overshootClamping: true };

export type BannerStoryOrigin = { x: number; y: number; width: number; height: number };

export type BannerStory = {
  title: string;
  subtitle: string;
  color: string;
  eyebrow?: string;
  footer?: string;
  pieces: ClosetPiece[];
};

export function TodayBannerStoryOverlay({
  story,
  origin,
  onClose,
  onOpenPiece,
}: {
  story: BannerStory;
  origin: BannerStoryOrigin;
  onClose: () => void;
  onOpenPiece: (piece: ClosetPiece, origin: BannerStoryOrigin) => void;
}) {
  const colors = useColors();
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const heroH = Math.min(470, Math.max(360, screenW * 0.98));
  const chromeTop = insets.top + 8;
  const pieces = story.pieces.slice(0, 4);
  const market = getMarket(app.country);
  const rootRef = useRef<View>(null);
  const [coverTop, setCoverTop] = useState(0);

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
  const settled = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);

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
    imgY.value = withSpring(0, OPEN_SPRING);
    imgW.value = withSpring(screenW, OPEN_SPRING);
    imgH.value = withSpring(heroH, OPEN_SPRING);
    imgR.value = withSpring(0, OPEN_SPRING, (finished) => {
      if (finished) settled.value = 1;
    });
    backdrop.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    chrome.value = withTiming(1, { duration: 180 });
    sheet.value = withTiming(1, { duration: 220 });
  }, [backdrop, chrome, chromeTop, heroH, imgH, imgR, imgW, imgX, imgY, origin.height, origin.width, origin.x, origin.y, originH, originW, originX, originY, screenW, settled, sheet]);

  const finishClose = () => onClose();

  const closeToBanner = () => {
    if (closing.value) return;
    closing.value = 1;
    dismissing.value = 1;
    settled.value = 0;
    imgX.value = 0;
    imgY.value = -scrollY.value;
    imgW.value = screenW;
    imgH.value = heroH;
    imgR.value = 0;
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
    },
  });

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
      if (scrollY.value > 4 || dy < -8) {
        state.fail();
        return;
      }
      if (dy > 8 && dy > Math.abs(dx) * 1.2) {
        state.activate();
        return;
      }
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.max(dy, 0) * 1.2) state.fail();
    })
    .onStart(() => {
      if (closing.value || scrollY.value > 4) {
        dismissing.value = 0;
        return;
      }
      settled.value = 0;
      dismissing.value = 1;
      imgX.value = 0;
      imgY.value = 0;
      imgW.value = screenW;
      imgH.value = heroH;
      imgR.value = 0;
    })
    .onUpdate((event) => {
      if (closing.value || !dismissing.value) return;
      const p = Math.min(Math.max(event.translationY, 0) / 280, 1);
      const s = 1 - p * 0.28;
      imgW.value = screenW * s;
      imgH.value = heroH * s;
      imgX.value = (screenW - imgW.value) / 2;
      imgY.value = event.translationY * 0.92;
      imgR.value = 20 * p;
      backdrop.value = 1 - p * 0.95;
      chrome.value = Math.max(0, 1 - p * 2.8);
      sheet.value = Math.max(0, 1 - p * 3.2);
      dragY.value = event.translationY;
    })
    .onEnd((event) => {
      if (closing.value || !dismissing.value) return;
      if (dragY.value > 48 || event.velocityY > 600) {
        closing.value = 1;
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
      imgY.value = withSpring(0, SNAP);
      imgW.value = withSpring(screenW, SNAP);
      imgH.value = withSpring(heroH, SNAP);
      imgR.value = withSpring(0, SNAP, (finished) => {
        if (finished) settled.value = 1;
      });
      backdrop.value = withSpring(1, SNAP);
      chrome.value = withTiming(1, { duration: 140 });
      sheet.value = withTiming(1, { duration: 160 });
    });

  const flyingHeroStyle = useAnimatedStyle(() => ({
    top: imgY.value,
    left: imgX.value,
    width: imgW.value,
    height: imgH.value,
    borderRadius: imgR.value,
    opacity: 1 - settled.value,
  }));
  const inFlowStyle = useAnimatedStyle(() => ({ opacity: settled.value }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value * 0.55 }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
  const pageStyle = useAnimatedStyle(() => ({ opacity: sheet.value }));

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
        <Animated.View style={[styles.backdrop, backdropStyle, { backgroundColor: colors.ink }]} pointerEvents="none" />
        <AnimatedScrollView
          style={[styles.page, pageStyle, { backgroundColor: colors.ink }]}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
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
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.heroSlot, { width: screenW, height: heroH, marginLeft: -20 }, inFlowStyle]}>
              <StoryHero story={story} pieces={pieces} topPadding={insets.top + 70} />
            </Animated.View>
          </GestureDetector>
          <View style={styles.intro}>
            <Text style={[styles.kicker, { color: story.color }]}>A CURATED STORY</Text>
            <Text style={[styles.heading, { color: colors.bone }]}>Four edits, one easy point of view.</Text>
            <Text style={[styles.body, { color: colors.muted }]}>A considered mix of pieces for the season ahead. Start with the four featured edits, then keep scrolling to see everything in this story.</Text>
          </View>
          <View style={styles.editGrid}>
            {pieces.map((piece, index) => <StoryPiece key={`${piece.id}-${index}`} piece={piece} index={index} color={story.color} colors={colors} market={market} onOpenPiece={onOpenPiece} />)}
          </View>
        </AnimatedScrollView>
        <Animated.View style={[styles.flyingHero, flyingHeroStyle]} pointerEvents="none">
          <StoryHero story={story} pieces={pieces} topPadding={insets.top + 70} />
        </Animated.View>
        <Animated.View style={[styles.topBar, chromeStyle, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={closeToBanner} style={styles.closeButton} hitSlop={12} accessibilityRole="button" accessibilityLabel="Swipe down to close banner story">
            <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

function StoryHero({ story, pieces, topPadding }: { story: BannerStory; pieces: ClosetPiece[]; topPadding: number }) {
  return (
    <View style={[styles.hero, { backgroundColor: story.color }]}>
      <View style={[styles.heroCopy, { paddingTop: topPadding }]}>
        <Text style={styles.title}>{story.title}</Text>
        <Text style={styles.subtitle}>{story.subtitle}</Text>
        <View style={styles.heroFeatureGrid} pointerEvents="none">
          {pieces.map((piece, index) => <View key={`${piece.id}-hero-${index}`} style={styles.heroFeature}><Image source={{ uri: todayProductImage(piece) }} style={styles.heroFeatureImage} contentFit="contain" accessible={false} /></View>)}
        </View>
      </View>
    </View>
  );
}

function StoryPiece({ piece, index, color, colors, market, onOpenPiece }: { piece: ClosetPiece; index: number; color: string; colors: ReturnType<typeof useColors>; market: ReturnType<typeof getMarket>; onOpenPiece: (piece: ClosetPiece, origin: BannerStoryOrigin) => void }) {
  const ref = useRef<View>(null);
  return <Pressable ref={ref} onPress={(event) => { event.stopPropagation(); ref.current?.measureInWindow((x, y, width, height) => onOpenPiece(piece, { x, y, width, height })); }} style={[styles.editCard, index % 2 === 1 && styles.editCardOffset, { backgroundColor: `${color}20` }]} accessibilityRole="button" accessibilityLabel={`Open ${piece.name}`}>
    <View style={[styles.number, { backgroundColor: color }]}><Text style={styles.numberText}>0{index + 1}</Text></View>
    <Image source={{ uri: todayProductImage(piece) }} style={styles.editImage} contentFit="contain" accessible={false} />
    <Text style={[styles.pieceName, { color: colors.bone }]} numberOfLines={2}>{piece.name}</Text>
    <Text style={[styles.pieceMeta, { color: colors.muted }]}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 100, overflow: "hidden" },
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "#000" },
  page: { flex: 1 },
  content: { paddingHorizontal: 20 },
  heroSlot: { width: "100%", overflow: "hidden" },
  flyingHero: { position: "absolute", overflow: "hidden", zIndex: 5 },
  hero: { flex: 1, overflow: "hidden" },
  heroCopy: { flex: 1, paddingTop: 70, paddingHorizontal: 24 },
  title: { color: "#FFFFFF", fontSize: 46, lineHeight: 48, fontWeight: "900", letterSpacing: -1.5, maxWidth: 330 },
  subtitle: { color: "#FFFFFF", fontSize: 18, lineHeight: 24, marginTop: 13, maxWidth: 320 },
  heroFeatureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 22, maxWidth: 320 },
  heroFeature: { width: "23%", aspectRatio: 0.88, justifyContent: "center", alignItems: "center" },
  heroFeatureImage: { width: "100%", height: "100%" },
  intro: { paddingTop: 18, paddingBottom: 28 },
  kicker: { fontSize: 10, letterSpacing: 1.8, fontWeight: "900" },
  heading: { fontSize: 28, lineHeight: 32, fontWeight: "900", marginTop: 10 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 9 },
  editGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  editCard: { width: "48.2%", borderRadius: 18, padding: 10, overflow: "hidden" },
  editCardOffset: { marginTop: 18 },
  number: { position: "absolute", zIndex: 2, top: 10, left: 10, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  numberText: { color: "#181714", fontSize: 11, fontWeight: "900" },
  editImage: { width: "100%", aspectRatio: 0.86 },
  pieceName: { fontSize: 14, lineHeight: 18, fontWeight: "800", marginTop: 9 },
  pieceMeta: { fontSize: 12, marginTop: 4 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
});
