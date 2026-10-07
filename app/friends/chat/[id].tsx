import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, ImageBackground, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { notificationAsync, NotificationFeedbackType } from "../../../lib/haptics";
import { blockFriend, deleteFriendMessage, listFriends, markFriendChatRead, reportFriendConversation, sendFriendMessage, subscribeFriendMessages, uploadFriendAttachment, type FriendMessage } from "../../../lib/friendChat";
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

function timestampLabel(value: unknown) {
  const date = asDate(value);
  return date ? `Sent · ${date.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Time unavailable";
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "F";
}

function friendChatErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (/failed to send a request to the edge function/i.test(message)) {
    console.warn("[FriendChat] Edge Function transport failure", error);
    return fallback;
  }
  return message || fallback;
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
  const [optimisticMessages, setOptimisticMessages] = useState<FriendMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<FriendMessage | null>(null);
  const [activeMessage, setActiveMessage] = useState<FriendMessage | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
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
    const combined = [...messages, ...optimisticMessages].sort((a, b) => (asDate(a.createdAt)?.getTime() || 0) - (asDate(b.createdAt)?.getTime() || 0));
    return query ? combined.filter((message) => message.text.toLowerCase().includes(query)) : combined;
  }, [messages, optimisticMessages, searchQuery]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    if (peerUid) void listFriends().then((friends) => { if (active) setPeer(friends.find((friend) => friend.uid === peerUid)); }).catch(() => undefined);
    if (chatId) void markFriendChatRead(String(chatId)).catch(() => undefined);
    const unsubscribe = subscribeFriendMessages(String(chatId || ""), (next) => {
      if (!active) return;
      setMessages(next);
      setOptimisticMessages((current) => current.filter((message) => !next.some((serverMessage) => serverMessage.id === message.id)));
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
      setLoadError(friendChatErrorMessage(error, "Messages are temporarily unavailable. Please try again shortly."));
    });
    return () => { active = false; unsubscribe(); };
  }, [chatId, peerUid, retryCount, uid]);

  useEffect(() => {
    if (!searchQuery && messages.length) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [visibleMessages.length, searchQuery]);

  async function send() {
    const text = draft.trim();
    const localPhotoUri = photoUri;
    const replyTarget = replyingTo;
    if ((!text && !localPhotoUri) || !chatId) return;

    // Render locally first so the sender sees the message immediately instead of
    // waiting on token renewal, the Edge Function, and sequential database writes.
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: FriendMessage = {
      id: localId,
      text,
      from: uid,
      photoUrl: localPhotoUri,
      createdAt: new Date(),
      status: "sending",
      replyTo: replyTarget ? { id: replyTarget.id, text: replyTarget.text, from: replyTarget.from, photoUrl: replyTarget.photoUrl } : undefined,
    };
    setOptimisticMessages((current) => [...current, optimistic]);
    setDraft("");
    setPhotoUri(undefined);
    setReplyingTo(null);
    setLoadError("");
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

    try {
      let uploaded = "";
      if (localPhotoUri) {
        const base64 = await FileSystem.readAsStringAsync(localPhotoUri, { encoding: FileSystem.EncodingType.Base64 });
        uploaded = await uploadFriendAttachment(base64, "image/jpeg");
      }
      const result = await sendFriendMessage(String(chatId), text, uploaded, replyTarget?.id);
      setOptimisticMessages((current) => current.map((message) => message.id === localId ? { ...message, id: result.messageId, photoUrl: uploaded || undefined, status: "sent" } : message));
    } catch (error) {
      setOptimisticMessages((current) => current.filter((message) => message.id !== localId));
      setDraft((current) => current || text);
      if (localPhotoUri) setPhotoUri((current) => current || localPhotoUri);
      setLoadError(friendChatErrorMessage(error, "Couldn’t send your message just now. Your draft is saved—please try again."));
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
      { text: "Search messages", onPress: () => { setSearchOpen(true); setSearchQuery(""); } },
      { text: "Report conversation", style: "destructive", onPress: () => { void reportFriendConversation(String(chatId), "Reported from friend chat").then(() => Alert.alert("Report sent", "Thanks. We’ll review this conversation." )).catch(() => Alert.alert("Report not sent", "Please try again.")); } },
      { text: "Block friend", style: "destructive", onPress: () => { void blockFriend(peerUid).then(() => { Alert.alert("Friend blocked", "New messages from this friend are blocked."); router.back(); }).catch(() => Alert.alert("Couldn’t block friend", "Please try again.")); } },
    ]);
  }

  function confirmDeleteMessage() {
    const message = activeMessage;
    if (!message || message.from !== uid) return;
    setActiveMessage(null);
    Alert.alert("Delete message?", "This removes your message from this conversation.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { void deleteFriendMessage(String(chatId), message.id).then(() => { setMessages((current) => current.filter((entry) => entry.id !== message.id)); setReplyingTo((current) => current?.id === message.id ? null : current); }).catch((error) => Alert.alert("Couldn’t delete message", friendChatErrorMessage(error, "Please check your connection and try again."))); } },
    ]);
  }

  const renderMessage = ({ item, index }: { item: FriendMessage; index: number }) => {
    const mine = item.from === uid;
    const previous = visibleMessages[index - 1];
    const next = visibleMessages[index + 1];
    const startsDay = index === 0 || dayKey(previous?.createdAt) !== dayKey(item.createdAt);
    const grouped = previous?.from === item.from && !startsDay;
    const showPeerAvatar = !mine && (next?.from !== item.from || dayKey(next?.createdAt) !== dayKey(item.createdAt));
    const bubbleContent = <>
      {item.replyTo ? <View style={styles.replyQuote}><View style={[styles.replyQuoteBar, mine && styles.replyQuoteBarMine]} /><View style={styles.replyQuoteCopy}><Text style={[styles.replyQuoteName, mine && styles.replyQuoteMine]} numberOfLines={1}>{item.replyTo.from === uid ? "You" : listName}</Text><Text style={[styles.replyQuoteText, mine && styles.replyQuoteMine]} numberOfLines={2}>{item.replyTo.text || (item.replyTo.photoUrl ? "Photo" : "Message")}</Text></View></View> : null}
      {item.photoUrl ? <View style={styles.senderPanel}><Avatar uri={mine ? undefined : peer?.avatarUri} label={mine ? "You" : listName} styles={styles} /><View style={styles.senderPanelCopy}><Text numberOfLines={1} style={[styles.senderName, mine && styles.senderNameMine]}>{mine ? "You" : listName}</Text><Text numberOfLines={1} style={[styles.senderHandle, mine && styles.senderHandleMine]}>{mine ? "Shared a photo" : peer?.username ? `@${peer.username}` : "Friend on Uvel"}</Text></View></View> : null}
      {item.photoUrl ? <Pressable onPress={() => setPreviewUri(item.photoUrl)} accessibilityRole="imagebutton" accessibilityLabel="View attached photo"><Image cachePolicy="memory-disk" source={{ uri: item.photoUrl }} style={styles.messagePhoto} contentFit="cover" /></Pressable> : null}
      {item.text ? <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextPeer]}>{item.text}</Text> : null}
    </>;
    return <View key={item.id}>
      {startsDay ? <View style={styles.dayRule}><Text style={styles.dayPill}>{dayLabel(item.createdAt).toUpperCase()}</Text></View> : null}
      <View style={[styles.messageLine, mine ? styles.messageLineMine : styles.messageLinePeer, grouped && styles.messageLineGrouped]}>
        {!mine ? <View style={styles.avatarSlot}>{showPeerAvatar ? <Avatar uri={peer?.avatarUri} label={listName} styles={styles} /> : null}</View> : null}
        <Pressable style={[styles.bubbleFrame, grouped && (mine ? styles.bubbleMineGrouped : styles.bubblePeerGrouped)]} onLongPress={() => { setCopiedMessageId(null); setActiveMessage(item); void notificationAsync(NotificationFeedbackType.Success); }} delayLongPress={430} accessibilityRole="text" accessibilityLabel={`${mine ? "You" : listName}: ${item.text || "Photo"}`}>
          {mine ? <ImageBackground source={require("../../../assets/chat/message-bubble-gradient.png")} resizeMode="stretch" imageStyle={styles.bubbleGradientImage} style={[styles.bubble, styles.bubbleMine, grouped && styles.bubbleMineGrouped, item.photoUrl && styles.bubbleWithPhoto, item.status === "sending" && styles.bubblePending]}>{bubbleContent}</ImageBackground> : <View style={[styles.bubble, styles.bubblePeer, grouped && styles.bubblePeerGrouped, item.photoUrl && styles.bubbleWithPhoto]}>{bubbleContent}</View>}
        </Pressable>
      </View>
    </View>;
  };

  return <View style={styles.page}>
    <StatusBar style={appearance === "dark" ? "light" : "dark"} />
    <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
      <Pressable onPress={() => router.back()} style={styles.headerIcon} accessibilityRole="button" accessibilityLabel="Back to messages"><Ionicons name="chevron-back" size={27} color={colors.bone} /></Pressable>
      <View style={styles.profileHeader}>
        <Avatar uri={peer?.avatarUri} label={listName} styles={styles} large />
        <View style={styles.profileCopy}><Text numberOfLines={1} style={styles.headerTitle}>{listName}</Text><Text numberOfLines={1} style={styles.headerSubtitle}>{peer?.username ? `@${peer.username}` : "Friend on Uvel"}</Text></View>
        <Ionicons name="chevron-forward" size={15} color={colors.subtle} />
      </View>
      <Pressable onPress={safetyActions} style={styles.headerIcon} accessibilityRole="button" accessibilityLabel="Conversation options"><Ionicons name="ellipsis-horizontal" size={23} color={colors.bone} /></Pressable>
    </View>

    {searchOpen ? <View style={styles.searchBox}><Ionicons name="search" size={17} color={colors.subtle} /><TextInput autoFocus value={searchQuery} onChangeText={setSearchQuery} placeholder="Search messages" placeholderTextColor={colors.subtle} style={styles.searchInput} returnKeyType="search" /><Pressable onPress={() => setSearchQuery("")} accessibilityRole="button" accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color={colors.subtle} /></Pressable></View> : null}

    <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
      {loadError ? <View style={styles.errorBanner}><Ionicons name="cloud-offline-outline" size={17} color={colors.danger} /><Text style={styles.errorText} numberOfLines={3}>{loadError}</Text><Pressable onPress={() => { setLoading(true); setLoadError(""); setRetryCount((count) => count + 1); }} accessibilityRole="button" accessibilityLabel="Retry loading messages"><Text style={styles.retryText}>Retry</Text></Pressable></View> : null}
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.success} /><Text style={styles.loadingText}>Opening your conversation…</Text></View> : null}
      {!loading && !loadError && visibleMessages.length === 0 ? <View pointerEvents="none" style={styles.emptyPrompt}><Text style={styles.emptyPromptText}>Say hi to {listName}</Text></View> : null}
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
      {replyingTo ? <View style={styles.replyComposer}><View style={styles.replyComposerAccent} /><View style={styles.replyComposerCopy}><Text style={styles.replyComposerTitle}>Replying to {replyingTo.from === uid ? "your message" : listName}</Text><Text numberOfLines={1} style={styles.replyComposerText}>{replyingTo.text || (replyingTo.photoUrl ? "Photo" : "Message")}</Text></View><Pressable onPress={() => setReplyingTo(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel reply"><Ionicons name="close" size={19} color={colors.muted} /></Pressable></View> : null}
      {photoUri ? <View style={styles.attachmentPreview}><Image cachePolicy="memory-disk" source={{ uri: photoUri }} style={styles.previewImage} contentFit="cover" /><View style={styles.previewCopy}><Text style={styles.previewTitle}>Photo attached</Text><Text style={styles.previewSubtitle}>Add a note or send it as is</Text></View><Pressable onPress={() => setPhotoUri(undefined)} style={styles.removePhoto} accessibilityRole="button" accessibilityLabel="Remove attached photo"><Ionicons name="close" size={18} color={colors.bone} /></Pressable></View> : null}
      <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable onPress={() => void attachPhoto()} disabled={sending} style={styles.attachButton} accessibilityRole="button" accessibilityLabel="Attach a photo"><Ionicons name="add" size={26} color={colors.bone} /></Pressable>
        <View style={styles.composerField}>
          <TextInput value={draft} onChangeText={setDraft} placeholder="Message your friend" placeholderTextColor={colors.subtle} style={styles.input} maxLength={2000} multiline blurOnSubmit={false} textAlignVertical="center" accessibilityLabel="Write a message" />
          <Text style={styles.charCount}>{draft.length >= 1800 ? `${draft.length}/2000` : ""}</Text>
        </View>
        <Pressable onPress={() => void send()} disabled={!draft.trim() && !photoUri} style={[styles.sendButton, (!draft.trim() && !photoUri) && styles.sendButtonDisabled]} accessibilityRole="button" accessibilityLabel="Send message">
          <Text style={styles.sendTxt}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>

    <Modal visible={Boolean(activeMessage)} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setActiveMessage(null)}>
      <View style={styles.actionModal}><Pressable style={styles.actionScrim} onPress={() => setActiveMessage(null)} accessibilityRole="button" accessibilityLabel="Dismiss message actions" /><View style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 18) }]}><View style={styles.actionHandle} /><Text style={styles.actionTimestamp}>{timestampLabel(activeMessage?.createdAt)}</Text><Text numberOfLines={2} style={styles.actionExcerpt}>{activeMessage?.text || (activeMessage?.photoUrl ? "Photo message" : "Message")}</Text>
        <Pressable style={styles.actionRow} onPress={() => { if (activeMessage) setReplyingTo(activeMessage); setActiveMessage(null); }}><Ionicons name="arrow-undo-outline" size={21} color={colors.bone} /><Text style={styles.actionLabel}>Reply</Text></Pressable>
        {activeMessage?.text ? <Pressable style={styles.actionRow} onPress={() => { const message = activeMessage; void Clipboard.setStringAsync(message.text).then(() => { setCopiedMessageId(message.id); void notificationAsync(NotificationFeedbackType.Success); }); }} accessibilityRole="button" accessibilityLabel={copiedMessageId === activeMessage.id ? "Copied to clipboard" : "Copy message"}><Ionicons name={copiedMessageId === activeMessage.id ? "checkmark-circle-outline" : "copy-outline"} size={22} color={copiedMessageId === activeMessage.id ? colors.success : colors.bone} /><Text style={[styles.actionLabel, copiedMessageId === activeMessage.id && styles.actionCopiedLabel]}>{copiedMessageId === activeMessage.id ? "Copied to clipboard" : "Copy"}</Text></Pressable> : null}
        {activeMessage?.photoUrl ? <Pressable style={styles.actionRow} onPress={() => { setPreviewUri(activeMessage.photoUrl); setActiveMessage(null); }}><Ionicons name="image-outline" size={21} color={colors.bone} /><Text style={styles.actionLabel}>View photo</Text></Pressable> : null}
        {activeMessage?.from === uid ? <Pressable style={styles.actionRow} onPress={confirmDeleteMessage}><Ionicons name="trash-outline" size={21} color={colors.danger} /><Text style={styles.actionDeleteLabel}>Delete message</Text></Pressable> : null}
      </View></View>
    </Modal>

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
    header: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingBottom: 7, backgroundColor: colors.ink },
    headerIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
    profileHeader: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 },
    profileCopy: { flex: 1, minWidth: 0 },
    headerTitle: { color: colors.bone, fontSize: 19, fontWeight: "800", letterSpacing: -0.35 },
    headerSubtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
    avatar: { width: 38, height: 38, borderRadius: 19, overflow: "hidden", backgroundColor: colors.neutral, alignItems: "center", justifyContent: "center" },
    avatarLarge: { width: 54, height: 54, borderRadius: 27 },
    avatarExtraLarge: { width: 78, height: 78, borderRadius: 39 },
    avatarImage: { width: "100%", height: "100%" },
    avatarInitial: { color: colors.bone, fontWeight: "800", fontSize: 13 },
    avatarInitialLarge: { fontSize: 18 },
    avatarInitialExtraLarge: { fontSize: 25 },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 9, marginHorizontal: 14, marginTop: 12, marginBottom: 3, paddingHorizontal: 12, height: 42, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}15` },
    searchInput: { flex: 1, color: colors.bone, fontSize: 14, paddingVertical: 0 },
    keyboardArea: { flex: 1 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, flexGrow: 1, justifyContent: "flex-end" },
    listContentEmpty: { minHeight: 120 },
    dayRule: { alignItems: "center", alignSelf: "center", marginTop: 8, marginBottom: 13, paddingHorizontal: 8, paddingVertical: 4 },
    dayPill: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.55 },
    messageLine: { flexDirection: "row", alignItems: "flex-end", marginBottom: 3 },
    messageLineMine: { justifyContent: "flex-end" },
    messageLinePeer: { justifyContent: "flex-start" },
    messageLineGrouped: { marginTop: -2 },
    avatarSlot: { width: 40, marginRight: 6, alignItems: "center" },
    bubbleFrame: { maxWidth: "86%", minWidth: 56, borderRadius: 21, overflow: "hidden" },
    bubble: { paddingHorizontal: 16, paddingTop: 13, paddingBottom: 12, borderRadius: 21 },
    bubbleGradientImage: { borderRadius: 19 },
    bubbleMine: { backgroundColor: "transparent", borderBottomRightRadius: 7 },
    bubblePending: { opacity: 0.48 },
    bubblePeer: { backgroundColor: colors.neutral, borderBottomLeftRadius: 7 },
    bubbleMineGrouped: { borderBottomRightRadius: 7 },
    bubblePeerGrouped: { borderBottomLeftRadius: 7 },
    bubbleWithPhoto: { paddingHorizontal: 5, paddingTop: 5, paddingBottom: 6 },
    senderPanel: { minHeight: 45, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 5, borderRadius: 0, backgroundColor: "transparent" },
    senderPanelCopy: { flex: 1, minWidth: 0 },
    senderName: { color: colors.bone, fontSize: 15, fontWeight: "800" },
    senderNameMine: { color: "#FFFFFF" },
    senderHandle: { color: colors.muted, fontSize: 11, marginTop: 2 },
    senderHandleMine: { color: "rgba(255,255,255,0.78)" },
    bubbleText: { fontSize: 18, lineHeight: 27 },
    bubbleTextMine: { color: "#FFFFFF" },
    bubbleTextPeer: { color: colors.bone },
    replyQuote: { flexDirection: "row", alignItems: "stretch", gap: 8, marginBottom: 9, paddingVertical: 2 },
    replyQuoteBar: { width: 3, borderRadius: 2, backgroundColor: colors.danger },
    replyQuoteBarMine: { backgroundColor: "rgba(255,255,255,0.85)" },
    replyQuoteCopy: { flex: 1, minWidth: 0 },
    replyQuoteName: { color: colors.bone, fontSize: 12, fontWeight: "800" },
    replyQuoteText: { color: colors.muted, fontSize: 13, marginTop: 2 },
    replyQuoteMine: { color: "rgba(255,255,255,0.9)" },
    messagePhoto: { width: 270, height: 430, maxWidth: "100%", borderRadius: 12, marginBottom: 5, backgroundColor: colors.neutral },
    emptyPrompt: { position: "absolute", zIndex: 1, alignSelf: "center", top: "47%" },
    emptyPromptText: { color: colors.muted, fontSize: 13 },
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
    replyComposer: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.surface },
    replyComposerAccent: { width: 3, height: 34, borderRadius: 2, backgroundColor: colors.danger },
    replyComposerCopy: { flex: 1, minWidth: 0 },
    replyComposerTitle: { color: colors.bone, fontSize: 12, fontWeight: "800" },
    replyComposerText: { color: colors.muted, fontSize: 12, marginTop: 2 },
    composerWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, paddingTop: 7, backgroundColor: colors.ink },
    attachButton: { width: 36, height: 44, alignItems: "center", justifyContent: "center", marginBottom: 1 },
    composerField: { flex: 1, minHeight: 46, maxHeight: 118, flexDirection: "row", alignItems: "center", borderRadius: 17, paddingLeft: 14, paddingRight: 11, backgroundColor: colors.surface },
    input: { flex: 1, maxHeight: 102, color: colors.bone, fontSize: 16, lineHeight: 22, paddingVertical: 10 },
    charCount: { color: colors.subtle, fontSize: 9, marginLeft: 5 },
    sendButton: { minWidth: 51, height: 44, alignItems: "center", justifyContent: "center", marginBottom: 1 },
    sendTxt: { color: colors.success, fontSize: 14, fontWeight: "800" },
    sendButtonDisabled: { opacity: 0.35 },
    actionModal: { flex: 1, justifyContent: "flex-end" },
    actionScrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)" },
    actionSheet: { paddingHorizontal: 22, paddingTop: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
    actionHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", backgroundColor: colors.subtle, opacity: 0.6, marginBottom: 15 },
    actionTimestamp: { color: colors.muted, fontSize: 12, textAlign: "center", fontWeight: "700" },
    actionExcerpt: { color: colors.bone, fontSize: 15, textAlign: "center", marginTop: 7, marginBottom: 12 },
    actionRow: { minHeight: 51, flexDirection: "row", alignItems: "center", gap: 15 },
    actionLabel: { color: colors.bone, fontSize: 17, fontWeight: "600" },
    actionCopiedLabel: { color: colors.success },
    actionDeleteLabel: { color: colors.danger, fontSize: 16, fontWeight: "700" },
    viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)", alignItems: "center", justifyContent: "center" },
    viewerClose: { position: "absolute", zIndex: 2, right: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(35,35,35,0.75)", alignItems: "center", justifyContent: "center" },
    viewerImage: { width: "100%", height: "82%" },
  });
}
