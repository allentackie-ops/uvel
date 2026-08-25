import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { watchOrder } from "../../lib/orders";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, type Colors } from "../../lib/theme";

export default function OrderDone() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [status, setStatus] = useState<"pending" | "paid" | "failed" | null>("pending");

  useEffect(() => {
    if (!id) return;
    return watchOrder(id, setStatus);
  }, [id]);

  const confirmed = status === "paid";

  return (
    <View style={[styles.page, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="light" />
      <Text style={styles.kicker}>ORDER</Text>
      <Text style={styles.title}>{confirmed ? "You’re covered." : "Payment submitted."}</Text>
      <Text style={styles.p}>
        {confirmed
          ? "Payment is confirmed. The seller has been told. We’ll share tracking once it ships. Uvel holds the order until it lands."
          : "We’re waiting for the payment provider to confirm this order. You can leave this screen; the order will update when confirmation arrives."}
      </Text>
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
