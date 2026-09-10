import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OrbitLoader, useMinHold } from "../components/OrbitLoader";
import { VerifiedMark } from "../components/VerifiedMark";
import { getBrand, useBrands } from "../lib/brands";
import { unreadFor, useInbox, type ChatThread } from "../lib/chat";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { respondFriendRequest, searchUsers, sendFriendRequest, subscribeFriendNotifications, type FriendNotification, type PublicUser } from "../lib/friends";
import { createFriendChat, listFriendChats, listFriends, type FriendChatPreview } from "../lib/friendChat";

type Filter = "All" | "Messages" | "Selling" | "Buying";
const FILTERS: Filter[] = ["All", "Messages", "Selling", "Buying"];
const MIN_REFRESH_MS = 1100;

function when(ms: number) {
  const min = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.round(hr / 24)}d`;
}

export default function Inbox() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const { uid } = useUvel();
  useBrands();
  const me = uid || "me";
  const threads = useInbox(me);
  const [filter, setFilter] = useState<Filter>("All");
  const [refreshing, setRefreshing] = useState(false);
  const [friendSearchOpen, setFriendSearchOpen] = useState(false);
  const [friendTerm, setFriendTerm] = useState("");
  const [friendResults, setFriendResults] = useState<PublicUser[]>([]);
  const [friendNotifications, setFriendNotifications] = useState<FriendNotification[]>([]);
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendError, setFriendError] = useState("");
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [friendChats, setFriendChats] = useState<FriendChatPreview[]>([]);
  useEffect(() => subscribeFriendNotifications(uid, setFriendNotifications), [uid]);
  useEffect(() => { if (friendSearchOpen) { void listFriends().then(setFriends).catch(() => undefined); void listFriendChats().then(setFriendChats).catch(() => undefined); } }, [friendSearchOpen]);

  async function runFriendSearch() {
    if (friendTerm.trim().length < 2) return;
    setFriendBusy(true);
    setFriendError("");
    try { setFriendResults(await searchUsers(friendTerm)); } catch (e) { setFriendError(e instanceof Error ? e.message : "Couldn’t search friends."); }
    finally { setFriendBusy(false); }
  }

  async function addFriend(user: PublicUser) {
    setFriendBusy(true);
    try { await sendFriendRequest(user.uid); setFriendResults((items) => items.filter((item) => item.uid !== user.uid)); }
    catch (e) { setFriendError(e instanceof Error ? e.message : "Couldn’t send request."); }
    finally { setFriendBusy(false); }
  }

  async function openFriendChat(user: PublicUser) {
    try { const conversationId = await createFriendChat(user.uid); router.push({ pathname: "/friends/chat/[id]", params: { id: conversationId, name: user.displayName || user.username } }); }
    catch (e) { setFriendError(e instanceof Error ? e.message : "Couldn’t open friend chat."); }
  }
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise<void>((resolve) => setTimeout(resolve, MIN_REFRESH_MS));
    setRefreshing(false);
  }, []);
  const orbitOn = useMinHold(refreshing, MIN_REFRESH_MS);

  const visible = useMemo(() => {
    return threads.filter((t) => {
      const selling = t.sellerId === me || (t.recipientIds || []).includes(me);
      const buying = t.buyerId === me;
      if (filter === "Selling") return selling;
      if (filter === "Buying") return buying;
      if (filter === "Messages") return Boolean(t.lastText);
      return true;
    });
  }, [threads, filter, me]);

  const empty =
    filter === "Selling"
      ? "Asks on your listings land here."
      : filter === "Buying"
        ? "When you ask a seller, it lands here."
        : "When someone asks about a listing, it lands here.";

  return (
    <View style={styles.page}>
      <StatusBar style={colors.ink === "#000000" ? "light" : "dark"} />
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn}>
          <Text style={styles.navBack}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>Inbox</Text>
        <View style={styles.navActions}>
        <Pressable onPress={() => { setFriendSearchOpen(true); setFriendError(""); }} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Find friends"><Text style={styles.searchTxt}>⌕</Text></Pressable>
        <Pressable
          onPress={() => { if (!friendNotifications.length) Alert.alert("Notifications", "No friend requests yet."); else setFriendSearchOpen(true); }}
          hitSlop={12}
          style={styles.bell}
        >
          <Text style={styles.bellTxt}>🔔</Text>
        </Pressable>
        </View>
      </View>

      {friendSearchOpen ? <View style={styles.friendPanel}>
        <View style={styles.friendPanelHead}><Text style={styles.friendPanelTitle}>Find friends</Text><Pressable onPress={() => { setFriendSearchOpen(false); setFriendResults([]); }} accessibilityRole="button" accessibilityLabel="Close friend search"><Text style={styles.closeTxt}>×</Text></Pressable></View>
        <View style={styles.friendSearchRow}><TextInput value={friendTerm} onChangeText={setFriendTerm} onSubmitEditing={() => void runFriendSearch()} placeholder="Name or username" placeholderTextColor={colors.subtle} style={styles.friendInput} autoCapitalize="none" returnKeyType="search" /><Pressable onPress={() => void runFriendSearch()} style={styles.findBtn}><Text style={styles.findTxt}>{friendBusy ? "…" : "Search"}</Text></Pressable></View>
        {friendError ? <Text style={styles.friendError}>{friendError}</Text> : null}
        {friendNotifications.filter((item) => item.kind === "friend_request" && !item.readAt).map((item) => <View key={item.id} style={styles.requestRow}><Avatar user={item.actor} /><View style={{ flex: 1 }}><Text style={styles.requestText}>{item.actor.displayName || `@${item.actor.username}`} added you</Text><View style={styles.requestActions}><Pressable onPress={() => void respondFriendRequest(item.requestId, "declined")}><Text style={styles.declineTxt}>Decline</Text></Pressable><Pressable onPress={() => void respondFriendRequest(item.requestId, "accepted")}><Text style={styles.acceptTxt}>Add back</Text></Pressable></View></View></View>)}
        {friends.length ? <Text style={styles.sectionLabel}>YOUR FRIENDS</Text> : null}
        {friends.map((user) => <Pressable key={user.uid} onPress={() => void openFriendChat(user)} style={styles.requestRow} accessibilityRole="button" accessibilityLabel={`Chat with ${user.displayName || user.username}`}><Avatar user={user} /><View style={{ flex: 1 }}><Text style={styles.requestText}>{user.displayName || "Uvel member"}</Text><Text style={styles.usernameTxt}>@{user.username}</Text></View><Text style={styles.chatArrow}>›</Text></Pressable>)}
        {friendChats.length ? <Text style={styles.sectionLabel}>FRIEND CHATS</Text> : null}
        {friendChats.map((chat) => { const other = chat.participantIds.find((id) => id !== me) || ""; const user = friends.find((item) => item.uid === other); const unread = Number(chat.unreadBy?.[me] || 0); return <Pressable key={chat.id} onPress={() => router.push({ pathname: "/friends/chat/[id]", params: { id: chat.id, name: user?.displayName || user?.username || "Friend" } })} style={styles.requestRow} accessibilityRole="button"><Avatar user={user || { uid: other, username: "friend", displayName: "Friend" }} /><View style={{ flex: 1 }}><Text style={[styles.requestText, unread ? { fontWeight: "900" } : null]}>{user?.displayName || user?.username || "Friend"}</Text><Text style={styles.usernameTxt} numberOfLines={1}>{chat.lastText || "Start chatting"}</Text></View>{unread ? <View style={styles.chatUnread}><Text style={styles.chatUnreadTxt}>{unread}</Text></View> : <Text style={styles.chatArrow}>›</Text>}</Pressable>; })}
        {friendResults.map((user) => <View key={user.uid} style={styles.requestRow}><Avatar user={user} /><View style={{ flex: 1 }}><Text style={styles.requestText}>{user.displayName || "Uvel member"}</Text><Text style={styles.usernameTxt}>@{user.username}</Text></View><Pressable onPress={() => void addFriend(user)} style={styles.addBtn}><Text style={styles.addTxt}>Add</Text></Pressable></View>)}
        {!friendResults.length && !friendNotifications.some((item) => item.kind === "friend_request" && !item.readAt) && friendTerm.length >= 2 && !friendBusy ? <Text style={styles.noFriends}>No users found.</Text> : null}
      </View> : null}

      <View style={styles.chipWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipScroll}
        >
          {FILTERS.map((f) => {
            const on = filter === f;
            return (
              <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <Row thread={item} uid={me} colors={colors} />}
        ListHeaderComponent={orbitOn ? <View style={styles.refreshOrbit}><OrbitLoader /></View> : null}
        ListEmptyComponent={<Text style={styles.empty}>{empty}</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="transparent" colors={["transparent"]} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        style={styles.list}
      />
    </View>
  );
}

function Row({
  thread: t,
  uid,
  colors,
}: {
  thread: ChatThread;
  uid: string;
  colors: Colors;
}) {
  const styles = make(colors);
  const brand = t.brandId ? getBrand(t.brandId) : undefined;
  const iAmSeller = t.sellerId === uid || (t.recipientIds || []).includes(uid);
  const who = !iAmSeller && (brand?.name || t.brandName) ? brand?.name || t.brandName || "Brand" : iAmSeller ? t.buyerName || "Buyer" : t.sellerName || "Seller";
  const you = t.lastFrom === uid || t.lastFrom === "me";
  const unread = unreadFor(t, uid);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/ask/[id]", params: { id: t.pieceId, threadId: t.id, pieceName: t.pieceName, piecePhoto: t.piecePhoto, piecePriceCents: String(t.piecePriceCents), brandId: t.brandId || "" } })}
      style={styles.row}
    >
      {brand?.logoUri ? (
        <Image source={{ uri: brand.logoUri }} style={styles.thumb} contentFit="cover" />
      ) : t.piecePhoto ? (
        <Image source={{ uri: t.piecePhoto }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.avatar]}>
          <Text style={styles.avatarTxt}>{who.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.line}>
          <Text style={[styles.name, unread ? { fontWeight: "800" } : null]} numberOfLines={1}>
            {who}
          </Text>
          {!iAmSeller && (brand?.verified || t.brandVerified) ? <VerifiedMark size={16} /> : null}
          {t.lastAt ? <Text style={styles.time}>{when(t.lastAt)}</Text> : null}
        </View>
        <Text style={[styles.prev, unread ? { color: colors.bone } : null]} numberOfLines={1}>
          {t.lastText ? `${you ? "You: " : ""}${t.lastText}` : t.pieceName}
        </Text>
      </View>
      {unread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

function Avatar({ user }: { user: PublicUser }) {
  return user.avatarUri ? <Image source={{ uri: user.avatarUri }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" /> : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#2A320E", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#D6E27A", fontWeight: "800" }}>{(user.displayName || user.username || "U").slice(0, 1).toUpperCase()}</Text></View>;
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    nav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 6,
      paddingBottom: 10,
    },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navBack: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    navTitle: { color: colors.bone, fontSize: 17, fontWeight: "700" },
    navActions: { flexDirection: "row", alignItems: "center", gap: 4 },
    iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    searchTxt: { color: colors.bone, fontSize: 28 },
    bell: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: `${colors.bone}2E`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    bellTxt: { fontSize: 16 },
    friendPanel: { marginHorizontal: 12, marginBottom: 12, padding: 14, borderRadius: 18, backgroundColor: colors.surface },
    friendPanelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    friendPanelTitle: { color: colors.bone, fontWeight: "800", fontSize: 17 },
    closeTxt: { color: colors.muted, fontSize: 24 },
    friendSearchRow: { flexDirection: "row", gap: 8 },
    friendInput: { flex: 1, minHeight: 42, borderRadius: 12, paddingHorizontal: 12, color: colors.bone, backgroundColor: colors.ink },
    findBtn: { paddingHorizontal: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.success },
    findTxt: { color: colors.successInk, fontWeight: "800" },
    friendError: { color: "#E24B4B", fontSize: 12, marginTop: 8 },
    requestRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 10 },
    requestText: { color: colors.bone, fontWeight: "700" },
    usernameTxt: { color: colors.subtle, fontSize: 12, marginTop: 2 },
    requestActions: { flexDirection: "row", gap: 16, marginTop: 6 },
    declineTxt: { color: colors.muted, fontWeight: "700" },
    acceptTxt: { color: colors.success, fontWeight: "800" },
    addBtn: { borderRadius: 12, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.success },
    addTxt: { color: colors.successInk, fontWeight: "800" },
    noFriends: { color: colors.muted, paddingVertical: 12 },
    sectionLabel: { color: colors.subtle, fontSize: 11, letterSpacing: 1.4, fontWeight: "800", marginTop: 12, marginBottom: 2 },
    chatArrow: { color: colors.success, fontSize: 26 },
    chatUnread: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    chatUnreadTxt: { color: colors.successInk, fontSize: 11, fontWeight: "900" },
    chipWrap: { flexGrow: 0, flexShrink: 0 },
    chipScroll: { flexGrow: 0 },
    chips: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, alignItems: "center" },
    chip: {
      height: 36,
      paddingHorizontal: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: `${colors.bone}47`,
      alignItems: "center",
      justifyContent: "center",
    },
    chipOn: { backgroundColor: colors.success, borderColor: colors.success },
    chipTxt: { color: colors.bone, fontWeight: "600", fontSize: 14 },
    chipTxtOn: { color: colors.successInk },
    empty: { color: colors.muted, padding: 24, lineHeight: 22, fontSize: 15 },
    refreshOrbit: { height: 148, alignItems: "center", justifyContent: "flex-start", paddingTop: 16 },
    list: { flex: 1 },
    row: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      alignItems: "center",
    },
    thumb: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface },
    avatar: { alignItems: "center", justifyContent: "center" },
    avatarTxt: { color: colors.bone, fontWeight: "700", fontSize: 18 },
    line: { flexDirection: "row", alignItems: "center", gap: 8 },
    name: { flex: 1, color: colors.bone, fontWeight: "700", fontSize: 16 },
    time: { color: colors.subtle, fontSize: 12 },
    prev: { color: colors.subtle, marginTop: 4, fontSize: 14 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E24B4B" },
  });
}
