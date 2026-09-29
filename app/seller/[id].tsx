import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "../../lib/haptics";
import { getMarket, moneyInMarket } from "../../lib/markets";
import { hydrateFollowedSellers, isSellerFollowed, syncSellerFollow, toggleSellerFollow } from "../../lib/sellers";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { useMarketplaceSyncState, useWardrobe } from "../../lib/wardrobe";

export default function SellerProfile() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => make(colors, width), [colors, width]);
  const app = useUvel();
  const { id } = useLocalSearchParams<{ id: string }>();
  const routeId = typeof id === "string" ? id : "";
  const pieces = useWardrobe();
  const syncState = useMarketplaceSyncState();
  const [followed, setFollowed] = useState(false);
  const interactedWithSeller = useRef<string | null>(null);

  const listings = useMemo(
    () => routeId
      ? pieces
          .filter((piece) => piece.status === "listed" && !piece.sellerPaused && (piece.ownerId === routeId || piece.listedByUid === routeId))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      : [],
    [routeId, pieces],
  );
  const seller = listings[0];
  const sellerId = routeId || seller?.ownerId || seller?.listedByUid || "";
  const sellerName = seller?.ownerName || seller?.listedByName || "Uvel seller";
  const sellerLocation = seller?.country ? getMarket(seller.country).name : "";
  const market = getMarket(app.country);
  const isLoading = !seller && syncState === "loading";

  useEffect(() => {
    let current = true;
    interactedWithSeller.current = null;
    setFollowed(isSellerFollowed(sellerId));
    void hydrateFollowedSellers().then(() => {
      if (current && interactedWithSeller.current !== sellerId) {
        setFollowed(isSellerFollowed(sellerId));
      }
    });
    return () => {
      current = false;
    };
  }, [sellerId]);

  useEffect(() => {
    const imageUris = listings
      .slice(0, 8)
      .map((piece) => piece.photo)
      .filter((uri): uri is string => /^https?:\/\//i.test(uri));
    if (imageUris.length) void Image.prefetch(imageUris, "memory-disk").catch(() => undefined);
  }, [listings]);

  function toggleFollow() {
    if (!sellerId) return;
    interactedWithSeller.current = sellerId;
    const next = toggleSellerFollow(sellerId);
    setFollowed(next);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (app.uid) void syncSellerFollow(app.uid, sellerId, next);
  }

  function shareProfile() {
    if (!sellerId) return;
    void Share.share({ message: `${sellerName} on Uvel\nuvel://seller/${sellerId}` }).catch(() => undefined);
  }

  return (
    <View style={styles.page}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.navButton, pressed && styles.navPressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={23} color={colors.bone} />
        </Pressable>
        <Text style={styles.wordmark} accessibilityLabel="Uvel">uvel</Text>
        <Pressable
          onPress={shareProfile}
          disabled={!seller}
          hitSlop={10}
          style={({ pressed }) => [styles.navButton, !seller && styles.navDisabled, pressed && seller && styles.navPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Share ${sellerName}'s seller profile`}
          accessibilityState={{ disabled: !seller }}
        >
          <Ionicons name="share-outline" size={20} color={seller ? colors.bone : colors.subtle} />
        </Pressable>
      </View>

      {isLoading ? (
        <ProfileLoading styles={styles} colors={colors} topInset={insets.top} />
      ) : !seller ? (
        <ScrollView contentContainerStyle={[styles.emptyContent, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyIcon}>
            <Ionicons name="person-outline" size={25} color={colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>Seller unavailable</Text>
          <Text style={styles.emptyCopy}>This seller doesn’t have any active listings right now.</Text>
          <Pressable onPress={() => router.back()} style={styles.emptyBack} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.emptyBackText}>Go back</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileRow}>
            {seller.ownerPhoto ? (
              <Image
                cachePolicy="memory-disk"
                source={{ uri: seller.ownerPhoto }}
                style={styles.avatar}
                contentFit="cover"
                accessibilityLabel={`${sellerName}'s profile photo`}
              />
            ) : (
              <View style={styles.avatarFallback} accessibilityLabel={`${sellerName}'s profile photo placeholder`}>
                <Text style={styles.avatarInitials}>{initials(sellerName)}</Text>
              </View>
            )}
            <View style={styles.identity}>
              <Text style={styles.name} numberOfLines={1}>{sellerName}</Text>
              <Text style={styles.sellerType}>Independent seller</Text>
              <View style={styles.metaRow}>
                {sellerLocation ? <Ionicons name="location-outline" size={14} color={colors.subtle} /> : null}
                <Text style={styles.metaText} numberOfLines={1}>
                  {sellerLocation || "On Uvel"} <Text style={styles.metaDot}>·</Text> {listings.length} {listings.length === 1 ? "listing" : "listings"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={toggleFollow}
              style={({ pressed }) => [styles.followButton, followed && styles.followingButton, pressed && styles.actionPressed]}
              accessibilityRole="button"
              accessibilityLabel={followed ? `Unfollow ${sellerName}` : `Follow ${sellerName}`}
              accessibilityState={{ selected: followed }}
            >
              <Ionicons name={followed ? "checkmark" : "add"} size={19} color={followed ? colors.bone : colors.successInk} />
              <Text style={[styles.followText, followed && styles.followingText]}>{followed ? "Following" : "Follow"}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/ask/[id]", params: { id: seller.id } })}
              style={({ pressed }) => [styles.messageButton, pressed && styles.actionPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Message ${sellerName}`}
            >
              <Ionicons name="chatbubble-outline" size={18} color={colors.bone} />
              <Text style={styles.messageText}>Message</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />
          <View style={styles.listingsHeader}>
            <Text style={styles.sectionTitle}>Listings</Text>
            <Text style={styles.sectionCount}>{listings.length} {listings.length === 1 ? "piece" : "pieces"}</Text>
          </View>

          <View style={styles.grid}>
            {listings.map((piece) => {
              const liked = app.saved.includes(piece.id);
              const isMine = Boolean(app.uid) && (piece.ownerId === app.uid || piece.listedByUid === app.uid);
              const currency = piece.currency || getMarket(piece.country || app.country).currency;
              const price = moneyInMarket(piece.listPriceCents, currency, market);
              return (
                <View key={piece.id} style={styles.listingCard}>
                  <Pressable
                    onPress={() => router.push({ pathname: "/closet/[id]", params: { id: piece.id } })}
                    style={({ pressed }) => [styles.listingOpen, pressed && styles.listingPressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${piece.name}, ${price}. View listing.`}
                    accessibilityHint="Opens the listing details."
                  >
                    <View style={styles.photoFrame}>
                      {piece.photo ? (
                        <Image cachePolicy="memory-disk" source={{ uri: piece.photo }} style={styles.productPhoto} contentFit="cover" />
                      ) : (
                        <View style={styles.photoPlaceholder}>
                          <Ionicons name="image-outline" size={26} color={colors.subtle} />
                        </View>
                      )}
                    </View>
                    <View style={styles.listingInfo}>
                      <Text style={styles.listingName} numberOfLines={1}>{piece.name}</Text>
                      <Text style={styles.price}>{price}</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (isMine) return;
                      app.likePiece(piece.id);
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    disabled={isMine}
                    hitSlop={5}
                    style={styles.likeButton}
                    accessibilityRole="button"
                    accessibilityLabel={isMine ? `Likes on your listing ${piece.name}` : `${liked ? "Unlike" : "Like"} ${piece.name}`}
                    accessibilityState={{ selected: liked, disabled: isMine }}
                  >
                    <Ionicons name={liked ? "heart" : "heart-outline"} size={19} color={liked ? colors.success : isMine ? colors.subtle : colors.bone} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function ProfileLoading({ styles, colors }: { styles: ReturnType<typeof make>; colors: Colors; topInset: number }) {
  return (
    <View style={styles.loadingContent} accessibilityRole="progressbar" accessibilityLabel="Loading seller profile">
      <View style={styles.skeletonProfile}>
        <View style={[styles.skeletonAvatar, { backgroundColor: colors.surface }]} />
        <View style={styles.skeletonIdentity}>
          <View style={[styles.skeletonName, { backgroundColor: colors.surface }]} />
          <View style={[styles.skeletonLine, { backgroundColor: colors.surface }]} />
          <View style={[styles.skeletonLineShort, { backgroundColor: colors.surface }]} />
        </View>
      </View>
      <View style={styles.skeletonActions}>
        <View style={[styles.skeletonAction, { backgroundColor: colors.surface }]} />
        <View style={[styles.skeletonAction, { backgroundColor: colors.surface }]} />
      </View>
      <View style={styles.skeletonListings}>
        {Array.from({ length: 4 }, (_, index) => (
          <View key={index} style={[styles.skeletonCard, { backgroundColor: colors.surface }]} />
        ))}
      </View>
    </View>
  );
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "U";
}

function make(colors: Colors, windowWidth: number) {
  const horizontal = 20;
  const gap = 12;
  const columnWidth = Math.max(0, (windowWidth - horizontal * 2 - gap) / 2);
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    topBar: { paddingHorizontal: horizontal, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    navButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
    navDisabled: { opacity: 0.55 },
    navPressed: { backgroundColor: `${colors.bone}12` },
    wordmark: { color: colors.bone, fontSize: 23, fontWeight: "800", letterSpacing: -0.8 },
    content: { paddingHorizontal: horizontal, paddingTop: 12 },
    profileRow: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 96 },
    avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surface },
    avatarFallback: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}15`, alignItems: "center", justifyContent: "center" },
    avatarInitials: { color: colors.success, fontSize: 28, fontWeight: "800", letterSpacing: 0.4 },
    identity: { flex: 1, minWidth: 0, justifyContent: "center" },
    name: { color: colors.bone, fontSize: 23, lineHeight: 29, fontWeight: "800", letterSpacing: -0.45 },
    sellerType: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 1 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5, minWidth: 0 },
    metaText: { flexShrink: 1, color: colors.subtle, fontSize: 12, lineHeight: 17 },
    metaDot: { color: colors.success, fontWeight: "800" },
    actions: { flexDirection: "row", gap, marginTop: 20 },
    followButton: { flex: 1, minHeight: 48, paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    followingButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}35` },
    followText: { color: colors.successInk, fontSize: 14, fontWeight: "800" },
    followingText: { color: colors.bone },
    messageButton: { flex: 1, minHeight: 48, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderColor: `${colors.bone}40`, backgroundColor: `${colors.surface}66`, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    messageText: { color: colors.bone, fontSize: 14, fontWeight: "700" },
    actionPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: `${colors.bone}25`, marginTop: 22 },
    listingsHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 19, marginBottom: 12 },
    sectionTitle: { color: colors.bone, fontSize: 21, fontWeight: "800", letterSpacing: -0.25 },
    sectionCount: { color: colors.subtle, fontSize: 13 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap },
    listingCard: { width: columnWidth, borderRadius: 15, backgroundColor: colors.surface, overflow: "hidden" },
    listingOpen: { flex: 1 },
    listingPressed: { opacity: 0.9 },
    photoFrame: { width: "100%", aspectRatio: 0.82, backgroundColor: colors.surface },
    productPhoto: { width: "100%", height: "100%", backgroundColor: colors.surface },
    photoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
    listingInfo: { paddingHorizontal: 11, paddingTop: 9, paddingBottom: 12 },
    listingName: { color: colors.bone, fontSize: 13, lineHeight: 18, fontWeight: "600", paddingRight: 24 },
    price: { color: colors.success, fontSize: 14, lineHeight: 18, fontWeight: "800", marginTop: 3, fontVariant: ["tabular-nums"] },
    likeButton: { position: "absolute", top: 8, right: 8, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.42)" },
    emptyContent: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
    emptyIcon: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: `${colors.bone}20`, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    emptyTitle: { color: colors.bone, fontSize: 23, fontWeight: "800", marginTop: 17, textAlign: "center" },
    emptyCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: "center", maxWidth: 300 },
    emptyBack: { minHeight: 44, paddingHorizontal: 20, borderRadius: 14, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginTop: 22 },
    emptyBackText: { color: colors.bone, fontSize: 14, fontWeight: "700" },
    loadingContent: { paddingHorizontal: horizontal, paddingTop: 24 },
    skeletonProfile: { flexDirection: "row", alignItems: "center", gap: 16 },
    skeletonAvatar: { width: 84, height: 84, borderRadius: 42 },
    skeletonIdentity: { flex: 1, gap: 9 },
    skeletonName: { width: "75%", height: 22, borderRadius: 7 },
    skeletonLine: { width: "90%", height: 12, borderRadius: 6 },
    skeletonLineShort: { width: "60%", height: 12, borderRadius: 6 },
    skeletonActions: { flexDirection: "row", gap, marginTop: 20 },
    skeletonAction: { flex: 1, height: 48, borderRadius: 15 },
    skeletonListings: { flexDirection: "row", flexWrap: "wrap", gap, marginTop: 25 },
    skeletonCard: { width: columnWidth, aspectRatio: 0.65, borderRadius: 15 },
  });
}
