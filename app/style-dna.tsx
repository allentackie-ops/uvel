import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { ARCH } from "../lib/styleDna";
import { useUvel } from "../lib/store";
import { useColors, useResolvedAppearance, type Colors } from "../lib/theme";
import { pullLooks } from "../lib/trends";
import { readSupabaseStyleDna } from "../lib/supabaseStyleDna";

const MOOD_COPY: Record<string, string> = {
  "Quiet luxury": "The mood you love",
  Street: "The mood you love",
  "Vintage archive": "The mood you love",
  Utility: "The mood you love",
  Romantic: "The mood you love",
  "Western city": "The mood you love",
  "Tailored city": "The mood you love",
  "Bourgeois chic": "The mood you love",
};

export default function StyleDna() {
  const app = useUvel();
  const colors = useColors();
  const appearance = useResolvedAppearance();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let active = true;
    void readSupabaseStyleDna().then((remote) => {
      if (!active || !remote || app.archetype || !remote.archetype) return;
      void app.setStyle({ archetype: remote.archetype, styles: remote.styles });
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function pickMood(value: string) {
    await app.setStyle({ archetype: value });
    await pullLooks({ fresh: true });
  }

  return (
    <View style={styles.page}>
      <StatusBar style={appearance === "dark" ? "light" : "dark"} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Style DNA</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}>
        <Text style={styles.question}>What should your Today page feel like?</Text>
        <Text style={styles.hint}>{MOOD_COPY[app.archetype] || "The mood you love"}</Text>
        <View style={styles.options}>
          {[...ARCH].map((item) => {
            const selected = app.archetype === item;
            return (
              <AccessiblePressable
                key={item}
                onPress={() => void pickMood(item)}
                style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && { opacity: 0.88 }]}
                accessibilityRole="radio"
                accessibilityLabel={`Mood: ${item}`}
                accessibilityState={{ selected }}
                accessibilityHint={`Double tap to choose ${item} as the mood for your Today page.`}
              >
                <View style={[styles.optionMark, selected && styles.optionMarkSelected]}>{selected ? <Ionicons name="checkmark" size={13} color={colors.successInk} /> : null}</View>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{item}</Text>
                <Ionicons name="chevron-forward" size={19} color={selected ? colors.successInk : colors.muted} />
              </AccessiblePressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { minHeight: 68, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingBottom: 12 },
    title: { color: colors.bone, fontSize: 18, fontWeight: "900" },
    content: { paddingHorizontal: 18, paddingTop: 26 },
    question: { color: colors.bone, fontSize: 28, lineHeight: 33, fontWeight: "900", letterSpacing: -0.5 },
    hint: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 9, marginBottom: 23 },
    options: { gap: 9 },
    option: { minHeight: 58, borderRadius: 15, borderWidth: 1, borderColor: `${colors.bone}22`, backgroundColor: colors.surface, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 },
    optionSelected: { backgroundColor: colors.success, borderColor: colors.success },
    optionMark: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: colors.subtle, alignItems: "center", justifyContent: "center" },
    optionMarkSelected: { backgroundColor: colors.successInk, borderColor: colors.successInk },
    optionText: { flex: 1, color: colors.bone, fontSize: 15, fontWeight: "700" },
    optionTextSelected: { color: colors.successInk },
  });
}
