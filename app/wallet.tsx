import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMarket, moneyExact } from "../lib/markets";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import {
  requestSellerPayout,
  saveUserPayoutProfile,
  useWallet,
  type WalletEntry,
} from "../lib/wallet";

export default function Wallet() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const market = getMarket(app.country);
  const wallet = useWallet(market.currency);
  const [holder, setHolder] = useState(wallet.profile?.accountHolderName || app.displayName || "");
  const [institution, setInstitution] = useState(wallet.profile?.institutionName || "");
  const [destination, setDestination] = useState("");
  const [kind, setKind] = useState<"bank" | "mobile_money">(wallet.profile?.destinationType === "mobile_money" && market.code === "GH" ? "mobile_money" : "bank");
  const [busy, setBusy] = useState(false);
  const showMobileMoney = market.code === "GH";

  async function savePayout() {
    if (busy) return;
    setBusy(true);
    try {
      await saveUserPayoutProfile({
        destinationType: showMobileMoney ? kind : "bank",
        country: market.code,
        currency: market.currency,
        accountHolderName: holder,
        institutionName: institution,
        destination,
      });
      setDestination("");
      Alert.alert("Payout details saved", "Withdrawals go to this account once a sale is completed.");
    } catch (error) {
      Alert.alert("Couldn’t save details", error instanceof Error ? error.message : "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (busy) return;
    if (!wallet.profile) {
      Alert.alert("Add an account first", "Save a bank or mobile money account before withdrawing.");
      return;
    }
    if (wallet.availableCents < 10) {
      Alert.alert("Nothing to withdraw", "Available earnings appear here after a buyer confirms, or two days after delivery.");
      return;
    }
    setBusy(true);
    try {
      await requestSellerPayout(wallet.currency, wallet.availableCents);
      Alert.alert("Withdrawal requested", "Uvel will send this to your account. Bank transfers usually take a few business days.");
    } catch (error) {
      Alert.alert("Couldn’t withdraw", error instanceof Error ? error.message : "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.page}>
      <StatusBar style={colors.ink === "#000000" ? "light" : "dark"} />
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Close wallet">
          <Text style={styles.navBack}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>Wallet</Text>
        <View style={styles.navBtn} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>YOUR BALANCE</Text>
        <Text style={styles.available}>{moneyExact(wallet.availableCents, wallet.currency)}</Text>
        <Text style={styles.availableL}>Available</Text>
        <View style={styles.split}>
          <View style={styles.splitCard}>
            <Text style={styles.splitV}>{moneyExact(wallet.pendingCents, wallet.currency)}</Text>
            <Text style={styles.splitL}>Pending</Text>
          </View>
          <View style={styles.splitCard}>
            <Text style={styles.splitV}>{moneyExact(wallet.paidOutCents, wallet.currency)}</Text>
            <Text style={styles.splitL}>Withdrawn</Text>
          </View>
        </View>
        <Text style={styles.hint}>When someone buys from you, the money is held. It moves to available after they confirm, or two days after delivery. Then you can spend it on Uvel or withdraw it.</Text>

        <Pressable onPress={() => void withdraw()} disabled={busy || wallet.availableCents < 10} style={[styles.withdraw, (busy || wallet.availableCents < 10) && { opacity: 0.45 }]} accessibilityRole="button" accessibilityLabel="Withdraw available balance">
          <Text style={styles.withdrawTxt}>{busy ? "Working…" : "Withdraw available"}</Text>
        </Pressable>

        <Text style={styles.h}>Payout account</Text>
        {showMobileMoney ? (
          <View style={styles.kinds}>
            <Pressable onPress={() => setKind("bank")} style={[styles.kind, kind === "bank" && styles.kindOn]}>
              <Text style={[styles.kindTxt, kind === "bank" && styles.kindTxtOn]}>Bank</Text>
            </Pressable>
            <Pressable onPress={() => setKind("mobile_money")} style={[styles.kind, kind === "mobile_money" && styles.kindOn]}>
              <Text style={[styles.kindTxt, kind === "mobile_money" && styles.kindTxtOn]}>Mobile money</Text>
            </Pressable>
          </View>
        ) : null}
        {wallet.profile ? <Text style={styles.saved}>On file · {wallet.profile.institutionName} ·••{wallet.profile.destinationLast4}</Text> : null}
        <TextInput value={holder} onChangeText={setHolder} placeholder="Account holder name" placeholderTextColor={`${colors.bone}55`} style={styles.input} />
        <TextInput value={institution} onChangeText={setInstitution} placeholder={kind === "mobile_money" ? "Network (MTN, Telecel, M-Pesa…)" : "Bank name"} placeholderTextColor={`${colors.bone}55`} style={styles.input} />
        <TextInput value={destination} onChangeText={setDestination} placeholder={kind === "mobile_money" ? "Mobile money number" : "Account number"} placeholderTextColor={`${colors.bone}55`} keyboardType="number-pad" style={styles.input} />
        <Pressable onPress={() => void savePayout()} disabled={busy} style={styles.save}>
          <Text style={styles.saveTxt}>{wallet.profile ? "Update account" : "Save account"}</Text>
        </Pressable>

        <Text style={styles.h}>Activity</Text>
        {wallet.entries.length ? wallet.entries.map((entry) => <EntryRow key={entry.id} entry={entry} styles={styles} />) : (
          <Text style={styles.empty}>Sales, holds, and withdrawals will show up here.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function EntryRow({ entry, styles }: { entry: WalletEntry; styles: ReturnType<typeof make> }) {
  const title = entry.type === "sale" ? entry.pieceName || "Sale" : entry.type === "payout" ? "Withdrawal" : "Spent on Uvel";
  const tag = entry.status === "pending" ? "Pending" : entry.status === "available" ? "Available" : entry.status === "requested" ? "Requested" : "Returned";
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowT} numberOfLines={1}>{title}</Text>
        <Text style={styles.rowS}>{tag}</Text>
      </View>
      <Text style={styles.rowV}>{moneyExact(entry.amountCents, entry.currency)}</Text>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    nav: { paddingHorizontal: 6, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navBack: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    navTitle: { color: colors.bone, fontSize: 17, fontWeight: "600" },
    kicker: { color: colors.subtle, fontSize: 11, letterSpacing: 1.8, fontWeight: "700", marginTop: 12 },
    available: { color: colors.success, fontSize: 40, fontWeight: "800", marginTop: 8, fontVariant: ["tabular-nums"] },
    availableL: { color: colors.muted, fontSize: 14, marginTop: 4 },
    split: { flexDirection: "row", gap: 10, marginTop: 18 },
    splitCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 14 },
    splitV: { color: colors.bone, fontSize: 18, fontWeight: "800", fontVariant: ["tabular-nums"] },
    splitL: { color: colors.muted, fontSize: 12, marginTop: 4 },
    hint: { color: `${colors.bone}8C`, fontSize: 13, lineHeight: 19, marginTop: 14 },
    withdraw: { marginTop: 18, minHeight: 52, borderRadius: 26, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    withdrawTxt: { color: colors.successInk, fontSize: 16, fontWeight: "800" },
    h: { color: colors.bone, fontSize: 18, fontWeight: "700", marginTop: 28 },
    kinds: { flexDirection: "row", gap: 8, marginTop: 12 },
    kind: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: `${colors.bone}2E`, alignItems: "center", justifyContent: "center" },
    kindOn: { backgroundColor: colors.success, borderColor: colors.success },
    kindTxt: { color: colors.bone, fontWeight: "700", fontSize: 13 },
    kindTxtOn: { color: colors.successInk },
    saved: { color: colors.muted, fontSize: 13, marginTop: 10 },
    input: { marginTop: 10, minHeight: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: colors.surface, color: colors.bone, fontSize: 15 },
    save: { marginTop: 12, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: `${colors.bone}29`, alignItems: "center", justifyContent: "center" },
    saveTxt: { color: colors.bone, fontWeight: "800", fontSize: 15 },
    empty: { color: colors.muted, fontSize: 14, marginTop: 10 },
    row: { marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 12 },
    rowT: { color: colors.bone, fontWeight: "700", fontSize: 15 },
    rowS: { color: colors.muted, fontSize: 12, marginTop: 4 },
    rowV: { color: colors.bone, fontWeight: "800", fontVariant: ["tabular-nums"] },
  });
}
