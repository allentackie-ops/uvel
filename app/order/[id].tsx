import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { confirmOrderReturnSent, requestOrderResolution, useOrders, watchOrder, type FulfillmentStatus } from "../../lib/orders";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, type Colors } from "../../lib/theme";

export default function OrderDone() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orders = useOrders();
  const currentOrder = orders.find((order) => order.id === id);
  const [status, setStatus] = useState<"pending" | "paid" | "failed" | null>("pending");
  const [fulfillment, setFulfillment] = useState<FulfillmentStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    return watchOrder(id, (nextStatus, nextFulfillment) => {
      setStatus(nextStatus);
      setFulfillment(nextFulfillment || null);
    });
  }, [id]);

  const confirmed = status === "paid";
  const fulfillmentLabel = fulfillment === "processing" ? "Being prepared" : fulfillment === "packed" ? "Packed" : fulfillment === "shipped" ? "On the way" : fulfillment === "delivered" ? "Delivered" : fulfillment === "canceled" ? "Canceled" : fulfillment === "returned" ? "Returned" : "Awaiting fulfillment";
  const resolution = currentOrder?.resolution;
  const canCancel = confirmed && ["unfulfilled", "processing", "packed"].includes(fulfillment || "unfulfilled") && !resolution;
  const canReturn = confirmed && fulfillment === "delivered" && !resolution;
  const reasonOptions = [
    ["changed_mind", "Changed my mind"],
    ["wrong_size", "Wrong size"],
    ["not_as_described", "Not as described"],
    ["damaged", "Arrived damaged"],
    ["defective", "Item is defective"],
    ["late", "Arrived too late"],
    ["other", "Other"],
  ] as const;

  function chooseResolution(type: "cancellation" | "return") {
    Alert.alert(type === "return" ? "Request a return" : "Cancel this order", type === "return" ? "Choose the reason for your return request." : "Choose the reason for cancellation.", [
      ...reasonOptions.map(([reason, label]) => ({ text: label, onPress: () => void submitResolution(type, reason) })),
      { text: "Not now", style: "cancel" as const },
    ]);
  }

  async function submitResolution(type: "cancellation" | "return", reason: string) {
    if (!id || busy) return;
    setBusy(true);
    try {
      await requestOrderResolution(id, type, reason);
      Alert.alert("Request sent", type === "return" ? "The brand will review your return request." : "The brand will review your cancellation request.");
    } catch (error) {
      Alert.alert("Could not send request", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function markReturnSent() {
    if (!id || busy) return;
    setBusy(true);
    try {
      await confirmOrderReturnSent(id);
      Alert.alert("Return updated", "The brand has been told that your return is on its way.");
    } catch (error) {
      Alert.alert("Could not update return", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="light" />
      <Text style={styles.kicker}>ORDER</Text>
      <Text style={styles.title}>{confirmed ? (fulfillment === "delivered" ? "It arrived." : "You’re covered.") : "Payment submitted."}</Text>
      <Text style={styles.p}>
        {confirmed
          ? fulfillment === "shipped" ? "Your order is on the way. Tracking will appear here as soon as the seller adds it." : fulfillment === "delivered" ? "The seller marked this order delivered. Keep Uvel’s protection details available if you need help." : fulfillment === "canceled" ? "This order was canceled. Contact Uvel support if you need help with the refund." : `Payment is confirmed. Fulfillment status: ${fulfillmentLabel}.`
          : "We’re waiting for the payment provider to confirm this order. You can leave this screen; the order will update when confirmation arrives."}
      </Text>
      {confirmed ? <Text style={styles.status}>{fulfillmentLabel}</Text> : null}
      {currentOrder?.trackingNumber ? <Text style={styles.tracking}>{currentOrder.carrier ? `${currentOrder.carrier} · ` : ""}{currentOrder.trackingNumber}</Text> : null}
      {resolution ? <View style={styles.resolutionCard}><Text style={styles.resolutionK}>{resolution.type === "return" ? "RETURN" : "CANCELLATION"}</Text><Text style={styles.resolutionText}>{resolution.status === "requested" ? "Waiting for brand review" : resolution.status === "approved" ? "Approved" : resolution.status === "item_sent" ? "Return marked as sent" : resolution.status === "received" ? "Return received · refund processing" : resolution.status === "refunded" ? "Refund complete" : resolution.status === "rejected" ? "Request declined" : resolution.status.replace("_", " ")}</Text>{resolution.type === "return" && resolution.status === "approved" ? <Pressable disabled={busy} onPress={() => void markReturnSent()} style={[styles.actionBtn, busy && styles.actionBtnOff]}><Text style={styles.actionTxt}>{busy ? "Updating…" : "I sent the return"}</Text></Pressable> : null}</View> : null}
      {currentOrder?.refundStatus && currentOrder.refundStatus !== "none" ? <Text style={styles.refund}>Refund: {currentOrder.refundStatus === "succeeded" ? "Complete" : currentOrder.refundStatus === "failed" ? "Needs attention" : "Processing"}</Text> : null}
      {canCancel ? <Pressable disabled={busy} onPress={() => chooseResolution("cancellation")} style={[styles.secondaryBtn, busy && styles.actionBtnOff]}><Text style={styles.secondaryTxt}>Request cancellation</Text></Pressable> : null}
      {canReturn ? <Pressable disabled={busy} onPress={() => chooseResolution("return")} style={[styles.secondaryBtn, busy && styles.actionBtnOff]}><Text style={styles.secondaryTxt}>Request a return</Text></Pressable> : null}
      <Text style={styles.id}>#{id}</Text>
      <Pressable onPress={() => router.replace("/(tabs)/shop")} style={styles.btn}>
        <Text style={styles.btnTxt}>Back to Shop</Text>
      </Pressable>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: 24 },
    kicker: { color: colors.subtle, letterSpacing: 2, fontSize: 11 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 36, marginTop: 12 },
    p: { color: colors.muted, marginTop: 14, lineHeight: 22, fontSize: 16 },
    status: { alignSelf: "flex-start", color: colors.pulseInk, backgroundColor: colors.pulse, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8, marginTop: 20, fontWeight: "800" },
    tracking: { color: colors.bone, marginTop: 12, fontSize: 14, fontWeight: "700" },
    resolutionCard: { marginTop: 18, padding: 14, borderRadius: 16, backgroundColor: "#24221C", borderWidth: 1, borderColor: "rgba(214,226,122,0.28)" },
    resolutionK: { color: colors.pulse, fontSize: 10, letterSpacing: 1.4, fontWeight: "800" },
    resolutionText: { color: colors.bone, fontSize: 14, fontWeight: "700", marginTop: 6, textTransform: "capitalize" },
    actionBtn: { marginTop: 12, height: 42, borderRadius: 21, backgroundColor: colors.pulse, alignItems: "center", justifyContent: "center" },
    actionBtnOff: { opacity: 0.5 },
    actionTxt: { color: colors.pulseInk, fontWeight: "800" },
    refund: { color: colors.muted, marginTop: 10, fontSize: 13 },
    secondaryBtn: { marginTop: 18, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.pulse, alignItems: "center", justifyContent: "center" },
    secondaryTxt: { color: colors.pulse, fontWeight: "800", fontSize: 15 },
    id: { color: colors.subtle, marginTop: 18, fontSize: 13 },
    btn: {
      marginTop: 36,
      height: 52,
      borderRadius: 26,
      backgroundColor: "#D6E27A",
      alignItems: "center",
      justifyContent: "center",
    },
    btnTxt: { color: "#16140F", fontWeight: "700", fontSize: 16 },
  });
}
