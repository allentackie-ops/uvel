import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, type Colors } from "../../lib/theme";

export default function Create() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 112 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>MAKE SOMETHING REAL</Text>
      <Text style={styles.title}>Create</Text>
      <Text style={styles.lede}>
        Start with an idea, or put something you already own in front of the right buyer.
      </Text>

      <Pressable
        onPress={() => router.push("/brand/founder")}
        style={({ pressed }) => [styles.primaryCard, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Start a brand with Founder Studio"
      >
        <View style={styles.cardTop}>
          <View style={styles.iconCircle}>
            <Ionicons name="color-palette-outline" size={24} color={colors.successInk} />
          </View>
          <Text style={styles.primaryEyebrow}>FOUNDER STUDIO</Text>
        </View>
        <Text style={styles.primaryTitle}>Start a brand</Text>
        <Text style={styles.primaryCopy}>
          Turn an idea into a first product, a clear identity, and a launch-ready brand.
        </Text>
        <View style={styles.primaryAction}>
          <Text style={styles.primaryActionText}>Open Founder Studio</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.successInk} />
        </View>
      </Pressable>

      <Pressable
        onPress={() => router.push("/sell")}
        style={({ pressed }) => [styles.secondaryCard, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Sell something from your closet"
      >
        <View style={styles.cardTop}>
          <View style={styles.secondaryIconCircle}>
            <Ionicons name="pricetag-outline" size={22} color={colors.bone} />
          </View>
          <Text style={styles.secondaryEyebrow}>YOUR CLOSET</Text>
        </View>
        <Text style={styles.secondaryTitle}>Sell from your closet</Text>
        <Text style={styles.secondaryCopy}>
          List something you already own. Keep it simple, and let buyers discover it.
        </Text>
        <View style={styles.secondaryAction}>
          <Text style={styles.secondaryActionText}>List an item</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.bone} />
        </View>
      </Pressable>

      <View style={styles.note}>
        <Ionicons name="sparkles-outline" size={18} color={colors.success} />
        <Text style={styles.noteText}>
          Founder Studio is private while you build. Brand HQ opens when your brand is ready to operate.
        </Text>
      </View>
    </ScrollView>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingHorizontal: 20 },
    kicker: { color: colors.subtle, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
    title: { color: colors.bone, fontSize: 42, lineHeight: 48, fontWeight: "800", letterSpacing: -1.2, marginTop: 10 },
    lede: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 10, marginBottom: 26, maxWidth: 360 },
    primaryCard: { backgroundColor: colors.success, borderRadius: 24, padding: 20, minHeight: 286 },
    secondaryCard: { backgroundColor: colors.surface, borderRadius: 24, padding: 20, minHeight: 240, marginTop: 14, borderWidth: 1, borderColor: colors.subtle + "36" },
    pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.successInk + "14", alignItems: "center", justifyContent: "center" },
    secondaryIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
    primaryEyebrow: { color: colors.successInk, fontSize: 11, letterSpacing: 1.5, fontWeight: "800" },
    secondaryEyebrow: { color: colors.subtle, fontSize: 11, letterSpacing: 1.5, fontWeight: "800" },
    primaryTitle: { color: colors.successInk, fontSize: 30, lineHeight: 36, fontWeight: "800", marginTop: 24 },
    secondaryTitle: { color: colors.bone, fontSize: 26, lineHeight: 32, fontWeight: "800", marginTop: 20 },
    primaryCopy: { color: colors.successInk + "D9", fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 310 },
    secondaryCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 310 },
    primaryAction: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.successInk + "42" },
    secondaryAction: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.subtle + "45" },
    primaryActionText: { color: colors.successInk, fontSize: 15, fontWeight: "800" },
    secondaryActionText: { color: colors.bone, fontSize: 15, fontWeight: "800" },
    note: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 22, paddingHorizontal: 4 },
    noteText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 },
  });
}
