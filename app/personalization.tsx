import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { clearPersonalization } from "../lib/personalization";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";

export default function Personalization() {
  const app = useUvel();
  const colors = useColors();
  const styles = make(colors);
  const uid = app.uid || "guest";
  const [crossApp, setCrossApp] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void import("expo-tracking-transparency")
      .then(({ getTrackingPermissionsAsync }) => getTrackingPermissionsAsync())
      .then((permission) => setCrossApp(permission.status === "granted"))
      .catch(() => setCrossApp(false));
  }, []);

  async function toggleCrossApp(enabled: boolean) {
    if (!enabled) {
      setCrossApp(false);
      if (Platform.OS === "ios") await Linking.openSettings();
      return;
    }
    if (Platform.OS !== "ios") {
      Alert.alert("Not available on this device", "Android does not provide a permission to read activity from other apps. Uvel only uses the activity you choose to share inside Uvel.");
      return;
    }
    try {
      const { requestTrackingPermissionsAsync } = await import("expo-tracking-transparency");
      const permission = await requestTrackingPermissionsAsync();
      setCrossApp(permission.status === "granted");
    } catch {
      setCrossApp(false);
      Alert.alert("App update required", "Cross-app tracking is not available in this installed app version. You can still use Uvel’s in-app personalization now.");
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.heroIcon}><Ionicons name="sparkles-outline" size={24} color={colors.successInk} /></View>
      <Text style={styles.title}>Make Today yours</Text>
      <Text style={styles.intro}>Uvel learns from how you use the app from day one—what you view, save, search, share, try on, like, and read closely—so your marketplace edit gets sharper over time.</Text>

      <View style={styles.card}>
        <Pressable onPress={() => { void clearPersonalization(uid); Alert.alert("Your edit was cleared", "Uvel will start learning your Today preferences again from now on."); }} style={styles.clearRow} accessibilityRole="button">
          <Text style={styles.clearText}>Clear my Today activity</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowIcon}><Ionicons name="phone-portrait-outline" size={20} color={colors.bone} /></View>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>Activity from other apps</Text>
            <Text style={styles.rowHint}>On iPhone, Apple may ask whether Uvel can use activity across other companies’ apps for advertising and measurement. Uvel cannot read what you watch or type in other apps.</Text>
          </View>
          <Switch
            value={crossApp}
            onValueChange={(enabled) => void toggleCrossApp(enabled)}
            trackColor={{ false: colors.neutral, true: colors.success }}
            thumbColor={crossApp ? colors.successInk : "#FFFFFF"}
            accessibilityLabel="Activity from other apps"
          />
        </View>
        <Text style={styles.boundary}>{Platform.OS === "ios" ? "Optional. You can change this any time in iPhone Settings." : "Not available on Android. Uvel keeps personalization inside the app."}</Text>
      </View>

      <Text style={styles.privacy}>Your Today profile is stored on this device and is used to rank listings. You can clear it whenever you want.</Text>
      <Pressable onPress={() => router.push({ pathname: "/legal/[id]", params: { id: "privacy" } })} style={styles.privacyLink} accessibilityRole="button">
        <Text style={styles.privacyLinkText}>Read Uvel’s Privacy Policy</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.success} />
      </Pressable>
    </ScrollView>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { padding: 20, paddingBottom: 72 },
    heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    title: { color: colors.bone, fontSize: 28, fontWeight: "700", marginTop: 18, letterSpacing: -0.5 },
    intro: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 360 },
    card: { marginTop: 24, padding: 16, borderRadius: 18, backgroundColor: colors.surface },
    row: { flexDirection: "row", alignItems: "flex-start" },
    rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
    copy: { flex: 1, marginHorizontal: 12 },
    rowTitle: { color: colors.bone, fontSize: 16, fontWeight: "700" },
    rowHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.ink, marginVertical: 15 },
    clearRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 28 },
    clearText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
    boundary: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 14 },
    privacy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 24 },
    privacyLink: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14 },
    privacyLinkText: { color: colors.success, fontSize: 13, fontWeight: "700" },
  });
}
