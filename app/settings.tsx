import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { LANGS } from "../lib/i18n";
import { getMarket } from "../lib/markets";
import { requestFeedback } from "../lib/feedback";
import { useUvel } from "../lib/store";
import { useCopy } from "../lib/useCopy";
import { useColors, type Colors } from "../lib/theme";

const HELP = "mailto:himforson@gmail.com?subject=Uvel%20help";
const VERSION = Constants.expoConfig?.version ?? "1.0.0";

export default function Settings() {
  const app = useUvel();
  const C = useCopy();
  const colors = useColors();
  const styles = make(colors);
  const localeLabel = LANGS.find((l) => l.id === app.locale)?.label ?? "English, US";
  const market = getMarket(app.country);

  async function toggleNotes(on: boolean) {
    if (!on) {
      void app.setWantsUpdates(false);
      void import("../lib/engagement").then((m) => m.syncEngagement({ allowed: false, hasBag: false, hasFirstFind: false })).catch(() => undefined);
      return;
    }
    if (!app.uid) {
      Alert.alert(C.signInFirst, C.notificationsFollow);
      return;
    }
    void app.setWantsUpdates(true);
    const { enablePush } = await import("../lib/push");
    const result = await enablePush(app.uid);
    if (result !== "granted") {
      await app.setWantsUpdates(false);
      Alert.alert(C.turnNotificationsOn, C.notificationsSettings);
      return;
    }
    void import("../lib/engagement").then((m) => m.syncEngagement({ allowed: true, hasBag: false, hasFirstFind: false })).catch(() => undefined);
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.section}>{C.support}</Text>
      <View style={styles.group}>
        <Row icon="book-outline" label={C.howToUse} onPress={() => router.push("/guide")} colors={colors} />
        <Row icon="help-circle-outline" label={C.helpSupport} onPress={() => void Linking.openURL(HELP)} colors={colors} />
        <Row icon="flag-outline" label={C.reportIssue} onPress={() => requestFeedback("compose")} colors={colors} />
        <Row icon="shield-checkmark-outline" label={C.privacyPolicy} onPress={() => router.push({ pathname: "/legal/[id]", params: { id: "privacy" } })} colors={colors} />
        <Row icon="document-text-outline" label={C.terms} onPress={() => router.push({ pathname: "/legal/[id]", params: { id: "terms" } })} colors={colors} />
        <Row icon="information-circle-outline" label={C.about} onPress={() => router.push("/about")} colors={colors} last />
      </View>

      <Text style={styles.section}>{C.account}</Text>
      <View style={styles.group}>
        {app.uid ? <Row icon="person-outline" label="Manage" onPress={() => router.push("/manage")} colors={colors} last /> : null}
      </View>

      {app.uid ? (
        <>
          <Text style={styles.section}>Selling</Text>
          <View style={styles.group}>
            <Row icon="cube-outline" label="Shipping" hint={`Set your ${market.name} delivery providers and defaults`} onPress={() => router.push("/seller-shipping")} colors={colors} />
            <Row icon="pricetag-outline" label="Promo codes" hint="Create discounts for your listings" onPress={() => router.push("/promo-codes")} colors={colors} />
            <Row icon="pause-circle-outline" label="Selling availability" hint="Pause your normal listings" onPress={() => router.push("/selling-availability")} colors={colors} last />
          </View>
        </>
      ) : null}

      <Text style={styles.section}>{C.preferences}</Text>
      <View style={styles.group}>
        <Row
          icon="color-palette-outline"
          label={C.appearance}
          hint={app.appearance === "system" ? C.system : app.appearance === "dark" ? C.dark : C.light}
          onPress={() => router.push("/appearance")}
          colors={colors}
        />
        <Row
          icon="shield-outline"
          label="Privacy settings"
          hint="Control personalization, notifications, and data"
          onPress={() => router.push("/privacy-settings")}
          colors={colors}
        />
        <Row
          icon="sparkles-outline"
          label={C.todayPersonalization}
          hint={C.todayPersonalizationHint}
          onPress={() => router.push("/personalization")}
          colors={colors}
        />
        <View style={styles.row}>
          <Ionicons name="notifications-outline" size={21} color={colors.muted} style={styles.rowIcon} />
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.rowLabel}>{C.notifications}</Text>
            <Text style={styles.hint}>{C.notificationHint}</Text>
          </View>
          <Switch
            value={app.wantsUpdates}
            onValueChange={(v) => void toggleNotes(v)}
            trackColor={{ false: colors.surface, true: colors.success }}
            thumbColor="#fff"
            accessibilityLabel={C.notifications}
            accessibilityHint={C.notificationHint}
          />
        </View>
        <View style={styles.row}>
          <Ionicons name="accessibility-outline" size={21} color={colors.muted} style={styles.rowIcon} />
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.rowLabel}>{C.accessibilityFeatures}</Text>
            <Text style={styles.hint}>{C.accessibilityHint}</Text>
          </View>
          <Switch
            value={app.accessibilityMode}
            onValueChange={(v) => void app.setAccessibilityMode(v)}
            trackColor={{ false: colors.surface, true: colors.success }}
            thumbColor="#fff"
            accessibilityLabel={C.accessibilityFeatures}
            accessibilityHint={C.accessibilityHint}
          />
        </View>
        <Row
          icon="storefront-outline"
          label={C.store}
          hint={`${market.name} · ${market.currency}`}
          onPress={() => router.push("/store")}
          colors={colors}
        />
        <Row icon="language-outline" label={C.language} hint={localeLabel} onPress={() => router.push("/language")} colors={colors} last />
      </View>

      {app.uid || app.signedInWith ? (
        <Pressable
          onPress={() =>
            Alert.alert(C.logOutTitle, C.logOutBody, [
              { text: C.stay, style: "cancel" },
              { text: C.logOut, style: "destructive", onPress: () => void app.signOutAccount() },
            ])
          }
          style={styles.out}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.muted} style={styles.outIcon} />
          <Text style={styles.outText}>{C.logOut}</Text>
        </Pressable>
      ) : null}

      <Text style={styles.ver}>Uvel {VERSION}</Text>
    </ScrollView>
  );
}

function Row({
  icon,
  label,
  hint,
  onPress,
  last,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
  last?: boolean;
  colors: Colors;
}) {
  return (
    <Pressable onPress={onPress} style={[stylesRow.row, last && stylesRow.last, { borderBottomColor: colors.ink }]}>
      <Ionicons name={icon} size={21} color={colors.muted} style={stylesRow.icon} />
      <View style={{ flex: 1 }}>
        <Text style={[stylesRow.label, { color: colors.bone }]}>{label}</Text>
        {hint ? <Text style={[stylesRow.hint, { color: colors.muted }]}>{hint}</Text> : null}
      </View>
      <Text style={[stylesRow.chev, { color: colors.subtle }]}>›</Text>
    </Pressable>
  );
}

const stylesRow = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  last: { borderBottomWidth: 0 },
  label: { fontSize: 16 },
  hint: { fontSize: 12, marginTop: 3 },
  icon: { width: 28 },
  chev: { fontSize: 22, marginLeft: 8 },
});

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { padding: 20, paddingBottom: 72 },
    sell: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.subtle + "40",
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    sellTitle: { color: colors.bone, fontWeight: "700", fontSize: 16 },
    sellHint: { color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
    chev: { color: colors.subtle, fontSize: 24 },
    section: {
      color: colors.bone,
      fontWeight: "700",
      fontSize: 16,
      marginTop: 28,
      marginBottom: 10,
    },
    group: { backgroundColor: colors.surface, borderRadius: 16, overflow: "hidden" },
    account: { padding: 16 },
    name: { color: colors.bone, fontWeight: "600", fontSize: 16 },
    hint: { color: colors.muted, fontSize: 12, marginTop: 4 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.ink,
    },
    rowLabel: { color: colors.bone, fontSize: 16 },
    rowIcon: { width: 28 },
    lang: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.ink,
    },
    last: { borderBottomWidth: 0 },
    langTxt: { color: colors.muted, fontSize: 15 },
    langOn: { color: colors.bone, fontWeight: "700" },
    dangerBox: { marginTop: 20, borderWidth: 1, borderColor: `${colors.danger}66`, borderRadius: 16, padding: 16 },
    dangerTitle: { color: colors.danger, fontWeight: "700", fontSize: 16 },
    dangerHint: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 5 },
    deleteBtn: { marginTop: 14, alignSelf: "flex-start", paddingVertical: 8 },
    deleteText: { color: colors.danger, fontSize: 15, fontWeight: "700" },
    out: { marginTop: 28, flexDirection: "row", alignItems: "center", paddingHorizontal: 4, gap: 12 },
    outIcon: { width: 22 },
    outText: { color: colors.muted, fontSize: 16 },
    ver: { color: colors.subtle, fontSize: 12, marginTop: 20 },
  });
}
