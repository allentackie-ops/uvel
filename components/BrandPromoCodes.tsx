import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { saveBrandPromotion, type BrandPromotion, type MarketingState, type MarketingStatus } from "../lib/marketing";
import type { Brand } from "../lib/brands";
import { useColors, type Colors } from "../lib/theme";
import { getMarket } from "../lib/markets";

type ExpiryDays = 1 | 3 | 30 | 365;

const SUGGESTIONS = [10, 20, 30];
const EXPIRY_OPTIONS: Array<{ days: ExpiryDays; label: string }> = [
  { days: 1, label: "1 day" },
  { days: 3, label: "3 days" },
  { days: 30, label: "1 month" },
  { days: 365, label: "1 year" },
];
const STATUS_OPTIONS: Array<{ value: MarketingStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "live", label: "Live" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
];

export function BrandPromoCodes({ brand, state, viewer, manager }: { brand: Brand; state: MarketingState; viewer: boolean; manager: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const [selectedId, setSelectedId] = useState("");
  const [code, setCode] = useState("");
  const [percentage, setPercentage] = useState("");
  const [expiryDays, setExpiryDays] = useState<ExpiryDays>(1);
  const [status, setStatus] = useState<MarketingStatus>("draft");
  const [busy, setBusy] = useState(false);
  const promotions = state.promotions;
  const selected = promotions.find((promotion) => promotion.id === selectedId);
  const numericPercentage = Number(percentage);
  const percentageValid = Number.isFinite(numericPercentage) && numericPercentage > 0 && numericPercentage <= 70;

  function selectPromotion(promotion: BrandPromotion) {
    setSelectedId(promotion.id);
    setCode(promotion.code);
    setPercentage(String(promotion.value));
    setStatus(promotion.status === "scheduled" ? "live" : promotion.status);
    const remainingDays = promotion.endAt ? Math.max(1, Math.round((promotion.endAt - Date.now()) / 86400000)) : 1;
    const closest = EXPIRY_OPTIONS.reduce((best, option) => Math.abs(option.days - remainingDays) < Math.abs(best.days - remainingDays) ? option : best, EXPIRY_OPTIONS[0]);
    setExpiryDays(closest.days);
  }

  function reset() {
    setSelectedId("");
    setCode("");
    setPercentage("");
    setExpiryDays(1);
    setStatus("draft");
  }

  async function save() {
    if (!manager || busy) return;
    const normalizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (normalizedCode.length < 3) {
      Alert.alert("Promo code", "Enter a promo code with at least 3 characters.");
      return;
    }
    if (!percentageValid) {
      Alert.alert("Promo code", "Enter a percentage between 1% and 70%.");
      return;
    }
    setBusy(true);
    try {
      await saveBrandPromotion({
        id: selectedId || undefined,
        brandId: brand.id,
        code: normalizedCode,
        kind: "percentage",
        value: numericPercentage,
        currency: getMarket(brand.country).currency,
        minimumOrderCents: 0,
        status,
        endAt: Date.now() + expiryDays * 86400000,
      });
      Alert.alert("Promo code saved", `${normalizedCode} is ready for ${brand.name}.`);
      reset();
    } catch (error) {
      Alert.alert("Promo code", error instanceof Error ? error.message : "Could not save this promo code.");
    } finally {
      setBusy(false);
    }
  }

  if (!viewer) {
    return <View style={styles.empty}><Text style={styles.emptyTitle}>Promo codes</Text><Text style={styles.emptyText}>Promo codes are restricted to the brand team.</Text></View>;
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Promo codes</Text>
      <Text style={styles.intro}>Create a discount code for your brand.</Text>
      {promotions.map((promotion) => {
        const active = selectedId === promotion.id;
        return (
          <Pressable key={promotion.id} onPress={() => selectPromotion(promotion)} style={[styles.promotion, active && styles.promotionOn]} accessibilityRole="radio" accessibilityState={{ selected: active }}>
            <View style={styles.promotionCopy}>
              <Text style={styles.promotionCode}>{promotion.code}</Text>
              <Text style={styles.promotionMeta}>{promotion.value}% off · {promotion.status}</Text>
            </View>
            <Text style={styles.chev}>{active ? "✓" : "›"}</Text>
          </Pressable>
        );
      })}
      {manager ? (
        <View style={styles.editor}>
          <View style={styles.editorHead}>
            <Text style={styles.editorTitle}>{selected ? "Update promo code" : "Create promo code"}</Text>
            {selected ? <Pressable onPress={reset} accessibilityRole="button"><Text style={styles.reset}>New</Text></Pressable> : null}
          </View>
          <TextInput value={code} onChangeText={(value) => setCode(value.toUpperCase())} placeholder="e.g. UVEL10" placeholderTextColor={colors.subtle} autoCapitalize="characters" autoCorrect={false} style={styles.input} editable={!busy} accessibilityLabel="Promo code" />
          <Text style={styles.label}>Percentage off</Text>
          <TextInput value={percentage} onChangeText={(value) => setPercentage(value.replace(/[^0-9]/g, ""))} placeholder="Enter a percentage" placeholderTextColor={colors.subtle} keyboardType="number-pad" style={styles.input} editable={!busy} accessibilityLabel="Percentage off" />
          <View style={styles.chips}>
            {SUGGESTIONS.map((value) => <Pressable key={value} onPress={() => setPercentage(String(value))} style={[styles.chip, percentage === String(value) && styles.chipOn]} accessibilityRole="button"><Text style={[styles.chipText, percentage === String(value) && styles.chipTextOn]}>{value}%</Text></Pressable>)}
          </View>
          <Text style={styles.label}>Expires</Text>
          <View style={styles.chips}>
            {EXPIRY_OPTIONS.map((option) => <Pressable key={option.days} onPress={() => setExpiryDays(option.days)} style={[styles.chip, expiryDays === option.days && styles.chipOn]} accessibilityRole="button"><Text style={[styles.chipText, expiryDays === option.days && styles.chipTextOn]}>{option.label}</Text></Pressable>)}
          </View>
          <Text style={styles.label}>Status</Text>
          <View style={styles.chips}>
            {STATUS_OPTIONS.map((option) => <Pressable key={option.value} onPress={() => setStatus(option.value)} style={[styles.chip, status === option.value && styles.chipOn]} accessibilityRole="button"><Text style={[styles.chipText, status === option.value && styles.chipTextOn]}>{option.label}</Text></Pressable>)}
          </View>
          <Pressable onPress={() => void save()} disabled={busy} style={[styles.primary, busy && { opacity: 0.5 }]} accessibilityRole="button"><Text style={styles.primaryText}>{busy ? "Saving…" : selected ? "Save changes" : "Create promo code"}</Text></Pressable>
        </View>
      ) : <Text style={styles.muted}>You can view promo codes, but only brand managers can create or edit them.</Text>}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { paddingTop: 4 },
    title: { color: colors.bone, fontSize: 26, fontWeight: "800" },
    intro: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 16 },
    promotion: { flexDirection: "row", alignItems: "center", padding: 14, marginBottom: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: "transparent" },
    promotionOn: { borderColor: colors.success },
    promotionCopy: { flex: 1 },
    promotionCode: { color: colors.bone, fontSize: 16, fontWeight: "800" },
    promotionMeta: { color: colors.muted, fontSize: 12, marginTop: 5, textTransform: "capitalize" },
    chev: { color: colors.success, fontSize: 22, paddingHorizontal: 5 },
    editor: { marginTop: 10, padding: 16, borderRadius: 18, backgroundColor: colors.surface },
    editorHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    editorTitle: { color: colors.bone, fontSize: 19, fontWeight: "800" },
    reset: { color: colors.success, fontSize: 13, fontWeight: "800" },
    input: { minHeight: 48, borderRadius: 12, backgroundColor: colors.ink, color: colors.bone, paddingHorizontal: 13, fontSize: 16, borderWidth: 1, borderColor: `${colors.bone}24`, marginTop: 12 },
    label: { color: colors.bone, fontSize: 13, fontWeight: "800", marginTop: 16, marginBottom: 7 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 14, minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: `${colors.bone}35`, alignItems: "center", justifyContent: "center" },
    chipOn: { backgroundColor: colors.success, borderColor: colors.success },
    chipText: { color: colors.bone, fontSize: 13, fontWeight: "700" },
    chipTextOn: { color: colors.successInk },
    primary: { minHeight: 48, borderRadius: 24, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 20 },
    primaryText: { color: colors.successInk, fontSize: 14, fontWeight: "800" },
    muted: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 16 },
    empty: { paddingVertical: 10 },
    emptyTitle: { color: colors.bone, fontSize: 20, fontWeight: "800" },
    emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  });
}

export default BrandPromoCodes;
