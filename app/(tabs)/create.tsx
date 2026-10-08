import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ownedBrand, useBrands, type Brand } from "../../lib/brands";
import { useUvel } from "../../lib/store";
import { MARKET_RED, useColors, type Colors } from "../../lib/theme";
import { useBrandListingDrafts } from "../../lib/brandListingDraft";

const HERO_IMAGE = require("../../assets/create/red-launchpad-hero.png");
const LAUNCH_IMAGES = [
  require("../../assets/create/listing.jpg"),
  require("../../assets/create/collection.jpg"),
  require("../../assets/create/announcement.jpg"),
];
const DRAFT_IMAGE = require("../../assets/create/draft.jpg");
const PAPER = "#FFFEFC";
const INK = "#141313";
const MUTED = "#6F6A69";
const PINK = "#FCE8EC";
const PALE_YELLOW = "#FFF2C8";
const PEACH = "#FFE8D8";

const LAUNCH_ITEMS = [
  { title: "One product", body: "List it fast", kind: "listing" as const, icon: "pricetag-outline" as const },
  { title: "A collection", body: "Build a story", kind: "collection" as const, icon: "layers-outline" as const },
  { title: "A brand", body: "Make it yours", kind: "brand" as const, icon: "megaphone-outline" as const },
];

type ScreenStyles = ReturnType<typeof makeStyles>;

export default function Create() {
  const baseColors = useColors();
  const insets = useSafeAreaInsets();
  const app = useUvel();
  useBrands();
  const brand = ownedBrand(app.uid);
  const colors = useMemo<Colors>(() => ({
    ...baseColors,
    ink: PAPER,
    bone: INK,
    muted: MUTED,
    surface: "#FFFFFF",
    subtle: "#D9D2D1",
    success: MARKET_RED,
    successInk: "#FFFFFF",
    pulse: MARKET_RED,
    pulseInk: "#FFFFFF",
    info: PINK,
    infoInk: INK,
    neutral: "#F5E4E7",
    neutralInk: INK,
  }), [baseColors]);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const drafts = useBrandListingDrafts(brand?.id);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 112 }]}
      showsVerticalScrollIndicator={false}
    >
      <UtilityHeader styles={styles} />
      <View style={styles.pageTitleBlock}>
        <Text style={styles.pageTitle}>Create</Text>
        <Text style={styles.pageSubtitle}>{brand ? "Make your next big thing." : "Make something worth talking about."}</Text>
      </View>
      <LaunchHero brand={brand} styles={styles} />
      <LaunchShelf brand={brand} styles={styles} />
      <DraftShelf brand={brand} drafts={drafts} styles={styles} />
    </ScrollView>
  );
}

function UtilityHeader({ styles }: { styles: ScreenStyles }) {
  return (
    <View style={styles.utilityHeader}>
      <Pressable onPress={() => router.push("/you")} style={styles.utilityButton} accessibilityRole="button" accessibilityLabel="Open menu">
        <Ionicons name="menu-outline" size={28} color={INK} />
      </Pressable>
      <Text style={styles.wordmark}>Uvel</Text>
      <View style={styles.utilitySpacer} />
      <Pressable onPress={() => router.push("/search")} style={styles.utilityButton} accessibilityRole="button" accessibilityLabel="Search">
        <Ionicons name="search-outline" size={25} color={INK} />
      </Pressable>
      <Pressable onPress={() => router.push("/inbox")} style={styles.utilityButton} accessibilityRole="button" accessibilityLabel="Open messages">
        <Ionicons name="chatbubble-ellipses-outline" size={24} color={INK} />
      </Pressable>
    </View>
  );
}

function LaunchHero({ brand, styles }: { brand?: Brand; styles: ScreenStyles }) {
  return (
    <Pressable
      onPress={() => router.push("/brand/founder")}
      style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Start creating"
    >
      <View style={styles.heroBurstOne} />
      <View style={styles.heroBurstTwo} />
      <Image source={HERO_IMAGE} style={styles.heroModel} contentFit="contain" cachePolicy="memory-disk" />
      <View style={styles.heroCopy}>
        <Text style={styles.heroKicker}>{brand ? "YOUR BRAND · NEXT DROP" : "IDEA · DROP · BRAND"}</Text>
        <Text style={styles.heroTitle}>Your next{`\n`}big thing{`\n`}starts here</Text>
        <View style={styles.heroButton}><Text style={styles.heroButtonText}>Start creating</Text><Ionicons name="arrow-forward" size={20} color={MARKET_RED} /></View>
      </View>
      <View style={[styles.heroSticker, styles.heroStickerIdea]}><Text style={styles.heroStickerText}>IDEA</Text></View>
      <View style={[styles.heroSticker, styles.heroStickerDrop]}><Text style={styles.heroStickerText}>DROP</Text></View>
      <View style={[styles.heroSticker, styles.heroStickerBrand]}><Text style={styles.heroStickerText}>BRAND</Text></View>
    </Pressable>
  );
}

function LaunchShelf({ brand, styles }: { brand?: Brand; styles: ScreenStyles }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Choose your launch</Text></View>
      <View style={styles.launchGrid}>
        {LAUNCH_ITEMS.map((item, index) => (
          <Pressable
            key={item.title}
            onPress={() => openLaunch(item.kind, brand)}
            style={({ pressed }) => [styles.launchCard, index === 0 ? styles.launchCardPink : index === 1 ? styles.launchCardYellow : styles.launchCardPeach, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}: ${item.body}`}
          >
            <View style={styles.launchCardTop}><Text style={styles.launchTitle}>{item.title}</Text><Ionicons name="chevron-forward" size={17} color={MARKET_RED} /></View>
            <Text style={styles.launchBody}>{item.body}</Text>
            <Image source={LAUNCH_IMAGES[index]} style={styles.launchImage} contentFit="cover" cachePolicy="memory-disk" />
            <View style={styles.launchIcon}><Ionicons name={item.icon} size={18} color={MARKET_RED} /></View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function openLaunch(kind: (typeof LAUNCH_ITEMS)[number]["kind"], brand?: Brand) {
  if (!brand) return router.push("/brand/founder");
  if (kind === "listing") return router.push({ pathname: "/brand/list", params: { id: brand.id } });
  if (kind === "collection") return router.push({ pathname: "/brand/collections", params: { id: brand.id } });
  return router.push({ pathname: "/brand/announcement", params: { id: brand.id } });
}

function DraftShelf({ brand, drafts, styles }: { brand?: Brand; drafts: ReturnType<typeof useBrandListingDrafts>; styles: ScreenStyles }) {
  const draft = drafts[0];
  const title = draft?.name?.trim() || (brand ? "Your next drop" : "Weekend edit");
  const meta = draft ? "Continue your listing" : brand ? "Start a saved listing" : "Start your first draft";
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Saved draft</Text><Pressable onPress={() => brand ? router.push({ pathname: "/brand/drafts", params: { id: brand.id } }) : router.push("/brand/founder")}><Text style={styles.seeAll}>See all <Text style={styles.seeAllArrow}>›</Text></Text></Pressable></View>
      <Pressable
        onPress={() => draft && brand ? router.push({ pathname: "/brand/list", params: { id: brand.id, draftId: draft.id } }) : router.push("/brand/founder")}
        style={({ pressed }) => [styles.draftCard, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Continue ${title}`}
      >
        <Image source={DRAFT_IMAGE} style={styles.draftImage} contentFit="cover" cachePolicy="memory-disk" />
        <View style={styles.draftCopy}><Text style={styles.draftTitle} numberOfLines={1}>{title}</Text><Text style={styles.draftMeta}>{meta}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: draft ? "60%" : "18%" }]} /></View></View>
        <View style={styles.continueButton}><Text style={styles.continueText}>Continue</Text><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></View>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: PAPER },
    content: { paddingHorizontal: 18 },
    utilityHeader: { height: 46, flexDirection: "row", alignItems: "center", gap: 8 },
    utilityButton: { width: 38, height: 40, alignItems: "center", justifyContent: "center" },
    utilitySpacer: { flex: 1 },
    wordmark: { color: INK, fontSize: 24, fontWeight: "900", letterSpacing: -1 },
    pageTitleBlock: { marginTop: 8, marginBottom: 16 },
    pageTitle: { color: INK, fontSize: 42, lineHeight: 47, fontWeight: "900", letterSpacing: -1.5 },
    pageSubtitle: { color: MUTED, fontSize: 16, lineHeight: 21, marginTop: 3, fontWeight: "600" },
    hero: { height: 342, borderRadius: 25, overflow: "hidden", backgroundColor: MARKET_RED, position: "relative", marginBottom: 25 },
    heroModel: { position: "absolute", right: -26, bottom: -28, width: "72%", height: "92%" },
    heroCopy: { position: "absolute", left: 20, top: 24, zIndex: 3 },
    heroKicker: { color: "#FFD7DD", fontSize: 10, fontWeight: "900", letterSpacing: 1.7 },
    heroTitle: { color: "#FFFFFF", fontSize: 34, lineHeight: 34, fontWeight: "900", letterSpacing: -1, marginTop: 10 },
    heroButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 23, paddingHorizontal: 17, paddingVertical: 12, marginTop: 21 },
    heroButtonText: { color: MARKET_RED, fontSize: 14, fontWeight: "900" },
    heroBurstOne: { position: "absolute", width: 130, height: 18, borderRadius: 9, backgroundColor: "#F47C6B", right: 24, top: 37, transform: [{ rotate: "-20deg" }] },
    heroBurstTwo: { position: "absolute", width: 70, height: 15, borderRadius: 8, backgroundColor: "#FFB36C", right: 68, top: 72, transform: [{ rotate: "35deg" }] },
    heroSticker: { position: "absolute", zIndex: 4, backgroundColor: "#FFFFFF", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 4, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 4, shadowOffset: { width: 1, height: 2 }, elevation: 3 },
    heroStickerText: { color: INK, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
    heroStickerIdea: { right: 148, top: 61, transform: [{ rotate: "-8deg" }] },
    heroStickerDrop: { right: 37, top: 129, transform: [{ rotate: "8deg" }] },
    heroStickerBrand: { right: 22, bottom: 31, transform: [{ rotate: "-6deg" }] },
    section: { marginBottom: 25 },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
    sectionTitle: { color: INK, fontSize: 24, lineHeight: 29, fontWeight: "900", letterSpacing: -0.6 },
    seeAll: { color: MARKET_RED, fontSize: 13, fontWeight: "900" },
    seeAllArrow: { fontSize: 19 },
    launchGrid: { flexDirection: "row", gap: 8 },
    launchCard: { flex: 1, minHeight: 200, borderRadius: 16, overflow: "hidden", paddingTop: 13, position: "relative" },
    launchCardPink: { backgroundColor: PINK },
    launchCardYellow: { backgroundColor: PALE_YELLOW },
    launchCardPeach: { backgroundColor: PEACH },
    launchCardTop: { paddingHorizontal: 12, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 3 },
    launchTitle: { color: INK, fontSize: 15, lineHeight: 17, fontWeight: "900", flex: 1 },
    launchBody: { color: MUTED, fontSize: 11, lineHeight: 14, paddingHorizontal: 12, marginTop: 4 },
    launchImage: { position: "absolute", left: 0, right: 0, bottom: 0, height: 106, width: "100%", opacity: 0.92 },
    launchIcon: { position: "absolute", left: 10, bottom: 10, width: 29, height: 29, borderRadius: 15, backgroundColor: "#FFFFFFE8", alignItems: "center", justifyContent: "center" },
    draftCard: { minHeight: 102, flexDirection: "row", alignItems: "center", overflow: "hidden", borderRadius: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5DFDD", paddingRight: 11 },
    draftImage: { width: 104, height: 102 },
    draftCopy: { flex: 1, minWidth: 0, paddingHorizontal: 13 },
    draftTitle: { color: INK, fontSize: 16, fontWeight: "900" },
    draftMeta: { color: MUTED, fontSize: 11, marginTop: 4 },
    progressTrack: { height: 5, borderRadius: 3, backgroundColor: "#EFE9E7", overflow: "hidden", marginTop: 10 },
    progressFill: { height: "100%", borderRadius: 3, backgroundColor: MARKET_RED },
    continueButton: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: MARKET_RED, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 11 },
    continueText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
    pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  });
}
