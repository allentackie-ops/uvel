import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "../lib/haptics";
import { useEffect, useMemo, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createFriendChat, getCachedFriendInbox, refreshFriendInbox, sendFriendMessage, uploadFriendAttachment, restoreFriendInboxCache } from "../lib/friendChat";
import { searchUsers, sendFriendRequest, type PublicUser } from "../lib/friends";
import { addActivityNotification } from "../lib/activityNotifications";
import { sharedListingPayload, type SharedListingShare } from "../lib/sharedListing";
import { useColors } from "../lib/theme";
import { useUvel } from "../lib/store";

export type FriendSharePayload = { kind: "listing" | "mirror"; id?: string; title: string; deepLink: string; imageUri?: string; previewText?: string; listing?: SharedListingShare };

type FriendShareSheetProps = {
  visible: boolean;
  payload: FriendSharePayload | null;
  onClose: () => void;
  onExternalShare: () => void;
};

export function FriendShareSheet({ visible, payload, onClose, onExternalShare }: FriendShareSheetProps) {
  const colors = useColors();
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const [friends, setFriends] = useState<PublicUser[]>(() => getCachedFriendInbox(app.uid)?.friends || []);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Record<string, PublicUser>>({});
  const [sending, setSending] = useState(false);
  const [finderVisible, setFinderVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const translateY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const panStartScrollY = useSharedValue(0);
  const panStartedOnHandle = useSharedValue(false);
  const contentScrollGesture = useMemo(() => Gesture.Native(), []);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (event) => { scrollY.value = event.contentOffset.y; } });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(translateY.value, [0, 360], [1, 0], Extrapolation.CLAMP) }));
  const shareLink = useMemo(() => {
    if (!payload) return "";
    const separator = payload.deepLink.includes("?") ? "&" : "?";
    const name = encodeURIComponent(app.displayName || (app.username ? `@${app.username}` : "A friend"));
    const username = encodeURIComponent(app.username || "");
    return `${payload.deepLink}${separator}sharedBy=${encodeURIComponent(app.uid)}&sharedByName=${name}${username ? `&sharedByUsername=${username}` : ""}`;
  }, [app.displayName, app.uid, app.username, payload]);

  useEffect(() => {
    if (!visible) return;
    translateY.value = 620;
    setFinderVisible(false);
    setQuery("");
    setResults([]);
    setCopied(false);
    setToast("");
    setSelected({});
    const cached = getCachedFriendInbox(app.uid)?.friends || [];
    if (cached.length) setFriends(cached);
    void restoreFriendInboxCache(app.uid).then((snapshot) => {
      if (snapshot?.friends?.length) setFriends(snapshot.friends);
    }).catch(() => undefined);
    void refreshFriendInbox(app.uid).then((snapshot) => setFriends(snapshot.friends)).catch(() => undefined);
    translateY.value = withSpring(0, { damping: 24, stiffness: 220, mass: 0.85 });
  }, [app.uid, visible, translateY]);

  function dismiss() {
    translateY.value = withTiming(620, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetY(6)
    .failOffsetX([-18, 18])
    .simultaneousWithExternalGesture(contentScrollGesture)
    .onBegin((event) => {
      panStartScrollY.value = scrollY.value;
      panStartedOnHandle.value = event.y <= 42;
    })
    .onUpdate((event) => {
      if (panStartScrollY.value <= 1 || panStartedOnHandle.value) translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if ((panStartScrollY.value <= 1 || panStartedOnHandle.value) && (event.translationY > 72 || event.velocityY > 700)) {
        translateY.value = withTiming(620, { duration: 220 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 24, stiffness: 220, mass: 0.85 });
      }
    }), [contentScrollGesture, onClose, panStartScrollY, panStartedOnHandle, scrollY, translateY]);

  function toggleFriend(friend: PublicUser) {
    if (sending) return;
    setSelected((current) => {
      const next = { ...current };
      if (next[friend.uid]) delete next[friend.uid];
      else next[friend.uid] = friend;
      return next;
    });
    void Haptics.selectionAsync();
  }

  async function deliverShare(recipientIds: string[], text: string, imageUri?: string) {
    let photoUrl = "";
    if (imageUri) {
      const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
      photoUrl = await uploadFriendAttachment(base64, "image/jpeg");
    }
    const results = await Promise.allSettled(recipientIds.map(async (friendUid) => {
      const id = await createFriendChat(friendUid);
      return sendFriendMessage(id, text, photoUrl);
    }));
    if (results.some((result) => result.status === "rejected")) {
      console.warn("One or more friend shares failed to deliver.");
    }
  }

  function sendSelected() {
    if (!payload || sending) return;
    const recipients = Object.values(selected);
    if (!recipients.length) return;
    const names = recipients.map((friend) => friend.displayName || `@${friend.username}`);
    const listingText = payload.kind === "listing" && payload.listing ? sharedListingPayload(payload.listing) : "";
    const text = listingText || `${message.trim() ? `${message.trim()}\n\n` : ""}${payload.previewText || `Check this out: ${payload.title}`}\n${shareLink}`;
    setSending(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void addActivityNotification(app.uid, {
      kind: "share_sent",
      title: "Shared",
      body: `Sent to ${names.join(", ")}.`,
      lookId: payload.id || payload.deepLink,
      target: "none",
    }).catch(() => undefined);
    void deliverShare(recipients.map((friend) => friend.uid), text, payload.imageUri).catch((error) => {
      console.warn("Friend share delivery failed", error);
    });
    setSelected({});
    setMessage("");
    onClose();
    setSending(false);
  }

  async function findFriends() {
    const term = query.trim();
    if (!term) { setResults([]); return; }
    setSearching(true);
    try { setResults(await searchUsers(term)); } catch (e) { console.warn("Friend search failed", e); Alert.alert("Search unavailable", "Couldn’t load friends right now. Please try again shortly."); }
    finally { setSearching(false); }
  }

  async function requestFriend(user: PublicUser) {
    try { await sendFriendRequest(user.uid); setRequested((current) => ({ ...current, [user.uid]: true })); }
    catch (e) { Alert.alert("Couldn’t send request", e instanceof Error ? e.message : "Try again."); }
  }

  async function openExternal(kind: "copy" | "message" | "whatsapp" | "email" | "more") {
    if (!payload) return;
    Keyboard.dismiss();
    const text = `${payload.previewText || `Check this out: ${payload.title}`}\n${shareLink}`;
    if (kind === "more") { await Share.share({ message: text, title: payload.title }); return; }
    const urls: Record<Exclude<typeof kind, "copy" | "more">, string> = {
      message: `sms:&body=${encodeURIComponent(text)}`,
      whatsapp: `whatsapp://send?text=${encodeURIComponent(text)}`,
      email: `mailto:?subject=${encodeURIComponent(payload.title)}&body=${encodeURIComponent(text)}`,
    };
    if (kind === "copy") {
      await Clipboard.setStringAsync(text);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopied(true);
      setToast("Copied to clipboard");
      setTimeout(() => { setCopied(false); setToast(""); }, 1800);
      return;
    }
    const url = urls[kind];
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // Fall through to the native share sheet when the app or URL scheme is unavailable.
    }
    await Share.share({ message: text, title: payload.title });
  }

  if (!payload) return null;
  return <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
    <GestureHandlerRootView style={styles.gestureRoot}>
    <KeyboardAvoidingView style={styles.keyboardRoot} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
    <Animated.View style={[styles.scrim, backdropStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Close share sheet" />
      <GestureDetector gesture={pan}>
      <Animated.View style={[styles.sheet, { backgroundColor: colors.surface }, sheetStyle]}>
        <GestureDetector gesture={contentScrollGesture}>
        <Animated.ScrollView
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          bounces={false}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={scrollHandler}
        >
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.bone }]}>Share with friends</Text>
          <Pressable onPress={() => setFinderVisible(true)} hitSlop={10} style={styles.headerSearch} accessibilityRole="button" accessibilityLabel="Search friends">
            <Ionicons name="search" size={21} color={colors.bone} />
          </Pressable>
        </View>
        <Text style={[styles.preview, { color: colors.muted }]} numberOfLines={2}>{payload.title}</Text>
        <TextInput value={message} onChangeText={setMessage} placeholder="Add a message (optional)" placeholderTextColor={colors.subtle} style={[styles.input, { backgroundColor: colors.ink, color: colors.bone }]} maxLength={300} />
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>FRIENDS</Text>
        <Pressable onPress={() => setFinderVisible(true)} disabled={sending} style={[styles.findFriends, { borderColor: `${colors.danger}80`, backgroundColor: `${colors.danger}14` }]} accessibilityRole="button" accessibilityLabel="Find friends">
          <View style={[styles.findIcon, { backgroundColor: colors.danger }]}><Ionicons name="person-add" size={19} color={colors.ink} /></View><View style={styles.findCopy}><Text style={[styles.findTitle, { color: colors.bone }]}>Find friends</Text><Text style={[styles.findSubtitle, { color: colors.muted }]}>Search by name or username</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
        {friends.length ? <ScrollView horizontal keyboardShouldPersistTaps="always" keyboardDismissMode="none" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>{friends.map((friend) => <Pressable key={friend.uid} onPress={() => toggleFriend(friend)} disabled={sending} style={styles.friend} accessibilityRole="button" accessibilityLabel={`${selected[friend.uid] ? "Deselect" : "Select"} ${friend.displayName || friend.username}`} accessibilityState={{ selected: Boolean(selected[friend.uid]) }}>
          <View>{friend.avatarUri ? <Image cachePolicy="memory-disk" source={{ uri: friend.avatarUri }} style={[styles.avatar, selected[friend.uid] && styles.avatarSelected]} contentFit="cover" /> : <View style={[styles.avatar, styles.fallback, selected[friend.uid] && styles.avatarSelected]}><Text style={{ color: colors.successInk, fontWeight: "800" }}>{(friend.displayName || friend.username || "U").slice(0, 1).toUpperCase()}</Text></View>}{selected[friend.uid] ? <View style={[styles.selectedBadge, { backgroundColor: colors.success }]}><Ionicons name="checkmark" size={12} color={colors.successInk} /></View> : null}</View>
          <Text style={[styles.name, { color: colors.bone }]} numberOfLines={1}>{friend.displayName || `@${friend.username}`}</Text>
        </Pressable>)}</ScrollView> : <Text style={[styles.emptyFriends, { color: colors.muted }]}>Your friends will appear here.</Text>}
        {Object.keys(selected).length ? <Pressable onPress={sendSelected} disabled={sending} style={[styles.sendButton, { backgroundColor: colors.success }]} accessibilityRole="button" accessibilityLabel={`Send to ${Object.keys(selected).length} selected friends`}><Text style={[styles.sendButtonText, { color: colors.successInk }]}>{sending ? "Sending…" : `Send to ${Object.keys(selected).length} ${Object.keys(selected).length === 1 ? "friend" : "friends"}`}</Text></Pressable> : null}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>SHARE TO</Text>
        <ScrollView horizontal keyboardShouldPersistTaps="always" keyboardDismissMode="none" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.externalRail}>
          <ExternalAction icon={copied ? "checkmark" : "copy-outline"} label={copied ? "Copied" : "Copy link"} onPress={() => void openExternal("copy")} colors={colors} />
          <ExternalAction icon={Platform.OS === "ios" ? "chatbubble-ellipses-outline" : "message-outline"} label="Messages" onPress={() => void openExternal("message")} colors={colors} family={Platform.OS === "ios" ? "ion" : "material"} />
          <ExternalAction icon="whatsapp" label="WhatsApp" onPress={() => void openExternal("whatsapp")} colors={colors} family="material" />
          <ExternalAction icon="mail-outline" label="Email" onPress={() => void openExternal("email")} colors={colors} />
          <ExternalAction icon="ellipsis-horizontal" label="More" onPress={() => void openExternal("more")} colors={colors} />
        </ScrollView>
        </Animated.ScrollView>
        </GestureDetector>
      </Animated.View>
      </GestureDetector>
    </Animated.View>
    </KeyboardAvoidingView>
    {toast ? (
      <View
        pointerEvents="none"
        style={[styles.toast, { top: insets.top + 10 }]}
        accessibilityLiveRegion="polite"
      >
        <Ionicons name="checkmark-circle" size={18} color="#D6E27A" />
        <Text style={styles.toastText}>{toast}</Text>
      </View>
    ) : null}
    <View pointerEvents={finderVisible ? "auto" : "none"} style={[styles.finderOverlay, { opacity: finderVisible ? 1 : 0 }]}>
      <KeyboardAvoidingView style={styles.finderKeyboard} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}><View style={styles.finderScrim}><View style={[styles.finder, { backgroundColor: colors.surface }]}>
        <View style={styles.head}><View><Text style={[styles.title, { color: colors.bone }]}>Find friends</Text><Text style={[styles.preview, { color: colors.muted }]}>Search by name or username</Text></View><Pressable onPress={() => setFinderVisible(false)} hitSlop={12}><Ionicons name="close" size={26} color={colors.muted} /></Pressable></View>
        <View style={[styles.searchBox, { backgroundColor: colors.ink }]}><Ionicons name="search" size={20} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void findFriends()} placeholder="Search people" placeholderTextColor={colors.subtle} style={[styles.searchInput, { color: colors.bone }]} returnKeyType="search" /><Pressable onPress={() => void findFriends()}><Text style={[styles.searchButton, { color: colors.success }]}>Search</Text></Pressable></View>
        <ScrollView style={styles.results} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.resultsContent}>{searching ? <Text style={[styles.empty, { color: colors.muted }]}>Searching…</Text> : results.length ? results.map((user) => <View key={user.uid} style={styles.resultRow}>{user.avatarUri ? <Image cachePolicy="memory-disk" source={{ uri: user.avatarUri }} style={styles.resultAvatar} /> : <View style={[styles.resultAvatar, styles.fallback]}><Text style={{ color: colors.successInk, fontWeight: "800" }}>{(user.displayName || user.username || "U").slice(0, 1).toUpperCase()}</Text></View>}<View style={styles.resultCopy}><Text style={[styles.findTitle, { color: colors.bone }]}>{user.displayName || user.username}</Text><Text style={[styles.findSubtitle, { color: colors.muted }]}>@{user.username}</Text></View><Pressable onPress={() => void requestFriend(user)} disabled={requested[user.uid]} style={[styles.addButton, { backgroundColor: requested[user.uid] ? `${colors.bone}18` : colors.success }]}><Text style={{ color: requested[user.uid] ? colors.muted : colors.successInk, fontWeight: "800" }}>{requested[user.uid] ? "Sent" : "Add"}</Text></Pressable></View>) : <Text style={[styles.empty, { color: colors.muted }]}>{query ? "No people found yet." : "Search for someone to add."}</Text>}</ScrollView>
      </View></View></KeyboardAvoidingView>
    </View>
    </GestureHandlerRootView>
  </Modal>;
}

function ExternalAction({ icon, label, onPress, colors, family = "ion" }: { icon: keyof typeof Ionicons.glyphMap | keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; colors: ReturnType<typeof useColors>; family?: "ion" | "material" }) {
  return <Pressable onPress={onPress} style={styles.externalAction} accessibilityRole="button" accessibilityLabel={label}><View style={[styles.externalIcon, { backgroundColor: `${colors.bone}16` }]}>{family === "material" ? <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={23} color={colors.bone} /> : <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={22} color={colors.bone} />}</View><Text style={[styles.externalLabel, { color: colors.muted }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" },
  keyboardRoot: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 30, paddingTop: 14, minHeight: 390 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerSearch: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800" },
  preview: { marginTop: 5, fontSize: 14 },
  input: { marginTop: 16, borderRadius: 14, minHeight: 48, paddingHorizontal: 14, fontSize: 14 },
  sectionLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginTop: 20 },
  rail: { gap: 16, paddingTop: 14, paddingBottom: 2 },
  friend: { width: 70, alignItems: "center", gap: 5 },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarSelected: { borderWidth: 3, borderColor: "#D6E27A" },
  selectedBadge: { position: "absolute", right: -2, bottom: -2, width: 19, height: 19, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#16140F" },
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#D6E27A" },
  name: { fontSize: 11, textAlign: "center" },
  sendButton: { marginTop: 16, minHeight: 48, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  sendButtonText: { fontSize: 15, fontWeight: "800" },
  findFriends: { marginTop: 12, borderWidth: 1, borderRadius: 16, minHeight: 70, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  findIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  findCopy: { flex: 1, gap: 3 },
  findTitle: { fontSize: 15, fontWeight: "800" },
  findSubtitle: { fontSize: 12 },
  emptyFriends: { marginTop: 14, fontSize: 13 },
  externalRail: { gap: 18, paddingTop: 14 },
  externalAction: { width: 60, alignItems: "center", gap: 6 },
  externalIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  externalLabel: { fontSize: 10, textAlign: "center" },
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 30,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: "#16140F",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  toastText: { fontSize: 14, fontWeight: "700", color: "#F4F0E6" },
  finderOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 },
  finderKeyboard: { flex: 1 },
  finderScrim: { flex: 1, justifyContent: "center", padding: 18, backgroundColor: "rgba(0,0,0,0.7)" },
  finder: { borderRadius: 24, padding: 20, maxHeight: "88%" },
  searchBox: { marginTop: 18, minHeight: 48, borderRadius: 14, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15 },
  searchButton: { fontWeight: "800", paddingLeft: 5 },
  results: { marginTop: 12 },
  resultsContent: { paddingBottom: 8 },
  resultRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11 },
  resultAvatar: { width: 44, height: 44, borderRadius: 22 },
  resultCopy: { flex: 1, gap: 3 },
  addButton: { minWidth: 58, minHeight: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", paddingHorizontal: 13 },
  empty: { textAlign: "center", paddingVertical: 30, fontSize: 14 },
});

export default FriendShareSheet;
