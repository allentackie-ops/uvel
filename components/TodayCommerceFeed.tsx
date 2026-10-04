import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "./AccessiblePressable";
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

export type TodayCommerceFeedProps = {
  pieces: ClosetPiece[];
  query: string;
  onQueryChange: (value: string) => void;
  onOpenPiece: (piece: ClosetPiece, origin: { x: number; y: number; width: number; height: number }) => void;
  onOpenSearch: () => void;
  onOpenMessages: () => void;
  onOpenTools: () => void;
  onOpenCreators: () => void;
  onOpenStyle: () => void;
};

export function TodayCommerceFeed({
  pieces,
  query,
  onQueryChange,
  onOpenPiece,
  onOpenSearch,
  onOpenMessages,
  onOpenTools,
  onOpenCreators,
  onOpenStyle,
}: TodayCommerceFeedProps) {
  const colors = useColors();
  const styles = make(colors);
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const market = getMarket(app.country);
  const scrollY = useRef(new Animated.Value(0)).current;
  const feedPieces = pieces.length
    ? Array.from({ length: Math.max(32, pieces.length * 3) }, (_, index) => pieces[index % pieces.length])
    : [];
  const featured = feedPieces.slice(0, 4);
  const recommended = feedPieces.slice(0, 8);
  const editors = feedPieces.slice(2, 6).length >= 3 ? feedPieces.slice(2, 6) : feedPieces.slice(0, 4);
  const deals = feedPieces.slice(8, 12).length >= 3 ? feedPieces.slice(8, 12) : feedPieces.slice(0, 4);
  const followed = feedPieces.slice(12, 16).length >= 3 ? feedPieces.slice(12, 16) : feedPieces.slice(0, 4);
  const personalized = feedPieces.slice(16, 24).length >= 4 ? feedPieces.slice(16, 24) : feedPieces.slice(0, 8);
  const logoMotion = {
    opacity: scrollY.interpolate({ inputRange: [0, 80], outputRange: [1, 0.86], extrapolate: "clamp" }),
    transform: [
      { translateY: scrollY.interpolate({ inputRange: [0, 80], outputRange: [0, -5], extrapolate: "clamp" }) },
      { scale: scrollY.interpolate({ inputRange: [0, 80], outputRange: [1, 0.9], extrapolate: "clamp" }) },
    ],
  };

  return (
    <Animated.ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
    >
      <View style={styles.topBar}>
        <AccessiblePressable onPress={onOpenTools} style={styles.topIcon} accessibilityRole="button" accessibilityLabel="Open Today tools">
          <View style={styles.menuIcon}><View style={styles.menuLine} /><View style={styles.menuLine} /><View style={styles.menuLine} /></View>
        </AccessiblePressable>
        <Animated.View style={logoMotion}><AccessiblePressable onPress={onOpenSearch} style={styles.wordmarkButton} accessibilityRole="button" accessibilityLabel="Open Uvel marketplace"><Text style={styles.wordmark}>uvel</Text></AccessiblePressable></Animated.View>
        <View style={styles.headerActions}><AccessiblePressable onPress={onOpenSearch} style={styles.topIcon} accessibilityRole="button" accessibilityLabel="Search Uvel"><Ionicons name="search-outline" size={24} color={colors.bone} /></AccessiblePressable><AccessiblePressable onPress={onOpenMessages} style={styles.topIcon} accessibilityRole="button" accessibilityLabel="Open messages"><Ionicons name="chatbubble-ellipses-outline" size={23} color={colors.bone} /></AccessiblePressable></View>
      </View>

      <View style={styles.searchHint}><Text style={styles.searchHintText}>Tap search to find a look, piece, or creator</Text><Pressable onPress={onOpenSearch} accessibilityRole="button" accessibilityLabel="Search Uvel"><Ionicons name="arrow-forward" size={15} color={colors.pulse} /></Pressable></View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {COLOR_CHIPS.map((chip, index) => (
          <Pressable key={chip.label} onPress={() => index === 1 ? onOpenStyle() : undefined} style={[styles.chip, { backgroundColor: chip.color }]} accessibilityRole="button" accessibilityLabel={chip.label}>
            <Text style={[styles.chipText, { color: chip.text }]}>{chip.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.heroRow}>
        <View style={[styles.fallCard, { backgroundColor: "#F05237" }]}>
          <View style={styles.promoHeader}>
            <View>
              <Text style={styles.promoTitle}>The Fall Edit</Text>
              <Text style={styles.promoSub}>Fresh layers, easy pieces</Text>
            </View>
            <Text style={styles.shopAll}>Shop all ›</Text>
          </View>
          <View style={styles.featureGrid}>
            {featured.map((piece, index) => <MiniImage key={`${piece.id}-${index}`} piece={piece} onOpen={onOpenPiece} />)}
          </View>
        </View>
        <View style={[styles.newCard, { backgroundColor: "#2762C5" }]}>
          <Text style={styles.newTitle}>New in</Text>
          <Text style={styles.newCopy}>Your next favorite fit is here.</Text>
          <Pressable onPress={onOpenSearch} style={styles.whiteButton} accessibilityRole="button" accessibilityLabel="Shop new arrivals"><Text style={styles.whiteButtonText}>Shop now ›</Text></Pressable>
          {pieces[0] ? <Image source={{ uri: pieces[0].photo }} style={styles.newImage} contentFit="cover" accessible={false} /> : null}
          <View style={styles.newImageShade} pointerEvents="none" />
          <Text style={styles.newFoot}>New season{`\n`}New you</Text>
        </View>
      </View>

      <SectionTitle title="Recommended for you" onPress={onOpenSearch} />
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
  );
}

function SectionTitle({ title, onPress }: { title: string; onPress: () => void }) {
  const colors = useColors();
  return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10 }}><Text style={{ color: colors.bone, fontSize: 21, fontWeight: "800", letterSpacing: -0.3 }}>{title}</Text><Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={`See all ${title}`}><Text style={{ color: colors.pulse, fontSize: 14, fontWeight: "800" }}>See all ›</Text></Pressable></View>;
}

function ProductRail({ pieces, market, onOpen, deals, compact }: { pieces: ClosetPiece[]; market: ReturnType<typeof getMarket>; onOpen: TodayCommerceFeedProps["onOpenPiece"]; deals?: boolean; compact?: boolean }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 3 }}>{pieces.map((piece, index) => <ProductCard key={`${piece.id}-${index}`} piece={piece} market={market} onOpen={onOpen} deals={deals} compact={compact} />)}</ScrollView>;
}

function ProductCard({ piece, market, onOpen, deals, compact }: { piece: ClosetPiece; market: ReturnType<typeof getMarket>; onOpen: TodayCommerceFeedProps["onOpenPiece"]; deals?: boolean; compact?: boolean }) {
  const colors = useColors();
  const styles = make(colors);
  const ref = useRef<View>(null);
  const brand = piece.brand && piece.brand !== "Unlabeled" ? piece.brand : "Uvel seller";
  const price = moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market);
  return <View ref={ref} collapsable={false} style={[styles.productCard, compact && styles.productCardCompact]}><AccessiblePressable onPress={() => ref.current?.measureInWindow((x, y, width, height) => onOpen(piece, { x, y, width, height }))} style={styles.productPress} accessibilityRole="button" accessibilityLabel={`Open ${piece.name} by ${brand}, ${price}`}>
    <View style={styles.productImageWrap}>{deals ? <View style={styles.discount}><Text style={styles.discountText}>{["20% off", "15% off", "30% off", "10% off"][piece.id.length % 4]}</Text></View> : null}<Image source={{ uri: piece.photo }} style={styles.productImage} contentFit="cover" accessible={false} /><Ionicons name="heart-outline" size={22} color={colors.bone} style={styles.productHeart} /></View>
    <Text style={styles.productName} numberOfLines={2}>{piece.name}</Text><Text style={styles.productPrice}>{price}</Text><Text style={styles.productBrand} numberOfLines={1}>{brand}</Text><Pressable onPress={() => undefined} style={styles.savePill} accessibilityRole="button" accessibilityLabel={`Save ${piece.name}`}><Text style={styles.saveText}>Save</Text></Pressable>
  </AccessiblePressable></View>;
}

function MiniImage({ piece, onOpen }: { piece: ClosetPiece; onOpen: TodayCommerceFeedProps["onOpenPiece"] }) {
  const ref = useRef<View>(null);
  return <View ref={ref} collapsable={false} style={{ width: "48%", aspectRatio: 1.22, borderRadius: 13, overflow: "hidden", backgroundColor: "#F6F2ED" }}><AccessiblePressable onPress={() => ref.current?.measureInWindow((x, y, width, height) => onOpen(piece, { x, y, width, height }))} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`Open ${piece.name}`}><Image source={{ uri: piece.photo }} style={{ flex: 1 }} contentFit="cover" accessible={false} /></AccessiblePressable></View>;
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingTop: 10, paddingHorizontal: 16, paddingBottom: 130 },
    topBar: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
    wordmarkButton: { minHeight: 48, justifyContent: "center" },
    wordmark: { color: colors.pulse, fontFamily: "Georgia", fontSize: 39, lineHeight: 42, fontStyle: "italic", fontWeight: "800", letterSpacing: -1.8 },
    topIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
    menuIcon: { width: 22, gap: 4 },
    menuLine: { width: 22, height: 2, borderRadius: 2, backgroundColor: colors.bone },
    search: { height: 52, borderRadius: 27, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}20`, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 9 },
    input: { flex: 1, height: 50, color: colors.bone, fontSize: 17 },
    searchAction: { width: 34, height: 44, alignItems: "center", justifyContent: "center" },
    searchDivider: { height: 27, width: 1, backgroundColor: `${colors.bone}22` },
    searchHint: { minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    searchHintText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
    chips: { gap: 9, paddingVertical: 14 },
    chip: { height: 44, paddingHorizontal: 19, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    chipText: { fontSize: 15, fontWeight: "800" },
    heroRow: { flexDirection: "row", gap: 10 },
    fallCard: { flex: 1.42, borderRadius: 18, padding: 13, minHeight: 308 },
    newCard: { flex: 0.82, borderRadius: 18, minHeight: 308, padding: 16, overflow: "hidden" },
    promoHeader: { flexDirection: "row", justifyContent: "space-between", gap: 4, marginBottom: 12 },
    promoTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
    promoSub: { color: "#FFFFFF", fontSize: 13, marginTop: 2 },
    shopAll: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", marginTop: 4 },
    featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    newTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" },
    newCopy: { color: "#FFFFFF", fontSize: 16, lineHeight: 21, marginTop: 8, maxWidth: 130 },
    whiteButton: { alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 22, paddingHorizontal: 14, minHeight: 40, justifyContent: "center", marginTop: 12 },
    whiteButtonText: { color: "#181714", fontSize: 13, fontWeight: "900" },
    newImage: { position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 166, opacity: 0.96 },
    newImageShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 105, backgroundColor: "rgba(22,20,15,0.18)" },
    newFoot: { position: "absolute", left: 16, bottom: 13, color: "#FFFFFF", fontSize: 12, lineHeight: 15, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.55)", textShadowRadius: 4 },
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
    savePill: { position: "absolute", right: 8, bottom: 9, backgroundColor: colors.success, borderRadius: 14, paddingHorizontal: 9, minHeight: 27, justifyContent: "center" },
    saveText: { color: colors.successInk, fontSize: 10, fontWeight: "900" },
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
