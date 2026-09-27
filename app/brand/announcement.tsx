import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBrand, useBrands } from "../../lib/brands";
import { useColors } from "../../lib/theme";

const RECIPIENTS = ["Everyone in the brand", "Founders", "Design", "Marketing", "Operations", "Support"] as const;
export default function BrandAnnouncement() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBrands();
  const brand = getBrand(id);
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [recipient, setRecipient] = useState<(typeof RECIPIENTS)[number]>(RECIPIENTS[0]);
  const [message, setMessage] = useState("");
  const [alertMode, setAlertMode] = useState(false);
  if (!brand) return <View style={styles.page}><Text style={styles.title}>Brand not found</Text></View>;
  return <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 32 }]}>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={colors.bone} /><Text style={styles.backText}>Your business</Text></Pressable>
    <Text style={styles.kicker}>BRAND ANNOUNCEMENTS</Text>
    <Text style={styles.title}>Keep {brand.name} moving.</Text>
    <Text style={styles.copy}>Send a focused update to the people who help shape and run your brand.</Text>
    <Text style={styles.label}>SEND TO</Text>
    <View style={styles.chips}>{RECIPIENTS.map((item) => <Pressable key={item} onPress={() => setRecipient(item)} style={[styles.chip, recipient === item && styles.chipActive]}><Text style={[styles.chipText, recipient === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>
    <Text style={styles.label}>MESSAGE</Text>
    <TextInput value={message} onChangeText={setMessage} placeholder="Write the update your team needs to hear…" placeholderTextColor={colors.subtle} multiline textAlignVertical="top" style={styles.input} />
    <Pressable onPress={() => setAlertMode((value) => !value)} style={[styles.alertRow, alertMode && styles.alertRowActive]}><Ionicons name={alertMode ? "notifications" : "notifications-outline"} size={21} color={alertMode ? colors.successInk : colors.bone} /><View style={styles.alertCopy}><Text style={[styles.alertTitle, alertMode && styles.alertTitleActive]}>Alert mode</Text><Text style={[styles.alertBody, alertMode && styles.alertBodyActive]}>Mark this as important and notify recipients.</Text></View><View style={[styles.toggle, alertMode && styles.toggleActive]}><View style={[styles.toggleDot, alertMode && styles.toggleDotActive]} /></View></Pressable>
    <Pressable disabled={!message.trim()} onPress={() => Alert.alert("Announcement ready", `Your message is addressed to ${recipient}.${alertMode ? " Alert mode is on." : ""}`, [{ text: "Done", onPress: () => router.back() }])} style={[styles.send, !message.trim() && styles.sendDisabled]}><Text style={styles.sendText}>Send announcement</Text><Ionicons name="arrow-forward" size={18} color={colors.successInk} /></Pressable>
    <Text style={styles.note}>Announcements stay connected to your brand workspace so the right roles can find the update later.</Text>
  </ScrollView>;
}
function make(colors: ReturnType<typeof useColors>) { return StyleSheet.create({ page: { flex: 1, backgroundColor: colors.ink }, content: { paddingHorizontal: 20 }, back: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 34 }, backText: { color: colors.muted, fontSize: 14, fontWeight: "700" }, kicker: { color: colors.success, fontSize: 10, letterSpacing: 2.4, fontWeight: "900" }, title: { color: colors.bone, fontSize: 38, lineHeight: 43, fontWeight: "800", letterSpacing: -1, marginTop: 10 }, copy: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 10, marginBottom: 30 }, label: { color: colors.subtle, fontSize: 10, letterSpacing: 1.8, fontWeight: "900", marginBottom: 10, marginTop: 10 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }, chip: { borderWidth: 1, borderColor: colors.subtle + "55", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 }, chipActive: { backgroundColor: colors.success, borderColor: colors.success }, chipText: { color: colors.muted, fontSize: 12, fontWeight: "700" }, chipTextActive: { color: colors.successInk }, input: { minHeight: 170, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.subtle + "55", borderRadius: 18, padding: 16, color: colors.bone, fontSize: 16, lineHeight: 23 }, alertRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.subtle + "55", borderRadius: 18, padding: 15, marginTop: 14 }, alertRowActive: { backgroundColor: colors.success, borderColor: colors.success }, alertCopy: { flex: 1 }, alertTitle: { color: colors.bone, fontSize: 14, fontWeight: "800" }, alertTitleActive: { color: colors.successInk }, alertBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }, alertBodyActive: { color: colors.successInk + "CC" }, toggle: { width: 40, height: 24, borderRadius: 12, backgroundColor: colors.subtle + "55", padding: 3, justifyContent: "center" }, toggleActive: { backgroundColor: colors.successInk + "35" }, toggleDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.muted }, toggleDotActive: { backgroundColor: colors.successInk, alignSelf: "flex-end" }, send: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.success, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 17, marginTop: 20 }, sendDisabled: { opacity: 0.45 }, sendText: { color: colors.successInk, fontSize: 15, fontWeight: "900" }, note: { color: colors.subtle, fontSize: 12, lineHeight: 18, marginTop: 18, textAlign: "center" } }); }
