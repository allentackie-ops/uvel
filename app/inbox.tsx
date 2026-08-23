import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInbox, unreadFor, type ChatThread } from "../lib/chat";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";

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
  const threads = useInbox(uid || "me");

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn}>
          <Text style={styles.navBack}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>Chats</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {threads.length === 0 ? (
          <Text style={styles.empty}>When someone asks about a listing, it lands here. Your replies live here too.</Text>
        ) : (
          threads.map((t) => <Row key={t.id} thread={t} uid={uid || "me"} colors={colors} />)
        )}
      </ScrollView>
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
  const iAmSeller = t.sellerId === uid;
  const who = iAmSeller ? t.buyerName || "Buyer" : t.sellerName || "Seller";
  const you = t.lastFrom === uid || t.lastFrom === "me";
  const unread = unreadFor(t, uid);
  return (
    <Pressable onPress={() => router.push({ pathname: "/ask/[id]", params: { id: t.pieceId } })} style={styles.row}>
      <Image source={{ uri: t.piecePhoto }} style={styles.thumb} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <View style={styles.line}>
          <Text style={[styles.name, unread ? { fontWeight: "800" } : null]} numberOfLines={1}>
            {who}
          </Text>
          {t.lastAt ? <Text style={styles.time}>{when(t.lastAt)}</Text> : null}
        </View>
        <Text style={styles.piece} numberOfLines={1}>
          {t.pieceName}
        </Text>
        <Text style={[styles.prev, unread ? { color: "#F4F0E6" } : null]} numberOfLines={1}>
          {t.lastText ? `${you ? "You: " : ""}${t.lastText}` : iAmSeller ? "Waiting on their first message" : "Say hi"}
        </Text>
      </View>
      {unread ? (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{unread > 9 ? "9+" : String(unread)}</Text>
        </View>
      ) : null}
    </Pressable>
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
    navTitle: { color: colors.bone, fontSize: 16, fontWeight: "600" },
    empty: { color: colors.muted, padding: 24, lineHeight: 22, fontSize: 15 },
    row: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(244,240,230,0.1)",
    },
    thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.surface },
    line: { flexDirection: "row", alignItems: "center", gap: 8 },
    name: { flex: 1, color: colors.bone, fontWeight: "700", fontSize: 15 },
    time: { color: colors.subtle, fontSize: 12 },
    piece: { color: colors.muted, marginTop: 2, fontSize: 13 },
    prev: { color: colors.subtle, marginTop: 3, fontSize: 13 },
    badge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "#D6E27A",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    badgeTxt: { color: "#16140F", fontWeight: "800", fontSize: 11 },
  });
}
