import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { brandApproved, getBrand, themeFor, useBrands } from "../../lib/brands";
import { BRAND_THEMES } from "../../lib/brandThemes";
import { setPendingListingSelection } from "../../lib/listingOptions";

const COLOR_OPTIONS = [
  "Black", "White", "Cream", "Grey", "Brown", "Beige", "Tan", "Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Pink", "Gold", "Silver", "Multi-colour",
];
const MATERIAL_OPTIONS = [
  "Cotton", "Linen", "Wool", "Silk", "Denim", "Leather", "Suede", "Polyester", "Nylon", "Rayon", "Cashmere", "Velvet", "Canvas", "Acrylic", "Recycled fabric",
];

type ChoiceKind = "color" | "material";

export default function BrandListOption() {
  const { id, kind: rawKind, value: initialValue } = useLocalSearchParams<{ id?: string; kind?: string; value?: string }>();
  const kind: ChoiceKind = rawKind === "material" ? "material" : "color";
  const [value, setValue] = useState(String(initialValue || ""));
  useBrands();
  const insets = useSafeAreaInsets();
  const brand = id ? getBrand(id) : undefined;
  const theme = brand ? themeFor(brand) : BRAND_THEMES[0];
  const options = kind === "color" ? COLOR_OPTIONS : MATERIAL_OPTIONS;
  const title = kind === "color" ? "What colour is it?" : "What is it made from?";
  const helper = kind === "color" ? "Choose the closest match. You can describe a custom shade below." : "Choose the main material, or add a blend or finish below.";
  const selected = useMemo(() => value.trim().toLowerCase(), [value]);

  function choose(next: string) {
    setValue(next);
    setPendingListingSelection(kind, next);
    router.back();
  }

  function useCustom() {
    const next = value.trim();
    if (!next) return;
    choose(next);
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.bg }]}> 
      <View style={[styles.top, { paddingTop: insets.top + 6, borderBottomColor: theme.lineColor }]}> 
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to listing">
          <Text style={[styles.backTxt, { color: theme.ink }]}>‹</Text>
        </Pressable>
        <Text style={[styles.topTitle, { color: theme.ink }]}>{kind === "color" ? "Colour" : "Material"}</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.kicker, { color: theme.accent }]}>THE PIECE</Text>
        <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
        <Text style={[styles.helper, { color: theme.muted }]}>{helper}</Text>
        <View style={styles.options}>
          {options.map((option) => {
            const on = selected === option.toLowerCase();
            return (
              <Pressable
                key={option}
                onPress={() => choose(option)}
                style={[styles.option, { borderColor: on ? theme.accent : theme.lineColor, backgroundColor: on ? theme.accent : theme.card }]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.optionText, { color: on ? theme.accentInk : theme.ink }]}>{option}</Text>
                {on ? <Text style={[styles.check, { color: theme.accentInk }]}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.label, { color: theme.muted }]}>CUSTOM {kind.toUpperCase()}</Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          onSubmitEditing={useCustom}
          placeholder={kind === "color" ? "e.g. Burgundy" : "e.g. Cotton-linen blend"}
          placeholderTextColor={theme.muted}
          returnKeyType="done"
          style={[styles.input, { color: theme.ink, borderColor: theme.lineColor, backgroundColor: theme.card }]}
          accessibilityLabel={`Custom ${kind}`}
        />
        <Pressable onPress={useCustom} disabled={!value.trim()} style={[styles.done, { backgroundColor: value.trim() ? theme.accent : `${theme.accent}55` }]}>
          <Text style={[styles.doneText, { color: value.trim() ? theme.accentInk : `${theme.accentInk}80` }]}>Use this {kind}</Text>
        </Pressable>
        {!brand || !brandApproved(brand) ? <Text style={[styles.note, { color: theme.muted }]}>This choice will be saved with your listing draft when you return.</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  top: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, borderBottomWidth: 1 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backTxt: { fontSize: 36, lineHeight: 38, fontWeight: "300" },
  topTitle: { fontSize: 17, fontWeight: "800" },
  content: { paddingHorizontal: 20, paddingTop: 28 },
  kicker: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "800", marginTop: 9 },
  helper: { fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 460 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 26 },
  option: { minHeight: 48, borderWidth: 1, borderRadius: 17, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 9 },
  optionText: { fontSize: 14, fontWeight: "700" },
  check: { fontSize: 16, fontWeight: "900" },
  label: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginTop: 30, marginBottom: 9 },
  input: { minHeight: 54, borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, fontSize: 15 },
  done: { minHeight: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", marginTop: 14 },
  doneText: { fontSize: 15, fontWeight: "900" },
  note: { fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 14 },
});

export { COLOR_OPTIONS, MATERIAL_OPTIONS };
