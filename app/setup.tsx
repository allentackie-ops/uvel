import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usd } from "../lib/catalog";
import { genderBoost } from "../lib/lookMatch";
import { ARCH, PALS, SILS } from "../lib/styleDna";
import { useUvel } from "../lib/store";
import { dressPerson } from "../lib/tryon";
import { pickFromLibrary, takePhoto } from "../lib/photo";
import { shopFloor, useWardrobe, type ClosetPiece } from "../lib/wardrobe";
import { claimUsername } from "../lib/auth";
import { isValidUsername, normalizeUsername } from "../lib/username";

const BG = "#FFFFFF";
const INK = "#16140F";
const MUTED = "rgba(22,20,15,0.5)";
const LINE = "rgba(22,20,15,0.12)";
const OLIVE = "#5E7018";
const LIME = "#D6E27A";
const WASH = "rgba(214,226,122,0.28)";
const SOFT = "#F5F3EC";
const STEPS = 6;
const MIN_AGE = 18;

function Name({ children }: { children: string }) {
  return <Text style={styles.name}>{children}</Text>;
}

function parseDob(mm: string, dd: string, yyyy: string) {
  const m = Number(mm);
  const d = Number(dd);
  const y = Number(yyyy);
  if (!m || !d || yyyy.length !== 4 || y < 1920) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function ageOf(dt: Date) {
  const now = new Date();
  let a = now.getFullYear() - dt.getFullYear();
  const md = now.getMonth() - dt.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < dt.getDate())) a -= 1;
  return a;
}

export default function ProfileSetup() {
  const insets = useSafeAreaInsets();
  const app = useUvel();
  useWardrobe();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(app.displayName);
  const [mm, setMm] = useState("");
  const [dd, setDd] = useState("");
  const [yyyy, setYyyy] = useState("");
  const [err, setErr] = useState("");
  const [gender, setGender] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [worn, setWorn] = useState<string | null>(null);
  const [look, setLook] = useState<ClosetPiece | null>(null);
  const [asking, setAsking] = useState(false);
  const [username, setUsername] = useState("");
  const [wantsUpdates, setWantsUpdates] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [arch, setArch] = useState("");
  const [pal, setPal] = useState("");
  const [sil, setSil] = useState("");
  const mmRef = useRef<TextInput>(null);
  const ddRef = useRef<TextInput>(null);
  const yyRef = useRef<TextInput>(null);

  const first = (name.trim().split(" ")[0] || "").trim();
  const liveLooks = shopFloor(app.country)
    .map((p) => ({ p, s: genderBoost(p, gender) }))
    .sort((a, b) => b.s - a.s || b.p.createdAt - a.p.createdAt)
    .map((row) => row.p)
    .slice(0, 10);

  function go(n: number) {
    setErr("");
    setStep(n);
  }

  function nextFromDob() {
    if (!name.trim()) {
      setErr("Add your name.");
      return;
    }
    const dt = parseDob(mm, dd, yyyy);
    if (!dt) {
      setErr("That date doesn’t look right.");
      return;
    }
    if (ageOf(dt) < MIN_AGE) {
      setErr(`Below age requirement. ${MIN_AGE}.`);
      return;
    }
    go(1);
  }

  async function pickPhoto(camera: boolean) {
    setErr("");
    try {
      const uri = camera ? await takePhoto(true) : await pickFromLibrary();
      if (!uri) return;
      setPhoto(uri);
      app.setPerson(uri);
      setWorn(null);
      setRendered(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t open that.");
    }
  }

  async function renderLook() {
    if (!photo || !look) return;
    setErr("");
    setRendering(true);
    try {
      const dressed = await dressPerson({
        personUri: photo,
        garment: { uri: look.photo },
        garmentName: look.name,
        category: look.category,
      });
      setWorn(dressed);
      setRendered(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t dress you in that.");
    } finally {
      setRendering(false);
    }
  }

  async function keepPosted() {
    setWantsUpdates(true);
    go(5);
    try {
      if (app.uid) {
        const { enablePush } = await import("../lib/push");
        await enablePush(app.uid);
      } else {
        const Notifications = await import("expo-notifications");
        await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
      }
    } catch {
      /* current TestFlight may not have the native module yet */
    }
  }
    if (asking) return;
    const normalized = normalizeUsername(username);
    if (!isValidUsername(normalized)) {
      setErr("Use 3–20 lowercase letters, numbers, or underscores.");
      return;
    }
    setAsking(true);
    try {
      await claimUsername(normalized);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That username is not available.");
      setAsking(false);
      return;
    }
    if (wantsUpdates) {
      try {
        const Notifications = await import("expo-notifications");
        await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
      } catch {
        /* current TestFlight may not have the native module yet */
      }
    }
    const dt = parseDob(mm, dd, yyyy);
    const iso = dt ? dt.toISOString().slice(0, 10) : "";
    await app.completeProfile({
      displayName: name.trim(),
      birthday: iso,
      gender,
      personUri: photo,
      styles: [],
      wardrobeUris: [],
      wantsUpdates,
      username: normalized,
      archetype: arch,
      palette: pal,
      silhouette: sil,
    });
    setAsking(false);
  }

  const bar = useMemo(
    () => (
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${((step + 1) / STEPS) * 100}%` }]} />
      </View>
    ),
    [step],
  );

  return (
    <Animated.View entering={FadeIn.duration(380)} style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <StatusBar style="dark" />
      <View style={styles.head}>
        {step > 0 ? (
          <Pressable onPress={() => go(step - 1)} hitSlop={16} style={styles.back}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        {bar}
        <View style={styles.back} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1, overflow: "hidden" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.View
          key={step}
          entering={FadeIn.duration(240)}
          style={{ flex: 1 }}
        >
          {step === 0 ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}
            >
              <Text style={styles.h}>
                {first ? (
                  <>
                    Hey <Name>{first}</Name>.
                  </>
                ) : (
                  "Hey."
                )}
                {"\n"}What’s your date of birth?
              </Text>
              <Text style={styles.lede}>
                We use this to keep Uvel a safe space. It never shows on your profile.
              </Text>
              {!app.displayName ? (
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={MUTED}
                  autoCapitalize="words"
                  textContentType="name"
                  style={styles.field}
                />
              ) : null}
              <View style={styles.dobRow}>
                <TextInput
                  ref={mmRef}
                  value={mm}
                  onChangeText={(v) => {
                    const t = v.replace(/\D/g, "").slice(0, 2);
                    setErr("");
                    setMm(t);
                    if (t.length === 2) ddRef.current?.focus();
                  }}
                  placeholder="MM"
                  placeholderTextColor={MUTED}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[styles.dob, mm.length === 2 && styles.dobOn]}
                />
                <TextInput
                  ref={ddRef}
                  value={dd}
                  onChangeText={(v) => {
                    const t = v.replace(/\D/g, "").slice(0, 2);
                    setErr("");
                    setDd(t);
                    if (t.length === 2) yyRef.current?.focus();
                  }}
                  placeholder="DD"
                  placeholderTextColor={MUTED}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[styles.dob, dd.length === 2 && styles.dobOn]}
                />
                <TextInput
                  ref={yyRef}
                  value={yyyy}
                  onChangeText={(v) => {
                    setErr("");
                    setYyyy(v.replace(/\D/g, "").slice(0, 4));
                  }}
                  placeholder="YYYY"
                  placeholderTextColor={MUTED}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={[styles.dob, styles.dobY, yyyy.length === 4 && styles.dobOn]}
                />
              </View>
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <Pressable
                onPress={nextFromDob}
                style={[styles.cta, mm && dd && yyyy.length === 4 ? null : styles.ctaOff]}
              >
                <Text style={styles.ctaTxt}>Continue</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          {step === 1 ? (
            <View style={[styles.body, { paddingBottom: insets.bottom + 28 }]}>
              <Text style={styles.h}>How do you identify?</Text>
              <Text style={styles.lede}>
                {first ? (
                  <>
                    This is so we can try clothes on <Name>{first}</Name>. Woman, man, or something else.
                  </>
                ) : (
                  "This helps us try clothes on you. Woman, man, or something else."
                )}
              </Text>
              {(
                [
                  ["woman", "Woman"],
                  ["man", "Man"],
                  ["other", "Something else"],
                ] as const
              ).map(([id, label]) => (
                <Pressable
                  key={id}
                  onPress={() => setGender(id)}
                  style={[styles.choice, gender === id && styles.choiceOn]}
                >
                  <Text style={styles.choiceTxt}>{label}</Text>
                  <View style={[styles.radio, gender === id && styles.radioOn]}>
                    {gender === id ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              ))}
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => gender && go(2)}
                style={[styles.cta, gender ? null : styles.ctaOff]}
              >
                <Text style={styles.ctaTxt}>Continue</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 2 ? (
            <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}>
              <Text style={styles.h}>
                {first ? (
                  <>
                    A mirror pic of <Name>{first}</Name>.
                  </>
                ) : (
                  "A mirror pic of you."
                )}
              </Text>
              <Text style={styles.lede}>
                The whole you, not a crop. We’ll put the clothes on your body so you can see the outfit before you
                buy.
              </Text>
              <View style={[styles.stage, !photo && styles.stageNeed]}>
                {photo ? (
                  <View style={styles.stageFill}>
                    <Image source={{ uri: worn ?? photo }} style={styles.fullPic} contentFit="contain" />
                    {rendering ? (
                      <View style={styles.spin}>
                        <ActivityIndicator color={INK} />
                      </View>
                    ) : (
                      <View style={styles.changeWrap}>
                        <Pressable onPress={() => void pickPhoto(true)} style={styles.change}>
                          <Text style={styles.changeTxt}>Change photo</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.need}>
                    <View style={styles.cameraPlaceholder}>
                      <Ionicons name="camera-outline" size={34} color={OLIVE} />
                    </View>
                    <Text style={styles.needH}>Add your full length photo</Text>
                    <View style={styles.needRow}>
                      <Pressable onPress={() => void pickPhoto(true)} style={styles.needBtn}>
                        <Text style={styles.needBtnTxt}>Add your photo</Text>
                      </Pressable>
                      <Pressable onPress={() => void pickPhoto(false)} style={styles.needBtnGhost} accessibilityRole="button" accessibilityLabel="Choose from library">
                        <Ionicons name="images-outline" size={18} color={INK} />
                        <Text style={styles.needBtnGhostTxt}>Choose from library</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
              {err ? <Text style={styles.err}>{err}</Text> : null}
              {liveLooks.length ? (
                <>
                  <Text style={styles.h2}>From Uvel</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={styles.strip}>
                    {liveLooks.map((p) => {
                      const on = look?.id === p.id;
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => {
                            setLook(p);
                            setRendered(false);
                            setWorn(null);
                          }}
                          style={[styles.uvelCard, on && styles.uvelOn]}
                        >
                          <Image source={{ uri: p.photo }} style={styles.uvelImg} contentFit="cover" />
                          {on ? (
                            <View style={styles.trying}>
                              <Text style={styles.tryingTxt}>Trying</Text>
                            </View>
                          ) : null}
                          <View style={styles.uvelMeta}>
                            <Text style={styles.uvelName} numberOfLines={2}>{p.name}</Text>
                            <Text style={styles.uvelPrice}>{usd(p.listPriceCents, p.currency || "USD")}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              ) : null}
              {photo && look ? (
                <Pressable onPress={() => void renderLook()} style={styles.cta} disabled={rendering}>
                  <Text style={styles.ctaTxt}>{rendering ? "Dressing you…" : "Try this look"}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => go(3)} style={[styles.cta, { marginTop: 18 }]}>
                <Text style={styles.ctaTxt}>{photo ? "Continue" : "Skip for now"}</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          {step === 3 ? (
            <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}>
              <Text style={styles.h}>
                {first ? (
                  <>
                    What feels like <Name>{first}</Name>?
                  </>
                ) : (
                  "What feels like you?"
                )}
              </Text>
              <Text style={styles.lede}>
                Tap the styles you wear. We’ll recommend pieces brands are actually selling.
              </Text>
              <Text style={styles.groupLabel}>Style</Text>
              {ARCH.map((item) => (
                <Pressable key={item} onPress={() => setArch(item)} style={[styles.choice, arch === item && styles.choiceOn]}>
                  <Text style={styles.choiceTxt}>{item}</Text>
                  <View style={[styles.radio, arch === item && styles.radioOn]}>
                    {arch === item ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              ))}
              <Text style={[styles.groupLabel, { marginTop: 18 }]}>Palette</Text>
              {PALS.map((item) => (
                <Pressable key={item} onPress={() => setPal(item)} style={[styles.choice, pal === item && styles.choiceOn]}>
                  <Text style={styles.choiceTxt}>{item}</Text>
                  <View style={[styles.radio, pal === item && styles.radioOn]}>
                    {pal === item ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              ))}
              <Text style={[styles.groupLabel, { marginTop: 18 }]}>Silhouette</Text>
              {SILS.map((item) => (
                <Pressable key={item} onPress={() => setSil(item)} style={[styles.choice, sil === item && styles.choiceOn]}>
                  <Text style={styles.choiceTxt}>{item}</Text>
                  <View style={[styles.radio, sil === item && styles.radioOn]}>
                    {sil === item ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              ))}
              <Pressable
                onPress={() => arch && pal && sil && go(4)}
                style={[styles.cta, arch && pal && sil ? null : styles.ctaOff]}
              >
                <Text style={styles.ctaTxt}>Continue</Text>
              </Pressable>
              <Pressable onPress={() => go(4)} style={styles.skipBtn}>
                <Text style={styles.skipTxt}>Skip</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          {step === 4 ? (
            <View style={[styles.body, { paddingBottom: insets.bottom + 28 }]}>
              <Text style={styles.h}>
                {first ? (
                  <>
                    Stay in the loop, <Name>{first}</Name>
                  </>
                ) : (
                  "Stay in the loop"
                )}
              </Text>
              <Text style={styles.lede}>
                Offers, drops, and fits that actually suit you. You can change this later.
              </Text>
              <View style={styles.bullets}>
                {[
                  "Pieces that match your style",
                  "Price drops and new listings",
                  "Messages about things you like",
                ].map((line) => (
                  <View key={line} style={styles.bulletRow}>
                    <View style={styles.dot} />
                    <Text style={styles.bullet}>{line}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => void keepPosted()}
                disabled={asking}
                style={styles.cta}
              >
                <Text style={styles.ctaTxt}>Keep me posted</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 5 ? (
            <View style={[styles.body, { paddingBottom: insets.bottom + 28 }]}>
              <Text style={styles.h}>Choose your username.</Text>
              <Text style={styles.lede}>This is how friends will find you on Uvel. Your username is required and can’t be changed here.</Text>
              <TextInput
                value={username}
                onChangeText={(value) => setUsername(normalizeUsername(value).slice(0, 20))}
                placeholder="your_username"
                placeholderTextColor={MUTED}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                style={styles.field}
                accessibilityLabel="Username"
              />
              <Text style={styles.usernameHint}>3–20 characters · letters, numbers, and underscores</Text>
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => void finish()} disabled={asking || !username} style={[styles.cta, !username && styles.ctaOff]}>
                <Text style={styles.ctaTxt}>{asking ? "Checking username…" : "Finish setup"}</Text>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  head: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 8,
  },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backTxt: { color: INK, fontSize: 32, lineHeight: 34, marginTop: -4 },
  barTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(22,20,15,0.1)",
    overflow: "hidden",
  },
  barFill: { height: 3, backgroundColor: LIME, borderRadius: 2 },
  body: { paddingHorizontal: 24, paddingTop: 22, flexGrow: 1 },
  h: {
    color: INK,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 36,
  },
  name: {
    color: OLIVE,
    fontWeight: "800",
  },
  lede: { color: MUTED, fontSize: 15, lineHeight: 22, marginTop: 12, marginBottom: 26 },
  field: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    color: INK,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    backgroundColor: SOFT,
  },
  dobRow: { flexDirection: "row", gap: 10 },
  dob: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 14,
    color: INK,
    fontSize: 18,
    textAlign: "center",
    paddingVertical: 16,
    backgroundColor: SOFT,
  },
  dobY: { flex: 1.3 },
  dobOn: { borderColor: OLIVE, backgroundColor: WASH },
  err: { color: "#B42318", marginTop: 12, fontSize: 14 },
  usernameHint: { color: MUTED, fontSize: 13, marginTop: -4 },
  cta: {
    marginTop: 28,
    height: 54,
    borderRadius: 27,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaOff: { backgroundColor: "rgba(214,226,122,0.38)" },
  ctaTxt: { color: INK, fontSize: 16, fontWeight: "600" },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  choiceOn: { borderColor: OLIVE, backgroundColor: WASH },
  choiceTxt: { color: INK, fontSize: 17 },
  groupLabel: { color: MUTED, fontSize: 12, letterSpacing: 0.8, marginBottom: 10 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(22,20,15,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: OLIVE },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: OLIVE },
  stage: {
    height: 420,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  stageNeed: { height: 360 },
  need: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  cameraPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(94,112,24,0.5)",
    backgroundColor: WASH,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  needH: { color: INK, fontSize: 22, fontWeight: "800", textAlign: "center" },
  needRow: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" },
  needBtn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
  },
  needBtnTxt: { color: INK, fontWeight: "700" },
  needBtnGhost: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  needBtnGhostTxt: { color: INK, fontWeight: "600" },
  changeWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 16,
    alignItems: "center",
  },
  change: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: LINE,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  changeTxt: { color: INK, fontSize: 13, fontWeight: "600" },
  h2: { color: INK, fontSize: 22, fontWeight: "800", marginTop: 26, marginBottom: 14 },
  strip: { paddingHorizontal: 24, gap: 12, paddingRight: 28 },
  uvelCard: {
    width: 168,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "transparent",
  },
  uvelOn: { borderColor: OLIVE },
  uvelImg: { width: 168, height: 210, backgroundColor: SOFT },
  trying: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: LIME,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tryingTxt: { color: INK, fontSize: 11, fontWeight: "700" },
  uvelMeta: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  uvelName: { color: INK, fontSize: 14, fontWeight: "600", lineHeight: 18 },
  uvelPrice: { color: INK, fontSize: 14, fontWeight: "700", marginTop: 4 },
  stageFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  fullPic: { width: "100%", height: "100%" },
  stageHint: { color: MUTED, textAlign: "center", paddingHorizontal: 28, lineHeight: 22 },
  savedLook: {
    color: OLIVE,
    fontFamily: "Georgia",
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: 20,
    marginTop: 12,
  },
  spin: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  spinTxt: { color: INK, fontSize: 13, letterSpacing: 1.2, textTransform: "uppercase" },
  row: { flexDirection: "row", gap: 10, marginTop: 12 },
  ghost: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    backgroundColor: "#fff",
  },
  ghostTxt: { color: INK, fontSize: 15, fontWeight: "600" },
  meta: {
    color: MUTED,
    fontSize: 11,
    letterSpacing: 1.4,
    marginTop: 22,
    marginBottom: 10,
  },
  look: { width: 88, marginRight: 10 },
  lookImg: { width: 88, height: 110, borderRadius: 10 },
  lookOn: { borderWidth: 2, borderColor: OLIVE },
  lookName: { color: MUTED, fontSize: 11, marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  chipOn: { backgroundColor: LIME, borderColor: LIME },
  chipTxt: { color: INK, fontSize: 14 },
  chipTxtOn: { color: INK, fontWeight: "600" },
  fits: { flexDirection: "row", gap: 8 },
  fit: {
    flex: 1,
    aspectRatio: 0.78,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: SOFT,
  },
  fitImg: { width: "100%", height: "100%" },
  fitPlus: { color: MUTED, fontSize: 22 },
  bullets: { gap: 18, marginTop: 6 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LIME,
    marginTop: 8,
  },
  bullet: { color: INK, fontSize: 16, lineHeight: 22, flex: 1 },
  skipBtn: { alignItems: "center", paddingVertical: 14 },
  skipTxt: { color: MUTED, fontSize: 15 },
});
