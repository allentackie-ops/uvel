import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OrbitLoader } from "./OrbitLoader";
import type { ClosetPiece } from "../lib/wardrobe";
import type { BannerStory } from "../lib/todayBannerStories";
import { getMarket, moneyInMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";

type BannerStoryOrigin = { x: number; y: number; width: number; height: number };
const GRADIENT_FADE_STEPS = Array.from({ length: 56 }, (_, index) => Math.pow(index / 55, 1.65));

export function TodayBannerStoryPage({ story, onClose, onOpenPiece }: { story: BannerStory; onClose: () => void; onOpenPiece: (piece: ClosetPiece, origin: BannerStoryOrigin) => void }) {
  const colors = useColors();
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const fade = useRef(new Animated.Value(0)).current;
  const market = getMarket(app.country);
  const pieces = story.detailPieces?.length ? story.detailPieces : story.pieces;
  const sections = useMemo(() => {
    const first = pieces.slice(0, 8);
    const more = pieces.slice(8, 16);
    return [
      ...(first.length ? [{ title: story.title === "New in" ? "Shop fall styles" : story.title, items: first }] : []),
      ...(more.length ? [{ title: "More from this edit", items: more }] : []),
    ];
  }, [pieces, story.title]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    }, 950);
    return () => clearTimeout(timer);
  }, [fade]);

  return (
    <View style={[styles.root, { backgroundColor: colors.ink }]}>
      <View pointerEvents="none" style={[styles.topColorField, { height: insets.top + 64 + 300 }]}>
        <View style={[styles.topColorLayer, { backgroundColor: story.gradientColor || story.color, opacity: 0.64 }]} />
        <View style={styles.topColorFade}>
          {GRADIENT_FADE_STEPS.map((opacity, index) => <View key={index} style={[styles.topColorFadeStrip, { opacity, backgroundColor: colors.ink }]} />)}
        </View>
      </View>
      <View style={[styles.header, { paddingTop: insets.top + 8, height: insets.top + 64, backgroundColor: "transparent", borderBottomColor: `${colors.bone}20` }]}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Go back to Today"><Ionicons name="arrow-back" size={24} color={colors.bone} /></Pressable>
        <View style={[styles.headerSearch, { backgroundColor: `${colors.bone}12` }]}><Ionicons name="search-outline" size={20} color={colors.bone} /><Text style={[styles.headerSearchText, { color: colors.muted }]}>Search Uvel</Text></View>
      </View>
      {loading ? <View style={styles.loading}><OrbitLoader size={64} label="Loading edit" caption="Curating pieces" /></View> : <Animated.ScrollView style={{ opacity: fade }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageTitle, { color: colors.bone }]}>Shop the latest in {story.title}</Text>
        <Text style={[styles.pageSubtitle, { color: colors.muted }]}>{story.subtitle}</Text>
        {sections.length ? sections.map((section) => <ProductSection key={section.title} title={section.title} pieces={section.items} color={story.color} market={market} colors={colors} onOpenPiece={onOpenPiece} />) : <View style={styles.emptyState}><Text style={[styles.emptyText, { color: colors.muted }]}>No available listings in this edit right now.</Text></View>}
      </Animated.ScrollView>}
    </View>
  );
}

function ProductSection({ title, pieces, color, market, colors, onOpenPiece }: { title: string; pieces: ClosetPiece[]; color: string; market: ReturnType<typeof getMarket>; colors: ReturnType<typeof useColors>; onOpenPiece: (piece: ClosetPiece, origin: BannerStoryOrigin) => void }) {
  return <View style={styles.section}><View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: colors.bone }]}>{title}</Text><Text style={[styles.seeAll, { color: colors.success }]}>See all ›</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRow}>{pieces.map((piece) => <ProductCard key={piece.id} piece={piece} color={color} market={market} colors={colors} onOpenPiece={onOpenPiece} />)}</ScrollView></View>;
}

function ProductCard({ piece, color, market, colors, onOpenPiece }: { piece: ClosetPiece; color: string; market: ReturnType<typeof getMarket>; colors: ReturnType<typeof useColors>; onOpenPiece: (piece: ClosetPiece, origin: BannerStoryOrigin) => void }) {
  const ref = useRef<View>(null);
  const discounted = piece.originalPriceCents > piece.listPriceCents;
  return <Pressable ref={ref} onPress={() => ref.current?.measureInWindow((x, y, width, height) => onOpenPiece(piece, { x, y, width, height }))} style={[styles.productCard, { backgroundColor: colors.surface }]} accessibilityRole="button" accessibilityLabel={`Open ${piece.name}`}><View style={[styles.productImageWrap, { backgroundColor: `${colors.bone}12` }]}><Image cachePolicy="memory-disk" source={{ uri: piece.photo || piece.photos?.[0] || "" }} style={styles.productImage} contentFit="cover" /><Pressable style={[styles.quickAdd, { backgroundColor: color }]} onPress={() => undefined} accessibilityRole="button" accessibilityLabel={`Quick add ${piece.name}`}><Ionicons name="add" size={20} color={colors.ink} /></Pressable></View><Text style={[styles.productBrand, { color: colors.muted }]} numberOfLines={1}>{(piece.brand || "Uvel seller").toUpperCase()}</Text><Text style={[styles.productName, { color: colors.bone }]} numberOfLines={2}>{piece.name}</Text>{discounted ? <Text style={[styles.deal, { color: colors.danger }]}>Limited edit deal</Text> : null}<Text style={[styles.productPrice, { color: colors.bone }]}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>{discounted ? <Text style={[styles.typical, { color: colors.muted }]}>Typical price {moneyInMarket(piece.originalPriceCents, piece.currency || market.currency, market)}</Text> : null}</Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topColorField: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden", zIndex: 0 },
  topColorLayer: { ...StyleSheet.absoluteFill },
  topColorFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 230, flexDirection: "column" },
  topColorFadeStrip: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 1 },
  headerButton: { width: 34, height: 42, alignItems: "center", justifyContent: "center" },
  headerSearch: { flex: 1, height: 40, borderRadius: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 8 },
  headerSearchText: { fontSize: 13 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 100 },
  content: { paddingTop: 16 },
  pageTitle: { fontSize: 27, lineHeight: 32, fontWeight: "900", paddingHorizontal: 18 },
  pageSubtitle: { fontSize: 14, lineHeight: 20, paddingHorizontal: 18, marginTop: 8, marginBottom: 22 },
  section: { marginTop: 8, marginBottom: 22 },
  sectionHeading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 18, marginBottom: 12 },
  sectionTitle: { fontSize: 21, fontWeight: "900" },
  seeAll: { fontSize: 13, fontWeight: "800" },
  productRow: { paddingHorizontal: 18, gap: 12 },
  productCard: { width: 164, borderRadius: 12, overflow: "hidden", paddingBottom: 12 },
  productImageWrap: { width: 164, height: 178, position: "relative" },
  productImage: { width: "100%", height: "100%" },
  quickAdd: { position: "absolute", right: 9, top: 9, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  productBrand: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, paddingHorizontal: 10, marginTop: 9 },
  productName: { fontSize: 13, lineHeight: 17, fontWeight: "700", paddingHorizontal: 10, marginTop: 4, minHeight: 34 },
  emptyState: { marginHorizontal: 18, marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)" },
  emptyText: { fontSize: 14, lineHeight: 20 },
  deal: { fontSize: 10, fontWeight: "800", paddingHorizontal: 10, marginTop: 6 },
  productPrice: { fontSize: 17, fontWeight: "900", paddingHorizontal: 10, marginTop: 6 },
  typical: { fontSize: 10, paddingHorizontal: 10, marginTop: 3, textDecorationLine: "line-through" },
});
