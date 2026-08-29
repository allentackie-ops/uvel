import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActionSheetIOS, Alert, Dimensions, Platform,  ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../../components/AccessiblePressable";
import { BrandBanner } from "../../components/BrandBanner";
import { BrandPageSkeleton } from "../../components/ScreenSkeletons";
import { ListingCard } from "../../components/ListingCard";
import { VerifiedMark } from "../../components/VerifiedMark";
import {
  brandListings,
  canAccessHQ,
  canManageTeam,
  canPost,
  canSeeAnalytics,
  canStudio,
  getBrand,
  useBrandsHydrated,
  isFollowing,
  roleOn,
  themeFor,
  toggleFollow,
  useBrands,
} from "../../lib/brands";
import { usd } from "../../lib/catalog";
import { recordAnalyticsEvent } from "../../lib/analytics";
import { useUvel } from "../../lib/store";
import { useColors } from "../../lib/theme";
import { getPiece, useWardrobe } from "../../lib/wardrobe";
import { recordCampaignAttribution } from "../../lib/attribution";
import { useLiveCampaigns } from "../../lib/marketing";

const W = Dimensions.get("window").width;
const COL = (W - 48) / 2;

export default function BrandPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBrands();
  const brandsReady = useBrandsHydrated();
  useWardrobe();
  const app = useUvel();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const brand = getBrand(id);
  const liveCampaigns = useLiveCampaigns(id || "");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id || !app.uid) return;
    void recordAnalyticsEvent({ type: "brand_view", brandId: id }).catch(() => undefined);
  }, [id, app.uid]);

  const theme = brand ? themeFor(brand) : null;
  const listings = useMemo(() => (id ? brandListings(id) : []), [id, tick, brand?.id]);
  const collections = useMemo(() => {
    const map = new Map<string, typeof listings>();
    for (const p of listings) {
      const arr = map.get(p.category) || [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return Array.from(map.entries()).map(([cat, items]) => ({ cat, items }));
  }, [listings]);
  const featured = collections[0]?.items[0];
  const visibleCampaigns = liveCampaigns.filter((campaign) => campaign.channel === "brand_page" && (!campaign.startAt || campaign.startAt <= Date.now()) && (!campaign.endAt || campaign.endAt >= Date.now()));
  const following = brand ? isFollowing(brand.id, app.uid) : false;
  const poster = brand ? canPost(brand, app.uid) : false;
  const owner = brand ? canStudio(brand, app.uid) : false;
  const workspace = brand ? canAccessHQ(brand, app.uid) : false;
  const manager = brand ? canManageTeam(brand, app.uid) : false;
  const role = brand ? roleOn(brand, app.uid) : null;

  useEffect(() => {
    if (!app.uid || !brand) return;
    visibleCampaigns.forEach((campaign) => { void recordCampaignAttribution({ brandId: brand.id, campaignId: campaign.id, channel: "brand_page", type: "impression", collectionId: campaign.collectionId, promotionId: campaign.promotionId }).catch(() => undefined); });
  }, [app.uid, brand?.id, visibleCampaigns.map((campaign) => campaign.id).join("|")]);

  if (!brandsReady) return <BrandPageSkeleton colors={colors} />;

  if (!brand || !theme) {
    return (
      <View style={[styles.missing, { paddingTop: insets.top + 20 }]}>
        <AccessiblePressable onPress={() => router.back()}>
          <Text style={{ color: "#F4F0E6", fontSize: 16 }}>‹ Back</Text>
        </AccessiblePressable>
        <Text style={styles.missingH}>This house isn’t here</Text>
      </View>
    );
  }

  const activeBrand = brand;

  function more() {
    const options = ["Share", ...(workspace ? ["Brand HQ"] : []), ...(manager ? ["Invite team"] : []), ...(canSeeAnalytics(activeBrand, app.uid) ? ["Analytics"] : []), "Cancel"];
    const run = (label: string) => {
      if (label === "Share") {
        void Share.share({ message: `${activeBrand.name} on Uvel  uvel://brand/${activeBrand.id}` });
        return;
      }
      if (label === "Brand HQ") router.push({ pathname: "/brand/hq", params: { id: activeBrand.id } });
      if (label === "Invite team") router.push({ pathname: "/brand/invite", params: { id: activeBrand.id } });
      if (label === "Analytics") router.push({ pathname: "/brand/analytics", params: { id: activeBrand.id } });
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, userInterfaceStyle: "dark" }, (i) => {
        if (i >= 0 && options[i] !== "Cancel") run(options[i]);
      });
      return;
    }
    Alert.alert(activeBrand.name, undefined, [
      ...options.filter((o) => o !== "Cancel").map((o) => ({ text: o, onPress: () => run(o) })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  function openLatest() {
    const item = listings[0] || featured;
    if (item) router.push({ pathname: "/closet/[id]", params: { id: item.id } });
  }

  function openRack() {
    const item = collections[0]?.items[0];
    if (item) router.push({ pathname: "/closet/[id]", params: { id: item.id } });
  }

  function listingActions(item: (typeof listings)[number]) {
    const options = ["Open listing", "Share listing", "Cancel"];
    const run = (label: string) => {
      if (label === "Open listing") {
        router.push({ pathname: "/closet/[id]", params: { id: item.id } });
        return;
      }
      if (label === "Share listing") {
        void Share.share({ message: `${item.name} on Uvel  uvel://piece/${item.id}` });
      }
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1, userInterfaceStyle: "dark" },
        (i) => {
          if (i >= 0 && options[i] !== "Cancel") run(options[i]);
        },
      );
      return;
    }
    Alert.alert(item.name, undefined, [
      ...options.filter((o) => o !== "Cancel").map((o) => ({ text: o, onPress: () => run(o) })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View>
          <BrandBanner uri={brand.bannerUri} kind={brand.bannerKind} style={[styles.banner, { backgroundColor: theme.bg }]} />
          <View style={[styles.nav, { top: insets.top + 4 }]}>
            <AccessiblePressable              onPress={() => router.back()}
              style={({ pressed }) => [styles.orb, { backgroundColor: "rgba(0,0,0,0.42)" }, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.orbTxt}>‹</Text>
            </AccessiblePressable>
            <AccessiblePressable              onPress={more}
              style={({ pressed }) => [styles.orb, { backgroundColor: "rgba(0,0,0,0.42)" }, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel="More brand actions"
            >
              <Text style={[styles.orbTxt, { fontSize: 18, marginTop: -6 }]}>· · ·</Text>
            </AccessiblePressable>
          </View>
          {brand.logoUri ? (
            <Image source={{ uri: brand.logoUri }} style={[styles.logo, { borderColor: theme.bg }]} contentFit="cover" />
          ) : (
            <View style={[styles.logo, { borderColor: theme.bg, backgroundColor: theme.card, alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ color: theme.ink, fontWeight: "800", fontSize: 22 }}>{brand.name[0]}</Text>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 56 }}>
          <Text style={[styles.kicker, { color: theme.muted }]}>{brand.reviewStatus === "uvel_reviewed" && brand.verified ? "UVEL-REVIEWED BRAND" : brand.reviewStatus === "human_review" ? "BRAND · HUMAN REVIEW" : brand.reviewStatus === "needs_information" ? "BRAND · INFORMATION NEEDED" : "BRAND · IN REVIEW"}</Text>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.ink }]}>{brand.name}</Text>
            {brand.verified ? <VerifiedMark size={20} /> : null}
          </View>
          <Text style={[styles.handle, { color: theme.muted }]}>@{brand.handle}</Text>
          {brand.tagline ? <Text style={[styles.tagline, { color: theme.ink }]}>{brand.tagline}</Text> : null}
          <Text style={[styles.owner, { color: theme.muted }]}>
            Owner · {brand.legalName || brand.ownerName}
            {role === "poster" ? "  ·  You post here" : role === "owner" ? "  ·  You" : ""}
          </Text>

          <View style={styles.actions} accessibilityLabel={`${brand.name} actions`}>
            <AccessiblePressable              onPress={() => {
                const nowFollowing = toggleFollow(brand.id, app.uid || "me");
                setTick((n) => n + 1);
                if (app.uid) {
                  void recordAnalyticsEvent({
                    type: nowFollowing ? "brand_follow" : "brand_unfollow",
                    brandId: brand.id,
                  }).catch(() => undefined);
                }
              }}
              style={({ pressed }) => [styles.follow, { backgroundColor: following ? theme.card : theme.accent }, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel={following ? `Unfollow ${brand.name}` : `Follow ${brand.name}`}
              accessibilityState={{ selected: following }}
            >
              <Text style={[styles.followTxt, { color: following ? theme.ink : theme.accentInk }]}>{following ? "Following" : "Follow"}</Text>
            </AccessiblePressable>
            {poster ? (
              <AccessiblePressable                onPress={() => router.push({ pathname: "/brand/list", params: { id: brand.id } })}
                style={({ pressed }) => [styles.ghost, { borderColor: theme.lineColor }, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel={`List an item for ${brand.name}`}
              >
                <Text style={[styles.ghostTxt, { color: theme.ink }]}>List an item</Text>
              </AccessiblePressable>
            ) : null}
          </View>
        </View>

        {visibleCampaigns.length ? (
          <View style={{ marginTop: 28 }}>
            <Text style={[styles.meta, { color: theme.muted, paddingHorizontal: 20 }]}>LIVE CAMPAIGN</Text>
            {visibleCampaigns.slice(0, 3).map((campaign) => {
              const lead = campaign.productIds.map((productId) => getPiece(productId)).find(Boolean);
              return <AccessiblePressable key={campaign.id} onPress={() => { void recordCampaignAttribution({ brandId: brand.id, campaignId: campaign.id, channel: "brand_page", type: "engagement", collectionId: campaign.collectionId, promotionId: campaign.promotionId, listingId: lead?.id }).catch(() => undefined); if (lead) router.push({ pathname: "/closet/[id]", params: { id: lead.id, campaignId: campaign.id, collectionId: campaign.collectionId || "", promotionId: campaign.promotionId || "", campaignChannel: "brand_page" } }); }} style={({ pressed }) => [styles.campaignCard, { backgroundColor: theme.card }, pressed && { opacity: 0.92 }]} accessibilityRole="button" accessibilityLabel={`Explore ${brand.name} campaign ${campaign.headline || campaign.name}`} accessibilityHint="Double tap to explore this drop.">{lead?.photo ? <Image source={{ uri: lead.photo }} style={styles.campaignImg} contentFit="cover" accessible={false} /> : null}<View style={{ flex: 1 }}><Text style={[styles.dropTitle, { color: theme.ink }]} numberOfLines={2}>{campaign.headline}</Text><Text style={[styles.dropSub, { color: theme.muted }]} numberOfLines={2}>{campaign.body || campaign.name}</Text></View><Text style={[styles.chev, { color: theme.muted }]}>›</Text></AccessiblePressable>;
            })}
          </View>
        ) : null}

        {featured ? (
          <View style={{ marginTop: 28 }}>
            <Text style={[styles.meta, { color: theme.muted, paddingHorizontal: 20 }]}>UPDATED DROP</Text>
            <Text style={[styles.dropTitle, { color: theme.ink, paddingHorizontal: 20 }]}>{collections[0].cat}</Text>
            <Text style={[styles.dropSub, { color: theme.muted, paddingHorizontal: 20 }]}>{brand.name}</Text>
            <AccessiblePressable              onPress={() => router.push({ pathname: "/closet/[id]", params: { id: featured.id } })}
              style={({ pressed }) => [styles.heroCard, { backgroundColor: theme.card }, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${featured.name} from ${brand.name}`}
              accessibilityHint="Double tap to view this listing."
            >
              <View style={styles.heroCopy}>
                <Text style={[styles.heroName, { color: theme.ink }]} numberOfLines={2}>
                  {featured.name}
                </Text>
                <Text style={[styles.heroP, { color: theme.muted }]} numberOfLines={3}>
                  {featured.notes || brand.tagline}
                </Text>
              </View>
              <Image source={{ uri: featured.photo }} style={styles.heroImg} contentFit="cover" accessible={false} />
            </AccessiblePressable>
          </View>
        ) : null}

          <AccessiblePressable            onPress={openLatest}
            style={({ pressed }) => [styles.sectionHead, pressed && { opacity: 0.92 }]}
            disabled={!listings.length && !featured}
            accessibilityRole="button"
            accessibilityLabel="Open latest listings"
            accessibilityState={{ disabled: !listings.length && !featured }}
          >
            <Text style={[styles.section, { color: theme.ink }]}>Latest</Text>
            <Text style={[styles.chev, { color: theme.muted }]}>›</Text>
          </AccessiblePressable>
        {listings.length ? (
          listings.slice(0, 8).map((p) => (
            <AccessiblePressable              key={p.id}
              onPress={() => router.push({ pathname: "/closet/[id]", params: { id: p.id } })}
              style={({ pressed }) => [styles.row, { borderBottomColor: theme.lineColor }, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${p.name}, ${usd(p.listPriceCents, p.currency)}`}
              accessibilityHint="Double tap to view this listing."
            >
              <Image source={{ uri: p.photo }} style={styles.thumb} contentFit="cover" accessible={false} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: theme.ink }]} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={[styles.rowSub, { color: theme.muted }]} numberOfLines={1}>
                  {(p.sizes?.length ? p.sizes.join("  ") : p.size) + "  ·  " + usd(p.listPriceCents, p.currency)}
                </Text>
              </View>
              <AccessiblePressable                onPress={() => listingActions(p)}
                hitSlop={10}
                style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel={`More actions for ${p.name}`}
              >
                <Text style={[styles.more, { color: theme.muted }]}>· · ·</Text>
              </AccessiblePressable>
            </AccessiblePressable>
          ))
        ) : (
          <Text style={[styles.empty, { color: theme.muted }]}>
            {brand.verified && brand.reviewStatus === "uvel_reviewed" ? "Nothing listed yet." : "Uvel review is required before this brand can post publicly."}
          </Text>
        )}

        {collections.length ? (
          <View>
            <AccessiblePressable onPress={openRack} style={styles.sectionHead}>
              <Text style={[styles.section, { color: theme.ink }]}>The rack</Text>
              <Text style={[styles.chev, { color: theme.muted }]}>›</Text>
            </AccessiblePressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playlists}>
              {collections.map((c) => (
                <View key={c.cat} style={[styles.play, { backgroundColor: theme.card }]}>
                  <Image source={{ uri: c.items[0].photo }} style={styles.playImg} contentFit="cover" />
                  <Text style={[styles.playName, { color: theme.ink }]} numberOfLines={1}>
                    {c.cat}
                  </Text>
                  <Text style={[styles.playN, { color: theme.muted }]}>
                    {c.items.length} piece{c.items.length === 1 ? "" : "s"}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {listings.length > 3 ? (
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <View style={styles.grid}>
              {listings.map((p) => (
                <View key={p.id} style={{ width: COL }}>
                  <ListingCard piece={p} framed wide={COL} />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {brand.story ? (
          <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
            <Text style={[styles.section, { color: theme.ink }]}>About</Text>
            <Text style={[styles.story, { color: theme.muted }]}>{brand.story}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, backgroundColor: "#0B0A08", paddingHorizontal: 20 },
  missingH: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 28, marginTop: 24 },
  banner: { width: W, height: 280, backgroundColor: "#161512" },
  nav: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  focused: { borderWidth: 2, borderColor: "#D6E27A" },
  orb: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  orbTxt: { color: "#FFFFFF", fontSize: 26, lineHeight: 28, marginTop: -2 },
  logo: {
    position: "absolute",
    left: 20,
    bottom: -36,
    width: 88,
    height: 88,
    borderRadius: 22,
    borderWidth: 4,
    backgroundColor: "#161512",
  },
  kicker: { letterSpacing: 1.6, fontSize: 11, fontWeight: "700" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  name: { fontFamily: "Georgia", fontSize: 34, lineHeight: 38, flexShrink: 1 },
  handle: { fontSize: 15, marginTop: 6 },
  tagline: { fontSize: 17, lineHeight: 24, marginTop: 12 },
  owner: { fontSize: 14, marginTop: 10 },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  follow: { minHeight: 44, paddingHorizontal: 22, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  followTxt: { fontWeight: "800", fontSize: 14 },
  ghost: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostTxt: { fontWeight: "700", fontSize: 14 },
  meta: { fontSize: 11, letterSpacing: 1.4, fontWeight: "700" },
  dropTitle: { fontSize: 22, fontWeight: "700", marginTop: 4 },
  dropSub: { fontSize: 15, marginTop: 2, marginBottom: 12 },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: "hidden",
    flexDirection: "row",
    minHeight: 180,
  },
  heroCopy: { flex: 1, padding: 16, justifyContent: "flex-end" },
  heroName: { fontFamily: "Georgia", fontSize: 22, lineHeight: 26 },
  heroP: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  heroImg: { width: W * 0.42, minHeight: 180 },
  campaignCard: { marginHorizontal: 20, borderRadius: 16, padding: 10, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 92 },
  campaignImg: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#1A1915" },
  sectionHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginTop: 32, marginBottom: 8, gap: 6 },
  section: { fontSize: 22, fontWeight: "700" },
  chev: { fontSize: 26, marginTop: -2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 48, height: 48, borderRadius: 6, backgroundColor: "#1A1915" },
  rowName: { fontSize: 16, fontWeight: "600" },
  rowSub: { fontSize: 13, marginTop: 3 },
  moreBtn: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  more: { fontSize: 16 },
  empty: { paddingHorizontal: 20, fontSize: 15, lineHeight: 22 },
  playlists: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  play: { width: 148, borderRadius: 14, overflow: "hidden" },
  playImg: { width: 148, height: 148, backgroundColor: "#1A1915" },
  playName: { fontWeight: "700", fontSize: 14, paddingHorizontal: 10, paddingTop: 10 },
  playN: { fontSize: 12, paddingHorizontal: 10, paddingBottom: 12, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  story: { fontSize: 15, lineHeight: 22, marginTop: 8 },
});
