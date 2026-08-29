import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { getMarket, marketsIn, regions, MARKETS } from "../lib/markets";
import { setPendingListingSelection } from "../lib/listingOptions";
import { encodeShipsTo, shipsToLabel, type ShipsTo } from "../lib/ships";
import { useColors, type Colors } from "../lib/theme";

export default function SellCountries() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { origin: originParam, selected: selectedParam } = useLocalSearchParams<{ origin?: string; selected?: string }>();
  const origin = getMarket(typeof originParam === "string" ? originParam : "US").code;
  const selectedRaw = typeof selectedParam === "string" ? selectedParam : origin;
  const initialCodes = new Set(
    selectedRaw === "all"
      ? [origin]
      : selectedRaw.split(",").map((code) => code.trim().toUpperCase()).filter((code) => MARKETS.some((market) => market.code === code)),
  );
  initialCodes.add(origin);
  const [allCountries, setAllCountries] = useState(selectedRaw === "all");
  const [selected, setSelected] = useState<Set<string>>(initialCodes);

  function toggleCountry(code: string) {
    if (code === origin) return;
    if (allCountries) {
      setAllCountries(false);
      setSelected(new Set([origin, code]));
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      next.add(origin);
      return next;
    });
  }

  function finish() {
    const next: ShipsTo = allCountries ? "all" : encodeShipsTo(origin, "pick", [...selected]);
    setPendingListingSelection("shipsTo", next);
    router.back();
  }

  const summary: ShipsTo = allCountries ? "all" : [...selected];
  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <AccessiblePressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel="Back to new listing"
        >
          <Text style={styles.backText}>‹</Text>
        </AccessiblePressable>
        <Text style={styles.title}>Where it sells</Text>
        <AccessiblePressable
          onPress={finish}
          style={({ pressed }) => [styles.doneButton, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel="Save country selection and return to new listing"
        >
          <Text style={styles.doneText}>Done</Text>
        </AccessiblePressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>LISTING VISIBILITY</Text>
        <Text style={styles.heading}>Choose the countries</Text>
        <Text style={styles.lede}>Buyers can see this listing only in the countries you select. {getMarket(origin).name} stays included because it is the listing’s home Shop.</Text>

        <AccessiblePressable
          onPress={() => setAllCountries(true)}
          style={({ pressed }) => [styles.option, allCountries && styles.optionSelected, pressed && { opacity: 0.92 }]}
          accessibilityRole="radio"
          accessibilityLabel="All countries"
          accessibilityState={{ selected: allCountries }}
          accessibilityHint="Show this listing in every country Shop."
        >
          <View style={{ flex: 1, paddingRight: 14 }}>
            <Text style={[styles.optionTitle, allCountries && styles.optionTitleSelected]}>All countries</Text>
            <Text style={[styles.optionBody, allCountries && styles.optionBodySelected]}>Show this listing in every Uvel Shop.</Text>
          </View>
          <View style={[styles.radio, allCountries && styles.radioSelected]}>{allCountries ? <View style={styles.radioDot} /> : null}</View>
        </AccessiblePressable>

        <Text style={styles.summary}>Selected: {shipsToLabel(origin, summary)}</Text>
        {regions().map((region) => (
          <View key={region}>
            <Text style={styles.region}>{region}</Text>
            {marketsIn(region).map((market) => {
              const home = market.code === origin;
              const on = allCountries || selected.has(market.code);
              return (
                <AccessiblePressable
                  key={market.code}
                  onPress={() => toggleCountry(market.code)}
                  disabled={home}
                  style={({ pressed }) => [styles.countryRow, pressed && { opacity: 0.92 }]}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${market.name}, ${market.currency}${home ? ", listing home Shop" : ""}`}
                  accessibilityState={{ checked: on, disabled: home }}
                  accessibilityHint={home ? "The listing’s home Shop is always included." : "Double tap to include or remove this country."}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.countryName, on && styles.countryOn]}>{market.name}</Text>
                    <Text style={styles.countryMeta}>{market.currency}{home ? " · home Shop" : ""}</Text>
                  </View>
                  <View style={[styles.checkbox, on && styles.checkboxOn]}>{on ? <Text style={styles.check}>✓</Text> : null}</View>
                </AccessiblePressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
    headerButton: { width: 54, height: 44, alignItems: "flex-start", justifyContent: "center", borderRadius: 22 },
    backText: { color: colors.bone, fontSize: 34, lineHeight: 38, marginTop: -4 },
    title: { color: colors.bone, fontSize: 16, fontWeight: "600" },
    doneButton: { minWidth: 54, height: 44, alignItems: "flex-end", justifyContent: "center", borderRadius: 22 },
    doneText: { color: colors.pulse, fontSize: 15, fontWeight: "800" },
    focused: { borderWidth: 2, borderColor: colors.pulse },
    content: { paddingHorizontal: 20, paddingTop: 20 },
    kicker: { color: colors.subtle, fontSize: 11, letterSpacing: 1.8 },
    heading: { color: colors.bone, fontFamily: "Georgia", fontSize: 30, marginTop: 12 },
    lede: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
    option: { minHeight: 72, borderRadius: 18, borderWidth: 1, borderColor: colors.subtle + "40", paddingHorizontal: 18, paddingVertical: 14, marginTop: 24, flexDirection: "row", alignItems: "center" },
    optionSelected: { backgroundColor: colors.pulse, borderColor: colors.pulse },
    optionTitle: { color: colors.bone, fontSize: 17, fontWeight: "700" },
    optionTitleSelected: { color: colors.ink },
    optionBody: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
    optionBodySelected: { color: colors.ink + "B3" },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.subtle + "80", alignItems: "center", justifyContent: "center" },
    radioSelected: { borderColor: colors.ink },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
    summary: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 14 },
    region: { color: colors.subtle, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 24, marginBottom: 4 },
    countryRow: { minHeight: 58, flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.subtle + "18" },
    countryName: { color: colors.bone, fontSize: 16, fontWeight: "600" },
    countryOn: { color: colors.pulse },
    countryMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
    checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.subtle + "80", alignItems: "center", justifyContent: "center" },
    checkboxOn: { backgroundColor: colors.pulse, borderColor: colors.pulse },
    check: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  });
}
