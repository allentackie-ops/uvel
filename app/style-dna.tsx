import { router } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { ARCH, PALS, SILS, dnaHint } from "../lib/styleDna";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { pullLooks } from "../lib/trends";

export default function StyleDna() {
  const app = useUvel();
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const dnaReady = Boolean(app.archetype || app.palette || app.silhouette);

  function pick(patch: { archetype?: string; palette?: string; silhouette?: string }) {
    app.setStyle(patch);
    void pullLooks({ fresh: true });
  }

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <AccessiblePressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.focused]}
          accessibilityRole="button"
          accessibilityLabel="Back to You"
        >
          <Text style={styles.backText}>‹</Text>
        </AccessiblePressable>
        <Text style={styles.title}>Style DNA</Text>
        <View style={styles.backPlaceholder} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>YOUR PREFERENCES</Text>
        <Text style={styles.heading}>Shape what Uvel shows you.</Text>
        <Text style={styles.lede}>
          Choose a style, palette, and silhouette. Today and Shop use this mix to shape the looks and pieces they put in front of you.
        </Text>

        <OptionGroup
          label="Style"
          value={app.archetype}
          items={[...ARCH]}
          hint={app.archetype ? dnaHint("arch", app.archetype) : "Choose the mood that feels most like you."}
          onPick={(value) => pick({ archetype: value })}
          styles={styles}
        />
        <OptionGroup
          label="Palette"
          value={app.palette}
          items={[...PALS]}
          hint={app.palette ? dnaHint("pal", app.palette) : "Choose the colours you reach for most."}
          onPick={(value) => pick({ palette: value })}
          styles={styles}
        />
        <OptionGroup
          label="Silhouette"
          value={app.silhouette}
          items={[...SILS]}
          hint={app.silhouette ? dnaHint("sil", app.silhouette) : "Choose how you like a piece to sit on the body."}
          onPick={(value) => pick({ silhouette: value })}
          styles={styles}
        />

        <View style={styles.savedNote} accessibilityLiveRegion="polite">
          <Text style={styles.savedTitle}>{dnaReady ? "Style DNA saved" : "Style DNA is not set"}</Text>
          <Text style={styles.savedCopy}>
            {dnaReady ? "Change any choice whenever your taste shifts." : "Choose at least one option to start shaping Today."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function OptionGroup({
  label,
  value,
  items,
  hint,
  onPick,
  styles,
}: {
  label: string;
  value: string;
  items: string[];
  hint: string;
  onPick: (value: string) => void;
  styles: ReturnType<typeof make>;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.options}>
        {items.map((item) => {
          const selected = value === item;
          return (
            <AccessiblePressable
              key={item}
              onPress={() => onPick(item)}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.focused]}
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${item}`}
              accessibilityState={{ selected }}
              accessibilityHint={`Double tap to choose ${item} as your ${label.toLowerCase()}.`}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{item}</Text>
              <Text style={[styles.check, !selected && styles.checkHidden]}>{selected ? "✓" : ""}</Text>
            </AccessiblePressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
    back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    backText: { color: colors.bone, fontSize: 34, lineHeight: 38, marginTop: -4 },
    backPlaceholder: { width: 44, height: 44 },
    focused: { borderWidth: 2, borderColor: colors.success },
    title: { color: colors.bone, fontSize: 16, fontWeight: "600" },
    content: { paddingHorizontal: 20, paddingTop: 20 },
    kicker: { color: colors.subtle, fontSize: 11, letterSpacing: 1.8, fontWeight: "600" },
    heading: { color: colors.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 12 },
    lede: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
    group: { marginTop: 30 },
    groupLabel: { color: colors.subtle, fontSize: 12, letterSpacing: 0.8, marginBottom: 10 },
    options: { gap: 10 },
    option: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: colors.subtle + "40", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    optionSelected: { backgroundColor: colors.success, borderColor: colors.success },
    optionText: { color: colors.bone, fontSize: 16, fontWeight: "600" },
    optionTextSelected: { color: colors.successInk },
    check: { color: colors.successInk, fontSize: 22, fontWeight: "700" },
    checkHidden: { opacity: 0 },
    hint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 9 },
    savedNote: { marginTop: 30, padding: 16, borderRadius: 16, backgroundColor: colors.surface },
    savedTitle: { color: colors.bone, fontSize: 14, fontWeight: "700" },
    savedCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  });
}
