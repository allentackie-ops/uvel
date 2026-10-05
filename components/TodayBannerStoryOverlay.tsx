import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OrbitLoader } from "./OrbitLoader";
import type { ClosetPiece } from "../lib/wardrobe";
import { todayProductImage } from "../lib/todayProductImage";
import { getMarket, moneyInMarket } from "../lib/markets";
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
  detailPieces?: ClosetPiece[];
};

export function TodayBannerStoryOverlay({ story, onClose, onOpenPiece }: { story: BannerStory; origin: BannerStoryOrigin; onClose: () => void; onOpenPiece: (piece: ClosetPiece, origin: BannerStoryOrigin) => void }) {
  const colors = useColors();
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState("Fashion");
  const translateX = useRef(new Animated.Value(width)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
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
  const closePage = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(translateX, { toValue: width, duration: 230, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onClose();
    });
  };
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dx > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.15,
    onPanResponderMove: (_event, gesture) => { if (!closing.current) translateX.setValue(Math.max(0, gesture.dx)); },
    onPanResponderRelease: (_event, gesture) => {
      if (closing.current) return;
      if (gesture.dx > width * 0.24 || gesture.vx > 0.8) { closePage(); return; }
      Animated.spring(translateX, { toValue: 0, damping: 24, stiffness: 280, useNativeDriver: true }).start();
    },
  }), [translateX, width]);

  useEffect(() => {
    Animated.spring(translateX, { toValue: 0, damping: 24, stiffness: 280, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      setLoading(false);
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    }, 950);
    return () => clearTimeout(timer);
  }, [fade, translateX]);

  return (
    <Animated.View {...panResponder.panHandlers} style={[styles.root, { backgroundColor: colors.ink, transform: [{ translateX }] }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, height: insets.top + 64, backgroundColor: colors.ink, borderBottomColor: `${colors.bone}20` }]}>
        <Pressable onPress={closePage} hitSlop={12} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Go back to Today"><Ionicons name="arrow-back" size={24} color={colors.bone} /></Pressable>
        <View style={[styles.headerSearch, { backgroundColor: `${colors.bone}12` }]}><Ionicons name="search-outline" size={20} color={colors.bone} /><Text style={[styles.headerSearchText, { color: colors.muted }]}>Search Uvel</Text></View>
        <Pressable hitSlop={12} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Open menu"><Ionicons name="ellipsis-horizontal" size={23} color={colors.bone} /></Pressable>
      </View>
      {loading ? <View style={styles.loading}><OrbitLoader size={64} label="Loading edit" caption="Curating pieces" /></View> : <Animated.ScrollView style={{ opacity: fade }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageTitle, { color: colors.bone }]}>Shop the latest in {story.title}</Text>
        <Text style={[styles.pageSubtitle, { color: colors.muted }]}>{story.subtitle}</Text>
        <Text style={[styles.sectionLabel, { color: colors.bone }]}>Explore departments</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.departmentRow}>
          {departments.map(([label, icon]) => <Pressable key={label} onPress={() => setSelectedDepartment(label)} style={styles.department} accessibilityRole="button" accessibilityState={{ selected: selectedDepartment === label }}><View style={[styles.departmentCircle, { backgroundColor: selectedDepartment === label ? colors.bone : `${colors.bone}18` }]}><Ionicons name={icon as never} size={22} color={selectedDepartment === label ? colors.ink : colors.bone} /></View><Text style={[styles.departmentText, { color: colors.bone }]} numberOfLines={1}>{label}</Text></Pressable>)}
        </ScrollView>
        {sections.map((section) => <ProductSection key={section.title} title={section.title} pieces={section.items} color={story.color} market={market} colors={colors} onOpenPiece={onOpenPiece} />)}
      </Animated.ScrollView>}
    </Animated.View>
  );
}

function ProductSection({ title, pieces, color, market, colors, onOpenPiece }: { title: string; pieces: ClosetPiece[]; color: string; market: ReturnType<typeof getMarket>; colors: ReturnType<typeof useColors>; onOpenPiece: (piece: ClosetPiece, origin: BannerStoryOrigin) => void }) {
  return <View style={styles.section}><View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: colors.bone }]}>{title}</Text><Text style={[styles.seeAll, { color: colors.success }]}>See all ›</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRow}>{pieces.map((piece) => <ProductCard key={piece.id} piece={piece} color={color} market={market} colors={colors} onOpenPiece={onOpenPiece} />)}</ScrollView></View>;
}

function ProductCard({ piece, color, market, colors, onOpenPiece }: { piece: ClosetPiece; color: string; market: ReturnType<typeof getMarket>; colors: ReturnType<typeof useColors>; onOpenPiece: (piece: ClosetPiece, origin: BannerStoryOrigin) => void }) {
  const ref = useRef<View>(null);
  const discounted = piece.originalPriceCents > piece.listPriceCents;
  return <Pressable ref={ref} onPress={() => ref.current?.measureInWindow((x, y, width, height) => onOpenPiece(piece, { x, y, width, height }))} style={[styles.productCard, { backgroundColor: colors.surface }]} accessibilityRole="button" accessibilityLabel={`Open ${piece.name}`}><View style={[styles.productImageWrap, { backgroundColor: `${colors.bone}12` }]}><Image source={{ uri: todayProductImage(piece) }} style={styles.productImage} contentFit="cover" /><Pressable style={[styles.quickAdd, { backgroundColor: color }]} onPress={() => undefined} accessibilityRole="button" accessibilityLabel={`Quick add ${piece.name}`}><Ionicons name="add" size={20} color={colors.ink} /></Pressable></View><Text style={[styles.productBrand, { color: colors.muted }]} numberOfLines={1}>{(piece.brand || "Uvel seller").toUpperCase()}</Text><Text style={[styles.productName, { color: colors.bone }]} numberOfLines={2}>{piece.name}</Text>{discounted ? <Text style={[styles.deal, { color: colors.danger }]}>Limited edit deal</Text> : null}<Text style={[styles.productPrice, { color: colors.bone }]}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>{discounted ? <Text style={[styles.typical, { color: colors.muted }]}>Typical price {moneyInMarket(piece.originalPriceCents, piece.currency || market.currency, market)}</Text> : null}</Pressable>;
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerButton: { width: 34, height: 42, alignItems: "center", justifyContent: "center" },
  headerSearch: { flex: 1, height: 40, borderRadius: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 8 },
  headerSearchText: { fontSize: 13 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 100 },
  content: { paddingTop: 16 },
  pageTitle: { fontSize: 27, lineHeight: 32, fontWeight: "900", paddingHorizontal: 18 },
  pageSubtitle: { fontSize: 14, lineHeight: 20, paddingHorizontal: 18, marginTop: 8, marginBottom: 22 },
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
  productImageWrap: { width: 164, height: 178, position: "relative" },
  productImage: { width: "100%", height: "100%" },
  quickAdd: { position: "absolute", right: 9, top: 9, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  productBrand: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, paddingHorizontal: 10, marginTop: 9 },
  productName: { fontSize: 13, lineHeight: 17, fontWeight: "700", paddingHorizontal: 10, marginTop: 4, minHeight: 34 },
  deal: { fontSize: 10, fontWeight: "800", paddingHorizontal: 10, marginTop: 6 },
  productPrice: { fontSize: 17, fontWeight: "900", paddingHorizontal: 10, marginTop: 6 },
  typical: { fontSize: 10, paddingHorizontal: 10, marginTop: 3, textDecorationLine: "line-through" },
});
