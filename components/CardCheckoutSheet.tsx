import { Ionicons } from "@expo/vector-icons";
import { CardField, useStripe } from "@stripe/stripe-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "./AccessiblePressable";
import type { Address } from "../lib/orders";
import { useColors, type Colors } from "../lib/theme";

type Props = {
  visible: boolean;
  clientSecret: string;
  address: Address;
  email?: string;
  amountLabel: string;
  onClose: () => void;
  onPaid: () => void;
  onPayWithLink: () => void;
};

export function CardCheckoutSheet({
  visible,
  clientSecret,
  address,
  email,
  amountLabel,
  onClose,
  onPaid,
  onPayWithLink,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { confirmPayment } = useStripe();
  const [cardComplete, setCardComplete] = useState(false);
  const [savingCard, setSavingCard] = useState(true);
  const [postalCode, setPostalCode] = useState(address.postal || "");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!visible) return;
    setPostalCode(address.postal || "");
    setSavingCard(true);
    setCardComplete(false);
    setErrorMessage("");
    setBusy(false);
  }, [address.postal, visible]);

  async function payNow() {
    if (busy || !cardComplete || !postalCode.trim()) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const result = await confirmPayment(
        clientSecret,
        {
          paymentMethodType: "Card",
          paymentMethodData: {
            billingDetails: {
              name: address.name || undefined,
              email: email || undefined,
              phone: address.phone || undefined,
              address: {
                line1: address.line1 || undefined,
                line2: address.line2 || undefined,
                city: address.city || undefined,
                state: address.region || undefined,
                postalCode: postalCode.trim(),
                country: address.country?.toUpperCase() || undefined,
              },
            },
          },
        },
        savingCard ? { setupFutureUsage: "OffSession" } : {},
      );
      if (result.error) throw new Error(result.error.message || "Your card could not be charged.");
      if (!result.paymentIntent) throw new Error("Stripe did not return a payment confirmation.");
      onPaid();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Your payment could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <AccessiblePressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close card payment"
        >
          <View style={styles.scrim} />
        </AccessiblePressable>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboard}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 4 }]} accessibilityViewIsModal>
            <View style={styles.header}>
              <AccessiblePressable
                onPress={onClose}
                disabled={busy}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close card payment"
              >
                <Ionicons name="close" size={27} color={colors.bone} />
              </AccessiblePressable>
              <Text style={styles.title}>Add new card</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.cardRow}>
              <Ionicons name="card-outline" size={27} color={colors.subtle} style={styles.cardIcon} />
              <CardField
                style={styles.cardField}
                postalCodeEnabled={false}
                countryCode={address.country?.toUpperCase() || "US"}
                onCardChange={(details) => setCardComplete(details.complete)}
                disabled={busy}
                cardStyle={{
                  backgroundColor: colors.surface,
                  borderColor: "transparent",
                  borderWidth: 0,
                  borderRadius: 0,
                  textColor: colors.bone,
                  placeholderColor: colors.muted,
                  textErrorColor: colors.danger,
                  fontSize: 15,
                }}
                placeholders={{ number: "Card number", expiration: "MM/YY", cvc: "CVC" }}
                accessibilityLabel="Card number, expiration date, and security code"
              />
              <TextInput
                value={postalCode}
                onChangeText={setPostalCode}
                placeholder="ZIP"
                placeholderTextColor={colors.muted}
                style={styles.zipInput}
                keyboardType="number-pad"
                autoComplete="postal-code"
                textContentType="postalCode"
                maxLength={12}
                editable={!busy}
                accessibilityLabel="ZIP code"
              />
            </View>

            <AccessiblePressable
              onPress={() => setSavingCard((value) => !value)}
              disabled={busy}
              style={styles.saveRow}
              accessibilityRole="switch"
              accessibilityLabel="Save my card details"
              accessibilityState={{ checked: savingCard, disabled: busy }}
            >
              <View style={[styles.toggle, savingCard && styles.toggleOn]}>
                <View style={[styles.toggleKnob, savingCard && styles.toggleKnobOn]}>
                  {savingCard ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                </View>
              </View>
              <Text style={styles.saveText}>Save my card details</Text>
            </AccessiblePressable>

            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

            <AccessiblePressable
              onPress={() => void payNow()}
              disabled={!cardComplete || !postalCode.trim() || busy}
              style={[styles.payButton, (!cardComplete || !postalCode.trim() || busy) && styles.payButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel={`Pay now, ${amountLabel}`}
              accessibilityState={{ disabled: !cardComplete || !postalCode.trim() || busy, busy }}
            >
              {busy ? <ActivityIndicator color="#161616" /> : <Text style={styles.payText}>Pay now</Text>}
            </AccessiblePressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.divider} />
            </View>
            <AccessiblePressable
              onPress={onPayWithLink}
              disabled={busy}
              style={styles.linkButton}
              accessibilityRole="button"
              accessibilityLabel="Pay with Link"
            >
              <Text style={styles.linkText}>Pay with</Text>
              <View style={styles.linkTab}>
                <Ionicons name="link" size={14} color="#fff" />
                <Text style={styles.linkWord}>Link</Text>
              </View>
            </AccessiblePressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function makeStyles(colors: Colors) {
  const BG = colors.surface;
  const FG = colors.bone;
  const MUTED = colors.muted;
  const BORDER = colors.neutral;
  const PAY_DISABLED = "#a8a8a8";
  return StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)" },
  keyboard: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingHorizontal: 20,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  header: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  closeButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: FG, fontSize: 18, fontWeight: "700", letterSpacing: 0.1 },
  headerSpacer: { width: 40 },
  cardRow: { minHeight: 50, borderWidth: 1, borderColor: BORDER, borderRadius: 3, flexDirection: "row", alignItems: "center", paddingHorizontal: 9, backgroundColor: colors.surface },
  cardIcon: { marginRight: 8 },
  cardField: { flex: 1, height: 44, minWidth: 0 },
  zipInput: { width: 44, height: 40, color: FG, fontSize: 13, textAlign: "center", paddingHorizontal: 0, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: BORDER },
  saveRow: { flexDirection: "row", alignItems: "center", minHeight: 42, marginTop: 8, marginBottom: 10, paddingHorizontal: 8 },
  toggle: { width: 44, height: 26, borderRadius: 15, borderWidth: 1, borderColor: "#777", alignItems: "flex-start", justifyContent: "center", padding: 2, marginRight: 13, backgroundColor: "#111" },
  toggleOn: { backgroundColor: "#fff", borderColor: "#fff", alignItems: "flex-end" },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#767676", alignItems: "center", justifyContent: "center" },
  toggleKnobOn: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#101010" },
  saveText: { color: FG, fontSize: 15, fontWeight: "500" },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18, marginBottom: 10, marginHorizontal: 8 },
  payButton: { height: 48, borderRadius: 4, backgroundColor: "#ededed", alignItems: "center", justifyContent: "center" },
  payButtonDisabled: { backgroundColor: PAY_DISABLED },
  payText: { color: "#161616", fontSize: 16, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6, marginBottom: 0 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: BORDER },
  orText: { color: MUTED, fontSize: 12 },
  linkButton: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  linkText: { color: FG, fontSize: 15, fontWeight: "500" },
  linkTab: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10, borderRadius: 5, backgroundColor: "#00A86B" },
  linkWord: { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 0.15 },
  });
}
