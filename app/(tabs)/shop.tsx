import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../../components/AccessiblePressable";
import { ListingCard } from "../../components/ListingCard";
import { TodayListingOverlay, type ListingOrigin } from "../../components/TodayListingOverlay";
import { TodayCartFab } from "../../components/TodayCartFab";
import { OrbitLoader, useMinHold } from "../../components/OrbitLoader";
import { ShopSkeleton } from "../../components/ScreenSkeletons";
import { recordCampaignAttribution } from "../../lib/attribution";
import { BrandVerifiedMark } from "../../components/VerifiedMark";
import { followedBrandIds, getBrand, verifiedBrands, useBrands, brandCheck } from "../../lib/brands";
import { CATEGORIES } from "../../lib/catalog";
import { forYou, lensScan, matchListings } from "../../lib/lookMatch";
import { dnaFrom } from "../../lib/styleDna";
import { watchLookScan, finishLookScan, clearLookScan, type LookScan } from "../../lib/lookSearch";
import { useUvel } from "../../lib/store";
import { useCopy } from "../../lib/useCopy";
import { useColors, type Colors } from "../../lib/theme";
import { bundledLooks } from "../../lib/trends";
import { useLiveShopCampaigns } from "../../lib/marketing";
import { getPiece, refreshMarketplaceListings, shopFloor, useMarketplaceSyncState, useWardrobe, useWardrobeHydrated, type ClosetPiece } from "../../lib/wardrobe";
import { unreadFor, useInbox } from "../../lib/chat";
import { usePersonalization } from "../../lib/personalization";
import { useFirstFind } from "../../lib/firstFind";
import { getMarket, moneyExact } from "../../lib/markets";

const MIN_REFRESH_MS = 1200;
const ORBIT_SLOT = 96;

const orbitTop = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  alignItems: "center" as const,
  zIndex: 40,
  elevation: 40,
};

function FrozenClip({
  uri,
  time,
  style,
}: {
  uri: string;
  time: number;
  style: object;
}) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = false;
    p.muted = true;
    p.audioMixingMode = "mixWithOthers";
    p.currentTime = time;
  });

  useEffect(() => {
    let gone = false;
    const apply = () => {
      player.currentTime = time;
      player.pause();
    };
    const sub = player.addListener("statusChange", ({ status }) => {
      if (status !== "readyToPlay") return;
      apply();
      void player
        .generateThumbnailsAsync([time], { maxWidth: 720, maxHeight: 1280 })
        .then(async (thumbs) => {
          const thumb = thumbs[0];
          if (!thumb || gone) return;
          const image = await ImageManipulator.manipulate(thumb).renderAsync();
          const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
          const frame = saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : saved.uri;
          if (!gone && frame) finishLookScan(frame);
        })
        .catch(() => undefined);
    });
    apply();
    return () => {
      gone = true;
      sub.remove();
    };
  }, [player, time]);

  return (
    <View style={[style, { overflow: "hidden" }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
    </View>
  );
}

export default function Shop({ todayHome = false, onOpenTools }: { todayHome?: boolean; onOpenTools?: () => void }) {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const C = useCopy();
  const { country, styles: taste } = app;
  const market = getMarket(country);
  const { q: qParam, look: lookParam, scan } = useLocalSearchParams<{ q?: string; look?: string; scan?: string }>();
  const chats = useInbox(app.uid || "me");
  const unread = chats.reduce((count, thread) => count + unreadFor(thread, app.uid || "me"), 0);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const [aiIds, setAiIds] = useState<string[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [job, setJob] = useState<LookScan | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [feedEpoch, setFeedEpoch] = useState(0);
  const frozenOrder = useRef<string[] | null>(null);
  const [openPiece, setOpenPiece] = useState<ClosetPiece | null>(null);
  const [openOrigin, setOpenOrigin] = useState<ListingOrigin | null>(null);
  const [findHint, setFindHint] = useState(false);
  useWardrobe();
  const wardrobeReady = useWardrobeHydrated();
  const brandState = useBrands();
  const followedIds = useMemo(() => followedBrandIds(app.uid), [brandState, app.uid]);
  const followedKey = followedIds.join("|");
  const personalization = usePersonalization(app.uid || "guest");
  const firstFind = useFirstFind();
  const dna = useMemo(
    () => dnaFrom(app),
    [app.archetype, app.palette, app.silhouette, app.styles, app.gender],
  );
  const openTodayListing = useCallback((piece: ClosetPiece, origin: ListingOrigin) => {
    setOpenOrigin(origin);
    setOpenPiece(piece);
  }, []);
  useEffect(() => {
    if (!findHint) return;
    const timer = setTimeout(() => setFindHint(false), 3200);
    return () => clearTimeout(timer);
  }, [findHint]);
  const houses = verifiedBrands();

  useEffect(() => {
    if (!app.hydrated) return;
    app.seedSavedLikes();
  }, [app.hydrated, app.saved.join("|")]);

  const look = useMemo(
    () => (typeof lookParam === "string" ? bundledLooks().find((l) => l.id === lookParam) : undefined),
    [lookParam],
  );

  useEffect(() => {
    if (scan === "1") {
      setQ("");
      return;
    }
    if (typeof qParam === "string") setQ(qParam);
  }, [qParam, scan]);

  useEffect(() => {
    const stop = watchLookScan(setJob);
    return () => {
      stop();
      clearLookScan();
    };
  }, [lookParam, scan]);

  const frame = job?.frame || "";
  const videoUrl = job?.videoUrl || "";
  const freezeAt = job?.time || 0;
  const marketplaceSync = useMarketplaceSyncState();
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshMarketplaceListings(),
        new Promise<void>((resolve) => setTimeout(resolve, MIN_REFRESH_MS)),
      ]);
    } finally {
      frozenOrder.current = null;
      setFeedEpoch((n) => n + 1);
      setRefreshing(false);
    }
  }, []);

  const openVisualSearch = useCallback(() => {
    Alert.alert("Search with a photo", "Take a picture or choose a fit from your camera roll.", [
      {
        text: "Take a photo",
        onPress: () => {
          void ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85, allowsEditing: false }).then((result) => {
            const image = result.canceled ? undefined : result.assets[0];
            if (image?.uri) router.push({ pathname: "/visual-search", params: { uri: image.uri } });
          }).catch(() => undefined);
        },
      },
      {
        text: "Choose from camera roll",
        onPress: () => {
          void ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, allowsEditing: false }).then((result) => {
            const image = result.canceled ? undefined : result.assets[0];
            if (image?.uri) router.push({ pathname: "/visual-search", params: { uri: image.uri } });
          }).catch(() => undefined);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, []);

  const orbitOn = useMinHold(refreshing, MIN_REFRESH_MS);
  const live = shopFloor(country);
  const liveCampaigns = useLiveShopCampaigns();
  const scanningLook = Boolean(scan === "1" || look || frame || videoUrl);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 3 || scanningLook) return;
    const timer = setTimeout(() => personalization.record("search", undefined, query), 700);
    return () => clearTimeout(timer);
  }, [q, scanningLook, personalization.record]);

  const shopCampaignRows = useMemo(() => liveCampaigns
    .filter((campaign) => campaign.channel === "shop" && (!campaign.startAt || campaign.startAt <= Date.now()) && (!campaign.endAt || campaign.endAt >= Date.now()))
    .map((campaign) => ({ campaign, lead: campaign.productIds.map((productId) => live.find((piece) => piece.id === productId) || getPiece(productId)).find(Boolean) }))
    .filter((row): row is { campaign: (typeof liveCampaigns)[number]; lead: (typeof live)[number] } => Boolean(row.lead))
    .slice(0, 6), [liveCampaigns, live]);

  useEffect(() => {
    if (!app.uid || scanningLook) return;
    const day = new Date().toISOString().slice(0, 10);
    shopCampaignRows.forEach(({ campaign }) => {
      void recordCampaignAttribution({ brandId: campaign.brandId, campaignId: campaign.id, channel: "shop", type: "impression", eventId: `shop_impression_${campaign.id}_${app.uid}_${day}` }).catch(() => undefined);
    });
  }, [app.uid, scanningLook, shopCampaignRows.map(({ campaign }) => campaign.id).join("|")]);

  useEffect(() => {
    if (!scanningLook) return;
    if (!frame) {
      setScanning(true);
      setAiIds(null);
      return;
    }
    if (!live.length) {
      setAiIds([]);
      setScanning(false);
      return;
    }
    let gone = false;
    setScanning(true);
    setAiIds(null);
    void lensScan(frame, live).then((hit) => {
      if (gone) return;
      setAiIds(hit?.ids ?? []);
      setScanning(false);
    });
    return () => {
      gone = true;
    };
  }, [frame, live.length, scanningLook]);

  const ranked = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const passQ = (p: (typeof live)[number]) => {
      if (cat !== "All" && p.category !== cat) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        p.brand.toLowerCase().includes(needle) ||
        p.color.toLowerCase().includes(needle) ||
        p.notes.toLowerCase().includes(needle)
      );
    };

    if (scanningLook) {
      const hit = new Set(aiIds ?? []);
      return live.filter((p) => hit.has(p.id)).filter(passQ);
    }

    const liveIds = new Set(live.map((p) => p.id));
    if (frozenOrder.current && frozenOrder.current.every((id) => !liveIds.has(id)) && live.length) {
      frozenOrder.current = null;
    }
    if (!frozenOrder.current && live.length) {
      const rows = look ? matchListings(look, live, taste, followedIds) : forYou(live, taste, country, followedIds);
      frozenOrder.current = personalization.rank(rows, country, dna).map((p) => p.id);
    }
    const byId = new Map(live.map((p) => [p.id, p]));
    return (frozenOrder.current || []).map((id) => byId.get(id)).filter((p): p is ClosetPiece => Boolean(p)).filter(passQ);
  }, [live, look, aiIds, q, cat, taste, country, scanningLook, followedKey, dna, personalization.rank, feedEpoch]);

  if (!wardrobeReady && !scanningLook) return <ShopSkeleton colors={colors} />;

  return (
    <View style={styles.page}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 + (orbitOn ? ORBIT_SLOT : 0) }]}
        alwaysBounceVertical
        bounces
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor="transparent"
            colors={["transparent"]}
            progressViewOffset={insets.top}
          />
        }
      >
      {todayHome ? (
        <View style={[styles.todayHeader, { paddingTop: 2 }]}>
          <AccessiblePressable
            onPress={() => onOpenTools?.()}
            style={({ pressed }) => [styles.headerSide, pressed && { opacity: 0.72 }]}
            accessibilityRole="button"
            accessibilityLabel="Open your Uvel workspace"
            accessibilityHint="Open Founder Studio, Brand HQ, and seller tools."
          >
            <View style={styles.menuIcon}><View style={styles.menuLine} /><View style={styles.menuLine} /><View style={styles.menuLine} /></View>
          </AccessiblePressable>
          <AccessiblePressable
            onPress={() => router.push("/store")}
            style={({ pressed }) => [styles.wordmarkButton, pressed && { opacity: 0.78 }]}
            accessibilityRole="button"
            accessibilityLabel="Uvel marketplace"
            accessibilityHint="Double tap to view marketplace settings."
          >
            <Text style={styles.wordmark}>uvel</Text>
            <Text style={styles.wordmarkChevron}>⌄</Text>
          </AccessiblePressable>
          <AccessiblePressable
            onPress={() => router.push("/inbox")}
            style={({ pressed }) => [styles.messageButton, pressed && { opacity: 0.84 }]}
            accessibilityRole="button"
            accessibilityLabel={`Messages${unread ? `, ${unread} unread` : ""}`}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.bone} />
            {unread ? <View style={styles.messageBadge}><Text style={styles.messageBadgeText}>{unread > 9 ? "9+" : unread}</Text></View> : null}
          </AccessiblePressable>
        </View>
      ) : (
        <View style={styles.titleRow}>
          <Text style={styles.title}>{scanningLook ? C.shopTheLook : C.shop}</Text>
        </View>
      )}
      {scanningLook ? (
        <Text style={styles.look}>{job?.title || look?.title || "This frame"}</Text>
      ) : !todayHome ? (
        <AccessiblePressable          onPress={() => router.push("/store")}
          style={({ pressed }) => [styles.store, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel={`Current shop: ${market.name}, ${market.currency}`}
          accessibilityHint="Double tap to change shop."
        >
          <Text style={styles.storeTxt}>
            {market.name} shop · {market.currency}{" "}
          </Text>
          <Text style={styles.storeGo}>Change</Text>
        </AccessiblePressable>
      ) : null}

      {todayHome && firstFind.remaining > 0 ? (
        <AccessiblePressable
          onPress={() => setFindHint(true)}
          style={styles.findLine}
          accessibilityRole="button"
          accessibilityLabel={`First Find ${moneyExact(firstFind.remaining, firstFind.currency)} on a matching piece`}
          accessibilityHint="Double tap to hear how First Find works."
        >
          <Text style={styles.findLineTxt}>
            First Find · <Text style={styles.findLineAmt}>{moneyExact(firstFind.remaining, firstFind.currency)}</Text> on a matching piece
          </Text>
        </AccessiblePressable>
      ) : null}

      {videoUrl ? (
        <FrozenClip uri={videoUrl} time={freezeAt} style={styles.frame} />
      ) : frame ? (
        <Image source={{ uri: frame }} style={styles.frame} contentFit="contain" />
      ) : null}
      {scanning ? (
        <View style={styles.orbitBox}>
          <OrbitLoader />
        </View>
      ) : null}

      <View style={styles.search}>
        <Text style={styles.searchIcon} accessible={false}>⌕</Text>
        <TextInput
          accessibilityLabel={scanningLook ? "Narrow this look" : "Search listings"}
          placeholder={scanningLook ? "Narrow this look" : "Search what’s listed"}
          placeholderTextColor={colors.subtle}
          value={q}
          onChangeText={setQ}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
        />
        {q ? (
          <AccessiblePressable            onPress={() => setQ("")}
            hitSlop={8}
            style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.92 }]}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clear}>×</Text>
          </AccessiblePressable>
        ) : null}
        <AccessiblePressable
          onPress={openVisualSearch}
          hitSlop={8}
          style={({ pressed }) => [styles.cameraBtn, pressed && { opacity: 0.65, transform: [{ scale: 0.94 }] }]}
          accessibilityRole="button"
          accessibilityLabel="Search with a photo"
          accessibilityHint="Take a photo or choose one from your camera roll."
        >
          <Ionicons name="camera-outline" size={21} color={colors.bone} />
        </AccessiblePressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CATEGORIES.map((c) => {
          const on = cat === c;
          return (
            <AccessiblePressable              key={c}
              onPress={() => setCat(c)}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.92 }]}
              accessibilityRole="tab"
              accessibilityLabel={`${c} category`}
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{c}</Text>
            </AccessiblePressable>
          );
        })}
      </ScrollView>

      {!scanningLook && houses.length ? (
        <View>
          <View style={styles.brandHead}>
            <Text style={styles.brandHeadTxt}>Brands</Text>
            <Text style={styles.brandHeadGo}>›</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandRail}>
            {houses.map((b) => (
              <AccessiblePressable                key={b.id}
                onPress={() => router.push({ pathname: "/brand/[id]", params: { id: b.id } })}
                style={({ pressed }) => [styles.house, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel={`Open ${b.name}${brandCheck(b) !== "none" ? ", verified brand" : ""}`}
                accessibilityHint="Double tap to open this brand."
              >
                {b.logoUri ? (
                  <Image source={{ uri: b.logoUri }} style={styles.houseLogo} contentFit="cover" />
                ) : (
                  <View style={styles.houseLogo} />
                )}
                <View style={styles.houseMeta}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Text style={styles.houseName} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <BrandVerifiedMark brand={b} size={12} />
                  </View>
                  <Text style={styles.houseLine} numberOfLines={1}>
                    {b.tagline || b.vertical}
                  </Text>
                </View>
              </AccessiblePressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {!scanningLook && shopCampaignRows.length ? (
        <View style={styles.campaignSection}>
          <View style={styles.campaignHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.campaignKicker}>SHOP CAMPAIGNS</Text>
              <Text style={styles.campaignSub}>Live drops from brands in this shop</Text>
            </View>
            <Text style={styles.campaignLive}>LIVE</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.campaignRail}>
            {shopCampaignRows.map(({ campaign, lead }) => {
              const brand = getBrand(campaign.brandId);
              return (
                <AccessiblePressable                  key={campaign.id}
                  onPress={() => {
                    void recordCampaignAttribution({ brandId: campaign.brandId, campaignId: campaign.id, channel: "shop", type: "engagement", listingId: lead.id, eventId: `shop_engagement_${campaign.id}_${app.uid || "guest"}_${Date.now()}` }).catch(() => undefined);
                    router.push({ pathname: "/closet/[id]", params: { id: lead.id, campaignId: campaign.id, collectionId: campaign.collectionId || "", promotionId: campaign.promotionId || "", campaignChannel: "shop" } });
                  }}
                  style={({ pressed }) => [styles.campaignCard, pressed && { opacity: 0.92 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Shop ${brand?.name || "brand"} campaign ${campaign.headline || campaign.name}`}
                  accessibilityHint="Double tap to explore this drop."
                >
                  <Image source={{ uri: lead.photo }} style={styles.campaignImg} contentFit="cover" accessible={false} />
                  <View style={styles.campaignCopy}>
                    <View style={styles.campaignBrandRow}>
                      {brand?.logoUri ? <Image source={{ uri: brand.logoUri }} style={styles.campaignLogo} contentFit="cover" /> : null}
                      <Text style={styles.campaignBrand} numberOfLines={1}>{brand?.name || "Brand drop"}</Text>
                      <BrandVerifiedMark brand={brand} size={11} />
                    </View>
                    <Text style={styles.campaignTitle} numberOfLines={2}>{campaign.headline || campaign.name}</Text>
                    <Text style={styles.campaignBody} numberOfLines={2}>{campaign.body || "Explore the latest drop."}</Text>
                    <Text style={styles.campaignGo}>Shop the drop →</Text>
                  </View>
                </AccessiblePressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {scanning ? (
        <Text style={styles.count}>Looking at the clothes in this frame</Text>
      ) : null}

      <View style={[styles.grid, !scanning && { marginTop: 14 }]}>
        {scanning
          ? null
          : ranked.map((p) => (
              <View key={p.id} style={[styles.cell, openPiece?.id === p.id && { opacity: 0 }]}>
                <ListingCard piece={p} framed firstFind={todayHome && firstFind.matches(p)} onFirstFind={todayHome ? () => setFindHint(true) : undefined} onOpen={todayHome ? openTodayListing : undefined} onInteraction={todayHome ? personalization.record : undefined} />
              </View>
            ))}
      </View>

      {!scanning && ranked.length === 0 ? (
        marketplaceSync !== "confirmed" ? null : scanningLook ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing matches this look yet</Text>
            <Text style={styles.emptyCopy}>Try another frame or take a filter off.</Text>
          </View>
        ) : todayHome ? (
          <View style={styles.emptyQuiet}>
            <Text style={styles.emptyQuietTxt}>Nothing new yet. Pull to refresh.</Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{`Nothing listed in the ${market.name} shop yet`}</Text>
            <Text style={styles.emptyCopy}>Pull to refresh, or check Today.</Text>
            <AccessiblePressable onPress={() => router.push("/")} style={styles.emptyPrimary} accessibilityRole="button" accessibilityLabel="Go to Today">
              <Text style={styles.emptyPrimaryTxt}>Today</Text>
            </AccessiblePressable>
          </View>
        )
      ) : null}
      </ScrollView>
      {orbitOn ? (
        <View style={[orbitTop, { paddingTop: insets.top + 8 }]} pointerEvents="none">
          <OrbitLoader />
        </View>
      ) : null}
      {todayHome && openPiece && openOrigin ? (
        <TodayListingOverlay
          piece={openPiece}
          origin={openOrigin}
          onClose={() => {
            setOpenPiece(null);
            setOpenOrigin(null);
          }}
          onInteraction={personalization.record}
        />
      ) : null}
      {todayHome ? <TodayCartFab lifted={Boolean(openPiece)} /> : null}
      {findHint ? (
        <View pointerEvents="none" style={[styles.findToast, { top: insets.top + 68 }]} accessibilityLiveRegion="polite">
          <Text style={styles.findToastK}>FIRST FIND</Text>
          <Text style={styles.findToastTxt}>We’ll cover {moneyExact(firstFind.remaining, firstFind.currency)} of this piece at checkout.</Text>
        </View>
      ) : null}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingHorizontal: 16, paddingBottom: 108 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 34, lineHeight: 38, flex: 1 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    todayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 56, marginBottom: 4 },
    findLine: { alignSelf: "center", minHeight: 32, paddingHorizontal: 8, marginBottom: 6, justifyContent: "center" },
    findLineTxt: { color: `${colors.bone}8C`, fontSize: 13, fontWeight: "600", textAlign: "center" },
    findLineAmt: { color: colors.success, fontWeight: "800" },
    findToast: {
      position: "absolute",
      left: 16,
      right: 16,
      zIndex: 80,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: `${colors.bone}1A`,
      shadowColor: "#000",
      shadowOpacity: 0.28,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    findToastK: { color: colors.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 4 },
    findToastTxt: { color: colors.bone, fontSize: 15, fontWeight: "700", lineHeight: 20 },
    headerSide: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    menuIcon: { width: 22, gap: 4 },
    menuLine: { height: 2, width: 22, borderRadius: 1, backgroundColor: colors.bone },
    wordmarkButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 10, gap: 4 },
    wordmark: { color: colors.bone, fontFamily: "Georgia", fontSize: 34, fontStyle: "italic", fontWeight: "700", letterSpacing: 0, lineHeight: 42 },
    wordmarkChevron: { color: `${colors.bone}B8`, fontSize: 19, fontWeight: "700", marginTop: 0 },
    messageButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: `${colors.bone}55`, backgroundColor: `${colors.bone}14`, alignItems: "center", justifyContent: "center" },
    messageBadge: { position: "absolute", right: -2, top: -3, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    messageBadgeText: { color: colors.successInk, fontSize: 9, fontWeight: "900" },
    emptyState: { marginTop: 22, padding: 22, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center" },
    emptyQuiet: { paddingVertical: 28, alignItems: "center" },
    emptyQuietTxt: { color: `${colors.bone}7A`, fontSize: 15, textAlign: "center" },
    emptyTitle: { color: colors.bone, fontSize: 19, fontWeight: "800", textAlign: "center", marginTop: 7 },
    emptyCopy: { color: `${colors.bone}94`, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6 },
    emptyPrimary: { marginTop: 16, minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    emptyPrimaryTxt: { color: colors.successInk, fontSize: 13, fontWeight: "800" },
    campaignSection: { marginTop: 22 },
    campaignHead: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginBottom: 10 },
    campaignKicker: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
    campaignSub: { color: `${colors.bone}85`, fontSize: 13, marginTop: 3 },
    campaignLive: { color: colors.successInk, backgroundColor: colors.success, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
    campaignRail: { gap: 10, paddingBottom: 4 },
    campaignCard: { width: 292, minHeight: 148, borderRadius: 16, overflow: "hidden", backgroundColor: colors.surface, flexDirection: "row" },
    campaignImg: { width: 106, height: "100%", minHeight: 148, backgroundColor: colors.surface },
    campaignCopy: { flex: 1, paddingHorizontal: 12, paddingVertical: 11, justifyContent: "center" },
    campaignBrandRow: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 18 },
    campaignLogo: { width: 18, height: 18, borderRadius: 5, backgroundColor: colors.surface },
    campaignBrand: { flexShrink: 1, color: `${colors.bone}94`, fontSize: 11, fontWeight: "800", letterSpacing: 0.7 },
    campaignTitle: { color: colors.bone, fontSize: 17, lineHeight: 20, fontWeight: "700", marginTop: 6 },
    campaignBody: { color: `${colors.bone}94`, fontSize: 12, lineHeight: 16, marginTop: 4 },
    campaignGo: { color: colors.success, fontSize: 12, fontWeight: "800", marginTop: 8 },
    focused: { borderWidth: 2, borderColor: colors.success },
    brandHead: { flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 10, gap: 4 },
    brandHeadTxt: { color: colors.bone, fontWeight: "700", fontSize: 18 },
    brandHeadGo: { color: `${colors.bone}73`, fontSize: 22, marginTop: -2 },
    brandRail: { gap: 10, paddingBottom: 4 },
    house: {
      width: 220,
      backgroundColor: colors.surface,
      borderRadius: 16,
      overflow: "hidden",
      flexDirection: "row",
      padding: 8,
      gap: 10,
      alignItems: "center",
    },
    houseLogo: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.surface },
    houseMeta: { flex: 1, paddingRight: 4 },
    houseName: { color: colors.bone, fontWeight: "700", fontSize: 14, flexShrink: 1 },
    houseLine: { color: `${colors.bone}80`, fontSize: 12, marginTop: 3 },
    look: { color: `${colors.bone}9E`, marginTop: 6, fontSize: 16 },
    frame: {
      marginTop: 16,
      height: 420,
      borderRadius: 16,
      backgroundColor: colors.ink,
    },
    orbitBox: { paddingVertical: 48, alignItems: "center" },
    store: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 },
    storeTxt: { color: `${colors.bone}80`, fontSize: 15 },
    storeGo: { color: `${colors.bone}B8`, fontSize: 15, textDecorationLine: "underline" },
    search: {
      marginTop: 18,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: `${colors.bone}1F`,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      gap: 8,
    },
    searchIcon: { color: `${colors.bone}66`, fontSize: 16, marginTop: -1 },
    input: { flex: 1, color: colors.bone, fontSize: 16, height: 46 },
    clearBtn: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
    clear: { color: `${colors.bone}D1`, fontSize: 22, paddingHorizontal: 4 },
    cameraBtn: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
    chips: { gap: 8, paddingVertical: 16 },
    chip: {
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: `${colors.bone}29`,
      alignItems: "center",
      justifyContent: "center",
    },
    chipOn: { backgroundColor: colors.success, borderColor: colors.success },
    chipTxt: { color: colors.bone, fontSize: 13, fontWeight: "600" },
    chipTxtOn: { color: colors.successInk },
    count: { color: `${colors.bone}66`, fontSize: 13, marginBottom: 12 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    cell: { width: "48%", flexGrow: 1, maxWidth: "48.5%" },
  });
}
