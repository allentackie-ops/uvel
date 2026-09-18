import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandBanner } from "../../components/BrandBanner";
import { BRAND_THEMES } from "../../lib/brandThemes";
import { canStudio, getBrand, themeFor, updateBrand, uploadBrandAsset, useBrands } from "../../lib/brands";
import { pickBannerImage, pickBannerVideo, pickLogo } from "../../lib/photo";
import { useUvel } from "../../lib/store";

export default function BrandStudio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBrands();
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const brand = getBrand(id);

  if (!brand || !canStudio(brand, app.uid)) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 20, paddingHorizontal: 20 }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backTxt}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Only the owner dresses this page.</Text>
      </View>
    );
  }

  const currentBrand = brand;
  const theme = themeFor(currentBrand);

  async function saveAsset(kind: "logo" | "banner", picker: () => Promise<string | null>, bannerKind?: "image" | "video") {
    try {
      const uri = await picker();
      if (!uri) return;
      updateBrand(currentBrand.id, kind === "logo" ? { logoUri: uri } : { bannerUri: uri, bannerKind: bannerKind || "image" });
      const remoteUri = await uploadBrandAsset(uri, currentBrand.id, kind);
      updateBrand(currentBrand.id, kind === "logo" ? { logoUri: remoteUri } : { bannerUri: remoteUri, bannerKind: bannerKind || "image" });
    } catch (error) {
      console.warn("Brand media sync failed after local preview", error);
    }
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.top}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Text style={[styles.backTxt, { color: theme.ink }]}>‹</Text>
          </Pressable>
          <Text style={[styles.topTitle, { color: theme.ink }]}>Studio</Text>
          <View style={{ width: 40 }} />
        </View>

        <BrandBanner uri={brand.bannerUri} kind={brand.bannerKind} style={[styles.banner, { backgroundColor: theme.card }]} />
        <View style={styles.bannerRow}>
          <Pressable
            onPress={() => void saveAsset("banner", pickBannerImage, "image")}
            style={[styles.small, { backgroundColor: theme.card }]}
          >
            <Text style={[styles.smallTxt, { color: theme.ink }]}>Image banner</Text>
          </Pressable>
          <Pressable
            onPress={() => void saveAsset("banner", pickBannerVideo, "video")}
            style={[styles.small, { backgroundColor: theme.card }]}
          >
            <Text style={[styles.smallTxt, { color: theme.ink }]}>Video banner</Text>
          </Pressable>
        </View>
        {brand.bannerUri ? (
          <Pressable
            onPress={() =>
              Alert.alert("Remove banner?", "The page shows without one until you add another.", [
                { text: "Keep", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: () => updateBrand(brand.id, { bannerUri: "", bannerKind: "image" }),
                },
              ])
            }
            style={styles.removeBanner}
          >
            <Text style={[styles.removeBannerTxt, { color: theme.muted }]}>Remove banner</Text>
          </Pressable>
        ) : null}

        <View style={{ paddingHorizontal: 20 }}>
          <Pressable
            onPress={() => void saveAsset("logo", pickLogo)}
            style={styles.logoRow}
          >
            {brand.logoUri ? (
              <Image cachePolicy="memory-disk" source={{ uri: brand.logoUri }} style={styles.logo} contentFit="cover" />
            ) : (
              <View style={[styles.logo, { backgroundColor: theme.card }]} />
            )}
            <Text style={[styles.logoH, { color: theme.ink }]}>Change mark</Text>
          </Pressable>

          <Text style={[styles.label, { color: theme.muted }]}>Tagline</Text>
          <TextInput
            style={[styles.field, { color: theme.ink, backgroundColor: theme.card, borderColor: theme.lineColor }]}
            value={brand.tagline}
            onChangeText={(v) => updateBrand(brand.id, { tagline: v })}
            placeholder="One line under the name"
            placeholderTextColor={theme.muted}
          />

          <Text style={[styles.h2, { color: theme.ink }]}>Colour</Text>
          <Text style={[styles.p, { color: theme.muted }]}>Sixteen rooms. Then your own hex if you want it stranger.</Text>
          <View style={styles.swatches}>
            {BRAND_THEMES.map((t) => {
              const on = brand.themeId === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => updateBrand(brand.id, { themeId: t.id, custom: undefined })}
                  style={[styles.swatch, { backgroundColor: t.bg, borderColor: on ? t.accent : t.lineColor, borderWidth: on ? 2 : 1 }]}
                >
                  <View style={[styles.dot, { backgroundColor: t.accent }]} />
                  <Text style={[styles.swatchName, { color: t.ink }]} numberOfLines={1}>
                    {t.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#000000" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 8 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backTxt: { color: "#F4F0E6", fontSize: 34, lineHeight: 36, marginTop: -4 },
  topTitle: { fontSize: 16, fontWeight: "600" },
  title: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 26, marginTop: 24 },
  banner: { width: "100%", height: 180, backgroundColor: "#161512", marginBottom: 12 },
  bannerRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 8 },
  small: { flex: 1, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  smallTxt: { fontWeight: "700", fontSize: 13 },
  removeBanner: { alignSelf: "flex-start", paddingHorizontal: 20, paddingBottom: 4, paddingTop: 2 },
  removeBannerTxt: { fontSize: 14, textDecorationLine: "underline" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  logo: { width: 56, height: 56, borderRadius: 14, backgroundColor: "#161512" },
  logoH: { fontWeight: "700", fontSize: 16 },
  label: { fontSize: 12, marginTop: 16, letterSpacing: 0.3 },
  field: {
    marginTop: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  h2: { fontSize: 26, lineHeight: 32, fontWeight: "800", marginTop: 28 },
  p: { fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 12 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swatch: { width: "48%", height: 72, borderRadius: 16, padding: 12, justifyContent: "space-between" },
  dot: { width: 14, height: 14, borderRadius: 7 },
  swatchName: { fontSize: 13, fontWeight: "700" },
});
