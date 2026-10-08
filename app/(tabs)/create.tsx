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
import { useBrandListingDrafts } from "../../lib/brandListingDraft";

const SCREEN_WIDTH = Dimensions.get("window").width;
const LAUNCH_IMAGES = [
  require("../../assets/create/listing-cutout.png"),
  require("../../assets/create/collection-cutout.png"),
  require("../../assets/create/brand-cutout.png"),
];
const DRAFT_IMAGE = require("../../assets/create/draft-leather-thumbnail.jpg");
const PINK = "#FCE8EC";
const PALE_YELLOW = "#FFF2E6";
const PEACH = "#FCE9EF";

const BANNERS = [
  {
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
        <View style={styles.intro}>
          <Text style={styles.title}>Create</Text>
          <Text style={styles.subtitle}>Make something worth talking about.</Text>
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
  const draft = drafts[0];
  const title = draft?.name?.trim() || (brand ? "Your next drop" : "Leather edit");
  const meta = draft ? "Continue your listing" : brand ? "Start a saved listing" : "60% complete";
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Saved draft</Text>
      <Pressable onPress={() => draft && brand ? router.push({ pathname: "/brand/list", params: { id: brand.id, draftId: draft.id } }) : router.push("/brand/founder")} style={({ pressed }) => [styles.draftCard, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Continue ${title}`}>
        <Image source={DRAFT_IMAGE} style={styles.draftImage} contentFit="cover" cachePolicy="memory-disk" />
        <View style={styles.draftCopy}><Text style={styles.draftTitle} numberOfLines={1}>{title}</Text><Text style={styles.draftMeta}>{meta}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: "60%" }]} /></View></View>
        <View style={styles.continueButton}><Text style={styles.continueText}>Continue</Text><Ionicons name="chevron-forward" size={18} color="#FFFFFF" /></View>
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
  const heroHeight = Math.max(230, Math.min(278, width * 0.64));
  const cardHeight = Math.max(164, Math.min(184, width * 0.42));
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: dark ? colors.ink : "#FFFEFC" },
    scroll: { flex: 1 },
    content: { paddingHorizontal: horizontal },
    intro: { marginTop: 8, marginBottom: 11 },
    title: { color: dark ? colors.bone : "#111111", fontSize: 43, lineHeight: 47, fontWeight: "900", letterSpacing: -1.9 },
    subtitle: { color: dark ? colors.muted : "#5D5D5D", fontSize: 16, lineHeight: 21, fontWeight: "600", marginTop: 0 },
    hero: { height: heroHeight, borderRadius: 19, overflow: "hidden", position: "relative", marginBottom: 16 },
    heroSlide: { ...StyleSheet.absoluteFill, overflow: "hidden" },
    heroModel: { position: "absolute", right: -28, bottom: -40, width: "110%", height: "160%" },
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
    draftCard: { minHeight: 74, flexDirection: "row", alignItems: "center", overflow: "hidden", borderRadius: 14, backgroundColor: dark ? colors.surface : "#FFFFFF", borderWidth: 1, borderColor: dark ? `${colors.subtle}55` : "#E9E6E5", paddingRight: 9 },
    draftImage: { width: 78, height: 74 },
    draftCopy: { flex: 1, minWidth: 0, paddingHorizontal: 11 },
    draftTitle: { color: dark ? colors.bone : "#151515", fontSize: 14, fontWeight: "900" },
    draftMeta: { color: dark ? colors.muted : "#707070", fontSize: 11, marginTop: 2 },
    progressTrack: { height: 5, borderRadius: 3, backgroundColor: dark ? "#343841" : "#EFE9E7", overflow: "hidden", marginTop: 7 },
    progressFill: { height: "100%", borderRadius: 3, backgroundColor: MARKET_RED },
    continueButton: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: MARKET_RED, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 10 },
    continueText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
    pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  });
}
