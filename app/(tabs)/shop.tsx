import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard, ListingEmpty } from "../../components/ListingCard";
import { OrbitLoader } from "../../components/OrbitLoader";
import { VerifiedMark } from "../../components/VerifiedMark";
import { followedBrandIds, ownedBrand, verifiedBrands, useBrands } from "../../lib/brands";
import { CATEGORIES } from "../../lib/catalog";
import { forYou, lensScan, matchListings } from "../../lib/lookMatch";
import { watchLookScan, finishLookScan, clearLookScan, type LookScan } from "../../lib/lookSearch";
import { getMarket } from "../../lib/markets";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { bundledLooks } from "../../lib/trends";
import { shopFloor, useWardrobe } from "../../lib/wardrobe";

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

export default function Shop() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const { country, styles: taste } = app;
  const market = getMarket(country);
  const { q: qParam, look: lookParam, scan } = useLocalSearchParams<{ q?: string; look?: string; scan?: string }>();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const [aiIds, setAiIds] = useState<string[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [job, setJob] = useState<LookScan | null>(null);
  useWardrobe();
  const brandState = useBrands();
  const followedIds = useMemo(() => followedBrandIds(app.uid), [brandState, app.uid]);
  const followedKey = followedIds.join("|");
  const mine = ownedBrand(app.uid);
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
  const live = shopFloor(country);
  const scanningLook = Boolean(scan === "1" || look || frame || videoUrl);

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

    const rows = look ? matchListings(look, live, taste, followedIds) : forYou(live, taste, country, followedIds);
    return rows.filter(passQ);
  }, [live, look, aiIds, q, cat, taste, country, scanningLook, followedKey]);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>{scanningLook ? "Shop the look" : "Shop"}</Text>
        {!scanningLook ? (
          <Pressable
            onPress={() => {
              if (mine?.verified) router.push({ pathname: "/brand/[id]", params: { id: mine.id } });
              else router.push("/brand/apply");
            }}
            style={styles.brandBtn}
          >
            {mine?.verified ? <VerifiedMark size={14} /> : null}
            <Text style={styles.brandBtnTxt}>{mine?.verified ? "Your brand" : mine ? "Brand filing" : "Start a brand"}</Text>
          </Pressable>
        ) : null}
      </View>
      {scanningLook ? (
        <Text style={styles.look}>{job?.title || look?.title || "This frame"}</Text>
      ) : (
        <Pressable onPress={() => router.push("/store")} style={styles.store}>
          <Text style={styles.storeTxt}>
            {market.name} shop · {market.currency}{" "}
          </Text>
          <Text style={styles.storeGo}>Change</Text>
        </Pressable>
      )}

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
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          placeholder={scanningLook ? "Narrow this look" : "Search what’s listed"}
          placeholderTextColor={colors.subtle}
          value={q}
          onChangeText={setQ}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
        />
        {q ? (
          <Pressable onPress={() => setQ("")} hitSlop={8}>
            <Text style={styles.clear}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CATEGORIES.map((c) => {
          const on = cat === c;
          return (
            <Pressable key={c} onPress={() => setCat(c)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{c}</Text>
            </Pressable>
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
              <Pressable
                key={b.id}
                onPress={() => router.push({ pathname: "/brand/[id]", params: { id: b.id } })}
                style={styles.house}
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
                    <VerifiedMark size={12} />
                  </View>
                  <Text style={styles.houseLine} numberOfLines={1}>
                    {b.tagline || b.vertical}
                  </Text>
                </View>
              </Pressable>
            ))}
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
              <View key={p.id} style={styles.cell}>
                <ListingCard piece={p} framed />
              </View>
            ))}
      </View>

      {!scanning && ranked.length === 0 ? (
        <ListingEmpty
          copy={
            scanningLook
              ? "Nothing on this shop looks like that yet."
              : `Nothing on the ${market.name} shop yet. Listings from other countries stay there unless the seller opens them to this store.`
          }
        />
      ) : null}
    </ScrollView>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: "#0B0A08" },
    content: { paddingHorizontal: 16, paddingBottom: 108 },
    title: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 34, lineHeight: 38, flex: 1 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    brandBtn: {
      height: 34,
      paddingHorizontal: 12,
      borderRadius: 17,
      backgroundColor: "#161512",
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.16)",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    brandBtnTxt: { color: "#F4F0E6", fontWeight: "700", fontSize: 12 },
    brandHead: { flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 10, gap: 4 },
    brandHeadTxt: { color: "#F4F0E6", fontWeight: "700", fontSize: 18 },
    brandHeadGo: { color: "rgba(244,240,230,0.45)", fontSize: 22, marginTop: -2 },
    brandRail: { gap: 10, paddingBottom: 4 },
    house: {
      width: 220,
      backgroundColor: "#161512",
      borderRadius: 16,
      overflow: "hidden",
      flexDirection: "row",
      padding: 8,
      gap: 10,
      alignItems: "center",
    },
    houseLogo: { width: 56, height: 56, borderRadius: 12, backgroundColor: "#1A1915" },
    houseMeta: { flex: 1, paddingRight: 4 },
    houseName: { color: "#F4F0E6", fontWeight: "700", fontSize: 14, flexShrink: 1 },
    houseLine: { color: "rgba(244,240,230,0.5)", fontSize: 12, marginTop: 3 },
    look: { color: "rgba(244,240,230,0.62)", marginTop: 6, fontSize: 16 },
    frame: {
      marginTop: 16,
      height: 420,
      borderRadius: 16,
      backgroundColor: "#0B0A08",
    },
    orbitBox: { paddingVertical: 48, alignItems: "center" },
    store: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 },
    storeTxt: { color: "rgba(244,240,230,0.5)", fontSize: 15 },
    storeGo: { color: "rgba(244,240,230,0.72)", fontSize: 15, textDecorationLine: "underline" },
    search: {
      marginTop: 18,
      height: 46,
      borderRadius: 23,
      backgroundColor: "#141310",
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.12)",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      gap: 8,
    },
    searchIcon: { color: "rgba(244,240,230,0.4)", fontSize: 16, marginTop: -1 },
    input: { flex: 1, color: "#F4F0E6", fontSize: 16, height: 46 },
    clear: { color: "rgba(244,240,230,0.5)", fontSize: 22, paddingHorizontal: 4 },
    chips: { gap: 8, paddingVertical: 16 },
    chip: {
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    chipOn: { backgroundColor: "#F4F0E6", borderColor: "#F4F0E6" },
    chipTxt: { color: "#F4F0E6", fontSize: 13, fontWeight: "600" },
    chipTxtOn: { color: "#16140F" },
    count: { color: "rgba(244,240,230,0.4)", fontSize: 13, marginBottom: 12 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    cell: { width: "48%", flexGrow: 1, maxWidth: "48.5%" },
  });
}
