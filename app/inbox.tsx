import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OrbitLoader, useMinHold } from "../components/OrbitLoader";
import { BrandVerifiedMark } from "../components/VerifiedMark";
import { getBrand, useBrands } from "../lib/brands";
import { unreadFor, useInbox, type ChatThread } from "../lib/chat";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { respondFriendRequest, searchUsers, sendFriendRequest, subscribeFriendNotifications, type FriendNotification, type PublicUser } from "../lib/friends";
import { createFriendChat, listFriendChats, listFriends, type FriendChatPreview } from "../lib/friendChat";

type Filter = "All" | "Unread" | "Selling" | "Buying";
type InboxMode = "Messages" | "Activity";
const FILTERS: Filter[] = ["All", "Unread", "Selling", "Buying"];
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
  const [mode, setMode] = useState<InboxMode>("Messages");
  const [filter, setFilter] = useState<Filter>("All");
  const [conversationQuery, setConversationQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const refreshTriggered = useRef(false);
  const [friendSearchOpen, setFriendSearchOpen] = useState(false);
  const [friendPanelMode, setFriendPanelMode] = useState<"friends" | "messages">("friends");
  const [friendTerm, setFriendTerm] = useState("");
  const [friendResults, setFriendResults] = useState<PublicUser[]>([]);
  const [friendNotifications, setFriendNotifications] = useState<FriendNotification[]>([]);
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendError, setFriendError] = useState("");
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [friendChats, setFriendChats] = useState<FriendChatPreview[]>([]);
  useEffect(() => subscribeFriendNotifications(uid, setFriendNotifications), [uid]);
  useEffect(() => {
    void listFriends().then(setFriends).catch(() => setFriends([]));
    void listFriendChats().then(setFriendChats).catch(() => setFriendChats([]));
  }, [friendSearchOpen]);

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
  const onScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = event.nativeEvent.contentOffset.y;
    if (y > -10) refreshTriggered.current = false;
    if (y < -48 && !refreshing && !refreshTriggered.current) {
      refreshTriggered.current = true;
      void onRefresh();
    }
  }, [onRefresh, refreshing]);
  const orbitOn = useMinHold(refreshing, MIN_REFRESH_MS);

  const visible = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();
    return threads.filter((t) => {
      const selling = t.sellerId === me || (t.recipientIds || []).includes(me);
      const buying = t.buyerId === me;
      if (filter === "Selling" && !selling) return false;
      if (filter === "Buying" && !buying) return false;
      if (filter === "Unread" && !unreadFor(t, me)) return false;
      if (!query) return true;
      return [t.lastText, t.pieceName, t.brandName, t.sellerName, t.buyerName].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [conversationQuery, threads, filter, me]);

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
        <Pressable onPress={() => { setFriendPanelMode("messages"); setFriendSearchOpen(true); setFriendError(""); }} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Search Inbox"><Text style={styles.searchTxt}>⌕</Text></Pressable>
        <Pressable
          onPress={() => { if (!friendNotifications.length) Alert.alert("Notifications", "No friend requests yet."); else { setFriendPanelMode("friends"); setFriendSearchOpen(true); } }}
          hitSlop={12}
          style={styles.bell}
        >
          <Text style={styles.bellTxt}>🔔</Text>
        </Pressable>
        </View>
      </View>

      {friendSearchOpen ? <View style={styles.friendPanel}>
        <View style={styles.friendPanelHead}><Text style={styles.friendPanelTitle}>{friendPanelMode === "messages" ? "Search Inbox" : "Find friends"}</Text><Pressable onPress={() => { setFriendSearchOpen(false); setFriendResults([]); }} accessibilityRole="button" accessibilityLabel="Close search"><Text style={styles.closeTxt}>×</Text></Pressable></View>
        {friendPanelMode === "messages" ? <View style={styles.friendSearchRow}><TextInput autoFocus value={conversationQuery} onChangeText={setConversationQuery} onSubmitEditing={() => setFriendSearchOpen(false)} placeholder="People, listings, or messages" placeholderTextColor={colors.subtle} style={styles.friendInput} returnKeyType="search" /><Pressable onPress={() => setFriendSearchOpen(false)} style={styles.findBtn}><Text style={styles.findTxt}>Done</Text></Pressable></View> : <>
        <View style={styles.friendSearchRow}><TextInput value={friendTerm} onChangeText={setFriendTerm} onSubmitEditing={() => void runFriendSearch()} placeholder="Name or username" placeholderTextColor={colors.subtle} style={styles.friendInput} autoCapitalize="none" returnKeyType="search" /><Pressable onPress={() => void runFriendSearch()} style={styles.findBtn}><Text style={styles.findTxt}>{friendBusy ? "…" : "Search"}</Text></Pressable></View>
        {friendError ? <Text style={styles.friendError}>{friendError}</Text> : null}
        {friendNotifications.filter((item) => item.kind === "friend_request" && !item.readAt).map((item) => <View key={item.id} style={styles.requestRow}><Avatar user={item.actor} /><View style={{ flex: 1 }}><Text style={styles.requestText}>{item.actor.displayName || `@${item.actor.username}`} added you</Text><View style={styles.requestActions}><Pressable onPress={() => void respondFriendRequest(item.requestId, "declined")}><Text style={styles.declineTxt}>Decline</Text></Pressable><Pressable onPress={() => void respondFriendRequest(item.requestId, "accepted")}><Text style={styles.acceptTxt}>Add back</Text></Pressable></View></View></View>)}
        {friends.length ? <Text style={styles.sectionLabel}>YOUR FRIENDS</Text> : null}
        {friends.map((user) => <Pressable key={user.uid} onPress={() => void openFriendChat(user)} style={styles.requestRow} accessibilityRole="button" accessibilityLabel={`Chat with ${user.displayName || user.username}`}><Avatar user={user} /><View style={{ flex: 1 }}><Text style={styles.requestText}>{user.displayName || "Uvel member"}</Text><Text style={styles.usernameTxt}>@{user.username}</Text></View><Text style={styles.chatArrow}>›</Text></Pressable>)}
        {friendChats.length ? <Text style={styles.sectionLabel}>FRIEND CHATS</Text> : null}
        {friendChats.map((chat) => { const other = chat.participantIds.find((id) => id !== me) || ""; const user = friends.find((item) => item.uid === other); const unread = Number(chat.unreadBy?.[me] || 0); return <Pressable key={chat.id} onPress={() => router.push({ pathname: "/friends/chat/[id]", params: { id: chat.id, name: user?.displayName || user?.username || "Friend" } })} style={styles.requestRow} accessibilityRole="button"><Avatar user={user || { uid: other, username: "friend", displayName: "Friend" }} /><View style={{ flex: 1 }}><Text style={[styles.requestText, unread ? { fontWeight: "900" } : null]}>{user?.displayName || user?.username || "Friend"}</Text><Text style={styles.usernameTxt} numberOfLines={1}>{chat.lastText || "Start chatting"}</Text></View>{unread ? <View style={styles.chatUnread}><Text style={styles.chatUnreadTxt}>{unread}</Text></View> : <Text style={styles.chatArrow}>›</Text>}</Pressable>; })}
        {friendResults.map((user) => <View key={user.uid} style={styles.requestRow}><Avatar user={user} /><View style={{ flex: 1 }}><Text style={styles.requestText}>{user.displayName || "Uvel member"}</Text><Text style={styles.usernameTxt}>@{user.username}</Text></View><Pressable onPress={() => void addFriend(user)} style={styles.addBtn}><Text style={styles.addTxt}>Add</Text></Pressable></View>)}
        {!friendResults.length && !friendNotifications.some((item) => item.kind === "friend_request" && !item.readAt) && friendTerm.length >= 2 && !friendBusy ? <Text style={styles.noFriends}>No users found.</Text> : null}
        </>}
      </View> : null}

      <View style={styles.modeToggle}>
        {(["Messages", "Activity"] as InboxMode[]).map((item) => <Pressable key={item} onPress={() => setMode(item)} style={[styles.modeButton, mode === item && styles.modeButtonOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === item }}><Text style={[styles.modeText, mode === item && styles.modeTextOn]}>{item}</Text></Pressable>)}
      </View>

      {mode === "Messages" ? <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
          {FILTERS.map((f) => <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipOn]}><Text style={[styles.chipTxt, filter === f && styles.chipTxtOn]}>{f}</Text></Pressable>)}
        </ScrollView>
        {visible.length && visible.some((item) => item.lastFrom !== me && item.lastText) ? <View style={styles.priorityWrap}><Text style={styles.priorityLabel}>NEEDS YOUR REPLY</Text><PriorityCard thread={visible.find((item) => item.lastFrom !== me && item.lastText) as ChatThread} uid={me} colors={colors} /></View> : null}
        <FlatList
          data={visible}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <Row thread={item} uid={me} colors={colors} />}
          ListHeaderComponent={orbitOn ? <View style={styles.refreshOrbit}><OrbitLoader /></View> : null}
          ListEmptyComponent={<Text style={styles.empty}>{empty}</Text>}
          ListFooterComponent={friends.length <= 5 || visible.length === 0 ? <FindFriendsBanner onPress={() => { setFriendPanelMode("friends"); setFriendSearchOpen(true); setFriendError(""); }} colors={colors} styles={styles} /> : null}
          alwaysBounceVertical
          bounces
          scrollEventThrottle={16}
          onScroll={onScroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          style={styles.list}
        />
      </> : <ActivityView friends={friends} friendChats={friendChats} notifications={friendNotifications} uid={me} onOpenFriends={() => { setFriendPanelMode("friends"); setFriendSearchOpen(true); setFriendError(""); }} colors={colors} styles={styles} />}
    </View>
  );
}

function PriorityCard({ thread: t, uid, colors }: { thread: ChatThread; uid: string; colors: Colors }) {
  const styles = make(colors);
  const brand = t.brandId ? getBrand(t.brandId) : undefined;
  const who = brand?.name || t.sellerName || t.buyerName || "Uvel member";
  return <Pressable onPress={() => router.push({ pathname: "/ask/[id]", params: { id: t.pieceId, threadId: t.id, pieceName: t.pieceName, piecePhoto: t.piecePhoto, piecePriceCents: String(t.piecePriceCents), brandId: t.brandId || "" } })} style={styles.priorityCard} accessibilityRole="button" accessibilityLabel={`Reply to ${who}`}>
    {t.piecePhoto ? <Image source={{ uri: t.piecePhoto }} style={styles.priorityImage} contentFit="cover" /> : <View style={[styles.priorityImage, styles.avatar]}><Text style={styles.avatarTxt}>{who.slice(0, 1).toUpperCase()}</Text></View>}
    <View style={styles.priorityCopy}><Text style={styles.priorityName} numberOfLines={1}>{who}</Text><Text style={styles.priorityMessage} numberOfLines={1}>{t.lastText || t.pieceName}</Text><Text style={styles.priorityMeta} numberOfLines={1}>{t.pieceName}</Text></View><Text style={styles.priorityArrow}>›</Text>
  </Pressable>;
}

function FindFriendsBanner({ onPress, colors, styles }: { onPress: () => void; colors: Colors; styles: ReturnType<typeof make> }) {
  return <Pressable onPress={onPress} style={styles.findBanner} accessibilityRole="button" accessibilityLabel="Find friends">
    <View style={styles.findBannerIcon}><Text style={styles.findBannerIconText}>＋</Text></View><View style={styles.findBannerCopy}><Text style={styles.findBannerTitle}>Find friends</Text><Text style={styles.findBannerBody}>Connect with friends to buy, sell, and discover together.</Text></View><Text style={styles.findBannerArrow}>›</Text>
  </Pressable>;
}

function ActivityView({ friends, friendChats, notifications, uid, onOpenFriends, colors, styles }: { friends: PublicUser[]; friendChats: FriendChatPreview[]; notifications: FriendNotification[]; uid: string; onOpenFriends: () => void; colors: Colors; styles: ReturnType<typeof make> }) {
  const pending = notifications.filter((item) => item.kind === "friend_request" && !item.readAt);
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }} style={styles.activityScroll}>
    <View style={styles.activityHeader}><Text style={styles.activityTitle}>Your circle</Text><Pressable onPress={onOpenFriends}><Text style={styles.activityLink}>Friends ›</Text></Pressable></View>
    {friends.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendRail}>{friends.map((user) => <Pressable key={user.uid} onPress={onOpenFriends} style={styles.friendBubble}><Avatar user={user} /><Text style={styles.friendBubbleName} numberOfLines={1}>{user.displayName || user.username}</Text></Pressable>)}</ScrollView> : null}
    {pending.length ? <View style={styles.requestCard}><View style={styles.requestCardCopy}><Text style={styles.requestCardTitle}>Friend requests</Text><Text style={styles.requestCardBody}>{pending.length} waiting for you</Text></View><Pressable onPress={onOpenFriends} style={styles.reviewBtn}><Text style={styles.reviewTxt}>Review</Text></Pressable></View> : null}
    <Text style={styles.activitySection}>RECENT CONVERSATIONS</Text>
    {friendChats.length ? friendChats.map((chat) => { const other = chat.participantIds.find((id) => id !== uid) || ""; const user = friends.find((item) => item.uid === other); const unread = Number(chat.unreadBy?.[uid] || 0); return <Pressable key={chat.id} onPress={() => router.push({ pathname: "/friends/chat/[id]", params: { id: chat.id, name: user?.displayName || user?.username || "Friend" } })} style={styles.activityRow}><Avatar user={user || { uid: other, username: "friend", displayName: "Friend" }} /><View style={{ flex: 1 }}><Text style={[styles.requestText, unread ? { fontWeight: "900" } : null]}>{user?.displayName || user?.username || "Friend"}</Text><Text style={styles.usernameTxt} numberOfLines={1}>{chat.lastText || "Start chatting"}</Text></View>{unread ? <View style={styles.chatUnread}><Text style={styles.chatUnreadTxt}>{unread}</Text></View> : <Text style={styles.chatArrow}>›</Text>}</Pressable>; }) : <Text style={styles.empty}>Friend conversations will appear here.</Text>}
    {friends.length <= 5 ? <FindFriendsBanner onPress={onOpenFriends} colors={colors} styles={styles} /> : null}
  </ScrollView>;
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
        <Image cachePolicy="memory-disk" source={{ uri: brand.logoUri }} style={styles.thumb} contentFit="cover" />
      ) : t.piecePhoto ? (
        <Image cachePolicy="memory-disk" source={{ uri: t.piecePhoto }} style={styles.thumb} contentFit="cover" />
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
          {!iAmSeller ? <BrandVerifiedMark brand={brand} size={16} /> : null}
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
  return user.avatarUri ? <Image cachePolicy="memory-disk" source={{ uri: user.avatarUri }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" /> : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#2A320E", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#D6E27A", fontWeight: "800" }}>{(user.displayName || user.username || "U").slice(0, 1).toUpperCase()}</Text></View>;
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
    navActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: `${colors.bone}2E`,
      alignItems: "center",
      justifyContent: "center",
    },
    searchTxt: { color: colors.bone, fontSize: 26, lineHeight: 28, fontWeight: "600", marginTop: -1 },
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
    modeToggle: { marginHorizontal: 16, marginBottom: 14, padding: 3, borderRadius: 22, backgroundColor: `${colors.bone}10`, flexDirection: "row" },
    modeButton: { flex: 1, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    modeButtonOn: { backgroundColor: colors.surface },
    modeText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
    modeTextOn: { color: colors.bone },
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
    priorityWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6 },
    priorityLabel: { color: colors.subtle, fontSize: 10, letterSpacing: 1.5, fontWeight: "800", marginBottom: 8 },
    priorityCard: { minHeight: 82, borderRadius: 18, padding: 10, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: `${colors.success}55` },
    priorityImage: { width: 58, height: 58, borderRadius: 12, backgroundColor: `${colors.bone}12` },
    priorityCopy: { flex: 1 },
    priorityName: { color: colors.bone, fontSize: 15, fontWeight: "800" },
    priorityMessage: { color: colors.bone, fontSize: 13, marginTop: 3 },
    priorityMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
    priorityArrow: { color: colors.success, fontSize: 28, marginRight: 3 },
    findBanner: { marginHorizontal: 16, marginTop: 16, padding: 16, minHeight: 90, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.success}55`, flexDirection: "row", alignItems: "center", gap: 12 },
    findBannerIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    findBannerIconText: { color: colors.successInk, fontSize: 25, lineHeight: 26 },
    findBannerCopy: { flex: 1 },
    findBannerTitle: { color: colors.bone, fontSize: 16, fontWeight: "800" },
    findBannerBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
    findBannerArrow: { color: colors.success, fontSize: 28 },
    activityScroll: { flex: 1 },
    activityHeader: { paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    activityTitle: { color: colors.bone, fontSize: 27, fontWeight: "800", letterSpacing: -0.5 },
    activityLink: { color: colors.muted, fontSize: 14, fontWeight: "700" },
    friendRail: { gap: 14, paddingHorizontal: 16, paddingBottom: 18 },
    friendBubble: { width: 62, alignItems: "center", gap: 5 },
    friendBubbleName: { color: colors.muted, fontSize: 11, textAlign: "center" },
    requestCard: { marginHorizontal: 16, padding: 16, minHeight: 88, borderRadius: 18, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    requestCardCopy: { flex: 1 },
    requestCardTitle: { color: colors.bone, fontSize: 17, fontWeight: "800" },
    requestCardBody: { color: colors.muted, fontSize: 13, marginTop: 4 },
    reviewBtn: { minHeight: 40, paddingHorizontal: 17, borderRadius: 20, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    reviewTxt: { color: colors.successInk, fontWeight: "800" },
    activitySection: { color: colors.subtle, fontSize: 10, letterSpacing: 1.5, fontWeight: "800", marginHorizontal: 16, marginTop: 28, marginBottom: 4 },
    activityRow: { flexDirection: "row", gap: 12, alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}15` },
    empty: { color: colors.muted, padding: 24, lineHeight: 22, fontSize: 15 },
    refreshOrbit: { height: 58, alignItems: "center", justifyContent: "flex-start" },
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
