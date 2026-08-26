import { Image } from "expo-image";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Dimensions,
  FlatList,
  Image as MosaicImg,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
import { pullOta } from "../lib/ota";
import { useUvel } from "../lib/store";
import {
  isAlreadyAccount,
  resetPassword,
  signInApple,
  signInEmail,
  signInGoogle,
  signUpEmail,
  type Session,
} from "../lib/auth";
import { LANGS, isRtl, langLabel, t } from "../lib/i18n";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const PAGES = [
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
  copy: { marketTitle: string; signUp: string; logIn: string };
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
            <View key={i} style={[styles.dot, i === 2 && styles.dotOn]} />
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
          By continuing you agree to our{" "}
          <Text style={styles.legalLink} onPress={() => onLegal("terms")}>
            Terms and Conditions
          </Text>{" "}and{" "}
          <Text style={styles.legalLink} onPress={() => onLegal("privacy")}>
            Privacy Policy
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

function AuthBtn({
  icon,
  label,
  filled,
  onPress,
  mark,
  busy,
  disabled,
}: {
  icon: number;
  label: string;
  filled?: boolean;
  onPress: () => void;
  mark?: boolean;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={[styles.authBtn, filled ? styles.authFilled : styles.authOutline]}
    >
      {busy ? (
        <ActivityIndicator color={filled ? "#111" : "#fff"} />
      ) : (
        <>
          <View style={styles.authIconWrap}>
            <Image
              source={icon}
              style={mark ? styles.authMark : styles.authIcon}
              contentFit="contain"
            />
          </View>
          <Text style={[styles.authLabel, filled ? styles.authLabelDark : styles.authLabelLight]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export default function Onboard() {
  const { completeOnboard, acceptSession, locale, setLocale, onboardVersion } = useUvel();
  const insets = useSafeAreaInsets();
  const C = t(locale || "en-US");
  const rtl = isRtl(locale || "en-US");
  const [langsOpen, setLangsOpen] = useState(false);
  const [langQuery, setLangQuery] = useState("");
  const langY = useSharedValue(SCREEN_H);
  const langDim = useSharedValue(0);
  const startPage = (onboardVersion ?? 0) >= 4 ? PAGES.length - 1 : 0;
  const [page, setPage] = useState(startPage);
  const [auth, setAuth] = useState<null | "signup" | "login">(null);
  const [pane, setPane] = useState<"providers" | "email">("providers");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [note, setNote] = useState("");
  const scroller = useRef<ScrollView>(null);
  const sheetY = useSharedValue(SCREEN_H);
  const dim = useSharedValue(0);
  const emailX = useSharedValue(SCREEN_W);
  const [emailOn, setEmailOn] = useState(false);

  useEffect(() => {
    if (startPage <= 0) return;
    const t = setTimeout(() => {
      scroller.current?.scrollTo({ x: startPage * SCREEN_W, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [startPage]);

  function closeAuth() {
    setAuth(null);
    setPane("providers");
    setBusy(null);
    setError("");
    setNote("");
    setEmail("");
    setPassword("");
    setName("");
    setAgreed(false);
    setShowPass(false);
    setEmailOn(false);
    emailX.value = SCREEN_W;
  }

  useEffect(() => {
    if (!auth) return;
    sheetY.value = SCREEN_H;
    dim.value = 0;
    sheetY.value = withTiming(0, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
    });
    dim.value = withTiming(1, { duration: 280 });
  }, [!!auth, dim, sheetY]);

  const dismissSheet = () => {
    dim.value = withTiming(0, { duration: 240 });
    sheetY.value = withTiming(
      SCREEN_H,
      { duration: 300, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(closeAuth)();
      },
    );
  };

  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetX([-40, 40])
    .onUpdate((e) => {
      const y = Math.max(0, e.translationY);
      sheetY.value = y;
      dim.value = Math.max(0, 1 - y / (SCREEN_H * 0.42));
    })
    .onEnd((e) => {
      if (e.translationY > 100 || e.velocityY > 800) {
        dim.value = withTiming(0, { duration: 240 });
        sheetY.value = withTiming(
          SCREEN_H,
          { duration: 300, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(closeAuth)();
          },
        );
      } else {
        sheetY.value = withSpring(0, {
          damping: 28,
          stiffness: 240,
          overshootClamping: true,
        });
        dim.value = withTiming(1, { duration: 180 });
      }
    });

  const sheetSlide = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  const dimStyle = useAnimatedStyle(() => ({
    opacity: dim.value,
  }));

  function hideEmail() {
    setPane("providers");
    setEmailOn(false);
    setError("");
    setNote("");
  }

  function openEmail() {
    Keyboard.dismiss();
    setError("");
    setNote("");
    setPane("email");
    emailX.value = SCREEN_W;
    setEmailOn(true);
  }

  useEffect(() => {
    if (!emailOn) return;
    emailX.value = SCREEN_W;
    emailX.value = withTiming(0, {
      duration: 420,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [emailOn, emailX]);

  function backFromEmail() {
    Keyboard.dismiss();
    emailX.value = withTiming(
      SCREEN_W,
      { duration: 360, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(hideEmail)();
      },
    );
  }

  const emailSlide = useAnimatedStyle(() => ({
    transform: [{ translateX: emailX.value }],
  }));

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

  function finish(provider?: string) {
    closeAuth();
    void completeOnboard(provider);
  }

  function afterSignIn(session: Session) {
    closeAuth();
    void acceptSession(session);
  }

  async function run(kind: string, fn: () => Promise<Session>) {
    setError("");
    setNote("");
    setBusy(kind);
    const watchdog = setTimeout(() => {
      setBusy(null);
      setError("That took too long. Try again.");
    }, 40000);
    try {
      const session = await fn();
      clearTimeout(watchdog);
      if (emailOn) {
        afterSignIn(session);
        return;
      }
      dim.value = withTiming(0, { duration: 200 });
      sheetY.value = withTiming(
        SCREEN_H,
        { duration: 280, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(afterSignIn)(session);
        },
      );
    } catch (err) {
      clearTimeout(watchdog);
      setBusy(null);
      if (auth === "signup" && isAlreadyAccount(err)) {
        setAuth("login");
        setError("You already have an account. Log in instead.");
        return;
      }
      setError(err instanceof Error ? err.message : "Couldn’t sign in.");
    }
  }

  function next() {
    if (page >= PAGES.length - 1) {
      setAuth("signup");
      setPane("providers");
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

  const isLogin = auth === "login";
  const copy = [
    { kicker: C.tryOnKicker, title: C.tryOnTitle, lede: C.tryOnLede, cta: C.next },
    { kicker: C.styleKicker, title: C.styleTitle, lede: C.styleLede, cta: C.next },
    { kicker: "", title: C.marketTitle, lede: "", cta: C.signUp },
  ][page];
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
            {p.kind === "market" ? (
              <Catalog
                onSignUp={() => {
                  setAuth("signup");
                  setPane("providers");
                  setError("");
                }}
                onLogIn={() => {
                  setAuth("login");
                  setPane("providers");
                  setError("");
                }}
                onLegal={(id) => router.push({ pathname: "/legal/[id]", params: { id } })}
                insets={insets}
                copy={{ marketTitle: C.marketTitle, signUp: C.signUp, logIn: C.logIn }}
                rtl={rtl}
              />
            ) : (
              <Film source={p.source} active={page === i} />
            )}
          </View>
        ))}
      </ScrollView>

      {auth === null || !emailOn ? (
        <>
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
          {PAGES[page].kind !== "market" ? (
            <Pressable onPress={() => finish()} style={[styles.skip, { top: insets.top + 8 }]} hitSlop={16}>
              <Text style={styles.skipText}>{C.skip}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {PAGES[page].kind !== "market" ? (
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

      {auth !== null ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <Animated.View pointerEvents="none" style={[styles.dimFill, dimStyle]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={dismissSheet} />
          <GestureDetector gesture={pan}>
            <Animated.View
              style={[
                styles.sheet,
                sheetSlide,
                {
                  minHeight: gridMetrics(insets.top).sheetMin,
                  paddingBottom: Math.max(insets.bottom, 18) + 8,
                },
              ]}
            >
              <Pressable onPress={dismissSheet} style={styles.close} hitSlop={16}>
                <Text style={styles.closeX}>✕</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>{isLogin ? C.logInTo : C.signUpFor}</Text>
              {isLogin ? (
                <View style={{ height: 22 }} />
              ) : (
                <Text style={styles.sheetLede}>{C.appleHint}</Text>
              )}
              <AuthBtn
                icon={require("../assets/auth/apple.png")}
                label={C.continueApple}
                filled
                busy={busy === "apple"}
                disabled={busy !== null}
                onPress={() => void run("apple", () => signInApple(auth === "login" ? "login" : "signup"))}
              />
              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or</Text>
                <View style={styles.orLine} />
              </View>
              <AuthBtn
                icon={require("../assets/auth/google.png")}
                label={C.continueGoogle}
                busy={busy === "google"}
                disabled={busy !== null}
                onPress={() => void run("google", () => signInGoogle(auth === "login" ? "login" : "signup"))}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                onPress={openEmail}
                style={styles.email}
              >
                <Text style={styles.emailText}>{C.continueEmail}</Text>
              </Pressable>
            </Animated.View>
          </GestureDetector>
        </View>
      ) : null}

      {emailOn ? (
        <Animated.View style={[styles.emailScreen, emailSlide]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.emailHead, { paddingTop: insets.top + 6 }]}>
            <Pressable
              onPress={backFromEmail}
              style={styles.emailBack}
              hitSlop={16}
            >
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <Text style={styles.emailHeadTitle}>{C.continue}</Text>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: Math.max(insets.bottom, 16) + 24,
            }}
          >
            {!isLogin ? (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={C.fullName}
                placeholderTextColor="rgba(255,255,255,0.38)"
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="name"
                style={styles.field}
              />
            ) : null}
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={C.email}
              placeholderTextColor="rgba(255,255,255,0.38)"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              style={styles.field}
            />
            <View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={C.password}
                placeholderTextColor="rgba(255,255,255,0.38)"
                secureTextEntry={!showPass}
                textContentType={isLogin ? "password" : "newPassword"}
                style={[styles.field, { paddingRight: 72 }]}
              />
              <Pressable onPress={() => setShowPass((v) => !v)} style={styles.eye} hitSlop={8}>
                <Text style={styles.eyeText}>{showPass ? C.hide : C.show}</Text>
              </Pressable>
            </View>
            {error ? <Text style={[styles.error, { textAlign: "left" }]}>{error}</Text> : null}
            {note ? <Text style={[styles.note, { textAlign: "left" }]}>{note}</Text> : null}
            {!isLogin ? (
              <Pressable onPress={() => setAgreed((v) => !v)} style={styles.agreeRow}>
                <View style={[styles.box, agreed && styles.boxOn]}>
                  {agreed ? <Text style={styles.tick}>✓</Text> : null}
                </View>
                <Text style={styles.agreeText}>
                  {C.agree}{" "}
                  <Text
                    style={styles.agreeLink}
                    onPress={() => void Linking.openURL("https://allentackie-ops.github.io/uvel/")}
                  >
                    {C.privacy}
                  </Text>
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                if (!isLogin && !agreed) {
                  setError(C.tickAgree);
                  return;
                }
                if (!isLogin && !name.trim()) {
                  setError(C.addName);
                  return;
                }
                void run("email", () =>
                  isLogin ? signInEmail(email, password) : signUpEmail(email, password, name),
                );
              }}
              style={[styles.authBtn, styles.authFilled, { marginTop: 10 }]}
              disabled={busy !== null}
            >
              {busy === "email" ? (
                <ActivityIndicator color="#111" />
              ) : (
                <Text style={[styles.authLabel, styles.authLabelDark]}>
                  {isLogin ? C.logIn : C.continue}
                </Text>
              )}
            </Pressable>
            {isLogin ? (
              <Pressable
                onPress={async () => {
                  setError("");
                  setNote("");
                  setBusy("reset");
                  try {
                    await resetPassword(email);
                    setNote("Check your email for a reset link.");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Couldn’t send it.");
                  } finally {
                    setBusy(null);
                  }
                }}
                style={styles.email}
              >
                <Text style={styles.emailText}>{C.forgot}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
        </Animated.View>
      ) : null}

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
  email: { height: 44, alignItems: "center", justifyContent: "center", marginTop: 6 },
  emailText: { color: "#C5D4A0", fontSize: 16, fontWeight: "600" },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    zIndex: 10,
  },
  dimFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  sheet: {
    backgroundColor: "#16180F",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  close: { position: "absolute", right: 18, top: 16, zIndex: 2 },
  closeX: { color: "rgba(255,255,255,0.88)", fontSize: 18, fontWeight: "400" },
  sheetTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  sheetLede: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 15,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 22,
  },
  authBtn: {
    height: 52,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 12,
  },
  authFilled: { backgroundColor: "#fff" },
  authOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
  },
  authIconWrap: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  authIcon: { width: 22, height: 22 },
  authMark: { width: 24, height: 24, borderRadius: 12 },
  authLabel: { fontSize: 16, fontWeight: "600" },
  authLabelDark: { color: "#111" },
  authLabelLight: { color: "#fff" },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    marginTop: 2,
  },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.22)" },
  orText: { color: "rgba(255,255,255,0.45)", fontSize: 13 },
  field: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    color: "#fff",
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
  },
  error: {
    color: "#E8B4B4",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
    marginTop: 2,
  },
  note: {
    color: "#C5D4A0",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
  },
  back: { position: "absolute", left: 16, top: 14, zIndex: 2, padding: 4 },
  backText: { color: "rgba(255,255,255,0.88)", fontSize: 28, lineHeight: 30, fontWeight: "300" },
  emailScreen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#12140A",
    zIndex: 30,
  },
  emailHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 18,
  },
  emailBack: { width: 36, alignItems: "center" },
  emailHeadTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  eye: {
    position: "absolute",
    right: 14,
    top: 0,
    height: 52,
    justifyContent: "center",
  },
  eyeText: { color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: "600" },
  agreeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 8,
    marginBottom: 18,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  boxOn: {
    backgroundColor: "#C5D4A0",
    borderColor: "#C5D4A0",
  },
  tick: { color: "#12140A", fontSize: 13, fontWeight: "700" },
  agreeText: {
    flex: 1,
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    lineHeight: 19,
  },
  agreeLink: { color: "#C5D4A0", textDecorationLine: "underline" },
});
