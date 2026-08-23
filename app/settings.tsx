import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { LANGS } from "../lib/i18n";
import { getMarket } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";

const PRIVACY = "https://allentackie-ops.github.io/uvel/";
const HELP = "mailto:himforson@gmail.com?subject=Uvel%20help";
const VERSION = Constants.expoConfig?.version ?? "1.0.0";

export default function Settings() {
  const app = useUvel();
  const colors = useColors();
  const styles = make(colors);
  const [langs, setLangs] = useState(false);
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

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.section}>Support</Text>
      <View style={styles.group}>
        <Row label="Help and support" onPress={() => void Linking.openURL(HELP)} colors={colors} />
        <Row label="Privacy policy" onPress={() => void Linking.openURL(PRIVACY)} colors={colors} last />
      </View>

      <Text style={styles.section}>Account</Text>
      <View style={styles.group}>
        <View style={styles.account}>
          <Text style={styles.name}>{app.displayName || (app.uid ? "Uvel member" : "Guest")}</Text>
          <Text style={styles.hint}>
            {app.email || (app.signedInWith ? `Signed in with ${app.signedInWith}` : "Not signed in")}
          </Text>
        </View>
      </View>

      <Text style={styles.section}>Preferences</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowLabel}>Appearance</Text>
            <Text style={styles.hint}>{app.appearance === "dark" ? "Dark" : "Light"}</Text>
          </View>
          <View style={styles.seg}>
            {(["light", "dark"] as const).map((mode) => {
              const on = app.appearance === mode;
              return (
                <Pressable key={mode} onPress={() => app.setAppearance(mode)} style={[styles.segBtn, on && styles.segOn]}>
                  <Text style={[styles.segTxt, on && styles.segTxtOn]}>{mode === "light" ? "Light" : "Dark"}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.rowLabel}>Notifications</Text>
            <Text style={styles.hint}>Drops, price cuts, messages</Text>
          </View>
          <Switch
            value={app.wantsUpdates}
            onValueChange={(v) => void toggleNotes(v)}
            trackColor={{ false: colors.surface, true: "#D6E27A" }}
            thumbColor="#fff"
          />
        </View>
        <Row
          label="Store"
          hint={`${market.name} · ${market.currency}`}
          onPress={() => router.push("/store")}
          colors={colors}
        />
        <Row label="Language" hint={localeLabel} onPress={() => setLangs((v) => !v)} colors={colors} last={!langs} />
        {langs
          ? LANGS.map((l, i) => (
              <Pressable
                key={l.id}
                onPress={() => {
                  app.setLocale(l.id);
                  setLangs(false);
                }}
                style={[styles.lang, i === LANGS.length - 1 && styles.last]}
              >
                <Text style={[styles.langTxt, l.id === app.locale && styles.langOn]}>{l.label}</Text>
              </Pressable>
            ))
          : null}
      </View>

      {app.uid || app.signedInWith ? (
        <Pressable
          onPress={() =>
            Alert.alert("Log out?", "You’ll need to sign in again to sell, buy, or message.", [
              { text: "Stay", style: "cancel" },
              { text: "Log out", style: "destructive", onPress: () => void app.signOutAccount() },
            ])
          }
          style={styles.out}
        >
          <Text style={styles.outText}>Log out</Text>
        </Pressable>
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
  colors: ReturnType<typeof useColors>;
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

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { padding: 20, paddingBottom: 48 },
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
    seg: { flexDirection: "row", backgroundColor: colors.ink, borderRadius: 10, padding: 2 },
    segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    segOn: { backgroundColor: "#D6E27A" },
    segTxt: { color: colors.muted, fontSize: 13, fontWeight: "600" },
    segTxtOn: { color: "#16140F" },
    lang: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.ink,
    },
    last: { borderBottomWidth: 0 },
    langTxt: { color: colors.muted, fontSize: 15 },
    langOn: { color: colors.bone, fontWeight: "700" },
    out: { marginTop: 28, alignItems: "flex-start", paddingHorizontal: 4 },
    outText: { color: colors.muted, fontSize: 16 },
    ver: { color: colors.subtle, fontSize: 12, marginTop: 20 },
  });
}
