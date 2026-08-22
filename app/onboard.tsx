import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUvel } from "../lib/store";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const PAGES = [
  {
    kind: "film" as const,
    source: require("../assets/onboarding/tryon.mp4"),
    kicker: "TRY ON",
    title: "See it on you\nbefore you buy.",
    lede: "A look you love. On your body. Then you decide.",
    cta: "Next",
  },
  {
    kind: "film" as const,
    source: require("../assets/onboarding/style.mp4"),
    kicker: "YOUR STYLE",
    title: "Clothes that\nactually suit you.",
    lede: "Not the feed. What looks like you.",
    cta: "Next",
  },
  {
    kind: "market" as const,
    source: 0,
    kicker: "",
    title: "From coats to\nthe last pin.",
    lede: "",
    cta: "Sign in",
  },
];

const PROVIDERS = [
  { id: "apple", label: "Continue with Apple", bg: "#fff", fg: "#111" },
  { id: "google", label: "Continue with Google", bg: "#fff", fg: "#111" },
  { id: "facebook", label: "Continue with Facebook", bg: "#1877F2", fg: "#fff" },
] as const;

const ROW_A = [
  require("../assets/onboarding/market/01.jpg"),
  require("../assets/onboarding/market/06.jpg"),
  require("../assets/onboarding/market/14.jpg"),
  require("../assets/onboarding/market/07.jpg"),
  require("../assets/onboarding/market/02.jpg"),
  require("../assets/onboarding/market/12.jpg"),
  require("../assets/onboarding/market/16.jpg"),
  require("../assets/onboarding/market/09.jpg"),
  require("../assets/onboarding/market/18.jpg"),
  require("../assets/onboarding/market/15.jpg"),
  require("../assets/onboarding/market/08.jpg"),
  require("../assets/onboarding/market/20.jpg"),
];
const ROW_B = [
  require("../assets/onboarding/market/03.jpg"),
  require("../assets/onboarding/market/11.jpg"),
  require("../assets/onboarding/market/22.jpg"),
  require("../assets/onboarding/market/04.jpg"),
  require("../assets/onboarding/market/13.jpg"),
  require("../assets/onboarding/market/17.jpg"),
  require("../assets/onboarding/market/10.jpg"),
  require("../assets/onboarding/market/19.jpg"),
  require("../assets/onboarding/market/05.jpg"),
  require("../assets/onboarding/market/21.jpg"),
  require("../assets/onboarding/market/23.jpg"),
  require("../assets/onboarding/market/24.jpg"),
];
const WIDTHS = [148, 176, 156, 188, 142, 170];

function DriftRow({
  images,
  height,
  duration,
}: {
  images: number[];
  height: number;
  duration: number;
}) {
  const x = useSharedValue(0);
  const [span, setSpan] = useState(0);

  useEffect(() => {
    if (span <= 0) return;
    x.value = 0;
    x.value = withRepeat(
      withTiming(-span, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [span, duration, x]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const doubled = [...images, ...images];

  return (
    <Animated.View
      style={[{ flexDirection: "row" }, style]}
      onLayout={(e) => setSpan(e.nativeEvent.layout.width / 2)}
    >
      {doubled.map((src, i) => (
        <Image
          key={i}
          source={src}
          style={{
            width: WIDTHS[i % WIDTHS.length],
            height,
            borderRadius: 18,
            marginRight: 10,
          }}
          contentFit="cover"
        />
      ))}
    </Animated.View>
  );
}

function Catalog({
  onSignIn,
  insets,
}: {
  onSignIn: () => void;
  insets: { top: number; bottom: number };
}) {
  const gridH = Math.min(SCREEN_H * 0.5, 430);
  const tileH = (gridH - 10) / 2;

  return (
    <View style={styles.market}>
      <View style={[styles.grid, { marginTop: insets.top + 36, height: gridH }]}>
        <DriftRow images={ROW_A} height={tileH} duration={18000} />
        <View style={{ height: 10 }} />
        <DriftRow images={ROW_B} height={tileH} duration={22000} />
      </View>
      <View
        style={[
          styles.marketCopy,
          { paddingBottom: Math.max(insets.bottom, 12) + 14 },
        ]}
      >
        <View style={styles.dots}>
          {PAGES.map((p, i) => (
            <View key={p.title} style={[styles.dot, i === 2 && styles.dotOn]} />
          ))}
        </View>
        <Text style={styles.title}>From coats to{"\n"}the last pin.</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onSignIn} style={styles.cta}>
          <Text style={styles.ctaText}>Sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Film({ source, active }: { source: number; active: boolean }) {
  const lastTime = useRef(0);
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    if (active) p.play();
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  useEffect(() => {
    const tick = setInterval(() => {
      lastTime.current = player.currentTime;
    }, 250);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && active) {
        try {
          if (lastTime.current > 0.05) player.currentTime = lastTime.current;
          player.play();
        } catch {
          /* still attaching */
        }
      } else {
        lastTime.current = player.currentTime;
      }
    });
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [player, active]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export default function Onboard() {
  const { completeOnboard } = useUvel();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const [auth, setAuth] = useState(false);
  const scroller = useRef<ScrollView>(null);

  function finish(provider?: string) {
    setAuth(false);
    void completeOnboard(provider);
  }

  function next() {
    if (page >= PAGES.length - 1) {
      setAuth(true);
      return;
    }
    const n = page + 1;
    scroller.current?.scrollTo({ x: n * SCREEN_W, animated: true });
    setPage(n);
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const n = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (n !== page && n >= 0 && n < PAGES.length) setPage(n);
  }

  const copy = PAGES[page];

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        style={StyleSheet.absoluteFill}
      >
        {PAGES.map((p, i) => (
          <View key={p.title} style={{ width: SCREEN_W, height: "100%" }}>
            {p.kind === "market" ? (
              <Catalog onSignIn={() => setAuth(true)} insets={insets} />
            ) : (
              <Film source={p.source} active={page === i} />
            )}
          </View>
        ))}
      </ScrollView>

      <Pressable onPress={() => finish()} style={[styles.skip, { top: insets.top + 8 }]} hitSlop={16}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      {copy.kind !== "market" ? (
        <View style={[styles.copy, { paddingBottom: Math.max(insets.bottom, 12) + 14 }]}>
          <View style={styles.dots}>
            {PAGES.map((p, i) => (
              <View key={p.title} style={[styles.dot, i === page && styles.dotOn]} />
            ))}
          </View>
          <Text style={styles.kicker}>{copy.kicker}</Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.lede}>{copy.lede}</Text>
          <Pressable onPress={next} style={styles.cta}>
            <Text style={styles.ctaText}>{copy.cta}</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={auth} animationType="slide" transparent onRequestClose={() => setAuth(false)}>
        <Pressable style={styles.sheetDim} onPress={() => setAuth(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} onPress={() => undefined}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Sign in to Uvel</Text>
            <Text style={styles.sheetLede}>Apple, Google, or Facebook.</Text>
            {PROVIDERS.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => finish(p.id)}
                style={[styles.provider, { backgroundColor: p.bg }]}
              >
                <Text style={[styles.providerText, { color: p.fg }]}>{p.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => finish()} style={styles.guest}>
              <Text style={styles.guestText}>Not now</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#12140A" },
  market: { flex: 1, backgroundColor: "#12140A" },
  grid: { overflow: "hidden" },
  marketCopy: { flex: 1, paddingHorizontal: 22, paddingTop: 22 },
  skip: { position: "absolute", right: 18, zIndex: 2 },
  skipText: { color: "rgba(255,255,255,0.82)", fontSize: 13, letterSpacing: 0.6 },
  copy: { position: "absolute", left: 22, right: 22, bottom: 0 },
  dots: { flexDirection: "row", gap: 6, marginBottom: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.28)" },
  dotOn: { backgroundColor: "#fff", width: 16 },
  kicker: { color: "rgba(255,255,255,0.7)", fontSize: 11, letterSpacing: 2.4, marginBottom: 8 },
  title: { color: "#fff", fontFamily: "Georgia", fontSize: 32, lineHeight: 34 },
  lede: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 20,
    maxWidth: 280,
  },
  cta: {
    height: 50,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#2A320E", fontSize: 15, fontWeight: "600" },
  sheetDim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1A1C14",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
    marginBottom: 18,
  },
  sheetTitle: { color: "#fff", fontFamily: "Georgia", fontSize: 26 },
  sheetLede: { color: "rgba(255,255,255,0.65)", fontSize: 14, marginTop: 6, marginBottom: 20 },
  provider: {
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  providerText: { fontSize: 16, fontWeight: "600" },
  guest: { height: 44, alignItems: "center", justifyContent: "center", marginTop: 4 },
  guestText: { color: "rgba(255,255,255,0.55)", fontSize: 14 },
});
