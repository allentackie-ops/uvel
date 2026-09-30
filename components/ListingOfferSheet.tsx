import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "../lib/haptics";
import { useEffect, useMemo, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "./AccessiblePressable";
import { getMarket, moneyInMarket } from "../lib/markets";
import { createListingOffer, suggestedOfferCents } from "../lib/offers";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";
import type { ClosetPiece } from "../lib/wardrobe";

type Props = {
  visible: boolean;
  piece: ClosetPiece;
  onClose: () => void;
  onGoToInbox: (threadId: string) => void;
};

const ZERO_DECIMAL_CURRENCIES = new Set(["ARS", "COP", "CLP", "NGN", "JPY", "KRW", "IDR", "VND"]);
const SHEET_SPRING = { damping: 24, stiffness: 220, mass: 0.85 };
const DISMISS_DISTANCE = 76;
const DISMISS_VELOCITY = 700;

export function ListingOfferSheet({ visible, piece, onClose, onGoToInbox }: Props) {
  const colors = useColors();
  const styles = make(colors);
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const market = getMarket(app.country);
  const currency = piece.currency || market.currency;
  const suggestedCents = suggestedOfferCents(piece.listPriceCents);
  const zeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
  const offscreenY = Math.max(screenHeight, 620);
  const translateY = useSharedValue(offscreenY);
  const dismissing = useSharedValue(0);
  const [offerValue, setOfferValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [threadId, setThreadId] = useState("");
  const sheetMotionStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropMotionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, offscreenY], [1, 0], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    if (!visible) return;
    dismissing.value = 0;
    translateY.value = offscreenY;
    translateY.value = withSpring(0, SHEET_SPRING);
    setOfferValue((suggestedCents / 100).toFixed(zeroDecimal ? 0 : 2));
    setSent(false);
    setThreadId("");
  }, [visible, piece.id, suggestedCents, zeroDecimal, dismissing, offscreenY, translateY]);

  function finishDismiss() {
    onClose();
  }

  function dismissSheet() {
    if (busy || dismissing.value) return;
    dismissing.value = 1;
    Keyboard.dismiss();
    translateY.value = withTiming(offscreenY, { duration: 220 }, (finished) => {
      if (finished) runOnJS(finishDismiss)();
    });
  }

  const panToDismiss = useMemo(() => Gesture.Pan()
    .activeOffsetY(6)
    .failOffsetX([-18, 18])
    .onUpdate((event) => {
      if (!dismissing.value) translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (dismissing.value) return;
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        dismissing.value = 1;
        runOnJS(Keyboard.dismiss)();
        translateY.value = withTiming(offscreenY, { duration: 220 }, (finished) => {
          if (finished) runOnJS(finishDismiss)();
        });
      } else {
        translateY.value = withSpring(0, SHEET_SPRING);
      }
    }), [dismissing, finishDismiss, offscreenY, translateY]);

  async function submitOffer() {
    const amountCents = Math.round(Number(offerValue.replace(/,/g, "")) * 100);
    if (!app.uid) {
      Alert.alert("Sign in to make an offer", "Create or sign in to your Uvel account first.");
      return;
    }
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents >= piece.listPriceCents) {
      Alert.alert("Enter a valid offer", "Your offer must be a positive amount below the listed price.");
      return;
    }
    setBusy(true);
    try {
      const result = await createListingOffer(piece.id, amountCents);
      setThreadId(result.threadId);
      setSent(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/^Firebase: /, "") : "Please try again.";
      Alert.alert("Offer not sent", message);
    } finally {
      setBusy(false);
    }
  }

  function openInbox() {
    const id = threadId;
    if (!id) {
      dismissSheet();
      return;
    }
    dismissSheet();
    setTimeout(() => onGoToInbox(id), 320);
  }

  const pan = panToDismiss;
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={dismissSheet}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <KeyboardAvoidingView style={styles.keyboardRoot} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
          <Animated.View style={[styles.scrim, backdropMotionStyle]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={dismissSheet}
              accessibilityRole="button"
              accessibilityLabel="Close offer sheet"
            />
            <GestureDetector gesture={pan}>
              <Animated.View style={[styles.sheet, sheetMotionStyle, { paddingBottom: Math.max(insets.bottom, 12) + 14 }]}>
                <View style={styles.dragHandleArea} accessible accessibilityLabel="Swipe down to close the offer sheet">
                  <View style={styles.dragHandle} />
                </View>
                {sent ? (
                  <>
                    <View style={styles.successHeader}>
                      <View style={styles.sentIcon}><Ionicons name="checkmark" size={19} color={colors.successInk} /></View>
                      <View style={styles.successCopy}>
                        <Text style={styles.title}>Offer sent</Text>
                        <Text style={styles.body}>The seller has 24 hours to respond. We’ll notify you if they accept.</Text>
                      </View>
                    </View>
                    <AccessiblePressable onPress={openInbox} style={styles.submit} accessibilityRole="button" accessibilityLabel="Go to inbox">
                      <Text style={styles.submitText}>Open inbox</Text>
                      <Ionicons name="arrow-forward" size={17} color={colors.successInk} />
                    </AccessiblePressable>
                    <AccessiblePressable onPress={dismissSheet} style={styles.cancel} accessibilityRole="button"><Text style={styles.cancelText}>Close</Text></AccessiblePressable>
                  </>
                ) : (
                  <>
                    <View style={styles.header}>
                      <View style={styles.headerCopy}>
                        <Text style={styles.title}>Make an offer</Text>
                        <Text style={styles.body}>Listed at {moneyInMarket(piece.listPriceCents, currency, market)} · seller responds within 24 hours</Text>
                      </View>
                      <AccessiblePressable onPress={dismissSheet} hitSlop={8} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close">
                        <Ionicons name="close" size={21} color={colors.muted} />
                      </AccessiblePressable>
                    </View>
                    <AccessiblePressable
                      onPress={() => setOfferValue((suggestedCents / 100).toFixed(zeroDecimal ? 0 : 2))}
                      style={styles.suggestion}
                      accessibilityRole="button"
                      accessibilityLabel={`Use suggested offer, 25 percent below asking: ${moneyInMarket(suggestedCents, currency, market)}`}
                    >
                      <View style={styles.suggestionCopy}>
                        <Text style={styles.suggestionLabel}>Suggested offer</Text>
                        <Text style={styles.suggestionSubtext}>25% below asking</Text>
                      </View>
                      <Text style={styles.suggestionValue}>{moneyInMarket(suggestedCents, currency, market)}</Text>
                    </AccessiblePressable>
                    <Text style={styles.inputLabel}>Your offer</Text>
                    <View style={styles.inputWrap}>
                      <Text style={styles.currency}>{currency}</Text>
                      <TextInput
                        value={offerValue}
                        onChangeText={(value) => setOfferValue(value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 12))}
                        keyboardType="decimal-pad"
                        style={styles.input}
                        placeholder="Enter amount"
                        placeholderTextColor={colors.subtle}
                        accessibilityLabel="Your offer amount"
                        editable={!busy}
                      />
                    </View>
                    <AccessiblePressable onPress={() => void submitOffer()} disabled={busy} style={[styles.submit, busy && styles.disabled]} accessibilityRole="button">
                      <Text style={styles.submitText}>{busy ? "Sending…" : "Send offer"}</Text>
                      {!busy ? <Ionicons name="arrow-forward" size={17} color={colors.successInk} /> : null}
                    </AccessiblePressable>
                    <AccessiblePressable onPress={dismissSheet} disabled={busy} style={styles.cancel} accessibilityRole="button"><Text style={styles.cancelText}>Cancel</Text></AccessiblePressable>
                  </>
                )}
              </Animated.View>
            </GestureDetector>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    gestureRoot: { flex: 1 },
    keyboardRoot: { flex: 1 },
    scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" },
    sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 23, borderTopRightRadius: 23, borderWidth: 1, borderColor: `${colors.bone}12`, paddingHorizontal: 22, paddingTop: 4 },
    dragHandleArea: { height: 26, alignItems: "center", justifyContent: "center" },
    dragHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: `${colors.muted}88` },
    header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginTop: 3 },
    headerCopy: { flex: 1 },
    title: { color: colors.bone, fontSize: 22, lineHeight: 28, fontWeight: "800" },
    body: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
    closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.bone}0D` },
    suggestion: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 14, marginTop: 18, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: `${colors.success}12`, borderWidth: 1, borderColor: `${colors.success}55` },
    suggestionCopy: { flex: 1 },
    suggestionLabel: { color: colors.success, fontSize: 13, fontWeight: "800" },
    suggestionSubtext: { color: colors.muted, fontSize: 11, marginTop: 2 },
    suggestionValue: { color: colors.bone, fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
    inputLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 16, marginBottom: 6 },
    inputWrap: { minHeight: 58, borderRadius: 14, backgroundColor: colors.ink, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
    currency: { color: colors.muted, fontSize: 13, fontWeight: "800" },
    input: { flex: 1, color: colors.bone, fontSize: 22, fontWeight: "800", paddingVertical: 8 },
    submit: { minHeight: 50, borderRadius: 15, marginTop: 16, paddingHorizontal: 18, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
    submitText: { color: colors.successInk, fontSize: 15, fontWeight: "900" },
    disabled: { opacity: 0.6 },
    cancel: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: 2 },
    cancelText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
    successHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 6 },
    successCopy: { flex: 1 },
    sentIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  });
}
