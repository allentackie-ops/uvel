import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { LISTING_CONDITIONS, setPendingListingSelection } from "../lib/listingOptions";
import { useColors, type Colors } from "../lib/theme";

export default function SellCondition() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { selected } = useLocalSearchParams<{ selected?: string }>();

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <AccessiblePressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.focused]}
          accessibilityRole="button"
          accessibilityLabel="Back to new listing"
        >
          <Text style={styles.backText}>‹</Text>
        </AccessiblePressable>
        <Text style={styles.title}>Condition</Text>
        <View style={styles.backPlaceholder} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>LISTING DETAILS</Text>
        <Text style={styles.heading}>How would you describe it?</Text>
        <Text style={styles.lede}>Be clear about wear so buyers know what to expect.</Text>
        <View style={styles.options}>
          {LISTING_CONDITIONS.map((item) => {
            const isSelected = selected === item;
            return (
              <AccessiblePressable
                key={item}
                onPress={() => {
                  setPendingListingSelection("condition", item);
                  router.back();
                }}
                style={({ pressed }) => [styles.option, isSelected && styles.optionSelected, pressed && styles.focused]}
                accessibilityRole="radio"
                accessibilityLabel={`Condition: ${item}`}
                accessibilityState={{ selected: isSelected }}
                accessibilityHint="Double tap to choose this condition and return to your listing."
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{item}</Text>
                <Text style={[styles.check, !isSelected && styles.checkHidden]}>{isSelected ? "✓" : ""}</Text>
              </AccessiblePressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
    back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
    backText: { color: colors.bone, fontSize: 34, lineHeight: 38, marginTop: -4 },
    backPlaceholder: { width: 44, height: 44 },
    focused: { borderWidth: 2, borderColor: colors.pulse },
    title: { color: colors.bone, fontSize: 16, fontWeight: "600" },
    content: { paddingHorizontal: 20, paddingTop: 20 },
    kicker: { color: colors.subtle, fontSize: 11, letterSpacing: 1.8 },
    heading: { color: colors.bone, fontFamily: "Georgia", fontSize: 30, marginTop: 12 },
    lede: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10, maxWidth: 440 },
    options: { gap: 12, marginTop: 28 },
    option: { minHeight: 60, borderRadius: 18, borderWidth: 1, borderColor: colors.subtle + "40", paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    optionSelected: { backgroundColor: colors.pulse, borderColor: colors.pulse },
    optionText: { color: colors.bone, fontSize: 17, fontWeight: "500" },
    optionTextSelected: { color: colors.ink },
    check: { color: colors.ink, fontSize: 22, fontWeight: "700" },
    checkHidden: { opacity: 0 },
  });
}
