import { Image } from "expo-image";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Linking, Modal, PanResponder, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { createFriendChat, listFriends, sendFriendMessage, uploadFriendAttachment } from "../lib/friendChat";
import { searchUsers, sendFriendRequest, type PublicUser } from "../lib/friends";
import { useColors } from "../lib/theme";

export type FriendSharePayload = { kind: "listing" | "mirror"; id?: string; title: string; deepLink: string; imageUri?: string; previewText?: string };

type FriendShareSheetProps = {
  visible: boolean;
  payload: FriendSharePayload | null;
  onClose: () => void;
  onExternalShare: () => void;
};

export function FriendShareSheet({ visible, payload, onClose, onExternalShare }: FriendShareSheetProps) {
  const colors = useColors();
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [finderVisible, setFinderVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const translateY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = translateY.interpolate({ inputRange: [0, 360], outputRange: [1, 0], extrapolate: "clamp" });

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(0);
    setFinderVisible(false);
    setQuery("");
    setResults([]);
    void listFriends().then(setFriends).catch(() => setFriends([]));
  }, [visible, translateY]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => { if (gesture.dy > 0) translateY.setValue(gesture.dy); },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 120 || gesture.vy > 1.2) {
        Animated.timing(translateY, { toValue: 640, duration: 180, useNativeDriver: true }).start(onClose);
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      }
    },
  }), [onClose, translateY]);

  async function shareTo(friend: PublicUser) {
    if (!payload) return;
    setBusy(friend.uid);
    try {
      const id = await createFriendChat(friend.uid);
      let photoUrl = "";
      if (payload.imageUri) {
        const base64 = await FileSystem.readAsStringAsync(payload.imageUri, { encoding: FileSystem.EncodingType.Base64 });
        photoUrl = await uploadFriendAttachment(base64, "image/jpeg");
      }
      await sendFriendMessage(id, `${message.trim() ? `${message.trim()}\n\n` : ""}${payload.previewText || `Check this out: ${payload.title}`}\n${payload.deepLink}`, photoUrl);
      setMessage("");
      Alert.alert("Shared", `Sent to ${friend.displayName || `@${friend.username}`}.`);
      onClose();
    } catch (e) {
      Alert.alert("Couldn’t share", e instanceof Error ? e.message : "Try again.");
    } finally { setBusy(null); }
  }

  async function findFriends() {
    const term = query.trim();
    if (!term) { setResults([]); return; }
    setSearching(true);
    try { setResults(await searchUsers(term)); } catch (e) { Alert.alert("Couldn’t find friends", e instanceof Error ? e.message : "Try again."); }
    finally { setSearching(false); }
  }

  async function requestFriend(user: PublicUser) {
    try { await sendFriendRequest(user.uid); setRequested((current) => ({ ...current, [user.uid]: true })); }
    catch (e) { Alert.alert("Couldn’t send request", e instanceof Error ? e.message : "Try again."); }
  }

  async function openExternal(kind: "copy" | "message" | "whatsapp" | "email" | "more") {
    if (!payload) return;
    const text = `${payload.previewText || `Check this out: ${payload.title}`}\n${payload.deepLink}`;
    if (kind === "more") { await Share.share({ message: text, title: payload.title }); return; }
    const urls: Record<Exclude<typeof kind, "copy" | "more">, string> = {
      message: `sms:&body=${encodeURIComponent(text)}`,
      whatsapp: `whatsapp://send?text=${encodeURIComponent(text)}`,
      email: `mailto:?subject=${encodeURIComponent(payload.title)}&body=${encodeURIComponent(text)}`,
    };
    if (kind === "copy") { await Share.share({ message: text, title: payload.title }); return; }
    const url = urls[kind];
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else await Share.share({ message: text, title: payload.title });
  }

  if (!payload) return null;
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
    <Animated.View style={[styles.scrim, { opacity: backdropOpacity }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close share sheet" />
      <Animated.View style={[styles.sheet, { backgroundColor: colors.surface, transform: [{ translateY }] }]}>
        <View {...pan.panHandlers} style={styles.dragArea} accessibilityRole="adjustable" accessibilityLabel="Drag down to close">
          <View style={[styles.handle, { backgroundColor: colors.subtle }]} />
        </View>
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.bone }]}>Share with friends</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close share sheet" hitSlop={12}><Ionicons name="close" size={26} color={colors.muted} /></Pressable>
        </View>
        <Text style={[styles.preview, { color: colors.muted }]} numberOfLines={2}>{payload.title}</Text>
        <TextInput value={message} onChangeText={setMessage} placeholder="Add a message (optional)" placeholderTextColor={colors.subtle} style={[styles.input, { backgroundColor: colors.ink, color: colors.bone }]} maxLength={300} />
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>FRIENDS</Text>
        {friends.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>{friends.map((friend) => <Pressable key={friend.uid} onPress={() => void shareTo(friend)} disabled={Boolean(busy)} style={styles.friend} accessibilityRole="button" accessibilityLabel={`Share with ${friend.displayName || friend.username}`}>
          {friend.avatarUri ? <Image source={{ uri: friend.avatarUri }} style={styles.avatar} contentFit="cover" /> : <View style={[styles.avatar, styles.fallback]}><Text style={{ color: colors.successInk, fontWeight: "800" }}>{(friend.displayName || friend.username || "U").slice(0, 1).toUpperCase()}</Text></View>}
          <Text style={[styles.name, { color: colors.bone }]} numberOfLines={1}>{busy === friend.uid ? "…" : friend.displayName || `@${friend.username}`}</Text>
        </Pressable>)}</ScrollView> : <Pressable onPress={() => setFinderVisible(true)} style={[styles.findFriends, { borderColor: `${colors.bone}35`, backgroundColor: `${colors.ink}88` }]} accessibilityRole="button" accessibilityLabel="Find friends">
          <View style={[styles.findIcon, { backgroundColor: colors.success }]}><Ionicons name="person-add" size={19} color={colors.successInk} /></View><View style={styles.findCopy}><Text style={[styles.findTitle, { color: colors.bone }]}>Find friends</Text><Text style={[styles.findSubtitle, { color: colors.muted }]}>Search people to share with</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>SHARE TO</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.externalRail}>
          <ExternalAction icon="copy-outline" label="Copy link" onPress={() => void openExternal("copy")} colors={colors} />
          <ExternalAction icon="chatbubble-ellipses-outline" label="Messages" onPress={() => void openExternal("message")} colors={colors} />
          <ExternalAction icon="logo-whatsapp" label="WhatsApp" onPress={() => void openExternal("whatsapp")} colors={colors} />
          <ExternalAction icon="mail-outline" label="Email" onPress={() => void openExternal("email")} colors={colors} />
          <ExternalAction icon="ellipsis-horizontal" label="More" onPress={() => void openExternal("more")} colors={colors} />
        </ScrollView>
      </Animated.View>
    </Animated.View>
    <View pointerEvents={finderVisible ? "auto" : "none"} style={[styles.finderOverlay, { opacity: finderVisible ? 1 : 0 }]}>
      <View style={styles.finderScrim}><View style={[styles.finder, { backgroundColor: colors.surface }]}>
        <View style={styles.head}><View><Text style={[styles.title, { color: colors.bone }]}>Find friends</Text><Text style={[styles.preview, { color: colors.muted }]}>Search by name or username</Text></View><Pressable onPress={() => setFinderVisible(false)} hitSlop={12}><Ionicons name="close" size={26} color={colors.muted} /></Pressable></View>
        <View style={[styles.searchBox, { backgroundColor: colors.ink }]}><Ionicons name="search" size={20} color={colors.muted} /><TextInput autoFocus value={query} onChangeText={setQuery} onSubmitEditing={() => void findFriends()} placeholder="Search people" placeholderTextColor={colors.subtle} style={[styles.searchInput, { color: colors.bone }]} returnKeyType="search" /><Pressable onPress={() => void findFriends()}><Text style={[styles.searchButton, { color: colors.success }]}>Search</Text></Pressable></View>
        <ScrollView style={styles.results}>{searching ? <Text style={[styles.empty, { color: colors.muted }]}>Searching…</Text> : results.length ? results.map((user) => <View key={user.uid} style={styles.resultRow}>{user.avatarUri ? <Image source={{ uri: user.avatarUri }} style={styles.resultAvatar} /> : <View style={[styles.resultAvatar, styles.fallback]}><Text style={{ color: colors.successInk, fontWeight: "800" }}>{(user.displayName || user.username || "U").slice(0, 1).toUpperCase()}</Text></View>}<View style={styles.resultCopy}><Text style={[styles.findTitle, { color: colors.bone }]}>{user.displayName || user.username}</Text><Text style={[styles.findSubtitle, { color: colors.muted }]}>@{user.username}</Text></View><Pressable onPress={() => void requestFriend(user)} disabled={requested[user.uid]} style={[styles.addButton, { backgroundColor: requested[user.uid] ? `${colors.bone}18` : colors.success }]}><Text style={{ color: requested[user.uid] ? colors.muted : colors.successInk, fontWeight: "800" }}>{requested[user.uid] ? "Sent" : "Add"}</Text></Pressable></View>) : <Text style={[styles.empty, { color: colors.muted }]}>{query ? "No people found yet." : "Search for someone to add."}</Text>}</ScrollView>
      </View></View>
    </View>
  </Modal>;
}

function ExternalAction({ icon, label, onPress, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  return <Pressable onPress={onPress} style={styles.externalAction} accessibilityRole="button" accessibilityLabel={label}><View style={[styles.externalIcon, { backgroundColor: `${colors.bone}16` }]}><Ionicons name={icon} size={22} color={colors.bone} /></View><Text style={[styles.externalLabel, { color: colors.muted }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 30, paddingTop: 4, minHeight: 390 },
  dragArea: { alignItems: "center", paddingVertical: 9 },
  handle: { width: 42, height: 5, borderRadius: 4 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontWeight: "800" },
  preview: { marginTop: 5, fontSize: 14 },
  input: { marginTop: 16, borderRadius: 14, minHeight: 48, paddingHorizontal: 14, fontSize: 14 },
  sectionLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginTop: 20 },
  rail: { gap: 16, paddingTop: 14, paddingBottom: 2 },
  friend: { width: 70, alignItems: "center", gap: 5 },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#D6E27A" },
  name: { fontSize: 11, textAlign: "center" },
  findFriends: { marginTop: 12, borderWidth: 1, borderRadius: 16, minHeight: 70, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  findIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  findCopy: { flex: 1, gap: 3 },
  findTitle: { fontSize: 15, fontWeight: "800" },
  findSubtitle: { fontSize: 12 },
  externalRail: { gap: 18, paddingTop: 14 },
  externalAction: { width: 60, alignItems: "center", gap: 6 },
  externalIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  externalLabel: { fontSize: 10, textAlign: "center" },
  finderOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 },
  finderScrim: { flex: 1, justifyContent: "center", padding: 18, backgroundColor: "rgba(0,0,0,0.7)" },
  finder: { borderRadius: 24, padding: 20, maxHeight: "76%" },
  searchBox: { marginTop: 18, minHeight: 48, borderRadius: 14, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15 },
  searchButton: { fontWeight: "800", paddingLeft: 5 },
  results: { marginTop: 12 },
  resultRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11 },
  resultAvatar: { width: 44, height: 44, borderRadius: 22 },
  resultCopy: { flex: 1, gap: 3 },
  addButton: { minWidth: 58, minHeight: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", paddingHorizontal: 13 },
  empty: { textAlign: "center", paddingVertical: 30, fontSize: 14 },
});

export default FriendShareSheet;
