import { Accelerometer } from "expo-sensors";
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
import { submitFeedback } from "../lib/feedback";
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

  useEffect(() => {
    activeRef.current = true;
    let mounted = true;
    const appState = AppState.addEventListener("change", (state) => {
      activeRef.current = state === "active";
    });
    void Accelerometer.isAvailableAsync().then((available) => {
      if (!available || !mounted) return;
      Accelerometer.setUpdateInterval(SAMPLE_MS);
      listenerRef.current = Accelerometer.addListener(({ x, y, z }) => {
        if (!activeRef.current || openRef.current) return;
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();
        if (magnitude >= SHAKE_THRESHOLD && now - lastShake.current >= SHAKE_COOLDOWN_MS) {
          lastShake.current = now;
          openRef.current = true;
          setSent(false);
          setBody("");
          setOpen(true);
        }
      });
    }).catch(() => undefined);
    return () => {
      mounted = false;
      activeRef.current = false;
      appState.remove();
      listenerRef.current?.remove();
      listenerRef.current = null;
    };
  }, []);

  function close() {
    if (submitting) return;
    openRef.current = false;
    setOpen(false);
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

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close report problem" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Report a technical problem</Text>
              <Text style={styles.subtitle}>Tell us what went wrong and we’ll use your feedback to improve Uvel.</Text>
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
          ) : (
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
              <Pressable onPress={() => void send()} disabled={!body.trim() || submitting} style={[styles.primary, (!body.trim() || submitting) && styles.primaryDisabled]} accessibilityRole="button" accessibilityState={{ disabled: !body.trim() || submitting }}>
                {submitting ? <ActivityIndicator color={colors.successInk} /> : <Text style={styles.primaryText}>Report a problem</Text>}
              </Pressable>
              <Pressable onPress={close} disabled={submitting} style={styles.cancel} accessibilityRole="button">
                <Text style={styles.cancelText}>Not now</Text>
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
    scrim: { ...StyleSheet.absoluteFill, backgroundColor: "#00000099" },
    sheet: { backgroundColor: colors.ink, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10, borderWidth: 1, borderColor: `${colors.bone}1A` },
    grabber: { alignSelf: "center", width: 42, height: 4, borderRadius: 3, backgroundColor: `${colors.bone}55`, marginBottom: 20 },
    header: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 18 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 24, lineHeight: 29 },
    subtitle: { color: `${colors.bone}9A`, fontSize: 13, lineHeight: 19, marginTop: 8 },
    close: { width: 32, height: 32, borderRadius: 16, backgroundColor: `${colors.bone}14`, alignItems: "center", justifyContent: "center" },
    closeText: { color: colors.bone, fontSize: 24, lineHeight: 26, marginTop: -2 },
    input: { minHeight: 142, maxHeight: 220, borderRadius: 16, borderWidth: 1, borderColor: `${colors.bone}32`, backgroundColor: `${colors.bone}0C`, color: colors.bone, padding: 15, fontSize: 15, lineHeight: 21 },
    counter: { alignSelf: "flex-end", color: `${colors.bone}60`, fontSize: 11, marginTop: 7 },
    primary: { minHeight: 54, borderRadius: 16, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginTop: 16 },
    primaryDisabled: { opacity: 0.42 },
    primaryText: { color: colors.successInk, fontSize: 15, fontWeight: "900" },
    cancel: { minHeight: 48, alignItems: "center", justifyContent: "center" },
    cancelText: { color: colors.bone, fontSize: 14, fontWeight: "700" },
    success: { paddingVertical: 12 },
    successTitle: { color: colors.bone, fontSize: 18, fontWeight: "800" },
    successText: { color: `${colors.bone}99`, fontSize: 14, lineHeight: 20, marginTop: 8 },
  });
}
