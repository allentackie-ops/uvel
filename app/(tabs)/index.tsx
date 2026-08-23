import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  AppState,
  Dimensions,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass } from "../../components/Glass";
import { ListingCard, ListingEmpty } from "../../components/ListingCard";
import { unreadFor, useInbox } from "../../lib/chat";
import { frameAtTime, prefetchLookVideo } from "../../lib/lookFrame";
import { forYou, matchListings } from "../../lib/lookMatch";
import { beginLookScan, finishLookScan } from "../../lib/lookSearch";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { SOURCES, lookImage, useLooks, type Look, type Source } from "../../lib/trends";
import { listedPieces, useWardrobe } from "../../lib/wardrobe";

const { width: W, height: H } = Dimensions.get("screen");
const CARD_W = Math.round((W - 32) / 2.28);
const CARD_H = Math.round(CARD_W * 1.52);
const SHOP_W = Math.round(W * 0.58);

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
  style,
  handleRef,
}: {
  uri: string;
  style: object;
  handleRef?: MutableRefObject<FrameGrab | null>;
}) {
  const held = useRef(false);
  const lastTime = useRef(0);
  const frozenAt = useRef(0);
  const player = useVideoPlayer({ uri }, (p) => {
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
    player.timeUpdateEventInterval = 0.03;
    prefetchLookVideo(uri);
    const status = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") playIfFree();
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
  }, [player, uri, playIfFree]);

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
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  );
}

function LookMedia({
  look,
  style,
  handleRef,
}: {
  look: Look;
  style: object;
  handleRef?: MutableRefObject<FrameGrab | null>;
}) {
  useEffect(() => {
    if (look.videoUrl || !handleRef) return;
    handleRef.current = {
      freeze: () => 0,
      frame: async () => look.imageUrl || null,
    };
    return () => {
      handleRef.current = null;
    };
  }, [look.videoUrl, look.imageUrl, handleRef]);
  if (look.videoUrl) return <MutedLoop uri={look.videoUrl} style={style} handleRef={handleRef} />;
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

function Filters({
  source,
  onSource,
  colors,
}: {
  source: Source;
  onSource: (s: Source) => void;
  colors: Colors;
}) {
  const styles = make(colors);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {SOURCES.map((s) => {
        const on = source === s;
        return (
          <Pressable key={s} onPress={() => onSource(s)} style={[styles.filter, on && styles.filterOn]}>
            {s !== "All" ? <View style={[styles.dot, { backgroundColor: DOT[s] }]} /> : null}
            <Text style={[styles.filterTxt, on && styles.filterTxtOn]}>{s}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function Today() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const { uid, styles: taste, country, appearance } = useUvel();
  const chats = useInbox(uid || "me");
  const unread = chats.reduce((n, t) => n + unreadFor(t, uid || "me"), 0);
  const { looks, refreshing, refresh } = useLooks();
  useWardrobe();
  const live = listedPieces();
  const [source, setSource] = useState<Source>("All");
  const [pastHero, setPastHero] = useState(false);
  const heroH = H;

  const visible = useMemo(
    () => (source === "All" ? looks : looks.filter((t) => t.source === source)),
    [looks, source],
  );
  const featured = visible[0] ?? looks[0];
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y;
    setPastHero(y > heroH - insets.top - 88);
  }

  return (
    <View style={styles.page}>
      <StatusBar style={pastHero && appearance === "light" ? "dark" : "light"} />
      <ScrollView
        style={styles.page}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={{ paddingBottom: 108 + insets.bottom }}
        scrollEventThrottle={16}
        onScroll={onScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor="#F4F0E6"
            progressViewOffset={insets.top}
          />
        }
      >
        {featured ? (
          <Hero look={featured} today={today} colors={colors} height={heroH} bottomPad={insets.bottom + 88} topPad={insets.top} />
        ) : (
          <View style={[styles.heroWrap, { height: heroH }]} />
        )}

        <View style={styles.body}>
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
            <Text style={styles.inboxGo}>{unread ? String(unread) : chats.length ? String(chats.length) : "›"}</Text>
          </Pressable>

          <Text style={styles.h2}>{source === "All" ? "Moving now" : `Now on ${source}`}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {visible.map((look) => (
              <LookCard key={look.id} look={look} colors={colors} />
            ))}
          </ScrollView>

          {featured ? (
            <>
              <Text style={styles.h2}>Shop the look</Text>
              {(() => {
                const hits = matchListings(featured, live, taste).slice(0, 8);
                if (!hits.length) {
                  return (
                    <View style={{ paddingHorizontal: 16 }}>
                      <ListingEmpty copy="No listings match this look yet. When someone sells the real piece, it lands here." />
                    </View>
                  );
                }
                return (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
                    {hits.map((p) => (
                      <ListingCard key={p.id} piece={p} wide={SHOP_W} badge="Shop" />
                    ))}
                  </ScrollView>
                );
              })()}
            </>
          ) : null}

          <Text style={styles.h2}>For you</Text>
          {live.length ? (
            <View style={styles.grid}>
              {forYou(live, taste, country).slice(0, 8).map((p) => (
                <View key={p.id} style={styles.cell}>
                  <ListingCard piece={p} />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16 }}>
              <ListingEmpty copy="Only real listings show here. Sell something from Closet and it appears on the floor." />
            </View>
          )}
        </View>
      </ScrollView>

      {pastHero ? (
        <View style={[styles.sticky, { paddingTop: insets.top + 6, paddingBottom: 10 }]}>
          <Filters source={source} onSource={setSource} colors={colors} />
        </View>
      ) : null}
    </View>
  );
}

function Hero({
  look,
  today,
  colors,
  height,
  bottomPad,
  topPad,
}: {
  look: Look;
  today: string;
  colors: Colors;
  height: number;
  bottomPad: number;
  topPad: number;
}) {
  const styles = make(colors);
  const seen = where(look.postUrl) || look.source;
  const grab = useRef<FrameGrab | null>(null);
  const [busy, setBusy] = useState(false);

  function shopThis() {
    if (busy) return;
    setBusy(true);
    scanLook(look, grab.current);
    setTimeout(() => setBusy(false), 400);
  }

  return (
    <View>
      <View style={[styles.heroWrap, { height }]}>
        <LookMedia look={look} style={styles.hero} handleRef={grab} />
        <View pointerEvents="none" style={styles.topFade}>
          <View style={[styles.fadeBand, { backgroundColor: "rgba(0,0,0,0.55)" }]} />
          <View style={[styles.fadeBand, { backgroundColor: "rgba(0,0,0,0.32)" }]} />
          <View style={[styles.fadeBand, { backgroundColor: "rgba(0,0,0,0.14)" }]} />
          <View style={[styles.fadeBand, { backgroundColor: "rgba(0,0,0,0)" }]} />
        </View>
        <View style={[styles.heroTop, { top: topPad + 8 }]}>
          <View style={styles.srcPill}>
            <View style={[styles.dot, { backgroundColor: DOT[look.source] }]} />
            <Text style={styles.srcPillTxt} numberOfLines={1}>
              {look.handle ? `${look.source} · ${look.handle}` : look.source}
            </Text>
          </View>
        </View>
        <View style={[styles.heroBar, { bottom: bottomPad + 28 }]}>
          <Pressable onPress={() => void shopThis()} style={styles.cta}>
            <Text style={styles.ctaTxt}>{busy ? "Searching…" : "Shop the look"}</Text>
          </Pressable>
          {look.postUrl ? (
            <Pressable onPress={() => void Linking.openURL(look.postUrl!)}>
              <Glass effect="regular" style={styles.ghost}>
                <Text style={styles.ghostTxt}>See on {seen}</Text>
              </Glass>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.heroCopy}>
        <Text style={styles.date}>{today}</Text>
        <Text style={styles.title}>{look.title}</Text>
        {look.summary ? <Text style={styles.summary}>{look.summary}</Text> : null}
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

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    heroWrap: { width: W, height: H, backgroundColor: "#0B0A08", overflow: "hidden" },
    hero: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    topFade: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 160,
    },
    fadeBand: { flex: 1 },
    heroTop: {
      position: "absolute",
      left: 16,
      right: 16,
    },
    srcPill: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      backgroundColor: "rgba(11,10,8,0.42)",
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.22)",
      paddingHorizontal: 12,
      height: 30,
      borderRadius: 15,
      maxWidth: "80%",
    },
    srcPillTxt: { color: "#F4F0E6", fontSize: 12, fontWeight: "600" },
    heroBar: {
      position: "absolute",
      left: 16,
      right: 16,
      flexDirection: "row",
      gap: 10,
    },
    heroCopy: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 2 },
    date: {
      color: colors.subtle,
      fontSize: 11,
      letterSpacing: 1.8,
      fontWeight: "600",
      textTransform: "uppercase",
      marginBottom: 8,
    },
    srcRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    src: { color: colors.muted, fontSize: 12, letterSpacing: 0.4 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, lineHeight: 36 },
    summary: { color: colors.muted, marginTop: 8, fontSize: 15, lineHeight: 22 },
    cta: {
      backgroundColor: "rgba(244,240,230,0.96)",
      paddingHorizontal: 18,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaTxt: { color: "#16140F", fontWeight: "700", fontSize: 14 },
    ghost: {
      paddingHorizontal: 16,
      height: 44,
      borderRadius: 22,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    ghostTxt: { color: "#F4F0E6", fontWeight: "600", fontSize: 14 },
    body: { paddingTop: 10 },
    sticky: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(18,17,14,0.94)",
    },
    chips: { paddingHorizontal: 16, gap: 8 },
    filter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      height: 34,
      paddingHorizontal: 14,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.18)",
    },
    filterOn: { backgroundColor: "#F4F0E6", borderColor: "#F4F0E6" },
    filterTxt: { color: colors.bone, fontWeight: "600", fontSize: 13 },
    filterTxtOn: { color: "#16140F" },
    dot: { width: 8, height: 8, borderRadius: 4 },
    inbox: {
      marginHorizontal: 16,
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    inboxK: { color: colors.bone, fontWeight: "700", fontSize: 15 },
    inboxP: { color: colors.muted, marginTop: 2, fontSize: 13 },
    inboxGo: { color: "#D6E27A", fontWeight: "700", fontSize: 16 },
    h2: {
      color: colors.bone,
      fontFamily: "Georgia",
      fontSize: 24,
      marginTop: 20,
      marginBottom: 12,
      paddingHorizontal: 16,
    },
    strip: { paddingHorizontal: 16, gap: 10, paddingRight: 28 },
    card: { width: CARD_W },
    cardFrame: {
      width: CARD_W,
      height: CARD_H,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: colors.surface,
    },
    cardFill: { width: CARD_W, height: CARD_H },
    cardSrcPill: {
      position: "absolute",
      top: 10,
      left: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(11,10,8,0.55)",
      paddingHorizontal: 10,
      height: 24,
      borderRadius: 12,
    },
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
    cardTitle: { color: colors.bone, fontFamily: "Georgia", fontSize: 16, marginTop: 8, lineHeight: 20 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16 },
    cell: { width: "47%", flexGrow: 1 },
  });
}
