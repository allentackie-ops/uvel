import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Dimensions,
  Image as MosaicImg,
  KeyboardAvoidingView,
  Modal,
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
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { pullOta } from "../lib/ota";
import { useUvel } from "../lib/store";
import {
  resetPassword,
  signInApple,
  signInEmail,
  signInFacebook,
  signInGoogle,
  signUpEmail,
  type Session,
} from "../lib/auth";

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
    cta: "Sign up",
  },
];

const ROW_A = [
  require("../assets/onboarding/market/p01.jpg"),
  require("../assets/onboarding/market/p06.jpg"),
  require("../assets/onboarding/market/p14.jpg"),
  require("../assets/onboarding/market/p07.jpg"),
  require("../assets/onboarding/market/p02.jpg"),
  require("../assets/onboarding/market/p12.jpg"),
  require("../assets/onboarding/market/p16.jpg"),
  require("../assets/onboarding/market/p09.jpg"),
  require("../assets/onboarding/market/p18.jpg"),
  require("../assets/onboarding/market/p15.jpg"),
  require("../assets/onboarding/market/p08.jpg"),
  require("../assets/onboarding/market/p20.jpg"),
];
const ROW_B = [
  require("../assets/onboarding/market/p03.jpg"),
  require("../assets/onboarding/market/p11.jpg"),
  require("../assets/onboarding/market/p22.jpg"),
  require("../assets/onboarding/market/p04.jpg"),
  require("../assets/onboarding/market/p13.jpg"),
  require("../assets/onboarding/market/p17.jpg"),
  require("../assets/onboarding/market/p10.jpg"),
  require("../assets/onboarding/market/p19.jpg"),
  require("../assets/onboarding/market/p05.jpg"),
  require("../assets/onboarding/market/p21.jpg"),
  require("../assets/onboarding/market/p23.jpg"),
  require("../assets/onboarding/market/p24.jpg"),
];
const WIDTHS = [148, 176, 156, 188, 142, 170];

function gridMetrics(topInset: number) {
  const gridH = Math.min(SCREEN_H * 0.5, 430);
  const gridTop = topInset + 36;
  return { gridH, gridTop, sheetMin: SCREEN_H - gridTop - gridH };
}

function DriftRow({
  images,
  height,
  duration,
  reverse,
}: {
  images: number[];
  height: number;
  duration: number;
  reverse?: boolean;
}) {
  const x = useSharedValue(0);
  const span = useSharedValue(0);
  const dir = reverse ? 1 : -1;

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

  function tiles(prefix: string) {
    return images.map((src, i) => (
      <MosaicImg
        key={`${prefix}${i}`}
        source={src}
        style={{
          width: WIDTHS[i % WIDTHS.length],
          height,
          borderRadius: 18,
          marginRight: 10,
        }}
        resizeMode="cover"
      />
    ));
  }

  return (
    <Animated.View style={[{ flexDirection: "row" }, style]}>
      <View
        style={{ flexDirection: "row" }}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w <= 1) return;
          span.value = w;
          if (reverse && x.value === 0) x.value = -w;
        }}
      >
        {tiles("a")}
      </View>
      <View style={{ flexDirection: "row" }}>{tiles("b")}</View>
    </Animated.View>
  );
}

function Catalog({
  onSignUp,
  onLogIn,
  insets,
  covered,
}: {
  onSignUp: () => void;
  onLogIn: () => void;
  insets: { top: number; bottom: number };
  covered: boolean;
}) {
  const { gridH, gridTop } = gridMetrics(insets.top);
  const tileH = (gridH - 10) / 2;

  useEffect(() => {
    void pullOta();
  }, []);

  return (
    <View style={styles.market}>
      <View style={[styles.grid, { marginTop: gridTop, height: gridH }]}>
        <DriftRow images={ROW_A} height={tileH} duration={40000} />
        <View style={{ height: 10 }} />
        <DriftRow images={ROW_B} height={tileH} duration={46000} reverse />
      </View>
      {covered ? null : (
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
          <Pressable onPress={onSignUp} style={styles.cta}>
            <Text style={styles.ctaText}>Sign up</Text>
          </Pressable>
          <Pressable onPress={onLogIn} style={styles.ctaLogin}>
            <Text style={styles.ctaLoginText}>Log in</Text>
          </Pressable>
        </View>
      )}
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
  const { completeOnboard, acceptSession } = useUvel();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const [auth, setAuth] = useState<null | "signup" | "login">(null);
  const [pane, setPane] = useState<"providers" | "email">("providers");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const scroller = useRef<ScrollView>(null);

  function closeAuth() {
    setAuth(null);
    setPane("providers");
    setBusy(null);
    setError("");
    setNote("");
    setEmail("");
    setPassword("");
  }

  function finish(provider?: string) {
    closeAuth();
    void completeOnboard(provider);
  }

  async function run(kind: string, fn: () => Promise<Session>) {
    setError("");
    setNote("");
    setBusy(kind);
    try {
      const session = await fn();
      closeAuth();
      void acceptSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t sign in.");
    } finally {
      setBusy(null);
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

  const copy = PAGES[page];
  const isLogin = auth === "login";

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
                insets={insets}
                covered={auth !== null}
              />
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

      <Modal
        visible={auth !== null}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeAuth}
      >
        <Pressable style={styles.sheetDim} onPress={closeAuth}>
          <Pressable
            style={[
              styles.sheet,
              {
                minHeight: gridMetrics(insets.top).sheetMin,
                paddingBottom: Math.max(insets.bottom, 18) + 8,
              },
            ]}
            onPress={() => undefined}
          >
            <Pressable onPress={closeAuth} style={styles.close} hitSlop={16}>
              <Text style={styles.closeX}>✕</Text>
            </Pressable>
            {pane === "email" ? (
              <Pressable
                onPress={() => {
                  setPane("providers");
                  setError("");
                  setNote("");
                }}
                style={styles.back}
                hitSlop={16}
              >
                <Text style={styles.backText}>‹</Text>
              </Pressable>
            ) : null}
            <Text style={styles.sheetTitle}>{isLogin ? "Log in to Uvel" : "Sign up for Uvel"}</Text>
            {pane === "email" ? (
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                {isLogin ? (
                  <View style={{ height: 18 }} />
                ) : (
                  <Text style={styles.sheetLede}>Use the email you actually check.</Text>
                )}
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  style={styles.field}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  secureTextEntry
                  textContentType={isLogin ? "password" : "newPassword"}
                  style={styles.field}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                {note ? <Text style={styles.note}>{note}</Text> : null}
                <Pressable
                  onPress={() =>
                    void run("email", () =>
                      isLogin ? signInEmail(email, password) : signUpEmail(email, password),
                    )
                  }
                  style={[styles.authBtn, styles.authFilled, { marginTop: 4 }]}
                  disabled={busy !== null}
                >
                  {busy === "email" ? (
                    <ActivityIndicator color="#111" />
                  ) : (
                    <Text style={[styles.authLabel, styles.authLabelDark]}>
                      {isLogin ? "Log in" : "Create account"}
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
                    <Text style={styles.emailText}>Forgot password</Text>
                  </Pressable>
                ) : null}
              </KeyboardAvoidingView>
            ) : (
              <>
                {isLogin ? (
                  <View style={{ height: 22 }} />
                ) : (
                  <Text style={styles.sheetLede}>It's quickest to use your Apple ID.</Text>
                )}
                <AuthBtn
                  icon={require("../assets/auth/apple.png")}
                  label="Continue with Apple"
                  filled
                  busy={busy === "apple"}
                  disabled={busy !== null}
                  onPress={() => void run("apple", signInApple)}
                />
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or</Text>
                  <View style={styles.orLine} />
                </View>
                <AuthBtn
                  icon={require("../assets/auth/google.png")}
                  label="Continue with Google"
                  busy={busy === "google"}
                  disabled={busy !== null}
                  onPress={() => void run("google", signInGoogle)}
                />
                <AuthBtn
                  icon={require("../assets/auth/facebook-vinted.png")}
                  label="Continue with Facebook"
                  mark
                  busy={busy === "facebook"}
                  disabled={busy !== null}
                  onPress={() => void run("facebook", signInFacebook)}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable
                  onPress={() => {
                    setPane("email");
                    setError("");
                    setNote("");
                  }}
                  style={styles.email}
                >
                  <Text style={styles.emailText}>Continue with email</Text>
                </Pressable>
              </>
            )}
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
  email: { height: 44, alignItems: "center", justifyContent: "center", marginTop: 6 },
  emailText: { color: "#C5D4A0", fontSize: 16, fontWeight: "600" },
  sheetDim: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
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
});
