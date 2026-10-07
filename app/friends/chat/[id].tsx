import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { blockFriend, listFriends, markFriendChatRead, reportFriendConversation, sendFriendMessage, subscribeFriendMessages, uploadFriendAttachment, type FriendMessage } from "../../../lib/friendChat";
import type { PublicUser } from "../../../lib/friends";
import { pickFromLibrary } from "../../../lib/photo";
import { useColors, useResolvedAppearance } from "../../../lib/theme";
import { useUvel } from "../../../lib/store";

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  if (typeof value === "string") { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
  if (value && typeof value === "object" && "seconds" in value && typeof (value as { seconds?: unknown }).seconds === "number") return new Date(Number((value as { seconds: number }).seconds) * 1000);
  return null;
}

function dayKey(value: unknown) {
  const date = asDate(value);
  return date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : "unknown";
}

function dayLabel(value: unknown) {
  const date = asDate(value);
  if (!date) return "Earlier";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((today.getTime() - thatDay.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

function timeLabel(value: unknown) {
  const date = asDate(value);
  return date ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "F";
}

export default function FriendChat() {
  const colors = useColors();
  const appearance = useResolvedAppearance();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { id: routeId, name: routeName } = useLocalSearchParams<{ id: string; name?: string }>();
  const chatId = Array.isArray(routeId) ? routeId[0] : routeId;
  const name = Array.isArray(routeName) ? routeName[0] : routeName;
  const { uid } = useUvel();
  const peerUid = String(chatId || "").split("_").find((participant) => participant && participant !== uid) || "";
  const [peer, setPeer] = useState<PublicUser | undefined>();
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [previewUri, setPreviewUri] = useState<string | undefined>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const listRef = useRef<FlatList<FriendMessage>>(null);
  const lastReadMessage = useRef("");
  const listName = peer?.displayName || peer?.username || name || "Friend";
  const visibleMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return query ? messages.filter((message) => message.text.toLowerCase().includes(query)) : messages;
  }, [messages, searchQuery]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    if (peerUid) void listFriends().then((friends) => { if (active) setPeer(friends.find((friend) => friend.uid === peerUid)); }).catch(() => undefined);
    if (chatId) void markFriendChatRead(String(chatId)).catch(() => undefined);
    const unsubscribe = subscribeFriendMessages(String(chatId || ""), (next) => {
      if (!active) return;
      setMessages(next);
      setLoading(false);
      setLoadError("");
      const last = next[next.length - 1];
      if (last && last.from !== uid && last.id !== lastReadMessage.current) {
        lastReadMessage.current = last.id;
        void markFriendChatRead(String(chatId)).catch(() => undefined);
      }
    }, (error) => {
      if (!active) return;
      setLoading(false);
      setLoadError(error instanceof Error ? error.message : "Couldn’t load messages. Check your connection and try again.");
    });
    return () => { active = false; unsubscribe(); };
  }, [chatId, peerUid, retryCount, uid]);

  useEffect(() => {
    if (!searchQuery && messages.length) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [messages.length, searchQuery]);

  async function send() {
    const text = draft.trim();
    if ((!text && !photoUri) || !chatId || sending) return;
    setSending(true);
    setDraft("");
    setLoadError("");
    try {
      let uploaded = "";
      if (photoUri) {
        const base64 = await FileSystem.readAsStringAsync(photoUri, { encoding: FileSystem.EncodingType.Base64 });
        uploaded = await uploadFriendAttachment(base64, "image/jpeg");
      }
      await sendFriendMessage(String(chatId), text, uploaded);
      setPhotoUri(undefined);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (error) {
      setDraft(text);
      setLoadError(error instanceof Error ? error.message : "Your message didn’t send. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function attachPhoto() {
    try {
      const uri = await pickFromLibrary();
      if (uri) setPhotoUri(uri);
    } catch (error) {
      Alert.alert("Couldn’t open photos", error instanceof Error ? error.message : "Check photo permissions and try again.");
    }
  }

  function safetyActions() {
    Alert.alert(listName, "Manage this conversation", [
      { text: "Cancel", style: "cancel" },
      { text: "Report conversation", style: "destructive", onPress: () => { void reportFriendConversation(String(chatId), "Reported from friend chat").then(() => Alert.alert("Report sent", "Thanks. We’ll review this conversation." )).catch(() => Alert.alert("Report not sent", "Please try again.")); } },
      { text: "Block friend", style: "destructive", onPress: () => { void blockFriend(peerUid).then(() => { Alert.alert("Friend blocked", "New messages from this friend are blocked."); router.back(); }).catch(() => Alert.alert("Couldn’t block friend", "Please try again.")); } },
    ]);
  }

  async function messageActions(message: FriendMessage) {
    const choices: { text: string; onPress?: () => void; style?: "cancel" | "destructive" }[] = [];
    if (message.text) choices.push({ text: "Copy message", onPress: () => { void Clipboard.setStringAsync(message.text); } });
    if (message.photoUrl) choices.push({ text: "View photo", onPress: () => setPreviewUri(message.photoUrl) });
    choices.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Message", "Choose an action", choices);
  }

  const renderMessage = ({ item, index }: { item: FriendMessage; index: number }) => {
    const mine = item.from === uid;
    const previous = visibleMessages[index - 1];
    const next = visibleMessages[index + 1];
    const startsDay = index === 0 || dayKey(previous?.createdAt) !== dayKey(item.createdAt);
    const grouped = previous?.from === item.from && !startsDay;
    const showPeerAvatar = !mine && (next?.from !== item.from || dayKey(next?.createdAt) !== dayKey(item.createdAt));
    const isLatestOwn = mine && !visibleMessages.slice(index + 1).some((message) => message.from === uid);
    const status = item.status === "read" ? "Read" : item.status === "delivered" ? "Delivered" : item.status === "sent" ? "Sent" : "";
    return <View key={item.id}>
      {startsDay ? <View style={styles.dayRule}><View style={styles.dayLine} /><Text style={styles.dayPill}>{dayLabel(item.createdAt)}</Text><View style={styles.dayLine} /></View> : null}
      <View style={[styles.messageLine, mine ? styles.messageLineMine : styles.messageLinePeer, grouped && styles.messageLineGrouped]}>
        {!mine ? <View style={styles.avatarSlot}>{showPeerAvatar ? <Avatar uri={peer?.avatarUri} label={listName} styles={styles} /> : null}</View> : null}
        <Pressable onLongPress={() => void messageActions(item)} delayLongPress={320} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubblePeer, grouped && (mine ? styles.bubbleMineGrouped : styles.bubblePeerGrouped), item.photoUrl && styles.bubbleWithPhoto]} accessibilityRole="text" accessibilityLabel={`${mine ? "You" : listName}: ${item.text || "Photo"}`}>
          {!mine && item.photoUrl ? <View style={styles.senderPanel}><Avatar uri={peer?.avatarUri} label={listName} styles={styles} /><View style={styles.senderPanelCopy}><Text numberOfLines={1} style={styles.senderName}>{listName}</Text><Text numberOfLines={1} style={styles.senderHandle}>{peer?.username ? `@${peer.username}` : "Friend on Uvel"}</Text></View></View> : null}
          {item.photoUrl ? <Pressable onPress={() => setPreviewUri(item.photoUrl)} accessibilityRole="imagebutton" accessibilityLabel="View attached photo"><Image cachePolicy="memory-disk" source={{ uri: item.photoUrl }} style={styles.messagePhoto} contentFit="cover" /></Pressable> : null}
          {item.text ? <Text selectable style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextPeer]}>{item.text}</Text> : null}
          <Text style={[styles.messageTime, mine ? styles.messageTimeMine : styles.messageTimePeer]}>{timeLabel(item.createdAt)}</Text>
        </Pressable>
      </View>
      {isLatestOwn && status ? <View style={styles.statusRow}><Text style={styles.statusText}>{status}</Text><Ionicons name={item.status === "read" ? "checkmark-done" : "checkmark"} size={14} color={colors.muted} /></View> : null}
    </View>;
  };

  return <View style={styles.page}>
    <StatusBar style={appearance === "dark" ? "light" : "dark"} />
    <View style={[styles.header, { paddingTop: insets.top + 5 }]}>
      <Pressable onPress={() => router.back()} style={styles.headerIcon} accessibilityRole="button" accessibilityLabel="Back to messages"><Ionicons name="chevron-back" size={25} color={colors.bone} /></Pressable>
      <Pressable onPress={safetyActions} style={styles.profileButton} accessibilityRole="button" accessibilityLabel={`Conversation with ${listName}`}>
        <Avatar uri={peer?.avatarUri} label={listName} styles={styles} large />
        <View style={styles.profileCopy}><Text numberOfLines={1} style={styles.headerTitle}>{listName}</Text><Text style={styles.headerSubtitle}>{peer?.username ? `@${peer.username}` : "Friend on Uvel"}</Text></View>
        <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
      </Pressable>
      <Pressable onPress={() => { setSearchOpen((open) => !open); setSearchQuery(""); }} style={styles.headerIcon} accessibilityRole="button" accessibilityLabel="Search conversation"><Ionicons name={searchOpen ? "close" : "search"} size={20} color={colors.bone} /></Pressable>
      <Pressable onPress={safetyActions} style={styles.headerIconSmall} accessibilityRole="button" accessibilityLabel="More conversation options"><Ionicons name="ellipsis-horizontal" size={22} color={colors.bone} /></Pressable>
    </View>

    <View style={styles.contactPanel}>
      <Avatar uri={peer?.avatarUri} label={listName} styles={styles} large />
      <View style={styles.contactCopy}>
        <Text style={styles.contactEyebrow}>CONNECTED ON UVEL</Text>
        <Text style={styles.contactName} numberOfLines={1}>{listName}</Text>
        <Text style={styles.contactHandle} numberOfLines={1}>{peer?.username ? `@${peer.username}` : "Your friend on Uvel"}</Text>
      </View>
      <View style={styles.contactBadge}><Ionicons name="people" size={15} color={colors.success} /></View>
    </View>

    {searchOpen ? <View style={styles.searchBox}><Ionicons name="search" size={17} color={colors.subtle} /><TextInput autoFocus value={searchQuery} onChangeText={setSearchQuery} placeholder="Search messages" placeholderTextColor={colors.subtle} style={styles.searchInput} returnKeyType="search" /><Pressable onPress={() => setSearchQuery("")} accessibilityRole="button" accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color={colors.subtle} /></Pressable></View> : null}

    <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
      {loadError ? <View style={styles.errorBanner}><Ionicons name="cloud-offline-outline" size={17} color={colors.danger} /><Text style={styles.errorText} numberOfLines={3}>{loadError}</Text><Pressable onPress={() => { setLoading(true); setLoadError(""); setRetryCount((count) => count + 1); }} accessibilityRole="button" accessibilityLabel="Retry loading messages"><Text style={styles.retryText}>Retry</Text></Pressable></View> : null}
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.success} /><Text style={styles.loadingText}>Opening your conversation…</Text></View> : null}
      {!loading && !loadError && messages.length === 0 ? <View pointerEvents="none" style={styles.welcomeWrap}><Avatar uri={peer?.avatarUri} label={listName} styles={styles} extraLarge /><Text style={styles.welcomeTitle}>You and {listName}</Text><Text style={styles.welcomeCopy}>You’re connected on Uvel. Start a conversation, share a photo, or talk about a piece you both love.</Text><View style={styles.friendBadge}><Ionicons name="people-outline" size={14} color={colors.success} /><Text style={styles.friendBadgeText}>FRIENDS ON UVEL</Text></View></View> : null}
      {!loading && searchQuery.trim() && visibleMessages.length === 0 ? <View style={styles.searchEmpty}><Ionicons name="search-outline" size={26} color={colors.subtle} /><Text style={styles.searchEmptyTitle}>No matching messages</Text><Text style={styles.searchEmptyCopy}>Try another word or name.</Text></View> : null}
      <FlatList
        ref={listRef}
        data={visibleMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.list}
        contentContainerStyle={[styles.listContent, visibleMessages.length === 0 && styles.listContentEmpty]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        onContentSizeChange={() => { if (!searchQuery) listRef.current?.scrollToEnd({ animated: false }); }}
        ListFooterComponent={<View style={{ height: 10 }} />}
        showsVerticalScrollIndicator={false}
      />
      {photoUri ? <View style={styles.attachmentPreview}><Image cachePolicy="memory-disk" source={{ uri: photoUri }} style={styles.previewImage} contentFit="cover" /><View style={styles.previewCopy}><Text style={styles.previewTitle}>Photo attached</Text><Text style={styles.previewSubtitle}>Add a note or send it as is</Text></View><Pressable onPress={() => setPhotoUri(undefined)} style={styles.removePhoto} accessibilityRole="button" accessibilityLabel="Remove attached photo"><Ionicons name="close" size={18} color={colors.bone} /></Pressable></View> : null}
      <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable onPress={() => void attachPhoto()} disabled={sending} style={styles.attachButton} accessibilityRole="button" accessibilityLabel="Attach a photo"><Ionicons name="add" size={26} color={colors.bone} /></Pressable>
        <View style={styles.composerField}>
          <TextInput value={draft} onChangeText={setDraft} placeholder="Message your friend" placeholderTextColor={colors.subtle} style={styles.input} maxLength={2000} multiline blurOnSubmit={false} textAlignVertical="center" accessibilityLabel="Write a message" />
          <Text style={styles.charCount}>{draft.length >= 1800 ? `${draft.length}/2000` : ""}</Text>
        </View>
        <Pressable onPress={() => void send()} disabled={(!draft.trim() && !photoUri) || sending} style={[styles.sendButton, ((!draft.trim() && !photoUri) || sending) && styles.sendButtonDisabled]} accessibilityRole="button" accessibilityLabel="Send message">
          {sending ? <ActivityIndicator size="small" color={colors.successInk} /> : <Ionicons name="arrow-up" size={20} color={colors.successInk} />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>

    <Modal visible={Boolean(previewUri)} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPreviewUri(undefined)}>
      <View style={styles.viewer}><Pressable onPress={() => setPreviewUri(undefined)} style={[styles.viewerClose, { top: insets.top + 16 }]} accessibilityRole="button" accessibilityLabel="Close photo"><Ionicons name="close" size={24} color="#FFFFFF" /></Pressable>{previewUri ? <Image source={{ uri: previewUri }} style={styles.viewerImage} contentFit="contain" /> : null}</View>
    </Modal>
  </View>;
}

function Avatar({ uri, label, styles, large = false, extraLarge = false }: { uri?: string; label: string; styles: ReturnType<typeof make>; large?: boolean; extraLarge?: boolean }) {
  return <View style={[styles.avatar, large && styles.avatarLarge, extraLarge && styles.avatarExtraLarge]}>{uri ? <Image cachePolicy="memory-disk" source={{ uri }} style={styles.avatarImage} contentFit="cover" /> : <Text style={[styles.avatarInitial, large && styles.avatarInitialLarge, extraLarge && styles.avatarInitialExtraLarge]}>{initials(label)}</Text>}</View>;
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { minHeight: 66, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingBottom: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}18`, backgroundColor: colors.ink },
    headerIcon: { width: 38, height: 42, alignItems: "center", justifyContent: "center" },
    headerIconSmall: { width: 34, height: 42, alignItems: "center", justifyContent: "center" },
    profileButton: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 3 },
    profileCopy: { flex: 1, minWidth: 0 },
    headerTitle: { color: colors.bone, fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
    headerSubtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
    avatar: { width: 28, height: 28, borderRadius: 14, overflow: "hidden", backgroundColor: colors.neutral, alignItems: "center", justifyContent: "center" },
    avatarLarge: { width: 38, height: 38, borderRadius: 19 },
    avatarExtraLarge: { width: 78, height: 78, borderRadius: 39 },
    avatarImage: { width: "100%", height: "100%" },
    avatarInitial: { color: colors.bone, fontWeight: "800", fontSize: 11 },
    avatarInitialLarge: { fontSize: 14 },
    avatarInitialExtraLarge: { fontSize: 25 },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 9, marginHorizontal: 14, marginTop: 12, marginBottom: 3, paddingHorizontal: 12, height: 42, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}15` },
    searchInput: { flex: 1, color: colors.bone, fontSize: 14, paddingVertical: 0 },
    contactPanel: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, marginHorizontal: 13, marginTop: 10, marginBottom: 5, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}12` },
    contactCopy: { flex: 1, minWidth: 0 },
    contactEyebrow: { color: colors.success, fontSize: 8, fontWeight: "900", letterSpacing: 1.1, marginBottom: 3 },
    contactName: { color: colors.bone, fontSize: 13, fontWeight: "800" },
    contactHandle: { color: colors.muted, fontSize: 10, marginTop: 2 },
    contactBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.success}12` },
    keyboardArea: { flex: 1 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 15, paddingTop: 12, paddingBottom: 12, flexGrow: 1, justifyContent: "flex-end" },
    listContentEmpty: { minHeight: 120 },
    dayRule: { flexDirection: "row", alignItems: "center", gap: 11, alignSelf: "center", marginTop: 17, marginBottom: 15 },
    dayLine: { width: 32, height: StyleSheet.hairlineWidth, backgroundColor: `${colors.bone}24` },
    dayPill: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.neutral },
    messageLine: { flexDirection: "row", alignItems: "flex-end", marginBottom: 3 },
    messageLineMine: { justifyContent: "flex-end" },
    messageLinePeer: { justifyContent: "flex-start" },
    messageLineGrouped: { marginTop: 1 },
    avatarSlot: { width: 28, marginRight: 7, alignItems: "center" },
    bubble: { maxWidth: "79%", minWidth: 50, paddingHorizontal: 13, paddingTop: 9, paddingBottom: 7, borderRadius: 19 },
    bubbleMine: { backgroundColor: colors.success, borderBottomRightRadius: 7 },
    bubblePeer: { backgroundColor: colors.surface, borderBottomLeftRadius: 7, borderWidth: 1, borderColor: `${colors.bone}10` },
    bubbleMineGrouped: { borderBottomRightRadius: 7 },
    bubblePeerGrouped: { borderBottomLeftRadius: 7 },
    bubbleWithPhoto: { paddingHorizontal: 5, paddingTop: 5, paddingBottom: 6 },
    senderPanel: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 7, paddingVertical: 5, marginBottom: 6, borderRadius: 12, backgroundColor: colors.neutral },
    senderPanelCopy: { flex: 1, minWidth: 0 },
    senderName: { color: colors.bone, fontSize: 12, fontWeight: "800" },
    senderHandle: { color: colors.muted, fontSize: 10, marginTop: 2 },
    bubbleText: { fontSize: 15, lineHeight: 21 },
    bubbleTextMine: { color: colors.successInk },
    bubbleTextPeer: { color: colors.bone },
    messagePhoto: { width: 218, height: 218, maxWidth: "100%", borderRadius: 15, marginBottom: 5, backgroundColor: colors.neutral },
    messageTime: { alignSelf: "flex-end", fontSize: 9, marginTop: 4, fontWeight: "600" },
    messageTimeMine: { color: colors.successInk, opacity: 0.64 },
    messageTimePeer: { color: colors.muted },
    statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3, marginTop: 2, marginBottom: 5, marginRight: 3 },
    statusText: { color: colors.muted, fontSize: 10 },
    welcomeWrap: { position: "absolute", zIndex: 1, alignSelf: "center", alignItems: "center", width: "82%", top: "23%" },
    welcomeTitle: { color: colors.bone, fontSize: 20, fontWeight: "800", marginTop: 16, letterSpacing: -0.4 },
    welcomeCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 8, maxWidth: 300 },
    friendBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: `${colors.success}12`, marginTop: 15 },
    friendBadgeText: { color: colors.success, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
    loading: { position: "absolute", zIndex: 2, alignSelf: "center", top: "43%", alignItems: "center", gap: 10 },
    loadingText: { color: colors.muted, fontSize: 12 },
    errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginTop: 8, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12, backgroundColor: `${colors.danger}12` },
    errorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 17 },
    retryText: { color: colors.danger, fontSize: 12, fontWeight: "800", paddingHorizontal: 4 },
    searchEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 7 },
    searchEmptyTitle: { color: colors.bone, fontSize: 15, fontWeight: "700" },
    searchEmptyCopy: { color: colors.muted, fontSize: 12 },
    attachmentPreview: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 12, marginBottom: 7, padding: 8, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}12` },
    previewImage: { width: 44, height: 44, borderRadius: 9, backgroundColor: colors.neutral },
    previewCopy: { flex: 1 },
    previewTitle: { color: colors.bone, fontWeight: "700", fontSize: 12 },
    previewSubtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
    removePhoto: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.neutral },
    composerWrap: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${colors.bone}18`, backgroundColor: colors.ink },
    attachButton: { width: 40, height: 43, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}14`, marginBottom: 1 },
    composerField: { flex: 1, minHeight: 44, maxHeight: 118, flexDirection: "row", alignItems: "center", borderRadius: 22, paddingLeft: 15, paddingRight: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}12` },
    input: { flex: 1, maxHeight: 102, color: colors.bone, fontSize: 15, lineHeight: 20, paddingVertical: 10 },
    charCount: { color: colors.subtle, fontSize: 9, marginLeft: 5 },
    sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.success, marginBottom: 1 },
    sendButtonDisabled: { opacity: 0.35 },
    viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)", alignItems: "center", justifyContent: "center" },
    viewerClose: { position: "absolute", zIndex: 2, right: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(35,35,35,0.75)", alignItems: "center", justifyContent: "center" },
    viewerImage: { width: "100%", height: "82%" },
  });
}
