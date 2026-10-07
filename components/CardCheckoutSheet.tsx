import { Ionicons } from "@expo/vector-icons";
import { CardField, useStripe } from "@stripe/stripe-react-native";
import { useEffect, useState } from "react";
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

const BG = "#090909";
const FG = "#f7f7f7";
const MUTED = "#898989";
const BORDER = "#4a4a4a";
const PAY_DISABLED = "#a8a8a8";

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
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) + 18 }]} accessibilityViewIsModal>
            <View style={styles.header}>
              <AccessiblePressable
                onPress={onClose}
                disabled={busy}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close card payment"
              >
                <Ionicons name="close" size={27} color={FG} />
              </AccessiblePressable>
              <Text style={styles.title}>Add new card</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.cardRow}>
              <Ionicons name="card-outline" size={27} color="#777" style={styles.cardIcon} />
              <CardField
                style={styles.cardField}
                postalCodeEnabled={false}
                countryCode={address.country?.toUpperCase() || "US"}
                onCardChange={(details) => setCardComplete(details.complete)}
                disabled={busy}
                cardStyle={{
                  backgroundColor: "transparent",
                  borderColor: "transparent",
                  borderWidth: 0,
                  borderRadius: 0,
                  textColor: FG,
                  placeholderColor: MUTED,
                  textErrorColor: "#ff8c8c",
                  fontSize: 15,
                }}
                placeholders={{ number: "Card number", expiration: "MM/YY", cvc: "CVC" }}
                accessibilityLabel="Card number, expiration date, and security code"
              />
              <TextInput
                value={postalCode}
                onChangeText={setPostalCode}
                placeholder="ZIP"
                placeholderTextColor={MUTED}
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
                  {savingCard ? <Ionicons name="checkmark" size={14} color="#101010" /> : null}
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
              <Ionicons name="link-outline" size={19} color={FG} />
              <Text style={styles.linkText}>Pay with <Text style={styles.linkWord}>Link</Text></Text>
            </AccessiblePressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)" },
  keyboard: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#242424",
  },
  header: { height: 76, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 42 },
  closeButton: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: "#343434", alignItems: "center", justifyContent: "center" },
  title: { color: FG, fontSize: 21, fontWeight: "700", letterSpacing: 0.1 },
  headerSpacer: { width: 46 },
  cardRow: { minHeight: 60, borderWidth: 1, borderColor: BORDER, borderRadius: 3, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, backgroundColor: "#0d0d0d" },
  cardIcon: { marginRight: 8 },
  cardField: { flex: 1, height: 54, minWidth: 0 },
  zipInput: { width: 48, height: 48, color: FG, fontSize: 14, textAlign: "center", paddingHorizontal: 0, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "#333" },
  saveRow: { flexDirection: "row", alignItems: "center", minHeight: 60, marginTop: 20, marginBottom: 22, paddingHorizontal: 8 },
  toggle: { width: 48, height: 28, borderRadius: 16, borderWidth: 1, borderColor: "#777", alignItems: "flex-start", justifyContent: "center", padding: 2, marginRight: 15, backgroundColor: "#111" },
  toggleOn: { backgroundColor: "#fff", borderColor: "#fff", alignItems: "flex-end" },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#767676", alignItems: "center", justifyContent: "center" },
  toggleKnobOn: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#101010" },
  saveText: { color: FG, fontSize: 16, fontWeight: "500" },
  error: { color: "#ff9b9b", fontSize: 13, lineHeight: 18, marginBottom: 10, marginHorizontal: 8 },
  payButton: { height: 58, borderRadius: 4, backgroundColor: "#ededed", alignItems: "center", justifyContent: "center" },
  payButtonDisabled: { backgroundColor: PAY_DISABLED },
  payText: { color: "#161616", fontSize: 16, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, marginBottom: 2 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#3a3a3a" },
  orText: { color: MUTED, fontSize: 12 },
  linkButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  linkText: { color: FG, fontSize: 15, fontWeight: "500" },
  linkWord: { fontWeight: "800", letterSpacing: 0.2 },
});
