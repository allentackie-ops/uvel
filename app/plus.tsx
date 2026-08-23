import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";

const PERKS = ["Virtual try-on before you buy", "Custom shop looks on every listing you sell"];

export default function Plus() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const [plan, setPlan] = useState<"monthly" | "yearly">(app.plusPlan === "monthly" ? "monthly" : "yearly");

  function start() {
    void app.activatePlus(plan);
    router.back();
  }

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 28 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>See it on you.{"\n"}Find it for less.</Text>
        <Text style={styles.lead}>Try the piece on yourself, then list it with a shop look that actually sells.</Text>

        <View style={styles.perks}>
          {PERKS.map((line) => (
            <View key={line} style={styles.perk}>
              <View style={styles.tick}>
                <View style={styles.tickDot} />
              </View>
              <Text style={styles.perkTxt}>{line}</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={() => setPlan("yearly")} style={[styles.card, plan === "yearly" && styles.cardOn]}>
          <View style={styles.cardTop}>
            <Text style={styles.cardName}>Yearly</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>Best value</Text>
            </View>
            <Text style={styles.cardPrice}>$68.99/yr</Text>
          </View>
          <Text style={styles.cardHint}>$5.75/mo · save versus monthly</Text>
        </Pressable>

        <Pressable onPress={() => setPlan("monthly")} style={[styles.card, plan === "monthly" && styles.cardOn]}>
          <View style={styles.cardTop}>
            <Text style={styles.cardName}>Monthly</Text>
            <Text style={styles.cardPrice}>$7.99/mo</Text>
          </View>
        </Pressable>

        <Pressable onPress={start} style={styles.cta}>
          <Text style={styles.ctaTxt}>{app.isPlus ? "Update plan" : "Start Uvel+"}</Text>
        </Pressable>
        <Text style={styles.legal}>Cancel anytime.</Text>
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    body: { paddingHorizontal: 22, paddingTop: 16 },
    title: {
      color: colors.bone,
      fontFamily: "Georgia",
      fontSize: 34,
      lineHeight: 40,
      letterSpacing: -0.4,
    },
    lead: {
      color: colors.muted,
      fontSize: 16,
      lineHeight: 22,
      marginTop: 12,
      marginBottom: 28,
    },
    perks: { gap: 14, marginBottom: 28 },
    perk: { flexDirection: "row", alignItems: "center", gap: 12 },
    tick: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(214,226,122,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    tickDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D6E27A" },
    perkTxt: { flex: 1, color: colors.bone, fontSize: 16, lineHeight: 22 },
    card: {
      borderRadius: 22,
      paddingVertical: 16,
      paddingHorizontal: 18,
      marginBottom: 10,
      backgroundColor: "rgba(244,240,230,0.06)",
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.08)",
    },
    cardOn: {
      backgroundColor: "rgba(214,226,122,0.10)",
      borderColor: "rgba(214,226,122,0.55)",
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    cardName: { color: colors.bone, fontSize: 17, fontWeight: "600", flex: 1 },
    cardPrice: { color: colors.bone, fontSize: 17, fontWeight: "600" },
    cardHint: { color: colors.muted, marginTop: 6, fontSize: 13 },
    badge: {
      backgroundColor: "#D6E27A",
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeTxt: { color: "#16140F", fontSize: 10, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
    cta: {
      marginTop: 18,
      borderRadius: 999,
      paddingVertical: 17,
      alignItems: "center",
      backgroundColor: colors.pulse,
    },
    ctaTxt: { color: colors.bone, fontSize: 16, fontWeight: "600" },
    legal: { color: colors.subtle, fontSize: 12, marginTop: 14, textAlign: "center" },
  });
}
