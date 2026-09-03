import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { convertCents, getMarketByCurrency } from "../lib/markets";
import {
  buildPriceGuide,
  centsFromMajor,
  formatPriceCents,
  majorFromCents,
  type PricingTarget,
} from "../lib/pricing";
import { useColors } from "../lib/theme";
import { getPiece, useWardrobe, type ClosetPiece } from "../lib/wardrobe";
import { setPendingListingPrice } from "../lib/listingPriceDraft";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function ComparableCard({ piece, currency }: { piece: ClosetPiece; currency: string }) {
  const colors = useColors();
  const styles = make(colors);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/closet/[id]", params: { id: piece.id } })}
      style={({ pressed }) => [styles.comparable, pressed && { opacity: 0.75 }]}
    >
      {piece.photo ? (
        <Image source={{ uri: piece.photo }} style={styles.comparableImage} contentFit="cover" />
      ) : (
        <View style={[styles.comparableImage, styles.imageFallback]} />
      )}
      <Text style={styles.comparableBrand} numberOfLines={1}>
        {(piece.brand || "Unlabeled").toUpperCase()}
      </Text>
      <Text style={styles.comparableMeta} numberOfLines={1}>
        {[piece.size, piece.condition].filter(Boolean).join(" · ") || "Listed piece"}
      </Text>
      <Text style={styles.comparablePrice}>{formatPriceCents(convertCents(piece.listPriceCents, piece.currency || "USD", getMarketByCurrency(currency)), currency)}</Text>
    </Pressable>
  );
}

export default function Price() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    key?: string;
    pieceId?: string;
    name?: string;
    brand?: string;
    category?: string;
    color?: string;
    material?: string;
    size?: string;
    condition?: string;
    currency?: string;
    market?: string;
    price?: string;
    analysis?: string;
  }>();
  const pieces = useWardrobe();
  const key = param(params.key) || "new";
  const pieceId = param(params.pieceId);
  const analysisComplete = param(params.analysis) === "complete";
  const currency = param(params.currency) || getMarketByCurrency(param(params.market)).currency;
  const market = getMarketByCurrency(currency);
  const existing = pieceId ? getPiece(pieceId) : undefined;
  const target: PricingTarget = useMemo(
    () => ({
      id: pieceId || undefined,
      name: param(params.name) || existing?.name,
      brand: param(params.brand) || existing?.brand,
      category: param(params.category) || existing?.category,
      color: param(params.color) || existing?.color,
      material: param(params.material) || existing?.material,
      size: param(params.size) || existing?.size,
      condition: param(params.condition) || existing?.condition,
    }),
    [pieceId, params.name, params.brand, params.category, params.color, params.material, params.size, params.condition, existing?.id],
  );
  const guide = useMemo(() => buildPriceGuide(target, pieces, currency), [target, pieces, currency]);
  const initialCents = centsFromMajor(param(params.price));
  const [priceText, setPriceText] = useState(() => param(params.price));
  const [selectedTier, setSelectedTier] = useState<"bargain" | "optimal" | "premium" | "custom">(() => {
    if (initialCents === guide.bargainCents) return "bargain";
    if (initialCents === guide.premiumCents) return "premium";
    if (initialCents === guide.optimalCents || !initialCents) return "optimal";
    return "custom";
  });
  const currentCents = centsFromMajor(priceText);
  const selectedLabel = currentCents ? formatPriceCents(currentCents, currency) : "No price selected";
  const title = target.name || "Your piece";
  const details = [target.brand, target.category, target.condition].filter(Boolean).join(" · ");

  if (!analysisComplete) {
    return (
      <View style={styles.page}>
        <View style={[styles.nav, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to listing">
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
          <Text style={styles.navTitle}>Price</Text>
          <View style={styles.navSpace} />
        </View>
        <View style={styles.analysisGate}>
          <Text style={styles.analysisGateTitle}>Add a product photo first</Text>
          <Text style={styles.analysisGateCopy}>Price recommendations appear only after Uvel has successfully analyzed a product photo.</Text>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.analysisGateButton, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="Return to listing and add a photo">
            <Text style={styles.analysisGateButtonText}>Return to listing</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function choose(tier: "bargain" | "optimal" | "premium", cents: number) {
    setSelectedTier(tier);
    setPriceText(majorFromCents(cents));
  }

  function done() {
    const cents = currentCents || guide.optimalCents;
    setPendingListingPrice(key, majorFromCents(cents));
    router.back();
  }

  return (
    <View style={styles.page}>
      <FlatList
        data={guide.comparables}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        ListHeaderComponent={
          <View>
            <View style={[styles.nav, { paddingTop: insets.top + 6 }]}> 
              <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
                <Text style={styles.backTxt}>‹</Text>
              </Pressable>
              <Text style={styles.navTitle}>Price</Text>
              <View style={styles.navSpace} />
            </View>

            <View style={styles.priceInputRow}>
              <Text style={styles.symbol}>{market.symbol}</Text>
              <TextInput
                style={styles.priceInput}
                value={priceText}
                onChangeText={(value) => {
                  setSelectedTier("custom");
                  setPriceText(value.replace(/[^0-9]/g, ""));
                }}
                placeholder="0"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                autoFocus={false}
              />
            </View>
            <Text style={styles.currencyLine}>{market.name} · {market.currency}</Text>

            <View style={styles.itemContext}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemEyebrow}>Pricing {target.category ? `· ${target.category}` : "guide"}</Text>
                <Text style={styles.itemTitle} numberOfLines={2}>{title}</Text>
                {details ? <Text style={styles.itemDetails} numberOfLines={1}>{details}</Text> : null}
              </View>
              {existing?.photo ? <Image source={{ uri: existing.photo }} style={styles.itemImage} contentFit="cover" /> : null}
            </View>

            <View style={styles.sectionHead}>
              <View>
                <Text style={styles.sectionTitle}>Price recommendation</Text>
                <Text style={styles.sectionSub}>{guide.note}</Text>
              </View>
              <Pressable onPress={() => Alert.alert("How this works", "Uvel compares similar available listings, then adjusts for category and condition. Prices are converted into the currency you selected for this listing.")}>
                <Text style={styles.more}>More info</Text>
              </Pressable>
            </View>

            <View style={styles.recommendations}>
              <Recommendation label="Bargain" cents={guide.bargainCents} currency={currency} selected={selectedTier === "bargain"} onPress={() => choose("bargain", guide.bargainCents)} />
              <Recommendation label="Optimal" cents={guide.optimalCents} currency={currency} selected={selectedTier === "optimal"} onPress={() => choose("optimal", guide.optimalCents)} />
              <Recommendation label="Premium" cents={guide.premiumCents} currency={currency} selected={selectedTier === "premium"} onPress={() => choose("premium", guide.premiumCents)} />
            </View>

            <View style={styles.similarHead}>
              <Text style={styles.similarTitle}>{guide.comparables.length ? "Similar listings" : "Your starting point"}</Text>
              {currentCents ? <Text style={styles.selected}>{selectedLabel}</Text> : null}
            </View>
            {!guide.comparables.length ? (
              <Text style={styles.emptyCopy}>There aren’t enough close comparisons yet, so this guide starts with your item category and condition.</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <ComparableCard piece={item} currency={currency} />}
        ListFooterComponent={
          <View style={styles.footer}>
            <Pressable onPress={done} style={({ pressed }) => [styles.done, pressed && { opacity: 0.8 }]}>
              <Text style={styles.doneTxt}>{currentCents ? "Done" : `Use optimal ${formatPriceCents(guide.optimalCents, currency)}`}</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

function Recommendation({
  label,
  cents,
  currency,
  selected,
  onPress,
}: {
  label: string;
  cents: number;
  currency: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = make(colors);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.recommendation, selected && styles.recommendationSelected, pressed && { opacity: 0.78 }]}>
      {selected ? <View style={styles.selectionDot}><Text style={styles.selectionDotTxt}>✓</Text></View> : null}
      <Text style={styles.recPrice}>{formatPriceCents(cents, currency)}</Text>
      <Text style={styles.recLabel}>{label}</Text>
    </Pressable>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    analysisGate: { margin: 20, marginTop: 44, padding: 20, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.subtle + "44" },
    analysisGateTitle: { color: colors.bone, fontSize: 22, fontWeight: "700" },
    analysisGateCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
    analysisGateButton: { marginTop: 20, minHeight: 50, borderRadius: 25, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
    analysisGateButtonText: { color: colors.successInk, fontSize: 15, fontWeight: "700" },
    nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 10 },
    back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
    backTxt: { color: colors.bone, fontSize: 36, lineHeight: 38, marginTop: -4 },
    navTitle: { color: colors.bone, fontSize: 18, fontWeight: "700" },
    navSpace: { width: 42 },
    priceInputRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.subtle + "55", paddingBottom: 8, marginTop: 12 },
    symbol: { color: colors.muted, fontSize: 30, marginRight: 6 },
    priceInput: { flex: 1, color: colors.bone, fontSize: 30, height: 42, padding: 0 },
    currencyLine: { color: colors.subtle, fontSize: 12, marginHorizontal: 20, marginTop: 8 },
    itemContext: { marginHorizontal: 20, marginTop: 20, padding: 14, borderRadius: 16, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 12 },
    itemEyebrow: { color: colors.subtle, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
    itemTitle: { color: colors.bone, fontFamily: "Georgia", fontSize: 21, lineHeight: 25, marginTop: 5 },
    itemDetails: { color: colors.muted, fontSize: 13, marginTop: 5 },
    itemImage: { width: 62, height: 78, borderRadius: 10, backgroundColor: colors.ink },
    sectionHead: { marginHorizontal: 20, marginTop: 28, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    sectionTitle: { color: colors.bone, fontSize: 23, fontWeight: "700" },
    sectionSub: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 5, maxWidth: 230 },
    more: { color: colors.success, fontSize: 15, paddingTop: 3 },
    recommendations: { flexDirection: "row", gap: 10, marginHorizontal: 20, marginTop: 16 },
    recommendation: { flex: 1, minHeight: 86, borderWidth: 1, borderColor: colors.subtle + "55", borderRadius: 12, padding: 12, justifyContent: "space-between" },
    recommendationSelected: { borderColor: colors.success, backgroundColor: "rgba(214,226,122,0.08)" },
    selectionDot: { position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    selectionDotTxt: { color: colors.successInk, fontSize: 12, fontWeight: "900" },
    recPrice: { color: colors.bone, fontSize: 18, fontWeight: "700" },
    recLabel: { color: colors.muted, fontSize: 14, marginTop: 8 },
    similarHead: { marginHorizontal: 20, marginTop: 30, marginBottom: 12, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    similarTitle: { color: colors.bone, fontSize: 20, fontWeight: "600" },
    selected: { color: colors.success, fontSize: 13, fontWeight: "700" },
    emptyCopy: { color: colors.muted, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 4 },
    columns: { gap: 12, paddingHorizontal: 20 },
    comparable: { width: "50%", backgroundColor: colors.surface, borderRadius: 12, overflow: "hidden", marginBottom: 12 },
    comparableImage: { width: "100%", aspectRatio: 0.82, backgroundColor: colors.ink },
    imageFallback: { opacity: 0.6 },
    comparableBrand: { color: colors.subtle, fontSize: 11, letterSpacing: 1.1, fontWeight: "700", marginHorizontal: 10, marginTop: 10 },
    comparableMeta: { color: colors.muted, fontSize: 12, marginHorizontal: 10, marginTop: 4 },
    comparablePrice: { color: colors.bone, fontSize: 16, fontWeight: "700", marginHorizontal: 10, marginTop: 6, marginBottom: 12 },
    footer: { paddingHorizontal: 20, paddingTop: 8 },
    done: { height: 54, borderRadius: 27, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    doneTxt: { color: colors.successInk, fontSize: 16, fontWeight: "700" },
  });
}
