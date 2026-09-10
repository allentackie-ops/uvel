import { useLocalSearchParams, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "../../../lib/theme";
import { sendFriendMessage, subscribeFriendMessages, type FriendMessage } from "../../../lib/friendChat";
import { useUvel } from "../../../lib/store";

export default function FriendChat() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { uid } = useUvel();
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => subscribeFriendMessages(String(id || ""), setMessages), [id]);

  async function send() {
    const text = draft.trim();
    if (!text || !id || sending) return;
    setSending(true);
    setDraft("");
    try { await sendFriendMessage(String(id), text); } catch (e) { setDraft(text); Alert.alert("Message failed", e instanceof Error ? e.message : "Try again."); }
    finally { setSending(false); }
  }

  return <View style={styles.page}>
    <StatusBar style="light" />
    <View style={[styles.nav, { paddingTop: insets.top + 4 }]}><Pressable onPress={() => router.back()} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Go back"><Text style={styles.back}>‹</Text></Pressable><Text style={styles.title} numberOfLines={1}>{name || "Friend"}</Text><View style={styles.navBtn} /></View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList data={messages} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={[styles.bubble, item.from === uid ? styles.mine : styles.theirs]}><Text style={styles.bubbleText}>{item.text}</Text></View>} ListEmptyComponent={<Text style={styles.empty}>Say hi and share a fit.</Text>} />
      <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}><TextInput value={draft} onChangeText={setDraft} placeholder="Message your friend" placeholderTextColor={colors.subtle} style={styles.input} maxLength={2000} multiline accessibilityLabel="Friend message" /><Pressable onPress={() => void send()} disabled={!draft.trim() || sending} style={styles.send} accessibilityRole="button" accessibilityLabel="Send friend message"><Text style={styles.sendTxt}>{sending ? "…" : "Send"}</Text></Pressable></View>
    </KeyboardAvoidingView>
  </View>;
}

function make(colors: ReturnType<typeof useColors>) { return StyleSheet.create({ page: { flex: 1, backgroundColor: colors.ink }, nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 10 }, navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, back: { color: colors.bone, fontSize: 34 }, title: { color: colors.bone, fontSize: 17, fontWeight: "800" }, list: { flexGrow: 1, padding: 16, justifyContent: "flex-end", gap: 8 }, bubble: { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 }, mine: { alignSelf: "flex-end", backgroundColor: colors.success }, theirs: { alignSelf: "flex-start", backgroundColor: colors.surface }, bubbleText: { color: colors.bone, fontSize: 15, lineHeight: 21 }, empty: { color: colors.muted, textAlign: "center", marginBottom: 18 }, composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: `${colors.bone}1A` }, input: { flex: 1, minHeight: 42, maxHeight: 110, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: colors.bone, backgroundColor: colors.surface }, send: { paddingHorizontal: 10, paddingVertical: 12 }, sendTxt: { color: colors.success, fontWeight: "800" } }); }
