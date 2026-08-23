import { Image } from "expo-image";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useState } from "react";
import {
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
import { unreadFor, useInbox } from "../../lib/chat";
import { forYou, matchListings } from "../../lib/lookMatch";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { SOURCES, lookImage, useLooks, type Look, type Source } from "../../lib/trends";
import { listedPieces, useWardrobe } from "../../lib/wardrobe";

const { height: H } = Dimensions.get("window");

const DOT: Record<Exclude<Source, "All">, string> = {
  TikTok: "#FE2C55",
  Instagram: "#E1306C",
  Snapchat: "#FFFC00",
  X: "#F4F0E6",
};

function MutedLoop({ uri, style }: { uri: string; style: object }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = "mixWithOthers";
  });
  useEffect(() => {
    const sub = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") player.play();
    });
    player.loop = true;
    player.muted = true;
    player.play();
    const app = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        player.loop = true;
        player.muted = true;
        player.play();
      }
    });
    return () => {
      sub.remove();
      app.remove();
    };
  }, [player, uri]);
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

function LookMedia({ look, style }: { look: Look; style: object }) {
  if (look.videoUrl) return <MutedLoop uri={look.videoUrl} style={style} />;
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

export default function Today() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const { uid, styles: taste, country } = useUvel();
  const chats = useInbox(uid || "me");
  const unread = chats.reduce((n, t) => n + unreadFor(t, uid || "me"), 0);
  const { looks, refreshing, refresh } = useLooks();
  useWardrobe();
  const live = listedPieces();
  const [source, setSource] = useState<Source>("All");

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

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: 88 + insets.bottom }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#F4F0E6" />}
    >
      {featured ? <Hero look={featured} today={today} colors={colors} /> : null}

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
                    <View key={p.id} style={{ width: 148 }}>
                      <ListingCard piece={p} />
                    </View>
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
  );
}

function Hero({
  look,
  today,
  colors,
}: {
  look: Look;
  today: string;
  colors: Colors;
}) {
  const styles = make(colors);
  const seen = where(look.postUrl) || look.source;
  return (
    <View>
      <View style={styles.heroWrap}>
        <LookMedia look={look} style={styles.hero} />
        <View style={styles.heroScrim} />
        <View style={styles.heroBar}>
          <Pressable
            onPress={() =>
              router.push({ pathname: "/(tabs)/shop", params: look.id ? { look: look.id } : { q: look.shopQuery || look.title } })
            }
            style={styles.cta}
          >
            <Text style={styles.ctaTxt}>Shop the look</Text>
          </Pressable>
          {look.postUrl ? (
            <Pressable onPress={() => void Linking.openURL(look.postUrl!)} style={styles.ghost}>
              <Text style={styles.ghostTxt}>See on {seen}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.heroCopy}>
        <Text style={styles.date}>{today}</Text>
        <View style={styles.srcRow}>
          <View style={[styles.dot, { backgroundColor: DOT[look.source] }]} />
          <Text style={styles.src}>{look.handle ? `${look.source} · ${look.handle}` : look.heat || look.source}</Text>
        </View>
        <Text style={styles.title}>{look.title}</Text>
        {look.summary ? <Text style={styles.summary}>{look.summary}</Text> : null}
      </View>
    </View>
  );
}

function LookCard({ look, colors }: { look: Look; colors: Colors }) {
  const styles = make(colors);
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/(tabs)/shop",
          params: look.id ? { look: look.id } : { q: look.shopQuery || look.title },
        })
      }
      style={styles.card}
    >
      <View style={styles.cardFrame}>
        <LookMedia look={look} style={styles.cardFill} />
      </View>
      <View style={styles.cardMeta}>
        <View style={styles.srcRow}>
          <View style={[styles.dot, { backgroundColor: DOT[look.source] }]} />
          <Text style={styles.cardSrc}>{look.source}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {look.title}
        </Text>
      </View>
    </Pressable>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    heroWrap: { height: Math.min(560, H * 0.62), backgroundColor: "#0B0A08", overflow: "hidden" },
    hero: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    heroScrim: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 120,
      backgroundColor: "rgba(11,10,8,0.28)",
    },
    heroBar: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 18,
      flexDirection: "row",
      gap: 10,
    },
    playHit: { position: "absolute", right: 16, bottom: 16 },
    play: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    playTxt: { color: "#fff", fontSize: 16, marginLeft: 2 },
    cardPlay: {
      position: "absolute",
      right: 10,
      top: 10,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    heroCopy: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
    date: {
      color: colors.subtle,
      fontSize: 11,
      letterSpacing: 1.8,
      fontWeight: "600",
      textTransform: "uppercase",
      marginBottom: 10,
    },
    srcRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    src: { color: colors.muted, fontSize: 12, letterSpacing: 0.4 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 34, lineHeight: 38, marginTop: 10 },
    summary: { color: colors.muted, marginTop: 10, fontSize: 15, lineHeight: 22 },
    actions: { flexDirection: "row", gap: 10, marginTop: 18 },
    cta: {
      backgroundColor: "rgba(244,240,230,0.94)",
      paddingHorizontal: 18,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaTxt: { color: "#16140F", fontWeight: "700", fontSize: 14 },
    ghost: {
      paddingHorizontal: 16,
      height: 42,
      borderRadius: 21,
      backgroundColor: "rgba(11,10,8,0.38)",
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    ghostTxt: { color: "#F4F0E6", fontWeight: "600", fontSize: 14 },
    body: { paddingTop: 18 },
    chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
    filter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.18)",
    },
    filterOn: { backgroundColor: "#F4F0E6", borderColor: "#F4F0E6" },
    filterTxt: { color: colors.bone, fontWeight: "600", fontSize: 13 },
    filterTxtOn: { color: "#16140F" },
    dot: { width: 8, height: 8, borderRadius: 4 },
    inbox: {
      marginHorizontal: 16,
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    inboxK: { color: colors.bone, fontWeight: "700", fontSize: 15 },
    inboxP: { color: colors.muted, marginTop: 2, fontSize: 13 },
    inboxGo: { color: "#D6E27A", fontWeight: "700", fontSize: 16 },
    h2: {
      color: colors.bone,
      fontFamily: "Georgia",
      fontSize: 26,
      marginTop: 26,
      marginBottom: 14,
      paddingHorizontal: 16,
    },
    strip: { paddingHorizontal: 16, gap: 12 },
    card: { width: 168 },
    cardFrame: {
      width: 168,
      height: 240,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: colors.surface,
    },
    cardFill: { width: 168, height: 240 },
    cardImg: { width: 168, height: 240, borderRadius: 16, backgroundColor: colors.surface },
    cardMeta: { paddingTop: 10, paddingRight: 4 },
    cardSrc: { color: colors.subtle, fontSize: 11, fontWeight: "600" },
    cardTitle: { color: colors.bone, fontFamily: "Georgia", fontSize: 16, marginTop: 4, lineHeight: 20 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16 },
    cell: { width: "47%", flexGrow: 1 },
  });
}
