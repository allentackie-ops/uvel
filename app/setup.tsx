import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
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
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GARMENTS } from "../lib/catalog";
import { useUvel } from "../lib/store";
import { addPiece } from "../lib/wardrobe";

const BG = "#12140A";
const CREAM = "#F4F0E6";
const MUTED = "rgba(244,240,230,0.58)";
const LINE = "rgba(244,240,230,0.18)";
const STEPS = 5;

const STYLES = [
  "Quiet",
  "Romantic",
  "Tailored",
  "Street",
  "Vintage",
  "Western",
  "Utility",
  "Minimal",
  "Evening",
  "Work",
  "Y2K",
  "Coastal",
];

const LOOKS = GARMENTS.filter((g) =>
  [
    "silk-slip",
    "poet-blouse",
    "satin-skirt",
    "oxford-shirt",
    "wool-blazer",
    "black-trouser",
    "leather-trench",
    "field-jacket",
  ].includes(g.id),
);

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
  const [step, setStep] = useState(0);
  const [name, setName] = useState(app.displayName);
  const [mm, setMm] = useState("");
  const [dd, setDd] = useState("");
  const [yyyy, setYyyy] = useState("");
  const [err, setErr] = useState("");
  const [gender, setGender] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [look, setLook] = useState(LOOKS[0]?.id ?? "");
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [fits, setFits] = useState<string[]>([]);
  const mmRef = useRef<TextInput>(null);
  const ddRef = useRef<TextInput>(null);
  const yyRef = useRef<TextInput>(null);

  const first = (name.trim().split(" ")[0] || "").trim();
  const garment = LOOKS.find((g) => g.id === look);

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
    if (ageOf(dt) < 18) {
      setErr("You need to be 18 or older to use Uvel.");
      return;
    }
    go(1);
  }

  async function pickPhoto(camera: boolean) {
    const fn = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const res = await fn({ mediaTypes: ["images"], quality: 0.9 });
    if (!res.canceled) {
      setPhoto(res.assets[0].uri);
      setRendered(false);
    }
  }

  async function renderLook() {
    if (!photo) return;
    setRendering(true);
    await new Promise((r) => setTimeout(r, 520));
    setRendered(true);
    setRendering(false);
  }

  async function pickFit() {
    if (fits.length >= 5) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5 - fits.length,
    });
    if (!res.canceled) {
      setFits((cur) => [...cur, ...res.assets.map((a) => a.uri)].slice(0, 5));
    }
  }

  function finish(updates: boolean) {
    const dt = parseDob(mm, dd, yyyy);
    const iso = dt ? dt.toISOString().slice(0, 10) : "";
    fits.forEach((uri, i) => {
      addPiece({
        photo: uri,
        name: `Fit ${i + 1}`,
        brand: "Your wardrobe",
        category: "Tops",
        color: "",
        size: "",
        condition: "Excellent",
        notes: "From setup",
        listPriceCents: 0,
      });
    });
    void app.completeProfile({
      displayName: name.trim(),
      birthday: iso,
      gender,
      personUri: photo,
      styles: picked,
      wardrobeUris: fits,
      wantsUpdates: updates,
    });
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
                {first ? `Hey ${first}.` : "Hey."}
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
                  onChangeText={(v) => setYyyy(v.replace(/\D/g, "").slice(0, 4))}
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
              <Text style={styles.lede}>This helps us try clothes on you — woman, man, or something else.</Text>
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
              <Text style={styles.h}>A mirror pic of you.</Text>
              <Text style={styles.lede}>
                The whole you, not a crop. We’ll put the clothes on your body so you can see the outfit before you
                buy.
              </Text>
              <View style={styles.stage}>
                {photo ? (
                  <View style={styles.stageFill}>
                    <Image source={{ uri: photo }} style={styles.fullPic} contentFit="contain" />
                    {rendering ? (
                      <View style={styles.spin}>
                        <ActivityIndicator color={CREAM} />
                        <Text style={styles.spinTxt}>Putting it on you</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.stageHint}>Full-length mirror. Head to shoes. Nothing cropped.</Text>
                )}
              </View>
              {rendered && garment && photo ? (
                <Text style={styles.savedLook}>
                  {garment.name} — saved on you. Next we’ll dress you in it for real.
                </Text>
              ) : null}
              <View style={styles.row}>
                <Pressable onPress={() => void pickPhoto(true)} style={styles.ghost}>
                  <Text style={styles.ghostTxt}>Camera</Text>
                </Pressable>
                <Pressable onPress={() => void pickPhoto(false)} style={styles.ghost}>
                  <Text style={styles.ghostTxt}>Library</Text>
                </Pressable>
              </View>
              {photo ? (
                <>
                  <Text style={styles.meta}>TRY A LOOK</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }}>
                    <View style={{ width: 24 }} />
                    {LOOKS.map((g) => (
                      <Pressable
                        key={g.id}
                        onPress={() => {
                          setLook(g.id);
                          setRendered(false);
                        }}
                        style={styles.look}
                      >
                        <Image
                          source={g.image}
                          style={[styles.lookImg, look === g.id && styles.lookOn]}
                          contentFit="cover"
                        />
                        <Text style={styles.lookName} numberOfLines={1}>
                          {g.name}
                        </Text>
                      </Pressable>
                    ))}
                    <View style={{ width: 16 }} />
                  </ScrollView>
                  <Pressable onPress={() => void renderLook()} style={styles.ghost}>
                    <Text style={styles.ghostTxt}>{rendered ? "Saved on you" : "See it on you"}</Text>
                  </Pressable>
                </>
              ) : null}
              <Pressable onPress={() => go(3)} style={[styles.cta, { marginTop: 18 }]}>
                <Text style={styles.ctaTxt}>{photo ? "Continue" : "Skip for now"}</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          {step === 3 ? (
            <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}>
              <Text style={styles.h}>What feels like you?</Text>
              <Text style={styles.lede}>
                Tap the styles you wear. Or show us up to 5 fits from your wardrobe — we’ll learn from them and
                recommend pieces brands are actually selling.
              </Text>
              <View style={styles.chips}>
                {STYLES.map((s) => {
                  const on = picked.includes(s);
                  return (
                    <Pressable
                      key={s}
                      onPress={() =>
                        setPicked((cur) => (on ? cur.filter((x) => x !== s) : [...cur, s]))
                      }
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{s}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.meta}>YOUR FITS · UP TO 5</Text>
              <View style={styles.fits}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Pressable key={i} onPress={() => void pickFit()} style={styles.fit}>
                    {fits[i] ? (
                      <Image source={{ uri: fits[i] }} style={styles.fitImg} contentFit="cover" />
                    ) : (
                      <Text style={styles.fitPlus}>+</Text>
                    )}
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => go(4)}
                style={[styles.cta, picked.length || fits.length ? null : styles.ctaOff]}
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
              <Text style={styles.h}>Stay in the loop</Text>
              <Text style={styles.lede}>
                Offers, drops, and fits that actually suit you. You can change this later.
              </Text>
              <View style={styles.bullets}>
                <Text style={styles.bullet}>Pieces that match your style</Text>
                <Text style={styles.bullet}>Price drops and new listings</Text>
                <Text style={styles.bullet}>Messages about things you like</Text>
              </View>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => finish(false)} style={styles.skipBtn}>
                <Text style={styles.skipTxt}>No thanks</Text>
              </Pressable>
              <Pressable onPress={() => finish(true)} style={styles.cta}>
                <Text style={styles.ctaTxt}>Keep me posted</Text>
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
  backTxt: { color: CREAM, fontSize: 32, lineHeight: 34, marginTop: -4 },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(244,240,230,0.16)",
    overflow: "hidden",
  },
  barFill: { height: 4, backgroundColor: CREAM, borderRadius: 2 },
  body: { paddingHorizontal: 24, paddingTop: 18, flexGrow: 1 },
  h: {
    color: CREAM,
    fontFamily: "Georgia",
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  lede: { color: MUTED, fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 22 },
  field: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    color: CREAM,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  dobRow: { flexDirection: "row", gap: 10 },
  dob: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    color: CREAM,
    fontSize: 18,
    textAlign: "center",
    paddingVertical: 16,
  },
  dobY: { flex: 1.3 },
  dobOn: { borderColor: CREAM },
  err: { color: "#E8A0A0", marginTop: 12, fontSize: 14 },
  cta: {
    marginTop: 28,
    height: 54,
    borderRadius: 27,
    backgroundColor: CREAM,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaOff: { opacity: 0.38 },
  ctaTxt: { color: "#16140F", fontSize: 16, fontWeight: "600" },
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
  },
  choiceOn: { borderColor: CREAM },
  choiceTxt: { color: CREAM, fontSize: 17 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(244,240,230,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: CREAM },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: CREAM },
  stage: {
    height: 420,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#0E1008",
    alignItems: "center",
    justifyContent: "center",
  },
  stageFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  fullPic: { width: "100%", height: "100%" },
  stageHint: { color: MUTED, textAlign: "center", paddingHorizontal: 28, lineHeight: 22 },
  savedLook: {
    color: CREAM,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    opacity: 0.8,
  },
  spin: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(18,20,10,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  spinTxt: { color: CREAM, fontSize: 13, letterSpacing: 1.2, textTransform: "uppercase" },
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
  },
  ghostTxt: { color: CREAM, fontSize: 15, fontWeight: "600" },
  meta: {
    color: MUTED,
    fontSize: 11,
    letterSpacing: 1.4,
    marginTop: 22,
    marginBottom: 10,
  },
  look: { width: 88, marginRight: 10 },
  lookImg: { width: 88, height: 110, borderRadius: 10 },
  lookOn: { borderWidth: 2, borderColor: CREAM },
  lookName: { color: MUTED, fontSize: 11, marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipOn: { backgroundColor: CREAM, borderColor: CREAM },
  chipTxt: { color: CREAM, fontSize: 14 },
  chipTxtOn: { color: "#16140F", fontWeight: "600" },
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
    backgroundColor: "#1A1C12",
  },
  fitImg: { width: "100%", height: "100%" },
  fitPlus: { color: MUTED, fontSize: 22 },
  bullets: { gap: 16, marginTop: 8 },
  bullet: { color: CREAM, fontSize: 16, lineHeight: 22, paddingLeft: 4 },
  skipBtn: { alignItems: "center", paddingVertical: 14 },
  skipTxt: { color: MUTED, fontSize: 15 },
});
