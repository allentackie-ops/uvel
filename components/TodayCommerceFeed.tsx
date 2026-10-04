import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useEffect, useRef, type RefObject } from "react";
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "./AccessiblePressable";
import { OrbitLoader } from "./OrbitLoader";
import type { ClosetPiece } from "../lib/wardrobe";
import type { Colors } from "../lib/theme";
import { useColors } from "../lib/theme";
import { getMarket, moneyInMarket } from "../lib/markets";
import { useUvel } from "../lib/store";

const COLOR_CHIPS = [
  { label: "Today", color: "#2A320E", text: "#FFFFFF" },
  { label: "Looks", color: "#F58D91", text: "#181714" },
  { label: "Creators", color: "#CDB9F4", text: "#181714" },
  { label: "Brands", color: "#C7EA67", text: "#181714" },
  { label: "Deals", color: "#2768D8", text: "#FFFFFF" },
  { label: "New", color: "#F28A4B", text: "#181714" },
];

const EDITORIAL = [
  { title: "City layers", subtitle: "Effortless polish", accent: "#D8C4AE" },
  { title: "Off-duty looks", subtitle: "Easy & elevated", accent: "#D7DDE4" },
  { title: "Knit now", subtitle: "Layers you’ll live in", accent: "#E6D5C6" },
];

const STYLE_LOOKS = [
  { title: "Modern Minimalist", copy: "Clean staples for everyday elevated looks." },
  { title: "City Layering", copy: "Versatile pieces for wherever the day goes." },
];

const BANNER_COLORS = ["#F05237", "#2762C5", "#A5B98A", "#20A79A", "#F4A73B", "#8D74D6", "#E96B91", "#5F8D56"];

export type TodayCommerceFeedProps = {
  pieces: ClosetPiece[];
  query: string;
  onQueryChange: (value: string) => void;
  onOpenPiece: (piece: ClosetPiece, origin: { x: number; y: number; width: number; height: number }) => void;
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
  const posterScrollX = useRef(new Animated.Value(0)).current;
  const posterWidth = Math.min(352, Dimensions.get("window").width - 48);
  const posterInterval = posterWidth + 12;
  const feedPieces = pieces.length
    ? Array.from({ length: Math.max(32, pieces.length * 3) }, (_, index) => pieces[index % pieces.length])
    : [];
  const featured = feedPieces.slice(0, 4);
  const recommended = feedPieces.slice(0, 8);
  const editors = feedPieces.slice(2, 6).length >= 3 ? feedPieces.slice(2, 6) : feedPieces.slice(0, 4);
  const deals = feedPieces.slice(8, 12).length >= 3 ? feedPieces.slice(8, 12) : feedPieces.slice(0, 4);
  const followed = feedPieces.slice(12, 16).length >= 3 ? feedPieces.slice(12, 16) : feedPieces.slice(0, 4);
  const personalized = feedPieces.slice(16, 24).length >= 4 ? feedPieces.slice(16, 24) : feedPieces.slice(0, 8);
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
      <View pointerEvents="none" style={styles.topColorField}>
        {BANNER_COLORS.map((color, index) => {
          const inputRange = index === 0 ? [0, posterInterval] : [(index - 1) * posterInterval, index * posterInterval, (index + 1) * posterInterval];
          const outputRange = index === 0 ? [0.64, 0] : [0, 0.64, 0];
          const horizontalOpacity = posterScrollX.interpolate({ inputRange, outputRange, extrapolate: "clamp" });
          return <Animated.View key={color} style={[styles.topColorLayer, { backgroundColor: color, opacity: Animated.multiply(horizontalOpacity, topColorFade) }]} />;
        })}
      </View>
      <View style={[styles.fixedHeader, { height: insets.top + 62, paddingTop: insets.top }]}>
        <AccessiblePressable onPress={onOpenTools} style={styles.topIcon} accessibilityRole="button" accessibilityLabel="Open Today tools">
          <View style={styles.menuIcon}><View style={styles.menuLine} /><View style={styles.menuLine} /><View style={styles.menuLine} /></View>
        </AccessiblePressable>
        <Animated.View pointerEvents="box-none" style={[styles.logoCenter, logoMotion, { top: insets.top, bottom: 0 }]}><AccessiblePressable onPress={onOpenCountries} style={styles.wordmarkButton} accessibilityRole="button" accessibilityLabel="Choose your Uvel country store"><Text style={styles.wordmark}>Uvel</Text></AccessiblePressable></Animated.View>
        <View style={styles.headerActions}><AccessiblePressable onPress={onOpenSearch} style={styles.topIcon} accessibilityRole="button" accessibilityLabel="Search Uvel"><Ionicons name="search-outline" size={24} color={colors.bone} /></AccessiblePressable><AccessiblePressable onPress={onOpenMessages} style={styles.topIcon} accessibilityRole="button" accessibilityLabel="Open messages"><Ionicons name="chatbubble-ellipses-outline" size={23} color={colors.bone} /></AccessiblePressable></View>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {COLOR_CHIPS.map((chip, index) => (
          <Pressable key={chip.label} onPress={() => index === 1 ? onOpenStyle() : undefined} style={[styles.chip, { backgroundColor: chip.color }]} accessibilityRole="button" accessibilityLabel={chip.label}>
            <Text style={[styles.chipText, { color: chip.text }]}>{chip.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <PosterCarousel featured={featured} onOpenPiece={onOpenPiece} onOpenSearch={onOpenSearch} styles={styles} scrollX={posterScrollX} posterWidth={posterWidth} posterInterval={posterInterval} />

      <SectionTitle title="For you" onPress={onOpenSearch} />
      <ProductRail pieces={recommended.slice(0, 4)} market={market} onOpen={onOpenPiece} deals />

      <SectionTitle title="Keep shopping for" onPress={onOpenSearch} />
      <ProductRail pieces={recommended.slice(4, 8).length ? recommended.slice(4, 8) : recommended.slice(0, 4)} market={market} onOpen={onOpenPiece} compact />

      <SectionTitle title="Editor’s picks for you" onPress={onOpenSearch} />
      <View style={styles.editorHero}>
        <View style={styles.editorCopy}>
          <Text style={styles.editorTitle}>The art of everyday</Text>
          <Text style={styles.editorSubtitle}>Modern looks for real life.</Text>
          <Pressable onPress={onOpenSearch} style={styles.editorButton} accessibilityRole="button" accessibilityLabel="Shop the editor story"><Text style={styles.editorButtonText}>Shop the story ›</Text></Pressable>
        </View>
        {editors[0] ? <Image source={{ uri: editors[0].photo }} style={styles.editorImage} contentFit="cover" accessible={false} /> : null}
      </View>
      <View style={styles.editorTiles}>
        {EDITORIAL.map((item, index) => <Pressable key={item.title} onPress={onOpenSearch} style={[styles.editorTile, { backgroundColor: item.accent }]} accessibilityRole="button" accessibilityLabel={item.title}>
          {editors[index + 1] ? <Image source={{ uri: editors[index + 1].photo }} style={styles.editorTileImage} contentFit="cover" accessible={false} /> : null}
          <Text style={styles.editorTileTitle}>{item.title}</Text><Text style={styles.editorTileSubtitle}>{item.subtitle}</Text><Text style={styles.tileArrow}>›</Text>
        </Pressable>)}
      </View>

      <SectionTitle title="Trending in your world" onPress={onOpenSearch} />
      <ProductRail pieces={editors} market={market} onOpen={onOpenPiece} />
      <View style={styles.coralStrip}>
        <View><Text style={styles.stripTitle}>Build your weekend uniform</Text><Text style={styles.stripSub}>Versatile pieces. More good days.</Text></View>
        <Pressable onPress={onOpenSearch} style={styles.stripButton} accessibilityRole="button" accessibilityLabel="Shop the weekend edit"><Text style={styles.stripButtonText}>Shop the edit ›</Text></Pressable>
      </View>

      <SectionTitle title="Deals worth opening" onPress={onOpenSearch} />
      <ProductRail pieces={deals} market={market} onOpen={onOpenPiece} deals />
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
        <View style={styles.styleDnaCopy}><Text style={styles.styleDnaTitle}>Your Style DNA{`\n`}is getting clearer</Text><Text style={styles.styleDnaBody}>You gravitate toward classic shapes, neutral tones and modern layers.</Text><Text style={styles.lookButton}>See your style ›</Text></View>
        <View style={styles.swatches}>{["#EEEAE2", "#AF9782", "#5B4637", "#586247"].map((color) => <View key={color} style={[styles.swatch, { backgroundColor: color }]} />)}</View>
      </Pressable>

      <SectionTitle title="Recently viewed" onPress={onOpenSearch} />
      <ProductRail pieces={personalized.slice(4, 8).length ? personalized.slice(4, 8) : personalized.slice(0, 4)} market={market} onOpen={onOpenPiece} compact />
      </Animated.ScrollView>
      {refreshing ? <View pointerEvents="none" style={[styles.pullOrbitLayer, { top: insets.top + 62 }]}><OrbitLoader size={58} /></View> : null}
    </View>
  );
}

function PosterCarousel({
  featured,
  onOpenPiece,
  onOpenSearch,
  styles,
  scrollX,
  posterWidth,
  posterInterval,
}: {
  featured: ClosetPiece[];
  onOpenPiece: TodayCommerceFeedProps["onOpenPiece"];
  onOpenSearch: () => void;
  styles: ReturnType<typeof make>;
  scrollX: Animated.Value;
  posterWidth: number;
  posterInterval: number;
}) {
  const interval = posterInterval;
  const posterHeight = Math.round(Math.min(470, Math.max(390, posterWidth * 1.24)));
  const primaryRef = useRef<View>(null);
  const newRef = useRef<View>(null);
  const openBanner = (ref: RefObject<View | null>, piece?: ClosetPiece) => {
    if (!piece) {
      onOpenSearch();
      return;
    }
    ref.current?.measureInWindow((x, y, width, height) => onOpenPiece(piece, { x, y, width, height }));
  };
  return (
    <View style={styles.posterStage}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: 0 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
      >
        <Pressable ref={primaryRef} onPress={() => openBanner(primaryRef, featured[0])} style={[styles.posterCard, styles.primaryPoster, { width: posterWidth, height: posterHeight }]} accessibilityRole="button" accessibilityLabel="Open the Fall Edit">
          <View style={styles.posterTopline}><Text style={styles.shopAll}>Shop all ›</Text></View>
          <Text style={styles.promoTitle}>The Fall Edit</Text>
          <Text style={styles.promoSub}>Fresh layers, easy pieces, and the details that make a look feel finished.</Text>
          <View style={styles.featureGrid}>
            {featured.slice(0, 4).map((piece, index) => <MiniImage key={`${piece.id}-${index}`} piece={piece} onOpen={onOpenPiece} />)}
          </View>
          <View style={styles.posterBottom}><Text style={styles.posterFoot}>Layers for the everyday</Text></View>
        </Pressable>
        <Pressable ref={newRef} onPress={() => openBanner(newRef, featured[1] || featured[0])} style={[styles.posterCard, { width: posterWidth, height: posterHeight, backgroundColor: "#2762C5" }]} accessibilityRole="button" accessibilityLabel="Open new arrivals">
          {featured[0] ? <Image source={{ uri: featured[0].photo }} style={styles.posterFullImage} contentFit="cover" accessible={false} /> : null}
          <View pointerEvents="none" style={styles.blueColorWash} />
          <View pointerEvents="none" style={styles.blueBlobOne} />
          <View pointerEvents="none" style={styles.blueBlobTwo} />
          <Text style={styles.newTitle}>New in</Text>
          <Text style={styles.newCopy}>Your next favorite fit is here. Discover pieces with a point of view.</Text>
          <View style={styles.posterButton}><Text style={styles.whiteButtonText}>Shop now ›</Text></View>
          <View style={styles.posterBottom}><Text style={styles.newFoot}>New season{`\n`}New you</Text></View>
        </Pressable>
        <PosterPhotoCard title="Early Prime Big Deals" subtitle="Premium pieces, better prices" color="#A5B98A" image={featured[2]?.photo || featured[0]?.photo} styles={styles} width={posterWidth} height={posterHeight} piece={featured[2] || featured[0]} onOpenPiece={onOpenPiece} onOpenSearch={onOpenSearch} />
        <PosterPhotoCard title="Focus on your health" subtitle="Movement-ready layers" color="#20A79A" image={featured[3]?.photo || featured[0]?.photo} styles={styles} width={posterWidth} height={posterHeight} piece={featured[3] || featured[0]} onOpenPiece={onOpenPiece} onOpenSearch={onOpenSearch} />
        <PosterPhotoCard title="Weekend escape" subtitle="Color for wherever you go" color="#F4A73B" image={featured[0]?.photo} styles={styles} width={posterWidth} height={posterHeight} piece={featured[0]} onOpenPiece={onOpenPiece} onOpenSearch={onOpenSearch} />
        <PosterPhotoCard title="The color edit" subtitle="A little more joy, every day" color="#8D74D6" image={featured[1]?.photo || featured[0]?.photo} styles={styles} width={posterWidth} height={posterHeight} piece={featured[1] || featured[0]} onOpenPiece={onOpenPiece} onOpenSearch={onOpenSearch} />
        <PosterPhotoCard title="Soft power" subtitle="Easy pieces with presence" color="#E96B91" image={featured[2]?.photo || featured[0]?.photo} styles={styles} width={posterWidth} height={posterHeight} piece={featured[2] || featured[0]} onOpenPiece={onOpenPiece} onOpenSearch={onOpenSearch} />
        <PosterPhotoCard title="Grounded layers" subtitle="The calm edit" color="#5F8D56" image={featured[3]?.photo || featured[0]?.photo} styles={styles} width={posterWidth} height={posterHeight} piece={featured[3] || featured[0]} onOpenPiece={onOpenPiece} onOpenSearch={onOpenSearch} />
      </Animated.ScrollView>
    </View>
  );
}
function PosterPhotoCard({ title, subtitle, color, image, styles, width, height, piece, onOpenPiece, onOpenSearch }: { title: string; subtitle: string; color: string; image?: string; styles: ReturnType<typeof make>; width: number; height: number; piece?: ClosetPiece; onOpenPiece: TodayCommerceFeedProps["onOpenPiece"]; onOpenSearch: () => void }) {
  const ref = useRef<View>(null);
  const openBanner = () => {
    if (!piece) {
      onOpenSearch();
      return;
    }
    ref.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => onOpenPiece(piece, { x, y, width: measuredWidth, height: measuredHeight }));
  };
  return <Pressable ref={ref} onPress={openBanner} style={[styles.posterCard, { width, height, backgroundColor: color }]} accessibilityRole="button" accessibilityLabel={`Open ${title}`}>
    {image ? <Image source={{ uri: image }} style={styles.posterFullImage} contentFit="cover" accessible={false} /> : null}
    <View pointerEvents="none" style={[styles.posterTint, { backgroundColor: color }]} />
    <Text style={styles.posterPhotoTitle}>{title}</Text>
    <Text style={styles.posterPhotoSubtitle}>{subtitle}</Text>
    <View style={styles.posterButton}><Text style={styles.whiteButtonText}>Shop now ›</Text></View>
  </Pressable>;
}

function SectionTitle({ title, onPress }: { title: string; onPress: () => void }) {
  const colors = useColors();
  return <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 28, marginBottom: 11, paddingBottom: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}35` }}><Text style={{ color: colors.bone, fontSize: 21, fontWeight: "800", letterSpacing: -0.3 }}>{title}</Text><Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={`See all ${title}`}><Text style={{ color: colors.pulse, fontSize: 13, fontWeight: "800", paddingBottom: 2 }}>See all ›</Text></Pressable></View>;
}

function ProductRail({ pieces, market, onOpen, deals, compact }: { pieces: ClosetPiece[]; market: ReturnType<typeof getMarket>; onOpen: TodayCommerceFeedProps["onOpenPiece"]; deals?: boolean; compact?: boolean }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 3 }}>{pieces.map((piece, index) => <ProductCard key={`${piece.id}-${index}`} piece={piece} market={market} onOpen={onOpen} deals={deals} compact={compact} />)}</ScrollView>;
}

function ProductCard({ piece, market, onOpen, deals, compact }: { piece: ClosetPiece; market: ReturnType<typeof getMarket>; onOpen: TodayCommerceFeedProps["onOpenPiece"]; deals?: boolean; compact?: boolean }) {
  const colors = useColors();
  const styles = make(colors);
  const app = useUvel();
  const ref = useRef<View>(null);
  const brand = piece.brand && piece.brand !== "Unlabeled" ? piece.brand : "Uvel seller";
  const price = moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market);
  const saved = app.saved.includes(piece.id);
  return <View ref={ref} collapsable={false} style={[styles.productCard, compact && styles.productCardCompact]}><AccessiblePressable onPress={() => ref.current?.measureInWindow((x, y, width, height) => onOpen(piece, { x, y, width, height }))} style={styles.productPress} accessibilityRole="button" accessibilityLabel={`Open ${piece.name} by ${brand}, ${price}`}>
    <View style={styles.productImageWrap}>{deals ? <View style={styles.discount}><Text style={styles.discountText}>{["20% off", "15% off", "30% off", "10% off"][piece.id.length % 4]}</Text></View> : null}<Image source={{ uri: piece.photo }} style={styles.productImage} contentFit="cover" accessible={false} /><AccessiblePressable onPress={() => void app.toggleSaved(piece.id)} hitSlop={8} style={styles.productHeart} accessibilityRole="button" accessibilityLabel={`${saved ? "Remove" : "Save"} ${piece.name}`} accessibilityState={{ selected: saved }}><Ionicons name={saved ? "heart" : "heart-outline"} size={24} color={saved ? colors.pulse : colors.bone} /></AccessiblePressable></View>
    <Text style={styles.productName} numberOfLines={2}>{piece.name}</Text><Text style={styles.productPrice}>{price}</Text><Text style={styles.productBrand} numberOfLines={1}>{brand}</Text>
  </AccessiblePressable></View>;
}

function MiniImage({ piece, onOpen }: { piece: ClosetPiece; onOpen: TodayCommerceFeedProps["onOpenPiece"] }) {
  const ref = useRef<View>(null);
  return <View ref={ref} collapsable={false} style={{ width: "48%", aspectRatio: 0.92, borderRadius: 13, overflow: "hidden", backgroundColor: "#F6F2ED" }}><AccessiblePressable onPress={() => ref.current?.measureInWindow((x, y, width, height) => onOpen(piece, { x, y, width, height }))} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`Open ${piece.name}`}><Image source={{ uri: piece.photo }} style={{ flex: 1 }} contentFit="cover" accessible={false} /></AccessiblePressable></View>;
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    topColorField: { position: "absolute", top: 0, left: 0, right: 0, height: 520, overflow: "hidden", zIndex: 0 },
    topColorLayer: { position: "absolute", top: 0, left: 0, right: 0, height: 520 },
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
    menuIcon: { width: 22, gap: 4 },
    menuLine: { width: 22, height: 2, borderRadius: 2, backgroundColor: colors.bone },
    search: { height: 52, borderRadius: 27, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}20`, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 9 },
    input: { flex: 1, height: 50, color: colors.bone, fontSize: 17 },
    searchAction: { width: 34, height: 44, alignItems: "center", justifyContent: "center" },
    searchDivider: { height: 27, width: 1, backgroundColor: `${colors.bone}22` },
    chips: { gap: 9, paddingVertical: 14 },
    chip: { height: 44, paddingHorizontal: 19, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    chipText: { fontSize: 15, fontWeight: "800" },
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
    sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10 },
    editorHero: { minHeight: 168, borderRadius: 18, backgroundColor: "#E7DDD1", overflow: "hidden", flexDirection: "row" },
    editorCopy: { flex: 1.03, padding: 17, justifyContent: "center", zIndex: 2 },
    editorTitle: { color: "#181714", fontSize: 25, lineHeight: 27, fontWeight: "900", maxWidth: 170 },
    editorSubtitle: { color: "#181714", fontSize: 15, marginTop: 8 },
    editorButton: { backgroundColor: "#FFFFFF", paddingHorizontal: 14, minHeight: 38, borderRadius: 20, alignSelf: "flex-start", justifyContent: "center", marginTop: 13 },
    editorButtonText: { color: "#181714", fontSize: 12, fontWeight: "900" },
    editorImage: { flex: 0.97, height: "100%" },
    editorTiles: { flexDirection: "row", gap: 9, marginTop: 9 },
    editorTile: { flex: 1, minHeight: 145, borderRadius: 15, overflow: "hidden", padding: 9, justifyContent: "flex-end" },
    editorTileImage: { ...StyleSheet.absoluteFill, opacity: 0.68 },
    editorTileTitle: { color: "#181714", fontSize: 15, fontWeight: "900", zIndex: 2 },
    editorTileSubtitle: { color: "#181714", fontSize: 11, marginTop: 3, zIndex: 2 },
    tileArrow: { position: "absolute", right: 9, bottom: 8, color: "#181714", fontSize: 22, fontWeight: "900" },
    coralStrip: { minHeight: 82, borderRadius: 16, backgroundColor: "#F05237", paddingHorizontal: 15, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 17 },
    stripTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
    stripSub: { color: "#FFFFFF", fontSize: 12, marginTop: 3 },
    stripButton: { backgroundColor: "#FFFFFF", borderRadius: 20, paddingHorizontal: 12, minHeight: 38, justifyContent: "center" },
    stripButtonText: { color: "#181714", fontSize: 11, fontWeight: "900" },
    productCard: { width: 158, backgroundColor: colors.surface, borderRadius: 14, overflow: "hidden", position: "relative" },
    productCardCompact: { width: 148 },
    productPress: { paddingBottom: 10 },
    productImageWrap: { height: 166, backgroundColor: `${colors.bone}12`, position: "relative" },
    productImage: { width: "100%", height: "100%" },
    productHeart: { position: "absolute", right: 8, top: 8, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4 },
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
    lookCard: { minHeight: 176, borderRadius: 17, backgroundColor: colors.surface, overflow: "hidden", flexDirection: "row" },
    lookCopy: { flex: 1, padding: 15, justifyContent: "center", zIndex: 2 },
    lookTitle: { color: colors.bone, fontSize: 20, lineHeight: 22, fontWeight: "900" },
    lookBody: { color: colors.muted, fontSize: 12, lineHeight: 16, marginTop: 7 },
    lookButton: { color: colors.pulse, fontSize: 12, fontWeight: "900", marginTop: 12 },
    lookImage: { width: 150, height: "100%" },
    styleDna: { minHeight: 145, borderRadius: 17, backgroundColor: "#DCCBFA", padding: 16, flexDirection: "row", alignItems: "center", overflow: "hidden" },
    styleDnaCopy: { flex: 1, zIndex: 2 },
    styleDnaTitle: { color: "#181714", fontSize: 22, lineHeight: 24, fontWeight: "900" },
    styleDnaBody: { color: "#514D43", fontSize: 12, lineHeight: 16, marginTop: 7, maxWidth: 250 },
    swatches: { width: 88, flexDirection: "row", flexWrap: "wrap", gap: 5, transform: [{ rotate: "7deg" }] },
    swatch: { width: 37, height: 37, borderRadius: 9, borderWidth: 2, borderColor: "#FFFFFF" },
  });
}
