import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useOrders, watchOrder, type FulfillmentStatus } from "../../lib/orders";
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

  useEffect(() => {
    if (!id) return;
    return watchOrder(id, (nextStatus, nextFulfillment) => {
      setStatus(nextStatus);
      setFulfillment(nextFulfillment || null);
    });
  }, [id]);

  const confirmed = status === "paid";
  const fulfillmentLabel = fulfillment === "processing" ? "Being prepared" : fulfillment === "packed" ? "Packed" : fulfillment === "shipped" ? "On the way" : fulfillment === "delivered" ? "Delivered" : fulfillment === "canceled" ? "Canceled" : fulfillment === "returned" ? "Returned" : "Awaiting fulfillment";

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
