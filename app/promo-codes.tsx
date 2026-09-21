import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { getPiece, useWardrobe, useWardrobeHydrated, type ClosetPiece } from "../lib/wardrobe";
import { listListingPromotions, saveListingPromotion, type ListingPromotion } from "../lib/promotions";

const SUGGESTIONS = [10, 20, 30];
const EXPIRY_OPTIONS = [
  { days: 1 as const, label: "Within 1 day" },
  { days: 3 as const, label: "Within 3 days" },
  { days: 7 as const, label: "Within a week" },
  { days: 30 as const, label: "Within a month" },
  { days: 365 as const, label: "Within a year" },
];

export default function PromoCodes() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const pieces = useWardrobe();
  const hydrated = useWardrobeHydrated();
  const [selectedId, setSelectedId] = useState("");
  const [code, setCode] = useState("");
  const [percentage, setPercentage] = useState("");
  const [expiryDays, setExpiryDays] = useState<1 | 3 | 7 | 30 | 365>(7);
  const [promotions, setPromotions] = useState<ListingPromotion[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingPromotions, setLoadingPromotions] = useState(false);
  const [message, setMessage] = useState("");

  const listings = useMemo(
    () => pieces.filter((piece) => (piece.ownerId === app.uid || piece.listedByUid === app.uid) && piece.status === "listed"),
    [pieces, app.uid],
  );
  const selected = listings.find((piece) => piece.id === selectedId);
  const selectedPromotion = promotions.find((promotion) => promotion.listingId === selectedId && promotion.status === "live");
  const numericPercentage = Number(percentage);
  const percentageValid = Number.isFinite(numericPercentage) && numericPercentage > 0 && numericPercentage <= 70;

  useEffect(() => {
    if (!app.uid) return;
    setLoadingPromotions(true);
    void listListingPromotions()
      .then(setPromotions)
      .catch(() => undefined)
      .finally(() => setLoadingPromotions(false));
  }, [app.uid]);

  function selectListing(piece: ClosetPiece) {
    setSelectedId(piece.id);
    setMessage("");
    const existing = promotions.find((promotion) => promotion.listingId === piece.id && promotion.status === "live");
    setCode(existing?.code || "");
    setPercentage(existing ? String(existing.value) : "");
    const remainingDays = existing?.endAt ? Math.max(1, Math.round((existing.endAt - Date.now()) / 86400000)) : 7;
    setExpiryDays((EXPIRY_OPTIONS.reduce((closest, option) => Math.abs(option.days - remainingDays) < Math.abs(closest.days - remainingDays) ? option : closest, EXPIRY_OPTIONS[2])).days);
  }

  function suggestCode() {
    const base = (selected?.name || "UVEL").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "UVEL";
    setCode(`${base}${Math.floor(10 + Math.random() * 90)}`);
    setMessage("");
  }

  async function createPromo() {
    if (!selected) {
      setMessage("Choose a listing first.");
      return;
    }
    const normalizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (normalizedCode.length < 3) {
      setMessage("Enter a promo code with at least 3 characters.");
      return;
    }
    if (!percentageValid) {
      setMessage(numericPercentage > 70 ? "Promo codes max out at 70%." : "Enter a percentage between 1% and 70%.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const saved = await saveListingPromotion({ listingId: selected.id, code: normalizedCode, value: numericPercentage, expiresInDays: expiryDays });
      setPromotions((current) => [saved, ...current.filter((item) => item.listingId !== saved.listingId)]);
      setCode(saved.code);
      setPercentage(String(saved.value));
      Alert.alert("Promo code created", `${saved.code} is ready for ${selected.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn’t create that promo code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.page}>
      <StatusBar style={colors.ink === "#000000" ? "light" : "dark"} />
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <AccessiblePressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.navBack}>‹</Text>
        </AccessiblePressable>
        <Text style={styles.navTitle}>Promo codes</Text>
        <View style={styles.navBtn} />
      </View>
      {!app.uid ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Sign in to create promo codes</Text>
          <Text style={styles.emptyText}>Your promo codes are linked to your listings and seller account.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>Choose one of your live listings to create a discount code for it.</Text>
          {!hydrated || loadingPromotions ? <Text style={styles.muted}>Loading your listings…</Text> : null}
          {!listings.length && hydrated ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>List something first</Text>
              <Text style={styles.emptyText}>Once a piece is live in your shop, it will appear here.</Text>
              <AccessiblePressable onPress={() => router.push("/sell")} style={styles.primary} accessibilityRole="button" accessibilityLabel="List a piece">
                <Text style={styles.primaryText}>List a piece</Text>
              </AccessiblePressable>
            </View>
          ) : null}
          {listings.map((piece) => {
            const active = selectedId === piece.id;
            const promotion = promotions.find((item) => item.listingId === piece.id && item.status === "live");
            return (
              <AccessiblePressable
                key={piece.id}
                onPress={() => selectListing(piece)}
                style={({ pressed }) => [styles.listing, active && styles.listingOn, pressed && { opacity: 0.9 }]}
                accessibilityRole="radio"
                accessibilityLabel={`${piece.name}${promotion ? `, ${promotion.value}% off code ${promotion.code}` : ""}`}
                accessibilityState={{ selected: active }}
              >
                {piece.photo ? <Image source={{ uri: piece.photo }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
                <View style={styles.listingCopy}>
                  <Text style={styles.listingName} numberOfLines={1}>{piece.name}</Text>
                  <Text style={styles.listingMeta} numberOfLines={1}>{piece.brand === "Unlabeled" ? "Unbranded" : piece.brand} · {piece.listPriceCents / 100}</Text>
                  {promotion ? <Text style={styles.promoMeta}>{promotion.code} · {promotion.value}% off</Text> : <Text style={styles.listingHint}>Tap to create a code</Text>}
                </View>
                <Text style={styles.chev}>{active ? "✓" : "›"}</Text>
              </AccessiblePressable>
            );
          })}
          {selected ? (
            <View style={styles.editor}>
              <Text style={styles.editorTitle}>{selectedPromotion ? "Update promo code" : "Create promo code"}</Text>
              <Text style={styles.editorSub}>{selected.name}</Text>
              <Text style={styles.label}>Promo code</Text>
              <View style={styles.codeRow}>
                <TextInput
                  value={code}
                  onChangeText={(value) => { setCode(value.toUpperCase()); setMessage(""); }}
                  placeholder="e.g. UVEL10"
                  placeholderTextColor={colors.subtle}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={[styles.input, { flex: 1 }]}
                  editable={!busy}
                  accessibilityLabel="Promo code"
                />
                <Pressable onPress={suggestCode} style={styles.suggest} disabled={busy} accessibilityRole="button" accessibilityLabel="Generate a promo code">
                  <Text style={styles.suggestText}>Generate</Text>
                </Pressable>
              </View>
              <Text style={styles.label}>Percentage off</Text>
              <TextInput
                value={percentage}
                onChangeText={(value) => { setPercentage(value.replace(/[^0-9]/g, "")); setMessage(""); }}
                placeholder="Enter a percentage"
                placeholderTextColor={colors.subtle}
                keyboardType="number-pad"
                style={styles.input}
                editable={!busy}
                accessibilityLabel="Percentage off"
              />
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((value) => (
                  <Pressable key={value} onPress={() => setPercentage(String(value))} style={[styles.suggestion, percentage === String(value) && styles.suggestionOn]} accessibilityRole="button" accessibilityLabel={`${value} percent off`}>
                    <Text style={[styles.suggestionText, percentage === String(value) && styles.suggestionTextOn]}>{value}%</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Expires</Text>
              <View style={styles.expiryOptions}>
                {EXPIRY_OPTIONS.map((option) => (
                  <Pressable key={option.days} onPress={() => setExpiryDays(option.days)} style={[styles.expiryOption, expiryDays === option.days && styles.suggestionOn]} accessibilityRole="button" accessibilityLabel={option.label}>
                    <Text style={[styles.suggestionText, expiryDays === option.days && styles.suggestionTextOn]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
              {message ? <Text style={styles.error} accessibilityRole="alert">{message}</Text> : null}
              <AccessiblePressable onPress={() => void createPromo()} disabled={busy} style={({ pressed }) => [styles.primary, busy && { opacity: 0.5 }, pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel={busy ? "Saving promo code" : "Save promo code"}>
                <Text style={styles.primaryText}>{busy ? "Saving…" : selectedPromotion ? "Save changes" : "Create promo code"}</Text>
              </AccessiblePressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, paddingBottom: 10 },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navBack: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    navTitle: { color: colors.bone, fontSize: 17, fontWeight: "700" },
    content: { paddingHorizontal: 20, paddingTop: 10 },
    intro: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 },
    muted: { color: colors.muted, fontSize: 13, marginBottom: 12 },
    listing: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, marginBottom: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: "transparent" },
    listingOn: { borderColor: colors.success },
    thumb: { width: 58, height: 58, borderRadius: 12, backgroundColor: colors.neutral },
    listingCopy: { flex: 1 },
    listingName: { color: colors.bone, fontSize: 15, fontWeight: "800" },
    listingMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
    listingHint: { color: colors.subtle, fontSize: 12, marginTop: 5 },
    promoMeta: { color: colors.success, fontSize: 12, fontWeight: "800", marginTop: 5 },
    chev: { color: colors.success, fontSize: 22, paddingHorizontal: 5 },
    editor: { marginTop: 10, padding: 16, borderRadius: 18, backgroundColor: colors.surface },
    editorTitle: { color: colors.bone, fontSize: 19, fontWeight: "800" },
    editorSub: { color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: 18 },
    label: { color: colors.bone, fontSize: 13, fontWeight: "800", marginTop: 12, marginBottom: 7 },
    codeRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    input: { minHeight: 48, borderRadius: 12, backgroundColor: colors.ink, color: colors.bone, paddingHorizontal: 13, fontSize: 16, borderWidth: 1, borderColor: `${colors.bone}24` },
    suggest: { minHeight: 48, paddingHorizontal: 12, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.success },
    suggestText: { color: colors.success, fontSize: 12, fontWeight: "800" },
    suggestions: { flexDirection: "row", gap: 8, marginTop: 10 },
    suggestion: { paddingHorizontal: 14, minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: `${colors.bone}35`, alignItems: "center", justifyContent: "center" },
    suggestionOn: { backgroundColor: colors.success, borderColor: colors.success },
    suggestionText: { color: colors.bone, fontSize: 13, fontWeight: "700" },
    suggestionTextOn: { color: colors.successInk },
    expiryOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
    expiryOption: { paddingHorizontal: 12, minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: `${colors.bone}35`, alignItems: "center", justifyContent: "center" },
    error: { color: colors.danger, fontSize: 13, lineHeight: 18, marginTop: 12 },
    primary: { minHeight: 48, borderRadius: 24, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 18 },
    primaryText: { color: colors.successInk, fontSize: 14, fontWeight: "800" },
    emptyState: { margin: 20, padding: 22, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center" },
    emptyTitle: { color: colors.bone, fontSize: 18, fontWeight: "800", textAlign: "center" },
    emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 7 },
  });
}
