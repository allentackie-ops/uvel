import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { canSeeAnalytics, ownedBrand, useBrands } from "../lib/brands";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";

export const DRAWER_WIDTH = Math.min(Dimensions.get("window").width * 0.84, 360);
const SPRING = { damping: 28, stiffness: 300, mass: 0.82 };

type Tool = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  onPress: () => void;
};

export function TodayToolsDrawer({ open, onOpen, onClose, progress: externalProgress }: { open: boolean; onOpen: () => void; onClose: () => void; progress?: SharedValue<number> }) {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  useBrands();
  const localProgress = useSharedValue(0);
  const progress = externalProgress ?? localProgress;
  const mine = ownedBrand(app.uid);
  const hasAnalytics = Boolean(mine?.verified && canSeeAnalytics(mine, app.uid));

  useEffect(() => {
    progress.value = open ? withSpring(1, SPRING) : withTiming(0, { duration: 220 });
  }, [open, progress]);

  const drawerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (progress.value - 1) * DRAWER_WIDTH }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.42 }));
  const edgeSwipe = Gesture.Pan()
    .activeOffsetX(14)
    .failOffsetY([-24, 24])
    .onUpdate((event) => {
      if (externalProgress) progress.value = Math.max(0, Math.min(1, event.translationX / DRAWER_WIDTH));
    })
    .onEnd((event) => {
      if (event.translationX > 56 || event.velocityX > 500) runOnJS(onOpen)();
      else if (externalProgress) progress.value = withTiming(0, { duration: 180 });
    });
  const closeSwipe = Gesture.Pan()
    .activeOffsetX(-14)
    .failOffsetY([-24, 24])
    .onUpdate((event) => {
      if (externalProgress) progress.value = Math.max(0, Math.min(1, 1 + event.translationX / DRAWER_WIDTH));
    })
    .onEnd((event) => {
      if (event.translationX < -56 || event.velocityX < -500) runOnJS(onClose)();
      else if (externalProgress) progress.value = withSpring(1, SPRING);
    });

  const buildTools: Tool[] = [
    { icon: "sparkles-outline", label: "Founder Studio", detail: "Shape an idea before you apply", onPress: () => router.push("/brand/founder") },
    { icon: "briefcase-outline", label: mine ? "Brand HQ" : "Start a brand", detail: mine ? `Manage ${mine.name}` : "Apply when your brand is ready", onPress: () => router.push(mine ? { pathname: "/brand/hq", params: { id: mine.id } } : "/brand/apply") },
    ...(mine?.verified && hasAnalytics ? [{ icon: "bar-chart-outline" as const, label: "Brand analytics", detail: "Earnings, views, and likes", onPress: () => router.push({ pathname: "/brand/analytics", params: { id: mine.id } }) }] : []),
  ];
  const businessTools: Tool[] = [
    { icon: "stats-chart-outline", label: "Seller analytics", detail: "Listing signals and order records", onPress: () => router.push("/seller-analytics") },
    { icon: "add-circle-outline", label: "List an item", detail: "Put something new on Uvel", onPress: () => router.push("/sell") },
    { icon: "notifications-outline", label: "Price & restock alerts", detail: "Keep watch on saved pieces", onPress: () => router.push("/alerts") },
  ];

  return (
    <>
      {!open ? (
        <GestureDetector gesture={edgeSwipe}>
          <View style={styles.edgeZone} pointerEvents="box-only" accessibilityElementsHidden />
        </GestureDetector>
      ) : null}
      <Animated.View style={[styles.layer, { paddingTop: insets.top }]} pointerEvents={open ? "box-none" : "none"}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
            {open ? <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close tools drawer" /> : null}
          </Animated.View>
          <GestureDetector gesture={closeSwipe}>
            <Animated.View style={[styles.drawer, drawerStyle]} pointerEvents={open ? "auto" : "none"}>
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>TODAY</Text>
                  <Text style={styles.title}>Your workspace</Text>
                  <Text style={styles.subtitle}>Build, launch, and run your place on Uvel.</Text>
                </View>
                <Pressable onPress={onClose} style={styles.close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close tools drawer">
                  <Ionicons name="close" size={22} color={colors.bone} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.section}>BUILD YOUR BRAND</Text>
                {buildTools.map((tool) => <ToolRow key={tool.label} tool={tool} colors={colors} styles={styles} onClose={onClose} />)}
                <Text style={[styles.section, { marginTop: 26 }]}>RUN YOUR BUSINESS</Text>
                {businessTools.map((tool) => <ToolRow key={tool.label} tool={tool} colors={colors} styles={styles} onClose={onClose} />)}
                <Text style={styles.note}>These tools live here so your You page can stay focused on you.</Text>
              </ScrollView>
            </Animated.View>
          </GestureDetector>
      </Animated.View>
    </>
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
    layer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 90, elevation: 90 },
    edgeZone: { position: "absolute", top: 0, bottom: 108, left: 0, width: 30, zIndex: 85, elevation: 85 },
    backdrop: { backgroundColor: "#000" },
    drawer: { position: "absolute", top: 0, bottom: 0, left: 0, width: DRAWER_WIDTH, backgroundColor: colors.ink, paddingHorizontal: 22, borderRightWidth: 1, borderRightColor: `${colors.bone}20`, shadowColor: "#000", shadowOpacity: 0.24, shadowRadius: 20, shadowOffset: { width: 8, height: 0 }, elevation: 18 },
    header: { flexDirection: "row", alignItems: "flex-start", paddingTop: 18, paddingBottom: 26, gap: 12 },
    eyebrow: { color: colors.success, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 5 },
    subtitle: { color: `${colors.bone}91`, fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: 250 },
    close: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${colors.bone}12`, borderWidth: 1, borderColor: `${colors.bone}28`, alignItems: "center", justifyContent: "center" },
    section: { color: `${colors.bone}75`, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 8 },
    row: { minHeight: 68, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20` },
    icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${colors.success}24`, alignItems: "center", justifyContent: "center" },
    label: { color: colors.bone, fontSize: 15, fontWeight: "800" },
    detail: { color: `${colors.bone}80`, fontSize: 11, marginTop: 3 },
    note: { color: `${colors.bone}66`, fontSize: 12, lineHeight: 18, marginTop: 28 },
  });
}

export default TodayToolsDrawer;
