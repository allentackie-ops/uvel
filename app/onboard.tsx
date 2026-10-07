import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Dimensions,
  FlatList,
  Image as MosaicImg,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AuthScreen } from "../components/AuthScreen";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FirstLaunchWelcome } from "../components/FirstLaunchWelcome";
import { pullOta } from "../lib/ota";
import { DOCS } from "../lib/legal";
import { useUvel } from "../lib/store";
import { LANGS, isRtl, langLabel, t } from "../lib/i18n";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const PAGES = [
  {
    kind: "welcome" as const,
  },
  {
    kind: "film" as const,
    source: require("../assets/onboarding/tryon.mp4"),
  },
  {
    kind: "film" as const,
    source: require("../assets/onboarding/style.mp4"),
  },
  {
    kind: "market" as const,
    source: 0,
  },
];

const STRIP_A = require("../assets/onboarding/strips/a-k7-clean.jpg");
const STRIP_B = require("../assets/onboarding/strips/b-k7-clean.jpg");
const STRIP_A_ASPECT = 5840 / 800;
const STRIP_B_ASPECT = 4672 / 800;

function gridMetrics(topInset: number) {
  const gridH = Math.min(SCREEN_H * 0.5, 430);
  const gridTop = topInset + 36;
  return { gridH, gridTop, sheetMin: SCREEN_H - gridTop - gridH };
}

function DriftRow({
  source,
  height,
  duration,
  reverse,
}: {
  source: number;
  height: number;
  duration: number;
  reverse?: boolean;
}) {
  const x = useSharedValue(0);
  const span = useSharedValue(0);
  const dir = reverse ? 1 : -1;
  const stripW = Math.round(height * (source === STRIP_A ? STRIP_A_ASPECT : STRIP_B_ASPECT));

  useFrameCallback((frame) => {
    "worklet";
    const w = span.value;
    if (w <= 1) return;
    const dt = Math.min(frame.timeSincePreviousFrame ?? 16, 24);
    let next = x.value + dir * (w / duration) * dt;
    if (next <= -w) next += w;
    if (next > 0) next -= w;
    x.value = next;
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <Animated.View style={[{ flexDirection: "row" }, style]}>
      <View
        onLayout={() => {
          span.value = stripW;
          if (reverse && x.value === 0) x.value = -stripW;
        }}
      >
        <MosaicImg
          source={source}
          style={{ width: stripW, height }}
          resizeMode="stretch"
        />
      </View>
      <MosaicImg
        source={source}
        style={{ width: stripW, height }}
        resizeMode="stretch"
      />
    </Animated.View>
  );
}

function Catalog({
  onSignUp,
  onLogIn,
  onLegal,
  insets,
  copy,
  rtl,
}: {
  onSignUp: () => void;
  onLogIn: () => void;
  onLegal: (id: "terms" | "privacy") => void;
  insets: { top: number; bottom: number };
  copy: { marketTitle: string; signUp: string; logIn: string; continueAgreement: string; termsAndConditions: string; andWord: string; privacyPolicy: string };
  rtl?: boolean;
}) {
  const { gridH, gridTop } = gridMetrics(insets.top);
  const tileH = (gridH - 10) / 2;

  useEffect(() => {
    void pullOta();
  }, []);

  return (
    <View style={styles.market}>
      <View style={[styles.grid, { marginTop: gridTop, height: gridH }]}>
        <DriftRow source={STRIP_A} height={tileH} duration={40000} />
        <View style={{ height: 10 }} />
        <DriftRow source={STRIP_B} height={tileH} duration={46000} reverse />
      </View>
      <View
        style={[
          styles.marketCopy,
          { paddingBottom: Math.max(insets.bottom, 12) + 14 },
        ]}
      >
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View key={i} style={[styles.dot, i === PAGES.length - 1 && styles.dotOn]} />
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <Text style={[styles.title, rtl && styles.rtl]}>{copy.marketTitle}</Text>
        <Pressable onPress={onSignUp} style={[styles.cta, { marginTop: 22 }]}>
          <Text style={styles.ctaText}>{copy.signUp}</Text>
        </Pressable>
        <Pressable onPress={onLogIn} style={styles.ctaLogin}>
          <Text style={styles.ctaLoginText}>{copy.logIn}</Text>
        </Pressable>
        <Text style={[styles.legalCopy, rtl && styles.rtl]}>
          {copy.continueAgreement}{" "}
          <Text style={styles.legalLink} onPress={() => onLegal("terms")}>
            {copy.termsAndConditions}
          </Text>{" "}{copy.andWord}{" "}
          <Text style={styles.legalLink} onPress={() => onLegal("privacy")}>
            {copy.privacyPolicy}
          </Text>
          .
        </Text>
      </View>
    </View>
  );
}

function Film({ source, active }: { source: number; active: boolean }) {
  const lastTime = useRef(0);
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.volume = 0;
    p.audioMixingMode = "mixWithOthers";
    p.allowsExternalPlayback = false;
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
  const { locale, setLocale, onboardVersion } = useUvel();
  const insets = useSafeAreaInsets();
  const C = t(locale || "en-US");
  const rtl = isRtl(locale || "en-US");
  const [langsOpen, setLangsOpen] = useState(false);
  const [langQuery, setLangQuery] = useState("");
  const langY = useSharedValue(SCREEN_H);
  const langDim = useSharedValue(0);
  const startPage = (onboardVersion ?? 0) >= 4 ? PAGES.length - 1 : 0;
  const [page, setPage] = useState(startPage);
  const [authOpen, setAuthOpen] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const [legalId, setLegalId] = useState<"terms" | "privacy" | null>(null);

  useEffect(() => {
    if (startPage <= 0) return;
    const t = setTimeout(() => {
      scroller.current?.scrollTo({ x: startPage * SCREEN_W, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [startPage]);

  function closeAuth() {
    setAuthOpen(false);
  }

  function closeLangs() {
    setLangsOpen(false);
    setLangQuery("");
  }

  function openLangs() {
    langY.value = SCREEN_H;
    langDim.value = 0;
    setLangsOpen(true);
  }

  useEffect(() => {
    if (!langsOpen) return;
    langY.value = SCREEN_H;
    langDim.value = 0;
    langY.value = withTiming(0, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
    langDim.value = withTiming(1, { duration: 320 });
  }, [langsOpen, langDim, langY]);

  const dismissLangs = () => {
    langDim.value = withTiming(0, { duration: 260 });
    langY.value = withTiming(
      SCREEN_H,
      { duration: 340, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(closeLangs)();
      },
    );
  };

  const langPan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-48, 48])
    .onUpdate((e) => {
      const y = Math.max(0, e.translationY);
      langY.value = y;
      langDim.value = Math.max(0, 1 - y / (SCREEN_H * 0.4));
    })
    .onEnd((e) => {
      if (e.translationY > 90 || e.velocityY > 700) {
        langDim.value = withTiming(0, { duration: 260 });
        langY.value = withTiming(
          SCREEN_H,
          { duration: 320, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(closeLangs)();
          },
        );
      } else {
        langY.value = withSpring(0, {
          damping: 26,
          stiffness: 220,
          overshootClamping: true,
        });
        langDim.value = withTiming(1, { duration: 180 });
      }
    });

  const langSlide = useAnimatedStyle(() => ({
    transform: [{ translateY: langY.value }],
  }));

  const langDimStyle = useAnimatedStyle(() => ({
    opacity: langDim.value,
  }));

  function pickLang(id: string) {
    void setLocale(id);
    dismissLangs();
  }

  function skipToAuthPage() {
    const n = PAGES.length - 1;
    scroller.current?.scrollTo({ x: n * SCREEN_W, animated: true });
    setPage(n);
  }

  function next() {
    if (page >= PAGES.length - 1) {
      setAuthOpen(true);
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

  const copy = page === 1
    ? { kicker: C.tryOnKicker, title: C.tryOnTitle, lede: C.tryOnLede, cta: C.next }
    : page === 2
      ? { kicker: C.styleKicker, title: C.styleTitle, lede: C.styleLede, cta: C.next }
      : null;
  const filteredLangs = LANGS.filter((l) =>
    l.label.toLowerCase().includes(langQuery.trim().toLowerCase()),
  );

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        contentOffset={{ x: startPage * SCREEN_W, y: 0 }}
        style={StyleSheet.absoluteFill}
      >
        {PAGES.map((p, i) => (
          <View key={i} style={{ width: SCREEN_W, height: "100%" }}>
            {p.kind === "welcome" ? (
              <FirstLaunchWelcome active={page === i} onContinue={next} />
            ) : p.kind === "market" ? (
              <Catalog
                onSignUp={() => setAuthOpen(true)}
                onLogIn={() => setAuthOpen(true)}
                onLegal={setLegalId}
                insets={insets}
                copy={{ marketTitle: C.marketTitle, signUp: C.signUp, logIn: C.logIn, continueAgreement: C.continueAgreement, termsAndConditions: C.termsAndConditions, andWord: C.andWord, privacyPolicy: C.privacyPolicy }}
                rtl={rtl}
              />
            ) : (
              <Film source={p.source} active={page === i} />
            )}
          </View>
        ))}
      </ScrollView>

      {!authOpen ? (
        <>
          {PAGES[page].kind !== "welcome" ? (
            <Pressable
              onPress={() => {
                openLangs();
              }}
              style={[styles.langBtn, { top: insets.top + 6 }]}
              hitSlop={10}
            >
              <View style={styles.globe}>
                <View style={styles.globeMeridian} />
                <View style={styles.globeEquator} />
              </View>
              <Text style={styles.langLabel} numberOfLines={1}>
                {langLabel(locale || "en-US")}
              </Text>
              <Text style={styles.langChev}>▾</Text>
            </Pressable>
          ) : null}
          {PAGES[page].kind === "film" ? (
            <Pressable onPress={skipToAuthPage} style={[styles.skip, { top: insets.top + 8 }]} hitSlop={16}>
              <Text style={styles.skipText}>{C.skip}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {PAGES[page].kind === "film" && copy ? (
        <View style={[styles.copy, { paddingBottom: Math.max(insets.bottom, 12) + 14 }]}>
          <View style={styles.dots}>
            {PAGES.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
            ))}
          </View>
          <Text style={[styles.kicker, rtl && styles.rtl]}>{copy.kicker}</Text>
          <Text style={[styles.title, rtl && styles.rtl]}>{copy.title}</Text>
          <Text style={[styles.lede, rtl && styles.rtl]}>{copy.lede}</Text>
          <Pressable onPress={next} style={styles.cta}>
            <Text style={styles.ctaText}>{copy.cta}</Text>
          </Pressable>
        </View>
      ) : null}

      {authOpen ? <AuthScreen onClose={closeAuth} /> : null}

      {langsOpen ? (
        <View style={styles.langOverlay} pointerEvents="box-none">
          <Animated.View pointerEvents="none" style={[styles.langDim, langDimStyle]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={dismissLangs} />
          <Animated.View
            style={[
              styles.langSheet,
              langSlide,
              { paddingBottom: Math.max(insets.bottom, 12) + 8 },
            ]}
          >
            <GestureDetector gesture={langPan}>
              <View>
                <View style={styles.langHandle} />
                <Text style={styles.langSheetTitle}>{C.language}</Text>
                <TextInput
                  value={langQuery}
                  onChangeText={setLangQuery}
                  placeholder={C.search}
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  autoCorrect={false}
                  autoCapitalize="none"
                  style={styles.langSearch}
                />
              </View>
            </GestureDetector>
            <FlatList
              data={filteredLangs}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: SCREEN_H * 0.58 }}
              renderItem={({ item }) => {
                const on = item.id === (locale || "en-US");
                return (
                  <Pressable onPress={() => pickLang(item.id)} style={styles.langRow}>
                    <Text style={[styles.langRowText, on && styles.langRowOn]}>{item.label}</Text>
                    {on ? <Text style={styles.langTick}>✓</Text> : null}
                  </Pressable>
                );
              }}
            />
          </Animated.View>
        </View>
      ) : null}
      {legalId ? <LegalPopup id={legalId} insets={insets} onClose={() => setLegalId(null)} /> : null}
    </View>
  );
}

function LegalPopup({
  id,
  insets,
  onClose,
}: {
  id: "terms" | "privacy";
  insets: { top: number; bottom: number };
  onClose: () => void;
}) {
  const doc = DOCS[id];
  const sheetY = useSharedValue(0);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
  const drag = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-40, 40])
    .onUpdate((event) => {
      sheetY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 110 || event.velocityY > 800) {
        sheetY.value = withTiming(SCREEN_H, { duration: 260, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        sheetY.value = withSpring(0, { damping: 28, stiffness: 240, overshootClamping: true });
      }
    });
  return (
    <View style={styles.legalOverlay} accessibilityViewIsModal>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close legal document"
      />
      <Animated.View style={[styles.legalSheet, sheetStyle, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <GestureDetector gesture={drag}>
          <View style={styles.legalHeader}>
            <View style={styles.legalHandle} />
            <Text style={styles.legalTitle}>{doc.title}</Text>
            <Pressable onPress={onClose} style={styles.legalClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close legal document">
              <Text style={styles.legalCloseText}>✕</Text>
            </Pressable>
          </View>
        </GestureDetector>
        <ScrollView contentContainerStyle={styles.legalContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.legalMeta}>Last updated {doc.updated}</Text>
          {doc.sections.map((section) => (
            <View key={section.heading} style={styles.legalBlock}>
              <Text style={styles.legalHeading}>{section.heading}</Text>
              {section.body.map((paragraph) => (
                <Text key={paragraph} style={styles.legalParagraph}>{paragraph}</Text>
              ))}
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#12140A" },
  market: { flex: 1, backgroundColor: "#12140A" },
  grid: { overflow: "hidden" },
  marketCopy: { flex: 1, paddingHorizontal: 22, paddingTop: 22 },
  skip: { position: "absolute", right: 18, zIndex: 8 },
  skipText: { color: "rgba(255,255,255,0.82)", fontSize: 13, letterSpacing: 0.6 },
  langBtn: {
    position: "absolute",
    left: 16,
    zIndex: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 210,
    paddingVertical: 4,
  },
  globe: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.4,
    borderColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  globeMeridian: {
    position: "absolute",
    width: 7,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.92)",
  },
  globeEquator: {
    position: "absolute",
    width: 16,
    height: 0,
    borderTopWidth: 1.2,
    borderColor: "rgba(255,255,255,0.92)",
  },
  langLabel: { color: "#fff", fontSize: 14, fontWeight: "500" },
  langChev: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 1 },
  langOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    zIndex: 50,
  },
  langDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(18, 20, 10, 0.72)",
  },
  langSheet: {
    backgroundColor: "#16180F",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 8,
    maxHeight: SCREEN_H * 0.78,
  },
  legalOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    backgroundColor: "rgba(18, 20, 10, 0.72)",
    zIndex: 60,
  },
  legalSheet: {
    backgroundColor: "#16180F",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    maxHeight: SCREEN_H * 0.82,
  },
  legalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4 },
  legalHandle: { position: "absolute", top: 0, left: "50%", marginLeft: -20, width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.28)" },
  legalTitle: { color: "#fff", fontSize: 20, fontWeight: "700", flex: 1, paddingRight: 12 },
  legalClose: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  legalCloseText: { color: "rgba(255,255,255,0.9)", fontSize: 18 },
  legalContent: { paddingHorizontal: 20, paddingBottom: 8 },
  legalMeta: { color: "rgba(255,255,255,0.56)", fontSize: 12, marginBottom: 20 },
  legalBlock: { marginBottom: 20 },
  legalHeading: { color: "#fff", fontSize: 17, fontWeight: "600", marginBottom: 8 },
  legalParagraph: { color: "rgba(255,255,255,0.76)", fontSize: 15, lineHeight: 22, marginBottom: 8 },
  langHandle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.28)",
    marginBottom: 10,
    marginTop: 4,
  },
  langSheetTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  langSearch: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    color: "#fff",
    paddingHorizontal: 14,
    marginHorizontal: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  langRow: {
    height: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  langRowText: { color: "rgba(255,255,255,0.88)", fontSize: 16 },
  langRowOn: { color: "#fff", fontWeight: "700" },
  langTick: { color: "#C5D4A0", fontSize: 16, fontWeight: "700" },
  rtl: { writingDirection: "rtl", textAlign: "right", alignSelf: "stretch" },
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
  ctaLogin: {
    height: 50,
    borderRadius: 999,
    marginTop: 10,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaLoginText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  legalCopy: { color: "rgba(255,255,255,0.58)", fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 12, paddingHorizontal: 8 },
  legalLink: { color: "#C5D4A0", textDecorationLine: "underline" },
});
