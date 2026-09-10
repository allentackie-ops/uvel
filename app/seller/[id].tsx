import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ListingCard } from "../../components/ListingCard";
import { getMarket } from "../../lib/markets";
import { hydrateFollowedSellers, isSellerFollowed, toggleSellerFollow } from "../../lib/sellers";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { useWardrobe, type ClosetPiece } from "../../lib/wardrobe";

export default function SellerProfile() {
  const colors = useColors();
  const styles = make(colors);
  const app = useUvel();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pieces = useWardrobe();
  const [followed, setFollowed] = useState(false);

  const listings = useMemo(
    () => pieces.filter((piece) => piece.status === "listed" && (piece.ownerId === id || piece.listedByUid === id)),
    [id, pieces],
  );
  const seller = listings[0];
  const sellerName = seller?.ownerName || seller?.listedByName || "Uvel seller";
  const sellerPhoto = seller?.ownerPhoto;
  const sellerLocation = seller?.country ? getMarket(seller.country).name : "Independent seller";

  useEffect(() => {
    void hydrateFollowedSellers().then(() => setFollowed(isSellerFollowed(id || "")));
  }, [id]);

  if (!seller) {
    return (
      <View style={styles.emptyPage}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.bone} />
        </Pressable>
        <Text style={styles.emptyTitle}>Seller unavailable</Text>
        <Text style={styles.emptyCopy}>This seller no longer has active listings on Uvel.</Text>
      </View>
    );
  }

  function toggle() {
    setFollowed(toggleSellerFollow(id || seller.ownerId || ""));
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.bone} />
        </Pressable>
        <View style={styles.profileHeader}>
          {sellerPhoto ? <Image source={{ uri: sellerPhoto }} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{sellerName.slice(0, 1).toUpperCase()}</Text></View>}
          <Text style={styles.kicker}>UVEL SELLER</Text>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{sellerName}</Text>
          </View>
          <Text style={styles.location}>{sellerLocation} · {listings.length} {listings.length === 1 ? "listing" : "listings"}</Text>
          <Text style={styles.bio}>Independent seller on Uvel. Ask a question about fit, condition, or shipping before you buy.</Text>
          <View style={styles.actions}>
            <Pressable onPress={toggle} style={[styles.followButton, followed && styles.followingButton]} accessibilityRole="button" accessibilityLabel={followed ? `Unfollow ${sellerName}` : `Follow ${sellerName}`} accessibilityState={{ selected: followed }}>
              <Ionicons name={followed ? "checkmark" : "add"} size={17} color={followed ? colors.bone : colors.ink} />
              <Text style={[styles.followText, followed && styles.followingText]}>{followed ? "Following" : "Follow"}</Text>
            </Pressable>
            <Pressable onPress={() => router.push({ pathname: "/ask/[id]", params: { id: seller.id } })} style={styles.messageButton} accessibilityRole="button" accessibilityLabel={`Message ${sellerName}`}>
              <Ionicons name="chatbubble-outline" size={17} color={colors.bone} />
              <Text style={styles.messageText}>Message</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.rule} />
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>From {sellerName}</Text>
          <Text style={styles.sectionCount}>{listings.length}</Text>
        </View>
        <View style={styles.grid}>
          {listings.map((piece) => <View key={piece.id} style={styles.gridCell}><ListingCard piece={piece} framed /></View>)}
        </View>
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: 48 },
    emptyPage: { flex: 1, backgroundColor: colors.ink, padding: 20, paddingTop: 58 },
    backButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: `${colors.bone}25`, alignItems: "center", justifyContent: "center" },
    profileHeader: { alignItems: "center", paddingTop: 20 },
    avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface },
    avatarFallback: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    avatarInitial: { color: colors.ink, fontSize: 34, fontWeight: "800" },
    kicker: { color: colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.8, marginTop: 18 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 },
    name: { color: colors.bone, fontFamily: "Georgia", fontSize: 29, textAlign: "center" },
    location: { color: colors.subtle, fontSize: 13, marginTop: 8 },
    bio: { maxWidth: 330, color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 16 },
    actions: { flexDirection: "row", gap: 10, marginTop: 20 },
    followButton: { minHeight: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    followingButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}30` },
    followText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
    followingText: { color: colors.bone },
    messageButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, borderColor: `${colors.bone}30`, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    messageText: { color: colors.bone, fontSize: 13, fontWeight: "800" },
    rule: { height: 1, backgroundColor: `${colors.bone}20`, marginTop: 30 },
    sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 24, marginBottom: 14 },
    sectionTitle: { color: colors.bone, fontFamily: "Georgia", fontSize: 23 },
    sectionCount: { color: colors.subtle, fontSize: 13 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    gridCell: { width: "47%", flexGrow: 1 },
    emptyTitle: { color: colors.bone, fontFamily: "Georgia", fontSize: 28, marginTop: 34 },
    emptyCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
  });
}
