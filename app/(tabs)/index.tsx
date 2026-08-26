import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  Alert,
  AppState,
  Dimensions,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard, ListingEmpty } from "../../components/ListingCard";
import { OrbitLoader, useMinHold } from "../../components/OrbitLoader";
import { TodaySkeleton } from "../../components/ScreenSkeletons";
import { VerifiedMark } from "../../components/VerifiedMark";
import { unreadFor, useInbox } from "../../lib/chat";
import { usd } from "../../lib/catalog";
import { frameAtTime, playableLookVideo, prefetchLookVideo } from "../../lib/lookFrame";
import { forYou, matchListings } from "../../lib/lookMatch";
import { beginLookScan, finishLookScan } from "../../lib/lookSearch";
import { getMarket } from "../../lib/markets";
import { followedBrandIds, getBrand, useBrands } from "../../lib/brands";
import { recordCampaignAttribution } from "../../lib/attribution";
import { useLiveShopCampaigns, type BrandCampaign } from "../../lib/marketing";
import { AI_CONTENT_EXPLANATION, AI_CONTENT_LABEL } from "../../lib/contentLabels";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { SOURCES, lookImage, useLooks, type Look, type Source } from "../../lib/trends";
import { getPiece, likeCount, shopFloor, useWardrobe, useWardrobeHydrated, type ClosetPiece } from "../../lib/wardrobe";

const { width: W, height: H } = Dimensions.get("screen");

const orbitTop = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  alignItems: "center" as const,
  zIndex: 40,
  elevation: 40,
};
const CARD_W = Math.round((W - 32) / 2.28);
const CARD_H = Math.round(CARD_W * 1.42);

const DOT: Record<Exclude<Source, "All">, string> = {
  TikTok: "#FE2C55",
  Instagram: "#E1306C",
  Snapchat: "#FFFC00",
  X: "#F4F0E6",
};

type FrameGrab = {
  freeze: () => number;
  frame: () => Promise<string | null>;
};

function MutedLoop({
  uri,
  cover,
  style,
  handleRef,
  onWait,
}: {
  uri: string;
  cover?: string;
  style: object;
  handleRef?: MutableRefObject<FrameGrab | null>;
  onWait?: (v: boolean) => void;
}) {
  const held = useRef(false);
  const lastTime = useRef(0);
  const frozenAt = useRef(0);
  const src = playableLookVideo(uri);
  const [on, setOn] = useState(false);
  const player = useVideoPlayer({ uri: src }, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = "mixWithOthers";
    p.timeUpdateEventInterval = 0.03;
  });

  const playIfFree = useCallback(() => {
    if (held.current) return;
    player.loop = true;
    player.muted = true;
    player.play();
  }, [player]);

  useEffect(() => {
    setOn(false);
    onWait?.(true);
    player.timeUpdateEventInterval = 0.03;
    prefetchLookVideo(uri);
    const status = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") {
        setOn(true);
        onWait?.(false);
        playIfFree();
      } else if (status === "loading") {
        onWait?.(true);
      } else if (status === "error") {
        onWait?.(false);
      }
    });
    const time = player.addListener("timeUpdate", ({ currentTime }) => {
      if (!held.current) lastTime.current = currentTime;
    });
    const tick = setInterval(() => {
      if (!held.current) {
        const now = Number(player.currentTime);
        if (!Number.isNaN(now)) lastTime.current = now;
      }
    }, 32);
    playIfFree();
    const app = AppState.addEventListener("change", (s) => {
      if (s === "active") playIfFree();
    });
    return () => {
      status.remove();
      time.remove();
      clearInterval(tick);
      app.remove();
    };
  }, [player, uri, playIfFree, onWait]);

  useFocusEffect(
    useCallback(() => {
      held.current = false;
      playIfFree();
      return undefined;
    }, [playIfFree]),
  );

  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      freeze: () => {
        const now = Number(player.currentTime);
        frozenAt.current = Number.isFinite(now) && now > 0 ? now : lastTime.current;
        held.current = true;
        player.pause();
        return frozenAt.current;
      },
      frame: async () => {
        held.current = true;
        player.pause();
        return frameAtTime(player, frozenAt.current, uri);
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [player, handleRef, uri]);

  return (
    <View style={[style, { overflow: "hidden", backgroundColor: "#0B0A08" }]}>
      <VideoView
        player={player}
        style={[StyleSheet.absoluteFill, !on ? { opacity: 0 } : null]}
        contentFit="cover"
        nativeControls={false}
      />
      {cover && !on ? (
        <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
    </View>
  );
}

function LookMedia({
  look,
  style,
  handleRef,
  onWait,
}: {
  look: Look;
  style: object;
  handleRef?: MutableRefObject<FrameGrab | null>;
  onWait?: (v: boolean) => void;
}) {
  useEffect(() => {
    if (!look.videoUrl) onWait?.(false);
    if (look.videoUrl || !handleRef) return;
    handleRef.current = {
      freeze: () => 0,
      frame: async () => look.imageUrl || null,
    };
    return () => {
      handleRef.current = null;
    };
  }, [look.videoUrl, look.imageUrl, handleRef, onWait]);
  if (look.videoUrl) {
    return (
      <MutedLoop uri={look.videoUrl} cover={look.imageUrl} style={style} handleRef={handleRef} onWait={onWait} />
    );
  }
  return <Image source={lookImage(look)} style={style} contentFit="cover" />;
}

function where(url?: string): Exclude<Source, "All"> | null {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("instagram.com") || u.includes("instagr.am")) return "Instagram";
  if (u.includes("tiktok.com")) return "TikTok";
  if (u.includes("snapchat.com")) return "Snapchat";
  if (u.includes("x.com") || u.includes("twitter.com")) return "X";
  return null;
}

function showAiExplanation() {
  Alert.alert("AI-generated content", AI_CONTENT_EXPLANATION, [{ text: "Got it" }]);
}

function AiGeneratedPill({ colors, compact = false }: { colors: Colors; compact?: boolean }) {
  const styles = make(colors);
  return (
    <Pressable onPress={showAiExplanation} style={[styles.aiPill, compact && styles.aiPillCompact]} hitSlop={6}>
      <View style={styles.aiDot} />
      <Text style={styles.aiPillTxt}>{AI_CONTENT_LABEL}</Text>
    </Pressable>
  );
}

function scanLook(look: Look, grab: FrameGrab | null) {
  const time = grab?.freeze() ?? 0;
  beginLookScan({
    title: look.title,
    videoUrl: look.videoUrl,
    imageUrl: look.imageUrl,
    time,
  });
  router.push({
    pathname: "/(tabs)/shop",
    params: { look: look.id, scan: "1" },
  });
  void (grab?.frame() ?? Promise.resolve(null)).then((frame) => {
    if (frame) finishLookScan(frame);
  });
}

function hashOf(look: Look) {
  const s = (look.summary || "").trim();
  if (s.startsWith("#")) return s.split(/\s+/)[0];
  return "";
}

function followedBadge(piece: ClosetPiece) {
  return Date.now() - (piece.createdAt || 0) <= 14 * 24 * 60 * 60 * 1000 ? "New drop" : "Following";
}

export default function Today() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const { uid, styles: taste, country } = useUvel();
  const brandState = useBrands();
  const chats = useInbox(uid || "me");
  const unread = chats.reduce((n, t) => n + unreadFor(t, uid || "me"), 0);
  const { looks, refreshing, refresh, loading } = useLooks();
  useWardrobe();
  const wardrobeReady = useWardrobeHydrated();
  const live = shopFloor(country);
  const liveCampaigns = useLiveShopCampaigns();
  const followedIds = useMemo(() => followedBrandIds(uid || ""), [brandState, uid]);
  const followedKey = followedIds.join("|");
  const followedListings = useMemo(
    () => live.filter((p) => Boolean(p.brandId && followedIds.includes(p.brandId))).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
    [live, followedKey],
  );
  const todayCampaignRows = useMemo(() => liveCampaigns
    .filter((campaign) => campaign.channel === "today" && (!campaign.startAt || campaign.startAt <= Date.now()) && (!campaign.endAt || campaign.endAt >= Date.now()))
    .map((campaign) => ({ campaign, lead: campaign.productIds.map((productId) => live.find((piece) => piece.id === productId) || getPiece(productId)).find(Boolean) }))
    .filter((row): row is { campaign: BrandCampaign; lead: ClosetPiece } => Boolean(row.lead))
    .slice(0, 6), [liveCampaigns, live]);

  useEffect(() => {
    if (!uid) return;
    const day = new Date().toISOString().slice(0, 10);
    todayCampaignRows.forEach(({ campaign }) => {
      void recordCampaignAttribution({ brandId: campaign.brandId, campaignId: campaign.id, channel: "today", type: "impression", eventId: `today_impression_${campaign.id}_${uid}_${day}` }).catch(() => undefined);
    });
  }, [uid, todayCampaignRows.map(({ campaign }) => campaign.id).join("|")]);
  const [source, setSource] = useState<Source>("All");
  const [videoWait, setVideoWait] = useState(false);
  const [shopWait, setShopWait] = useState(false);
  const heroH = Math.round(H - insets.bottom - 196);
  const orbitOn = useMinHold(refreshing || loading || videoWait || shopWait, 1200);

  const visible = useMemo(
    () => (source === "All" ? looks : looks.filter((t) => t.source === source)),
    [looks, source],
  );
  const featured = visible[0] ?? looks[0];
  const hits = featured ? matchListings(featured, live, taste, followedIds).slice(0, 6) : [];

  if ((loading || !wardrobeReady) && !looks.length) return <TodaySkeleton colors={colors} />;

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.page}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={{ paddingBottom: 108 + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor="transparent"
            colors={["transparent"]}
            progressViewOffset={insets.top}
          />
        }
      >
        {featured ? (
          <Hero
            key={featured.id}
            look={featured}
            colors={colors}
            height={heroH}
            onWait={setVideoWait}
            onBusy={setShopWait}
          />
        ) : (
          <View style={[styles.heroWrap, { height: heroH }]} />
        )}

        <View style={styles.body}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {SOURCES.map((s) => {
              const on = source === s;
              return (
                <Pressable key={s} onPress={() => setSource(s)} style={[styles.filter, on && styles.filterOn]}>
                  {s !== "All" ? <View style={[styles.dot, { backgroundColor: DOT[s] }]} /> : null}
                  <Text style={[styles.filterTxt, on && styles.filterTxtOn]}>{s}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable onPress={() => router.push("/inbox")} style={styles.inbox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inboxK}>Chats</Text>
              <Text style={styles.inboxP} numberOfLines={1}>
                {chats[0]?.lastText
                  ? chats[0].lastText
                  : chats.length
                    ? `${chats.length} open`
                    : "Asks on your listings land here"}
              </Text>
            </View>
            {unread > 0 ? (
              <View style={styles.redBadge}>
                <Text style={styles.redBadgeTxt}>{unread > 9 ? "9+" : String(unread)}</Text>
              </View>
            ) : null}
          </Pressable>

          <View style={styles.head}>
            <Text style={styles.h2}>{source === "All" ? "Moving now" : `Now on ${source}`}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {visible.map((look) => (
              <LookCard key={look.id} look={look} colors={colors} />
            ))}
          </ScrollView>

          {todayCampaignRows.length ? (
            <View>
              <View style={styles.head}>
                <View>
                  <Text style={styles.h2}>Today campaigns</Text>
                  <Text style={styles.sectionSub}>Live drops selected for this feed.</Text>
                </View>
                <Text style={styles.todayLive}>LIVE</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.todayCampaignStrip}>
                {todayCampaignRows.map(({ campaign, lead }) => (
                  <TodayCampaignCard key={campaign.id} campaign={campaign} lead={lead} uid={uid} colors={colors} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.head}>
            <Text style={styles.h2}>Shop the look</Text>
          </View>
          {hits.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shopStrip}>
              {hits.map((p) => (
                <ShopLookCard key={p.id} piece={p} country={country} colors={colors} />
              ))}
            </ScrollView>
          ) : (
            <View style={{ paddingHorizontal: 16 }}>
              <ListingEmpty copy="No listings on this floor match this look yet. When someone sells the real piece here, it lands here." />
            </View>
          )}

          {followedIds.length ? (
            <>
              <View style={styles.head}>
                <View>
                  <Text style={styles.h2}>From brands you follow</Text>
                  <Text style={styles.sectionSub}>New drops and recent pieces from your followed shops.</Text>
                </View>
              </View>
              {followedListings.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.followedStrip}>
                  {followedListings.map((p) => (
                    <View key={`followed-${p.id}`} style={styles.followedCell}>
                      <ListingCard piece={p} wide={Math.round(W * 0.62)} framed badge={followedBadge(p)} />
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={{ paddingHorizontal: 16 }}>
                  <ListingEmpty copy="You’re following brands, but they have no available pieces for your market yet. New drops will appear here." />
                </View>
              )}
            </>
          ) : null}

          <View style={styles.head}>
            <Text style={styles.h2}>For you</Text>
            <Pressable onPress={() => router.push("/(tabs)/shop")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          {live.length ? (
            <View style={styles.grid}>
              {forYou(live, taste, country, followedIds).slice(0, 8).map((p) => (
                <View key={p.id} style={styles.cell}>
                  <ListingCard piece={p} />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16 }}>
              <ListingEmpty copy="This country’s floor is empty. Sell from Closet — it stays on this store unless you open it to others." />
            </View>
          )}
        </View>
      </ScrollView>
      {orbitOn ? (
        <View style={[orbitTop, { paddingTop: insets.top + 10 }]} pointerEvents="none">
          <OrbitLoader />
        </View>
      ) : null}
    </View>
  );
}

function Hero({
  look,
  colors,
  height,
  onWait,
  onBusy,
}: {
  look: Look;
  colors: Colors;
  height: number;
  onWait?: (v: boolean) => void;
  onBusy?: (v: boolean) => void;
}) {
  const styles = make(colors);
  const seen = where(look.postUrl) || look.source;
  const grab = useRef<FrameGrab | null>(null);
  const [busy, setBusy] = useState(false);
  const tag = hashOf(look);

  function shopThis() {
    if (busy) return;
    setBusy(true);
    onBusy?.(true);
    scanLook(look, grab.current);
    setTimeout(() => {
      setBusy(false);
      onBusy?.(false);
    }, 400);
  }

  return (
    <View style={[styles.heroWrap, { height }]}>
      <LookMedia look={look} style={styles.hero} handleRef={grab} onWait={onWait} />
      <View style={styles.heroCopy}>
        <View style={styles.heroBar}>
          <Pressable onPress={() => void shopThis()} style={styles.cta}>
            <Text style={styles.ctaTxt}>{busy ? "Searching…" : "Shop the look"}</Text>
          </Pressable>
          {look.postUrl ? (
            <Pressable onPress={() => void Linking.openURL(look.postUrl!)} style={styles.ghost}>
              <Text style={styles.ghostTxt}>See on {seen}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.srcRow}>
          <View style={[styles.dot, { backgroundColor: DOT[look.source] }]} />
          <Text style={styles.src}>
            {look.handle ? `${look.source}  ·  ${look.handle}` : look.source}
          </Text>
        </View>
        {look.aiGenerated ? <AiGeneratedPill colors={colors} /> : null}
        <Text style={styles.title}>{look.title}</Text>
        {tag ? <Text style={styles.hash}>{tag}</Text> : null}
      </View>
    </View>
  );
}

function LookCard({ look, colors }: { look: Look; colors: Colors }) {
  const styles = make(colors);
  const grab = useRef<FrameGrab | null>(null);
  const [busy, setBusy] = useState(false);

  function shopThis() {
    if (busy) return;
    setBusy(true);
    scanLook(look, grab.current);
    setTimeout(() => setBusy(false), 400);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardFrame}>
        <LookMedia look={look} style={styles.cardFill} handleRef={grab} />
        <View style={styles.cardSrcPill}>
          <View style={[styles.dot, { backgroundColor: DOT[look.source] }]} />
          <Text style={styles.cardSrc}>{look.source}</Text>
        </View>
        {look.aiGenerated ? (
          <View style={styles.cardAiWrap}>
            <AiGeneratedPill colors={colors} compact />
          </View>
        ) : null}
        <Pressable onPress={() => void shopThis()} style={styles.searchFab} hitSlop={8}>
          <Text style={styles.searchFabTxt}>{busy ? "…" : "⌕"}</Text>
        </Pressable>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {look.title}
      </Text>
    </View>
  );
}

function TodayCampaignCard({ campaign, lead, uid, colors }: { campaign: BrandCampaign; lead: ClosetPiece; uid: string; colors: Colors }) {
  const styles = make(colors);
  const brand = getBrand(campaign.brandId);
  return (
    <Pressable
      onPress={() => {
        if (uid) void recordCampaignAttribution({ brandId: campaign.brandId, campaignId: campaign.id, channel: "today", type: "engagement", listingId: lead.id, eventId: `today_engagement_${campaign.id}_${uid}_${Date.now()}` }).catch(() => undefined);
        router.push({ pathname: "/closet/[id]", params: { id: lead.id, campaignId: campaign.id, collectionId: campaign.collectionId || "", promotionId: campaign.promotionId || "", campaignChannel: "today" } });
      }}
      style={({ pressed }) => [styles.todayCampaignCard, pressed && { opacity: 0.82 }]}
    >
      <Image source={{ uri: lead.photo }} style={styles.todayCampaignImg} contentFit="cover" />
      <View style={styles.todayCampaignCopy}>
        <View style={styles.todayCampaignBrandRow}>
          {brand?.logoUri ? <Image source={{ uri: brand.logoUri }} style={styles.todayCampaignLogo} contentFit="cover" /> : null}
          <Text style={styles.todayCampaignBrand} numberOfLines={1}>{brand?.name || "Brand drop"}</Text>
          {brand?.verified ? <VerifiedMark size={11} /> : null}
        </View>
        <Text style={styles.todayCampaignTitle} numberOfLines={2}>{campaign.headline || campaign.name}</Text>
        <Text style={styles.todayCampaignBody} numberOfLines={2}>{campaign.body || "Explore the latest drop."}</Text>
        <Text style={styles.todayCampaignGo}>Explore the drop →</Text>
      </View>
    </Pressable>
  );
}

function ShopLookCard({
  piece,
  country,
  colors,
}: {
  piece: ClosetPiece;
  country: string;
  colors: Colors;
}) {
  const styles = make(colors);
  const here = getMarket(country);
  const from = getMarket(piece.country || country);
  const local = from.code === here.code;
  const house = piece.brandId ? getBrand(piece.brandId) : undefined;
  const brand = house?.name || (local ? (piece.brand === "Unlabeled" ? "UVEL" : piece.brand) : from.name);
  const live = getPiece(piece.id) || piece;
  const { saved } = useUvel();
  const hearts = likeCount(live, saved);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/closet/[id]", params: { id: live.id } })}
      style={styles.shopCard}
    >
      <View>
        <Image source={{ uri: live.photo }} style={styles.shopImg} contentFit="cover" />
        <View style={styles.shopNow}>
          <Text style={styles.shopNowTxt}>Shop now</Text>
        </View>
        <View style={styles.shopHearts}>
          <Text style={styles.shopHeartsIco}>♥</Text>
          <Text style={styles.shopHeartsN}>{hearts}</Text>
        </View>
      </View>
      <View style={styles.shopMeta}>
        <Text style={styles.shopBrand} numberOfLines={1}>
          {brand.toUpperCase()}
        </Text>
        <Text style={styles.shopName} numberOfLines={2}>
          {live.name}
        </Text>
        <Text style={styles.shopPrice}>{usd(live.listPriceCents, live.currency || "USD")}</Text>
      </View>
    </Pressable>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: "#0B0A08" },
    heroWrap: { width: W, backgroundColor: "#0B0A08", overflow: "hidden" },
    heroLoad: { alignItems: "center", justifyContent: "center" },
    hero: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    heroCopy: { position: "absolute", left: 16, right: 16, bottom: 18 },
    heroBar: { flexDirection: "row", gap: 10, marginBottom: 16 },
    srcRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    src: { color: "rgba(244,240,230,0.86)", fontSize: 13, fontWeight: "500" },
    aiPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, minHeight: 26, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1, borderColor: "#D6E27A", backgroundColor: "rgba(11,10,8,0.74)", marginBottom: 9 },
    aiPillCompact: { marginBottom: 0, minHeight: 25, backgroundColor: "rgba(11,10,8,0.78)" },
    aiDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#D6E27A" },
    aiPillTxt: { color: "#F4F0E6", fontSize: 11, fontWeight: "700" },
    title: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 30, lineHeight: 34 },
    hash: { color: "rgba(244,240,230,0.72)", fontSize: 15, marginTop: 6 },
    cta: {
      flex: 1.08,
      backgroundColor: "#F4F0E6",
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaTxt: { color: "#16140F", fontWeight: "700", fontSize: 15 },
    ghost: {
      flex: 1,
      height: 46,
      borderRadius: 23,
      backgroundColor: "rgba(255,255,255,0.28)",
      alignItems: "center",
      justifyContent: "center",
    },
    ghostTxt: { color: "#F4F0E6", fontWeight: "600", fontSize: 15 },
    body: { paddingTop: 14, backgroundColor: "#0B0A08" },
    chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
    filter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.16)",
    },
    filterOn: { backgroundColor: "#F4F0E6", borderColor: "#F4F0E6" },
    filterTxt: { color: "#F4F0E6", fontWeight: "600", fontSize: 13 },
    filterTxtOn: { color: "#16140F" },
    dot: { width: 8, height: 8, borderRadius: 4 },
    inbox: {
      marginHorizontal: 16,
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#1A1915",
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    inboxK: { color: "#F4F0E6", fontWeight: "700", fontSize: 15 },
    inboxP: { color: "rgba(244,240,230,0.55)", marginTop: 2, fontSize: 13 },
    redBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "#E5484D",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    redBadgeTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
    head: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      marginTop: 22,
      marginBottom: 12,
    },
    h2: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 26 },
    seeAll: { color: "rgba(244,240,230,0.45)", fontSize: 15 },
    strip: { paddingHorizontal: 16, gap: 10, paddingRight: 28 },
    card: { width: CARD_W },
    cardFrame: {
      width: CARD_W,
      height: CARD_H,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: "#1A1915",
    },
    cardFill: { width: CARD_W, height: CARD_H },
    cardSrcPill: {
      position: "absolute",
      top: 10,
      left: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(11,10,8,0.62)",
      paddingHorizontal: 10,
      height: 24,
      borderRadius: 12,
    },
    cardAiWrap: { position: "absolute", left: 10, bottom: 10, zIndex: 8 },
    searchFab: {
      position: "absolute",
      right: 10,
      bottom: 10,
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: "rgba(244,240,230,0.96)",
      alignItems: "center",
      justifyContent: "center",
    },
    searchFabTxt: { color: "#16140F", fontSize: 22, fontWeight: "700", marginTop: -1 },
    cardSrc: { color: "#F4F0E6", fontSize: 11, fontWeight: "700" },
    cardTitle: { color: "#F4F0E6", fontSize: 14, marginTop: 8, lineHeight: 18, fontWeight: "500" },
    todayLive: { color: "#16140F", backgroundColor: "#D6E27A", borderRadius: 11, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
    todayCampaignStrip: { paddingHorizontal: 16, gap: 10, paddingRight: 28 },
    todayCampaignCard: { width: Math.min(W - 32, 360), minHeight: 172, borderRadius: 18, overflow: "hidden", backgroundColor: "#161512", flexDirection: "row" },
    todayCampaignImg: { width: 122, height: "100%", minHeight: 172, backgroundColor: "#1A1915" },
    todayCampaignCopy: { flex: 1, paddingHorizontal: 13, paddingVertical: 12, justifyContent: "center" },
    todayCampaignBrandRow: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 18 },
    todayCampaignLogo: { width: 18, height: 18, borderRadius: 5, backgroundColor: "#1A1915" },
    todayCampaignBrand: { flexShrink: 1, color: "rgba(244,240,230,0.58)", fontSize: 11, fontWeight: "800", letterSpacing: 0.7 },
    todayCampaignTitle: { color: "#F4F0E6", fontSize: 18, lineHeight: 21, fontWeight: "700", marginTop: 7 },
    todayCampaignBody: { color: "rgba(244,240,230,0.58)", fontSize: 12, lineHeight: 16, marginTop: 4 },
    todayCampaignGo: { color: "#D6E27A", fontSize: 12, fontWeight: "800", marginTop: 9 },
    shopStrip: { paddingHorizontal: 16, gap: 12, paddingRight: 28 },
    followedStrip: { paddingHorizontal: 16, gap: 12, paddingRight: 28 },
    followedCell: { width: Math.round(W * 0.62) },
    sectionSub: { color: "rgba(244,240,230,0.5)", fontSize: 13, marginTop: 5 },
    shopCard: {
      width: W - 32,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: "#1A1915",
    },
    shopImg: { width: W - 32, height: Math.round((W - 32) * 1.05), backgroundColor: "#111" },
    shopNow: {
      position: "absolute",
      right: 14,
      bottom: 14,
      backgroundColor: "#F4F0E6",
      paddingHorizontal: 16,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    shopNowTxt: { color: "#16140F", fontWeight: "700", fontSize: 13 },
    shopHearts: {
      position: "absolute",
      left: 14,
      bottom: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    shopHeartsIco: {
      color: "#D6E27A",
      fontSize: 13,
      textShadowColor: "rgba(0,0,0,0.45)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    shopHeartsN: {
      color: "#F4F0E6",
      fontSize: 13,
      fontWeight: "800",
      textShadowColor: "rgba(0,0,0,0.45)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    shopMeta: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
    shopBrand: { color: "rgba(244,240,230,0.45)", fontSize: 11, letterSpacing: 1.4, fontWeight: "700" },
    shopName: { color: "#F4F0E6", fontSize: 18, fontWeight: "700", marginTop: 6, lineHeight: 22 },
    shopPrice: { color: "#F4F0E6", fontSize: 17, fontWeight: "700", marginTop: 6 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16 },
    cell: { width: "47%", flexGrow: 1 },
  });
}
