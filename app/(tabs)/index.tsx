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
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../../components/AccessiblePressable";
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
import { useCopy } from "../../lib/useCopy";
import { useFeedPersonalization } from "../../lib/feedPersonalization";
import { useColors, type Colors } from "../../lib/theme";
import { lookImage, useLooks, type Look, type Source } from "../../lib/trends";
import { getPiece, likeCount, shopFloor, useMarketplaceSyncState, useWardrobe, useWardrobeHydrated, type ClosetPiece } from "../../lib/wardrobe";

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
type TodayMode = "forYou" | "following" | "nearby";

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
  bleedTop,
}: {
  look: Look;
  style: object;
  handleRef?: MutableRefObject<FrameGrab | null>;
  onWait?: (v: boolean) => void;
  bleedTop?: boolean;
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
  const insets = useSafeAreaInsets();
  return <Image source={lookImage(look)} style={bleedTop ? [style, { top: -insets.top, bottom: -insets.bottom }] : style} contentFit="cover" />;
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
    <AccessiblePressable      onPress={showAiExplanation}
      style={({ pressed }) => [styles.aiPill, compact && styles.aiPillCompact, pressed && { opacity: 0.92 }]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="AI-generated content"
      accessibilityHint="Double tap to learn what this label means."
    >
      <View style={styles.aiDot} />
      <Text style={styles.aiPillTxt}>{AI_CONTENT_LABEL}</Text>
    </AccessiblePressable>
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
  const C = useCopy();
  const { rank: rankForUser, track: trackFeed } = useFeedPersonalization(uid || "guest", country);
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
  const [todayMode, setTodayMode] = useState<TodayMode>("forYou");
  const [videoWait, setVideoWait] = useState(false);
  const [shopWait, setShopWait] = useState(false);
  const heroH = Math.round(H - insets.bottom - 196);
  const orbitOn = useMinHold(refreshing || loading || videoWait || shopWait, 1200);
  const personalizedLooks = useMemo(() => rankForUser(looks), [looks, rankForUser]);
  const localMarket = getMarket(country).code;
  const nearbyListings = useMemo(
    () => live.filter((piece) => piece.country?.toUpperCase() === localMarket).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
    [live, localMarket],
  );
  const modeListings = todayMode === "following" ? followedListings : todayMode === "nearby" ? nearbyListings : [];
  const featured = personalizedLooks[0] ?? looks[0];
  const hits = featured ? matchListings(featured, live, taste, followedIds).slice(0, 6) : [];
  const intro = todayMode === "following"
    ? { eyebrow: C.following, title: C.followingTodayTitle, body: C.followingTodayBody }
    : todayMode === "nearby"
      ? { eyebrow: C.nearby, title: C.nearbyTodayTitle, body: C.nearbyTodayBody }
      : { eyebrow: country ? `${country} · ${C.dailyEdit}` : C.dailyEdit, title: taste.length ? C.personalizedTodayTitle : C.todayIntroTitle, body: taste.length ? C.personalizedTodayBody : C.todayIntroBody };
  if ((loading || !wardrobeReady) && !looks.length && todayMode === "forYou") return <TodaySkeleton colors={colors} />;

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
        {todayMode === "forYou" ? (
          featured ? (
            <Hero
              key={featured.id}
              look={featured}
              colors={colors}
              height={heroH}
              onWait={setVideoWait}
              onBusy={setShopWait}
              onShop={() => trackFeed(featured, "shop")}
              onSource={() => trackFeed(featured, "source")}
            />
          ) : (
            <TodayEmptyHero mode={todayMode} height={heroH} colors={colors} />
          )
        ) : modeListings[0] ? (
          <ListingHero piece={modeListings[0]} mode={todayMode} height={heroH} colors={colors} />
        ) : (
          <TodayEmptyHero mode={todayMode} height={heroH} colors={colors} />
        )}
        <View style={styles.body}>
          <View style={styles.todayIntro}>
            <Text style={styles.todayEyebrow}>{intro.eyebrow}</Text>
            <Text style={styles.todayIntroTitle}>{intro.title}</Text>
            {todayMode !== "forYou" ? <Text style={styles.todayIntroBody}>{intro.body}</Text> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
            {[{ id: "forYou", label: C.forYou }, { id: "following", label: C.following }, { id: "nearby", label: C.nearby }].map((item) => {
              const active = todayMode === item.id;
              return <AccessiblePressable key={item.id} onPress={() => setTodayMode(item.id as TodayMode)} style={({ pressed }) => [styles.modeButton, active && styles.modeButtonOn, pressed && { opacity: 0.92 }]} accessibilityRole="tab" accessibilityLabel={`${item.label} mode`} accessibilityState={{ selected: active }}><Text style={[styles.modeText, active && styles.modeTextOn]}>{item.label}</Text></AccessiblePressable>;
            })}
          </ScrollView>
          {todayMode === "forYou" ? (
            <>
              <View style={styles.head}>
                <Text style={styles.h2}>{C.movingNow}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
                {personalizedLooks.map((look) => (
                  <LookCard key={look.id} look={look} colors={colors} onShop={() => trackFeed(look, "shop")} />
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
                <View>
                  <Text style={styles.h2}>{C.shopTheLook}</Text>
                </View>
              </View>
              {hits.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shopStrip}>
                  {hits.map((p) => (
                    <ShopLookCard key={p.id} piece={p} country={country} colors={colors} matchKind={featured?.garmentIds.includes(p.id) ? "exact" : "similar"} />
                  ))}
                </ScrollView>
              ) : (
                <View style={{ paddingHorizontal: 16 }}>
                  <ListingEmpty copy="No pieces on this floor match this look yet. A close match will appear here when it does." />
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.head}>
                <View>
                  <Text style={styles.h2}>{todayMode === "following" ? C.following : C.nearby}</Text>
                  <Text style={styles.sectionSub}>{todayMode === "following" ? C.followingTodayBody : C.nearbyTodayBody}</Text>
                </View>
              </View>
              {modeListings.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.followedStrip}>
                  {modeListings.slice(1).map((piece) => (
                    <View key={`${todayMode}-${piece.id}`} style={styles.followedCell}>
                      <ListingCard piece={piece} wide={Math.round(W * 0.62)} framed badge={todayMode === "following" ? followedBadge(piece) : "Local"} />
                    </View>
                  ))}
                </ScrollView>
              ) : modeListings.length === 1 ? (
                <View style={{ paddingHorizontal: 16 }}>
                  <ListingEmpty copy={todayMode === "following" ? "More from this shop will land here as it arrives." : "More local pieces will land here as they arrive."} />
                </View>
              ) : null}
            </>
          )}
          <AccessiblePressable
            onPress={() => router.push("/inbox")}
            style={({ pressed }) => [styles.inbox, pressed && { opacity: 0.92 }]}
            accessibilityRole="button"
            accessibilityLabel={`Chats${unread > 0 ? `, ${unread} unread` : ""}`}
            accessibilityHint="Double tap to open your messages."
          >
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
          </AccessiblePressable>
          {todayMode === "forYou" ? (
            <>
              <View style={styles.head}>
                <Text style={styles.h2}>{C.forYou}</Text>
                <AccessiblePressable
                  onPress={() => router.push("/(tabs)/shop")}
                  style={({ pressed }) => [pressed && { opacity: 0.92 }]}
                  accessibilityRole="button"
                  accessibilityLabel="See all shop listings"
                >
                  <Text style={styles.seeAll}>See all</Text>
                </AccessiblePressable>
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
            </>
          ) : null}
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
  onShop,
  onSource,
}: {
  look: Look;
  colors: Colors;
  height: number;
  onWait?: (v: boolean) => void;
  onBusy?: (v: boolean) => void;
  onShop?: () => void;
  onSource?: () => void;
}) {
  const styles = make(colors);
  const C = useCopy();
  const seen = where(look.postUrl) || look.source;
  const grab = useRef<FrameGrab | null>(null);
  const [busy, setBusy] = useState(false);
  const tag = hashOf(look);

  function shopThis() {
    if (busy) return;
    setBusy(true);
    onBusy?.(true);
    onShop?.();
    scanLook(look, grab.current);
    setTimeout(() => {
      setBusy(false);
      onBusy?.(false);
    }, 400);
  }

  return (
    <View style={[styles.heroWrap, { height }]}>
      <LookMedia look={look} style={styles.hero} handleRef={grab} onWait={onWait} bleedTop />
      <View style={styles.heroCopy}>
        <View style={styles.heroBar}>
          <AccessiblePressable            onPress={() => void shopThis()}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.92 }]}
            accessibilityRole="button"
            accessibilityLabel={busy ? C.searching : C.shopTheLook}
            accessibilityHint="Double tap to find matching listings."
          >
            <Text style={styles.ctaTxt}>{busy ? C.searching : C.shopTheLook}</Text>
          </AccessiblePressable>
          {look.postUrl ? (
            <AccessiblePressable              onPress={() => {
                onSource?.();
                void Linking.openURL(look.postUrl!);
              }}
              style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.92 }]}
              accessibilityRole="link"
              accessibilityLabel={`See this look on ${seen}`}
            >
              <Text style={styles.ghostTxt}>See on {seen}</Text>
            </AccessiblePressable>
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

function ListingHero({
  piece,
  mode,
  colors,
  height,
}: {
  piece: ClosetPiece;
  mode: Exclude<TodayMode, "forYou">;
  colors: Colors;
  height: number;
}) {
  const styles = make(colors);
  const C = useCopy();
  const house = piece.brandId ? getBrand(piece.brandId) : undefined;
  const brand = house?.name || (piece.brand === "Unlabeled" ? "UVEL" : piece.brand);
  return (
    <View style={[styles.heroWrap, { height }]}>
      <Image source={{ uri: piece.photo }} style={styles.hero} contentFit="cover" accessible={false} />
      <View style={styles.heroCopy}>
        <View style={styles.heroBar}>
          <AccessiblePressable
            onPress={() => router.push({ pathname: "/closet/[id]", params: { id: piece.id } })}
            style={({ pressed }) => [styles.cta, !house && styles.ctaSolo, pressed && { opacity: 0.92 }]}
            accessibilityRole="button"
            accessibilityLabel={`Open ${piece.name}`}
          >
            <Text style={styles.ctaTxt}>{C.viewListing}</Text>
          </AccessiblePressable>
          {house ? (
            <AccessiblePressable
              onPress={() => router.push({ pathname: "/brand/[id]", params: { id: house.id } })}
              style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel={`View ${house.name}`}
            >
              <Text style={styles.ghostTxt}>{C.viewBrand}</Text>
            </AccessiblePressable>
          ) : null}
        </View>
        <Text style={styles.src}>{mode === "following" ? C.following : C.nearby} · {brand}</Text>
        <Text style={styles.title}>{piece.name}</Text>
        <Text style={styles.hash}>{usd(piece.listPriceCents, piece.currency || "USD")} · {piece.size || piece.sizes?.[0] || "One size"}</Text>
      </View>
    </View>
  );
}
function TodayEmptyHero({ mode, colors, height }: { mode: TodayMode; colors: Colors; height: number }) {
  const styles = make(colors);
  const C = useCopy();
  const browse = mode === "following" || mode === "nearby";
  const title = mode === "following" ? C.followingTodayTitle : mode === "nearby" ? C.nearbyTodayTitle : C.todayEmptyTitle;
  const body = mode === "following" ? C.followingTodayBody : mode === "nearby" ? C.nearbyTodayBody : C.todayEmptyBody;
  return (
    <View style={[styles.heroWrap, styles.emptyHero, { height }]}>
      <View style={styles.emptyHeroCopy}>
        <Text style={styles.todayEyebrow}>{mode === "forYou" ? C.todayEmptyKicker : mode === "following" ? C.following : C.nearby}</Text>
        <Text style={styles.emptyHeroTitle}>{title}</Text>
        <Text style={styles.emptyHeroBody}>{body}</Text>
        <AccessiblePressable
          onPress={() => router.push(browse ? "/(tabs)/shop" : "/style-dna")}
          style={({ pressed }) => [styles.emptyHeroCta, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel={browse ? C.shop : C.todayEmptyAction}
        >
          <Text style={styles.ctaTxt}>{browse ? C.shop : C.todayEmptyAction}</Text>
        </AccessiblePressable>
      </View>
    </View>
  );
}
function LookCard({ look, colors, onShop }: { look: Look; colors: Colors; onShop?: () => void }) {
  const styles = make(colors);
  const grab = useRef<FrameGrab | null>(null);
  const [busy, setBusy] = useState(false);

  function shopThis() {
    if (busy) return;
    setBusy(true);
    onShop?.();
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
        <AccessiblePressable          onPress={() => void shopThis()}
          style={({ pressed }) => [styles.searchFab, pressed && { opacity: 0.92 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={busy ? `Searching listings for ${look.title}` : `Shop listings for ${look.title}`}
          accessibilityHint="Double tap to find matching listings."
        >
          <Text style={styles.searchFabTxt}>{busy ? "…" : "⌕"}</Text>
        </AccessiblePressable>
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
    <AccessiblePressable      onPress={() => {
        if (uid) void recordCampaignAttribution({ brandId: campaign.brandId, campaignId: campaign.id, channel: "today", type: "engagement", listingId: lead.id, eventId: `today_engagement_${campaign.id}_${uid}_${Date.now()}` }).catch(() => undefined);
        router.push({ pathname: "/closet/[id]", params: { id: lead.id, campaignId: campaign.id, collectionId: campaign.collectionId || "", promotionId: campaign.promotionId || "", campaignChannel: "today" } });
      }}
      style={({ pressed }) => [styles.todayCampaignCard, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={`Explore ${brand?.name || "Brand"} campaign ${campaign.headline || campaign.name}`}
      accessibilityHint="Double tap to explore this drop."
    >
      <Image source={{ uri: lead.photo }} style={styles.todayCampaignImg} contentFit="cover" accessible={false} />
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
    </AccessiblePressable>
  );
}

function ShopLookCard({
  piece,
  country,
  colors,
  matchKind,
}: {
  piece: ClosetPiece;
  country: string;
  colors: Colors;
  matchKind: "exact" | "similar";
}) {
  const styles = make(colors);
  const here = getMarket(country);
  const from = getMarket(piece.country || country);
  const local = from.code === here.code;
  const house = piece.brandId ? getBrand(piece.brandId) : undefined;
  const brand = house?.name || (local ? (piece.brand === "Unlabeled" ? "UVEL" : piece.brand) : from.name);
  const live = getPiece(piece.id) || piece;
  const { saved, uid } = useUvel();
  const C = useCopy();
  const hearts = likeCount(live, saved, uid);
  return (
    <AccessiblePressable      onPress={() => router.push({ pathname: "/closet/[id]", params: { id: live.id } })}
      style={({ pressed }) => [styles.shopCard, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${brand} ${live.name}, ${usd(live.listPriceCents, live.currency || "USD")}`}
      accessibilityHint="Double tap to view this listing."
    >
      <View>
        <Image source={{ uri: live.photo }} style={styles.shopImg} contentFit="cover" accessible={false} />
        <View style={styles.shopNow}>
          <Text style={styles.shopNowTxt}>Shop now</Text>
        </View>
        <View style={styles.matchPill}>
          <Text style={styles.matchPillTxt}>{matchKind === "exact" ? C.exactMatch.toUpperCase() : C.similarPiece.toUpperCase()}</Text>
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
    </AccessiblePressable>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: "#0B0A08" },
    heroWrap: { width: W, backgroundColor: "#0B0A08", overflow: "hidden" },
    heroLoad: { alignItems: "center", justifyContent: "center" },
    hero: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    heroCopy: { position: "absolute", left: 16, right: 16, bottom: 18 },
    emptyHero: { justifyContent: "center", paddingHorizontal: 24, backgroundColor: "#16140F" },
    emptyHeroCopy: { maxWidth: 420 },
    emptyHeroTitle: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 34, lineHeight: 40, marginTop: 12 },
    emptyHeroBody: { color: "rgba(244,240,230,0.68)", fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 340 },
    emptyHeroCta: { alignSelf: "flex-start", backgroundColor: "#F4F0E6", minHeight: 48, paddingHorizontal: 20, borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 22 },
    heroBar: { flexDirection: "row", gap: 10, marginBottom: 16 },
    srcRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    src: { color: "rgba(244,240,230,0.86)", fontSize: 13, fontWeight: "500" },
    aiPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, minHeight: 44, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1, borderColor: "#D6E27A", backgroundColor: "rgba(11,10,8,0.74)", marginBottom: 9 },
    aiPillCompact: { marginBottom: 0, minHeight: 44, backgroundColor: "rgba(11,10,8,0.78)" },
    focused: { borderWidth: 2, borderColor: "#D6E27A" },
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
    ctaSolo: { flex: 1 },
    ghost: {
      flex: 1,
      height: 46,
      borderRadius: 23,
      backgroundColor: "rgba(255,255,255,0.28)",
      alignItems: "center",
      justifyContent: "center",
    },
    ghostTxt: { color: "#F4F0E6", fontWeight: "600", fontSize: 15 },
    todayIntro: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: "rgba(244,240,230,0.08)" },
    todayEyebrow: { color: colors.success, fontSize: 10, fontWeight: "900", letterSpacing: 1.8 },
    todayIntroTitle: { color: colors.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 10 },
    todayIntroBody: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 380 },
    modeRow: { gap: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
    modeButton: { borderBottomWidth: 2, borderBottomColor: "transparent", paddingBottom: 9 },
    modeButtonOn: { borderBottomColor: colors.success },
    modeText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
    modeTextOn: { color: colors.bone },
    sourceLabel: { color: colors.subtle, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, paddingHorizontal: 20, marginTop: 2, marginBottom: 8 },
    featureIntro: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    localCard: { marginHorizontal: 16, marginTop: 12, marginBottom: 8, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.subtle, overflow: "hidden", flexDirection: "row" },
    localImage: { width: 132, minHeight: 190, backgroundColor: colors.surface },
    localCopy: { flex: 1, padding: 14 },
    localK: { color: colors.success, fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
    localTitle: { color: colors.bone, fontSize: 18, fontWeight: "900", marginTop: 8 },
    localVerified: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
    localVerifiedText: { color: colors.muted, fontSize: 11 },
    localMeta: { color: colors.muted, fontSize: 11, marginTop: 5 },
    localBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 12 },
    localAction: { color: colors.bone, fontSize: 12, fontWeight: "900", marginTop: 14 },
    localEmpty: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.subtle, backgroundColor: colors.surface },
    body: { paddingTop: 14, backgroundColor: "#0B0A08" },
    chips: { paddingHorizontal: 20, gap: 8, paddingBottom: 14 },
    filter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      minHeight: 38,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.16)",
    },
    filterOn: { backgroundColor: "#F4F0E6", borderColor: "#F4F0E6" },
    filterTxt: { color: "#F4F0E6", fontWeight: "600", fontSize: 13 },
    filterTxtOn: { color: "#16140F" },
    dot: { width: 8, height: 8, borderRadius: 4 },
    inbox: {
      marginHorizontal: 16,
      marginTop: 20,
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
      marginTop: 30,
      marginBottom: 14,
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
      minWidth: 46,
      minHeight: 46,
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
    matchPill: { position: "absolute", left: 14, top: 14, backgroundColor: "rgba(11,10,8,0.82)", borderWidth: 1, borderColor: "rgba(244,240,230,0.26)", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6 },
    matchPillTxt: { color: "#F4F0E6", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
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
