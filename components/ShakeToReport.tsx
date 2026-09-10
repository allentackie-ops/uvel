import { Accelerometer } from "expo-sensors";
import { Image } from "expo-image";
import { usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadShakeToReportEnabled, requestFeedback, saveShakeToReportEnabled, submitFeedback, subscribeToFeedbackRequest } from "../lib/feedback";
import { pickFromLibrary } from "../lib/photo";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";

const SHAKE_THRESHOLD = 2.35;
const SHAKE_COOLDOWN_MS = 1800;
const SAMPLE_MS = 80;
export function ShakeToReport() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const app = useUvel();
  const [open, setOpen] = useState(false);
  const [compose, setCompose] = useState(false);
  const [shakeEnabled, setShakeEnabled] = useState(true);
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const [screenshotUri, setScreenshotUri] = useState<string | undefined>();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const lastShake = useRef(0);
  const listenerRef = useRef<{ remove: () => void } | null>(null);
  const activeRef = useRef(true);
  const openRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => subscribeToFeedbackRequest((entry) => {
    openRef.current = true;
    setCompose(entry === "compose");
    setSent(false);
    setBody("");
    setScreenshotUri(undefined);
    setIncludeScreenshot(false);
    setOpen(true);
  }), []);

  useEffect(() => {
    void loadShakeToReportEnabled().then(setShakeEnabled);
  }, []);

  useEffect(() => {
    activeRef.current = true;
    let mounted = true;
    const appState = AppState.addEventListener("change", (state) => {
      activeRef.current = state === "active";
    });
    if (shakeEnabled) {
      void Accelerometer.isAvailableAsync().then((available) => {
        if (!available || !mounted) return;
        Accelerometer.setUpdateInterval(SAMPLE_MS);
        listenerRef.current = Accelerometer.addListener(({ x, y, z }) => {
          if (!activeRef.current || openRef.current) return;
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
      mounted = false;
      activeRef.current = false;
      appState.remove();
      listenerRef.current?.remove();
      listenerRef.current = null;
    };
  }, [shakeEnabled]);

  function close() {
    if (submitting) return;
    openRef.current = false;
    setOpen(false);
    setCompose(false);
    setIncludeScreenshot(false);
    setScreenshotUri(undefined);
    setBody("");
    setSent(false);
  }

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

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close report problem" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Report a technical problem</Text>
              <Text style={styles.subtitle}>If a feature or product isn’t working correctly, you can give feedback to help us make Uvel better.</Text>
            </View>
            <Pressable onPress={close} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          {sent ? (
            <View style={styles.success}>
              <Text style={styles.successTitle}>Thanks for letting us know.</Text>
              <Text style={styles.successText}>Your report was saved and sent to the Uvel team.</Text>
              <Pressable onPress={close} style={styles.primary} accessibilityRole="button">
                <Text style={styles.primaryText}>Done</Text>
              </Pressable>
            </View>
          ) : compose ? (
            <>
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
              <Pressable onPress={() => void toggleScreenshot()} style={styles.optionRow} accessibilityRole="switch" accessibilityState={{ checked: includeScreenshot }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Include screenshot in report</Text>
                  <Text style={styles.optionHint}>{includeScreenshot ? "Screenshot attached" : "Optional"}</Text>
                </View>
                <View style={[styles.toggle, includeScreenshot && styles.toggleOn]}><View style={[styles.knob, includeScreenshot && styles.knobOn]} /></View>
              </Pressable>
              {screenshotUri ? <Image source={{ uri: screenshotUri }} style={styles.preview} contentFit="cover" /> : null}
              <Pressable onPress={() => { const next = !shakeEnabled; setShakeEnabled(next); void saveShakeToReportEnabled(next); }} style={styles.optionRow} accessibilityRole="switch" accessibilityState={{ checked: shakeEnabled }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Shake phone to report a problem</Text>
                  <Text style={styles.optionHint}>{shakeEnabled ? "Shake your phone anywhere in Uvel" : "Toggle on to enable"}</Text>
                </View>
                <View style={[styles.toggle, shakeEnabled && styles.toggleOn]}><View style={[styles.knob, shakeEnabled && styles.knobOn]} /></View>
              </Pressable>
              <Pressable onPress={() => void send()} disabled={!body.trim() || submitting} style={[styles.primary, (!body.trim() || submitting) && styles.primaryDisabled]} accessibilityRole="button" accessibilityState={{ disabled: !body.trim() || submitting }}>
                {submitting ? <ActivityIndicator color={colors.successInk} /> : <Text style={styles.primaryText}>Send report</Text>}
              </Pressable>
              <Pressable onPress={() => setCompose(false)} disabled={submitting} style={styles.cancel} accessibilityRole="button">
                <Text style={styles.cancelText}>Back</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={() => setCompose(true)} style={styles.primary} accessibilityRole="button">
                <Text style={styles.primaryText}>Report a problem</Text>
              </Pressable>
              <Pressable onPress={() => { const next = !shakeEnabled; setShakeEnabled(next); void saveShakeToReportEnabled(next); }} style={styles.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: shakeEnabled }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Shake phone to report a problem</Text>
                  <Text style={styles.toggleHint}>{shakeEnabled ? "Shake your phone anywhere in Uvel" : "Toggle on to enable"}</Text>
                </View>
                <View style={[styles.toggle, shakeEnabled && styles.toggleOn]}><View style={[styles.knob, shakeEnabled && styles.knobOn]} /></View>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: "flex-end" },
    scrim: { ...StyleSheet.absoluteFill, backgroundColor: `${colors.ink}CC` },
    sheet: { backgroundColor: colors.ink, borderTopLeftRadius: 27, borderTopRightRadius: 27, paddingHorizontal: 26, paddingTop: 10, borderWidth: 1, borderColor: `${colors.bone}1F` },
    grabber: { alignSelf: "center", width: 42, height: 4, borderRadius: 3, backgroundColor: `${colors.bone}55`, marginBottom: 22 },
    header: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 18 },
    title: { color: colors.bone, fontSize: 24, lineHeight: 29, fontWeight: "800", textAlign: "center" },
    subtitle: { color: `${colors.bone}E0`, fontSize: 14, lineHeight: 20, marginTop: 10, textAlign: "center" },
    close: { position: "absolute", right: -4, top: -4, width: 32, height: 32, borderRadius: 16, backgroundColor: `${colors.bone}14`, alignItems: "center", justifyContent: "center" },
    closeText: { color: colors.bone, fontSize: 24, lineHeight: 26, marginTop: -2 },
    primary: { minHeight: 57, borderRadius: 15, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginTop: 2 },
    primaryDisabled: { opacity: 0.42 },
    primaryText: { color: colors.successInk, fontSize: 16, fontWeight: "800" },
    toggleRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 21 },
    toggleTitle: { color: colors.bone, fontSize: 16, lineHeight: 21 },
    toggleHint: { color: `${colors.bone}85`, fontSize: 13, lineHeight: 18, marginTop: 4 },
    toggle: { width: 62, height: 36, borderRadius: 19, backgroundColor: `${colors.bone}55`, padding: 3, justifyContent: "center" },
    toggleOn: { backgroundColor: colors.success },
    knob: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.ink, transform: [{ translateX: 0 }] },
    knobOn: { backgroundColor: colors.successInk, transform: [{ translateX: 26 }] },
    input: { minHeight: 142, maxHeight: 220, borderRadius: 16, borderWidth: 1, borderColor: `${colors.bone}32`, backgroundColor: `${colors.bone}0C`, color: colors.bone, padding: 15, fontSize: 15, lineHeight: 21 },
    counter: { alignSelf: "flex-end", color: `${colors.bone}60`, fontSize: 11, marginTop: 7 },
    optionRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 15 },
    optionTitle: { color: colors.bone, fontSize: 15, lineHeight: 20 },
    optionHint: { color: `${colors.bone}75`, fontSize: 12, marginTop: 3 },
    preview: { width: 84, height: 84, borderRadius: 12, marginBottom: 4 },
    cancel: { minHeight: 48, alignItems: "center", justifyContent: "center" },
    cancelText: { color: colors.bone, fontSize: 14, fontWeight: "700" },
    success: { paddingVertical: 12 },
    successTitle: { color: colors.bone, fontSize: 18, fontWeight: "800" },
    successText: { color: `${colors.bone}99`, fontSize: 14, lineHeight: 20, marginTop: 8 },
  });
}
