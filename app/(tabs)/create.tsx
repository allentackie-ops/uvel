import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ownedBrand, themeFor, useBrands, type Brand } from "../../lib/brands";
import { adaptBrandThemeToAppearance } from "../../lib/brandThemes";
import { useUvel } from "../../lib/store";
import { useColors, useResolvedAppearance, type Colors } from "../../lib/theme";
import { useBrandListingDrafts } from "../../lib/brandListingDraft";

const HERO_IMAGE = require("../../assets/catalog/hero.jpg");
const FORMAT_IMAGES = [
  require("../../assets/catalog/trend-utility.jpg"),
  require("../../assets/catalog/oxford-shirt.jpg"),
  require("../../assets/catalog/satin-skirt.jpg"),
];
const FORMAT_ITEMS = [
  { label: "Collection", body: "Launch a curated set of products.", kind: "collection" as const },
  { label: "Listing", body: "Add a single product to your catalog.", kind: "listing" as const },
  { label: "Announcement", body: "Share news, drops, or updates.", kind: "announcement" as const },
];

export default function Create() {
  const baseColors = useColors();
  const appearance = useResolvedAppearance();
  const insets = useSafeAreaInsets();
  const app = useUvel();
  useBrands();
  const brand = ownedBrand(app.uid);
  const colors = useMemo<Colors>(() => {
    if (!brand) return baseColors;
    const theme = adaptBrandThemeToAppearance(themeFor(brand), appearance, baseColors);
    return {
      ...baseColors,
      ink: theme.bg,
      bone: theme.ink,
      muted: theme.muted,
      surface: theme.card,
      subtle: theme.muted,
      success: theme.accent,
      successInk: theme.accentInk,
      pulse: theme.accent,
      pulseInk: theme.accentInk,
      info: theme.card,
      infoInk: theme.ink,
      neutral: theme.card,
      neutralInk: theme.ink,
    };
  }, [appearance, baseColors, brand]);
  const styles = useMemo(() => make(colors), [colors]);
  const brandDrafts = useBrandListingDrafts(brand?.id);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 112 }]}
      showsVerticalScrollIndicator={false}
    >
      <EditorialHeader brand={brand} styles={styles} />
      {brand && brandDrafts.length ? <Pressable onPress={() => router.push({ pathname: "/brand/drafts", params: { id: brand.id } })} style={styles.draftNotice}><View style={styles.draftNoticeIcon}><Ionicons name="document-text-outline" size={17} color={colors.successInk} /></View><View style={styles.draftNoticeCopy}><Text style={styles.draftNoticeTitle}>You have a saved brand draft</Text><Text style={styles.draftNoticeBody}>Tap to continue your unfinished listing.</Text></View><Ionicons name="arrow-forward" size={17} color={colors.bone} /></Pressable> : null}
      <Hero brand={brand} colors={colors} styles={styles} />
      <FormatShelf brand={brand} colors={colors} styles={styles} />
      <DraftShelf brand={brand} colors={colors} styles={styles} />
      <BusinessShelf brand={brand} colors={colors} styles={styles} />
    </ScrollView>
  );
}

type ScreenStyles = ReturnType<typeof make>;
type SharedProps = { colors: Colors; styles: ScreenStyles };

function EditorialHeader({ brand, styles }: { brand?: Brand; styles: ScreenStyles }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerIdentity}>
        <Text style={styles.kicker}>{brand ? "YOUR BRAND" : "YOUR NEXT IDEA"}</Text>
        <Text style={styles.brandName} numberOfLines={1}>{brand?.name || "Create"}</Text>
      </View>
      {brand ? <BrandLogo brand={brand} styles={styles} size={54} /> : <View style={styles.headerMark}><Ionicons name="sparkles-outline" size={24} color={styles.headerMarkIcon.color} /></View>}
    </View>
  );
}

function Hero({ brand, colors, styles }: SharedProps & { brand?: Brand }) {
  const image = brand?.bannerUri ? { uri: brand.bannerUri } : HERO_IMAGE;
  return (
    <Pressable onPress={() => router.push("/brand/founder")} style={({ pressed }) => [styles.hero, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Open Founder Studio">
      <Image source={image} style={styles.heroImage} contentFit="cover" cachePolicy="memory-disk" />
      <View style={styles.heroShade} />
      <View style={styles.heroCopy}>
        <Text style={styles.heroKicker}>{brand ? "BUILD WHAT’S NEXT" : "START WITH AN IDEA"}</Text>
        <Text style={styles.heroTitle}>{brand ? "Build what’s next\nfor your brand." : "Turn your idea\ninto something real."}</Text>
        <Text style={styles.heroBody}>{brand ? "Shape the next chapter with a clear path from idea to launch." : "A simple place to shape a brand, a product, or your first listing."}</Text>
        <View style={styles.heroRule} />
      </View>
    </Pressable>
  );
}

function FormatShelf({ brand, colors, styles }: SharedProps & { brand?: Brand }) {
  return (
    <Shelf title="Start with a format" styles={styles}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalShelf}>
        {FORMAT_ITEMS.map((item, index) => (
          <Pressable
            key={item.label}
            onPress={() => {
              if (!brand) return router.push("/brand/founder");
              if (item.kind === "collection") return router.push({ pathname: "/brand/collections", params: { id: brand.id } });
              if (item.kind === "listing") return router.push({ pathname: "/brand/list", params: { id: brand.id } });
              return router.push({ pathname: "/brand/announcement", params: { id: brand.id } });
            }}
            style={({ pressed }) => [styles.formatCard, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}: ${item.body}`}
          >
            <Image source={FORMAT_IMAGES[index]} style={styles.formatImage} contentFit="cover" />
            <View style={styles.formatInfo}>
              <View style={styles.cardTitleRow}><Text style={styles.formatTitle}>{item.label}</Text><Ionicons name="arrow-forward" size={18} color={colors.bone} /></View>
              <Text style={styles.formatBody}>{item.body}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Shelf>
  );
}

function DraftShelf({ brand, colors, styles }: SharedProps & { brand?: Brand }) {
  return (
    <Shelf title="Continue a draft" styles={styles}>
      <Pressable
        onPress={() => brand ? router.push({ pathname: "/brand/drafts", params: { id: brand.id } }) : router.push("/brand/founder")}
        style={({ pressed }) => [styles.draftCard, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Open saved drafts"
      >
        <Image source={require("../../assets/catalog/trend-romantic.jpg")} style={styles.draftImage} contentFit="cover" />
        <View style={styles.draftInfo}>
          <View style={styles.statusChip}><Text style={styles.statusText}>DRAFT</Text></View>
          <Text style={styles.draftTitle}>{brand ? "Your brand listing drafts" : "Your next direction"}</Text>
          <Text style={styles.draftMeta}>{brand ? "Resume a saved listing" : "Resume in Founder Studio"}</Text>
        </View>
      </Pressable>
    </Shelf>
  );
}

function BusinessShelf({ brand, colors, styles }: SharedProps & { brand?: Brand }) {
  return (
    <Shelf title="Your business" styles={styles}>
      <View style={styles.businessRow}>
        <BusinessTile
          label="Founder Studio"
          body={brand ? "Develop new ideas, products, and more." : "Shape your idea into a brand."}
          icon="color-palette-outline"
          accent
          colors={colors}
          styles={styles}
          onPress={() => router.push("/brand/founder")}
        />
        <BusinessTile
          label="Brand HQ"
          body={brand ? "Manage catalog, orders, team, and growth." : "Available when your brand is ready."}
          icon="briefcase-outline"
          colors={colors}
          styles={styles}
          onPress={() => brand ? router.push({ pathname: "/brand/hq", params: { id: brand.id } }) : router.push("/brand/founder")}
        />
        <BusinessTile
          label="Insights"
          body="Understand performance and your audience."
          icon="bar-chart-outline"
          colors={colors}
          styles={styles}
          onPress={() => brand ? router.push({ pathname: "/brand/hq", params: { id: brand.id, section: "analytics" } }) : router.push("/brand/founder")}
        />
      </View>
    </Shelf>
  );
}

function BusinessTile({ label, body, icon, accent, colors, styles, onPress }: SharedProps & { label: string; body: string; icon: keyof typeof Ionicons.glyphMap; accent?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.businessTile, accent && styles.businessTileAccent, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${label}: ${body}`}>
      <View style={[styles.tileIcon, accent && styles.tileIconAccent]}><Ionicons name={icon} size={22} color={accent ? colors.successInk : colors.bone} /></View>
      <View style={styles.cardTitleRow}><Text style={[styles.tileTitle, accent && styles.tileTitleAccent]}>{label}</Text><Ionicons name="arrow-forward" size={17} color={accent ? colors.successInk : colors.bone} /></View>
      <Text style={[styles.tileBody, accent && styles.tileBodyAccent]}>{body}</Text>
    </Pressable>
  );
}

function Shelf({ title, action, styles, children }: { title: string; action?: string; styles: ScreenStyles; children: React.ReactNode }) {
  return (
    <View style={styles.shelf}>
      <View style={styles.shelfHeader}><Text style={styles.shelfTitle}>{title}</Text>{action ? <Pressable onPress={() => undefined}><Text style={styles.shelfAction}>{action} <Text style={styles.shelfArrow}>→</Text></Text></Pressable> : null}</View>
      {children}
    </View>
  );
}

function BrandLogo({ brand, styles, size, floating }: { brand: Brand; styles: ScreenStyles; size: number; floating?: boolean }) {
  return (
    <View style={[styles.logoFrame, { width: size, height: size, borderRadius: floating ? 18 : 16 }, floating && styles.floatingLogo]}>
      {brand.logoUri ? <Image source={{ uri: brand.logoUri }} style={styles.logoImage} contentFit="contain" cachePolicy="memory-disk" /> : <Text style={styles.logoInitial}>{brand.name.slice(0, 1).toUpperCase()}</Text>}
    </View>
  );
}

function make(colors: Colors) {
  const light = colors.ink !== "#000000";
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingHorizontal: 18 },
    draftNotice: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.success + "66", borderRadius: 16, padding: 12, marginBottom: 18 },
    draftNoticeIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    draftNoticeCopy: { flex: 1 },
    draftNoticeTitle: { color: colors.bone, fontSize: 13, fontWeight: "900" },
    draftNoticeBody: { color: colors.muted, fontSize: 11, marginTop: 2 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
    headerIdentity: { flex: 1, paddingRight: 14 },
    kicker: { color: colors.subtle, fontSize: 10, letterSpacing: 2.8, fontWeight: "800" },
    brandName: { color: colors.bone, fontSize: 40, lineHeight: 45, fontWeight: "800", letterSpacing: -1.2, marginTop: 5 },
    headerMark: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    headerMarkIcon: { color: colors.success },
    logoFrame: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.subtle + "55", overflow: "hidden", alignItems: "center", justifyContent: "center" },
    logoImage: { width: "100%", height: "100%" },
    logoInitial: { color: colors.bone, fontSize: 23, fontWeight: "800" },
    floatingLogo: { position: "absolute", right: 16, top: 16, borderColor: colors.bone + "AA", backgroundColor: colors.ink },
    hero: { height: 305, borderRadius: 26, overflow: "hidden", backgroundColor: colors.surface, marginBottom: 28 },
    heroImage: StyleSheet.absoluteFill,
    heroShade: { ...StyleSheet.absoluteFill, backgroundColor: light ? "rgba(247,246,242,0.16)" : "rgba(0,0,0,0.34)" },
    heroCopy: { position: "absolute", left: 20, right: 20, bottom: 20 },
    heroKicker: { color: light ? colors.bone : colors.success, fontSize: 10, letterSpacing: 2.6, fontWeight: "800" },
    heroTitle: { color: light ? colors.bone : colors.bone, fontSize: 31, lineHeight: 34, fontWeight: "800", letterSpacing: -0.8, marginTop: 8 },
    heroBody: { color: light ? colors.bone : colors.muted, fontSize: 14, lineHeight: 20, marginTop: 9, maxWidth: 290 },
    heroRule: { width: 42, height: 2, backgroundColor: colors.success, marginTop: 16 },
    heroTap: { position: "absolute", right: 18, bottom: 18, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.ink + "B8", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 },
    heroTapText: { color: colors.bone, fontSize: 11, fontWeight: "800" },
    shelf: { marginBottom: 27 },
    shelfHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    shelfTitle: { color: colors.bone, fontSize: 25, lineHeight: 30, fontWeight: "700", letterSpacing: -0.5 },
    shelfAction: { color: colors.bone, fontSize: 13, fontWeight: "700" },
    shelfArrow: { fontSize: 18 },
    horizontalShelf: { gap: 12, paddingRight: 18 },
    formatCard: { width: 194, borderRadius: 18, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.subtle + "32" },
    formatImage: { width: "100%", height: 140 },
    formatInfo: { padding: 14, minHeight: 105 },
    cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    formatTitle: { color: colors.bone, fontSize: 18, fontWeight: "800", flex: 1 },
    formatBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 6 },
    draftCard: { flexDirection: "row", alignItems: "center", overflow: "hidden", borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.subtle + "32", minHeight: 112 },
    draftImage: { width: 122, height: 112 },
    draftInfo: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
    statusChip: { alignSelf: "flex-start", backgroundColor: colors.success, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
    statusText: { color: colors.successInk, fontSize: 9, letterSpacing: 1.2, fontWeight: "900" },
    draftTitle: { color: colors.bone, fontSize: 18, fontWeight: "800", marginTop: 9 },
    draftMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
    businessRow: { flexDirection: "row", gap: 10 },
    businessTile: { flex: 1, minHeight: 164, borderRadius: 18, padding: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.subtle + "32" },
    businessTileAccent: { backgroundColor: colors.success, borderColor: colors.success },
    tileIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    tileIconAccent: { backgroundColor: colors.successInk + "15" },
    tileTitle: { color: colors.bone, fontSize: 14, lineHeight: 18, fontWeight: "800", flex: 1 },
    tileTitleAccent: { color: colors.successInk },
    tileBody: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 10 },
    tileBodyAccent: { color: colors.successInk + "CC" },
    pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  });
}
