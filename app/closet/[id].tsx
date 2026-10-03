import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { Alert, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotionClip } from "../../components/MotionClip";
import { TodayListingOverlay } from "../../components/TodayListingOverlay";
import { recordAnalyticsEvent } from "../../lib/analytics";
import { getBrand, themeFor, useBrands } from "../../lib/brands";
import { usd } from "../../lib/catalog";
import { getMarket } from "../../lib/markets";
import { shopLookOf } from "../../lib/shopLook";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { getPiece, markSold, recordPieceView, unlistPiece, updatePiece, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";

const W = Dimensions.get("window").width;

function isMine(piece: ClosetPiece, uid: string) {
  return Boolean(uid) && Boolean(piece.ownerId) && piece.ownerId === uid;
}

function OwnerListing({ piece, insets, onBack }: { piece: ClosetPiece; insets: { top: number; bottom: number }; onBack: () => void }) {
  const colors = useColors();
  const app = useUvel();
  const styles = useMemo(() => ownerStyles(colors), [colors]);
  const look = shopLookOf(piece.shopLook);
  const gallery = piece.photos?.length ? piece.photos : piece.photo ? [piece.photo] : [];

  const onFloor = piece.status === "listed";
  const sold = piece.status === "sold";
  const status = sold ? "Sold" : onFloor ? "In the shop" : "Not listed";

  useEffect(() => {
    const patch: Partial<ClosetPiece> = {};
    if (app.uid && piece.ownerId !== app.uid) patch.ownerId = app.uid;
    if (app.displayName && piece.ownerName !== app.displayName) patch.ownerName = app.displayName;
    const face = app.avatarUri;
    if (face && piece.ownerPhoto !== face) patch.ownerPhoto = face;
    if (Object.keys(patch).length) updatePiece(piece.id, patch);
  }, [app.uid, app.displayName, app.personUri, app.avatarUri, piece.id, piece.ownerId, piece.ownerName, piece.ownerPhoto]);

  function takeDown() {
    Alert.alert("Take off the floor?", "Buyers won’t see this listing until you list it again.", [
      { text: "Keep it up", style: "cancel" },
      { text: "Take down", onPress: () => unlistPiece(piece.id) },
    ]);
  }

  function soldIt() {
    Alert.alert("Mark as sold?", "It leaves the shop.", [
      { text: "Cancel", style: "cancel" },
      { text: "Mark sold", onPress: () => markSold(piece.id) },
    ]);
  }

  return (
    <View style={styles.page}>
      <StatusBar style={colors.bone === "#F4F0E6" ? "light" : "dark"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.heroWrap, { marginTop: insets.top }]}>
          {piece.clipUri ? (
            <MotionClip uri={piece.clipUri} style={StyleSheet.absoluteFill} />
          ) : (
            <Image cachePolicy="memory-disk" source={{ uri: gallery[0] }} style={StyleSheet.absoluteFill} contentFit="cover" />
          )}
          <View style={styles.heroScrim} pointerEvents="none" />
          <Pressable onPress={onBack} style={[styles.iconBtn, { top: 8 }]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.iconTxt}>‹</Text>
          </Pressable>
          <View style={[styles.badge, { top: 16 }]}>
            <Text style={styles.badgeTxt}>{status}</Text>
          </View>
          {piece.brandId && typeof piece.stockQuantity === "number" && piece.stockQuantity > 0 && piece.stockQuantity <= 10 ? (
            <View style={[styles.stockBadge, { bottom: 14 }]}>
              <Text style={styles.stockBadgeTxt}>{piece.stockQuantity} remaining</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{piece.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{usd(piece.listPriceCents, piece.currency || "USD")}</Text>
            <Text style={styles.priceLabel}>asking price</Text>
          </View>
          <View style={styles.metaGrid}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Details</Text>
              <Text style={styles.metaValue}>{[piece.size, piece.color].filter(Boolean).join(" · ") || "Not added"}</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Condition</Text>
              <Text style={styles.metaValue}>{piece.condition || "Not added"}</Text>
            </View>
          </View>
          <Text style={styles.shipping}>In the {getMarket(piece.country || app.country).name} store.</Text>
          {piece.shopLook && piece.shopLook !== "uvel" ? <Text style={styles.look}>Shop look · {look.name}</Text> : null}

          <View style={styles.managementCard}>
            <Text style={styles.managementKicker}>Manage listing</Text>
            <Text style={styles.managementCopy}>Update the details, check the buyer view, or change its shop status.</Text>
            <Pressable onPress={() => router.push({ pathname: "/sell", params: { id: piece.id, returnTo: "listing" } })} style={styles.edit} accessibilityRole="button" accessibilityLabel="Edit listing">
              <Text style={styles.editTxt}>Edit listing</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/closet/[id]", params: { id: piece.id, v: "buy" } })}
              style={styles.preview}
              accessibilityRole="button"
              accessibilityLabel="Preview as buyer"
            >
              <Text style={styles.previewTxt}>Preview as buyer</Text>
              <Text style={styles.previewArrow}>→</Text>
            </Pressable>
            {onFloor ? (
              <View style={styles.row}>
                <Pressable onPress={takeDown} style={styles.ghost} accessibilityRole="button" accessibilityLabel="Take down listing">
                  <Text style={styles.ghostTxt}>Take down</Text>
                </Pressable>
                <Pressable onPress={soldIt} style={styles.ghost} accessibilityRole="button" accessibilityLabel="Mark listing as sold">
                  <Text style={styles.ghostTxt}>Mark sold</Text>
                </Pressable>
              </View>
            ) : null}
            {!sold && piece.status === "owned" ? (
              <Pressable onPress={() => router.push({ pathname: "/sell", params: { id: piece.id } })} style={styles.ghost} accessibilityRole="button" accessibilityLabel="List this piece">
                <Text style={styles.ghostTxt}>List this piece</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function ClosetPiece() {
  const insets = useSafeAreaInsets();
  const { id, v } = useLocalSearchParams<{ id: string; v?: string }>();
  useWardrobe();
  useBrands();
  const app = useUvel();
  const colors = useColors();
  const piece = getPiece(id);
  const preview = v === "buy";
  const mine = Boolean(piece && isMine(piece, app.uid));

  useEffect(() => {
    if (!piece || !piece.brandId || !app.uid || (mine && !preview)) return;
    void recordAnalyticsEvent({
      type: "listing_view",
      brandId: piece.brandId,
      listingId: piece.id,
      listingName: piece.name,
      listingPhoto: piece.photo,
    }).catch(() => undefined);
  }, [piece?.id, piece?.brandId, piece?.name, piece?.photo, app.uid, mine, preview]);

  useEffect(() => {
    if (!piece || (mine && !preview)) return;
    recordPieceView(piece.id);
  }, [piece?.id, mine, preview]);

  if (!piece) {
    return (
      <View style={[styles.missingPage, { paddingTop: insets.top + 24, backgroundColor: colors.ink }]}>
        <Text style={[styles.missingText, { color: colors.bone }]}>That piece isn’t on the floor.</Text>
      </View>
    );
  }

  if (mine && !preview) {
    return <OwnerListing piece={piece} insets={insets} onBack={() => router.back()} />;
  }

  return (
    <TodayListingOverlay
      piece={piece}
      origin={{ x: W / 2, y: insets.top, width: 1, height: 1 }}
      onClose={() => router.back()}
      previewOnly={mine && preview}
    />
  );
}

const styles = StyleSheet.create({
  missingPage: { flex: 1, paddingHorizontal: 20 },
  missingText: { fontSize: 16, lineHeight: 23 },
});

function ownerStyles(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingBottom: 24 },
    heroWrap: { height: Math.round(W * 1.05), backgroundColor: colors.surface, overflow: "hidden" },
    heroScrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.12)" },
    iconBtn: {
      position: "absolute",
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(18,17,14,0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
    iconTxt: { color: "#F4F0E6", fontSize: 28, lineHeight: 30, marginTop: -2 },
    badge: {
      position: "absolute",
      right: 16,
      backgroundColor: "#D6E27A",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    badgeTxt: { color: "#16140F", fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
    stockBadge: { position: "absolute", left: 16, backgroundColor: "rgba(18,17,14,0.72)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, zIndex: 4 },
    stockBadgeTxt: { color: "#F4F0E6", fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
    body: { paddingHorizontal: 20, paddingTop: 24 },
    title: { color: colors.bone, fontSize: 30, lineHeight: 36, fontWeight: "800", marginTop: 0 },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 10 },
    price: { color: colors.bone, fontWeight: "800", fontSize: 28, letterSpacing: -0.4 },
    priceLabel: { color: colors.muted, fontSize: 12 },
    metaGrid: { flexDirection: "row", gap: 8, marginTop: 22 },
    metaCard: { flex: 1, minHeight: 70, borderRadius: 16, backgroundColor: colors.surface, padding: 12 },
    metaLabel: { color: colors.subtle, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: "700" },
    metaValue: { color: colors.bone, fontSize: 14, fontWeight: "700", marginTop: 8 },
    shipping: { color: colors.muted, fontSize: 13, marginTop: 14 },
    look: { color: colors.subtle, fontSize: 12, marginTop: 8 },
    managementCard: { marginTop: 28, padding: 16, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}14`, gap: 10 },
    managementKicker: { color: colors.bone, fontSize: 15, fontWeight: "800" },
    managementCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 4 },
    edit: {
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    editTxt: { color: colors.successInk, fontWeight: "800", fontSize: 16 },
    preview: {
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: `${colors.bone}38`,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    previewTxt: { color: colors.bone, fontWeight: "700", fontSize: 15 },
    previewArrow: { color: colors.success, fontSize: 22, fontWeight: "700" },
    row: { flexDirection: "row", gap: 8 },
    ghost: {
      flex: 1,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.ink,
      alignItems: "center",
      justifyContent: "center",
    },
    ghostTxt: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  });
}
