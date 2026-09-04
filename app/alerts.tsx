import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alertKindLabel, markAlertRead, useAlertCenter } from "../lib/alerts";
import { markActivityNotificationRead, useActivityNotifications } from "../lib/activityNotifications";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { getPiece, useWardrobe } from "../lib/wardrobe";

function ago(at: number) {
  const minutes = Math.max(1, Math.round((Date.now() - at) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function Alerts() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const pieces = useWardrobe();
  const { preferences, events } = useAlertCenter(app.uid);
  const activity = useActivityNotifications(app.uid || "guest");

  function openListing(id: string, eventId?: string) {
    if (eventId) void markAlertRead(app.uid, eventId);
    router.push({ pathname: "/closet/[id]", params: { id } });
  }


  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        <Header styles={styles} />
        <Text style={styles.title}>Your Uvel notifications.</Text>
        <Text style={styles.lede}>Activity from Today and alerts for your saved marketplace items appear here.</Text>

        <Text style={styles.sectionTitle}>Recent activity</Text>
        {activity.length ? activity.slice(0, 20).map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              void markActivityNotificationRead(app.uid || "guest", item.id);
              if (item.target === "saved") router.push("/(tabs)/you");
            }}
            style={[styles.event, !item.read && styles.eventUnread]}
            accessibilityRole="button"
            accessibilityLabel={item.target === "saved" ? `${item.title}. Open saved looks.` : item.title}
          >
            {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.eventThumb} contentFit="cover" /> : <View style={styles.eventThumb} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.eventTop}>
                <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
                {!item.read ? <View style={styles.unread} /> : null}
              </View>
              <Text style={styles.eventBody} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.eventTime}>{ago(item.at)}</Text>
            </View>
          </Pressable>
        )) : (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>No activity yet</Text>
            <Text style={styles.panelCopy}>Your Today feedback and bookmarked looks will appear here.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Watching</Text>
        {preferences.length ? preferences.map((preference) => {
          const piece = getPiece(preference.listingId) || pieces.find((item) => item.id === preference.listingId);
          return (
            <Pressable key={preference.listingId} onPress={() => openListing(preference.listingId)} style={styles.row} accessibilityRole="button" accessibilityLabel={`Open ${piece?.name || "watched listing"}`}>
              {piece?.photo ? <Image source={{ uri: piece.photo }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{piece?.name || "Saved listing"}</Text>
                <Text style={styles.rowMeta}>{alertKindLabel(preference.kind)} · Watching</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }) : (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Nothing watched yet</Text>
            <Text style={styles.panelCopy}>Open a saved listing and choose Price drops, Restocks, or Both.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Saved-item alerts</Text>
        {events.length ? events.slice(0, 20).map((event) => (
          <Pressable key={event.id} onPress={() => openListing(event.listingId, event.id)} style={[styles.event, !event.read && styles.eventUnread]} accessibilityRole="button" accessibilityLabel={`Open ${event.title} for ${event.listingName}`}>
            {event.photo ? <Image source={{ uri: event.photo }} style={styles.eventThumb} contentFit="cover" /> : <View style={styles.eventThumb} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.eventTop}>
                <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                {!event.read ? <View style={styles.unread} /> : null}
              </View>
              <Text style={styles.eventBody} numberOfLines={2}>{event.body}</Text>
              <Text style={styles.eventTime}>{ago(event.at)}</Text>
            </View>
          </Pressable>
        )) : (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>No alerts yet</Text>
            <Text style={styles.panelCopy}>When a watched listing changes and Uvel records it, the alert will appear here.</Text>
          </View>
        )}

        <View style={styles.note}>
          <Text style={styles.noteText}>Uvel never turns an unconfirmed price, stock change, or notification into a marketplace-wide claim.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Header({ styles }: { styles: ReturnType<typeof make> }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle}>Notifications</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
    back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    backText: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    headerTitle: { color: colors.bone, fontSize: 16, fontWeight: "700" },
    kicker: { color: colors.muted, letterSpacing: 1.7, fontSize: 10, fontWeight: "800" },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 8 },
    lede: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10 },
    sectionTitle: { color: colors.bone, fontSize: 20, fontWeight: "800", marginTop: 28, marginBottom: 10 },
    row: { backgroundColor: colors.surface, borderRadius: 16, padding: 10, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    thumb: { width: 54, height: 68, borderRadius: 10, backgroundColor: colors.ink },
    rowTitle: { color: colors.bone, fontSize: 14, fontWeight: "800" },
    rowMeta: { color: colors.muted, fontSize: 12, marginTop: 5 },
    chevron: { color: colors.muted, fontSize: 25 },
    panel: { backgroundColor: colors.surface, borderRadius: 18, padding: 18, alignItems: "center" },
    panelTitle: { color: colors.bone, fontSize: 16, fontWeight: "800" },
    panelCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6 },
    event: { backgroundColor: colors.surface, borderRadius: 16, padding: 10, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.neutral },
    eventUnread: { borderColor: colors.success },
    eventThumb: { width: 54, height: 68, borderRadius: 10, backgroundColor: colors.ink },
    eventTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    eventTitle: { color: colors.bone, fontSize: 14, fontWeight: "800", flex: 1 },
    unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
    eventBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
    eventTime: { color: colors.muted, fontSize: 11, marginTop: 5 },
    note: { marginTop: 18, padding: 14, borderRadius: 16, backgroundColor: colors.info },
    noteText: { color: colors.infoInk, fontSize: 12, lineHeight: 18 },
    empty: { flex: 1, paddingHorizontal: 28, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
    emptyTitle: { color: colors.bone, fontSize: 23, fontWeight: "800", textAlign: "center", marginTop: 12 },
    emptyCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },
    primary: { backgroundColor: colors.success, borderRadius: 26, paddingHorizontal: 24, paddingVertical: 15, marginTop: 22 },
    primaryText: { color: colors.successInk, fontSize: 15, fontWeight: "800" },
  });
}
