import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { canSeeAnalytics, ownedBrand, useBrands } from "../lib/brands";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";

export type TodayToolsDrawerProps = { onClose: () => void; onOpenSell: () => void };

type Tool = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  onPress: () => void;
};

export function TodayToolsDrawer({ onClose, onOpenSell }: TodayToolsDrawerProps) {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  useBrands();
  const mine = ownedBrand(app.uid);
  const buildTools: Tool[] = [
    { icon: "color-palette-outline", label: "Founder Studio", detail: "Shape an idea before you apply", onPress: () => router.push("/brand/founder") },
    { icon: "briefcase-outline", label: mine ? "Brand HQ" : "Start a brand", detail: mine ? `Manage ${mine.name}` : "Apply when your brand is ready", onPress: () => router.push(mine ? { pathname: "/brand/hq", params: { id: mine.id } } : "/brand/apply") },
    ...(mine?.verified && canSeeAnalytics(mine, app.uid) ? [{ icon: "bar-chart-outline" as const, label: "Brand analytics", detail: "Earnings, views, and likes", onPress: () => router.push({ pathname: "/brand/analytics", params: { id: mine.id } }) }] : []),
  ];
  const businessTools: Tool[] = [
    { icon: "stats-chart-outline", label: "Seller analytics", detail: "Listing signals and order records", onPress: () => router.push("/seller-analytics") },
    { icon: "add-circle-outline", label: "List an item", detail: "Put something new on Uvel", onPress: onOpenSell },
    { icon: "notifications-outline", label: "Price & restock alerts", detail: "Keep watch on saved pieces", onPress: () => router.push("/alerts") },
  ];

  return (
    <View style={[styles.page, { paddingTop: insets.top + 18, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Your workspace</Text>
          <Text style={styles.subtitle}>Build, launch, and run your place on Uvel.</Text>
        </View>
        <Pressable onPress={onClose} style={styles.close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Return to Today">
          <Ionicons name="chevron-forward" size={22} color={colors.bone} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>BUILD YOUR BRAND</Text>
        {buildTools.map((tool) => <ToolRow key={tool.label} tool={tool} colors={colors} styles={styles} onClose={onClose} />)}
        <Text style={[styles.section, { marginTop: 26 }]}>RUN YOUR BUSINESS</Text>
        {businessTools.map((tool) => <ToolRow key={tool.label} tool={tool} colors={colors} styles={styles} onClose={onClose} />)}
      </ScrollView>
    </View>
  );
}

function ToolRow({ tool, colors, styles, onClose }: { tool: Tool; colors: Colors; styles: ReturnType<typeof make>; onClose: () => void }) {
  return (
    <Pressable onPress={() => { onClose(); tool.onPress(); }} style={({ pressed }) => [styles.row, pressed && { opacity: 0.72 }]} accessibilityRole="button" accessibilityLabel={tool.label}>
      <View style={styles.icon}><Ionicons name={tool.icon} size={21} color={colors.success} /></View>
      <View style={{ flex: 1 }}><Text style={styles.label}>{tool.label}</Text><Text style={styles.detail}>{tool.detail}</Text></View>
      <Ionicons name="chevron-forward" size={17} color={`${colors.bone}70`} />
    </Pressable>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: 22 },
    header: { flexDirection: "row", alignItems: "flex-start", paddingBottom: 26, gap: 12 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 5 },
    subtitle: { color: `${colors.bone}91`, fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: 250 },
    close: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${colors.bone}12`, alignItems: "center", justifyContent: "center" },
    content: { paddingBottom: 28 },
    section: { color: `${colors.bone}75`, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 8 },
    row: { minHeight: 68, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 },
    icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${colors.success}24`, alignItems: "center", justifyContent: "center" },
    label: { color: colors.bone, fontSize: 15, fontWeight: "800" },
    detail: { color: `${colors.bone}80`, fontSize: 11, marginTop: 3 },
  });
}

export default TodayToolsDrawer;
