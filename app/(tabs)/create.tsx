import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ownedBrand, useBrands, type Brand } from "../../lib/brands";
import { useUvel } from "../../lib/store";
import { MARKET_RED, useColors, useResolvedAppearance, type Colors } from "../../lib/theme";
import { useBrandListingDrafts } from "../../lib/brandListingDraft";

const HERO_IMAGE = require("../../assets/create/red-launchpad-hero.png");
const LAUNCH_IMAGES = [
  require("../../assets/create/listing.jpg"),
  require("../../assets/create/collection.jpg"),
  require("../../assets/create/announcement.jpg"),
];
const DRAFT_IMAGE = require("../../assets/create/draft.jpg");
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
  const appearance = useResolvedAppearance();
  const insets = useSafeAreaInsets();
  const app = useUvel();
  useBrands();
  const brand = ownedBrand(app.uid);
  const drafts = useBrandListingDrafts(brand?.id);
  const colors = useMemo(() => baseColors, [baseColors]);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.page}>
      <StatusBar style={appearance === "dark" ? "light" : "dark"} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 92 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <CreateHeader styles={styles} />
        <View style={styles.intro}>
          <Text style={styles.title}>Create</Text>
          <Text style={styles.subtitle}>Make something worth talking about.</Text>
        </View>
        <Hero brand={brand} styles={styles} />
        <LaunchShelf brand={brand} styles={styles} />
        <DraftShelf brand={brand} drafts={drafts} styles={styles} />
      </ScrollView>
    </View>
  );
}

function CreateHeader({ styles }: { styles: ScreenStyles }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.push("/you")} style={styles.menuButton} accessibilityRole="button" accessibilityLabel="Open menu">
        <Ionicons name="menu-outline" size={31} color={styles.menuIcon.color} />
      </Pressable>
    </View>
  );
}

function Hero({ brand, styles }: { brand?: Brand; styles: ScreenStyles }) {
  return (
    <Pressable onPress={() => router.push("/brand/founder")} style={({ pressed }) => [styles.hero, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Start creating">
      <View style={styles.heroBurstOne} />
      <View style={styles.heroBurstTwo} />
      <Image source={HERO_IMAGE} style={styles.heroModel} contentFit="contain" cachePolicy="memory-disk" />
      <View style={styles.heroCopy}>
        <Text style={styles.heroKicker}>{brand ? "YOUR BRAND · NEXT DROP" : "IDEA · DROP · BRAND"}</Text>
        <Text style={styles.heroTitle}>Your next{`\n`}big thing{`\n`}starts here</Text>
        <View style={styles.heroButton}><Text style={styles.heroButtonText}>Start creating</Text><Ionicons name="arrow-forward" size={19} color={MARKET_RED} /></View>
      </View>
      <View style={[styles.sticker, styles.stickerIdea]}><Text style={styles.stickerText}>IDEA</Text></View>
      <View style={[styles.sticker, styles.stickerDrop]}><Text style={styles.stickerText}>DROP</Text></View>
      <View style={[styles.sticker, styles.stickerBrand]}><Text style={styles.stickerText}>BRAND</Text></View>
    </Pressable>
  );
}

function LaunchShelf({ brand, styles }: { brand?: Brand; styles: ScreenStyles }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Choose your launch</Text>
      <View style={styles.launchGrid}>
        {LAUNCH_ITEMS.map((item, index) => (
          <Pressable key={item.title} onPress={() => openLaunch(item.kind, brand)} style={({ pressed }) => [styles.launchCard, index === 0 ? styles.cardPink : index === 1 ? styles.cardYellow : styles.cardPeach, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${item.title}: ${item.body}`}>
            <View style={styles.launchHeader}><Text style={styles.launchTitle}>{item.title}</Text><Ionicons name="chevron-forward" size={17} color={MARKET_RED} /></View>
            <Text style={styles.launchBody}>{item.body}</Text>
            <Image source={LAUNCH_IMAGES[index]} style={styles.launchImage} contentFit="cover" cachePolicy="memory-disk" />
            <View style={styles.launchIcon}><Ionicons name={item.icon} size={18} color={MARKET_RED} /></View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DraftShelf({ brand, drafts, styles }: { brand?: Brand; drafts: ReturnType<typeof useBrandListingDrafts>; styles: ScreenStyles }) {
  const draft = drafts[0];
  const title = draft?.name?.trim() || (brand ? "Your next drop" : "Weekend edit");
  const meta = draft ? "Continue your listing" : brand ? "Start a saved listing" : "Start your first draft";
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Saved draft</Text><Pressable onPress={() => brand ? router.push({ pathname: "/brand/drafts", params: { id: brand.id } }) : router.push("/brand/founder")} accessibilityRole="button" accessibilityLabel="See all saved drafts"><Text style={styles.seeAll}>See all <Text style={styles.seeAllArrow}>›</Text></Text></Pressable></View>
      <Pressable onPress={() => draft && brand ? router.push({ pathname: "/brand/list", params: { id: brand.id, draftId: draft.id } }) : router.push("/brand/founder")} style={({ pressed }) => [styles.draftCard, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Continue ${title}`}>
        <Image source={DRAFT_IMAGE} style={styles.draftImage} contentFit="cover" cachePolicy="memory-disk" />
        <View style={styles.draftCopy}><Text style={styles.draftTitle} numberOfLines={1}>{title}</Text><Text style={styles.draftMeta}>{meta}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: draft ? "60%" : "18%" }]} /></View></View>
        <View style={styles.continueButton}><Text style={styles.continueText}>Continue</Text><Ionicons name="arrow-forward" size={17} color="#FFFFFF" /></View>
      </Pressable>
    </View>
  );
}

function openLaunch(kind: (typeof LAUNCH_ITEMS)[number]["kind"], brand?: Brand) {
  if (!brand) return router.push("/brand/founder");
  if (kind === "listing") return router.push({ pathname: "/brand/list", params: { id: brand.id } });
  if (kind === "collection") return router.push({ pathname: "/brand/collections", params: { id: brand.id } });
  return router.push({ pathname: "/brand/announcement", params: { id: brand.id } });
}

function makeStyles(colors: Colors) {
  const dark = colors.ink !== "#FFFFFF";
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 18 },
    header: { height: 38, flexDirection: "row", alignItems: "center" },
    menuButton: { width: 40, height: 38, justifyContent: "center" },
    menuIcon: { color: colors.bone },
    intro: { marginTop: 7, marginBottom: 16 },
    title: { color: colors.bone, fontSize: 42, lineHeight: 46, fontWeight: "900", letterSpacing: -1.5 },
    subtitle: { color: colors.muted, fontSize: 16, lineHeight: 21, fontWeight: "600", marginTop: 3 },
    hero: { height: 330, borderRadius: 24, overflow: "hidden", backgroundColor: MARKET_RED, position: "relative", marginBottom: 24 },
    heroModel: { position: "absolute", right: -24, bottom: -30, width: "72%", height: "94%" },
    heroCopy: { position: "absolute", left: 19, top: 23, zIndex: 3 },
    heroKicker: { color: "#FFD7DD", fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
    heroTitle: { color: "#FFFFFF", fontSize: 33, lineHeight: 33, fontWeight: "900", letterSpacing: -1, marginTop: 10 },
    heroButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 23, paddingHorizontal: 17, paddingVertical: 11, marginTop: 20 },
    heroButtonText: { color: MARKET_RED, fontSize: 14, fontWeight: "900" },
    heroBurstOne: { position: "absolute", width: 125, height: 17, borderRadius: 9, backgroundColor: "#F47C6B", right: 23, top: 34, transform: [{ rotate: "-20deg" }] },
    heroBurstTwo: { position: "absolute", width: 70, height: 14, borderRadius: 8, backgroundColor: "#FFB36C", right: 65, top: 68, transform: [{ rotate: "35deg" }] },
    sticker: { position: "absolute", zIndex: 4, backgroundColor: "#FFFFFF", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 4, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 4, shadowOffset: { width: 1, height: 2 }, elevation: 3 },
    stickerText: { color: "#141313", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
    stickerIdea: { right: 142, top: 58, transform: [{ rotate: "-8deg" }] },
    stickerDrop: { right: 34, top: 124, transform: [{ rotate: "8deg" }] },
    stickerBrand: { right: 20, bottom: 28, transform: [{ rotate: "-6deg" }] },
    section: { marginBottom: 24 },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
    sectionTitle: { color: colors.bone, fontSize: 24, lineHeight: 29, fontWeight: "900", letterSpacing: -0.6, marginBottom: 11 },
    seeAll: { color: dark ? "#FF8797" : MARKET_RED, fontSize: 13, fontWeight: "900" },
    seeAllArrow: { fontSize: 19 },
    launchGrid: { flexDirection: "row", gap: 8 },
    launchCard: { flex: 1, minHeight: 196, borderRadius: 16, overflow: "hidden", paddingTop: 13, position: "relative" },
    cardPink: { backgroundColor: dark ? "#3A2027" : PINK },
    cardYellow: { backgroundColor: dark ? "#3A3422" : PALE_YELLOW },
    cardPeach: { backgroundColor: dark ? "#3D2923" : PEACH },
    launchHeader: { paddingHorizontal: 11, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 3 },
    launchTitle: { color: dark ? "#FFFFFF" : "#141313", fontSize: 15, lineHeight: 17, fontWeight: "900", flex: 1 },
    launchBody: { color: dark ? "#D8CDD0" : "#6F6A69", fontSize: 11, lineHeight: 14, paddingHorizontal: 11, marginTop: 4 },
    launchImage: { position: "absolute", left: 0, right: 0, bottom: 0, height: 105, width: "100%", opacity: 0.94 },
    launchIcon: { position: "absolute", left: 9, bottom: 9, width: 29, height: 29, borderRadius: 15, backgroundColor: "#FFFFFFE8", alignItems: "center", justifyContent: "center" },
    draftCard: { minHeight: 102, flexDirection: "row", alignItems: "center", overflow: "hidden", borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.subtle}55`, paddingRight: 11 },
    draftImage: { width: 104, height: 102 },
    draftCopy: { flex: 1, minWidth: 0, paddingHorizontal: 13 },
    draftTitle: { color: colors.bone, fontSize: 16, fontWeight: "900" },
    draftMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
    progressTrack: { height: 5, borderRadius: 3, backgroundColor: dark ? "#343841" : "#EFE9E7", overflow: "hidden", marginTop: 10 },
    progressFill: { height: "100%", borderRadius: 3, backgroundColor: MARKET_RED },
    continueButton: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: MARKET_RED, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 11 },
    continueText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
    pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  });
}
