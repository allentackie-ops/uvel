import { Image } from "expo-image";
import { router } from "expo-router";
import { openWithLoad } from "../lib/brandLoad";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { unreadFor, useInbox, type ChatThread } from "../lib/chat";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";

type Filter = "All" | "Messages" | "Selling" | "Buying";
const FILTERS: Filter[] = ["All", "Messages", "Selling", "Buying"];

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
  const me = uid || "me";
  const threads = useInbox(me);
  const [filter, setFilter] = useState<Filter>("All");

  const visible = useMemo(() => {
    return threads.filter((t) => {
      const selling = t.sellerId === me;
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
      <StatusBar style="light" />
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn}>
          <Text style={styles.navBack}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>Inbox</Text>
        <Pressable
          onPress={() => Alert.alert("Notifications", "New asks, offers, and sold pieces will ping here.")}
          hitSlop={12}
          style={styles.bell}
        >
          <Text style={styles.bellTxt}>🔔</Text>
        </Pressable>
      </View>

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
        ListEmptyComponent={<Text style={styles.empty}>{empty}</Text>}
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
  const iAmSeller = t.sellerId === uid;
  const who = iAmSeller ? t.buyerName || "Buyer" : t.sellerName || "Seller";
  const you = t.lastFrom === uid || t.lastFrom === "me";
  const unread = unreadFor(t, uid);
  return (
    <Pressable onPress={() => openWithLoad({ pathname: "/ask/[id]", params: { id: t.pieceId } })} style={styles.row}>
      {t.piecePhoto ? (
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
          {t.lastAt ? <Text style={styles.time}>{when(t.lastAt)}</Text> : null}
        </View>
        <Text style={[styles.prev, unread ? { color: "#F4F0E6" } : null]} numberOfLines={1}>
          {t.lastText ? `${you ? "You: " : ""}${t.lastText}` : t.pieceName}
        </Text>
      </View>
      {unread ? <View style={styles.dot} /> : null}
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
      paddingBottom: 10,
    },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navBack: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    navTitle: { color: colors.bone, fontSize: 17, fontWeight: "700" },
    bell: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.18)",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    bellTxt: { fontSize: 16 },
    chipWrap: { flexGrow: 0, flexShrink: 0 },
    chipScroll: { flexGrow: 0 },
    chips: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, alignItems: "center" },
    chip: {
      height: 36,
      paddingHorizontal: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.28)",
      alignItems: "center",
      justifyContent: "center",
    },
    chipOn: { backgroundColor: "#F4F0E6", borderColor: "#F4F0E6" },
    chipTxt: { color: colors.bone, fontWeight: "600", fontSize: 14 },
    chipTxtOn: { color: "#16140F" },
    empty: { color: colors.muted, padding: 24, lineHeight: 22, fontSize: 15 },
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
