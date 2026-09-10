import { useLocalSearchParams, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as FileSystem from "expo-file-system";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "../../../lib/theme";
import { blockFriend, reportFriendConversation, sendFriendMessage, subscribeFriendMessages, uploadFriendAttachment, type FriendMessage } from "../../../lib/friendChat";
import { pickFromLibrary } from "../../../lib/photo";
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
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  useEffect(() => subscribeFriendMessages(String(id || ""), setMessages), [id]);

  async function send() {
    const text = draft.trim();
    if ((!text && !photoUri) || !id || sending) return;
    setSending(true);
    setDraft("");
    try {
      let uploaded = "";
      if (photoUri) {
        const base64 = await FileSystem.readAsStringAsync(photoUri, { encoding: FileSystem.EncodingType.Base64 });
        uploaded = await uploadFriendAttachment(base64, "image/jpeg");
      }
      await sendFriendMessage(String(id), text, uploaded);
      setPhotoUri(undefined);
    } catch (e) { setDraft(text); Alert.alert("Message failed", e instanceof Error ? e.message : "Try again."); }
    finally { setSending(false); }
  }

  function safetyActions() {
    Alert.alert("Friend chat options", "Choose an action.", [
      { text: "Cancel", style: "cancel" },
      { text: "Report conversation", style: "destructive", onPress: () => void reportFriendConversation(String(id), "Reported from friend chat").then(() => Alert.alert("Report sent", "We’ll review this conversation.")) },
      { text: "Block friend", style: "destructive", onPress: () => void blockFriend(String(id).split("_").find((value) => value !== uid) || "").then(() => { Alert.alert("Friend blocked", "New messages from this friend are blocked."); router.back(); }) },
    ]);
  }

  return <View style={styles.page}>
    <StatusBar style="light" />
    <View style={[styles.nav, { paddingTop: insets.top + 4 }]}><Pressable onPress={() => router.back()} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Go back"><Text style={styles.back}>‹</Text></Pressable><Text style={styles.title} numberOfLines={1}>{name || "Friend"}</Text><Pressable onPress={safetyActions} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Friend chat options"><Text style={styles.more}>⋯</Text></Pressable></View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList data={messages} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={[styles.bubble, item.from === uid ? styles.mine : styles.theirs]}>{item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={styles.messagePhoto} contentFit="cover" /> : null}<Text style={styles.bubbleText}>{item.text}</Text></View>} ListEmptyComponent={<Text style={styles.empty}>Say hi and share a fit.</Text>} />
      {photoUri ? <View style={styles.preview}><Image source={{ uri: photoUri }} style={styles.previewImg} contentFit="cover" /><Text style={styles.previewTxt}>Photo ready</Text><Pressable onPress={() => setPhotoUri(undefined)} accessibilityRole="button" accessibilityLabel="Remove photo"><Text style={styles.remove}>×</Text></Pressable></View> : null}
      <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}><Pressable onPress={async () => { try { const uri = await pickFromLibrary(); if (uri) setPhotoUri(uri); } catch (e) { Alert.alert("Photo", e instanceof Error ? e.message : "Couldn’t open photos."); } }} style={styles.attach} accessibilityRole="button" accessibilityLabel="Attach photo"><Text style={styles.attachTxt}>＋</Text></Pressable><TextInput value={draft} onChangeText={setDraft} placeholder="Message your friend" placeholderTextColor={colors.subtle} style={styles.input} maxLength={2000} multiline accessibilityLabel="Friend message" /><Pressable onPress={() => void send()} disabled={(!draft.trim() && !photoUri) || sending} style={styles.send} accessibilityRole="button" accessibilityLabel="Send friend message"><Text style={styles.sendTxt}>{sending ? "…" : "Send"}</Text></Pressable></View>
    </KeyboardAvoidingView>
  </View>;
}

function make(colors: ReturnType<typeof useColors>) { return StyleSheet.create({ page: { flex: 1, backgroundColor: colors.ink }, nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 10 }, navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, back: { color: colors.bone, fontSize: 34 }, more: { color: colors.bone, fontSize: 24 }, title: { color: colors.bone, fontSize: 17, fontWeight: "800" }, list: { flexGrow: 1, padding: 16, justifyContent: "flex-end", gap: 8 }, bubble: { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 }, mine: { alignSelf: "flex-end", backgroundColor: colors.success }, theirs: { alignSelf: "flex-start", backgroundColor: colors.surface }, bubbleText: { color: colors.bone, fontSize: 15, lineHeight: 21 }, messagePhoto: { width: 190, height: 190, borderRadius: 12, marginBottom: 6 }, empty: { color: colors.muted, textAlign: "center", marginBottom: 18 }, preview: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, backgroundColor: colors.surface }, previewImg: { width: 42, height: 42, borderRadius: 8 }, previewTxt: { flex: 1, color: colors.muted }, remove: { color: colors.muted, fontSize: 23 }, composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: `${colors.bone}1A` }, attach: { width: 38, height: 42, alignItems: "center", justifyContent: "center" }, attachTxt: { color: colors.success, fontSize: 24 }, input: { flex: 1, minHeight: 42, maxHeight: 110, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: colors.bone, backgroundColor: colors.surface }, send: { paddingHorizontal: 10, paddingVertical: 12 }, sendTxt: { color: colors.success, fontWeight: "800" } }); }
