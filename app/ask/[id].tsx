import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandVerifiedMark } from "../../components/VerifiedMark";
import { brandCheck, getBrand, inquiryRecipients, useBrands } from "../../lib/brands";
import { usd } from "../../lib/catalog";
import {
  clock,
  dayLabel,
  lastSeenLabel,
  blockUser,
  getThread,
  loadOlderMessages,
  listenMessages,
  listenThread,
  markSeen,
  openThread,
  reportConversation,
  readUserLite,
  sendChat,
  setTyping,
  updateOfferStatus,
  type ChatMsg,
  type ChatThread,
} from "../../lib/chat";
import { pickFromLibrary, takePhoto } from "../../lib/photo";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { getPiece, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";
import { useOrders } from "../../lib/orders";

export default function Ask() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { id: rawId, threadId: rawThreadId, orderId: rawOrderId, supportCaseId: rawSupportCaseId, pieceName: rawPieceName, piecePhoto: rawPiecePhoto, piecePriceCents: rawPiecePriceCents, brandId: rawBrandId } = useLocalSearchParams<{ id?: string | string[]; threadId?: string | string[]; orderId?: string | string[]; supportCaseId?: string | string[]; pieceName?: string | string[]; piecePhoto?: string | string[]; piecePriceCents?: string | string[]; brandId?: string | string[] }>();
  const param = (value?: string | string[]) => Array.isArray(value) ? value[0] || "" : value || "";
  const id = param(rawId);
  const routeThreadId = param(rawThreadId);
  const routeOrderId = param(rawOrderId);
  const routeSupportCaseId = param(rawSupportCaseId);
  const routePieceName = param(rawPieceName);
  const routePiecePhoto = param(rawPiecePhoto);
  const routePiecePriceCents = param(rawPiecePriceCents);
  const routeBrandId = param(rawBrandId);
  const app = useUvel();
  const pieces = useWardrobe();
  useBrands();
  const orders = useOrders();
  const storedThread = routeThreadId ? getThread(routeThreadId) : undefined;
  const livePiece = pieces.find((candidate) => candidate.id === id) || getPiece(id);
  const piece: ClosetPiece | undefined = livePiece || (typeof routePieceName === "string" && typeof routePiecePhoto === "string" && routePiecePhoto ? {
    id,
    photo: routePiecePhoto,
    photos: [routePiecePhoto],
    name: routePieceName,
    brand: "Unlabeled",
    category: "Accessories",
    color: "",
    size: "",
    condition: "",
    material: "",
    notes: "",
    listPriceCents: Number(routePiecePriceCents) || 0,
    originalPriceCents: Number(routePiecePriceCents) || 0,
    status: "listed",
    createdAt: Date.now(),
    brandId: typeof routeBrandId === "string" && routeBrandId ? routeBrandId : undefined,
  } : undefined);
  const brand = piece?.brandId ? getBrand(piece.brandId) : undefined;
  const [thread, setThread] = useState("");
  const [threadData, setThreadData] = useState<ChatThread | undefined>(undefined);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [offerOn, setOfferOn] = useState(false);
  const [offer, setOffer] = useState("");
  const [seen, setSeen] = useState("");
  const [place, setPlace] = useState("");
  const [sellerHandle, setSellerHandle] = useState("Seller");
  const [safety, setSafety] = useState(true);
  const [typing, setTypingOn] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<string | undefined>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [readOffset, setReadOffset] = useState(0);
  const draftReady = useRef(false);
  const [boxKey, setBoxKey] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mine = app.uid || "me";
  const activeThread = storedThread || threadData || (thread ? getThread(thread) : undefined);
  const linkedOrderId = routeOrderId || activeThread?.orderId;
  const linkedCaseId = routeSupportCaseId || activeThread?.supportCaseId;
  const supportOrder = linkedOrderId ? orders.find((order) => order.id === linkedOrderId) : undefined;
  const brandRecipients = brand ? (activeThread?.recipientIds?.length ? activeThread.recipientIds : inquiryRecipients(brand)) : [];
  const isTeamRecipient = Boolean(brand && brandRecipients.includes(mine));
  const isSellerSide = Boolean(activeThread && (activeThread.sellerId === mine || (activeThread.recipientIds || []).includes(mine))) || isTeamRecipient;
  const sellerId = activeThread?.sellerId || (brand ? brandRecipients[0] || brand.ownerId : piece?.ownerId && piece.ownerId !== app.uid ? piece.ownerId : piece?.ownerId || "");
  const otherId = isSellerSide ? activeThread?.buyerId || "" : sellerId && sellerId !== mine ? sellerId : "";

  useEffect(() => {
    if (!piece) return;
    const listedByMe = Boolean(piece.ownerId && piece.ownerId === app.uid);
    const handle =
      brand?.name ||
      (piece.ownerId && piece.ownerId !== app.uid && piece.ownerName) ||
      (listedByMe && piece.ownerName) ||
      (piece.brand && piece.brand !== "Unlabeled" ? piece.brand : "") ||
      "Seller";
    setSellerHandle(handle);
    const targetSeller = isSellerSide ? activeThread?.buyerId || "" : sellerId || piece.ownerId || "seller";
    const tid = routeThreadId || openThread({
      pieceId: piece.id,
      buyerId: activeThread?.buyerId || mine,
      sellerId: brand ? brandRecipients[0] || brand.ownerId : targetSeller,
      pieceName: piece.name,
      piecePhoto: piece.photo,
      piecePriceCents: piece.listPriceCents,
      sellerName: handle,
      buyerName: activeThread?.buyerName || app.displayName || "You",
      brandId: brand?.id,
      brandName: brand?.name,
      brandLogo: brand?.logoUri,
      brandVerified: brandCheck(brand) !== "none",
      recipientIds: brand ? brandRecipients : undefined,
      orderId: routeOrderId,
      supportCaseId: routeSupportCaseId,
      contextId: routeOrderId,
    });
    setThread(tid);
    const unsub = listenMessages(tid, (next) => {
      setMsgs(next);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
    });
    const unsubT = listenThread(tid, (t) => {
      setThreadData(t);
      const live = t.typingBy && t.typingBy !== mine && Date.now() - (t.typingAt || 0) < 3500;
      setTypingOn(Boolean(live));
    });
    markSeen(tid, mine);
    const tick = setInterval(() => markSeen(tid, mine), 4000);
    if (!brand && targetSeller && targetSeller !== mine && targetSeller !== "seller") {
      void readUserLite(targetSeller).then((lite) => {
        if (!lite) return;
        const n = typeof lite.name === "string" ? lite.name.trim() : "";
        if (n) setSellerHandle(n);
        setSeen(lastSeenLabel(lite.lastSeen));
        if (typeof lite.location === "string" && lite.location) setPlace(lite.location);
      });
    } else {
      setSeen("Usually replies in a few hours");
    }
    return () => {
      unsub();
      unsubT();
      clearInterval(tick);
      setTyping(tid, mine, false);
    };
  }, [piece?.id, mine, routeThreadId, routeOrderId, routeSupportCaseId, routePieceName, routePiecePhoto, routePiecePriceCents, routeBrandId, activeThread?.id, activeThread?.buyerId, activeThread?.buyerName, activeThread?.recipientIds?.join(","), brand?.id, brand?.name, brand?.logoUri, brand?.verified, brand?.status, isSellerSide, sellerId, brandRecipients.join(",")]);

  useEffect(() => {
    if (!thread) return;
    let cancelled = false;
    draftReady.current = false;
    void AsyncStorage.multiGet([`uvel-chat-draft-${thread}`, `uvel-chat-position-${thread}`]).then(([draft, position]) => {
      if (cancelled) return;
      setDraft(draft[1] || "");
      setReadOffset(Number(position[1] || 0));
      draftReady.current = true;
      setTimeout(() => scroller.current?.scrollTo({ y: Number(position[1] || 0), animated: false }), 100);
    }).catch(() => { draftReady.current = true; });
    return () => { cancelled = true; };
  }, [thread]);

  useEffect(() => {
    if (!thread || !draftReady.current) return;
    const timer = setTimeout(() => void AsyncStorage.setItem(`uvel-chat-draft-${thread}`, draft), 250);
    return () => clearTimeout(timer);
  }, [thread, draft]);

  async function send(text: string, kind: ChatMsg["kind"] = "text", offerCents?: number, photoUrl?: string, offerStatus?: ChatMsg["offerStatus"]) {
    if (!piece) return;
    const body = text.trim();
    if (!body || sending) return;
    setDraft("");
    setBoxKey((n) => n + 1);
    setOffer("");
    setOfferOn(false);
    if (typeTimer.current) clearTimeout(typeTimer.current);
    if (routeThreadId && !activeThread) return;
    const recipientIds = brand ? brandRecipients : [];
    const target = isSellerSide ? activeThread?.buyerId || otherId || "buyer" : recipientIds[0] || otherId || piece.ownerId || "seller";
    const tid =
      thread ||
      routeThreadId ||
      (piece
        ? openThread({
            pieceId: piece.id,
            buyerId: activeThread?.buyerId || mine,
            sellerId: brand ? recipientIds[0] || brand.ownerId : target,
            pieceName: piece.name,
            piecePhoto: piece.photo,
            piecePriceCents: piece.listPriceCents,
            sellerName: brand?.name || sellerHandle,
            buyerName: activeThread?.buyerName || app.displayName || "You",
            brandId: brand?.id,
            brandName: brand?.name,
            brandLogo: brand?.logoUri,
            brandVerified: brandCheck(brand) !== "none",
            recipientIds: brand ? recipientIds : undefined,
            orderId: routeOrderId,
            supportCaseId: routeSupportCaseId,
            contextId: routeOrderId,
          })
        : "");
    if (!tid) return;
    if (!thread) setThread(tid);
    setTyping(tid, mine, false);
    setSending(true);
    try {
      await sendChat({
        threadId: tid,
        from: mine,
        to: target,
        toIds: !isSellerSide && brand ? recipientIds : undefined,
        text: body,
        kind,
        offerCents,
        offerStatus,
        photoUrl,
        fromName: brand?.name || (isSellerSide ? app.displayName || "Uvel team" : "Uvel"),
        pieceId: piece?.id ?? "",
      });
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 40);
    } finally {
      setSending(false);
    }
  }

  function onDraft(v: string) {
    setDraft(v);
    const tid = thread;
    if (!tid) return;
    if (v.trim()) {
      setTyping(tid, mine, true);
      if (typeTimer.current) clearTimeout(typeTimer.current);
      typeTimer.current = setTimeout(() => setTyping(tid, mine, false), 1600);
    } else {
      setTyping(tid, mine, false);
    }
  }

  async function attach(camera: boolean) {
    try {
      const uri = camera ? await takePhoto(false) : await pickFromLibrary();
      if (!uri) return;
      setPendingPhoto(uri);
    } catch (e) {
      Alert.alert("Photo", e instanceof Error ? e.message : "Couldn’t add that.");
    }
  }

  async function loadOlder() {
    if (loadingOlder || !thread || !msgs.length) return;
    setLoadingOlder(true);
    const older = await loadOlderMessages(thread, msgs[0]);
    if (older.length) setMsgs((current) => [...older, ...current]);
    setHasOlder(older.length >= 80);
    setLoadingOlder(false);
  }

  function retryMessage(message: ChatMsg) {
    if (message.from !== mine || message.status !== "failed") return;
    void send(message.text, message.kind, message.offerCents, message.photoUrl, message.offerStatus);
  }

  function showConversationActions() {
    Alert.alert("Conversation options", "Choose an action for this conversation.", [
      { text: "Cancel", style: "cancel" },
      { text: "Report conversation", style: "destructive", onPress: () => void reportConversation(thread, mine).then((ok) => Alert.alert(ok ? "Report sent" : "Couldn’t send report", ok ? "Thanks. We’ll review this conversation." : "Try again when you’re online.")) },
      { text: "Block user", style: "destructive", onPress: () => void blockUser(otherId).then(() => Alert.alert("User blocked", "You won’t receive new messages from this user.")) },
    ]);
  }

  function showMessageActions(message: ChatMsg) {
    Alert.alert("Message options", "Choose an action for this message.", [
      { text: "Cancel", style: "cancel" },
      { text: "Report message", style: "destructive", onPress: () => void reportConversation(thread, mine, `Reported message ${message.id}`) },
    ]);
  }

  if (!piece) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 24, paddingHorizontal: 20 }]}>
        <Text style={{ color: colors.muted }}>That listing isn’t here.</Text>
      </View>
    );
  }

  const conversationBrand = brand || (activeThread?.brandId ? getBrand(activeThread.brandId) : undefined);
  const handle = conversationBrand?.name || sellerHandle.trim() || "Seller";
  const visibleMsgs = searchQuery.trim() ? msgs.filter((message) => message.text.toLowerCase().includes(searchQuery.trim().toLowerCase())) : msgs;

  if (!piece) {
    return (
      <View style={styles.page}>
        <StatusBar style={colors.ink === "#000000" ? "light" : "dark"} />
        <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.navBack}>‹</Text>
          </Pressable>
          <Text style={styles.navTitle}>Message seller</Text>
          <View style={styles.navBtn} />
        </View>
        <View style={styles.missingListing}>
          <Text style={styles.missingTitle}>Listing unavailable</Text>
          <Text style={styles.missingCopy}>This listing is still loading or is no longer available.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <StatusBar style={colors.ink === "#000000" ? "light" : "dark"} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn}>
            <Text style={styles.navBack}>‹</Text>
          </Pressable>
          <View style={styles.navTitleRow}>
            <Text style={styles.navTitle} numberOfLines={1}>
              {handle}
            </Text>
            <BrandVerifiedMark brand={conversationBrand} size={16} />
          </View>
          <View style={styles.navActions}>
            <Pressable onPress={() => setSearchOpen((value) => !value)} hitSlop={12} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Search conversation"><Text style={styles.searchIcon}>⌕</Text></Pressable>
            <Pressable onPress={showConversationActions} hitSlop={12} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Conversation options"><Text style={styles.info}>i</Text></Pressable>
          </View>
        </View>

        {searchOpen ? <View style={styles.searchBox}><TextInput value={searchQuery} onChangeText={setSearchQuery} autoFocus placeholder="Search messages" placeholderTextColor={colors.subtle} style={styles.searchInput} accessibilityLabel="Search messages" /><Pressable onPress={() => { setSearchQuery(""); setSearchOpen(false); }} accessibilityRole="button" accessibilityLabel="Close search"><Text style={styles.searchClose}>×</Text></Pressable></View> : null}
        <View style={styles.listing}>
          <Image source={{ uri: piece.photo }} style={styles.thumb} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.listName} numberOfLines={1}>
              {piece.name}
            </Text>
            <Text style={styles.listPrice}>{usd(piece.listPriceCents, piece.currency || "USD")}</Text>
            <Text style={styles.protect}>Protected checkout on Uvel</Text>
          </View>
        </View>

        {linkedOrderId ? <View style={styles.supportContext}><Text style={styles.supportKicker}>ORDER SUPPORT</Text><Text style={styles.supportTitle}>{supportOrder ? `Help with ${supportOrder.pieceName}` : "Order-linked conversation"}</Text><Text style={styles.supportMeta}>{supportOrder ? `Order #${supportOrder.id} · ${supportOrder.fulfillmentStatus || supportOrder.status}` : `Order #${linkedOrderId}`}</Text><Text style={styles.supportHint}>The brand team can see this order context. Internal notes stay private to the brand.</Text></View> : <View style={styles.actions}><Pressable onPress={() => setOfferOn(true)} style={styles.offerBtn}><Text style={styles.offerTxt}>Make an offer</Text></Pressable><Pressable onPress={() => router.push({ pathname: "/checkout/[id]", params: { id: piece.id } })} style={styles.buyBtn}><Text style={styles.buyTxt}>Buy now</Text></Pressable></View>}

        <View style={styles.rule} />

        <ScrollView
          ref={scroller}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          onScroll={(event) => {
            const y = event.nativeEvent.contentOffset.y;
            setReadOffset(y);
            if (thread) void AsyncStorage.setItem(`uvel-chat-position-${thread}`, String(Math.max(0, y)));
          }}
          scrollEventThrottle={250}
        >
          {hasOlder || msgs.length >= 80 ? <Pressable onPress={() => void loadOlder()} style={styles.loadOlder} accessibilityRole="button" accessibilityLabel="Load older messages"><Text style={styles.loadOlderTxt}>{loadingOlder ? "Loading…" : "Load older messages"}</Text></Pressable> : null}
          <View style={styles.hello}>
            {conversationBrand?.logoUri ? (
              <Image source={{ uri: conversationBrand.logoUri }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{handle.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.helloCard}>
              <View style={styles.helloNameRow}>
                <Text style={styles.helloHi}>Hi, I’m {handle}</Text>
                <BrandVerifiedMark brand={conversationBrand} size={18} />
              </View>
              {place ? <Text style={styles.helloMeta}>{place}</Text> : null}
              <Text style={styles.helloMeta}>{seen || "Usually replies in a few hours"}</Text>
            </View>
          </View>

          {visibleMsgs.map((m, i) => {
            const mineMsg = m.from === mine;
            const lastMine = mineMsg && !msgs.slice(i + 1).some((x) => x.from === mine);
            const prev = msgs[i - 1];
            const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
            const status =
              m.status === "seen" ? "Seen" : m.status === "delivered" ? "Delivered" : m.status === "sending" ? "Sending" : m.status === "failed" ? "Failed · try sending again" : "Sent";
            return (
              <Pressable key={m.id} onLongPress={() => showMessageActions(m)} delayLongPress={450} accessibilityRole="text">
                {newDay ? <Text style={styles.day}>{dayLabel(m.createdAt)}</Text> : null}
                {m.kind === "offer" ? (
                  <View style={[styles.bubble, mineMsg ? styles.bubbleMine : styles.bubbleThem]}>
                    <Text style={styles.offerTag}>Offer · {m.offerStatus || "pending"}</Text>
                    <Text style={[styles.bubbleTxt, mineMsg && styles.bubbleTxtMine]}>{m.text}</Text>
                    {!mineMsg && (m.offerStatus || "pending") === "pending" ? <View style={styles.offerActions}><Pressable onPress={() => void updateOfferStatus(thread, m.id, "declined")} accessibilityRole="button"><Text style={styles.offerActionText}>Decline</Text></Pressable><Pressable onPress={() => void updateOfferStatus(thread, m.id, "accepted")} accessibilityRole="button"><Text style={styles.offerActionText}>Accept</Text></Pressable></View> : null}
                  </View>
                ) : (
                  <View style={[styles.bubble, mineMsg ? styles.bubbleMine : styles.bubbleThem]}>
                    {m.photoUrl ? <Image source={{ uri: m.photoUrl }} style={styles.msgPhoto} contentFit="cover" /> : null}
                    <Text style={[styles.bubbleTxt, mineMsg && styles.bubbleTxtMine]}>{m.text}</Text>
                  </View>
                )}
                {lastMine ? (
                  m.status === "failed" ? <Pressable onPress={() => retryMessage(m)} accessibilityRole="button" accessibilityLabel="Retry failed message"><Text style={styles.meta}>{status} · {clock(m.createdAt)}</Text></Pressable> : <Text style={styles.meta}>{status} · {clock(m.createdAt)}</Text>
                ) : !mineMsg ? (
                  <Text style={styles.metaThem}>{clock(m.createdAt)}</Text>
                ) : null}
              </Pressable>
            );
          })}
          {typing ? (
            <View style={[styles.bubble, styles.bubbleThem, styles.typing]}>
              <Text style={styles.typingTxt}>typing…</Text>
            </View>
          ) : null}
        </ScrollView>

        {safety ? (
          <View style={styles.safety}>
            <Text style={styles.safetyTxt}>
              Stay safe on Uvel. Don’t share personal data, click unknown links, or pay off the app.
            </Text>
            <Pressable onPress={() => setSafety(false)} hitSlop={8}>
              <Text style={styles.safetyX}>×</Text>
            </Pressable>
          </View>
        ) : null}

        {pendingPhoto ? <View style={styles.attachmentPreview}><Image source={{ uri: pendingPhoto }} style={styles.attachmentThumb} contentFit="cover" /><Text style={styles.attachmentLabel}>Photo ready to send</Text><Pressable onPress={() => setPendingPhoto(undefined)} accessibilityRole="button" accessibilityLabel="Remove attached photo"><Text style={styles.attachmentRemove}>×</Text></Pressable><Pressable onPress={() => { void send("Sent a photo", "text", undefined, pendingPhoto); setPendingPhoto(undefined); }} accessibilityRole="button" accessibilityLabel="Send attached photo"><Text style={styles.attachmentSend}>Send</Text></Pressable></View> : null}
        <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
          <Pressable onPress={() => void attach(false)} style={styles.icon} accessibilityRole="button" accessibilityLabel="Attach photo from library">
            <Text style={styles.iconTxt}>+</Text>
          </Pressable>
          <Pressable onPress={() => void attach(true)} style={styles.icon} accessibilityRole="button" accessibilityLabel="Take a photo">
            <Text style={styles.cam}>◉</Text>
          </Pressable>
          <TextInput
            key={boxKey}
            style={styles.input}
            value={draft}
            onChangeText={onDraft}
            placeholder="Write a message here"
            placeholderTextColor={colors.subtle}
            returnKeyType="send"
            enablesReturnKeyAutomatically
            onSubmitEditing={() => void send(draft)}
            blurOnSubmit
            accessibilityLabel="Message text"
            maxLength={2000}
          />
          <Pressable onPress={() => void send(draft)} disabled={sending || !draft.trim()} style={styles.send} accessibilityRole="button" accessibilityLabel="Send message">
            <Text style={[styles.sendTxt, (!draft.trim() || sending) && { opacity: 0.35 }]}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {offerOn ? (
        <View style={styles.sheetWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOfferOn(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.sheetH}>Make an offer</Text>
            <Text style={styles.sheetP}>Listed at {usd(piece.listPriceCents, piece.currency || "USD")}. Be fair — they’ll see it as a message.</Text>
            <View style={styles.offerRow}>
              <Text style={styles.dollar}>$</Text>
              <TextInput
                style={styles.offerIn}
                value={offer}
                onChangeText={(v) => setOffer(v.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.subtle}
                autoFocus
              />
            </View>
            <Pressable
              onPress={() => {
                const n = Number(offer);
                if (!n) return;
                void send(`Offered ${usd(n * 100, piece.currency || "USD")}`, "offer", n * 100, undefined, "pending");
              }}
              style={[styles.buyBtn, { marginTop: 16, opacity: Number(offer) > 0 ? 1 : 0.4 }]}
            >
              <Text style={styles.buyTxt}>Send offer</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    nav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 6,
      paddingBottom: 8,
    },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navActions: { flexDirection: "row", alignItems: "center" },
    searchIcon: { color: colors.bone, fontSize: 27, lineHeight: 30 },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.surface },
    searchInput: { flex: 1, minHeight: 42, color: colors.bone, fontSize: 15 },
    searchClose: { color: colors.muted, fontSize: 24 },
    navBack: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    navTitleRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    navTitle: { color: colors.bone, fontSize: 16, fontWeight: "600", maxWidth: "88%" },
    missingListing: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
    missingTitle: { color: colors.bone, fontFamily: "Georgia", fontSize: 25, textAlign: "center" },
    missingCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 10 },
    info: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.bone,
      textAlign: "center",
      lineHeight: 20,
      color: colors.bone,
      fontSize: 13,
      fontWeight: "700",
    },
    listing: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 12,
      alignItems: "center",
    },
    supportContext: { marginHorizontal: 16, marginTop: 4, marginBottom: 12, padding: 13, borderRadius: 14, backgroundColor: colors.neutral, borderWidth: 1, borderColor: `${colors.info}66` },
    supportKicker: { color: colors.info, fontSize: 10, letterSpacing: 1.4, fontWeight: "800" },
    supportTitle: { color: colors.bone, fontSize: 14, fontWeight: "800", marginTop: 6 },
    supportMeta: { color: colors.muted, fontSize: 12, marginTop: 5, textTransform: "capitalize" },
    supportHint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 7 },
    thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.surface },
    listName: { color: colors.bone, fontWeight: "600", fontSize: 15 },
    listPrice: { color: colors.bone, marginTop: 2, fontSize: 14 },
    protect: { color: colors.success, marginTop: 3, fontSize: 12, fontWeight: "600" },
    actions: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
    offerBtn: {
      flex: 1,
      height: 46,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    offerTxt: { color: colors.success, fontWeight: "700", fontSize: 15 },
    buyBtn: {
      flex: 1,
      height: 46,
      borderRadius: 8,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    buyTxt: { color: colors.successInk, fontWeight: "700", fontSize: 15 },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: `${colors.bone}1F` },
    hello: { flexDirection: "row", gap: 10, marginBottom: 18, alignItems: "flex-start" },
    loadOlder: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 14, marginBottom: 10, borderRadius: 14, backgroundColor: colors.surface },
    loadOlderTxt: { color: colors.success, fontSize: 13, fontWeight: "700" },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarTxt: { color: colors.bone, fontWeight: "700" },
    avatarImg: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface },
    helloNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    helloCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
    },
    helloHi: { color: colors.bone, fontWeight: "700", fontSize: 15 },
    helloMeta: { color: colors.muted, marginTop: 4, fontSize: 13 },
    bubble: {
      maxWidth: "78%",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 8,
    },
    bubbleMine: { alignSelf: "flex-end", backgroundColor: "#2A320E" },
    bubbleThem: { alignSelf: "flex-start", backgroundColor: colors.surface },
    bubbleTxt: { color: colors.bone, fontSize: 15, lineHeight: 21 },
    bubbleTxtMine: { color: colors.bone },
    offerTag: { color: colors.success, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
    offerActions: { flexDirection: "row", gap: 18, marginTop: 10 },
    offerActionText: { color: colors.success, fontSize: 13, fontWeight: "800" },
    msgPhoto: { width: 180, height: 180, borderRadius: 12, marginBottom: 8 },
    day: { color: colors.subtle, textAlign: "center", fontSize: 12, marginVertical: 10 },
    meta: { color: colors.subtle, fontSize: 11, alignSelf: "flex-end", marginBottom: 10, marginRight: 4 },
    metaThem: { color: colors.subtle, fontSize: 11, alignSelf: "flex-start", marginBottom: 10, marginLeft: 4 },
    typing: { paddingVertical: 8, paddingHorizontal: 14 },
    typingTxt: { color: colors.muted, fontStyle: "italic", fontSize: 14 },
    safety: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: `${colors.subtle}66`,
    },
    safetyTxt: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 16 },
    safetyX: { color: colors.subtle, fontSize: 22, paddingHorizontal: 6 },
    attachmentPreview: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface },
    attachmentThumb: { width: 42, height: 42, borderRadius: 8 },
    attachmentLabel: { flex: 1, color: colors.muted, fontSize: 13 },
    attachmentRemove: { color: colors.muted, fontSize: 22 },
    attachmentSend: { color: colors.success, fontWeight: "800", fontSize: 13 },
    composer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 10,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: `${colors.bone}1A`,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    iconTxt: { color: colors.bone, fontSize: 22, marginTop: -2 },
    cam: { color: colors.bone, fontSize: 16 },
    input: {
      flex: 1,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.surface,
      color: colors.bone,
      paddingHorizontal: 12,
      fontSize: 15,
    },
    send: { paddingHorizontal: 10, height: 36, justifyContent: "center" },
    sendTxt: { color: colors.success, fontWeight: "700" },
    sheetWrap: { ...StyleSheet.absoluteFill, justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
    },
    sheetH: { color: colors.bone, fontFamily: "Georgia", fontSize: 24 },
    sheetP: { color: colors.muted, marginTop: 8, lineHeight: 20 },
    offerRow: { flexDirection: "row", alignItems: "center", marginTop: 18, gap: 8 },
    dollar: { color: colors.bone, fontSize: 32, fontWeight: "700" },
    offerIn: { flex: 1, color: colors.bone, fontSize: 32, fontWeight: "700" },
  });
}
