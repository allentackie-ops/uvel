import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { ARCH, PALS, SILS, dnaHint } from "../lib/styleDna";
import { useUvel } from "../lib/store";
import { useColors, useResolvedAppearance, type Colors } from "../lib/theme";
import { pullLooks } from "../lib/trends";
import { readSupabaseStyleDna } from "../lib/supabaseStyleDna";

const ARCH_COPY: Record<string, string> = {
  "Quiet luxury": "Quiet confidence, considered layers, pieces that stay relevant.",
  Street: "Energy, contrast, and pieces that move with you.",
  "Vintage archive": "A point of view built from the best pieces of the past.",
  Utility: "Function first, with a sharper eye for proportion.",
  Romantic: "Softness, movement, and a little drama.",
  "Western city": "Heritage texture with a modern city instinct.",
  "Tailored city": "Clean lines, strong structure, and an excellent fit.",
  "Bourgeois chic": "Polished, playful, and quietly unmistakable.",
};

export default function StyleDna() {
  const app = useUvel();
  const colors = useColors();
  const appearance = useResolvedAppearance();
  const styles = useMemo(() => makeStyles(colors, appearance === "dark"), [colors, appearance]);
  const insets = useSafeAreaInsets();
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let active = true;
    void readSupabaseStyleDna().then((remote) => {
      if (!active || !remote) return;
      const hasRemote = Boolean(remote.archetype || remote.palette || remote.silhouette || remote.styles.length);
      if (!hasRemote) return;
      const localUpdated = [app.archetype, app.palette, app.silhouette, ...app.styles].filter(Boolean).join("|");
      const remoteUpdated = [remote.archetype, remote.palette, remote.silhouette, ...remote.styles].filter(Boolean).join("|");
      if (!localUpdated && remoteUpdated) void app.setStyle(remote);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function pick(patch: { archetype?: string; palette?: string; silhouette?: string }) {
    setSyncing(true);
    setSynced(false);
    await app.setStyle(patch);
    await pullLooks({ fresh: true });
    setSyncing(false);
    setSynced(true);
  }

  const completed = [app.archetype, app.palette, app.silhouette].filter(Boolean).length;
  const dnaLabel = [app.archetype, app.palette, app.silhouette].filter(Boolean).join("  ·  ") || "Not defined yet";

  return (
    <View style={styles.page}>
      <StatusBar style={appearance === "dark" ? "light" : "dark"} />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to You"><Ionicons name="arrow-back" size={22} color={colors.bone} /></AccessiblePressable>
        <View style={styles.headerTitle}><Text style={styles.headerEyebrow}>YOUR EDIT</Text><Text style={styles.title}>Style DNA</Text></View>
        <View style={styles.syncDot}>{syncing ? <Ionicons name="sync-outline" size={17} color={colors.success} /> : <View style={[styles.dot, synced && styles.dotSynced]} />}</View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroKicker}>THE SIGNAL BEHIND YOUR EDIT</Text>
          <Text style={styles.heroTitle}>Make Today feel more like you.</Text>
          <Text style={styles.heroCopy}>Your Style DNA guides the pieces, colours, silhouettes, and stories Uvel puts in front of you.</Text>
          <View style={styles.heroBottom}><Text style={styles.heroStatus}>{completed}/3 signals set</Text><View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.max(8, completed / 3 * 100)}%` }]} /></View></View>
        </View>

        <View style={styles.currentCard}><View><Text style={styles.currentKicker}>CURRENT DIRECTION</Text><Text style={styles.currentValue}>{dnaLabel}</Text></View><Ionicons name="sparkles-outline" size={24} color={colors.success} /></View>

        <ChoiceGroup label="01  YOUR MOOD" title="What should your edit feel like?" value={app.archetype} items={[...ARCH]} hint={app.archetype ? ARCH_COPY[app.archetype] || dnaHint("arch", app.archetype) : "Choose the energy you want to see more often."} onPick={(value) => void pick({ archetype: value })} styles={styles} />
        <ChoiceGroup label="02  YOUR PALETTE" title="What colours keep finding their way back?" value={app.palette} items={[...PALS]} hint={app.palette ? dnaHint("pal", app.palette) : "Set the temperature of your next edit."} onPick={(value) => void pick({ palette: value })} styles={styles} />
        <ChoiceGroup label="03  YOUR SILHOUETTE" title="How should a piece sit on you?" value={app.silhouette} items={[...SILS]} hint={app.silhouette ? dnaHint("sil", app.silhouette) : "Choose the shape that makes getting dressed easier."} onPick={(value) => void pick({ silhouette: value })} styles={styles} />

        <View style={styles.impactCard}><Ionicons name="options-outline" size={21} color={colors.success} /><View style={styles.impactCopy}><Text style={styles.impactTitle}>This changes your edit</Text><Text style={styles.impactBody}>Uvel uses these signals alongside what you save, view, and shop to rank Today and Shop.</Text></View></View>
        <Pressable onPress={() => router.replace("/")} style={styles.backToday} accessibilityRole="button"><Text style={styles.backTodayText}>See your refreshed Today ›</Text></Pressable>
      </ScrollView>
    </View>
  );
}

function ChoiceGroup({ label, title, value, items, hint, onPick, styles }: { label: string; title: string; value: string; items: string[]; hint: string; onPick: (value: string) => void; styles: ReturnType<typeof makeStyles> }) {
  return <View style={styles.group}><Text style={styles.groupLabel}>{label}</Text><Text style={styles.groupTitle}>{title}</Text><View style={styles.options}>{items.map((item) => { const selected = value === item; return <AccessiblePressable key={item} onPress={() => onPick(item)} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && { opacity: 0.88 }]} accessibilityRole="radio" accessibilityLabel={`${label}: ${item}`} accessibilityState={{ selected }}><View style={[styles.optionMark, selected && styles.optionMarkSelected]}>{selected ? <Ionicons name="checkmark" size={13} color={styles.optionCheck.color as string} /> : null}</View><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{item}</Text><Ionicons name="chevron-forward" size={17} color={selected ? styles.optionCheck.color : styles.optionChevron.color} /></AccessiblePressable>; })}</View><Text style={styles.hint}>{hint}</Text></View>;
}

function makeStyles(colors: Colors, dark: boolean) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { paddingHorizontal: 16, paddingBottom: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: `${colors.bone}18` },
    headerTitle: { alignItems: "center" },
    headerEyebrow: { color: colors.muted, fontSize: 9, letterSpacing: 1.7, fontWeight: "900" },
    title: { color: colors.bone, fontSize: 17, fontWeight: "900", marginTop: 3 },
    syncDot: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.subtle },
    dotSynced: { backgroundColor: colors.success },
    content: { paddingHorizontal: 18, paddingTop: 10 },
    hero: { minHeight: 230, borderRadius: 24, padding: 20, backgroundColor: dark ? "#20242D" : "#D9E7F7", overflow: "hidden", justifyContent: "space-between" },
    heroGlow: { position: "absolute", width: 230, height: 230, borderRadius: 115, right: -72, top: -70, backgroundColor: dark ? "#3E4961" : "#B8D7F4", opacity: 0.7 },
    heroKicker: { color: dark ? "#C5D2EF" : "#315486", fontSize: 10, letterSpacing: 1.5, fontWeight: "900" },
    heroTitle: { color: dark ? colors.bone : "#17283E", fontSize: 32, lineHeight: 35, fontWeight: "900", maxWidth: 300, marginTop: 16, letterSpacing: -0.7 },
    heroCopy: { color: dark ? colors.muted : "#4E617A", fontSize: 14, lineHeight: 20, maxWidth: 320, marginTop: 9 },
    heroBottom: { marginTop: 21, flexDirection: "row", alignItems: "center", gap: 11 },
    heroStatus: { color: dark ? colors.bone : "#315486", fontSize: 11, fontWeight: "900" },
    progress: { flex: 1, height: 6, borderRadius: 4, backgroundColor: dark ? "#454D60" : "#B8CCE3", overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 4, backgroundColor: dark ? colors.success : "#315486" },
    currentCard: { marginTop: 14, minHeight: 72, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}12`, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    currentKicker: { color: colors.muted, fontSize: 9, letterSpacing: 1.4, fontWeight: "900" },
    currentValue: { color: colors.bone, fontSize: 14, fontWeight: "800", marginTop: 6 },
    group: { marginTop: 28 },
    groupLabel: { color: colors.success, fontSize: 10, letterSpacing: 1.4, fontWeight: "900" },
    groupTitle: { color: colors.bone, fontSize: 20, lineHeight: 24, fontWeight: "900", marginTop: 7, marginBottom: 12 },
    options: { gap: 8 },
    option: { minHeight: 55, borderRadius: 14, borderWidth: 1, borderColor: `${colors.bone}22`, backgroundColor: colors.surface, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 },
    optionSelected: { backgroundColor: colors.success, borderColor: colors.success },
    optionMark: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.subtle, alignItems: "center", justifyContent: "center" },
    optionMarkSelected: { backgroundColor: colors.successInk, borderColor: colors.successInk },
    optionText: { flex: 1, color: colors.bone, fontSize: 14, fontWeight: "700" },
    optionTextSelected: { color: colors.successInk },
    optionCheck: { color: colors.successInk },
    optionChevron: { color: colors.muted },
    hint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 9 },
    impactCard: { marginTop: 30, padding: 16, borderRadius: 17, backgroundColor: dark ? "#20242D" : "#E8DDF8", flexDirection: "row", gap: 12, alignItems: "flex-start" },
    impactCopy: { flex: 1 },
    impactTitle: { color: colors.bone, fontSize: 15, fontWeight: "900" },
    impactBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
    backToday: { minHeight: 52, marginTop: 14, borderRadius: 26, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    backTodayText: { color: colors.successInk, fontSize: 14, fontWeight: "900" },
  });
}
