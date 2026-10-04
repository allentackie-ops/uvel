import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { setPendingListingSelection } from "../lib/listingOptions";
import { useColors, type Colors } from "../lib/theme";

const FITS = ["Slim", "Regular", "Relaxed", "Oversized", "Tailored"];
const LENGTHS = ["Cropped", "Regular", "Long", "Floor length"];
const MEASUREMENTS: Array<[string, string]> = [["Chest / bust", "Not added"], ["Waist", "Not added"], ["Hip", "Not added"], ["Inseam", "Not added"]];

type Values = { fit?: string; length?: string; [key: string]: string | undefined };
function parseSelected(value?: string): Values {
  if (!value) return {};
  try { return JSON.parse(value) as Values; } catch { return {}; }
}
export default function ListingDetails() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { selected } = useLocalSearchParams<{ selected?: string }>();
  const initial = useMemo(() => parseSelected(typeof selected === "string" ? selected : undefined), [selected]);
  const [fit, setFit] = useState(initial.fit || "");
  const [length, setLength] = useState(initial.length || "");
  const [values, setValues] = useState<Values>(initial);
  function finish() {
    const next: Record<string, string> = {};
    if (fit) next.fit = fit;
    if (length) next.length = length;
    Object.entries(values).forEach(([key, value]) => { if (value && key !== "fit" && key !== "length") next[key] = value; });
    setPendingListingSelection("measurements", next);
    router.back();
  }
  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to listing"><Text style={styles.backText}>‹</Text></AccessiblePressable>
        <Text style={styles.title}>Measurements & fit</Text>
        <AccessiblePressable onPress={finish} style={styles.done} accessibilityRole="button" accessibilityLabel="Save measurements and fit"><Text style={styles.doneText}>Done</Text></AccessiblePressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>LISTING DETAILS</Text>
        <Text style={styles.heading}>Help buyers understand the fit</Text>
        <Text style={styles.lede}>Choose the closest options. You can leave any detail blank if it does not apply.</Text>
        <Text style={styles.label}>FIT</Text>
        <View style={styles.options}>{FITS.map((item) => <AccessiblePressable key={item} onPress={() => setFit(item)} style={[styles.option, fit === item && styles.optionSelected]} accessibilityRole="radio" accessibilityState={{ selected: fit === item }}><Text style={[styles.optionText, fit === item && styles.optionTextSelected]}>{item}</Text>{fit === item ? <Text style={styles.check}>✓</Text> : null}</AccessiblePressable>)}</View>
        <Text style={styles.label}>LENGTH</Text>
        <View style={styles.options}>{LENGTHS.map((item) => <AccessiblePressable key={item} onPress={() => setLength(item)} style={[styles.option, length === item && styles.optionSelected]} accessibilityRole="radio" accessibilityState={{ selected: length === item }}><Text style={[styles.optionText, length === item && styles.optionTextSelected]}>{item}</Text>{length === item ? <Text style={styles.check}>✓</Text> : null}</AccessiblePressable>)}</View>
        <Text style={styles.label}>MEASUREMENTS</Text>
        <Text style={styles.measureHint}>Choose “Not added” when the measurement is not available.</Text>
        <View style={styles.measureList}>{MEASUREMENTS.map(([key, label]) => { const current = values[key] || label; return <View key={key} style={styles.measureRow}><Text style={styles.measureName}>{key}</Text><View style={styles.measureChoices}>{[label, "Included"].map((choice) => <AccessiblePressable key={choice} onPress={() => setValues((prev) => ({ ...prev, [key]: choice === label ? "Not added" : choice }))} style={[styles.smallChoice, current === choice && styles.smallChoiceOn]} accessibilityRole="radio" accessibilityState={{ selected: current === choice }}><Text style={[styles.smallChoiceText, current === choice && styles.smallChoiceTextOn]}>{choice}</Text></AccessiblePressable>)}</View></View>; })}</View>
        <AccessiblePressable onPress={finish} style={styles.save}><Text style={styles.saveText}>Save details</Text></AccessiblePressable>
      </ScrollView>
    </View>
  );
}
function make(colors: Colors) { return StyleSheet.create({ page: { flex: 1, backgroundColor: colors.ink }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, backText: { color: colors.bone, fontSize: 34, lineHeight: 38 }, title: { color: colors.bone, fontSize: 16, fontWeight: "800" }, done: { minWidth: 54, height: 44, alignItems: "flex-end", justifyContent: "center" }, doneText: { color: colors.success, fontSize: 15, fontWeight: "800" }, content: { paddingHorizontal: 20, paddingTop: 20 }, kicker: { color: colors.subtle, fontSize: 11, letterSpacing: 1.8 }, heading: { color: colors.bone, fontSize: 30, lineHeight: 36, fontWeight: "800", marginTop: 12 }, lede: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10 }, label: { color: colors.subtle, fontSize: 11, letterSpacing: 1.8, fontWeight: "800", marginTop: 28, marginBottom: 10 }, options: { gap: 10 }, option: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: `${colors.bone}28`, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, optionSelected: { backgroundColor: colors.success, borderColor: colors.success }, optionText: { color: colors.bone, fontSize: 16, fontWeight: "700" }, optionTextSelected: { color: colors.successInk }, check: { color: colors.successInk, fontSize: 20, fontWeight: "900" }, measureHint: { color: colors.muted, fontSize: 13, lineHeight: 18, marginBottom: 8 }, measureList: { gap: 10 }, measureRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}18`, paddingVertical: 10 }, measureName: { color: colors.bone, fontSize: 15, fontWeight: "700", marginBottom: 8 }, measureChoices: { flexDirection: "row", gap: 8 }, smallChoice: { borderRadius: 14, borderWidth: 1, borderColor: `${colors.bone}28`, paddingHorizontal: 11, paddingVertical: 7 }, smallChoiceOn: { backgroundColor: colors.success, borderColor: colors.success }, smallChoiceText: { color: colors.muted, fontSize: 12, fontWeight: "700" }, smallChoiceTextOn: { color: colors.successInk }, save: { height: 54, borderRadius: 27, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginTop: 30 }, saveText: { color: colors.successInk, fontSize: 15, fontWeight: "900" } }); }
