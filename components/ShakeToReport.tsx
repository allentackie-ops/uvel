import { Accelerometer } from "expo-sensors";
import { Image } from "expo-image";
import { usePathname } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  AppState,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OrbitLoader } from "./OrbitLoader";
import {
  loadShakeToReportEnabled,
  requestFeedback,
  saveShakeToReportEnabled,
  submitFeedback,
  subscribeToFeedbackRequest,
} from "../lib/feedback";
import { pickFromLibrary } from "../lib/photo";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";

const SHAKE_THRESHOLD = 2.35;
const SHAKE_COOLDOWN_MS = 1800;
const SAMPLE_MS = 80;
const OPEN_MS = 260;
const CLOSE_MS = 180;

type SheetPhase = "closed" | "opening" | "ready" | "closing";

export function ShakeToReport() {
  const colors = useColors();
  const styles = make(colors);
  const pathname = usePathname();
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [visible, setVisible] = useState(false);
  const [compose, setCompose] = useState(false);
  const [shakeEnabled, setShakeEnabled] = useState(true);
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const [screenshotUri, setScreenshotUri] = useState<string>();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [chromeHeight, setChromeHeight] = useState(110);

  const sheetY = useRef(new Animated.Value(windowHeight)).current;
  const phase = useRef<SheetPhase>("closed");
  const openRef = useRef(false);
  const mountedRef = useRef(true);
  const lastShake = useRef(0);
  const listenerRef = useRef<{ remove: () => void } | null>(null);

  const resetContent = () => {
    setCompose(false);
    setSent(false);
    setBody("");
    setScreenshotUri(undefined);
    setIncludeScreenshot(false);
  };

  const finishClose = () => {
    phase.current = "closed";
    openRef.current = false;
    sheetY.stopAnimation();
    sheetY.setValue(windowHeight);
    if (mountedRef.current) setVisible(false);
    resetContent();
  };

  const closeSheet = () => {
    if (phase.current === "closed" || phase.current === "closing" || submitting) return;
    phase.current = "closing";
    openRef.current = false;
    sheetY.stopAnimation();
    Animated.timing(sheetY, {
      toValue: windowHeight,
      duration: CLOSE_MS,
      useNativeDriver: false,
    }).start(() => finishClose());
  };

  const presentSheet = (entry: "prompt" | "compose") => {
    if (phase.current !== "closed") return;
    phase.current = "opening";
    openRef.current = true;
    resetContent();
    setCompose(entry === "compose");
    sheetY.stopAnimation();
    // Put the sheet below the viewport before mounting the Modal. The first
    // visible frame is therefore already in the correct starting position.
    sheetY.setValue(windowHeight);
    setVisible(true);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sheetY.stopAnimation();
    };
  }, [sheetY]);

  useEffect(() => {
    if (!visible || phase.current !== "opening") return;
    const frame = requestAnimationFrame(() => {
      if (!mountedRef.current || !openRef.current || phase.current !== "opening") return;
      Animated.timing(sheetY, {
        toValue: 0,
        duration: OPEN_MS,
        useNativeDriver: false,
      }).start(() => {
        if (phase.current === "opening") phase.current = "ready";
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [sheetY, visible]);

  useEffect(() => {
    const unsubscribe = subscribeToFeedbackRequest((entry) => presentSheet(entry));
    return unsubscribe;
  }, [windowHeight]);

  useEffect(() => {
    void loadShakeToReportEnabled().then(setShakeEnabled);
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const appState = AppState.addEventListener("change", (state) => {
      mountedRef.current = state === "active";
    });
    if (shakeEnabled) {
      void Accelerometer.isAvailableAsync().then((available) => {
        if (!available || !alive) return;
        Accelerometer.setUpdateInterval(SAMPLE_MS);
        listenerRef.current = Accelerometer.addListener(({ x, y, z }) => {
          if (!mountedRef.current || openRef.current) return;
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          const now = Date.now();
          if (magnitude >= SHAKE_THRESHOLD && now - lastShake.current >= SHAKE_COOLDOWN_MS) {
            lastShake.current = now;
            requestFeedback("prompt");
          }
        });
      }).catch(() => undefined);
    }
    return () => {
      alive = false;
      appState.remove();
      listenerRef.current?.remove();
      listenerRef.current = null;
    };
  }, [shakeEnabled]);

  async function send() {
    const clean = body.trim();
    if (!clean || submitting) return;
    setSubmitting(true);
    try {
      await submitFeedback({
        body: clean,
        screenshotUri,
        category: "technical",
        screen: pathname || "/",
        userId: app.uid || undefined,
        userName: app.displayName || undefined,
      });
      setSent(true);
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleScreenshot() {
    if (includeScreenshot) {
      setIncludeScreenshot(false);
      setScreenshotUri(undefined);
      return;
    }
    const uri = await pickFromLibrary();
    if (uri) {
      setScreenshotUri(uri);
      setIncludeScreenshot(true);
    }
  }

  const sheetMaxHeight = Math.max(280, windowHeight - keyboardHeight - Math.max(insets.top, 8) - 8);
  const sheetPaddingBottom = keyboardHeight ? 12 : Math.max(insets.bottom, 12);
  const formMaxHeight = Math.max(120, sheetMaxHeight - chromeHeight - sheetPaddingBottom);

  const dragZonePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, gesture) => {
      if (phase.current === "closing") return;
      sheetY.setValue(Math.max(0, gesture.dy));
    },
    onPanResponderRelease: (_, gesture) => {
      if (phase.current === "closing") return;
      if (gesture.dy > 110 || gesture.vy > 1.1) {
        closeSheet();
      } else {
        phase.current = "ready";
        Animated.spring(sheetY, { toValue: 0, useNativeDriver: false, bounciness: 4 }).start();
      }
    },
    onPanResponderTerminate: () => {
      if (phase.current !== "closing") {
        phase.current = "ready";
        Animated.spring(sheetY, { toValue: 0, useNativeDriver: false, bounciness: 4 }).start();
      }
    },
  })).current;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeSheet} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable style={styles.scrim} onPress={closeSheet} accessibilityRole="button" accessibilityLabel="Close report problem" />
        <View pointerEvents="box-none" style={[styles.sheetWrap, { paddingBottom: keyboardHeight }]}>
          <Animated.View style={[styles.sheet, { maxHeight: sheetMaxHeight, paddingBottom: sheetPaddingBottom, transform: [{ translateY: sheetY }] }]}>
            <View {...dragZonePan.panHandlers} style={styles.dragZone} accessibilityRole="adjustable" accessibilityLabel="Swipe down to close report" />
            <View onLayout={(event) => setChromeHeight(event.nativeEvent.layout.height)}>
              <View style={styles.header}>
                <Text style={styles.title}>Report a technical problem</Text>
                <Text style={styles.subtitle}>If a feature or product isn’t working correctly, you can give feedback to help us make Uvel better.</Text>
              </View>
            </View>
            {sent ? (
              <View style={styles.success}>
                <Text style={styles.successTitle}>Thanks for letting us know.</Text>
                <Text style={styles.successText}>Your report was saved and sent to the Uvel team.</Text>
                <Pressable onPress={closeSheet} style={styles.primary} accessibilityRole="button">
                  <Text style={styles.primaryText}>Done</Text>
                </Pressable>
              </View>
            ) : compose ? (
              <ScrollView
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: formMaxHeight }}
                contentContainerStyle={styles.formContent}
              >
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  style={styles.input}
                  placeholder="What happened?"
                  placeholderTextColor={`${colors.bone}70`}
                  multiline
                  maxLength={2000}
                  autoFocus
                  textAlignVertical="top"
                  accessibilityLabel="Describe the technical problem"
                />
                <Text style={styles.counter}>{body.length}/2000</Text>
                <ToggleRow title="Include screenshot in report" hint={includeScreenshot ? "Screenshot attached" : "Optional"} checked={includeScreenshot} onPress={() => void toggleScreenshot()} styles={styles} />
                {screenshotUri ? <Image cachePolicy="memory-disk" source={{ uri: screenshotUri }} style={styles.preview} contentFit="cover" /> : null}
                <ToggleRow title="Shake phone to report a problem" hint={shakeEnabled ? "Shake your phone anywhere in Uvel" : "Toggle on to enable"} checked={shakeEnabled} onPress={() => { const next = !shakeEnabled; setShakeEnabled(next); void saveShakeToReportEnabled(next); }} styles={styles} />
                <Pressable onPress={() => void send()} disabled={!body.trim() || submitting} style={[styles.primary, (!body.trim() || submitting) && styles.primaryDisabled]} accessibilityRole="button" accessibilityState={{ disabled: !body.trim() || submitting }}>
                  {submitting ? <OrbitLoader size={24} /> : <Text style={styles.primaryText}>Send report</Text>}
                </Pressable>
                <Pressable onPress={() => setCompose(false)} disabled={submitting} style={styles.cancel} accessibilityRole="button">
                  <Text style={styles.cancelText}>Back</Text>
                </Pressable>
              </ScrollView>
            ) : (
              <>
                <Pressable onPress={() => setCompose(true)} style={styles.primary} accessibilityRole="button">
                  <Text style={styles.primaryText}>Report a problem</Text>
                </Pressable>
                <ToggleRow title="Shake phone to report a problem" hint={shakeEnabled ? "Shake your phone anywhere in Uvel" : "Toggle on to enable"} checked={shakeEnabled} onPress={() => { const next = !shakeEnabled; setShakeEnabled(next); void saveShakeToReportEnabled(next); }} styles={styles} />
              </>
            )}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function ToggleRow({ title, hint, checked, onPress, styles }: { title: string; hint: string; checked: boolean; onPress: () => void; styles: ReturnType<typeof make> }) {
  return (
    <Pressable onPress={onPress} style={styles.toggleRow} accessibilityRole="switch" accessibilityState={{ checked }}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
      <View style={[styles.toggle, checked && styles.toggleOn]}><View style={[styles.knob, checked && styles.knobOn]} /></View>
    </Pressable>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: "flex-end" },
    scrim: { ...StyleSheet.absoluteFill, backgroundColor: `${colors.ink}CC` },
    sheetWrap: { width: "100%", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.ink, borderTopLeftRadius: 27, borderTopRightRadius: 27, paddingHorizontal: 26, paddingTop: 26, borderWidth: 1, borderColor: `${colors.bone}1F` },
    dragZone: { position: "absolute", top: 0, left: 0, right: 0, height: 68, zIndex: 20 },
    header: { marginBottom: 18 },
    title: { color: colors.bone, fontSize: 24, lineHeight: 29, fontWeight: "800", textAlign: "center" },
    subtitle: { color: `${colors.bone}E0`, fontSize: 14, lineHeight: 20, marginTop: 10, textAlign: "center" },
    formContent: { paddingBottom: 8 },
    primary: { minHeight: 57, borderRadius: 15, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginTop: 2 },
    primaryDisabled: { opacity: 0.42 },
    primaryText: { color: colors.successInk, fontSize: 16, fontWeight: "800" },
    toggleRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 21 },
    toggleTitle: { color: colors.bone, fontSize: 16, lineHeight: 21 },
    toggleHint: { color: `${colors.bone}85`, fontSize: 13, lineHeight: 18, marginTop: 4 },
    toggle: { width: 62, height: 36, borderRadius: 19, backgroundColor: `${colors.bone}55`, padding: 3, justifyContent: "center" },
    toggleOn: { backgroundColor: colors.success },
    knob: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.ink },
    knobOn: { backgroundColor: colors.successInk, transform: [{ translateX: 26 }] },
    input: { minHeight: 142, maxHeight: 220, borderRadius: 16, borderWidth: 1, borderColor: `${colors.bone}32`, backgroundColor: `${colors.bone}0C`, color: colors.bone, padding: 15, fontSize: 15, lineHeight: 21 },
    counter: { alignSelf: "flex-end", color: `${colors.bone}60`, fontSize: 11, marginTop: 7 },
    preview: { width: 84, height: 84, borderRadius: 12, marginBottom: 4 },
    cancel: { minHeight: 36, alignItems: "center", justifyContent: "center" },
    cancelText: { color: colors.bone, fontSize: 14, fontWeight: "700" },
    success: { paddingVertical: 12 },
    successTitle: { color: colors.bone, fontSize: 18, fontWeight: "800" },
    successText: { color: `${colors.bone}99`, fontSize: 14, lineHeight: 20, marginTop: 8 },
  });
}
