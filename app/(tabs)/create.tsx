import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ownedBrand, useBrands, type Brand } from "../../lib/brands";
import { useUvel } from "../../lib/store";
import { MARKET_RED, useColors, useResolvedAppearance, type Colors } from "../../lib/theme";
import { brandListingDraftProgress, useBrandListingDrafts } from "../../lib/brandListingDraft";

const SCREEN_WIDTH = Dimensions.get("window").width;
const LAUNCH_IMAGES = [
  require("../../assets/create/listing-cutout.png"),
  require("../../assets/create/collection-cutout.png"),
  require("../../assets/create/brand-cutout.png"),
];
const PINK = "#FCE8EC";
const PALE_YELLOW = "#FFF2E6";
const PEACH = "#FCE9EF";

const BANNERS = [
  {
    poster: require("../../assets/create/hero-poster-bg-ruby.jpg"),
    image: require("../../assets/create/hero-model-ruby.png"),
    background: "#A71332",
    title: "Your next",
    script: "big idea",
    finish: "starts here",
    titleColor: "#FFFFFF",
    scriptColor: "#FFA0AE",
    burst: "#FFB35C",
    tags: ["IDEA", "DROP", "BRAND"],
  },
  {
    poster: require("../../assets/create/hero-poster-bg-gold.jpg"),
    image: require("../../assets/create/hero-model-gold.png"),
    background: "#E4AD25",
    title: "Build your",
    script: "collection",
    finish: "your way",
    titleColor: "#26170B",
    scriptColor: "#8E2335",
    burst: "#FFF2C8",
    tags: ["PICK", "MIX", "STYLE"],
  },
  {
    poster: require("../../assets/create/hero-poster-bg-green.jpg"),
    image: require("../../assets/create/hero-model-green.png"),
    background: "#9EC943",
    title: "Make it",
    script: "your brand",
    finish: "your rules",
    titleColor: "#18331C",
    scriptColor: "#00694E",
    burst: "#FFD45F",
    tags: ["VISION", "VOICE", "BRAND"],
  },
] as const;

const LAUNCH_ITEMS = [
  { title: "One product", body: "List it fast", kind: "listing" as const },
  { title: "A collection", body: "Build a story", kind: "collection" as const },
  { title: "A brand", body: "Make it yours", kind: "brand" as const },
];

type ScreenStyles = ReturnType<typeof makeStyles>;

export default function Create() {
  const baseColors = useColors();
  const appearance = useResolvedAppearance();
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const [fontLoaded] = useFonts({ UvelAllura: require("../../assets/fonts/Allura-Regular.ttf") });
  useBrands();
  const brand = ownedBrand(app.uid);
  const drafts = useBrandListingDrafts(brand?.id);
  const colors = useMemo(() => baseColors, [baseColors]);
  const styles = useMemo(() => makeStyles(colors, SCREEN_WIDTH, fontLoaded), [colors, fontLoaded]);

  return (
    <View style={styles.page}>
      <StatusBar style={appearance === "dark" ? "light" : "dark"} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 88 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.collageIntro} accessibilityRole="image" accessibilityLabel="Floating collage of a red leather jacket, handbag, and megaphone">
          <Image source={require("../../assets/create/header-collage-compact.png")} style={styles.collageIntroImage} contentFit="cover" cachePolicy="memory-disk" accessible={false} />
        </View>
        <HeroCarousel brand={brand} styles={styles} fontLoaded={fontLoaded} />
        <LaunchShelf brand={brand} styles={styles} />
        <DraftShelf brand={brand} drafts={drafts} styles={styles} />
      </ScrollView>
    </View>
  );
}

function HeroCarousel({ brand, styles, fontLoaded }: { brand?: Brand; styles: ScreenStyles; fontLoaded: boolean }) {
  const [index, setIndex] = useState(0);
  const transition = useRef(new Animated.Value(0)).current;
  const banner = BANNERS[index];

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(transition, { toValue: 1, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        setIndex((current) => (current + 1) % BANNERS.length);
        transition.setValue(-1);
        Animated.timing(transition, { toValue: 0, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      });
    }, 5000);
    return () => {
      clearInterval(timer);
      transition.stopAnimation();
    };
  }, [transition]);

  const slideStyle = {
    opacity: transition.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
    transform: [{ translateX: transition.interpolate({ inputRange: [-1, 0, 1], outputRange: [30, 0, -20] }) }],
  };

  return (
    <View style={[styles.hero, { backgroundColor: banner.background }]}>
      <Animated.View style={[styles.heroSlide, slideStyle]}>
        <Image source={banner.poster} style={styles.heroBackdrop} contentFit="cover" cachePolicy="memory-disk" />
        <Image source={banner.image} style={styles.heroModel} contentFit="contain" cachePolicy="memory-disk" />
        <View style={styles.heroCopy}>
          <Text style={[styles.heroTitle, { color: banner.titleColor }]}>{banner.title}</Text>
          <Text style={[styles.heroScript, { color: banner.scriptColor, fontFamily: fontLoaded ? "UvelAllura" : "Georgia" }]}>{banner.script}</Text>
          <Text style={[styles.heroTitle, styles.heroFinish, { color: banner.titleColor }]}>{banner.finish}</Text>
          <View style={[styles.heroUnderline, { backgroundColor: banner.burst }]} />
          <Pressable onPress={() => router.push("/brand/founder")} style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Start creating">
            <Text style={styles.heroButtonText}>Start creating</Text><Ionicons name="chevron-forward" size={20} color={MARKET_RED} />
          </Pressable>
        </View>
        <View style={[styles.sticker, styles.stickerIdea, { transform: [{ rotate: "8deg" }] }]}><Text style={styles.stickerText}>{banner.tags[0]}</Text></View>
        <View style={[styles.sticker, styles.stickerDrop, { backgroundColor: banner.burst, transform: [{ rotate: "-10deg" }] }]}><Text style={styles.stickerText}>{banner.tags[1]}</Text></View>
        <View style={[styles.sticker, styles.stickerBrand, { transform: [{ rotate: "-6deg" }] }]}><Text style={styles.stickerText}>{brand ? "YOUR BRAND" : banner.tags[2]}</Text></View>
        <View style={[styles.burstOne, { backgroundColor: banner.burst }]} /><View style={[styles.burstTwo, { backgroundColor: banner.burst }]} /><View style={styles.burstThree} />
      </Animated.View>
    </View>
  );
}

function LaunchShelf({ brand, styles }: { brand?: Brand; styles: ScreenStyles }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Choose your launch</Text>
      <View style={styles.launchGrid}>
        {LAUNCH_ITEMS.map((item, index) => (
          <Pressable key={item.title} onPress={() => openLaunch(item.kind, brand)} style={({ pressed }) => [styles.launchCard, index === 0 ? styles.cardPink : index === 1 ? styles.cardYellow : styles.cardPeach, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${item.title}: ${item.body}`}>
            <Text style={styles.launchTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.launchBody}>{item.body}</Text>
            <Image source={LAUNCH_IMAGES[index]} style={styles.launchImage} contentFit="contain" cachePolicy="memory-disk" />
            {index === 2 ? <Text style={styles.brandCardLabel}>YOUR{"\n"}BRAND{"\n"}HERE</Text> : null}
            <View style={styles.launchArrow}><Ionicons name="chevron-forward" size={18} color="#171717" /></View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DraftShelf({ brand, drafts, styles }: { brand?: Brand; drafts: ReturnType<typeof useBrandListingDrafts>; styles: ScreenStyles }) {
  if (!brand) return null;
  const draft = drafts[0];
  if (!draft) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saved drafts</Text>
        <View style={styles.draftEmptyCard}>
          <View style={styles.draftEmptyIcon}><Ionicons name="shirt-outline" size={22} color={MARKET_RED} /></View>
          <Text style={styles.draftEmptyTitle}>No unfinished products yet</Text>
          <Text style={styles.draftEmptyBody}>Start listing a piece for {brand.name}. Anything you leave unfinished will be saved here.</Text>
          <Pressable onPress={() => router.push({ pathname: "/brand/list", params: { id: brand.id } })} style={({ pressed }) => [styles.emptyDraftButton, pressed && styles.pressed]} accessibilityRole="button">
            <Text style={styles.emptyDraftButtonText}>Start a product listing</Text><Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    );
  }
  const title = draft.name.trim() || "Untitled product";
  const completion = brandListingDraftProgress(draft);
  const updated = new Date(draft.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const meta = `${draft.photos.length ? `${draft.photos.length} photo${draft.photos.length === 1 ? "" : "s"}` : "No photos yet"} · Updated ${updated}`;
  return (
    <View style={styles.section}>
      <View style={styles.draftHeading}><Text style={[styles.sectionTitle, styles.draftSectionTitle]}>Pick up where you left off</Text><Text style={styles.draftCount}>{drafts.length} saved</Text></View>
      <Pressable onPress={() => router.push({ pathname: "/brand/list", params: { id: brand.id, draftId: draft.id } })} style={({ pressed }) => [styles.draftCard, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Continue ${title}, ${completion}% complete`}>
        {draft.photos[0]?.uri ? <Image source={{ uri: draft.photos[0].uri }} style={styles.draftImage} contentFit="cover" cachePolicy="memory-disk" /> : <View style={styles.draftImagePlaceholder}><Ionicons name="shirt-outline" size={25} color={MARKET_RED} /></View>}
        <View style={styles.draftCopy}>
          <Text style={styles.draftTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.draftMeta} numberOfLines={1}>{meta}</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${completion}%` }]} /></View>
          <Text style={styles.draftProgressText}>{completion}% complete</Text>
        </View>
        <View style={styles.continueButton}><Text style={styles.continueText}>Continue</Text><Ionicons name="chevron-forward" size={18} color="#FFFFFF" /></View>
      </Pressable>
      <Pressable onPress={() => router.push({ pathname: "/brand/drafts", params: { id: brand.id } })} style={({ pressed }) => [styles.allDraftsButton, pressed && styles.pressed]} accessibilityRole="button">
        <Text style={styles.allDraftsText}>See all {drafts.length === 1 ? "saved drafts" : `${drafts.length} saved drafts`}</Text><Ionicons name="arrow-forward" size={16} color={MARKET_RED} />
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

function makeStyles(colors: Colors, width: number, _fontLoaded: boolean) {
  const dark = colors.ink !== "#FFFFFF";
  const horizontal = Math.max(14, Math.min(22, width * 0.042));
  const collageHeight = Math.max(112, Math.min(120, width * 0.30));
  const heroHeight = Math.max(230, Math.min(278, width * 0.64));
  const cardHeight = Math.max(164, Math.min(184, width * 0.42));
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: dark ? colors.ink : "#FFFEFC" },
    scroll: { flex: 1 },
    content: { paddingHorizontal: horizontal },
    collageIntro: { height: collageHeight, width: "100%", marginBottom: 5, overflow: "hidden", position: "relative" },
    collageIntroImage: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
    hero: { height: heroHeight, borderRadius: 19, overflow: "hidden", position: "relative", marginBottom: 16 },
    heroSlide: { ...StyleSheet.absoluteFill, overflow: "hidden" },
    heroBackdrop: { ...StyleSheet.absoluteFill, zIndex: 0 },
    heroModel: { position: "absolute", right: -28, bottom: -88, width: "110%", height: "160%" },
    heroCopy: { position: "absolute", left: 17, top: 27, zIndex: 3, width: "61%" },
    heroTitle: { fontSize: 27, lineHeight: 30, fontWeight: "900", letterSpacing: -0.8 },
    heroScript: { fontSize: 49, lineHeight: 46, fontWeight: "700", marginTop: -2, marginBottom: -2 },
    heroFinish: { fontSize: 26, lineHeight: 30 },
    heroUnderline: { width: "82%", height: 3, borderRadius: 4, transform: [{ rotate: "-3deg" }], marginTop: 2, marginLeft: 48 },
    heroButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FFFFFF", borderRadius: 24, paddingHorizontal: 15, paddingVertical: 9, marginTop: 14 },
    heroButtonText: { color: MARKET_RED, fontSize: 14, fontWeight: "900" },
    sticker: { position: "absolute", zIndex: 4, backgroundColor: "#FFFFFF", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 4, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 1, height: 2 }, elevation: 3 },
    stickerText: { color: "#141313", fontSize: 10, fontWeight: "900", letterSpacing: 0.25 },
    stickerIdea: { right: "38%", top: 30 },
    stickerDrop: { right: 12, top: Math.round(heroHeight * 0.39) },
    stickerBrand: { right: 10, bottom: 22 },
    burstOne: { position: "absolute", right: 76, top: 14, width: 5, height: 19, borderRadius: 4, transform: [{ rotate: "-28deg" }] },
    burstTwo: { position: "absolute", right: 58, top: 20, width: 5, height: 18, borderRadius: 4, transform: [{ rotate: "-12deg" }] },
    burstThree: { position: "absolute", right: 20, top: Math.round(heroHeight * 0.25), width: 5, height: 21, borderRadius: 4, backgroundColor: "#FFFFFF", transform: [{ rotate: "23deg" }] },
    section: { marginBottom: 17 },
    sectionTitle: { color: dark ? colors.bone : "#111111", fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -0.7, marginBottom: 8 },
    launchGrid: { flexDirection: "row", gap: 8 },
    launchCard: { flex: 1, height: cardHeight, borderRadius: 15, overflow: "hidden", paddingTop: 12, position: "relative" },
    cardPink: { backgroundColor: dark ? "#3A2027" : PINK },
    cardYellow: { backgroundColor: dark ? "#3A3422" : PALE_YELLOW },
    cardPeach: { backgroundColor: dark ? "#3D2923" : PEACH },
    launchTitle: { color: dark ? "#FFFFFF" : "#141313", fontSize: width < 375 ? 14 : 16, lineHeight: 19, fontWeight: "900", paddingHorizontal: 11, letterSpacing: -0.4 },
    launchBody: { color: dark ? "#D8CDD0" : "#6F6A69", fontSize: 11, lineHeight: 14, paddingHorizontal: 11, marginTop: 1 },
    launchImage: { position: "absolute", left: 2, right: 2, bottom: 5, height: "66%", width: "96%" },
    brandCardLabel: { position: "absolute", right: 11, bottom: 39, width: "43%", color: "#151515", fontFamily: "Georgia", fontSize: 9, lineHeight: 10, fontStyle: "italic", fontWeight: "900", textAlign: "center", transform: [{ rotate: "-8deg" }] },
    launchArrow: { position: "absolute", right: 8, bottom: 8, width: 30, height: 30, borderRadius: 16, backgroundColor: "#FFFFFFE8", alignItems: "center", justifyContent: "center" },
    draftCard: { minHeight: 88, flexDirection: "row", alignItems: "center", overflow: "hidden", borderRadius: 14, backgroundColor: dark ? colors.surface : "#FFFFFF", borderWidth: 1, borderColor: dark ? `${colors.subtle}55` : "#E9E6E5", paddingRight: 9 },
    draftHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    draftSectionTitle: { marginBottom: 0, flex: 1 },
    draftCount: { color: dark ? colors.muted : "#707070", fontSize: 11, fontWeight: "700", marginLeft: 8 },
    draftImage: { width: 76, height: 88 },
    draftImagePlaceholder: { width: 76, height: 88, alignItems: "center", justifyContent: "center", backgroundColor: dark ? "#33272A" : "#FCE8EC" },
    draftCopy: { flex: 1, minWidth: 0, paddingHorizontal: 11 },
    draftTitle: { color: dark ? colors.bone : "#151515", fontSize: 14, fontWeight: "900" },
    draftMeta: { color: dark ? colors.muted : "#707070", fontSize: 11, marginTop: 2 },
    draftProgressText: { color: dark ? colors.muted : "#707070", fontSize: 10, marginTop: 4 },
    progressTrack: { height: 5, borderRadius: 3, backgroundColor: dark ? "#343841" : "#EFE9E7", overflow: "hidden", marginTop: 7 },
    progressFill: { height: "100%", borderRadius: 3, backgroundColor: MARKET_RED },
    continueButton: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: MARKET_RED, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 10 },
    continueText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
    allDraftsButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, minHeight: 38, marginTop: 4 },
    allDraftsText: { color: MARKET_RED, fontSize: 12, fontWeight: "800" },
    draftEmptyCard: { alignItems: "center", borderRadius: 14, borderWidth: 1, borderColor: dark ? `${colors.subtle}55` : "#E9E6E5", backgroundColor: dark ? colors.surface : "#FFFFFF", paddingHorizontal: 20, paddingVertical: 18 },
    draftEmptyIcon: { width: 42, height: 42, borderRadius: 22, backgroundColor: dark ? "#33272A" : "#FCE8EC", alignItems: "center", justifyContent: "center" },
    draftEmptyTitle: { color: dark ? colors.bone : "#151515", fontSize: 15, fontWeight: "900", marginTop: 10 },
    draftEmptyBody: { color: dark ? colors.muted : "#707070", fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 4 },
    emptyDraftButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: MARKET_RED, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, marginTop: 13 },
    emptyDraftButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
    pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  });
}
