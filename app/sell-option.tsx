import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { systemFor, sizesOf } from "../lib/brandSizes";
import { setPendingListingSelection } from "../lib/listingOptions";
import { useColors } from "../lib/theme";

type OptionKind = "brand" | "size" | "color" | "material";
const COLOR_OPTIONS = ["Black", "White", "Cream", "Grey", "Brown", "Beige", "Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Pink", "Gold", "Silver", "Multi-colour"];
const MATERIAL_OPTIONS = ["Cotton", "Linen", "Wool", "Silk", "Denim", "Leather", "Suede", "Polyester", "Nylon", "Rayon", "Cashmere", "Velvet", "Canvas", "Acrylic", "Recycled fabric"];
const BRAND_OPTIONS = ["No brand", "Nike", "Adidas", "Zara", "H&M", "Uniqlo", "Levi’s", "Other brand"];

const COPY: Record<OptionKind, { title: string; helper: string; label: string; placeholder: string }> = {
  brand: { title: "Who made it?", helper: "Choose a brand or add the name yourself.", label: "CUSTOM BRAND", placeholder: "e.g. Maison Margiela" },
  size: { title: "What size is it?", helper: "Choose the size shown on the label or add a custom size.", label: "CUSTOM SIZE", placeholder: "e.g. 32W or One size" },
  color: { title: "What colour is it?", helper: "Choose the closest match or add a custom shade.", label: "CUSTOM COLOUR", placeholder: "e.g. Burgundy" },
  material: { title: "What is it made from?", helper: "Choose the main material or add a blend or finish.", label: "CUSTOM MATERIAL", placeholder: "e.g. Cotton-linen blend" },
};

export default function SellOption() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { kind: rawKind, selected: initialSelected, category } = useLocalSearchParams<{ kind?: string; selected?: string; category?: string }>();
  const kind: OptionKind = rawKind === "brand" || rawKind === "size" || rawKind === "color" || rawKind === "material" ? rawKind : "brand";
  const [value, setValue] = useState(String(initialSelected || ""));
  const scrollRef = useRef<ScrollView>(null);
  const copy = COPY[kind];
  const options = kind === "brand" ? BRAND_OPTIONS : kind === "size" ? sizesOf(systemFor(String(category || "Tops"))) : kind === "color" ? COLOR_OPTIONS : MATERIAL_OPTIONS;
  const selected = value.trim().toLowerCase();

  function choose(next: string) {
    setPendingListingSelection(kind, next === "No brand" ? "" : next);
    router.back();
  }

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: colors.ink }]} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={insets.top}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to listing">
          <Text style={styles.backText}>‹</Text>
        </AccessiblePressable>
        <Text style={styles.title}>{kind === "color" ? "Colour" : kind[0].toUpperCase() + kind.slice(1)}</Text>
        <View style={styles.back} />
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>LISTING DETAILS</Text>
        <Text style={styles.heading}>{copy.title}</Text>
        <Text style={styles.lede}>{copy.helper}</Text>
        <View style={styles.options}>
          {options.map((option) => {
            const on = selected === option.toLowerCase();
            return (
              <Pressable key={option} onPress={() => choose(option)} style={[styles.option, on && styles.optionSelected]} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${copy.title} ${option}`}>
                <Text style={[styles.optionText, on && styles.optionTextSelected]}>{option}</Text>
                <Text style={[styles.check, !on && styles.checkHidden]}>{on ? "✓" : ""}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.customLabel}>{copy.label}</Text>
        <TextInput value={value} onChangeText={setValue} onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250)} onSubmitEditing={() => value.trim() && choose(value.trim())} placeholder={copy.placeholder} placeholderTextColor={colors.muted} returnKeyType="done" style={styles.input} accessibilityLabel={copy.label} />
        <Pressable onPress={() => value.trim() && choose(value.trim())} disabled={!value.trim()} style={[styles.done, !value.trim() && styles.doneDisabled]} accessibilityRole="button">
          <Text style={styles.doneText}>Use this {kind === "color" ? "colour" : kind}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    page: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
    back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    backText: { color: colors.bone, fontSize: 34, lineHeight: 38, marginTop: -4 },
    title: { color: colors.bone, fontSize: 16, fontWeight: "800" },
    content: { paddingHorizontal: 20, paddingTop: 20 },
    kicker: { color: colors.subtle, fontSize: 11, letterSpacing: 1.8, fontWeight: "800" },
    heading: { color: colors.bone, fontSize: 30, lineHeight: 36, fontWeight: "800", marginTop: 12 },
    lede: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10, maxWidth: 440 },
    options: { gap: 12, marginTop: 28 },
    option: { minHeight: 60, borderRadius: 18, borderWidth: 1, borderColor: colors.subtle + "40", paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    optionSelected: { backgroundColor: colors.pulse, borderColor: colors.pulse },
    optionText: { color: colors.bone, fontSize: 17, fontWeight: "700" },
    optionTextSelected: { color: colors.ink },
    check: { color: colors.ink, fontSize: 22, fontWeight: "800" },
    checkHidden: { opacity: 0 },
    customLabel: { color: colors.subtle, fontSize: 11, letterSpacing: 1.6, fontWeight: "800", marginTop: 28, marginBottom: 9 },
    input: { height: 54, borderRadius: 15, borderWidth: 1, borderColor: colors.subtle + "44", backgroundColor: colors.surface, color: colors.bone, paddingHorizontal: 15, fontSize: 16 },
    done: { minHeight: 54, borderRadius: 27, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginTop: 14 },
    doneDisabled: { opacity: 0.4 },
    doneText: { color: colors.successInk, fontSize: 15, fontWeight: "800" },
  });
}
