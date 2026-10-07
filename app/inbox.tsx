import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, FlatList, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OrbitLoader, useMinHold } from "../components/OrbitLoader";
import { BrandVerifiedMark } from "../components/VerifiedMark";
import { getBrand, useBrands } from "../lib/brands";
import { markSeen, unreadFor, useInbox, type ChatThread } from "../lib/chat";
import { useUvel } from "../lib/store";
import { useColors, useResolvedAppearance, type Colors } from "../lib/theme";
import * as Haptics from "../lib/haptics";
import { useAlertCenter, markAlertRead, type AlertEvent } from "../lib/alerts";
import { useActivityNotifications, markActivityNotificationRead, type ActivityNotification } from "../lib/activityNotifications";
import { listFriendNotifications, markFriendNotificationRead, respondFriendRequest, searchUsers, sendFriendRequest, unfriendFriend, useFriendNotifications, type FriendNotification, type PublicUser } from "../lib/friends";
import { blockFriend, createFriendChat, deleteFriendChat, getCachedFriendInbox, refreshFriendInbox, restoreFriendInboxCache, subscribeFriendInbox, unblockFriend, friendMessagePreview, type FriendChatPreview } from "../lib/friendChat";
import { BlockedAvatar } from "../components/BlockedAvatar";

type Filter = "All" | "Unread" | "Selling" | "Buying";
type InboxMode = "Messages" | "Activity";
type FriendPanelMode = "friends" | "messages" | "notifications" | "discover";
type FriendTab = "friends" | "requests";
type ActivityTab = "friends" | "requests";
type NotificationTab = "messages" | "activity" | null;
type FriendAction = "unfriend" | "block" | "unblock" | "delete";
type SheetNotification =
  | { source: "friend"; id: string; at: number; item: FriendNotification }
  | { source: "activity"; id: string; at: number; item: ActivityNotification }
  | { source: "alert"; id: string; at: number; item: AlertEvent };
const FILTERS: Filter[] = ["All", "Unread", "Selling", "Buying"];
const MIN_REFRESH_MS = 1100;

function timestampMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return Date.parse(String(value || "")) || 0;
}

function when(ms: number) {
  const min = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.round(hr / 24)}d`;
}

export default function Inbox() {
  const colors = useColors();
  const appearance = useResolvedAppearance();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const { uid } = useUvel();
  useBrands();
  const me = uid || "me";
  const threads = useInbox(me);
  const [mode, setMode] = useState<InboxMode>("Messages");
  const [activityTab, setActivityTab] = useState<ActivityTab>("friends");
  const [filter, setFilter] = useState<Filter>("All");
  const [searchTab, setSearchTab] = useState<NotificationTab>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const refreshTriggered = useRef(false);
  const [friendSearchOpen, setFriendSearchOpen] = useState(false);
  const [friendPanelMode, setFriendPanelMode] = useState<FriendPanelMode>("friends");
  const [notificationTab, setNotificationTab] = useState<NotificationTab>(null);
  const [friendTab, setFriendTab] = useState<FriendTab>("friends");
  const [friendTerm, setFriendTerm] = useState("");
  const [discoveryTerm, setDiscoveryTerm] = useState("");
  const [friendResults, setFriendResults] = useState<PublicUser[]>([]);
  const [friendSentIds, setFriendSentIds] = useState<Set<string>>(() => new Set());
  const friendNotifications = useFriendNotifications(uid || "me");
  const { events: alertEvents } = useAlertCenter(uid || "");
  const activityNotifications = useActivityNotifications(uid || "guest");
  const [friendBusy, setFriendBusy] = useState(false);
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const [friendError, setFriendError] = useState("");
  const [friendNotice, setFriendNotice] = useState("");
  const [friendActionTarget, setFriendActionTarget] = useState<{ chat: FriendChatPreview; user?: PublicUser; otherUid: string } | null>(null);
  const [friends, setFriends] = useState<PublicUser[]>(() => getCachedFriendInbox(me)?.friends || []);
  const [friendChats, setFriendChats] = useState<FriendChatPreview[]>(() => getCachedFriendInbox(me)?.chats || []);
  useEffect(() => {
    let active = true;
    void restoreFriendInboxCache(me).then((snapshot) => {
      if (!active || !snapshot) return;
      setFriends(snapshot.friends);
      setFriendChats(snapshot.chats);
    });
    const stop = subscribeFriendInbox(me, (snapshot) => {
      if (!active) return;
      setFriends(snapshot.friends);
      setFriendChats(snapshot.chats);
    });
    return () => { active = false; stop(); };
  }, [me]);

  async function runFriendSearch() {
    const term = discoveryTerm.trim();
    if (term.length < 2) {
      setFriendResults([]);
      setFriendError("Enter at least 2 characters to search.");
      return;
    }
    setFriendBusy(true);
    setFriendError("");
    setFriendNotice("");
    setFriendResults([]);
    try { setFriendResults(await searchUsers(term)); } catch (e) { console.warn("Friend search failed", e); setFriendError("Couldn’t load friend results. Please try again shortly."); }
    finally { setFriendBusy(false); }
  }

  async function addFriend(user: PublicUser) {
    if (friendSentIds.has(user.uid)) return;
    setFriendBusy(true);
    setFriendError("");
    try {
      await sendFriendRequest(user.uid);
      setFriendSentIds((current) => new Set(current).add(user.uid));
      setFriendNotice(`Request sent to ${user.displayName || `@${user.username}`}. They need to accept it before you become friends.`);
    }
    catch (e) { setFriendError(e instanceof Error ? e.message : "Couldn’t send request."); }
    finally { setFriendBusy(false); }
  }

  async function respondToFriendRequest(item: FriendNotification, action: "accepted" | "declined") {
    if (requestBusy) return;
    setRequestBusy(item.requestId);
    setFriendError("");
    try {
      await respondFriendRequest(item.requestId, action);
      void markFriendNotificationRead(me, item.id).catch(() => undefined);
      if (action === "accepted") {
        const snapshot = await refreshFriendInbox(me);
        setFriends(snapshot.friends);
        setFriendChats(snapshot.chats);
      }
    } catch (e) {
      setFriendError(e instanceof Error ? e.message : `Couldn’t ${action === "accepted" ? "add" : "decline"} that request.`);
    } finally {
      setRequestBusy(null);
    }
  }

  async function openFriendChat(user: PublicUser) {
    try { const conversationId = await createFriendChat(user.uid); router.push({ pathname: "/friends/chat/[id]", params: { id: conversationId, name: user.displayName || user.username, username: user.username, avatarUri: user.avatarUri || "" } }); }
    catch (e) { setFriendError(e instanceof Error ? e.message : "Couldn’t open friend chat."); }
  }
  const closeFriendPanel = useCallback(() => {
    Keyboard.dismiss();
    setFriendSheetExpanded(false);
    setFriendSearchOpen(false);
    setFriendResults([]);
    setSearchTab(null);
    setSearchQuery("");
  }, []);
  const friendSheetDragY = useMemo(() => new Animated.Value(0), []);
  const [friendSheetExpanded, setFriendSheetExpanded] = useState(false);
  const friendSheetPan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_event, gesture) => friendSheetDragY.setValue(Math.max(-180, Math.min(800, gesture.dy))),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy < -80 || gesture.vy < -0.85) {
        setFriendSheetExpanded(true);
        Animated.spring(friendSheetDragY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
      } else if (gesture.dy > 120 || gesture.vy > 0.9) {
        setFriendSheetExpanded(false);
        Animated.timing(friendSheetDragY, { toValue: 800, duration: 180, useNativeDriver: true }).start(({ finished }) => {
          if (finished) { friendSheetDragY.setValue(0); closeFriendPanel(); }
        });
      } else {
        Animated.spring(friendSheetDragY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
      }
    },
  }), [closeFriendPanel, friendSheetDragY]);
  useEffect(() => { if (friendSearchOpen) { friendSheetDragY.setValue(0); setFriendSheetExpanded(false); } }, [friendSearchOpen, friendSheetDragY]);
  const onRefresh = useCallback(async () => {
    const startedAt = Date.now();
    setRefreshing(true);
    try {
      const [snapshot, notifications] = await Promise.all([refreshFriendInbox(me), listFriendNotifications(me)]);
      setFriends(snapshot.friends);
      setFriendChats(snapshot.chats);
      void notifications;
    } catch {
      // Keep the last cached inbox visible when refresh is temporarily offline.
    } finally {
      const remaining = MIN_REFRESH_MS - (Date.now() - startedAt);
      if (remaining > 0) await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      setRefreshing(false);
    }
  }, [me]);
  const onScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = event.nativeEvent.contentOffset.y;
    if (y > -10) refreshTriggered.current = false;
    if (y < -48 && !refreshing && !refreshTriggered.current) {
      refreshTriggered.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      void onRefresh();
    }
  }, [onRefresh, refreshing]);
  const orbitOn = useMinHold(refreshing, MIN_REFRESH_MS);
  const pendingFriendRequests = useMemo(() => friendNotifications.filter((item) => item.kind === "friend_request" && !item.readAt), [friendNotifications]);
  const offerNotifications = useMemo(() => activityNotifications.filter((item) => item.kind.startsWith("offer_")), [activityNotifications]);
  const activityOnlyNotifications = useMemo(() => activityNotifications.filter((item) => !item.kind.startsWith("offer_")), [activityNotifications]);
  const unreadMessageCount = threads.reduce((total, thread) => total + unreadFor(thread, me), 0) + offerNotifications.filter((item) => !item.read).length;
  const unreadActivityCount = friendNotifications.filter((item) => !item.readAt).length + activityOnlyNotifications.filter((item) => !item.read).length + alertEvents.filter((item) => !item.read).length;
  const unreadNotifications = unreadMessageCount + unreadActivityCount;

  const visible = useMemo(() => threads.filter((t) => {
    const selling = t.sellerId === me || (t.recipientIds || []).includes(me);
    const buying = t.buyerId === me;
    if (filter === "Selling" && !selling) return false;
    if (filter === "Buying" && !buying) return false;
    if (filter === "Unread" && !unreadFor(t, me)) return false;
    return true;
  }), [threads, filter, me]);

  function openActivityFriendChat(chat: FriendChatPreview, user: PublicUser | undefined, _otherUid: string) {
    const blocked = Boolean(chat.blockedByMe);
    router.push({ pathname: "/friends/chat/[id]", params: { id: chat.id, name: blocked ? "Blocked" : user?.displayName || user?.username || "Friend", username: blocked ? "" : user?.username || "", avatarUri: blocked ? "" : user?.avatarUri || "", blockedInitial: blocked ? chat.blockedInitial || "U" : "" } });
  }

  async function performFriendAction(action: FriendAction, target: { chat: FriendChatPreview; user?: PublicUser; otherUid: string }) {
    try {
      if (action === "unfriend") await unfriendFriend(target.otherUid);
      else if (action === "block") await blockFriend(target.otherUid);
      else if (action === "unblock") await unblockFriend(target.otherUid);
      else await deleteFriendChat(target.chat.id);
      const snapshot = await refreshFriendInbox(me);
      setFriends(snapshot.friends);
      setFriendChats(snapshot.chats);
    } catch {
      Alert.alert("Couldn’t update this conversation", "Please try again when you have a connection.");
    }
  }

  function chooseFriendAction(action: FriendAction) {
    const target = friendActionTarget;
    if (!target) return;
    setFriendActionTarget(null);
    if (action === "unblock") { void performFriendAction(action, target); return; }
    const name = target.chat.blockedByMe ? "this contact" : target.user?.displayName || target.user?.username || "this friend";
    const content = action === "unfriend"
      ? { title: "Remove friend?", body: `${name} will disappear from both friends and recent friend activity.`, confirm: "Remove" }
      : action === "block"
        ? { title: "Block friend?", body: `Block ${name}? Their chat will no longer show their profile details or last message.`, confirm: "Block" }
        : { title: "Delete chat?", body: "This clears the conversation from your chat list and removes its older messages from your view. The other person’s copy stays available to them.", confirm: "Delete chat" };
    Alert.alert(content.title, content.body, [
      { text: "Cancel", style: "cancel" },
      { text: content.confirm, style: "destructive", onPress: () => { void performFriendAction(action, target); } },
    ]);
  }

  function openActivityNotification(item: ActivityNotification) {
    void markActivityNotificationRead(me, item.id);
    closeFriendPanel();
    if (item.kind === "offer_accepted" && item.lookId && item.offerId) { router.push({ pathname: "/checkout/[id]", params: { id: item.lookId, offerId: item.offerId } }); return; }
    if (["offer_received", "offer_declined", "offer_expired"].includes(item.kind) && item.lookId && item.threadId) { router.push({ pathname: "/ask/[id]", params: { id: item.lookId, threadId: item.threadId } }); return; }
    if ((item.kind === "mirror_ready" || item.kind === "mirror_failed") && item.mirrorJobId) { router.push({ pathname: "/mirror", params: { jobId: item.mirrorJobId } }); return; }
    if (item.target === "saved") router.push("/saved-looks");
    else if (item.lookId) router.push({ pathname: "/closet/[id]", params: { id: item.lookId } });
  }

  function openAlertNotification(item: AlertEvent) {
    void markAlertRead(me, item.id);
    closeFriendPanel();
    if (item.source === "immersive") router.push({ pathname: "/immersive-shopping", params: { listingId: item.listingId } });
    else router.push({ pathname: "/closet/[id]", params: { id: item.listingId } });
  }

  function openMessageNotification(thread: ChatThread) {
    void markSeen(thread.id, me);
    closeFriendPanel();
    router.push({ pathname: "/ask/[id]", params: { id: thread.pieceId, threadId: thread.id, pieceName: thread.pieceName, piecePhoto: thread.piecePhoto, piecePriceCents: String(thread.piecePriceCents), brandId: thread.brandId || "" } });
  }

  const empty =
    filter === "Selling"
      ? "Asks on your listings land here."
      : filter === "Buying"
        ? "When you ask a seller, it lands here."
        : "When someone asks about a listing, it lands here.";

  return (
    <View style={styles.page}>
      <StatusBar style={appearance === "dark" ? "light" : "dark"} />
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn}>
          <Text style={styles.navBack}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>Inbox</Text>
        <View style={styles.navActions}>
        <Pressable onPress={() => { setFriendPanelMode("messages"); setSearchTab(null); setSearchQuery(""); setFriendSearchOpen(true); setFriendError(""); }} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Search Messages or Activity"><Text style={styles.searchTxt}>⌕</Text></Pressable>
        <Pressable
          onPress={() => { if (friendPanelMode === "notifications" && friendSearchOpen) closeFriendPanel(); else { setFriendPanelMode("notifications"); setNotificationTab(null); setFriendSheetExpanded(false); setFriendSearchOpen(true); } }}
          hitSlop={12}
          style={styles.bell}
          accessibilityRole="button"
          accessibilityLabel={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ""}`}
        >
          <Text style={styles.bellTxt}>🔔</Text>
          {unreadNotifications ? <View style={styles.badge}><Text style={styles.badgeTxt}>{unreadNotifications > 9 ? "9+" : unreadNotifications}</Text></View> : null}
        </Pressable>
        </View>
      </View>

      <FriendSheet
        visible={friendSearchOpen}
        mode={friendPanelMode}
        notificationTab={notificationTab}
        setNotificationTab={setNotificationTab}
        uid={me}
        messageThreads={threads}
        messageUnreadCount={unreadMessageCount}
        activityUnreadCount={unreadActivityCount}
        expanded={friendSheetExpanded}
        onOpenMessageThread={openMessageNotification}
        friendTab={friendTab}
        setFriendTab={setFriendTab}
        searchTab={searchTab}
        setSearchTab={setSearchTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activityChats={friendChats}
        onOpenActivitySearchChat={openActivityFriendChat}
        onClose={closeFriendPanel}
        onModeChange={setFriendPanelMode}
        friends={friends}
        notifications={friendNotifications}
        activityNotifications={activityNotifications}
        alertEvents={alertEvents}
        onOpenActivityNotification={openActivityNotification}
        onOpenAlertNotification={openAlertNotification}
        onMarkFriendNotificationRead={(item) => { void markFriendNotificationRead(me, item.id).catch(() => undefined); }}
        friendTerm={friendTerm}
        setFriendTerm={setFriendTerm}
        discoveryTerm={discoveryTerm}
        setDiscoveryTerm={setDiscoveryTerm}
        friendResults={friendResults}
        friendSentIds={friendSentIds}
        friendBusy={friendBusy}
        requestBusy={requestBusy}
        friendError={friendError}
        friendNotice={friendNotice}
        onSearchUsers={runFriendSearch}
        onAddFriend={addFriend}
        onRespond={respondToFriendRequest}
        onOpenChat={openFriendChat}
        colors={colors}
        styles={styles}
        insets={insets}
        panHandlers={friendSheetPan.panHandlers}
        dragY={friendSheetDragY}
      />
      {friendActionTarget ? <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={() => setFriendActionTarget(null)}>
        <View style={styles.friendSheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFriendActionTarget(null)} accessibilityRole="button" accessibilityLabel="Close friend actions" />
          <View style={[styles.friendPanel, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.sheetDragArea}><View style={styles.sheetHandle} /></View>
            <Text style={styles.friendPanelTitle}>{friendActionTarget.chat.blockedByMe ? "Blocked contact" : friendActionTarget.user?.displayName || friendActionTarget.user?.username || "Friend options"}</Text>
            <Pressable style={styles.friendActionRow} onPress={() => chooseFriendAction("unfriend")}><Text style={styles.friendActionText}>Remove friend</Text></Pressable>
            <Pressable style={styles.friendActionRow} onPress={() => chooseFriendAction(friendActionTarget.chat.blockedByMe ? "unblock" : "block")}><Text style={[styles.friendActionText, styles.friendActionDanger]}>{friendActionTarget.chat.blockedByMe ? "Unblock" : "Block"}</Text></Pressable>
            <Pressable style={styles.friendActionRow} onPress={() => chooseFriendAction("delete")}><Text style={[styles.friendActionText, styles.friendActionDanger]}>Delete chat</Text></Pressable>
            <Pressable style={styles.friendActionCancel} onPress={() => setFriendActionTarget(null)}><Text style={styles.friendActionCancelText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal> : null}

      <View style={styles.modeToggle}>
        {(["Messages", "Activity"] as InboxMode[]).map((item) => <Pressable key={item} onPress={() => setMode(item)} style={[styles.modeButton, mode === item && styles.modeButtonOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === item }}><Text style={[styles.modeText, mode === item && styles.modeTextOn]}>{item}</Text></Pressable>)}
      </View>
      {mode === "Activity" ? <View style={styles.activityTabs} accessibilityRole="tablist">
        {(["friends", "requests"] as ActivityTab[]).map((tab) => <Pressable key={tab} onPress={() => setActivityTab(tab)} style={[styles.activityTab, activityTab === tab && styles.activityTabOn]} accessibilityRole="tab" accessibilityState={{ selected: activityTab === tab }}><Text style={[styles.activityTabText, activityTab === tab && styles.activityTabTextOn]}>{tab === "friends" ? "Friends" : `Requests${pendingFriendRequests.length ? ` · ${pendingFriendRequests.length}` : ""}`}</Text></Pressable>)}
      </View> : null}

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
          ListFooterComponent={null}
          alwaysBounceVertical
          bounces
          scrollEventThrottle={16}
          onScroll={onScroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          style={styles.list}
        />
      </> : activityTab === "friends" ? <ActivityView friends={friends} friendChats={friendChats} uid={me} onOpenFriends={() => { setFriendPanelMode("friends"); setFriendTab("friends"); setFriendSearchOpen(true); setFriendError(""); }} onFindFriends={() => { setFriendPanelMode("discover"); setDiscoveryTerm(""); setFriendResults([]); setFriendError(""); setFriendNotice(""); setFriendSheetExpanded(false); setFriendSearchOpen(true); }} onOpenChat={openActivityFriendChat} onFriendActions={(chat, user, otherUid) => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined); setFriendActionTarget({ chat, user, otherUid }); }} colors={colors} styles={styles} onScroll={onScroll} orbitOn={orbitOn} /> : <ActivityRequestsView requests={pendingFriendRequests} requestBusy={requestBusy} onRespond={respondToFriendRequest} onScroll={onScroll} orbitOn={orbitOn} styles={styles} />}
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

function FriendSheet({ visible, mode, friendTab, setFriendTab, notificationTab, setNotificationTab, searchTab, setSearchTab, searchQuery, setSearchQuery, uid, messageThreads, activityChats, messageUnreadCount, activityUnreadCount, expanded, onOpenMessageThread, onOpenActivitySearchChat, onClose, onModeChange, friends, notifications, activityNotifications, alertEvents, onOpenActivityNotification, onOpenAlertNotification, onMarkFriendNotificationRead, friendTerm, setFriendTerm, discoveryTerm, setDiscoveryTerm, friendResults, friendSentIds, friendBusy, requestBusy, friendError, friendNotice, onSearchUsers, onAddFriend, onRespond, onOpenChat, colors, styles, insets, panHandlers, dragY }: {
  visible: boolean; mode: FriendPanelMode; friendTab: FriendTab; setFriendTab: (tab: FriendTab) => void; notificationTab: NotificationTab; setNotificationTab: (tab: NotificationTab) => void; searchTab: NotificationTab; setSearchTab: (tab: NotificationTab) => void; searchQuery: string; setSearchQuery: (query: string) => void; uid: string; messageThreads: ChatThread[]; activityChats: FriendChatPreview[]; messageUnreadCount: number; activityUnreadCount: number; expanded: boolean; onOpenMessageThread: (thread: ChatThread) => void; onOpenActivitySearchChat: (chat: FriendChatPreview, user: PublicUser | undefined, otherUid: string) => void; onClose: () => void; onModeChange: (mode: FriendPanelMode) => void;
  friends: PublicUser[]; notifications: FriendNotification[]; activityNotifications: ActivityNotification[]; alertEvents: AlertEvent[]; onOpenActivityNotification: (item: ActivityNotification) => void; onOpenAlertNotification: (item: AlertEvent) => void; onMarkFriendNotificationRead: (item: FriendNotification) => void; friendTerm: string; setFriendTerm: (value: string) => void; discoveryTerm: string; setDiscoveryTerm: (value: string) => void;
  friendResults: PublicUser[]; friendSentIds: Set<string>; friendBusy: boolean; requestBusy: string | null; friendError: string; friendNotice: string; onSearchUsers: () => Promise<void>; onAddFriend: (user: PublicUser) => Promise<void>; onRespond: (item: FriendNotification, action: "accepted" | "declined") => Promise<void>; onOpenChat: (user: PublicUser) => Promise<void>;
  colors: Colors; styles: ReturnType<typeof make>; insets: { bottom: number }; panHandlers: ReturnType<typeof PanResponder.create>["panHandlers"]; dragY: Animated.Value;
}) {
  const pending = notifications.filter((item) => item.kind === "friend_request" && !item.readAt);
  const visibleFriends = friends.filter((user) => `${user.displayName} ${user.username}`.toLowerCase().includes(friendTerm.trim().toLowerCase()));
  const messageThreadsSorted = [...messageThreads].sort((a, b) => b.lastAt - a.lastAt);
  const searchNeedle = searchQuery.trim().toLowerCase();
  const messageSearchResults = searchNeedle ? messageThreadsSorted.filter((thread) => [thread.lastText, thread.pieceName, thread.brandName, thread.sellerName, thread.buyerName].filter(Boolean).join(" ").toLowerCase().includes(searchNeedle)) : [];
  const activitySearchResults = searchNeedle ? [...activityChats].filter((chat) => {
    if (chat.blockedByMe || chat.blockedByThem || chat.hidden) return false;
    const otherUid = chat.participantIds.find((id) => id !== uid) || "";
    const user = friends.find((entry) => entry.uid === otherUid);
    return `${user?.displayName || ""} ${user?.username || ""} ${friendMessagePreview(chat.lastText)}`.toLowerCase().includes(searchNeedle);
  }).sort((a, b) => timestampMs(b.lastAt) - timestampMs(a.lastAt)) : [];
  const messageActivityItems = activityNotifications.filter((item) => item.kind.startsWith("offer_"));
  const messageActivityRows: SheetNotification[] = messageActivityItems.map((item) => ({ source: "activity", id: item.id, at: item.at, item }));
  const activityRows: SheetNotification[] = [
    ...notifications.map((item) => ({ source: "friend" as const, id: item.id, at: timestampMs(item.createdAt), item })),
    ...activityNotifications.filter((item) => !item.kind.startsWith("offer_")).map((item) => ({ source: "activity" as const, id: item.id, at: item.at, item })),
    ...alertEvents.map((item) => ({ source: "alert" as const, id: item.id, at: item.at, item })),
  ].sort((a, b) => b.at - a.at);
  const title = mode === "messages" ? "Search Inbox" : mode === "notifications" ? "Notifications" : mode === "discover" ? "Find people" : "Your friends";
  const requestRows = (items: FriendNotification[]) => items.map((item) => <View key={item.id} style={styles.sheetPersonRow}>
    <Avatar user={item.actor} /><View style={{ flex: 1 }}><Text style={styles.requestText}>{item.actor.displayName || `@${item.actor.username}`}</Text><Text style={styles.usernameTxt}>@{item.actor.username}</Text>
      <View style={styles.requestActions}><Pressable disabled={requestBusy === item.requestId} onPress={() => void onRespond(item, "declined")}><Text style={styles.declineTxt}>Decline</Text></Pressable><Pressable disabled={Boolean(requestBusy)} onPress={() => void onRespond(item, "accepted")}><Text style={styles.acceptTxt}>{requestBusy === item.requestId ? "Adding…" : "Accept"}</Text></Pressable></View>
    </View>
  </View>);
  const renderNotificationRow = (entry: SheetNotification) => {
    if (entry.source === "friend") {
      const item = entry.item;
      const rowTitle = item.kind === "friend_request" ? `${item.actor.displayName || `@${item.actor.username}`} sent you a friend request` : item.kind === "friend_added" ? `${item.actor.displayName || `@${item.actor.username}`} became your friend` : `${item.actor.displayName || `@${item.actor.username}`} accepted your friend request`;
      return <View key={`friend:${entry.id}`} style={[styles.notificationRow, !item.readAt && styles.notificationUnread]}><Avatar user={item.actor} /><View style={{ flex: 1 }}><Pressable disabled={item.kind === "friend_request"} onPress={() => onMarkFriendNotificationRead(item)}><Text style={styles.requestText}>{rowTitle}</Text><Text style={styles.usernameTxt}>{item.kind === "friend_request" && !item.readAt ? "Respond to request" : `Friend activity · ${when(entry.at)}`}</Text></Pressable>{item.kind === "friend_request" && !item.readAt ? <View style={styles.requestActions}><Pressable disabled={requestBusy === item.requestId} onPress={() => void onRespond(item, "declined")}><Text style={styles.declineTxt}>Decline</Text></Pressable><Pressable disabled={Boolean(requestBusy)} onPress={() => void onRespond(item, "accepted")}><Text style={styles.acceptTxt}>{requestBusy === item.requestId ? "Adding…" : "Accept"}</Text></Pressable></View> : null}</View></View>;
    }
    if (entry.source === "activity") {
      const item = entry.item;
      return <Pressable key={`activity:${entry.id}`} onPress={() => onOpenActivityNotification(item)} style={[styles.notificationRow, !item.read && styles.notificationUnread]}>{item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.notificationThumb} contentFit="cover" /> : <View style={styles.notificationIcon}><Text style={styles.notificationIconText}>✦</Text></View>}<View style={{ flex: 1 }}><Text style={styles.requestText}>{item.title}</Text><Text style={styles.usernameTxt} numberOfLines={2}>{item.body}</Text><Text style={styles.notificationTime}>{when(entry.at)}</Text></View></Pressable>;
    }
    const item = entry.item;
    return <Pressable key={`alert:${entry.id}`} onPress={() => onOpenAlertNotification(item)} style={[styles.notificationRow, !item.read && styles.notificationUnread]}>{item.photo ? <Image source={{ uri: item.photo }} style={styles.notificationThumb} contentFit="cover" /> : <View style={styles.notificationIcon}><Text style={styles.notificationIconText}>↗</Text></View>}<View style={{ flex: 1 }}><Text style={styles.requestText}>{item.title}</Text><Text style={styles.usernameTxt} numberOfLines={2}>{item.body}</Text><Text style={styles.notificationTime}>{when(entry.at)}</Text></View></Pressable>;
  };
  return <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
    <View style={styles.friendSheetBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close friends panel" />
      <KeyboardAvoidingView style={styles.friendSheetKeyboardDock} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Animated.View style={[styles.friendPanel, { maxHeight: expanded ? "94%" : "86%", minHeight: expanded ? "70%" : undefined, paddingBottom: insets.bottom + 16, transform: [{ translateY: dragY }] }]}>
        <View style={styles.sheetDragArea} {...panHandlers}><View style={styles.sheetHandle} /></View>
        <View style={styles.friendPanelHead}>
          {mode === "discover" ? <Pressable onPress={() => onModeChange("friends")} hitSlop={10}><Text style={styles.sheetBack}>‹</Text></Pressable> : null}
          <Text style={styles.friendPanelTitle}>{title}</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close panel"><Text style={styles.closeTxt}>×</Text></Pressable>
        </View>
        {mode === "messages" ? <>
          <View style={styles.notificationTabs} accessibilityRole="tablist">
            {(["messages", "activity"] as const).map((tab) => <Pressable key={`search:${tab}`} onPress={() => setSearchTab(tab)} style={[styles.notificationTab, searchTab === tab && styles.notificationTabOn]} accessibilityRole="tab" accessibilityState={{ selected: searchTab === tab }}><Text style={[styles.notificationTabText, searchTab === tab && styles.notificationTabTextOn]}>{tab === "messages" ? "Messages" : "Activity"}</Text></Pressable>)}
          </View>
          {searchTab === null ? <View style={styles.notificationPrompt}><Text style={styles.notificationPromptText}>Choose Messages or Activity to search.</Text></View> : <>
            <View style={styles.friendSearchRow}><TextInput key={searchTab} autoFocus value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={() => Keyboard.dismiss()} placeholder={searchTab === "messages" ? "Search messages" : "Search activity messages"} placeholderTextColor={colors.subtle} style={styles.friendInput} autoCapitalize="none" returnKeyType="search" accessibilityLabel={searchTab === "messages" ? "Search Messages" : "Search Activity"} /><Pressable onPress={() => setSearchQuery("")} style={styles.findBtn} accessibilityRole="button" accessibilityLabel="Clear search"><Text style={styles.findTxt}>Clear</Text></Pressable></View>
            {!searchNeedle ? <View style={styles.notificationPrompt}><Text style={styles.notificationPromptText}>Type a name, listing, or message to search.</Text></View> : <ScrollView style={[styles.sheetList, styles.notificationList]} keyboardShouldPersistTaps="handled">
              {searchTab === "messages" ? messageSearchResults.map((thread) => { const person = thread.brandName || (thread.buyerId === uid ? thread.sellerName : thread.buyerName) || "Uvel member"; return <Pressable key={`search-message:${thread.id}`} onPress={() => onOpenMessageThread(thread)} style={styles.notificationRow} accessibilityRole="button" accessibilityLabel={`Open message from ${person} about ${thread.pieceName}`}>{thread.piecePhoto ? <Image source={{ uri: thread.piecePhoto }} style={styles.notificationThumb} contentFit="cover" /> : <View style={styles.notificationIcon}><Text style={styles.notificationIconText}>✉</Text></View>}<View style={{ flex: 1 }}><Text style={styles.requestText} numberOfLines={1}>{person}</Text><Text style={styles.usernameTxt} numberOfLines={1}>{thread.pieceName}</Text><Text style={styles.usernameTxt} numberOfLines={2}>{thread.lastText || "New conversation"}</Text></View><Text style={styles.chatArrow}>›</Text></Pressable>; }) : activitySearchResults.map((chat) => { const otherUid = chat.participantIds.find((id) => id !== uid) || ""; const user = friends.find((entry) => entry.uid === otherUid); const person = user?.displayName || user?.username || "Friend"; return <Pressable key={`search-activity:${chat.id}`} onPress={() => { onClose(); onOpenActivitySearchChat(chat, user, otherUid); }} style={styles.notificationRow} accessibilityRole="button" accessibilityLabel={`Open activity conversation with ${person}`}><Avatar user={user || { uid: otherUid, username: "friend", displayName: "Friend" }} /><View style={{ flex: 1 }}><Text style={styles.requestText} numberOfLines={1}>{person}</Text><Text style={styles.usernameTxt} numberOfLines={2}>{friendMessagePreview(chat.lastText) || "Start chatting"}</Text><Text style={styles.notificationTime}>{when(timestampMs(chat.lastAt))}</Text></View><Text style={styles.chatArrow}>›</Text></Pressable>; })}
              {searchTab === "messages" && !messageSearchResults.length ? <Text style={styles.noFriends}>No message matches found.</Text> : null}{searchTab === "activity" && !activitySearchResults.length ? <Text style={styles.noFriends}>No activity messages match found.</Text> : null}
            </ScrollView>}
          </>}
        </> : null}
        {mode === "notifications" ? <>
          <View style={styles.notificationTabs} accessibilityRole="tablist">
            {(["messages", "activity"] as const).map((tab) => {
              const count = tab === "messages" ? messageUnreadCount : activityUnreadCount;
              return <Pressable key={tab} onPress={() => setNotificationTab(tab)} style={[styles.notificationTab, notificationTab === tab && styles.notificationTabOn]} accessibilityRole="tab" accessibilityState={{ selected: notificationTab === tab }}><Text style={[styles.notificationTabText, notificationTab === tab && styles.notificationTabTextOn]}>{tab === "messages" ? "Messages" : "Activity"}</Text>{count > 0 ? <View style={styles.notificationCategoryCount}><Text style={styles.notificationCategoryCountText}>{count > 9 ? "9+" : count}</Text></View> : null}</Pressable>;
            })}
          </View>
          {notificationTab === null ? <View style={styles.notificationPrompt}><Text style={styles.notificationPromptText}>Choose Messages or Activity to view your notifications.</Text></View> : notificationTab === "messages" ? <ScrollView style={[styles.sheetList, styles.notificationList]} keyboardShouldPersistTaps="handled">
            {messageThreadsSorted.map((thread) => {
              const unread = unreadFor(thread, uid);
              const person = thread.brandName || (thread.buyerId === uid ? thread.sellerName : thread.buyerName) || "Uvel member";
              return <Pressable key={`thread:${thread.id}`} onPress={() => onOpenMessageThread(thread)} style={[styles.notificationRow, unread > 0 && styles.notificationUnread]} accessibilityRole="button" accessibilityLabel={`Open message from ${person} about ${thread.pieceName}`}>
                {thread.piecePhoto ? <Image source={{ uri: thread.piecePhoto }} style={styles.notificationThumb} contentFit="cover" /> : <View style={styles.notificationIcon}><Text style={styles.notificationIconText}>✉</Text></View>}
                <View style={{ flex: 1 }}><Text style={styles.requestText} numberOfLines={1}>{person}</Text><Text style={styles.usernameTxt} numberOfLines={1}>{thread.pieceName} · {when(thread.lastAt)}</Text><Text style={styles.usernameTxt} numberOfLines={1}>{thread.lastText || "New conversation"}</Text></View>
                {unread > 0 ? <View style={styles.notificationCategoryCount}><Text style={styles.notificationCategoryCountText}>{unread > 9 ? "9+" : unread}</Text></View> : null}
              </Pressable>;
            })}
            {messageActivityRows.map(renderNotificationRow)}
            {!messageThreadsSorted.length && !messageActivityRows.length ? <Text style={styles.noFriends}>No messages yet.</Text> : null}
          </ScrollView> : <ScrollView style={[styles.sheetList, styles.notificationList]} keyboardShouldPersistTaps="handled">{activityRows.length ? activityRows.map(renderNotificationRow) : <Text style={styles.noFriends}>You’re all caught up.</Text>}</ScrollView>}
        </> : null}
        {mode === "friends" ? <>
          <View style={styles.friendTabs}>
            <Pressable onPress={() => setFriendTab("friends")} style={[styles.friendTab, friendTab === "friends" && styles.friendTabOn]} accessibilityRole="tab" accessibilityState={{ selected: friendTab === "friends" }}><Text style={[styles.friendTabText, friendTab === "friends" && styles.friendTabTextOn]}>Friends</Text></Pressable>
            <Pressable onPress={() => setFriendTab("requests")} style={[styles.friendTab, friendTab === "requests" && styles.friendTabOn]} accessibilityRole="tab" accessibilityState={{ selected: friendTab === "requests" }}><Text style={[styles.friendTabText, friendTab === "requests" && styles.friendTabTextOn]}>Requests{pending.length ? ` · ${pending.length}` : ""}</Text></Pressable>
          </View>
          {friendTab === "friends" ? <>
            <View style={styles.friendSearchRow}><TextInput value={friendTerm} onChangeText={setFriendTerm} placeholder="Search your friends" placeholderTextColor={colors.subtle} style={styles.friendInput} autoCapitalize="none" returnKeyType="search" /></View>
            <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
              {visibleFriends.map((user) => <Pressable key={user.uid} onPress={() => { onClose(); void onOpenChat(user); }} style={styles.sheetPersonRow} accessibilityRole="button" accessibilityLabel={`Chat with ${user.displayName || user.username}`}><Avatar user={user} /><View style={{ flex: 1 }}><Text style={styles.requestText}>{user.displayName || "Uvel member"}</Text><Text style={styles.usernameTxt}>@{user.username}</Text></View><Text style={styles.chatArrow}>›</Text></Pressable>)}
              {!visibleFriends.length ? <Text style={styles.noFriends}>{friendTerm.trim() ? "No friends match that search." : "You haven’t added any friends yet."}</Text> : null}
            </ScrollView>
          </> : <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">{requestRows(pending)}{!pending.length ? <Text style={styles.noFriends}>No pending friend requests.</Text> : null}</ScrollView>}
        </> : null}
        {mode === "discover" ? <>
          <View style={styles.friendSearchRow}><TextInput autoFocus value={discoveryTerm} onChangeText={(value) => { setDiscoveryTerm(value); }} onSubmitEditing={() => { Keyboard.dismiss(); void onSearchUsers(); }} placeholder="Name or username" placeholderTextColor={colors.subtle} style={styles.friendInput} autoCapitalize="none" returnKeyType="search" /><Pressable onPress={() => { Keyboard.dismiss(); void onSearchUsers(); }} style={styles.findBtn} accessibilityRole="button" accessibilityLabel="Search for friends"><Text style={styles.findTxt}>{friendBusy ? "…" : "Search"}</Text></Pressable></View>
          {friendError ? <Text style={styles.friendError}>{friendError}</Text> : null}{friendNotice ? <Text style={styles.friendNotice}>{friendNotice}</Text> : null}
          <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">{friendResults.map((user) => { const sent = friendSentIds.has(user.uid); return <View key={user.uid} style={styles.sheetPersonRow}><Avatar user={user} /><View style={{ flex: 1 }}><Text style={styles.requestText}>{user.displayName || "Uvel member"}</Text><Text style={styles.usernameTxt}>@{user.username}</Text></View><Pressable disabled={sent || friendBusy} onPress={() => void onAddFriend(user)} style={[styles.addBtn, sent && styles.addBtnSent]}><Text style={[styles.addTxt, sent && styles.addTxtSent]}>{sent ? "Sent" : "Add"}</Text></Pressable></View>; })}{!friendResults.length && discoveryTerm.trim().length >= 2 && !friendBusy ? <Text style={styles.noFriends}>No users found.</Text> : null}</ScrollView>
        </> : null}
      </Animated.View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

function ActivityRequestsView({ requests, requestBusy, onRespond, onScroll, orbitOn, styles }: { requests: FriendNotification[]; requestBusy: string | null; onRespond: (item: FriendNotification, action: "accepted" | "declined") => Promise<void>; onScroll: (event: { nativeEvent: { contentOffset: { y: number } } }) => void; orbitOn: boolean; styles: ReturnType<typeof make> }) {
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.activityRequestContent} style={styles.activityScroll} alwaysBounceVertical bounces scrollEventThrottle={16} onScroll={onScroll}>
    {orbitOn ? <View style={styles.refreshOrbit}><OrbitLoader /></View> : null}
    <View style={styles.activityRequestHeader}><Text style={styles.activityTitle}>Friend requests</Text><Text style={styles.activityRequestSubtitle}>People who want to connect with you</Text></View>
    {requests.map((item) => <View key={item.id} style={styles.activityRequestRow}><Avatar user={item.actor} /><View style={{ flex: 1 }}><Text style={styles.requestText}>{item.actor.displayName || `@${item.actor.username}`}</Text><Text style={styles.usernameTxt}>@{item.actor.username}</Text></View><View style={styles.requestActions}><Pressable disabled={requestBusy === item.requestId} onPress={() => void onRespond(item, "declined")}><Text style={styles.declineTxt}>Decline</Text></Pressable><Pressable disabled={Boolean(requestBusy)} onPress={() => void onRespond(item, "accepted")}><Text style={styles.acceptTxt}>{requestBusy === item.requestId ? "Adding…" : "Accept"}</Text></Pressable></View></View>)}
    {!requests.length ? <Text style={styles.empty}>No pending friend requests.</Text> : null}
  </ScrollView>;
}

function ActivityView({ friends, friendChats, uid, onOpenFriends, onFindFriends, onOpenChat, onFriendActions, colors, styles, onScroll, orbitOn }: { friends: PublicUser[]; friendChats: FriendChatPreview[]; uid: string; onOpenFriends: () => void; onFindFriends: () => void; onOpenChat: (chat: FriendChatPreview, user: PublicUser | undefined, otherUid: string) => void; onFriendActions: (chat: FriendChatPreview, user: PublicUser | undefined, otherUid: string) => void; colors: Colors; styles: ReturnType<typeof make>; onScroll: (event: { nativeEvent: { contentOffset: { y: number } } }) => void; orbitOn: boolean }) {
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }} style={styles.activityScroll} alwaysBounceVertical bounces scrollEventThrottle={16} onScroll={onScroll}>
    {orbitOn ? <View style={styles.refreshOrbit}><OrbitLoader /></View> : null}
    <View style={styles.activityHeader}><Text style={styles.activityTitle}>Your circle</Text></View>
    {friends.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendRail}>{friends.map((user) => <Pressable key={user.uid} onPress={onOpenFriends} style={styles.friendBubble}><Avatar user={user} /><Text style={styles.friendBubbleName} numberOfLines={1}>{user.displayName || user.username}</Text></Pressable>)}</ScrollView> : null}
    <Text style={styles.activitySection}>RECENT CONVERSATIONS</Text>
    {friendChats.length ? friendChats.map((chat) => {
      const other = chat.participantIds.find((id) => id !== uid) || "";
      const user = friends.find((item) => item.uid === other);
      const unread = Number(chat.unreadBy?.[uid] || 0);
      const blocked = Boolean(chat.blockedByMe);
      return <Pressable key={chat.id} onPress={() => onOpenChat(chat, user, other)} onLongPress={() => onFriendActions(chat, user, other)} delayLongPress={430} style={styles.activityRow} accessibilityRole="button" accessibilityLabel={blocked ? "Blocked conversation. Hold for options." : `${user?.displayName || user?.username || "Friend"}, recent conversation. Hold for options.`}>
        {blocked ? <BlockedAvatar initial={chat.blockedInitial || user?.displayName || user?.username || "U"} size={52} backgroundColor={colors.neutral} textColor={colors.bone} slashColor={colors.danger} /> : <Avatar user={user || { uid: other, username: "friend", displayName: "Friend" }} />}
        <View style={{ flex: 1 }}><Text style={[styles.requestText, unread && !blocked ? { fontWeight: "900" } : null]}>{blocked ? "Blocked" : user?.displayName || user?.username || "Friend"}</Text><Text style={styles.usernameTxt} numberOfLines={1}>{blocked ? "Blocked" : friendMessagePreview(chat.lastText) || "Start chatting"}</Text></View>
        {!blocked && unread ? <View style={styles.chatUnread}><Text style={styles.chatUnreadTxt}>{unread > 9 ? "9+" : unread}</Text></View> : <Text style={styles.chatArrow}>›</Text>}
      </Pressable>;
    }) : <Text style={styles.empty}>Friend conversations will appear here.</Text>}
    {friends.length <= 5 ? <FindFriendsBanner onPress={onFindFriends} colors={colors} styles={styles} /> : null}
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
  return user.avatarUri ? <Image cachePolicy="memory-disk" source={{ uri: user.avatarUri }} style={{ width: 52, height: 52, borderRadius: 26 }} contentFit="cover" /> : <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#2A320E", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#D6E27A", fontWeight: "800", fontSize: 16 }}>{(user.displayName || user.username || "U").slice(0, 1).toUpperCase()}</Text></View>;
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
    navTitle: { color: colors.bone, fontSize: 18, fontWeight: "700" },
    navActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    searchTxt: { color: colors.bone, fontSize: 26, lineHeight: 28, fontWeight: "600", marginTop: -1 },
    bell: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    bellTxt: { fontSize: 16 },
    badge: { position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: "#E24B4B", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.ink },
    badgeTxt: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
    modeToggle: { marginHorizontal: 16, marginBottom: 12, padding: 3, borderRadius: 24, backgroundColor: `${colors.bone}10`, flexDirection: "row" },
    modeButton: { flex: 1, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
    modeButtonOn: { backgroundColor: colors.surface },
    modeText: { color: colors.muted, fontSize: 15, fontWeight: "700" },
    modeTextOn: { color: colors.bone },
    activityTabs: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: -2, marginBottom: 12 },
    activityTab: { minHeight: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: `${colors.bone}0D`, alignItems: "center", justifyContent: "center" },
    activityTabOn: { backgroundColor: `${colors.success}24` },
    activityTabText: { color: colors.muted, fontSize: 15, fontWeight: "700" },
    activityTabTextOn: { color: colors.success },
    friendSheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" },
    friendSheetKeyboardDock: { flex: 1, justifyContent: "flex-end" },
    friendPanel: { width: "100%", maxHeight: "86%", paddingHorizontal: 20, paddingTop: 6, backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderBottomWidth: 0, borderColor: `${colors.bone}24` },
    sheetDragArea: { height: 28, alignItems: "center", justifyContent: "center" },
    sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: `${colors.bone}55` },
    sheetBack: { color: colors.muted, fontSize: 30, lineHeight: 34, marginRight: 8 },
    friendPanelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, minHeight: 36 },
    friendPanelTitle: { color: colors.bone, fontWeight: "800", fontSize: 20, flex: 1 },
    closeTxt: { color: colors.muted, fontSize: 24 },
    friendTabs: { flexDirection: "row", gap: 8, padding: 4, borderRadius: 18, backgroundColor: `${colors.ink}CC`, marginBottom: 14 },
    friendTab: { flex: 1, minHeight: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    friendTabOn: { backgroundColor: colors.surface },
    friendTabText: { color: colors.muted, fontSize: 15, fontWeight: "700" },
    friendTabTextOn: { color: colors.bone },
    friendSearchRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
    friendInput: { flex: 1, minHeight: 50, borderRadius: 15, paddingHorizontal: 14, color: colors.bone, backgroundColor: colors.ink, fontSize: 16 },
    findBtn: { minHeight: 50, paddingHorizontal: 16, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.success },
    findTxt: { color: colors.successInk, fontWeight: "800", fontSize: 15 },
    friendError: { color: "#E24B4B", fontSize: 14, marginTop: 8 },
    friendNotice: { color: colors.success, fontSize: 14, lineHeight: 20, marginTop: 8 },
    sheetList: { flexGrow: 0, flexShrink: 1, maxHeight: 440 },
    sheetPersonRow: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}15` },
        notificationRow: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 14, paddingHorizontal: 8, borderRadius: 14 },
    notificationUnread: { backgroundColor: `${colors.success}12` },
    notificationTabs: { flexDirection: "row", gap: 8, padding: 4, borderRadius: 18, backgroundColor: `${colors.ink}CC`, marginBottom: 12 },
    notificationList: { maxHeight: 640 },
    notificationTab: { flex: 1, minHeight: 42, borderRadius: 14, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
    notificationTabOn: { backgroundColor: colors.surface },
    notificationTabText: { color: colors.muted, fontSize: 15, fontWeight: "700" },
    notificationTabTextOn: { color: colors.bone },
    notificationCategoryCount: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.success },
    notificationCategoryCountText: { color: colors.successInk, fontSize: 11, fontWeight: "900" },
    notificationPrompt: { minHeight: 150, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
    notificationPromptText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
    notificationThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.neutral },
    notificationIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.success}18` },
    notificationIconText: { color: colors.success, fontSize: 24, fontWeight: "800" },
    notificationTime: { color: colors.subtle, fontSize: 12, marginTop: 5 },
    friendActionRow: { minHeight: 54, justifyContent: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${colors.bone}18` },
    friendActionText: { color: colors.bone, fontSize: 16, fontWeight: "700" },
    friendActionDanger: { color: colors.danger },
    friendActionCancel: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 8, borderRadius: 15, backgroundColor: `${colors.bone}0C` },
    friendActionCancelText: { color: colors.muted, fontSize: 15, fontWeight: "700" },
    requestRow: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 12 },
    requestText: { color: colors.bone, fontWeight: "700", fontSize: 16 },
    usernameTxt: { color: colors.subtle, fontSize: 14, marginTop: 3 },
    requestActions: { flexDirection: "row", gap: 18, marginTop: 8 },
    declineTxt: { color: colors.muted, fontWeight: "700", fontSize: 14 },
    acceptTxt: { color: colors.success, fontWeight: "800", fontSize: 14 },
    addBtn: { borderRadius: 14, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: colors.success },
    addTxt: { color: colors.successInk, fontWeight: "800", fontSize: 14 },
    addBtnSent: { backgroundColor: `${colors.success}33` },
    addTxtSent: { color: colors.success },
    noFriends: { color: colors.muted, paddingVertical: 12 },
    sectionLabel: { color: colors.subtle, fontSize: 12, letterSpacing: 1.4, fontWeight: "800", marginTop: 14, marginBottom: 3 },
    chatArrow: { color: colors.success, fontSize: 30 },
    chatUnread: { minWidth: 26, height: 26, paddingHorizontal: 7, borderRadius: 13, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    chatUnreadTxt: { color: colors.successInk, fontSize: 12, fontWeight: "900" },
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
    findBanner: { marginHorizontal: 16, marginTop: 18, padding: 18, minHeight: 98, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.success}55`, flexDirection: "row", alignItems: "center", gap: 14 },
    findBannerIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#E5465E", alignItems: "center", justifyContent: "center" },
    findBannerIconText: { color: "#FFFFFF", fontSize: 28, lineHeight: 30 },
    findBannerCopy: { flex: 1 },
    findBannerTitle: { color: colors.bone, fontSize: 18, fontWeight: "800" },
    findBannerBody: { color: colors.muted, fontSize: 14, lineHeight: 19, marginTop: 4 },
    findBannerArrow: { color: colors.success, fontSize: 30 },
    activityScroll: { flex: 1 },
    activityHeader: { paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "flex-start", marginBottom: 14 },
    activityTitle: { color: colors.bone, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
    activityLink: { color: colors.muted, fontSize: 16, fontWeight: "700" },
    friendRail: { gap: 16, paddingHorizontal: 16, paddingBottom: 20 },
    friendBubble: { width: 72, alignItems: "center", gap: 7 },
    friendBubbleName: { color: colors.muted, fontSize: 13, textAlign: "center" },
    requestCard: { marginHorizontal: 16, padding: 16, minHeight: 88, borderRadius: 18, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    requestCardCopy: { flex: 1 },
    requestCardTitle: { color: colors.bone, fontSize: 17, fontWeight: "800" },
    requestCardBody: { color: colors.muted, fontSize: 13, marginTop: 4 },
    reviewBtn: { minHeight: 40, paddingHorizontal: 17, borderRadius: 20, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    reviewTxt: { color: colors.successInk, fontWeight: "800" },
    activitySection: { color: colors.subtle, fontSize: 12, letterSpacing: 1.5, fontWeight: "800", marginHorizontal: 16, marginTop: 26, marginBottom: 6 },
    activityRow: { flexDirection: "row", gap: 14, alignItems: "center", paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}15` },
    activityRequestContent: { paddingBottom: 28 },
    activityRequestHeader: { paddingHorizontal: 16, marginBottom: 10 },
    activityRequestSubtitle: { color: colors.muted, fontSize: 15, marginTop: 5 },
    activityRequestRow: { flexDirection: "row", gap: 14, alignItems: "center", paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}15` },
    empty: { color: colors.muted, padding: 24, lineHeight: 22, fontSize: 15 },
    refreshOrbit: { height: 62, alignItems: "center", justifyContent: "flex-start" },
    list: { flex: 1 },
    row: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 16,
      alignItems: "center",
    },
    thumb: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface },
    avatar: { alignItems: "center", justifyContent: "center" },
    avatarTxt: { color: colors.bone, fontWeight: "700", fontSize: 18 },
    line: { flexDirection: "row", alignItems: "center", gap: 8 },
    name: { flex: 1, color: colors.bone, fontWeight: "700", fontSize: 17 },
    time: { color: colors.subtle, fontSize: 13 },
    prev: { color: colors.subtle, marginTop: 4, fontSize: 15 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E24B4B" },
  });
}
