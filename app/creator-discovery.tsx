import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUvel } from "../lib/store";
import { getMarket, moneyInMarket } from "../lib/markets";
import { rankCreatorProfiles, type CreatorProfile } from "../lib/creatorDiscovery";
import { useWardrobe, type ClosetPiece } from "../lib/wardrobe";
import { TodayListingOverlay, type ListingOrigin } from "../components/TodayListingOverlay";

const WISDOM_SOURCE = "https://www.vogue.com/article/wisdom-kaye-tik-tok-fashion-interview";
const CREAM = "#F6F0E7";
const PAPER = "#FFFDFC";
const INK = "#171717";
const MUTED = "#7B756E";
const LINE = "#E5DED4";
const BLUE = "#1D5DAF";

export default function CreatorDiscovery() {
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const pieces = useWardrobe();
  const market = getMarket(app.country);
  const creators = useMemo(() => rankCreatorProfiles(pieces, 12), [pieces]);
  const featuredPieces = useMemo(() => creators.flatMap((creator) => creator.pieces.slice(0, 3)).slice(0, 12), [creators]);
  const shopPieces = useMemo(() => creators.flatMap((creator) => creator.pieces).slice(0, 40), [creators]);
  const rows = useMemo(() => Array.from({ length: Math.ceil(shopPieces.length / 2) }, (_, index) => shopPieces.slice(index * 2, index * 2 + 2)), [shopPieces]);
  const [openPiece, setOpenPiece] = useState<ClosetPiece | null>(null);
  const [openOrigin, setOpenOrigin] = useState<ListingOrigin>({ x: 0, y: 0, width: 0, height: 0 });
  const styles = makeStyles();

  function openListing(piece: ClosetPiece, ref: { current: View | null }) {
    ref.current?.measureInWindow((x, y, width, height) => {
      const measure = (callback: (rect: { x: number; y: number; width: number; height: number }) => void) => ref.current?.measureInWindow((mx, my, mw, mh) => callback({ x: mx, y: my, width: mw, height: mh }));
      setOpenOrigin({ x, y, width, height, photo: piece.photo, measure });
      setOpenPiece(piece);
    });
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 36 }}>
        <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to Today"><Ionicons name="arrow-back" size={23} color={INK} /></Pressable>
          <Pressable onPress={() => router.push("/search")} style={styles.searchBar} accessibilityRole="button" accessibilityLabel="Search clothing"><Ionicons name="search-outline" size={19} color={MUTED} /><Text style={styles.searchText}>Search for a style, creator, or piece</Text><Ionicons name="camera-outline" size={20} color={INK} /></Pressable>
        </View>

        <View style={styles.titleBlock}><Text style={styles.eyebrow}>UVEL EDIT</Text><Text style={styles.title}>Style by creators you’ll love</Text><Text style={styles.subtitle}>Pieces, people, and ideas selected around your taste.</Text></View>

        <SectionHeading title="Creators for you" subtitle="People whose style matches your world" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.creatorRail}>
          {creators.slice(0, 8).map((creator) => <CreatorChip key={creator.id} creator={creator} />)}
        </ScrollView>

        <SectionHeading title="Featured creator edits" subtitle="A closer look at what they’re wearing" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featureRail}>
          {featuredPieces.map((piece) => <FeaturedPiece key={piece.id} piece={piece} styles={styles} />)}
        </ScrollView>

        <View style={styles.feedHeading}><View><Text style={styles.feedTitle}>Shop the edit</Text><Text style={styles.feedSubtitle}>Marketplace pieces from creators Uvel thinks you’ll like</Text></View><Pressable onPress={() => router.push("/search")} accessibilityRole="button"><Text style={styles.filterText}>Filters <Ionicons name="chevron-down" size={13} color={BLUE} /></Text></Pressable></View>
        <View style={styles.chips}><Chip label="All pieces" active /><Chip label="Minimal" /><Chip label="Layered" /><Chip label="Statement" /></View>
        {rows.map((row, index) => <View key={`row-${index}`} style={styles.gridRow}>{row.map((piece) => <ListingCard key={piece.id} piece={piece} market={market} styles={styles} onOpen={openListing} />)}</View>)}
        {!shopPieces.length ? <View style={styles.empty}><Ionicons name="shirt-outline" size={23} color={MUTED} /><Text style={styles.emptyText}>Creator listings will appear here as Uvel finds the right edits for you.</Text></View> : null}

        <View style={styles.readCard}><View style={styles.readTop}><Text style={styles.readKicker}>STYLE NOTE · VOGUE</Text><Ionicons name="arrow-up-right" size={18} color={INK} /></View><Text style={styles.readTitle}>Wisdom Kaye makes expressive dressing feel possible.</Text><Text style={styles.readBody}>Start with the silhouette, then make the contrast your own.</Text><Pressable onPress={() => void Linking.openURL(WISDOM_SOURCE)} accessibilityRole="link"><Text style={styles.readLink}>Read the profile</Text></Pressable></View>
      </ScrollView>
      {openPiece ? <TodayListingOverlay piece={openPiece} origin={openOrigin} onClose={() => setOpenPiece(null)} closeMode="instant" /> : null}
    </View>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <View style={stylesStatic.sectionHeading}><Text style={stylesStatic.sectionTitle}>{title}</Text><Text style={stylesStatic.sectionSubtitle}>{subtitle}</Text></View>;
}

function CreatorChip({ creator }: { creator: CreatorProfile }) {
  return <View style={stylesStatic.creatorChip}>{creator.photo ? <Image source={{ uri: creator.photo }} style={stylesStatic.creatorAvatar} contentFit="cover" /> : <View style={[stylesStatic.creatorAvatar, stylesStatic.avatarFallback]}><Text style={stylesStatic.avatarLetter}>{creator.name.slice(0, 1).toUpperCase()}</Text></View>}<Text style={stylesStatic.creatorName} numberOfLines={1}>{creator.name}</Text><Text style={stylesStatic.creatorCount}>{creator.pieces.length} pieces</Text></View>;
}

function FeaturedPiece({ piece, styles }: { piece: ClosetPiece; styles: ReturnType<typeof makeStyles> }) {
  const creator = piece.ownerName || piece.listedByName || piece.brand || "Uvel creator";
  return <Pressable style={styles.featureCard} accessibilityRole="button" accessibilityLabel={`Featured edit by ${creator}`}><Image source={{ uri: piece.photo }} style={styles.featureImage} contentFit="cover" /><View style={styles.featureShade} /><View style={styles.featureCopy}><Text style={styles.featureKicker}>CREATOR EDIT</Text><Text style={styles.featureName} numberOfLines={1}>{creator}</Text><Text style={styles.featurePiece} numberOfLines={1}>{piece.name}</Text></View></Pressable>;
}

function Chip({ label, active = false }: { label: string; active?: boolean }) {
  return <View style={[stylesStatic.chip, active && stylesStatic.chipActive]}><Text style={[stylesStatic.chipText, active && stylesStatic.chipTextActive]}>{label}</Text></View>;
}

function ListingCard({ piece, market, styles, onOpen }: { piece: ClosetPiece; market: ReturnType<typeof getMarket>; styles: ReturnType<typeof makeStyles>; onOpen: (piece: ClosetPiece, ref: { current: View | null }) => void }) {
  const ref = useRef<View>(null);
  const creator = piece.ownerName || piece.listedByName || piece.brand || "Uvel creator";
  return <Pressable ref={ref} onPress={() => onOpen(piece, ref)} style={styles.listingCard} accessibilityRole="button" accessibilityLabel={`Open ${piece.name}`}><View style={styles.listingImageWrap}>{piece.photo ? <Image source={{ uri: piece.photo }} style={styles.listingImage} contentFit="cover" cachePolicy="memory-disk" /> : null}<View style={styles.creatorPill}><Text style={styles.creatorPillText} numberOfLines={1}>{creator}</Text></View></View><Text style={styles.listingBrand} numberOfLines={1}>{(piece.brand || "UVEL").toUpperCase()}</Text><Text style={styles.listingName} numberOfLines={2}>{piece.name}</Text><Text style={styles.listingPrice}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text></Pressable>;
}

const stylesStatic = StyleSheet.create({
  sectionHeading: { paddingHorizontal: 18, marginTop: 25, marginBottom: 12 },
  sectionTitle: { color: INK, fontSize: 20, fontWeight: "900" },
  sectionSubtitle: { color: MUTED, fontSize: 12, marginTop: 4 },
  creatorChip: { width: 92, alignItems: "center" },
  creatorAvatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#E4DDD3" },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#CDE2D0" },
  avatarLetter: { color: INK, fontSize: 25, fontWeight: "900" },
  creatorName: { width: 88, color: INK, fontSize: 12, fontWeight: "800", textAlign: "center", marginTop: 8 },
  creatorCount: { color: MUTED, fontSize: 10, marginTop: 3 },
  chip: { borderWidth: 1, borderColor: "#A8C3C1", borderRadius: 8, paddingHorizontal: 13, paddingVertical: 8, marginRight: 8, backgroundColor: PAPER },
  chipActive: { backgroundColor: "#D7EBE7", borderColor: "#397E7B" },
  chipText: { color: "#397E7B", fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: "#1C5F5C" },
});

function makeStyles() {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: CREAM },
    header: { paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
    back: { width: 30, height: 44, alignItems: "center", justifyContent: "center" },
    searchBar: { flex: 1, height: 46, backgroundColor: PAPER, borderRadius: 24, borderWidth: 1, borderColor: LINE, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, gap: 9 },
    searchText: { flex: 1, color: MUTED, fontSize: 12 },
    titleBlock: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 4 },
    eyebrow: { color: BLUE, fontSize: 10, letterSpacing: 1.8, fontWeight: "900" },
    title: { color: INK, fontSize: 29, lineHeight: 33, fontWeight: "900", marginTop: 8, letterSpacing: -0.4 },
    subtitle: { color: MUTED, fontSize: 13, marginTop: 7 },
    creatorRail: { paddingHorizontal: 18, gap: 14 },
    featureRail: { paddingHorizontal: 18, gap: 12 },
    featureCard: { width: 220, height: 214, borderRadius: 16, overflow: "hidden", backgroundColor: "#DDD4C9", position: "relative" },
    featureImage: { width: "100%", height: "100%" },
    featureShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 100, backgroundColor: "rgba(0,0,0,0.38)" },
    featureCopy: { position: "absolute", left: 13, right: 13, bottom: 13 },
    featureKicker: { color: "#D8F0EA", fontSize: 9, letterSpacing: 1.2, fontWeight: "900" },
    featureName: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", marginTop: 4 },
    featurePiece: { color: "#F3EEE7", fontSize: 11, marginTop: 3 },
    feedHeading: { paddingHorizontal: 18, marginTop: 29, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
    feedTitle: { color: INK, fontSize: 20, fontWeight: "900" },
    feedSubtitle: { color: MUTED, fontSize: 12, marginTop: 4, maxWidth: 270 },
    filterText: { color: BLUE, fontSize: 12, fontWeight: "900" },
    chips: { paddingHorizontal: 18, flexDirection: "row", marginBottom: 15 },
    gridRow: { flexDirection: "row", gap: 12, paddingHorizontal: 18, marginBottom: 15 },
    listingCard: { flex: 1, minWidth: 0 },
    listingImageWrap: { height: 218, borderRadius: 12, overflow: "hidden", backgroundColor: "#E5DDD2", position: "relative" },
    listingImage: { width: "100%", height: "100%" },
    creatorPill: { position: "absolute", left: 7, right: 7, bottom: 7, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "rgba(255,255,255,0.9)" },
    creatorPillText: { color: INK, fontSize: 9, fontWeight: "800" },
    listingBrand: { color: MUTED, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 8 },
    listingName: { color: INK, fontSize: 14, lineHeight: 18, fontWeight: "800", marginTop: 4, minHeight: 36 },
    listingPrice: { color: INK, fontSize: 16, fontWeight: "900", marginTop: 6 },
    empty: { marginHorizontal: 18, padding: 24, borderRadius: 14, backgroundColor: PAPER, alignItems: "center", gap: 10 },
    emptyText: { color: MUTED, fontSize: 13, lineHeight: 19, textAlign: "center" },
    readCard: { marginHorizontal: 18, marginTop: 20, padding: 17, backgroundColor: "#DDE9F8", borderRadius: 16 },
    readTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    readKicker: { color: "#315486", fontSize: 10, letterSpacing: 1.2, fontWeight: "900" },
    readTitle: { color: INK, fontSize: 18, lineHeight: 22, fontWeight: "900", marginTop: 11 },
    readBody: { color: "#4E617A", fontSize: 12, lineHeight: 17, marginTop: 7 },
    readLink: { color: BLUE, fontSize: 12, fontWeight: "900", marginTop: 11 },
  });
}
