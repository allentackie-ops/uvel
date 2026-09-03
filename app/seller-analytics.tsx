import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOrders } from "../lib/orders";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { likesOnMine, useMarketplaceSyncState, useWardrobe, type ClosetPiece } from "../lib/wardrobe";

function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function statusLabel(piece: ClosetPiece) {
  if (piece.status === "listed") return "Listed locally";
  if (piece.status === "sold") return "Sold record";
  if (piece.status === "draft") return "Draft";
  if (piece.status === "archived") return "Archived";
  return "In your closet";
}

export default function SellerAnalytics() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const pieces = useWardrobe();
  const orders = useOrders();
  const marketplaceState = useMarketplaceSyncState();

  const owned = useMemo(
    () => pieces.filter((piece) => Boolean(app.uid) && piece.ownerId === app.uid),
    [pieces, app.uid],
  );
  const active = useMemo(() => owned.filter((piece) => piece.status === "listed"), [owned]);
  const drafts = useMemo(() => owned.filter((piece) => piece.status === "draft"), [owned]);
  const sold = useMemo(() => owned.filter((piece) => piece.status === "sold"), [owned]);
  const receivedLikes = useMemo(() => likesOnMine(app.uid), [app.uid, pieces]);
  const paidOrders = useMemo(
    () => orders.filter((order) => order.sellerId === app.uid && order.status === "paid"),
    [orders, app.uid],
  );
  const pendingOrders = useMemo(
    () => orders.filter((order) => order.sellerId === app.uid && order.status === "pending"),
    [orders, app.uid],
  );
  const recordedViews = active.reduce((sum, piece) => sum + Math.max(0, piece.views || 0), 0);
  const lowStock = active.filter(
    (piece) => typeof piece.stockQuantity === "number" && piece.stockQuantity > 0 && piece.stockQuantity <= 10,
  );
  const maxViews = Math.max(1, ...active.map((piece) => Math.max(0, piece.views || 0)));
  const rankedListings = useMemo(
    () => active
      .slice()
      .sort((a, b) => (b.views || 0) + (b.likedBy?.length || 0) * 2 - ((a.views || 0) + (a.likedBy?.length || 0) * 2))
      .slice(0, 8),
    [active],
  );

  function openListing(id: string) {
    router.push({ pathname: "/closet/[id]", params: { id } });
  }

  if (!app.uid) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 18 }]}>
        <Header styles={styles} />
        <View style={styles.centerEmpty}>
          <Text style={styles.emptyTitle}>Sign in to see seller analytics</Text>
          <Text style={styles.emptyCopy}>Your listing activity stays private to your account.</Text>
        </View>
      </View>
    );
  }

  const hasLocalActivity = recordedViews > 0 || receivedLikes.length > 0 || paidOrders.length > 0 || sold.length > 0;
  const syncCopy = marketplaceState === "confirmed"
    ? "Listing connection is active. Workspace signals below are still labeled by source."
    : marketplaceState === "loading"
      ? "Checking the listing connection. Local workspace records remain available."
      : "Marketplace analytics are unavailable. Local workspace records remain available; no platform-wide claims are shown.";
  const actions = [] as { id: string; title: string; detail: string; button: string; onPress: () => void }[];

  if (drafts.length) {
    actions.push({
      id: "drafts",
      title: `Finish ${countLabel(drafts.length, "draft")}`,
      detail: "Complete the details so your item is ready for a real marketplace listing.",
      button: "Continue",
      onPress: () => router.push({ pathname: "/sell", params: { draft: "1" } }),
    });
  }
  if (!active.length) {
    actions.push({
      id: "first-listing",
      title: "List your first piece",
      detail: "Seller analytics become more useful once your own listings have activity to learn from.",
      button: "Start selling",
      onPress: () => router.push("/sell"),
    });
  } else if (!recordedViews) {
    actions.push({
      id: "photo",
      title: "Strengthen your first photo",
      detail: "No on-device listing views are recorded yet. A clearer lead image is a useful place to start.",
      button: "Review listing",
      onPress: () => openListing(active[0].id),
    });
  }
  if (lowStock.length) {
    actions.push({
      id: "stock",
      title: `${countLabel(lowStock.length, "listing")} low on stock`,
      detail: "Review availability before you promote an item that may not have enough units left.",
      button: "Check stock",
      onPress: () => openListing(lowStock[0].id),
    });
  }
  if (paidOrders.length) {
    actions.push({
      id: "orders",
      title: `${countLabel(paidOrders.length, "paid order", "paid orders")} recorded`,
      detail: "Keep fulfillment status current so your buyer and seller records stay useful.",
      button: "Open order",
      onPress: () => router.push({ pathname: "/order/[id]", params: { id: paidOrders[0].id } }),
    });
  }
  if (!actions.length) {
    actions.push({
      id: "learn",
      title: hasLocalActivity ? "Keep learning from your records" : "Your seller workspace is ready",
      detail: hasLocalActivity ? "Review the listing signals below and make one focused improvement at a time." : "List an item or open a draft to start building useful seller records.",
      button: active.length ? "Review listings" : "Start selling",
      onPress: () => active.length ? openListing(active[0].id) : router.push("/sell"),
    });
  }

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Header styles={styles} />
        <Text style={styles.kicker}>UVEL+ SELLER ANALYTICS</Text>
        <Text style={styles.title}>Know what to improve next.</Text>
        <Text style={styles.lede}>A private view of your seller workspace, with confirmed records separated from signals recorded on this device.</Text>

        <View style={styles.sourceCard} accessibilityRole="summary">
          <View style={[styles.sourceDot, marketplaceState === "confirmed" && styles.sourceDotOn]} />
          <Text style={styles.sourceCopy}>{syncCopy}</Text>
        </View>

        <View style={styles.statsGrid}>
          <Stat label="Active listings" value={String(active.length)} styles={styles} />
          <Stat label="Draft listings" value={String(drafts.length)} styles={styles} />
          <Stat label="Buyer saves" value={String(receivedLikes.length)} styles={styles} />
          <Stat label="Paid order records" value={String(paidOrders.length)} styles={styles} />
          <Stat label="On-device views" value={String(recordedViews)} styles={styles} />
          <Stat label="Sold records" value={String(sold.length)} styles={styles} />
        </View>

        <Text style={styles.sectionTitle}>Next best moves</Text>
        {actions.slice(0, 3).map((action) => (
          <View key={action.id} style={styles.actionCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionDetail}>{action.detail}</Text>
            </View>
            <Pressable onPress={action.onPress} style={styles.smallButton} accessibilityRole="button" accessibilityLabel={action.button}>
              <Text style={styles.smallButtonText}>{action.button}</Text>
            </Pressable>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Your listing signals</Text>
        <Text style={styles.sectionCopy}>These are records attached to your account or this device. They are not a prediction of marketplace reach.</Text>
        {rankedListings.length ? rankedListings.map((piece) => {
          const views = Math.max(0, piece.views || 0);
          const saves = (piece.likedBy || []).length;
          return (
            <Pressable key={piece.id} onPress={() => openListing(piece.id)} style={styles.listingRow} accessibilityRole="button" accessibilityLabel={`Open analytics for ${piece.name}`}>
              {piece.photo ? <Image source={{ uri: piece.photo }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.listingTop}>
                  <Text style={styles.listingName} numberOfLines={1}>{piece.name}</Text>
                  <Text style={styles.listingStatus}>{statusLabel(piece)}</Text>
                </View>
                <Text style={styles.listingMeta}>{views} on-device views · {saves} recorded saves</Text>
                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(3, (views / maxViews) * 100)}%` }]} /></View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyPanelTitle}>No active listings yet</Text>
            <Text style={styles.emptyPanelCopy}>Drafts and active listings will appear here once you start selling.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Order records</Text>
        {paidOrders.length || pendingOrders.length ? (
          <View style={styles.orderPanel}>
            <Text style={styles.orderLine}>Paid records <Text style={styles.orderStrong}>{paidOrders.length}</Text></Text>
            <Text style={styles.orderLine}>Payment pending <Text style={styles.orderStrong}>{pendingOrders.length}</Text></Text>
            <Text style={styles.orderNote}>These are local order records. Revenue and platform-wide conversion remain unavailable until trusted backend analytics is connected.</Text>
          </View>
        ) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyPanelTitle}>No order records yet</Text>
            <Text style={styles.emptyPanelCopy}>Confirmed purchases will be separated from views and saves when the backend reports them.</Text>
          </View>
        )}
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
      <Text style={styles.headerTitle}>Seller analytics</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

function Stat({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof make> }) {
  return (
    <View style={styles.stat} accessibilityRole="summary">
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    lede: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
    sourceCard: { marginTop: 18, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.neutral, backgroundColor: colors.surface, flexDirection: "row", alignItems: "flex-start", gap: 10 },
    sourceDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.muted, marginTop: 4 },
    sourceDotOn: { backgroundColor: colors.success },
    sourceCopy: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 },
    stat: { width: "48.5%", backgroundColor: colors.surface, borderRadius: 16, padding: 14, minHeight: 80 },
    statValue: { color: colors.bone, fontSize: 23, fontWeight: "800", fontVariant: ["tabular-nums"] },
    statLabel: { color: colors.muted, fontSize: 12, lineHeight: 16, marginTop: 5 },
    sectionTitle: { color: colors.bone, fontSize: 20, fontWeight: "800", marginTop: 28, marginBottom: 10 },
    sectionCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 8 },
    actionCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.neutral, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
    actionTitle: { color: colors.bone, fontSize: 15, fontWeight: "800" },
    actionDetail: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
    smallButton: { backgroundColor: colors.success, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 },
    smallButtonText: { color: colors.successInk, fontSize: 12, fontWeight: "800" },
    listingRow: { backgroundColor: colors.surface, borderRadius: 16, padding: 10, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    thumb: { width: 54, height: 68, borderRadius: 10, backgroundColor: colors.ink },
    listingTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    listingName: { color: colors.bone, fontSize: 14, fontWeight: "800", flex: 1 },
    listingStatus: { color: colors.muted, fontSize: 10, fontWeight: "700" },
    listingMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
    progressTrack: { height: 5, borderRadius: 3, backgroundColor: colors.ink, marginTop: 9, overflow: "hidden" },
    progressFill: { height: 5, borderRadius: 3, backgroundColor: colors.success },
    chevron: { color: colors.muted, fontSize: 25, marginLeft: 2 },
    emptyPanel: { backgroundColor: colors.surface, borderRadius: 18, padding: 18, alignItems: "center" },
    emptyPanelTitle: { color: colors.bone, fontSize: 16, fontWeight: "800" },
    emptyPanelCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6 },
    orderPanel: { backgroundColor: colors.surface, borderRadius: 18, padding: 16 },
    orderLine: { color: colors.muted, fontSize: 14, lineHeight: 24 },
    orderStrong: { color: colors.bone, fontWeight: "800" },
    orderNote: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
    centerEmpty: { flex: 1, paddingHorizontal: 28, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
    lockBadge: { backgroundColor: colors.success, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    lockText: { color: colors.successInk, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
    emptyTitle: { color: colors.bone, fontSize: 23, fontWeight: "800", textAlign: "center", marginTop: 18 },
    emptyCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },
    primaryButton: { backgroundColor: colors.success, borderRadius: 26, paddingHorizontal: 24, paddingVertical: 15, marginTop: 22 },
    primaryButtonText: { color: colors.successInk, fontSize: 15, fontWeight: "800" },
  });
}
