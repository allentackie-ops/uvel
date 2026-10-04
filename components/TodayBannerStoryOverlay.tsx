import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Animated, Dimensions, Pressable, Share as NativeShare, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Reanimated, { runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ClosetPiece } from "../lib/wardrobe";
import { moneyInMarket, getMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";

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
  const screen = Dimensions.get("window");
  const opacity = useRef(new Animated.Value(0)).current;
  const heroProgress = useRef(new Animated.Value(0)).current;
  const scrollY = useSharedValue(0);
  const dismissY = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const dragging = useSharedValue(0);
  const closing = useRef(false);
  const market = getMarket(app.country);
  const pieces = story.pieces.slice(0, 8);
  const heroHeight = Math.min(470, Math.max(360, screen.width * 0.98));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(heroProgress, { toValue: 1, damping: 22, stiffness: 250, mass: 0.8, useNativeDriver: true }),
    ]).start();
  }, [heroProgress, opacity]);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.spring(heroProgress, { toValue: 0, damping: 28, stiffness: 320, mass: 0.7, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  const heroScale = heroProgress.interpolate({ inputRange: [0, 1], outputRange: [origin.width / screen.width, 1] });
  const heroTranslateX = heroProgress.interpolate({ inputRange: [0, 1], outputRange: [origin.x - (screen.width - origin.width) / 2, 0] });
  const heroTranslateY = heroProgress.interpolate({ inputRange: [0, 1], outputRange: [origin.y - insets.top, 0] });

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissY.value }, { scale: 1 - Math.min(Math.max(dismissY.value / screen.height, 0), 0.18) }],
    opacity: 1 - Math.min(Math.max(dismissY.value / 420, 0), 0.72),
  }));
  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((event) => {
      touchStartY.value = event.allTouches[0]?.absoluteY ?? 0;
    })
    .onTouchesMove((event, state) => {
      const y = event.allTouches[0]?.absoluteY ?? touchStartY.value;
      const dy = y - touchStartY.value;
      if (scrollY.value > 4 || dy < 8 || dy < 0) {
        state.fail();
        return;
      }
      state.activate();
    })
    .onStart(() => {
      dragging.value = 1;
    })
    .onUpdate((event) => {
      if (dragging.value) dismissY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (!dragging.value) return;
      dragging.value = 0;
      if (dismissY.value > 100 || event.velocityY > 700) {
        dismissY.value = withTiming(screen.height, { duration: 220 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        dismissY.value = withSpring(0, { damping: 24, stiffness: 280, mass: 0.72 });
      }
    });
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (event) => { scrollY.value = event.contentOffset.y; } });

  return (
    <GestureHandlerRootView style={styles.root}>
      <Reanimated.View style={[styles.root, swipeStyle]}>
      <Animated.View style={[styles.root, { opacity, backgroundColor: colors.ink }]}>
      <Reanimated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 34 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
      >
        <GestureDetector gesture={pan}>
        <Animated.View style={[styles.heroMotion, { width: screen.width, marginLeft: -20, height: heroHeight, transform: [{ translateX: heroTranslateX }, { translateY: heroTranslateY }, { scale: heroScale }] }]}>
          <View style={[styles.heroColor, { backgroundColor: story.color }]} />
          <View style={[styles.heroCopy, { paddingTop: insets.top + 70 }]}>
            <Text style={styles.eyebrow}>{story.eyebrow || "THE EDIT"}</Text>
            <Text style={styles.title}>{story.title}</Text>
            <Text style={styles.subtitle}>{story.subtitle}</Text>
            <View style={styles.heroFeatureGrid} pointerEvents="none">
              {pieces.slice(0, 4).map((piece, index) => <View key={`${piece.id}-hero-${index}`} style={styles.heroFeature}><Image source={{ uri: piece.photo }} style={styles.heroFeatureImage} contentFit="cover" accessible={false} /></View>)}
            </View>
            <Text style={styles.heroFooter}>{story.footer || "UVEL EDIT"}</Text>
          </View>
        </Animated.View>
        </GestureDetector>
        <View style={styles.intro}>
          <Text style={[styles.kicker, { color: story.color }]}>A CURATED STORY</Text>
          <Text style={[styles.heading, { color: colors.bone }]}>Four edits, one easy point of view.</Text>
          <Text style={[styles.body, { color: colors.muted }]}>A considered mix of pieces for the season ahead. Start with the four featured edits, then keep scrolling to see everything in this story.</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.bone }]}>The four edits</Text>
          <Text style={[styles.sectionMeta, { color: colors.muted }]}>SCROLL TO EXPLORE</Text>
        </View>
        <View style={styles.editGrid}>
          {pieces.slice(0, 4).map((piece, index) => <StoryPiece key={`${piece.id}-${index}`} piece={piece} index={index} color={story.color} colors={colors} market={market} onOpenPiece={onOpenPiece} />)}
        </View>

        <View style={[styles.rule, { backgroundColor: `${colors.bone}22` }]} />
        <Text style={[styles.sectionTitle, { color: colors.bone }]}>More from this story</Text>
        <View style={styles.moreList}>
          {pieces.slice(4).map((piece, index) => <StoryListPiece key={`${piece.id}-more-${index}`} piece={piece} color={story.color} colors={colors} market={market} onOpenPiece={onOpenPiece} />)}
        </View>
        <View style={[styles.shareCard, { borderColor: `${story.color}80`, backgroundColor: `${story.color}18` }]}>
          <Text style={[styles.shareTitle, { color: colors.bone }]}>Keep the edit close</Text>
          <Text style={[styles.shareBody, { color: colors.muted }]}>Send this story to someone whose wardrobe you want to refresh.</Text>
          <Pressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); void NativeShare.share({ title: story.title, message: `${story.title} — ${story.subtitle}` }); }} style={[styles.shareButton, { backgroundColor: story.color }]} accessibilityRole="button" accessibilityLabel={`Share ${story.title}`}>
            <Ionicons name="share-outline" size={18} color="#181714" />
            <Text style={styles.shareButtonText}>Share story</Text>
          </Pressable>
        </View>
      </Reanimated.ScrollView>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={close} style={styles.closeButton} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close banner story">
          <Ionicons name="close" size={23} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.topLabel}>{story.footer || "UVEL EDIT"}</Text>
        <View style={styles.topSpacer} />
      </View>
      </Animated.View>
      </Reanimated.View>
    </GestureHandlerRootView>
  );
}

function StoryPiece({ piece, index, color, colors, market, onOpenPiece }: { piece: ClosetPiece; index: number; color: string; colors: ReturnType<typeof useColors>; market: ReturnType<typeof getMarket>; onOpenPiece: (piece: ClosetPiece, origin: BannerStoryOrigin) => void }) {
  const ref = useRef<View>(null);
  return <Pressable ref={ref} onPress={(event) => { event.stopPropagation(); ref.current?.measureInWindow((x, y, width, height) => onOpenPiece(piece, { x, y, width, height })); }} style={[styles.editCard, index % 2 === 1 && styles.editCardOffset, { backgroundColor: `${color}20` }]} accessibilityRole="button" accessibilityLabel={`Open ${piece.name}`}>
    <View style={[styles.number, { backgroundColor: color }]}><Text style={styles.numberText}>0{index + 1}</Text></View>
    <Image source={{ uri: piece.photo }} style={styles.editImage} contentFit="cover" accessible={false} />
    <Text style={[styles.pieceName, { color: colors.bone }]} numberOfLines={2}>{piece.name}</Text>
    <Text style={[styles.pieceMeta, { color: colors.muted }]}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>
  </Pressable>;
}

function StoryListPiece({ piece, color, colors, market, onOpenPiece }: { piece: ClosetPiece; color: string; colors: ReturnType<typeof useColors>; market: ReturnType<typeof getMarket>; onOpenPiece: (piece: ClosetPiece, origin: BannerStoryOrigin) => void }) {
  const ref = useRef<View>(null);
  return <Pressable ref={ref} onPress={(event) => { event.stopPropagation(); ref.current?.measureInWindow((x, y, width, height) => onOpenPiece(piece, { x, y, width, height })); }} style={[styles.listPiece, { borderBottomColor: `${colors.bone}20` }]} accessibilityRole="button" accessibilityLabel={`Open ${piece.name}`}>
    <Image source={{ uri: piece.photo }} style={styles.listImage} contentFit="cover" accessible={false} />
    <View style={styles.listCopy}><Text style={[styles.listName, { color: colors.bone }]} numberOfLines={2}>{piece.name}</Text><Text style={[styles.listMeta, { color: colors.muted }]}>{piece.brand || "Uvel seller"}</Text></View>
    <Text style={[styles.listPrice, { color }]}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 100, overflow: "hidden" },
  heroMotion: { position: "relative", width: "100%", overflow: "hidden", zIndex: 2 },
  heroColor: { ...StyleSheet.absoluteFill },
  heroImage: { ...StyleSheet.absoluteFill, opacity: 0.34 },
  heroTint: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.26)" },
  heroCopy: { flex: 1, paddingHorizontal: 24 },
  eyebrow: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", letterSpacing: 2.2 },
  title: { color: "#FFFFFF", fontSize: 46, lineHeight: 48, fontWeight: "900", letterSpacing: -1.5, marginTop: 15, maxWidth: 330 },
  subtitle: { color: "#FFFFFF", fontSize: 18, lineHeight: 24, marginTop: 13, maxWidth: 320 },
  heroFeatureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 22, maxWidth: 320 },
  heroFeature: { width: "23%", aspectRatio: 0.88, borderRadius: 10, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.2)" },
  heroFeatureImage: { width: "100%", height: "100%" },
  heroFooter: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", marginTop: 12 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  intro: { paddingTop: 18, paddingBottom: 28 },
  kicker: { fontSize: 10, letterSpacing: 1.8, fontWeight: "900" },
  heading: { fontSize: 28, lineHeight: 32, fontWeight: "900", marginTop: 10 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 9 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 },
  sectionTitle: { fontSize: 21, lineHeight: 26, fontWeight: "900" },
  sectionMeta: { fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  editGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  editCard: { width: "48.2%", borderRadius: 18, padding: 10, overflow: "hidden" },
  editCardOffset: { marginTop: 18 },
  number: { position: "absolute", zIndex: 2, top: 10, left: 10, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  numberText: { color: "#181714", fontSize: 11, fontWeight: "900" },
  editImage: { width: "100%", aspectRatio: 0.86, borderRadius: 12, backgroundColor: "#F4F0E6" },
  pieceName: { fontSize: 14, lineHeight: 18, fontWeight: "800", marginTop: 9 },
  pieceMeta: { fontSize: 12, marginTop: 4 },
  rule: { height: 1, marginVertical: 30 },
  moreList: { marginTop: 8 },
  listPiece: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  listImage: { width: 66, height: 78, borderRadius: 11, backgroundColor: "#F4F0E6" },
  listCopy: { flex: 1 },
  listName: { fontSize: 15, lineHeight: 19, fontWeight: "800" },
  listMeta: { fontSize: 12, marginTop: 4 },
  listPrice: { fontSize: 13, fontWeight: "900" },
  shareCard: { borderWidth: 1, borderRadius: 20, padding: 18, marginTop: 32 },
  shareTitle: { fontSize: 19, fontWeight: "900" },
  shareBody: { fontSize: 14, lineHeight: 20, marginTop: 5 },
  shareButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 22, minHeight: 44, paddingHorizontal: 16, marginTop: 16 },
  shareButtonText: { color: "#181714", fontSize: 13, fontWeight: "900" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16 },
  closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  topLabel: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", letterSpacing: 1.6 },
  topSpacer: { width: 42, height: 42 },
});
