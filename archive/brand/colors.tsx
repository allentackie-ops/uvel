import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BRAND_THEMES } from "../../lib/brandThemes";
import { canStudio, getBrand, themeFor, updateBrand, useBrands } from "../../lib/brands";
import { useUvel } from "../../lib/store";

export default function BrandColors() {
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
        <Text style={styles.title}>Only the owner can change page colors.</Text>
      </View>
    );
  }

  const theme = themeFor(brand);

  return (
    <View style={[styles.page, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.top}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to brand page">
            <Text style={[styles.backTxt, { color: theme.ink }]}>‹</Text>
          </Pressable>
          <Text style={[styles.topTitle, { color: theme.ink }]}>Page colors</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.intro}>
          <Text style={[styles.title, { color: theme.ink }]}>Dress the page</Text>
          <Text style={[styles.copy, { color: theme.muted }]}>Choose a visual room for {brand.name}. Your selection appears on the brand page as soon as you go back.</Text>
        </View>

        <View style={styles.grid}>
          {BRAND_THEMES.map((item) => {
            const selected = !brand.custom && brand.themeId === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => updateBrand(brand.id, { themeId: item.id, custom: undefined })}
                style={[styles.card, { backgroundColor: item.bg, borderColor: selected ? item.accent : item.lineColor, borderWidth: selected ? 2 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}${selected ? ", selected" : ""}`}
              >
                <View style={[styles.preview, { backgroundColor: item.card, borderColor: item.lineColor }]}>
                  <View style={[styles.previewLine, { backgroundColor: item.ink }]} />
                  <View style={[styles.previewLineShort, { backgroundColor: item.muted }]} />
                  <View style={[styles.previewButton, { backgroundColor: item.accent }]} />
                </View>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: item.ink }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.cardLine, { color: item.muted }]} numberOfLines={1}>{item.line}</Text>
                  </View>
                  {selected ? <Text style={[styles.selected, { color: item.accent }]}>Selected</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={() => router.push({ pathname: "/brand/studio", params: { id: brand.id } })} style={[styles.custom, { borderColor: theme.lineColor }]}>
          <Text style={[styles.customTitle, { color: theme.ink }]}>Need something more specific?</Text>
          <Text style={[styles.customCopy, { color: theme.muted }]}>Open Studio for custom page, type, and accent colors.</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 8 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backTxt: { fontSize: 34, lineHeight: 36, marginTop: -4 },
  topTitle: { fontSize: 16, fontWeight: "700" },
  intro: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  title: { fontSize: 30, fontWeight: "800" },
  copy: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  grid: { paddingHorizontal: 16, gap: 12 },
  card: { borderRadius: 18, padding: 12 },
  preview: { height: 86, borderRadius: 12, borderWidth: 1, padding: 14, justifyContent: "center", gap: 8 },
  previewLine: { width: "58%", height: 8, borderRadius: 4 },
  previewLineShort: { width: "36%", height: 5, borderRadius: 3 },
  previewButton: { width: 54, height: 12, borderRadius: 6, marginTop: 3 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 11 },
  cardName: { fontSize: 16, fontWeight: "800" },
  cardLine: { fontSize: 12, marginTop: 3 },
  selected: { fontSize: 11, fontWeight: "800" },
  custom: { marginHorizontal: 16, marginTop: 20, padding: 16, borderWidth: 1, borderRadius: 16 },
  customTitle: { fontSize: 15, fontWeight: "800" },
  customCopy: { fontSize: 13, lineHeight: 19, marginTop: 4 },
});
