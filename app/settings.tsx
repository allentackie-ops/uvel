import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { LANGS } from "../lib/i18n";
import { getMarket } from "../lib/markets";
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
  const [busy, setBusy] = useState(false);
  const localeLabel = LANGS.find((l) => l.id === app.locale)?.label ?? "English, US";
  const market = getMarket(app.country);

  async function toggleNotes(on: boolean) {
    app.setStyle({ wantsUpdates: on });
    if (!on) return;
    try {
      const Notifications = await import("expo-notifications");
      const cur = await Notifications.getPermissionsAsync();
      if (cur.status !== "granted") await Notifications.requestPermissionsAsync();
    } catch {
      await Linking.openSettings();
    }
  }

  function confirmDelete() {
    Alert.alert(
      C.deleteAccountTitle,
      C.deleteAccountBody,
      [
        { text: C.keepAccount, style: "cancel" },
        {
          text: C.deleteAccount,
          style: "destructive",
          onPress: () =>
            Alert.alert(C.deleteForever, C.deleteConfirm, [
              { text: C.cancel, style: "cancel" },
              { text: C.deleteAccount, style: "destructive", onPress: () => void runDelete() },
            ]),
        },
      ],
    );
  }

  async function runDelete() {
    setBusy(true);
    try {
      await app.deleteAccount();
      router.replace("/setup");
    } catch (err) {
      Alert.alert(C.deleteAccount, err instanceof Error ? err.message : "Sign in again, then try.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.section}>{C.support}</Text>
      <View style={styles.group}>
        <Row label={C.helpSupport} onPress={() => void Linking.openURL(HELP)} colors={colors} />
        <Row label={C.privacyPolicy} onPress={() => router.push({ pathname: "/legal/[id]", params: { id: "privacy" } })} colors={colors} />
        <Row label={C.terms} onPress={() => router.push({ pathname: "/legal/[id]", params: { id: "terms" } })} colors={colors} last />
      </View>

      <Text style={styles.section}>{C.account}</Text>
      <View style={styles.group}>
        <View style={styles.account}>
          <Text style={styles.name}>{app.displayName || (app.uid ? "Uvel member" : C.guest)}</Text>
          <Text style={styles.hint}>
            {app.email || (app.signedInWith ? `Signed in with ${app.signedInWith}` : C.notSignedIn)}
          </Text>
        </View>
      </View>

      <Text style={styles.section}>{C.preferences}</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.rowLabel}>{C.appearance}</Text>
            <Text style={styles.hint}>{app.appearance === "dark" ? C.dark : C.light}</Text>
          </View>
          <View style={styles.seg} accessibilityRole="radiogroup">
            <Pressable onPress={() => void app.setAppearance("light")} style={[styles.segBtn, app.appearance === "light" && styles.segOn]} accessibilityRole="radio" accessibilityState={{ selected: app.appearance === "light" }}>
              <Text style={[styles.segTxt, app.appearance === "light" && styles.segTxtOn]}>{C.light}</Text>
            </Pressable>
            <Pressable onPress={() => void app.setAppearance("dark")} style={[styles.segBtn, app.appearance === "dark" && styles.segOn]} accessibilityRole="radio" accessibilityState={{ selected: app.appearance === "dark" }}>
              <Text style={[styles.segTxt, app.appearance === "dark" && styles.segTxtOn]}>{C.dark}</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.row}>
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
          label={C.store}
          hint={`${market.name} floor · ${market.currency}`}
          onPress={() => router.push("/store")}
          colors={colors}
        />
        <Row label={C.language} hint={localeLabel} onPress={() => router.push("/language")} colors={colors} last />
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
          <Text style={styles.outText}>{C.logOut}</Text>
        </Pressable>
      ) : null}

      {app.uid ? (
        <View style={styles.dangerBox}>
          <Text style={styles.dangerTitle}>{C.accountRemoval}</Text>
          <Text style={styles.dangerHint}>{C.accountRemovalHint}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={C.deleteAccount}
            onPress={confirmDelete}
            disabled={busy}
            style={styles.deleteBtn}
          >
            {busy ? <ActivityIndicator color="#C45C4A" /> : <Text style={styles.deleteText}>{C.deleteAccount}</Text>}
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.ver}>Uvel {VERSION}</Text>
    </ScrollView>
  );
}

function Row({
  label,
  hint,
  onPress,
  last,
  colors,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
  last?: boolean;
  colors: Colors;
}) {
  return (
    <Pressable onPress={onPress} style={[stylesRow.row, last && stylesRow.last, { borderBottomColor: colors.ink }]}>
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
    seg: { flexDirection: "row", minWidth: 156, minHeight: 44, backgroundColor: colors.ink, borderRadius: 12, padding: 3, gap: 3 },
    segBtn: { flex: 1, minHeight: 38, paddingHorizontal: 10, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    segOn: { backgroundColor: colors.success },
    segTxt: { color: colors.muted, fontSize: 13, fontWeight: "600" },
    segTxtOn: { color: colors.successInk },
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
    out: { marginTop: 28, alignItems: "flex-start", paddingHorizontal: 4 },
    outText: { color: colors.muted, fontSize: 16 },
    ver: { color: colors.subtle, fontSize: 12, marginTop: 20 },
  });
}
