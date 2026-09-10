import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createFriendChat, listFriends, sendFriendMessage } from "../lib/friendChat";
import type { PublicUser } from "../lib/friends";
import { useColors } from "../lib/theme";

export type FriendSharePayload = { kind: "listing" | "mirror"; id?: string; title: string; deepLink: string; imageUri?: string; previewText?: string };

export function FriendShareSheet({ visible, payload, onClose, onExternalShare }: { visible: boolean; payload: FriendSharePayload | null; onClose: () => void; onExternalShare: () => void }) {
  const colors = useColors();
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (visible) void listFriends().then(setFriends).catch(() => setFriends([])); }, [visible]);
  async function shareTo(friend: PublicUser) {
    if (!payload) return;
    setBusy(friend.uid);
    try { const id = await createFriendChat(friend.uid); await sendFriendMessage(id, `${message.trim() ? `${message.trim()}\n\n` : ""}${payload.previewText || `Check this out: ${payload.title}`}\n${payload.deepLink}`); setMessage(""); Alert.alert("Shared", `Sent to ${friend.displayName || `@${friend.username}`}.`); onClose(); }
    catch (e) { Alert.alert("Couldn’t share", e instanceof Error ? e.message : "Try again."); }
    finally { setBusy(null); }
  }
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.scrim}><View style={[styles.sheet, { backgroundColor: colors.surface }]}><View style={styles.head}><Text style={[styles.title, { color: colors.bone }]}>Share with friends</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close share sheet"><Text style={[styles.close, { color: colors.muted }]}>×</Text></Pressable></View>{payload ? <Text style={[styles.preview, { color: colors.muted }]} numberOfLines={2}>{payload.title}</Text> : null}<TextInput value={message} onChangeText={setMessage} placeholder="Add a message (optional)" placeholderTextColor={colors.subtle} style={[styles.input, { backgroundColor: colors.ink, color: colors.bone }]} maxLength={300} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>{friends.map((friend) => <Pressable key={friend.uid} onPress={() => void shareTo(friend)} disabled={Boolean(busy)} style={styles.friend} accessibilityRole="button" accessibilityLabel={`Share with ${friend.displayName || friend.username}`}>{friend.avatarUri ? <Image source={{ uri: friend.avatarUri }} style={styles.avatar} contentFit="cover" /> : <View style={[styles.avatar, styles.fallback]}><Text style={{ color: colors.successInk, fontWeight: "800" }}>{(friend.displayName || friend.username || "U").slice(0, 1).toUpperCase()}</Text></View>}<Text style={[styles.name, { color: colors.bone }]} numberOfLines={1}>{busy === friend.uid ? "…" : friend.displayName || `@${friend.username}`}</Text></Pressable>)}</ScrollView><Pressable onPress={onExternalShare} style={[styles.external, { borderColor: `${colors.bone}45` }]}><Text style={{ color: colors.bone, fontWeight: "700" }}>Share outside Uvel</Text></Pressable></View></View></Modal>;
}
const styles = StyleSheet.create({ scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }, sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30 }, head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, title: { fontSize: 22, fontWeight: "800" }, close: { fontSize: 28 }, preview: { marginTop: 6, fontSize: 14 }, input: { marginTop: 16, borderRadius: 12, minHeight: 44, paddingHorizontal: 12, fontSize: 14 }, rail: { gap: 16, paddingVertical: 18 }, friend: { width: 72, alignItems: "center", gap: 5 }, avatar: { width: 54, height: 54, borderRadius: 27 }, fallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#D6E27A" }, name: { fontSize: 11, textAlign: "center" }, external: { borderWidth: 1, borderRadius: 14, minHeight: 46, alignItems: "center", justifyContent: "center" } });
