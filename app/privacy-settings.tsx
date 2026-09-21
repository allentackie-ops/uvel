import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadPrivacySettings, savePrivacySetting, type PrivacySettingKey, type PrivacySettings } from "../lib/privacy";
import { useColors, type Colors } from "../lib/theme";
import { useUvel } from "../lib/store";

const OPTIONS: Array<{ key: PrivacySettingKey; title: string; body: string }> = [
  {
    key: "marketingFeature",
    title: "Feature my items in marketing campaigns",
    body: "Allow Uvel to showcase your listings on social media and other websites. More visibility may help them sell faster.",
  },
  {
    key: "favoriteNotifications",
    title: "Notify sellers when I favorite their items",
    body: "Let sellers know when you save one of their listings.",
  },
  {
    key: "personalizedContent",
    title: "Personalized content",
    body: "Allow Uvel to personalize your feed and search results using your preferences, settings, purchases, and in-app activity.",
  },
  {
    key: "recentlyViewed",
    title: "Show my recently viewed items on Today",
    body: "Use recently viewed items to make your Today feed more useful. Turning this off does not disable other personalization.",
  },
];

export default function PrivacySettings() {
  const app = useUvel();
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<PrivacySettings>({
    marketingFeature: true,
    favoriteNotifications: true,
    personalizedContent: true,
    recentlyViewed: true,
  });

  useEffect(() => {
    let live = true;
    void loadPrivacySettings(app.uid || undefined).then((next) => {
      if (live) setSettings(next);
    });
    return () => {
      live = false;
    };
  }, [app.uid]);

  async function toggle(key: PrivacySettingKey, value: boolean) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    await savePrivacySetting(app.uid || undefined, key, value, settings);
  }

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={30} color={colors.bone} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy settings</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]} showsVerticalScrollIndicator={false}>
        {OPTIONS.map((option) => (
          <View key={option.key} style={styles.option}>
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionBody}>{option.body}</Text>
            </View>
            <Switch
              value={settings[option.key]}
              onValueChange={(value) => void toggle(option.key, value)}
              trackColor={{ false: colors.neutral, true: colors.success }}
              thumbColor={settings[option.key] ? colors.successInk : "#FFFFFF"}
              accessibilityRole="switch"
              accessibilityLabel={option.title}
              accessibilityState={{ checked: settings[option.key] }}
            />
          </View>
        ))}
        <Pressable onPress={() => router.push("/manage-account-data")} style={styles.manage} accessibilityRole="button">
          <View style={styles.manageCopy}>
            <Text style={styles.manageTitle}>Manage account data</Text>
            <Text style={styles.manageBody}>Request and download a copy of your Uvel account data.</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.subtle} />
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: "/legal/[id]", params: { id: "privacy" } })} style={styles.policy} accessibilityRole="link">
          <Text style={styles.policyText}>Read Uvel’s Privacy Policy</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.success} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { minHeight: 72, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: `${colors.bone}1F`, alignItems: "center", justifyContent: "center" },
    headerSpacer: { width: 48, height: 48 },
    headerTitle: { color: colors.bone, fontSize: 21, fontWeight: "800" },
    content: { paddingTop: 8 },
    option: { flexDirection: "row", alignItems: "flex-start", gap: 16, paddingHorizontal: 20, paddingVertical: 22, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20` },
    optionCopy: { flex: 1 },
    optionTitle: { color: colors.bone, fontSize: 17, fontWeight: "700", lineHeight: 23 },
    optionBody: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 5 },
    manage: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 22, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20` },
    manageCopy: { flex: 1 },
    manageTitle: { color: colors.bone, fontSize: 17, fontWeight: "700" },
    manageBody: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 5 },
    policy: { flexDirection: "row", alignItems: "center", gap: 7, marginHorizontal: 20, marginTop: 24 },
    policyText: { color: colors.success, fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
  });
}
