import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { claimInvite, useFirstFind } from "../lib/firstFind";
import { moneyExact } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";

export default function Invite() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const find = useFirstFind();
  const params = useLocalSearchParams<{ code?: string }>();
  const [copied, setCopied] = useState(false);
  const link = Linking.createURL("invite", { queryParams: { code: find.referralCode } });

  useEffect(() => {
    const code = typeof params.code === "string" ? params.code : "";
    if (!code || !app.uid) return;
    claimInvite(code, app.uid);
  }, [params.code, app.uid]);

  async function share() {
    const message = `We'll cover your first find on Uvel. ${link}`;
    try {
      await Share.share({ message, title: "Uvel First Find" });
    } catch {
      /* cancelled */
    }
  }

  async function copy() {
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const claimed = Boolean(find.referredBy) && typeof params.code === "string";

  return (
    <View style={styles.page}>
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={styles.navBack}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>Invite friends</Text>
        <View style={styles.navBtn} />
      </View>
      <View style={styles.body}>
        <Text style={styles.kicker}>FIRST FIND</Text>
        <Text style={styles.h}>Bring a friend. They get a first find.</Text>
        <Text style={styles.p}>
          {moneyExact(find.amount, find.currency)} toward a piece that matches them, after they set Style DNA. Not cash. Not withdrawable.
        </Text>
        {claimed ? <Text style={styles.ok}>Invite saved. Set Style DNA to unlock yours.</Text> : null}
        <Pressable onPress={() => void copy()} style={styles.copy} accessibilityRole="button" accessibilityLabel="Copy invite link">
          <Text style={styles.copyL} numberOfLines={1}>{link}</Text>
          <Text style={styles.copyA}>{copied ? "Copied" : "Copy"}</Text>
        </Pressable>
        <Pressable onPress={() => void share()} style={styles.share} accessibilityRole="button" accessibilityLabel="Share invite link">
          <Text style={styles.shareTxt}>Share invite</Text>
        </Pressable>
        {!find.ready ? (
          <Pressable onPress={() => router.push("/style-dna")} style={styles.alt} accessibilityRole="button">
            <Text style={styles.altTxt}>Set Style DNA</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    nav: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navBack: { color: colors.bone, fontSize: 32, marginTop: -2 },
    navTitle: { color: colors.bone, fontSize: 17, fontWeight: "700" },
    body: { paddingHorizontal: 20, paddingTop: 18 },
    kicker: { color: `${colors.bone}6B`, letterSpacing: 1.6, fontSize: 11, fontWeight: "800" },
    h: { color: colors.bone, fontSize: 28, fontWeight: "800", marginTop: 10, lineHeight: 34 },
    p: { color: `${colors.bone}94`, fontSize: 15, lineHeight: 22, marginTop: 12 },
    ok: { color: colors.success, fontSize: 14, fontWeight: "700", marginTop: 16 },
    copy: { marginTop: 28, backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 },
    copyL: { flex: 1, color: `${colors.bone}94`, fontSize: 13 },
    copyA: { color: colors.bone, fontWeight: "800", fontSize: 13 },
    share: { marginTop: 12, height: 52, borderRadius: 26, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    shareTxt: { color: colors.successInk, fontWeight: "800", fontSize: 16 },
    alt: { marginTop: 12, height: 52, borderRadius: 26, borderWidth: 1, borderColor: `${colors.bone}29`, alignItems: "center", justifyContent: "center" },
    altTxt: { color: colors.bone, fontWeight: "800", fontSize: 16 },
  });
}
