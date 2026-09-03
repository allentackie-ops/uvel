import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";

type Benefit = {
  mark: string;
  title: string;
  detail: string;
  action?: string;
  route?: "/seller-analytics" | "/alerts";
};

const BENEFITS: Benefit[] = [
  {
    mark: "01",
    title: "Try it on without limits",
    detail: "Unlimited virtual try-on before you buy.",
  },
  {
    mark: "02",
    title: "Sell with a sharper point of view",
    detail: "Custom shop looks on every listing you sell.",
  },
  {
    mark: "03",
    title: "Know what is worth improving",
    detail: "Seller analytics for your listings and order records.",
    action: "Open analytics",
    route: "/seller-analytics",
  },
  {
    mark: "04",
    title: "Stay close to the pieces you want",
    detail: "Price-drop and restock alerts on saved items.",
    action: "Manage alerts",
    route: "/alerts",
  },
];

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

  function openLegal(id: "privacy" | "terms") {
    router.push({ pathname: "/legal/[id]", params: { id } });
  }

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.title}>More intention.{"\n"}Less second-guessing.</Text>
          <View style={styles.heroStamp}>
            <Text style={styles.heroStampText}>U+</Text>
          </View>
        </View>

        <View style={styles.benefits}>
          {BENEFITS.map((benefit) => (
            <View key={benefit.mark} style={styles.benefit}>
              <View style={styles.mark}><Text style={styles.markText}>{benefit.mark}</Text></View>
              <View style={styles.benefitCopy}>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDetail}>{benefit.detail}</Text>
                {app.isPlus && benefit.action && benefit.route ? (
                  <Pressable onPress={() => router.push(benefit.route as never)} hitSlop={8} accessibilityRole="button" accessibilityLabel={benefit.action}>
                    <Text style={styles.benefitAction}>{benefit.action} <Text style={styles.benefitArrow}>↗</Text></Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.planHeading}>
          <Text style={styles.planHint}>Change or cancel anytime in iOS Settings.</Text>
        </View>

        <View style={styles.planGroup}>
          <Pressable
            onPress={() => setPlan("yearly")}
            style={({ pressed }) => [styles.planCard, plan === "yearly" && styles.planCardOn, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ selected: plan === "yearly" }}
            accessibilityLabel="Yearly Uvel Plus plan, 68 dollars and 99 cents per year"
          >
            <View style={[styles.radio, plan === "yearly" && styles.radioOn]}>{plan === "yearly" ? <View style={styles.radioDot} /> : null}</View>
            <View style={styles.planInfo}>
              <View style={styles.planNameRow}>
                <Text style={styles.planName}>Yearly</Text>
                <View style={styles.valueBadge}><Text style={styles.valueBadgeText}>BEST VALUE</Text></View>
              </View>
              <Text style={styles.planSub}>$5.75/mo · save versus monthly</Text>
            </View>
            <Text style={styles.planPrice}>$68.99<Text style={styles.planUnit}>/yr</Text></Text>
          </Pressable>

          <Pressable
            onPress={() => setPlan("monthly")}
            style={({ pressed }) => [styles.planCard, plan === "monthly" && styles.planCardOn, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ selected: plan === "monthly" }}
            accessibilityLabel="Monthly Uvel Plus plan, 7 dollars and 99 cents per month"
          >
            <View style={[styles.radio, plan === "monthly" && styles.radioOn]}>{plan === "monthly" ? <View style={styles.radioDot} /> : null}</View>
            <View style={styles.planInfo}><Text style={styles.planName}>Monthly</Text></View>
            <Text style={styles.planPrice}>$7.99<Text style={styles.planUnit}>/mo</Text></Text>
          </Pressable>
        </View>

        <Pressable onPress={start} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]} accessibilityRole="button" accessibilityLabel={app.isPlus ? "Manage Uvel Plus subscription" : "Start Uvel Plus subscription"}>
          <Text style={styles.ctaText}>{app.isPlus ? "Manage Uvel+" : "Start Uvel+"}</Text>
          <Text style={styles.ctaArrow}>→</Text>
        </Pressable>

        <Text style={styles.legal}>Auto-renews unless you cancel at least 24 hours before the period ends.</Text>
        <View style={styles.links}>
          <Pressable onPress={() => openLegal("privacy")} hitSlop={8} accessibilityRole="link"><Text style={styles.link}>Privacy Policy</Text></Pressable>
          <View style={styles.linkDot} />
          <Pressable onPress={() => openLegal("terms")} hitSlop={8} accessibilityRole="link"><Text style={styles.link}>Terms and Conditions</Text></Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    body: { paddingHorizontal: 22 },
    hero: { marginTop: 18, paddingBottom: 28, position: "relative" },
    title: { color: colors.bone, fontSize: 34, fontWeight: "800", lineHeight: 40, letterSpacing: -0.5 },
    heroStamp: { position: "absolute", right: 2, bottom: 4, width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: colors.success, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-12deg" }] },
    heroStampText: { color: colors.success, fontSize: 16, fontWeight: "800" },
    benefits: { marginTop: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.neutral },
    benefit: { flexDirection: "row", gap: 13, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.neutral },
    mark: { width: 29, height: 29, borderRadius: 15, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginTop: 1 },
    markText: { color: colors.successInk, fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
    benefitCopy: { flex: 1 },
    benefitTitle: { color: colors.bone, fontSize: 15, fontWeight: "800" },
    benefitDetail: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
    benefitAction: { color: colors.success, fontSize: 12, fontWeight: "800", marginTop: 6 },
    benefitArrow: { fontSize: 14 },
    planHeading: { marginTop: 26, marginBottom: 11 },
    planHint: { color: colors.muted, fontSize: 12 },
    planGroup: { gap: 10 },
    planCard: { minHeight: 83, borderRadius: 18, borderWidth: 1, borderColor: colors.neutral, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 11 },
    planCardOn: { borderColor: colors.success, backgroundColor: colors.pulse },
    pressed: { opacity: 0.84 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.muted, alignItems: "center", justifyContent: "center" },
    radioOn: { borderColor: colors.success },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
    planInfo: { flex: 1 },
    planNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    planName: { color: colors.bone, fontSize: 17, fontWeight: "800" },
    valueBadge: { backgroundColor: colors.success, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
    valueBadgeText: { color: colors.successInk, fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
    planSub: { color: colors.muted, fontSize: 12, marginTop: 5 },
    planPrice: { color: colors.bone, fontSize: 18, fontWeight: "800" },
    planUnit: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    cta: { marginTop: 18, minHeight: 57, borderRadius: 29, backgroundColor: colors.success, paddingHorizontal: 21, flexDirection: "row", alignItems: "center", justifyContent: "center" },
    ctaPressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
    ctaText: { color: colors.successInk, fontSize: 16, fontWeight: "900", letterSpacing: 0.2 },
    ctaArrow: { color: colors.successInk, fontSize: 20, position: "absolute", right: 22 },
    legal: { color: colors.subtle, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 15 },
    links: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10 },
    link: { color: colors.bone, fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },
    linkDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.subtle },
  });
}
