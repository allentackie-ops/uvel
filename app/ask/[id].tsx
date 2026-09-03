import { Image } from "expo-image";
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
import { VerifiedMark } from "../../components/VerifiedMark";
import { getBrand, inquiryRecipients, useBrands } from "../../lib/brands";
import { usd } from "../../lib/catalog";
import {
  clock,
  dayLabel,
  lastSeenLabel,
  getThread,
  listenMessages,
  listenThread,
  markSeen,
  openThread,
  readUserLite,
  sendChat,
  setTyping,
  type ChatMsg,
  type ChatThread,
} from "../../lib/chat";
import { pickFromLibrary, takePhoto } from "../../lib/photo";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { getPiece, useWardrobe } from "../../lib/wardrobe";
import { useOrders } from "../../lib/orders";

export default function Ask() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { id, threadId: routeThreadId, orderId: routeOrderId, supportCaseId: routeSupportCaseId } = useLocalSearchParams<{ id: string; threadId?: string; orderId?: string; supportCaseId?: string }>();
  const app = useUvel();
  useWardrobe();
  useBrands();
  const orders = useOrders();
  const piece = getPiece(id);
  const storedThread = routeThreadId ? getThread(routeThreadId) : undefined;
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
      brandVerified: Boolean(brand?.verified && brand.status === "verified"),
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
  }, [piece?.id, mine, routeThreadId, routeOrderId, routeSupportCaseId, activeThread?.id, activeThread?.buyerId, activeThread?.buyerName, activeThread?.recipientIds?.join(","), brand?.id, brand?.name, brand?.logoUri, brand?.verified, brand?.status, isSellerSide, sellerId, brandRecipients.join(",")]);

  async function send(text: string, kind: ChatMsg["kind"] = "text", offerCents?: number, photoUrl?: string) {
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
            brandVerified: Boolean(brand?.verified && brand.status === "verified"),
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
      await send("Sent a photo", "text", undefined, uri);
    } catch (e) {
      Alert.alert("Photo", e instanceof Error ? e.message : "Couldn’t add that.");
    }
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
  const brandIsVerified = Boolean(conversationBrand?.verified && conversationBrand.status === "verified");

  return (
    <View style={styles.page}>
      <StatusBar style={colors.ink === "#FFFFFF" ? "dark" : "light"} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn}>
            <Text style={styles.navBack}>‹</Text>
          </Pressable>
          <View style={styles.navTitleRow}>
            <Text style={styles.navTitle} numberOfLines={1}>
              {handle}
            </Text>
            {brandIsVerified ? <VerifiedMark size={16} /> : null}
          </View>
          <Pressable
            onPress={() =>
              Alert.alert(
                piece.name,
                `${usd(piece.listPriceCents, piece.currency || "USD")} · ${[piece.size, piece.condition, piece.brand].filter(Boolean).join(" · ")}\n\nStay on Uvel. Don’t share phone numbers, emails, or payment off the app.`,
              )
            }
            hitSlop={12}
            style={styles.navBtn}
          >
            <Text style={styles.info}>i</Text>
          </Pressable>
        </View>

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
        >
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
                {brandIsVerified ? <VerifiedMark size={18} /> : null}
              </View>
              {place ? <Text style={styles.helloMeta}>{place}</Text> : null}
              <Text style={styles.helloMeta}>{seen || "Usually replies in a few hours"}</Text>
            </View>
          </View>

          {msgs.map((m, i) => {
            const mineMsg = m.from === mine;
            const lastMine = mineMsg && !msgs.slice(i + 1).some((x) => x.from === mine);
            const prev = msgs[i - 1];
            const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
            const status =
              m.status === "seen" ? "Seen" : m.status === "delivered" ? "Delivered" : m.status === "sending" ? "Sending" : "Sent";
            return (
              <View key={m.id}>
                {newDay ? <Text style={styles.day}>{dayLabel(m.createdAt)}</Text> : null}
                {m.kind === "offer" ? (
                  <View style={[styles.bubble, mineMsg ? styles.bubbleMine : styles.bubbleThem]}>
                    <Text style={styles.offerTag}>Offer</Text>
                    <Text style={[styles.bubbleTxt, mineMsg && styles.bubbleTxtMine]}>{m.text}</Text>
                  </View>
                ) : (
                  <View style={[styles.bubble, mineMsg ? styles.bubbleMine : styles.bubbleThem]}>
                    {m.photoUrl ? <Image source={{ uri: m.photoUrl }} style={styles.msgPhoto} contentFit="cover" /> : null}
                    <Text style={[styles.bubbleTxt, mineMsg && styles.bubbleTxtMine]}>{m.text}</Text>
                  </View>
                )}
                {lastMine ? (
                  <Text style={styles.meta}>{status} · {clock(m.createdAt)}</Text>
                ) : !mineMsg ? (
                  <Text style={styles.metaThem}>{clock(m.createdAt)}</Text>
                ) : null}
              </View>
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

        <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
          <Pressable onPress={() => void attach(false)} style={styles.icon}>
            <Text style={styles.iconTxt}>+</Text>
          </Pressable>
          <Pressable onPress={() => void attach(true)} style={styles.icon}>
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
          />
          <Pressable onPress={() => void send(draft)} disabled={sending || !draft.trim()} style={styles.send}>
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
                void send(`Offered ${usd(n * 100, piece.currency || "USD")}`, "offer", n * 100);
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
    navBack: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    navTitleRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    navTitle: { color: colors.bone, fontSize: 16, fontWeight: "600", maxWidth: "88%" },
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
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(244,240,230,0.12)" },
    hello: { flexDirection: "row", gap: 10, marginBottom: 18, alignItems: "flex-start" },
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
    bubbleTxtMine: { color: colors.legacyText },
    offerTag: { color: colors.success, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
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
    composer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 10,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(244,240,230,0.1)",
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
