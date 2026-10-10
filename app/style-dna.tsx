import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { ARCH } from "../lib/styleDna";
import { useUvel } from "../lib/store";
import { useColors, useResolvedAppearance, type Colors } from "../lib/theme";
import { pullLooks } from "../lib/trends";
import { readSupabaseStyleDna } from "../lib/supabaseStyleDna";

const MOOD_COPY = "The mood you love";

type MoodKey = (typeof ARCH)[number];
type Gender = "Male" | "Female";

type MoodPanel = { Male: ImageSourcePropType; Female: ImageSourcePropType };
const PANELS: Record<MoodKey, MoodPanel> = {
  "Quiet luxury": { Male: require("../assets/style-dna/quiet-luxury-male.jpg"), Female: require("../assets/style-dna/quiet-luxury-female.jpg") },
  Street: { Male: require("../assets/style-dna/street-male.jpg"), Female: require("../assets/style-dna/street-female.jpg") },
  "Vintage archive": { Male: require("../assets/style-dna/vintage-archive-male.jpg"), Female: require("../assets/style-dna/vintage-archive-female.jpg") },
  Utility: { Male: require("../assets/style-dna/utility-male.jpg"), Female: require("../assets/style-dna/utility-female.jpg") },
  Romantic: { Male: require("../assets/style-dna/romantic-male.jpg"), Female: require("../assets/style-dna/romantic-female.jpg") },
  "Western city": { Male: require("../assets/style-dna/western-city-male.jpg"), Female: require("../assets/style-dna/western-city-female.jpg") },
  "Tailored city": { Male: require("../assets/style-dna/tailored-city-male.jpg"), Female: require("../assets/style-dna/tailored-city-female.jpg") },
  "Bourgeois chic": { Male: require("../assets/style-dna/bourgeois-chic-male.jpg"), Female: require("../assets/style-dna/bourgeois-chic-female.jpg") },
};

export default function StyleDna() {
  const app = useUvel();
  const colors = useColors();
  const appearance = useResolvedAppearance();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<MoodKey | null>(null);

  useEffect(() => {
    let active = true;
    void readSupabaseStyleDna().then((remote) => {
      if (!active || !remote || app.archetype || !remote.archetype) return;
      void app.setStyle({ archetype: remote.archetype, styles: remote.styles });
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function pickMood(value: MoodKey) {
    await app.setStyle({ archetype: value });
    await pullLooks({ fresh: true });
  }

  return (
    <View style={styles.page}>
      <StatusBar style={appearance === "dark" ? "light" : "dark"} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="arrow-back" size={23} color={colors.bone} /></AccessiblePressable>
        <Text style={styles.title}>Style DNA</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}>
        <Text style={styles.question}>What should your Today page feel like?</Text>
        <Text style={styles.hint}>{MOOD_COPY}</Text>
        <View style={styles.options}>
          {[...ARCH].map((item) => {
            const selected = app.archetype === item;
            const open = expanded === item;
            return (
              <View key={item} style={styles.moodBlock}>
                <View style={[styles.option, selected && styles.optionSelected, open && styles.optionOpen]}>
                  <AccessiblePressable onPress={() => void pickMood(item)} style={styles.optionMain} accessibilityRole="radio" accessibilityLabel={`Mood: ${item}`} accessibilityState={{ selected }}>
                    <View style={[styles.optionMark, selected && styles.optionMarkSelected]}>{selected ? <Ionicons name="checkmark" size={13} color={colors.successInk} /> : null}</View>
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{item}</Text>
                  </AccessiblePressable>
                  <AccessiblePressable onPress={() => setExpanded(open ? null : item)} style={({ pressed }) => [styles.arrowButton, pressed && { opacity: 0.65 }]} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${open ? "Hide" : "Show"} ${item} examples`} accessibilityState={{ expanded: open }}>
                    <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={selected ? colors.successInk : colors.muted} />
                  </AccessiblePressable>
                </View>
                {open ? <MoodExamples mood={item} colors={colors} styles={styles} /> : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function MoodExamples({ mood, colors, styles }: { mood: MoodKey; colors: Colors; styles: ReturnType<typeof makeStyles> }) {
  const [gender, setGender] = useState<Gender>("Male");
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const timer = setInterval(() => {
      setGender((current) => current === "Male" ? "Female" : "Male");
      slide.setValue(18);
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 5 }).start();
    }, 3800);
    return () => clearInterval(timer);
  }, [slide]);

  return (
    <View style={styles.examples}>
      <View style={styles.examplesHeader}><View><Text style={styles.examplesKicker}>EXAMPLE</Text><Text style={styles.gender}>{gender}</Text></View><View style={styles.slideHint}><Ionicons name="swap-horizontal" size={15} color={colors.muted} /><Text style={styles.slideHintText}>auto-slides</Text></View></View>
      <Animated.View style={[styles.panelFrame, { transform: [{ translateX: slide }] }]}>
        <Image source={PANELS[mood][gender]} style={styles.panelImage} resizeMode="cover" accessibilityLabel={`${gender} ${mood} three-look fashion examples`} />
      </Animated.View>
      <View style={styles.panelFooter}><Text style={styles.panelCaption}>Three looks for {mood.toLowerCase()}</Text><View style={styles.dots}><View style={[styles.dot, gender === "Male" && styles.dotActive]} /><View style={[styles.dot, gender === "Female" && styles.dotActive]} /></View></View>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { minHeight: 68, alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 12, flexDirection: "row" },
    back: { width: 28, height: 34, alignItems: "flex-start", justifyContent: "center" },
    title: { color: colors.bone, fontSize: 18, fontWeight: "900" },
    headerSpacer: { width: 28, height: 34 },
    content: { paddingHorizontal: 18, paddingTop: 26 },
    question: { color: colors.bone, fontSize: 28, lineHeight: 33, fontWeight: "900", letterSpacing: -0.5 },
    hint: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 9, marginBottom: 23 },
    options: { gap: 9 },
    moodBlock: { borderRadius: 15, overflow: "hidden" },
    option: { minHeight: 58, borderRadius: 15, borderWidth: 1, borderColor: `${colors.bone}22`, backgroundColor: colors.surface, paddingLeft: 14, flexDirection: "row", alignItems: "center" },
    optionOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
    optionSelected: { backgroundColor: colors.success, borderColor: colors.success },
    optionMain: { flex: 1, minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12 },
    arrowButton: { width: 52, minHeight: 58, alignItems: "center", justifyContent: "center" },
    optionMark: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: colors.subtle, alignItems: "center", justifyContent: "center" },
    optionMarkSelected: { backgroundColor: colors.successInk, borderColor: colors.successInk },
    optionText: { flex: 1, color: colors.bone, fontSize: 15, fontWeight: "700" },
    optionTextSelected: { color: colors.successInk },
    examples: { padding: 13, backgroundColor: colors.surface, borderWidth: 1, borderTopWidth: 0, borderColor: `${colors.bone}22`, borderBottomLeftRadius: 15, borderBottomRightRadius: 15 },
    examplesHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 9 },
    examplesKicker: { color: colors.success, fontSize: 9, letterSpacing: 1.5, fontWeight: "900" },
    gender: { color: colors.bone, fontSize: 20, fontWeight: "900", marginTop: 2 },
    slideHint: { flexDirection: "row", alignItems: "center", gap: 4, paddingBottom: 2 },
    slideHintText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
    panelFrame: { width: "100%", aspectRatio: 1.18, borderRadius: 12, overflow: "hidden", backgroundColor: colors.ink },
    panelImage: { width: "100%", height: "100%" },
    panelFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 9 },
    panelCaption: { color: colors.muted, fontSize: 11, fontWeight: "700" },
    dots: { flexDirection: "row", gap: 4 },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.subtle },
    dotActive: { width: 15, backgroundColor: colors.success },
  });
}
