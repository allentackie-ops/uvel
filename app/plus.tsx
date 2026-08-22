import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Glass } from "../components/Glass";
import { useUvel } from "../lib/store";
import { colors } from "../lib/theme";

export default function Plus() {
  const app = useUvel();
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");

  return (
    <View style={styles.page}>
      <Text style={styles.kicker}>UVEL+</Text>
      <Text style={styles.title}>See it on you. Find it for less.</Text>
      {["Unlimited look scans across Depop, Grailed, Vestiaire, and more", "Virtual try-on before you buy", "Daily trend scan from TikTok, Instagram, Snapchat, and X", "A style report written against your closet"].map((b) => (
        <Text key={b} style={styles.bullet}>
          {b}
        </Text>
      ))}

      <Pressable onPress={() => setPlan("yearly")}>
        <Glass style={[styles.plan, plan === "yearly" && styles.planOn]}>
          <View style={styles.row}>
            <Text style={styles.h3}>Yearly</Text>
            <Text style={styles.h3}>$68.99/yr</Text>
          </View>
          <Text style={styles.p}>Save versus monthly · $5.75/mo</Text>
        </Glass>
      </Pressable>
      <Pressable onPress={() => setPlan("monthly")}>
        <Glass style={[styles.plan, plan === "monthly" && styles.planOn]}>
          <View style={styles.row}>
            <Text style={styles.h3}>Monthly</Text>
            <Text style={styles.h3}>$7.99/mo</Text>
          </View>
        </Glass>
      </Pressable>

      <Pressable
        onPress={() => {
          void app.activatePlus(plan);
          router.back();
        }}
      >
        <Glass interactive style={styles.cta}>
          <Text style={styles.ctaText}>Start Uvel+</Text>
        </Glass>
      </Pressable>
      <Text style={styles.note}>
        After you connect App Store Connect on expo.dev, this button charges through StoreKit. Until those products exist, it unlocks Plus on this device so you can test.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink, padding: 24, paddingTop: 72 },
  kicker: { color: colors.subtle, letterSpacing: 2, fontSize: 11 },
  title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, marginTop: 8, marginBottom: 16 },
  bullet: { color: colors.muted, marginBottom: 8, lineHeight: 20 },
  plan: { borderRadius: 20, padding: 16, marginTop: 10 },
  planOn: { backgroundColor: "rgba(244,239,232,0.16)" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  h3: { color: colors.bone, fontWeight: "600" },
  p: { color: colors.muted, marginTop: 4, fontSize: 12 },
  cta: { marginTop: 20, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  ctaText: { color: colors.bone, fontWeight: "600" },
  note: { color: colors.subtle, fontSize: 11, marginTop: 14, lineHeight: 16, textAlign: "center" },
});
