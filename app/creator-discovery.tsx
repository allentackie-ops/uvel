import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useColors } from "../lib/theme";
import { getMarket, moneyInMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { rankCreatorProfiles, type CreatorProfile } from "../lib/creatorDiscovery";
import { useWardrobe, type ClosetPiece } from "../lib/wardrobe";
import { TodayListingOverlay, type ListingOrigin } from "../components/TodayListingOverlay";

const WISDOM_SOURCE = "https://www.vogue.com/article/wisdom-kaye-tik-tok-fashion-interview";

export default function CreatorDiscovery() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const pieces = useWardrobe();
  const market = getMarket(app.country);
  const creators = useMemo(() => rankCreatorProfiles(pieces, 12), [pieces]);
  const stylePieces = useMemo(() => creators.flatMap((creator) => creator.pieces).slice(0, 40), [creators]);
  const rows = useMemo(() => Array.from({ length: Math.ceil(stylePieces.length / 2) }, (_, index) => stylePieces.slice(index * 2, index * 2 + 2)), [stylePieces]);
  const [openPiece, setOpenPiece] = useState<ClosetPiece | null>(null);
  const [openOrigin, setOpenOrigin] = useState<ListingOrigin>({ x: 0, y: 0, width: 0, height: 0 });
  const styles = makeStyles(colors);

  function openListing(piece: ClosetPiece, ref: { current: View | null }) {
    ref.current?.measureInWindow((x, y, width, height) => {
      const measure = (callback: (rect: { x: number; y: number; width: number; height: number }) => void) => ref.current?.measureInWindow((mx, my, mw, mh) => callback({ x: mx, y: my, width: mw, height: mh }));
      setOpenOrigin({ x, y, width, height, photo: piece.photo, measure });
      setOpenPiece(piece);
    });
  }

  return (
    <View style={styles.root}>
      <StatusBar style={colors.ink === "#000000" ? "light" : "dark"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 36 }}>
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to Today"><Ionicons name="arrow-back" size={24} color={colors.bone} /></Pressable>
          <Text style={styles.topTitle}>Style by creators</Text>
          <Pressable onPress={() => router.push("/search")} style={styles.search} hitSlop={10} accessibilityRole="button" accessibilityLabel="Search clothing"><Ionicons name="search-outline" size={21} color={colors.bone} /></Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>YOUR CREATOR EDIT</Text>
          <Text style={styles.heroTitle}>Looks worth{`\n`}coming back to.</Text>
          <Text style={styles.heroCopy}>Real Uvel sellers, ranked around the silhouettes, colors, and pieces your style already reaches for.</Text>
          <View style={styles.heroRule} />
          <Text style={styles.heroFoot}>{creators.length ? `${creators.length} creators · ${stylePieces.length} pieces to explore` : "Fresh creator edits are on the way"}</Text>
        </View>

        {creators.length ? <View style={styles.section}>
          <View style={styles.headingRow}><View><Text style={styles.sectionTitle}>Creators you’ll love</Text><Text style={styles.sectionSub}>Picked from the marketplace for you</Text></View><Ionicons name="sparkles-outline" size={22} color={colors.success} /></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.creatorRail}>
            {creators.slice(0, 6).map((creator) => <CreatorCard key={creator.id} creator={creator} styles={styles} />)}
          </ScrollView>
        </View> : null}

        <View style={styles.section}>
          <View style={styles.headingRow}><View><Text style={styles.sectionTitle}>Style notes</Text><Text style={styles.sectionSub}>Ideas to take with you</Text></View></View>
          <Pressable onPress={() => void Linking.openURL(WISDOM_SOURCE)} style={styles.noteCard} accessibilityRole="link" accessibilityLabel="Read Vogue's Wisdom Kaye style profile">
            <View style={styles.noteMark}><Text style={styles.noteMarkText}>W</Text></View>
            <View style={styles.noteCopy}><Text style={styles.noteKicker}>READ · VOGUE</Text><Text style={styles.noteTitle}>Wisdom Kaye makes expressive dressing feel possible.</Text><Text style={styles.noteBody}>Start with the silhouette, then make the contrast your own.</Text><Text style={styles.noteLink}>Read the profile ↗</Text></View>
          </Pressable>
          <View style={styles.tipCard}><Ionicons name="bulb-outline" size={20} color={colors.success} /><View style={{ flex: 1 }}><Text style={styles.tipTitle}>A useful styling prompt</Text><Text style={styles.tipBody}>Try one familiar piece with one unexpected proportion. Save the look if it makes you want to wear it tomorrow.</Text></View></View>
        </View>

        <View style={styles.section}>
          <View style={styles.headingRow}><View><Text style={styles.sectionTitle}>Shop the edit</Text><Text style={styles.sectionSub}>Pieces from the creators Uvel thinks you’ll like</Text></View><Text style={styles.count}>{stylePieces.length}</Text></View>
          {rows.map((row, rowIndex) => <View key={`row-${rowIndex}`} style={styles.gridRow}>{row.map((piece) => <CreatorListingCard key={piece.id} piece={piece} market={market} styles={styles} onOpen={openListing} />)}</View>)}
          {!stylePieces.length ? <View style={styles.empty}><Ionicons name="shirt-outline" size={22} color={colors.muted} /><Text style={styles.emptyText}>Creator listings will appear here as Uvel finds the right edits for you.</Text></View> : null}
        </View>
      </ScrollView>
      {openPiece ? <TodayListingOverlay piece={openPiece} origin={openOrigin} onClose={() => setOpenPiece(null)} closeMode="instant" /> : null}
    </View>
  );
}

function CreatorCard({ creator, styles }: { creator: CreatorProfile; styles: ReturnType<typeof makeStyles> }) {
  return <View style={styles.creatorCard}>
    {creator.photo ? <Image source={{ uri: creator.photo }} style={styles.creatorPhoto} contentFit="cover" /> : <View style={[styles.creatorPhoto, styles.creatorPhotoFallback]}><Text style={styles.creatorInitial}>{creator.name.slice(0, 1).toUpperCase()}</Text></View>}
    <Text style={styles.creatorName} numberOfLines={1}>{creator.name}</Text>
    <Text style={styles.creatorMeta} numberOfLines={1}>{creator.styleLine}</Text>
    <Text style={styles.creatorCount}>{creator.pieces.length} live pieces</Text>
  </View>;
}

function CreatorListingCard({ piece, market, styles, onOpen }: { piece: ClosetPiece; market: ReturnType<typeof getMarket>; styles: ReturnType<typeof makeStyles>; onOpen: (piece: ClosetPiece, ref: { current: View | null }) => void }) {
  const ref = useRef<View>(null);
  const creator = piece.ownerName || piece.listedByName || piece.brand || "Uvel creator";
  return <Pressable ref={ref} onPress={() => onOpen(piece, ref)} style={styles.listingCard} accessibilityRole="button" accessibilityLabel={`Open ${piece.name}`}>
    <View style={styles.listingImageWrap}>{piece.photo ? <Image source={{ uri: piece.photo }} style={styles.listingImage} contentFit="cover" cachePolicy="memory-disk" /> : null}<View style={styles.creatorPill}><Text style={styles.creatorPillText} numberOfLines={1}>{creator}</Text></View></View>
    <Text style={styles.listingBrand} numberOfLines={1}>{(piece.brand || "UVEL").toUpperCase()}</Text>
    <Text style={styles.listingName} numberOfLines={2}>{piece.name}</Text>
    <Text style={styles.listingPrice}>{moneyInMarket(piece.listPriceCents, piece.currency || market.currency, market)}</Text>
  </Pressable>;
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.ink },
    top: { minHeight: 70, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12 },
    back: { width: 34, height: 42, alignItems: "center", justifyContent: "center" },
    topTitle: { flex: 1, color: colors.bone, fontSize: 19, fontWeight: "900" },
    search: { width: 38, height: 42, alignItems: "center", justifyContent: "center" },
    hero: { marginHorizontal: 18, marginTop: 8, borderRadius: 26, backgroundColor: "#2762C5", padding: 24, minHeight: 246, overflow: "hidden" },
    eyebrow: { color: "#D7E4FF", fontSize: 10, letterSpacing: 1.8, fontWeight: "900" },
    heroTitle: { color: "#FFFFFF", fontSize: 35, lineHeight: 37, fontWeight: "900", marginTop: 17, letterSpacing: -0.8 },
    heroCopy: { color: "#EAF1FF", fontSize: 14, lineHeight: 20, marginTop: 14, maxWidth: 320 },
    heroRule: { height: 1, backgroundColor: "rgba(255,255,255,0.32)", marginTop: 20 },
    heroFoot: { color: "#D7E4FF", fontSize: 11, fontWeight: "800", marginTop: 11 },
    section: { marginTop: 30 },
    headingRow: { paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    sectionTitle: { color: colors.bone, fontSize: 22, fontWeight: "900" },
    sectionSub: { color: colors.muted, fontSize: 12, marginTop: 4 },
    creatorRail: { paddingHorizontal: 18, gap: 12 },
    creatorCard: { width: 148, backgroundColor: colors.surface, borderRadius: 18, padding: 10 },
    creatorPhoto: { width: 128, height: 128, borderRadius: 14, backgroundColor: colors.neutral },
    creatorPhotoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.success },
    creatorInitial: { color: colors.ink, fontSize: 44, fontWeight: "900" },
    creatorName: { color: colors.bone, fontSize: 14, fontWeight: "900", marginTop: 10 },
    creatorMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
    creatorCount: { color: colors.success, fontSize: 10, fontWeight: "800", marginTop: 8 },
    noteCard: { marginHorizontal: 18, backgroundColor: "#D6E5FF", borderRadius: 20, padding: 16, flexDirection: "row", gap: 14 },
    noteMark: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
    noteMarkText: { color: "#FFFFFF", fontSize: 25, fontWeight: "900" },
    noteCopy: { flex: 1 },
    noteKicker: { color: "#315486", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
    noteTitle: { color: "#101B2D", fontSize: 17, lineHeight: 21, fontWeight: "900", marginTop: 7 },
    noteBody: { color: "#3C506D", fontSize: 12, lineHeight: 17, marginTop: 7 },
    noteLink: { color: "#174A9C", fontSize: 12, fontWeight: "900", marginTop: 11 },
    tipCard: { marginHorizontal: 18, marginTop: 10, backgroundColor: colors.surface, borderRadius: 18, padding: 15, flexDirection: "row", gap: 12 },
    tipTitle: { color: colors.bone, fontSize: 14, fontWeight: "900" },
    tipBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
    count: { color: colors.success, fontWeight: "900", fontSize: 14 },
    gridRow: { flexDirection: "row", gap: 12, paddingHorizontal: 18, marginBottom: 14 },
    listingCard: { flex: 1, minWidth: 0 },
    listingImageWrap: { height: 214, borderRadius: 16, overflow: "hidden", backgroundColor: colors.neutral, position: "relative" },
    listingImage: { width: "100%", height: "100%" },
    creatorPill: { position: "absolute", left: 8, right: 8, bottom: 8, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "rgba(0,0,0,0.68)" },
    creatorPillText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
    listingBrand: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 9 },
    listingName: { color: colors.bone, fontSize: 14, lineHeight: 18, fontWeight: "800", marginTop: 4, minHeight: 36 },
    listingPrice: { color: colors.bone, fontSize: 16, fontWeight: "900", marginTop: 6 },
    empty: { marginHorizontal: 18, padding: 24, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", gap: 10 },
    emptyText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  });
}
