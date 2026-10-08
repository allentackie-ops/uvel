import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ownedBrand, useBrands } from "../../lib/brands";
import { useUvel } from "../../lib/store";
import { useBrandListingDrafts } from "../../lib/brandListingDraft";

const REFERENCE_SCREEN = require("../../assets/create/red-launchpad-reference-clean.png");

export default function Create() {
  const insets = useSafeAreaInsets();
  const app = useUvel();
  useBrands();
  const brand = ownedBrand(app.uid);
  const drafts = useBrandListingDrafts(brand?.id);
  const draft = drafts[0];

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: insets.bottom + 78 }}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={[styles.referenceFrame, styles.referenceAspect]}>
        <Image source={REFERENCE_SCREEN} style={StyleSheet.absoluteFill} contentFit="fill" cachePolicy="memory-disk" />

        {/* Header controls match the approved reference image. */}
        <Pressable onPress={() => router.push("/you")} style={[styles.hit, styles.menuHit]} accessibilityRole="button" accessibilityLabel="Open menu" />
        {/* Hero and launch cards preserve the real creation flows. */}
        <Pressable onPress={() => router.push("/brand/founder")} style={[styles.hit, styles.heroHit]} accessibilityRole="button" accessibilityLabel="Start creating" />
        <Pressable onPress={() => openLaunch("listing", brand)} style={[styles.hit, styles.productHit]} accessibilityRole="button" accessibilityLabel="Create one product" />
        <Pressable onPress={() => openLaunch("collection", brand)} style={[styles.hit, styles.collectionHit]} accessibilityRole="button" accessibilityLabel="Create a collection" />
        <Pressable onPress={() => openLaunch("brand", brand)} style={[styles.hit, styles.brandHit]} accessibilityRole="button" accessibilityLabel="Create a brand" />

        {/* Draft actions remain data-aware while the visual stays pixel-accurate. */}
        <Pressable onPress={() => draft && brand ? router.push({ pathname: "/brand/list", params: { id: brand.id, draftId: draft.id } }) : router.push("/brand/founder")} style={[styles.hit, styles.draftHit]} accessibilityRole="button" accessibilityLabel="Continue saved draft" />
        <Pressable onPress={() => brand ? router.push({ pathname: "/brand/drafts", params: { id: brand.id } }) : router.push("/brand/founder")} style={[styles.hit, styles.seeAllHit]} accessibilityRole="button" accessibilityLabel="See all saved drafts" />
      </View>
    </ScrollView>
  );
}

function openLaunch(kind: "listing" | "collection" | "brand", brand?: { id: string }) {
  if (!brand) return router.push("/brand/founder");
  if (kind === "listing") return router.push({ pathname: "/brand/list", params: { id: brand.id } });
  if (kind === "collection") return router.push({ pathname: "/brand/collections", params: { id: brand.id } });
  return router.push({ pathname: "/brand/announcement", params: { id: brand.id } });
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FFFEFC" },
  referenceFrame: { position: "relative", overflow: "hidden" },
  referenceAspect: { width: "100%", aspectRatio: 1440 / 2560 },
  hit: { position: "absolute", backgroundColor: "transparent" },
  menuHit: { left: "3%", top: "1.5%", width: "11%", height: "5%" },
  heroHit: { left: "3%", top: "16.5%", width: "94%", height: "29%" },
  productHit: { left: "3%", top: "49%", width: "30%", height: "24%" },
  collectionHit: { left: "35%", top: "49%", width: "30%", height: "24%" },
  brandHit: { right: "3%", top: "49%", width: "30%", height: "24%" },
  draftHit: { left: "3%", top: "75%", width: "94%", height: "14%" },
  seeAllHit: { right: "3%", top: "71%", width: "20%", height: "5%" },
});
