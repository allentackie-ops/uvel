import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "./AccessiblePressable";
import { OrbitLoader } from "./OrbitLoader";
import type { ClosetPiece } from "../lib/wardrobe";
import { todayProductImage } from "../lib/todayProductImage";
import type { Colors } from "../lib/theme";
import { MARKET_RED, useColors } from "../lib/theme";
import { getMarket, moneyInMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { loadAddresses, setActiveAddress, type Address } from "../lib/orders";
import type { BannerStory } from "../lib/todayBannerStories";
import { curateTodayBanners, type CuratedTodayBanner } from "../lib/todayBannerEngine";
import type { ListingOrigin } from "./TodayListingOverlay";

type ListingRect = Pick<ListingOrigin, "x" | "y" | "width" | "height">;

const NEW_IN_LATEST_STICKER = require("../assets/today/new-in-latest-sticker.png");
const TRENDING_NOW_FINAL = require("../assets/today/trending-now-final.png");
const STYLE_FOR_LESS_STICKER = require("../assets/today/style-for-less-sticker-no-stars-clean.png");
const NEW_IN_ANIMATED_BASE = require("../assets/today/new-in-option3-collage.png");
const DEALS_MOTION_BANNER = require("../assets/today/deals-fun-motion-banner-clean.mp4");
const FINISHING_PIECES_POSTER = require("../assets/today/finishing-pieces-poster-03-pop-magazine.png");
const MINIMAL_WITH_PRESENCE_BANNER = require("../assets/today/minimal-with-presence-banner-mockup-v8.png");
const WE_THINK_EDITORIAL_HERO = require("../assets/today/we-think-editorial-hero.png");
const WE_THINK_CITY_LAYERS_AD = require("../assets/today/we-think-city-layers-ad.mp4");
const WE_THINK_OFF_DUTY_AD = require("../assets/today/we-think-off-duty-ad.mp4");
const WE_THINK_KNIT_NOW_AD = require("../assets/today/we-think-knit-now-ad.mp4");
const TODAY_DEALS_RED = MARKET_RED;

const EDITORIAL = [
  { title: "City layers", subtitle: "Effortless polish", accent: "#D8C4AE" },
  { title: "Off-duty looks", subtitle: "Easy & elevated", accent: "#D7DDE4" },
  { title: "Knit now", subtitle: "Layers you’ll live in", accent: "#E6D5C6" },
];

const STYLE_LOOKS = [
  { title: "Modern Minimalist", copy: "Clean staples for everyday elevated looks." },
  { title: "City Layering", copy: "Versatile pieces for wherever the day goes." },
];

const BANNER_COLORS = ["#F05237", "#2762C5", "#A5B98A", "#5B20D8", "#CFF7C8", "#8D74D6", "#E96B91", "#5F8D56"];
const FEED_FADE_STRIPS = Array.from({ length: 56 }, (_, index) => {
  const progress = index / 55;
  return Math.pow(progress, 1.65);
});

export type TodayCommerceFeedProps = {
  pieces: ClosetPiece[];
  query: string;
  onQueryChange: (value: string) => void;
  onOpenPiece: (piece: ClosetPiece, origin: ListingOrigin) => void;
  onOpenBanner: (story: BannerStory) => void;
  onOpenSearch: () => void;
  onOpenMessages: () => void;
  onOpenTools: () => void;
  onOpenCountries: () => void;
  onOpenCreators: () => void;
  onOpenStyle: () => void;
  refreshing: boolean;
  onRefresh: () => void;
};

export function TodayCommerceFeed({
  pieces,
  query,
  onQueryChange,
  onOpenPiece,
  onOpenBanner,
  onOpenSearch,
  onOpenMessages,
  onOpenTools,
  onOpenCountries,
  onOpenCreators,
  onOpenStyle,
  refreshing,
  onRefresh,
}: TodayCommerceFeedProps) {
  const colors = useColors();
  const styles = make(colors);
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const market = getMarket(app.country);
  const scrollY = useRef(new Animated.Value(0)).current;
  const pullOffset = useRef(new Animated.Value(0)).current;
  const pullTriggered = useRef(false);
  const wasRefreshing = useRef(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const posterScrollX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    void loadAddresses().then((saved) => {
      if (!cancelled) setAddresses(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const posterWidth = Math.min(352, Dimensions.get("window").width - 48);
  const posterInterval = posterWidth + 12;
  const posterHeight = Math.round(Math.min(470, Math.max(390, posterWidth * 1.24)));
  const bannerColorFieldHeight = insets.top + 62 + 10 + posterHeight;
  const feedPieces = pieces.length
    ? Array.from({ length: Math.max(32, pieces.length * 3) }, (_, index) => pieces[index % pieces.length])
    : [];
  const featured = feedPieces.slice(0, 4);
  const recommended = feedPieces.slice(0, 8);
  const editors = feedPieces.slice(2, 6).length >= 3 ? feedPieces.slice(2, 6) : feedPieces.slice(0, 4);
  const deals = feedPieces.slice(8, 12).length >= 3 ? feedPieces.slice(8, 12) : feedPieces.slice(0, 4);
  const followed = feedPieces.slice(12, 16).length >= 3 ? feedPieces.slice(12, 16) : feedPieces.slice(0, 4);
  const personalized = feedPieces.slice(16, 24).length >= 4 ? feedPieces.slice(16, 24) : feedPieces.slice(0, 8);
  const bannerTemplates = curateTodayBanners(pieces);
  const topColorFade = scrollY.interpolate({ inputRange: [0, 180], outputRange: [1, 0], extrapolate: "clamp" });
  const logoMotion = {
    opacity: scrollY.interpolate({ inputRange: [0, 80], outputRange: [1, 0.86], extrapolate: "clamp" }),
    transform: [
      { translateY: scrollY.interpolate({ inputRange: [0, 80], outputRange: [0, -5], extrapolate: "clamp" }) },
      { scale: scrollY.interpolate({ inputRange: [0, 80], outputRange: [1, 0.9], extrapolate: "clamp" }) },
    ],
  };
  const handleRefresh = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    onRefresh();
  };
  const activeAddress = addresses[0];
  const firstName = (activeAddress?.name || app.displayName || "you").trim().split(/\s+/)[0];
  const deliveryLabel = activeAddress
    ? `Deliver to ${firstName}${activeAddress.city || activeAddress.postal ? ` - ${[activeAddress.city, activeAddress.postal].filter(Boolean).join(", ")}` : ""}`
    : "Add delivery address";
  const openLocation = () => {
    void loadAddresses().then(setAddresses);
    setLocationOpen(true);
  };
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = event.nativeEvent.contentOffset.y;
      if (pullTriggered.current) return;
      if (y < 0) pullOffset.setValue(Math.min(72, -y));
      else pullOffset.setValue(0);
      if (y <= -60 && !refreshing) {
        pullTriggered.current = true;
        pullOffset.setValue(72);
        handleRefresh();
      }
    },
  });
  useEffect(() => {
    if (refreshing) {
      wasRefreshing.current = true;
      Animated.spring(pullOffset, { toValue: 72, damping: 22, stiffness: 180, mass: 0.8, useNativeDriver: true }).start();
    } else if (wasRefreshing.current) {
      wasRefreshing.current = false;
      Animated.timing(pullOffset, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => {
        pullTriggered.current = false;
      });
    }
  }, [pullOffset, refreshing]);

  return (
    <View style={styles.page}>
      <View pointerEvents="none" style={[styles.topColorField, { height: bannerColorFieldHeight }]}>
        {BANNER_COLORS.map((color, index) => {
          const inputRange = index === 0 ? [0, posterInterval] : [(index - 1) * posterInterval, index * posterInterval, (index + 1) * posterInterval];
          const outputRange = index === 0 ? [0.64, 0] : [0, 0.64, 0];
          const horizontalOpacity = posterScrollX.interpolate({ inputRange, outputRange, extrapolate: "clamp" });
          return <Animated.View key={color} style={[styles.topColorLayer, { height: bannerColorFieldHeight, backgroundColor: color, opacity: Animated.multiply(horizontalOpacity, topColorFade) }]} />;
        })}
        <View style={styles.topColorFade}>
          {FEED_FADE_STRIPS.map((opacity, index) => <View key={index} style={[styles.topColorFadeStrip, { opacity }]} />)}
        </View>
      </View>
      <View style={[styles.fixedHeader, { height: insets.top + 62, paddingTop: insets.top }]}>
        <AccessiblePressable onPress={onOpenTools} style={styles.topIcon} accessibilityRole="button" accessibilityLabel="Open Today tools">
          <View style={styles.menuIcon}><View style={styles.menuLine} /><View style={styles.menuLine} /><View style={styles.menuLine} /></View>
        </AccessiblePressable>
        <AccessiblePressable onPress={openLocation} style={styles.locationButton} accessibilityRole="button" accessibilityLabel={deliveryLabel} accessibilityHint="Open saved delivery addresses">
          <Ionicons name="location-outline" size={16} color={colors.bone} />
          <Text style={styles.locationText} numberOfLines={1}>{deliveryLabel}</Text>
        </AccessiblePressable>
        <View style={styles.headerActions}>
          <AccessiblePressable onPress={onOpenSearch} style={styles.topIcon} accessibilityRole="button" accessibilityLabel="Search Uvel"><Ionicons name="search-outline" size={24} color={colors.bone} /></AccessiblePressable>
          <AccessiblePressable onPress={onOpenMessages} style={styles.topIcon} accessibilityRole="button" accessibilityLabel="Open messages"><Ionicons name="chatbubble-ellipses-outline" size={23} color={colors.bone} /></AccessiblePressable>
        </View>
      </View>
      <Animated.ScrollView
        style={[styles.feedScroll, { transform: [{ translateY: pullOffset }] }]}
        contentContainerStyle={[styles.content, { paddingTop: 10 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        scrollEventThrottle={16}
        bounces
        onScroll={handleScroll}
      >
      <PosterCarousel banners={bannerTemplates} onOpenBanner={onOpenBanner} styles={styles} scrollX={posterScrollX} posterWidth={posterWidth} posterHeight={posterHeight} posterInterval={posterInterval} />

      <SectionTitle title="For you" onPress={onOpenSearch} />
      <ProductRail pieces={recommended.slice(0, 4)} market={market} onOpen={onOpenPiece} deals />

      <SectionTitle title="Keep shopping for" onPress={onOpenSearch} />
      <ProductRail pieces={recommended.slice(4, 8).length ? recommended.slice(4, 8) : recommended.slice(0, 4)} market={market} onOpen={onOpenPiece} compact />

      <SectionTitle title="We think you’ll love these" onPress={onOpenSearch} />
      <View style={styles.editorHero}>
        <View style={styles.editorCopy}>
          <Text style={styles.editorTitle}>Curated for your style</Text>
          <Text style={styles.editorSubtitle}>Modern looks for real life.</Text>
          <Pressable onPress={onOpenSearch} style={styles.editorButton} accessibilityRole="button" accessibilityLabel="Shop the editor story"><Text style={styles.editorButtonText}>Shop the story ›</Text></Pressable>
        </View>
        <Image source={WE_THINK_EDITORIAL_HERO} style={styles.editorImage} contentFit="cover" cachePolicy="memory-disk" transition={150} accessible={false} />
      </View>
      <View style={styles.editorTiles}>
        {[{ ...EDITORIAL[0], video: WE_THINK_CITY_LAYERS_AD }, { ...EDITORIAL[1], video: WE_THINK_OFF_DUTY_AD }, { ...EDITORIAL[2], video: WE_THINK_KNIT_NOW_AD }].map((item) => <Pressable key={item.title} onPress={onOpenSearch} style={[styles.editorTile, { backgroundColor: item.accent }]} accessibilityRole="button" accessibilityLabel={item.title}>
          <EditorialTileVideo source={item.video} styles={styles} />
          <View style={styles.editorTileShade} />
          <Text style={styles.editorTileTitle}>{item.title}</Text><Text style={styles.editorTileSubtitle}>{item.subtitle}</Text><Text style={styles.tileArrow}>›</Text>
        </Pressable>)}
      </View>

      <SectionTitle title="Trending in your world" onPress={onOpenSearch} />
      <ProductRail pieces={editors} market={market} onOpen={onOpenPiece} />
      <View style={styles.coralStrip}>
        <View><Text style={styles.stripTitle}>Build your weekend uniform</Text><Text style={styles.stripSub}>Versatile pieces. More good days.</Text></View>
        <Pressable onPress={onOpenSearch} style={styles.stripButton} accessibilityRole="button" accessibilityLabel="Shop the weekend edit"><Text style={styles.stripButtonText}>Shop the edit ›</Text></Pressable>
      </View>

      <DealsFeature pieces={deals} market={market} onOpen={onOpenPiece} />
      <View style={styles.creatorCard}>
        <View style={styles.creatorCopy}><Text style={styles.creatorTitle}>Styled by people{`\n`}you’ll love</Text><Text style={styles.creatorSub}>Real looks. Real people.</Text><Pressable onPress={onOpenCreators} style={styles.whiteButton} accessibilityRole="button" accessibilityLabel="See creators"><Text style={styles.whiteButtonText}>See creators ›</Text></Pressable></View>
        <View style={styles.creatorFaces}>{followed.slice(0, 3).map((piece) => <Image key={piece.id} source={{ uri: piece.photo }} style={styles.creatorFace} contentFit="cover" accessible={false} />)}</View>
      </View>

      <SectionTitle title="New from brands you follow" onPress={onOpenSearch} />
      <ProductRail pieces={followed} market={market} onOpen={onOpenPiece} compact />

      <SectionTitle title="Keep exploring your style" onPress={onOpenStyle} />
      <View style={styles.lookGrid}>{STYLE_LOOKS.map((look, index) => <Pressable key={look.title} onPress={onOpenStyle} style={styles.lookCard} accessibilityRole="button" accessibilityLabel={look.title}>
        <View style={styles.lookCopy}><Text style={styles.lookTitle}>{look.title}</Text><Text style={styles.lookBody}>{look.copy}</Text><Text style={styles.lookButton}>Shop the look ›</Text></View>
        {personalized[index] ? <Image source={{ uri: personalized[index].photo }} style={styles.lookImage} contentFit="cover" accessible={false} /> : null}
      </Pressable>)}</View>

      <SectionTitle title="Because you saved relaxed tailoring" onPress={onOpenSearch} />
      <ProductRail pieces={personalized.slice(0, 4)} market={market} onOpen={onOpenPiece} />
      <Pressable onPress={onOpenStyle} style={styles.styleDna} accessibilityRole="button" accessibilityLabel="See your Style DNA">
        <View style={styles.styleDnaCopy}><Text style={styles.styleDnaTitle}>Your Style DNA{`\n`}is getting clearer</Text><Text style={styles.styleDnaBody}>You gravitate toward classic shapes, neutral tones and modern layers.</Text><Text style={styles.styleDnaButton}>See your style ›</Text></View>
        <View style={styles.swatches}>{["#EEEAE2", "#AF9782", "#5B4637", "#586247"].map((color) => <View key={color} style={[styles.swatch, { backgroundColor: color }]} />)}</View>
      </Pressable>

      <SectionTitle title="Recently viewed" onPress={onOpenSearch} />
      <ProductRail pieces={personalized.slice(4, 8).length ? personalized.slice(4, 8) : personalized.slice(0, 4)} market={market} onOpen={onOpenPiece} compact />
      </Animated.ScrollView>
      <Modal visible={locationOpen} transparent animationType="fade" onRequestClose={() => setLocationOpen(false)} statusBarTranslucent>
        <Pressable style={styles.locationBackdrop} onPress={() => setLocationOpen(false)} accessibilityRole="button" accessibilityLabel="Close delivery address popup">
          <Pressable style={styles.locationCard} onPress={(event) => event.stopPropagation()} accessibilityViewIsModal>
            <View style={styles.locationTitleRow}>
              <View><Text style={styles.locationEyebrow}>DELIVER TO</Text><Text style={styles.locationTitle}>{activeAddress ? firstName : "Add your address"}</Text></View>
              <Pressable onPress={() => setLocationOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={20} color={colors.muted} /></Pressable>
            </View>
            {addresses.map((address, index) => {
              const selected = address.id === activeAddress?.id;
              return <Pressable key={address.id || index} onPress={() => { if (address.id) void setActiveAddress(address.id); setAddresses((current) => [address, ...current.filter((item) => item.id !== address.id)]); }} style={[styles.locationAddress, selected && styles.locationAddressSelected]} accessibilityRole="radio" accessibilityState={{ selected }}>
                <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={19} color={selected ? colors.success : colors.muted} />
                <View style={{ flex: 1 }}><Text style={styles.locationAddressName}>{address.name}</Text><Text style={styles.locationAddressText} numberOfLines={2}>{[address.line1, address.city, address.region, address.postal].filter(Boolean).join(", ")}</Text></View>
              </Pressable>;
            })}
            <Pressable onPress={() => { setLocationOpen(false); router.push({ pathname: "/address", params: { mode: "add" } }); }} style={styles.addLocationButton} accessibilityRole="button" accessibilityLabel="Add another delivery address"><Ionicons name="add" size={18} color={colors.successInk} /><Text style={styles.addLocationText}>Add another address</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      {refreshing ? <View pointerEvents="none" style={[styles.pullOrbitLayer, { top: insets.top + 62 }]}><OrbitLoader size={58} /></View> : null}
    </View>
  );
}

function PosterCarousel({
  banners,
  onOpenBanner,
  styles,
  scrollX,
  posterWidth,
  posterHeight,
  posterInterval,
}: {
  banners: CuratedTodayBanner[];
  onOpenBanner: TodayCommerceFeedProps["onOpenBanner"];
  styles: ReturnType<typeof make>;
  scrollX: Animated.Value;
  posterWidth: number;
  posterHeight: number;
  posterInterval: number;
}) {
  const interval = posterInterval;
  const carouselRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const stories = banners;
  const scheduleAutoAdvance = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const next = (activeIndexRef.current + 1) % stories.length;
      activeIndexRef.current = next;
      setActiveIndex(next);
      carouselRef.current?.scrollTo({ x: next * interval, animated: true });
      scheduleAutoAdvance();
    }, 5000);
  };
  useEffect(() => {
    scheduleAutoAdvance();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [interval, stories.length]);
  const openBanner = (story: BannerStory) => {
    onOpenBanner(story);
  };
  return (
    <View style={styles.posterStage}>
      <Animated.ScrollView
        ref={carouselRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: 0 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onTouchStart={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
        onTouchEnd={() => scheduleAutoAdvance()}
        onMomentumScrollEnd={(event) => {
          const next = Math.max(0, Math.min(stories.length - 1, Math.round(event.nativeEvent.contentOffset.x / interval)));
          activeIndexRef.current = next;
          setActiveIndex(next);
          scheduleAutoAdvance();
        }}
      >
        {stories.map((story, index) => {
          return <Pressable key={story.id} onPress={() => openBanner({ title: story.title, subtitle: story.subtitle, color: story.color, headerColor: BANNER_COLORS[index] ?? story.color, eyebrow: story.title.toUpperCase(), footer: story.title.toUpperCase(), pieces: story.pieces, detailPieces: story.detailPieces })} style={{ width: posterWidth, height: posterHeight, marginRight: 12 }} accessibilityRole="button" accessibilityLabel={`Open ${story.title} editorial`}>
            <EditorialPoster story={story} pieces={story.id === "new-in" ? story.detailPieces : story.pieces} styles={styles} staticAsset={story.id === "trending-now" ? TRENDING_NOW_FINAL : story.id === "new-in" ? NEW_IN_ANIMATED_BASE : story.id === "accessories" ? FINISHING_PIECES_POSTER : story.id === "quiet-luxury" ? MINIMAL_WITH_PRESENCE_BANNER : undefined} videoAsset={story.id === "deals" ? DEALS_MOTION_BANNER : undefined} videoActive={activeIndex === index} />
          </Pressable>;
        })}
      </Animated.ScrollView>
    </View>
  );
}

type EditorialVariant = "float" | "slide" | "explode" | "collage" | "luxury";

function EditorialPoster({ story, pieces, styles, staticAsset, videoAsset, videoActive }: { story: { title: string; subtitle: string; color: string; variant: EditorialVariant; image?: string }; pieces: ClosetPiece[]; styles: ReturnType<typeof make>; staticAsset?: number; videoAsset?: number; videoActive?: boolean }) {
  const motion = useRef(new Animated.Value(0)).current;
  const secondaryMotionValue = useRef(new Animated.Value(0)).current;
  const tertiaryMotionValue = useRef(new Animated.Value(0)).current;
  const fourthMotionValue = useRef(new Animated.Value(0)).current;
  const latestStickerMotion = useRef(new Animated.Value(0)).current;
  const newInOpacities = useRef([new Animated.Value(1), new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]).current;
  const newInScales = useRef([new Animated.Value(1), new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]).current;
  const cascadeGeneration = useRef(0);
  const displayedPiecesRef = useRef<ClosetPiece[]>(pieces.slice(0, 4));
  const [displayedPieces, setDisplayedPieces] = useState(() => pieces.slice(0, 4));
  const [newInSetIndex, setNewInSetIndex] = useState(0);
  const activePieces = story.variant === "slide" ? displayedPieces : pieces;
  useEffect(() => {
    if (story.variant !== "slide") return;
    const stickerLoop = Animated.loop(Animated.sequence([
      Animated.timing(latestStickerMotion, { toValue: 1, duration: 1350, useNativeDriver: true }),
      Animated.timing(latestStickerMotion, { toValue: 0, duration: 1350, useNativeDriver: true }),
    ]));
    stickerLoop.start();
    return () => stickerLoop.stop();
  }, [latestStickerMotion, story.variant]);
  useEffect(() => {
    if (story.variant !== "slide" || pieces.length <= 0) return;
    const rotationTimer = setInterval(() => setNewInSetIndex((index) => index + 1), 6000);
    return () => clearInterval(rotationTimer);
  }, [pieces.length, story.variant]);
  useEffect(() => {
    if (story.variant !== "slide") return;
    const pool = pieces.slice(0, 40);
    if (!pool.length) return;
    const start = pool.length > 4 ? (newInSetIndex * 4) % pool.length : newInSetIndex % pool.length;
    const nextPieces = Array.from({ length: Math.min(4, pool.length) }, (_, index) => pool[(start + index) % pool.length]);
    const nextKey = nextPieces.map((piece) => `${piece.id}:${piece.cutoutPhoto || piece.photo}`).join("|");
    const currentKey = displayedPiecesRef.current.map((piece) => `${piece.id}:${piece.cutoutPhoto || piece.photo}`).join("|");
    if (nextKey === currentKey) return;
    const generation = ++cascadeGeneration.current;
    const exits = newInOpacities.map((value) => Animated.timing(value, { toValue: 0, duration: 220, useNativeDriver: true }));
    const exitSequence = Animated.stagger(80, exits);
    exitSequence.start(({ finished }) => {
      if (!finished || generation !== cascadeGeneration.current) return;
      displayedPiecesRef.current = nextPieces;
      setDisplayedPieces(nextPieces);
      newInScales.forEach((value) => value.setValue(0.97));
      requestAnimationFrame(() => {
        if (generation !== cascadeGeneration.current) return;
        Animated.stagger(80, newInOpacities.map((value, index) => Animated.parallel([
          Animated.timing(value, { toValue: 1, duration: 240, useNativeDriver: true }),
          Animated.timing(newInScales[index], { toValue: 1, duration: 240, useNativeDriver: true }),
        ]))).start();
      });
    });
    return () => {
      cascadeGeneration.current += 1;
      exitSequence.stop();
    };
  }, [newInOpacities, newInScales, newInSetIndex, pieces, story.variant]);
  useEffect(() => {
    const durations = story.variant === "luxury" ? [5200, 6200, 7000, 5800] : story.variant === "slide" ? [2800, 3600, 4400, 3200] : story.variant === "explode" ? [3000, 3900, 4700, 3400] : story.variant === "collage" ? [3400, 4300, 5100, 3700] : [3600, 4600, 5400, 4000];
    const createLoop = (value: Animated.Value, duration: number, delay: number) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(value, { toValue: 1, duration, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration, useNativeDriver: true }),
    ]));
    const animations = [
      createLoop(motion, durations[0], 0),
      createLoop(secondaryMotionValue, durations[1], 260),
      createLoop(tertiaryMotionValue, durations[2], 520),
      createLoop(fourthMotionValue, durations[3], 780),
    ];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [fourthMotionValue, motion, secondaryMotionValue, story.variant, tertiaryMotionValue]);
  const heroMotion = story.variant === "float"
    ? { transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }, { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ["-4deg", "3deg"] }) }, { scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }] }
    : story.variant === "slide"
      ? { transform: [{ translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [26, -18] }) }, { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ["-9deg", "-3deg"] }) }] }
      : story.variant === "explode"
        ? { transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [30, -12] }) }, { scale: motion.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.04] }) }] }
        : story.variant === "collage"
          ? { transform: [{ translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [-18, 12] }) }, { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ["8deg", "-1deg"] }) }] }
          : { transform: [{ scale: motion.interpolate({ inputRange: [0, 1], outputRange: [0.99, 1.015] }) }, { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [3, -3] }) }] };
  const secondaryRotation = story.variant === "slide" ? ["-16deg", "-10deg"] : story.variant === "explode" ? ["8deg", "15deg"] : story.variant === "collage" ? ["-20deg", "-14deg"] : story.variant === "luxury" ? ["-8deg", "-4deg"] : ["-12deg", "-7deg"];
  const tertiaryRotation = story.variant === "slide" ? ["10deg", "16deg"] : story.variant === "explode" ? ["-18deg", "-10deg"] : story.variant === "collage" ? ["12deg", "18deg"] : story.variant === "luxury" ? ["18deg", "24deg"] : ["14deg", "20deg"];
  const secondaryMotion = story.variant === "slide"
    ? { transform: [{ translateX: secondaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: [-44, 8] }) }, { rotate: secondaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: secondaryRotation }) }] }
    : story.variant === "explode"
      ? { transform: [{ translateY: secondaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: [34, -5] }) }, { rotate: secondaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: secondaryRotation }) }] }
      : story.variant === "collage"
        ? { transform: [{ translateX: secondaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: [-18, 14] }) }, { rotate: secondaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: secondaryRotation }) }] }
        : { transform: [{ translateY: secondaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: [8, -10] }) }, { rotate: secondaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: secondaryRotation }) }] };
  const tertiaryMotion = story.variant === "slide"
    ? { transform: [{ translateX: tertiaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: [28, -18] }) }, { rotate: tertiaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: tertiaryRotation }) }] }
    : story.variant === "explode"
      ? { transform: [{ translateY: tertiaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: [-30, 8] }) }, { rotate: tertiaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: tertiaryRotation }) }] }
      : story.variant === "collage"
        ? { transform: [{ translateY: tertiaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: [10, -12] }) }, { rotate: tertiaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: tertiaryRotation }) }] }
        : { transform: [{ translateX: tertiaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: [8, -12] }) }, { rotate: tertiaryMotionValue.interpolate({ inputRange: [0, 1], outputRange: tertiaryRotation }) }] };
  const fourthMotion = story.variant === "slide"
    ? { transform: [{ translateX: fourthMotionValue.interpolate({ inputRange: [0, 1], outputRange: [42, -8] }) }, { scale: fourthMotionValue.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }
    : story.variant === "explode"
      ? { transform: [{ translateY: fourthMotionValue.interpolate({ inputRange: [0, 1], outputRange: [-28, 6] }) }, { rotate: "-18deg" }] }
      : story.variant === "collage"
        ? { transform: [{ translateX: fourthMotionValue.interpolate({ inputRange: [0, 1], outputRange: [12, -10] }) }, { rotate: "-8deg" }] }
        : { transform: [{ translateY: fourthMotionValue.interpolate({ inputRange: [0, 1], outputRange: [5, -8] }) }, { rotate: story.variant === "luxury" ? "7deg" : "-7deg" }] };
  const newInProductMotion = (index: number) => ({
    opacity: newInOpacities[index],
    transform: [{ scale: newInScales[index] }],
  });
  const composition = story.variant === "slide"
    ? { hero: { left: 112, top: 142, width: 206, height: 284, zIndex: 1 }, secondary: { left: -22, top: 278, width: 154, height: 198, zIndex: 4 }, tertiary: { right: -16, top: 326, width: 142, height: 184, zIndex: 3 }, fourth: { left: 50, top: 238, width: 122, height: 158, transform: [{ rotate: "-6deg" }], zIndex: 2 } }
    : story.variant === "explode"
      ? { hero: { left: 88, top: 126, width: 214, height: 286, zIndex: 3 }, secondary: { left: -18, top: 286, width: 160, height: 204, zIndex: 1 }, tertiary: { right: -20, top: 250, width: 152, height: 198, zIndex: 4 }, fourth: { left: 140, top: 338, width: 114, height: 148, transform: [{ rotate: "-18deg" }], zIndex: 5 } }
      : story.variant === "collage"
        ? { hero: { left: 54, top: 132, width: 208, height: 258, zIndex: 2 }, secondary: { left: -28, top: 258, width: 166, height: 210, zIndex: 4 }, tertiary: { right: -26, top: 240, width: 152, height: 198, zIndex: 1 }, fourth: { left: 130, top: 326, width: 126, height: 164, transform: [{ rotate: "-8deg" }], zIndex: 5 } }
        : story.variant === "luxury"
          ? { hero: { right: -18, top: 112, width: 252, height: 308, zIndex: 2 }, secondary: { left: 0, top: 298, width: 152, height: 194, zIndex: 4 }, tertiary: { right: 2, top: 338, width: 136, height: 174, zIndex: 5 }, fourth: { left: 116, top: 220, width: 118, height: 152, transform: [{ rotate: "7deg" }], zIndex: 3 } }
          : { hero: { right: -10, top: 126, width: 214, height: 286, zIndex: 2 }, secondary: { left: -18, top: 284, width: 158, height: 202, zIndex: 1 }, tertiary: { right: -22, top: 306, width: 148, height: 188, zIndex: 4 }, fourth: { left: 92, top: 300, width: 116, height: 150, transform: [{ rotate: "-7deg" }], zIndex: 3 } };
  if (videoAsset) return <DealsMotionPoster source={videoAsset} color={story.color} styles={styles} active={Boolean(videoActive)} />;
  if (staticAsset) {
    return <View style={[styles.editorialPoster, { backgroundColor: story.color, padding: 0 }]}><Image source={staticAsset} style={styles.editorialReferenceImage} contentFit="cover" accessible={false} /></View>;
  }
  return <View style={[styles.editorialPoster, { backgroundColor: story.color }]}>
    <Text style={styles.editorialTitle}>{story.title}</Text>
    <Text style={styles.editorialSubtitle}>{story.subtitle}</Text>
    {story.variant === "slide" ? <Animated.View pointerEvents="none" style={[styles.editorialLatestSticker, { transform: [{ translateX: latestStickerMotion.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] }) }] }]}><Image source={NEW_IN_LATEST_STICKER} style={styles.editorialLatestStickerImage} contentFit="contain" accessible={false} /></Animated.View> : null}
    <Animated.View pointerEvents="none" style={[styles.editorialCutout, composition.hero, story.variant === "slide" ? newInProductMotion(0) : heroMotion]}>
      <Image source={{ uri: todayProductImage(activePieces[0], story.image) }} style={styles.editorialCutoutImage} contentFit="contain" accessible={false} />
    </Animated.View>
    {activePieces[1] ? <Animated.View pointerEvents="none" style={[styles.editorialCutout, composition.secondary, story.variant === "slide" ? newInProductMotion(1) : secondaryMotion]}><Image source={{ uri: todayProductImage(activePieces[1]) }} style={styles.editorialCutoutImage} contentFit="contain" accessible={false} /></Animated.View> : null}
    {activePieces[2] ? <Animated.View pointerEvents="none" style={[styles.editorialCutout, composition.tertiary, story.variant === "slide" ? newInProductMotion(2) : tertiaryMotion]}><Image source={{ uri: todayProductImage(activePieces[2]) }} style={styles.editorialCutoutImage} contentFit="contain" accessible={false} /></Animated.View> : null}
    {activePieces[3] ? <Animated.View pointerEvents="none" style={[styles.editorialCutout, composition.fourth, story.variant === "slide" ? newInProductMotion(3) : fourthMotion, story.variant !== "slide" && { opacity: motion.interpolate({ inputRange: [0, 1], outputRange: [0.76, 1] }) }]}><Image source={{ uri: todayProductImage(activePieces[3]) }} style={styles.editorialCutoutImage} contentFit="contain" accessible={false} /></Animated.View> : null}
  </View>;
}

function EditorialTileVideo({ source, styles }: { source: number; styles: ReturnType<typeof make> }) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.volume = 0;
    instance.audioMixingMode = "mixWithOthers";
    instance.play();
  });
  useEffect(() => {
    player.loop = true;
    player.muted = true;
    player.volume = 0;
    player.play();
    return () => player.pause();
  }, [player]);
  return <VideoView player={player} pointerEvents="none" style={styles.editorTileImage} contentFit="cover" nativeControls={false} surfaceType="textureView" />;
}
function DealsMotionPoster({ source, color, styles, active }: { source: number; color: string; styles: ReturnType<typeof make>; active: boolean }) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.volume = 0;
    instance.audioMixingMode = "mixWithOthers";
  });
  useEffect(() => {
    player.loop = true;
    player.muted = true;
    player.volume = 0;
  }, [player]);
  useEffect(() => {
    if (!active) {
      player.pause();
      player.currentTime = 0;
      return;
    }
    player.play();
  }, [active, player]);
  useEffect(() => () => player.pause(), [player]);
  return <View pointerEvents="none" style={[styles.editorialPoster, { backgroundColor: color, padding: 0 }]}><VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} surfaceType="textureView" /></View>;
}

function SectionTitle({ title, onPress }: { title: string; onPress: () => void }) {
  const colors = useColors();
  return <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 28, marginBottom: 11, paddingBottom: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}35` }}><Text style={{ color: colors.bone, fontSize: 21, fontWeight: "800", letterSpacing: -0.3 }}>{title}</Text><Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={`See all ${title}`}><Text style={{ color: colors.link ?? colors.pulse, fontSize: 13, fontWeight: "800", paddingBottom: 2 }}>See all ›</Text></Pressable></View>;
}

function ProductRail({ pieces, market, onOpen, deals, compact }: { pieces: ClosetPiece[]; market: ReturnType<typeof getMarket>; onOpen: TodayCommerceFeedProps["onOpenPiece"]; deals?: boolean; compact?: boolean }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 3 }}>{pieces.map((piece, index) => <ProductCard key={`${piece.id}-${index}`} piece={piece} market={market} onOpen={onOpen} deals={deals} compact={compact} />)}</ScrollView>;
}

function DealsFeature({ pieces, market, onOpen }: { pieces: ClosetPiece[]; market: ReturnType<typeof getMarket>; onOpen: TodayCommerceFeedProps["onOpenPiece"] }) {
  const styles = make(useColors());
  const beamMotion = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const beamLoop = Animated.loop(Animated.sequence([
      Animated.timing(beamMotion, { toValue: 1, duration: 1100, useNativeDriver: true }),
      Animated.timing(beamMotion, { toValue: 0, duration: 1100, useNativeDriver: true }),
    ]));
    beamLoop.start();
    return () => beamLoop.stop();
  }, [beamMotion]);
  const beamOpacity = beamMotion.interpolate({ inputRange: [0, 1], outputRange: [0.36, 0.95] });
  const beamScale = beamMotion.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] });
  const stickerOpacity = beamMotion.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });
  const stickerRotation = beamMotion.interpolate({ inputRange: [0, 1], outputRange: ["-5deg", "4deg"] });
  return <View style={styles.dealsFeature}>
    <View style={styles.dealsFeatureHeader}>
      <View style={styles.dealsFeatureCopy}>
        <Text style={styles.dealsFeatureTitle}>DEALS WORTH{`\n`}OPENING</Text>
        <Text style={styles.dealsFeatureSubtitle}>Iconic pieces. Better prices. Right now.</Text>
      </View>
      <View style={styles.dealsFeatureNote}>
        <Animated.View pointerEvents="none" style={[styles.dealsStickerHalo, { opacity: beamOpacity, transform: [{ scale: beamScale }] }]} />
        <Animated.View style={[styles.dealsStickerImage, { opacity: stickerOpacity, transform: [{ scale: beamScale }, { rotate: stickerRotation }] }]}>
          <Image source={STYLE_FOR_LESS_STICKER} style={styles.dealsStickerImage} contentFit="contain" accessible={false} />
        </Animated.View>
      </View>
    </View>
    <View style={styles.dealsGrid}>
      {pieces.slice(0, 4).map((piece, index) => <DealFeatureCard key={`${piece.id}-${index}`} piece={piece} market={market} onOpen={onOpen} styles={styles} />)}
    </View>
  </View>;
}

function DealFeatureCard({ piece, market, onOpen, styles }: { piece: ClosetPiece; market: ReturnType<typeof getMarket>; onOpen: TodayCommerceFeedProps["onOpenPiece"]; styles: ReturnType<typeof make> }) {
  const app = useUvel();
  const imageRef = useRef<View>(null);
  const measureImage = (callback: (rect: ListingRect) => void) => {
    imageRef.current?.measureInWindow((x, y, width, height) => callback({ x, y, width, height }));
  };
  const saved = app.saved.includes(piece.id);
  const discountRates = [0.2, 0.25, 0.3, 0.35];
  const rate = discountRates[indexForDeal(piece.id)];
  const price = moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market);
  const originalPrice = moneyInMarket(Math.round(piece.listPriceCents / (1 - rate)), piece.currency || market.currency, market);
  const brand = piece.brand && piece.brand !== "Unlabeled" ? piece.brand : "Uvel seller";
  return <View style={styles.dealFeatureCard}>
    <AccessiblePressable onPress={() => measureImage((rect) => onOpen(piece, { ...rect, radii: [15, 15, 0, 0], photo: piece.photo, measure: measureImage }))} style={styles.dealFeaturePress} accessibilityRole="button" accessibilityLabel={`Open deal for ${piece.name} by ${brand}, ${price}`}>
      <View ref={imageRef} collapsable={false} style={styles.dealFeatureImageWrap}>
        <View style={styles.dealFeatureBadge}><Text style={styles.dealFeatureBadgeText}>{Math.round(rate * 100)}% OFF</Text></View>
        <Image source={{ uri: piece.photo }} style={styles.dealFeatureImage} contentFit="cover" accessible={false} />
        <AccessiblePressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); void app.toggleSaved(piece.id); }} hitSlop={8} style={styles.dealFeatureHeart} accessibilityRole="button" accessibilityLabel={`${saved ? "Remove" : "Save"} ${piece.name}`} accessibilityState={{ selected: saved }}>
          <Ionicons name={saved ? "heart" : "heart-outline"} size={24} color={TODAY_DEALS_RED} />
        </AccessiblePressable>
      </View>
      <View style={styles.dealFeatureMeta}>
        <Text style={styles.dealFeatureName} numberOfLines={1}>{piece.name}</Text>
        <View style={styles.dealFeaturePriceRow}><Text style={styles.dealFeaturePrice}>{price}</Text><Text style={styles.dealFeatureOriginal}>{originalPrice}</Text></View>
      </View>
    </AccessiblePressable>
  </View>;
}

function indexForDeal(id: string) {
  return id.length % 4;
}

function ProductCard({ piece, market, onOpen, deals, compact }: { piece: ClosetPiece; market: ReturnType<typeof getMarket>; onOpen: TodayCommerceFeedProps["onOpenPiece"]; deals?: boolean; compact?: boolean }) {
  const colors = useColors();
  const styles = make(colors);
  const app = useUvel();
  const imageRef = useRef<View>(null);
  const measureImage = (callback: (rect: ListingRect) => void) => {
    imageRef.current?.measureInWindow((x, y, width, height) => callback({ x, y, width, height }));
  };
  const brand = piece.brand && piece.brand !== "Unlabeled" ? piece.brand : "Uvel seller";
  const price = moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market);
  const saved = app.saved.includes(piece.id);
  const dealAccent = TODAY_DEALS_RED;
  return <View style={[styles.productCard, compact && styles.productCardCompact]}><AccessiblePressable onPress={() => measureImage((rect) => onOpen(piece, { ...rect, radii: [14, 14, 0, 0], photo: piece.photo, measure: measureImage }))} style={styles.productPress} accessibilityRole="button" accessibilityLabel={`Open ${piece.name} by ${brand}, ${price}`}>
    <View ref={imageRef} collapsable={false} style={styles.productImageWrap}>{deals ? <View style={[styles.discount, { backgroundColor: TODAY_DEALS_RED }]}><Text style={[styles.discountText, { color: "#FFFFFF" }]}>{["20% off", "15% off", "30% off", "10% off"][piece.id.length % 4]}</Text></View> : null}<Image source={{ uri: piece.photo }} style={styles.productImage} contentFit="cover" accessible={false} /><AccessiblePressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); void app.toggleSaved(piece.id); }} hitSlop={8} style={[styles.productHeart, { backgroundColor: dealAccent }]} accessibilityRole="button" accessibilityLabel={`${saved ? "Remove" : "Save"} ${piece.name}`} accessibilityState={{ selected: saved }}><Ionicons name={saved ? "heart" : "heart-outline"} size={22} color="#FFFFFF" /></AccessiblePressable></View>
    <Text style={styles.productName} numberOfLines={2}>{piece.name}</Text><Text style={styles.productPrice}>{price}</Text><Text style={styles.productBrand} numberOfLines={1}>{brand}</Text>
  </AccessiblePressable></View>;
}

function MiniImage({ piece, onOpen }: { piece: ClosetPiece; onOpen: TodayCommerceFeedProps["onOpenPiece"] }) {
  const ref = useRef<View>(null);
  const measureImage = (callback: (rect: ListingRect) => void) => {
    ref.current?.measureInWindow((x, y, width, height) => callback({ x, y, width, height }));
  };
  return <View ref={ref} collapsable={false} style={{ width: "48%", aspectRatio: 0.92, borderRadius: 13, overflow: "hidden", backgroundColor: "#F6F2ED" }}><AccessiblePressable onPress={(event) => { event.stopPropagation(); measureImage((rect) => onOpen(piece, { ...rect, radius: 13, photo: piece.photo, measure: measureImage })); }} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`Open ${piece.name}`}><Image source={{ uri: piece.photo }} style={{ flex: 1 }} contentFit="cover" accessible={false} /></AccessiblePressable></View>;
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    topColorField: { position: "absolute", top: 0, left: 0, right: 0, height: 760, overflow: "hidden", zIndex: 0 },
    topColorLayer: { position: "absolute", top: 0, left: 0, right: 0, height: 760 },
    topColorFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 230, flexDirection: "column" },
    topColorFadeStrip: { flex: 1, backgroundColor: colors.ink },
    fixedHeader: { minHeight: 62, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "transparent", zIndex: 5, position: "relative" },
    logoCenter: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", zIndex: 10 },
    feedScroll: { flex: 1 },
    pullOrbitLayer: { position: "absolute", left: 0, right: 0, height: 72, alignItems: "center", justifyContent: "center", zIndex: 4 },
    content: { paddingTop: 10, paddingHorizontal: 16, paddingBottom: 130 },
    topBar: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
    wordmarkButton: { minHeight: 48, justifyContent: "center" },
    wordmark: { color: colors.pulse, fontFamily: "Georgia", fontSize: 35, lineHeight: 40, fontStyle: "italic", fontWeight: "700", letterSpacing: -0.8 },
    topIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
    locationButton: { flex: 1, minHeight: 42, marginHorizontal: 4, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 5 },
    locationText: { color: colors.bone, flexShrink: 1, fontSize: 12, fontWeight: "700" },
    locationBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
    locationCard: { width: "100%", maxWidth: 360, borderRadius: 20, padding: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}18`, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    locationTitleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 },
    locationEyebrow: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
    locationTitle: { color: colors.bone, fontSize: 22, fontWeight: "800", marginTop: 3 },
    locationAddress: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: `${colors.bone}16`, marginTop: 8 },
    locationAddressSelected: { borderColor: `${colors.success}99`, backgroundColor: `${colors.success}14` },
    locationAddressName: { color: colors.bone, fontSize: 14, fontWeight: "800" },
    locationAddressText: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
    addLocationButton: { minHeight: 44, marginTop: 12, borderRadius: 22, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
    addLocationText: { color: colors.successInk, fontSize: 14, fontWeight: "800" },
    menuIcon: { width: 22, gap: 4 },
    menuLine: { width: 22, height: 2, borderRadius: 2, backgroundColor: colors.bone },
    search: { height: 52, borderRadius: 27, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}20`, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 9 },
    input: { flex: 1, height: 50, color: colors.bone, fontSize: 17 },
    searchAction: { width: 34, height: 44, alignItems: "center", justifyContent: "center" },
    searchDivider: { height: 27, width: 1, backgroundColor: `${colors.bone}22` },
    featuredRule: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2, marginBottom: 13, paddingHorizontal: 2 },
    ruleLine: { flex: 1, height: 1, backgroundColor: `${colors.bone}30` },
    ruleLabelWrap: { alignItems: "center" },
    ruleEyebrow: { color: colors.pulse, fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 1.5 },
    ruleTitle: { color: colors.bone, fontSize: 14, lineHeight: 18, fontWeight: "800", letterSpacing: -0.1 },
    posterStage: { marginHorizontal: -2, overflow: "visible", backgroundColor: "transparent", paddingVertical: 0 },
    posterAmbient: { position: "absolute", width: 260, height: 260, borderRadius: 130, top: 86, left: 60 },
    posterCard: { borderRadius: 22, overflow: "hidden", padding: 20, justifyContent: "flex-start", marginRight: 12 },
    primaryPoster: { backgroundColor: "#F05237", paddingTop: 18 },
    posterTopline: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginBottom: 7 },
    posterBottom: { position: "absolute", left: 20, right: 20, bottom: 18, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    posterFoot: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
    posterTint: { ...StyleSheet.absoluteFill, opacity: 0.56 },
    posterPhotoTitle: { color: "#FFFFFF", fontSize: 34, lineHeight: 37, fontWeight: "900", maxWidth: 290, zIndex: 2, marginTop: 10 },
    posterPhotoSubtitle: { color: "#FFFFFF", fontSize: 17, lineHeight: 23, marginTop: 11, maxWidth: 290, zIndex: 2 },
    posterFullImage: { ...StyleSheet.absoluteFill, opacity: 0.48 },
    blueColorWash: { ...StyleSheet.absoluteFill, backgroundColor: "#2762C5", opacity: 0.58 },
    blueBlobOne: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#7EA4FF", opacity: 0.22, right: -110, top: 92 },
    blueBlobTwo: { position: "absolute", width: 210, height: 210, borderRadius: 105, backgroundColor: "#C4D5FF", opacity: 0.16, left: -80, bottom: -50 },
    fallCard: { flex: 1.42, borderRadius: 18, padding: 13, minHeight: 308 },
    newCard: { flex: 0.82, borderRadius: 18, minHeight: 308, padding: 16, overflow: "hidden" },
    promoHeader: { flexDirection: "row", justifyContent: "space-between", gap: 4, marginBottom: 12 },
    promoTitle: { color: "#FFFFFF", fontSize: 34, lineHeight: 37, fontWeight: "900", letterSpacing: -0.8, maxWidth: 280 },
    promoSub: { color: "#FFFFFF", fontSize: 16, lineHeight: 21, marginTop: 8, maxWidth: 292 },
    shopAll: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", marginTop: 5 },
    featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
    newTitle: { color: "#FFFFFF", fontSize: 44, lineHeight: 47, fontWeight: "900", letterSpacing: -1, marginTop: 10 },
    newCopy: { color: "#FFFFFF", fontSize: 18, lineHeight: 24, marginTop: 10, maxWidth: 292 },
    whiteButton: { alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 22, paddingHorizontal: 14, minHeight: 40, justifyContent: "center", marginTop: 12 },
    whiteButtonText: { color: "#181714", fontSize: 13, fontWeight: "900" },
    newFoot: { position: "absolute", left: 16, bottom: 13, color: "#FFFFFF", fontSize: 12, lineHeight: 15, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.55)", textShadowRadius: 4 },
    posterButton: { alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 24, paddingHorizontal: 17, minHeight: 46, justifyContent: "center", marginTop: 14 },
    editorialPoster: { flex: 1, borderRadius: 22, overflow: "hidden", padding: 20, position: "relative" },
    editorialReferenceImage: { width: "100%", height: "100%" },
    editorialTitle: { color: "#FFFFFF", fontSize: 34, lineHeight: 36, fontWeight: "900", letterSpacing: -0.9, maxWidth: 230, marginTop: 12, zIndex: 6 },
    editorialSubtitle: { color: "rgba(255,255,255,0.88)", fontSize: 15, lineHeight: 20, maxWidth: 226, marginTop: 9, zIndex: 6 },
    editorialLatestSticker: { position: "absolute", right: 8, top: 8, width: 120, height: 100, zIndex: 7, alignItems: "center", justifyContent: "center" },
    editorialLatestStickerImage: { width: "100%", height: "100%" },
    editorialCutout: { position: "absolute", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 5, zIndex: 2 },
    editorialCutoutImage: { width: "100%", height: "100%" },
    sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10 },
    editorHero: { minHeight: 184, borderRadius: 20, backgroundColor: "#E7DDD1", overflow: "hidden", flexDirection: "row", borderWidth: 1, borderColor: "rgba(255,255,255,0.42)" },
    editorCopy: { flex: 1.02, padding: 17, paddingRight: 8, justifyContent: "center", zIndex: 2 },
    editorTitle: { color: "#181714", fontSize: 24, lineHeight: 25, fontWeight: "900", maxWidth: 166, letterSpacing: -0.55 },
    editorSubtitle: { color: "#181714", fontSize: 15, lineHeight: 19, marginTop: 8 },
    editorButton: { backgroundColor: "#FFFFFF", paddingHorizontal: 14, minHeight: 40, borderRadius: 20, alignSelf: "flex-start", justifyContent: "center", marginTop: 14, shadowColor: "#181714", shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
    editorButtonText: { color: "#181714", fontSize: 12, fontWeight: "900" },
    editorImage: { flex: 0.98, height: "100%" },
    editorTiles: { flexDirection: "row", gap: 9, marginTop: 9 },
    editorTile: { flex: 1, minHeight: 154, borderRadius: 16, overflow: "hidden", padding: 10, justifyContent: "flex-end", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
    editorTileImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%", zIndex: 0 },
    editorTileShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(255,255,255,0.18)", zIndex: 1 },
    editorTileTitle: { color: "#181714", fontSize: 15, lineHeight: 17, fontWeight: "900", zIndex: 2, textShadowColor: "rgba(255,255,255,0.42)", textShadowRadius: 5 },
    editorTileSubtitle: { color: "#181714", fontSize: 11, lineHeight: 14, marginTop: 3, zIndex: 2, maxWidth: 90, textShadowColor: "rgba(255,255,255,0.42)", textShadowRadius: 4 },
    tileArrow: { position: "absolute", right: 9, bottom: 8, color: "#181714", fontSize: 22, fontWeight: "900", zIndex: 3 },
    coralStrip: { minHeight: 82, borderRadius: 16, backgroundColor: "#F05237", paddingHorizontal: 15, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 17 },
    stripTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
    stripSub: { color: "#FFFFFF", fontSize: 12, marginTop: 3 },
    stripButton: { backgroundColor: "#FFFFFF", borderRadius: 20, paddingHorizontal: 12, minHeight: 38, justifyContent: "center" },
    stripButtonText: { color: "#181714", fontSize: 11, fontWeight: "900" },
    dealsFeature: { marginTop: 28, borderRadius: 20, backgroundColor: "#334B38", padding: 16, overflow: "hidden" },
    dealsFeatureHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", minHeight: 126 },
    dealsFeatureCopy: { flex: 1, paddingRight: 8 },
    dealsFeatureTitle: { color: "#FFFFFF", fontSize: 31, lineHeight: 31, fontWeight: "900", letterSpacing: -0.8 },
    dealsFeatureSubtitle: { color: "rgba(255,255,255,0.8)", fontSize: 14, lineHeight: 19, marginTop: 10, maxWidth: 240 },
    dealsFeatureNote: { width: 108, height: 108, alignItems: "center", justifyContent: "center", marginTop: -2 },
    dealsStickerHalo: { position: "absolute", width: 94, height: 94, borderRadius: 47, backgroundColor: "#4FD9E7", opacity: 0.38 },
    dealsStickerImage: { width: 108, height: 108 },
    dealsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    dealFeatureCard: { width: "48.5%", borderRadius: 15, overflow: "hidden", backgroundColor: "#27382C" },
    dealFeaturePress: { paddingBottom: 9 },
    dealFeatureImageWrap: { height: 145, backgroundColor: "#4A594B", position: "relative" },
    dealFeatureImage: { width: "100%", height: "100%" },
    dealFeatureBadge: { position: "absolute", left: 9, top: 9, zIndex: 3, minHeight: 27, borderRadius: 15, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", backgroundColor: TODAY_DEALS_RED },
    dealFeatureBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 0.2 },
    dealFeatureHeart: { position: "absolute", right: 9, top: 8, zIndex: 3, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    dealFeatureMeta: { paddingHorizontal: 10, paddingTop: 9 },
    dealFeatureName: { color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontWeight: "700" },
    dealFeaturePriceRow: { flexDirection: "row", alignItems: "baseline", gap: 9, marginTop: 3 },
    dealFeaturePrice: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
    dealFeatureOriginal: { color: "rgba(255,255,255,0.58)", fontSize: 13, textDecorationLine: "line-through" },
    productCard: { width: 158, backgroundColor: colors.surface, borderRadius: 14, overflow: "hidden", position: "relative", borderWidth: colors.ink === "#FFFFFF" ? StyleSheet.hairlineWidth : 0, borderColor: colors.ink === "#FFFFFF" ? "#D5D9D9" : "transparent" },
    productCardCompact: { width: 148 },
    productPress: { paddingBottom: 10 },
    productImageWrap: { height: 166, backgroundColor: `${colors.bone}12`, position: "relative" },
    productImage: { width: "100%", height: "100%" },
    productHeart: { position: "absolute", right: 8, top: 8, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    discount: { position: "absolute", top: 8, left: 8, zIndex: 2, backgroundColor: colors.success, paddingHorizontal: 7, minHeight: 25, borderRadius: 12, justifyContent: "center" },
    discountText: { color: colors.successInk, fontSize: 10, fontWeight: "900" },
    productName: { color: colors.bone, fontSize: 13, lineHeight: 17, fontWeight: "700", paddingHorizontal: 9, marginTop: 8, minHeight: 34 },
    productPrice: { color: colors.bone, fontSize: 16, fontWeight: "900", paddingHorizontal: 9, marginTop: 4 },
    productBrand: { color: colors.muted, fontSize: 11, paddingHorizontal: 9, marginTop: 3 },
    creatorCard: { minHeight: 170, borderRadius: 18, backgroundColor: "#2865CF", padding: 16, flexDirection: "row", overflow: "hidden", marginTop: 19 },
    creatorCopy: { flex: 1, zIndex: 2 },
    creatorTitle: { color: "#FFFFFF", fontSize: 24, lineHeight: 27, fontWeight: "900" },
    creatorSub: { color: "#FFFFFF", fontSize: 15, marginTop: 7 },
    creatorFaces: { width: 154, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
    creatorFace: { width: 67, height: 67, borderRadius: 34, borderWidth: 3, borderColor: "#FFFFFF", marginLeft: -11 },
    lookGrid: { gap: 10 },
    lookCard: { minHeight: 176, borderRadius: 17, backgroundColor: colors.surface, overflow: "hidden", flexDirection: "row", borderWidth: colors.ink === "#FFFFFF" ? StyleSheet.hairlineWidth : 0, borderColor: colors.ink === "#FFFFFF" ? "#D5D9D9" : "transparent" },
    lookCopy: { flex: 1, padding: 15, justifyContent: "center", zIndex: 2 },
    lookTitle: { color: colors.bone, fontSize: 20, lineHeight: 22, fontWeight: "900" },
    lookBody: { color: colors.muted, fontSize: 12, lineHeight: 16, marginTop: 7 },
    lookButton: { color: colors.link ?? colors.pulse, fontSize: 12, fontWeight: "900", marginTop: 12 },
    lookImage: { width: 150, height: "100%" },
    styleDna: { minHeight: 145, borderRadius: 17, backgroundColor: "#DCCBFA", padding: 16, flexDirection: "row", alignItems: "center", overflow: "hidden" },
    styleDnaCopy: { flex: 1, zIndex: 2 },
    styleDnaTitle: { color: "#181714", fontSize: 22, lineHeight: 24, fontWeight: "900" },
    styleDnaBody: { color: "#514D43", fontSize: 12, lineHeight: 16, marginTop: 7, maxWidth: 250 },
    styleDnaButton: { color: colors.link ?? colors.pulse, fontSize: 12, fontWeight: "900", marginTop: 12 },
    swatches: { width: 88, flexDirection: "row", flexWrap: "wrap", gap: 5, transform: [{ rotate: "7deg" }] },
    swatch: { width: 37, height: 37, borderRadius: 9, borderWidth: 2, borderColor: "#FFFFFF" },
  });
}
