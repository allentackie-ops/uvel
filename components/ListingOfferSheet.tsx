import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "../lib/haptics";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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

export function ListingOfferSheet({ visible, piece, onClose, onGoToInbox }: Props) {
  const colors = useColors();
  const styles = make(colors);
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const market = getMarket(app.country);
  const currency = piece.currency || market.currency;
  const suggestedCents = suggestedOfferCents(piece.listPriceCents);
  const zeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
  const [offerValue, setOfferValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [threadId, setThreadId] = useState("");

  useEffect(() => {
    if (!visible) return;
    setOfferValue((suggestedCents / 100).toFixed(zeroDecimal ? 0 : 2));
    setSent(false);
    setThreadId("");
  }, [visible, piece.id, suggestedCents, zeroDecimal]);

  function closeIfIdle() {
    if (!busy) onClose();
  }

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
    onClose();
    if (id) setTimeout(() => onGoToInbox(id), 300);
  }

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={closeIfIdle}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeIfIdle}
          accessibilityRole="button"
          accessibilityLabel="Close offer sheet"
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 18 }]}>
          {sent ? (
            <>
              <View style={styles.sentIcon}><Ionicons name="checkmark" size={23} color={colors.successInk} /></View>
              <Text style={styles.title}>Offer sent</Text>
              <Text style={styles.body}>The seller has 24 hours to respond. If they accept, you’ll get a checkout link in your inbox at the agreed price.</Text>
              <AccessiblePressable onPress={openInbox} style={styles.submit} accessibilityRole="button" accessibilityLabel="Go to inbox">
                <Text style={styles.submitText}>Go to inbox</Text>
                <Ionicons name="arrow-forward" size={17} color={colors.successInk} />
              </AccessiblePressable>
              <AccessiblePressable onPress={closeIfIdle} style={styles.cancel} accessibilityRole="button"><Text style={styles.cancelText}>Done</Text></AccessiblePressable>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Make an offer</Text>
                <AccessiblePressable onPress={closeIfIdle} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                  <Ionicons name="close" size={23} color={colors.muted} />
                </AccessiblePressable>
              </View>
              <Text style={styles.body}>Listed at {moneyInMarket(piece.listPriceCents, currency, market)}. The seller can accept or decline in their inbox.</Text>
              <AccessiblePressable
                onPress={() => setOfferValue((suggestedCents / 100).toFixed(zeroDecimal ? 0 : 2))}
                style={styles.suggestion}
                accessibilityRole="button"
                accessibilityLabel="Use suggested offer, 25 percent below asking"
              >
                <Text style={styles.suggestionLabel}>Suggested · 25% off</Text>
                <Text style={styles.suggestionValue}>{moneyInMarket(suggestedCents, currency, market)}</Text>
              </AccessiblePressable>
              <View style={styles.inputWrap}>
                <Text style={styles.currency}>{currency}</Text>
                <TextInput
                  value={offerValue}
                  onChangeText={(value) => setOfferValue(value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 12))}
                  keyboardType="decimal-pad"
                  style={styles.input}
                  placeholder={zeroDecimal ? "0" : "0.00"}
                  placeholderTextColor={colors.subtle}
                  accessibilityLabel="Your offer amount"
                  editable={!busy}
                />
              </View>
              <AccessiblePressable onPress={() => void submitOffer()} disabled={busy} style={[styles.submit, busy && styles.disabled]} accessibilityRole="button">
                <Text style={styles.submitText}>{busy ? "Sending…" : "Send offer"}</Text>
                {!busy ? <Ionicons name="arrow-forward" size={17} color={colors.successInk} /> : null}
              </AccessiblePressable>
              <AccessiblePressable onPress={closeIfIdle} disabled={busy} style={styles.cancel} accessibilityRole="button"><Text style={styles.cancelText}>Cancel</Text></AccessiblePressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.52)" },
    sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 23, borderTopRightRadius: 23, paddingHorizontal: 22, paddingTop: 22 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 25 },
    body: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 9 },
    suggestion: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: `${colors.success}18`, borderWidth: 1, borderColor: `${colors.success}66` },
    suggestionLabel: { color: colors.success, fontSize: 13, fontWeight: "800" },
    suggestionValue: { color: colors.bone, fontSize: 14, fontWeight: "800" },
    inputWrap: { minHeight: 62, marginTop: 12, borderRadius: 14, backgroundColor: colors.ink, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
    currency: { color: colors.muted, fontSize: 15, fontWeight: "700" },
    input: { flex: 1, color: colors.bone, fontSize: 25, fontWeight: "800", paddingVertical: 10 },
    submit: { minHeight: 52, borderRadius: 26, marginTop: 16, paddingHorizontal: 18, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
    submitText: { color: colors.successInk, fontSize: 15, fontWeight: "900" },
    disabled: { opacity: 0.6 },
    cancel: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 3 },
    cancelText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
    sentIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  });
}
