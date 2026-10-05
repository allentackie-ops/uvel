import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OrbitLoader } from "./OrbitLoader";
import type { ClosetPiece } from "../lib/wardrobe";
import { todayProductImage } from "../lib/todayProductImage";
import { getMarket, moneyInMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";

const NEW_IN_POSTER = require("../assets/today/new-in-option3-collage.png");
const TRENDING_POSTER = require("../assets/today/trending-now-final.png");
const ACCESSORIES_POSTER = require("../assets/today/finishing-pieces-poster-03-pop-magazine.png");
const QUIET_POSTER = require("../assets/today/minimal-with-presence-banner-mockup-v8.png");
const DEALS_VIDEO = require("../assets/today/deals-fun-motion-banner-clean.mp4");

export type BannerStoryOrigin = { x: number; y: number; width: number; height: number };
export type BannerStory = {
  title: string;
  subtitle: string;
  color: string;
  eyebrow?: string;
  footer?: string;
  pieces: ClosetPiece[];
  detailPieces?: ClosetPiece[];
};

type Media = { kind: "image" | "video"; source: number };

function mediaFor(story: BannerStory): Media | null {
  if (story.title === "Early Prime Big Deals") return { kind: "video", source: DEALS_VIDEO };
  if (story.title === "New in") return { kind: "image", source: NEW_IN_POSTER };
  if (story.title === "Trending Now") return { kind: "image", source: TRENDING_POSTER };
  if (story.title === "The finishing pieces") return { kind: "image", source: ACCESSORIES_POSTER };
  if (story.title === "Minimal, with presence") return { kind: "image", source: QUIET_POSTER };
  return null;
}

export function TodayBannerStoryOverlay({ story, onClose, onOpenPiece }: { story: BannerStory; origin: BannerStoryOrigin; onClose: () => void; onOpenPiece: (piece: ClosetPiece, origin: BannerStoryOrigin) => void }) {
  const colors = useColors();
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState("Fashion");
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;
  const media = mediaFor(story);
  const market = getMarket(app.country);
  const pieces = story.detailPieces?.length ? story.detailPieces : story.pieces;
  const departments = [
    ["Fashion", "shirt-outline"],
    ["Beauty", "sparkles-outline"],
    ["Home & kitchen", "home-outline"],
    ["Accessories", "watch-outline"],
  ] as const;
  const sections = useMemo(() => [
    { title: story.title === "New in" ? "Shop fall styles" : story.title, items: pieces.slice(0, 8) },
    { title: "New from Uvel sellers", items: pieces.slice(8, 16).length ? pieces.slice(8, 16) : pieces.slice(0, 8) },
  ], [pieces, story.title]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, damping: 20, stiffness: 220, useNativeDriver: true }),
      ]).start();
    }, 950);
    return () => clearTimeout(timer);
  }, [fade, slide]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bone }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, height: insets.top + 64, backgroundColor: colors.bone }]}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Go back to Today">
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </Pressable>
        <View style={styles.headerSearch}><Ionicons name="search-outline" size={20} color={colors.ink} /><Text style={[styles.headerSearchText, { color: colors.muted }]}>Search Uvel</Text></View>
        <Pressable hitSlop={12} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Open menu"><Ionicons name="ellipsis-horizontal" size={23} color={colors.ink} /></Pressable>
      </View>
      {loading ? (
        <View style={styles.loading}><OrbitLoader size={64} label="Loading edit" caption="Curating pieces" /></View>
      ) : (
        <Animated.ScrollView style={{ opacity: fade, transform: [{ translateY: slide }] }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.pageTitle, { color: colors.ink }]}>Shop the latest in {story.title}</Text>
          {media ? <LandingMedia media={media} color={story.color} /> : null}
          <Text style={[styles.sectionLabel, { color: colors.ink }]}>Explore departments</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.departmentRow}>
            {departments.map(([label, icon]) => <Pressable key={label} onPress={() => setSelectedDepartment(label)} style={styles.department} accessibilityRole="button" accessibilityState={{ selected: selectedDepartment === label }}><View style={[styles.departmentCircle, { backgroundColor: selectedDepartment === label ? colors.ink : "#E7E3DA" }]}><Ionicons name={icon as never} size={22} color={selectedDepartment === label ? colors.bone : colors.ink} /></View><Text style={[styles.departmentText, { color: colors.ink }]} numberOfLines={1}>{label}</Text></Pressable>)}
          </ScrollView>
          {sections.map((section) => <ProductSection key={section.title} title={section.title} pieces={section.items} color={story.color} market={market} colors={colors} onOpenPiece={onOpenPiece} />)}
        </Animated.ScrollView>
      )}
    </View>
  );
}

function LandingMedia({ media, color }: { media: Media; color: string }) {
  const player = useVideoPlayer(media.kind === "video" ? media.source : null, (instance) => { if (media.kind === "video") { instance.loop = true; instance.muted = true; instance.play(); } });
  return <View style={[styles.media, { backgroundColor: color }]}>{media.kind === "video" ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} /> : <Image source={media.source} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />}</View>;
}

function ProductSection({ title, pieces, color, market, colors, onOpenPiece }: { title: string; pieces: ClosetPiece[]; color: string; market: ReturnType<typeof getMarket>; colors: ReturnType<typeof useColors>; onOpenPiece: (piece: ClosetPiece, origin: BannerStoryOrigin) => void }) {
  return <View style={styles.section}><View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: colors.ink }]}>{title}</Text><Text style={[styles.seeAll, { color: colors.ink }]}>See all ›</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRow}>{pieces.map((piece) => <ProductCard key={piece.id} piece={piece} color={color} market={market} colors={colors} onOpenPiece={onOpenPiece} />)}</ScrollView></View>;
}

function ProductCard({ piece, color, market, colors, onOpenPiece }: { piece: ClosetPiece; color: string; market: ReturnType<typeof getMarket>; colors: ReturnType<typeof useColors>; onOpenPiece: (piece: ClosetPiece, origin: BannerStoryOrigin) => void }) {
  const ref = useRef<View>(null);
  const discounted = piece.originalPriceCents > piece.listPriceCents;
  return <Pressable ref={ref} onPress={() => ref.current?.measureInWindow((x, y, width, height) => onOpenPiece(piece, { x, y, width, height }))} style={[styles.productCard, { backgroundColor: colors.surface }]} accessibilityRole="button" accessibilityLabel={`Open ${piece.name}`}><View style={styles.productImageWrap}><Image source={{ uri: todayProductImage(piece) }} style={styles.productImage} contentFit="cover" /><Pressable style={[styles.quickAdd, { backgroundColor: color }]} onPress={() => undefined} accessibilityRole="button" accessibilityLabel={`Quick add ${piece.name}`}><Ionicons name="add" size={20} color={colors.ink} /></Pressable></View><Text style={[styles.productBrand, { color: colors.muted }]} numberOfLines={1}>{(piece.brand || "Uvel seller").toUpperCase()}</Text><Text style={[styles.productName, { color: colors.ink }]} numberOfLines={2}>{piece.name}</Text>{discounted ? <Text style={[styles.deal, { color: "#D94732" }]}>Limited edit deal</Text> : null}<Text style={[styles.productPrice, { color: colors.ink }]}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>{discounted ? <Text style={[styles.typical, { color: colors.muted }]}>Typical price {moneyInMarket(piece.originalPriceCents, piece.currency || market.currency, market)}</Text> : null}</Pressable>;
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#D8D3C8" },
  headerButton: { width: 34, height: 42, alignItems: "center", justifyContent: "center" },
  headerSearch: { flex: 1, height: 40, borderRadius: 20, backgroundColor: "#EDEAE3", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 8 },
  headerSearchText: { fontSize: 13 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 100 },
  content: { paddingTop: 16 },
  pageTitle: { fontSize: 27, lineHeight: 32, fontWeight: "900", paddingHorizontal: 18, marginBottom: 14 },
  media: { width: "100%", height: 245, overflow: "hidden", marginBottom: 22 },
  sectionLabel: { fontSize: 18, fontWeight: "900", paddingHorizontal: 18, marginBottom: 12 },
  departmentRow: { paddingHorizontal: 18, gap: 18, paddingBottom: 22 },
  department: { width: 82, alignItems: "center", gap: 7 },
  departmentCircle: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center" },
  departmentText: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  section: { marginTop: 8, marginBottom: 22 },
  sectionHeading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 18, marginBottom: 12 },
  sectionTitle: { fontSize: 21, fontWeight: "900" },
  seeAll: { fontSize: 13, fontWeight: "800" },
  productRow: { paddingHorizontal: 18, gap: 12 },
  productCard: { width: 164, borderRadius: 12, overflow: "hidden", paddingBottom: 12 },
  productImageWrap: { width: 164, height: 178, backgroundColor: "#E6E1D8", position: "relative" },
  productImage: { width: "100%", height: "100%" },
  quickAdd: { position: "absolute", right: 9, top: 9, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  productBrand: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, paddingHorizontal: 10, marginTop: 9 },
  productName: { fontSize: 13, lineHeight: 17, fontWeight: "700", paddingHorizontal: 10, marginTop: 4, minHeight: 34 },
  deal: { fontSize: 10, fontWeight: "800", paddingHorizontal: 10, marginTop: 6 },
  productPrice: { fontSize: 17, fontWeight: "900", paddingHorizontal: 10, marginTop: 6 },
  typical: { fontSize: 10, paddingHorizontal: 10, marginTop: 3, textDecorationLine: "line-through" },
});
