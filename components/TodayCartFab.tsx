import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../lib/cart";
import { useColors } from "../lib/theme";

export function TodayCartFab({ lifted = false }: { lifted?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const scale = useSharedValue(cart.count ? 1 : 0);
  const bounce = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(cart.count ? 1 : 0, { damping: 16, stiffness: 260, mass: 0.7 });
    if (cart.count) bounce.value = withSpring(1.08, { damping: 8, stiffness: 320 }, () => {
      bounce.value = withSpring(1, { damping: 12, stiffness: 240 });
    });
  }, [bounce, cart.count, scale]);

  const anim = useAnimatedStyle(() => ({
    opacity: scale.value,
    transform: [{ scale: scale.value * bounce.value }],
  }));

  if (!cart.count) return null;

  const tabClearance = 64 + Math.max(insets.bottom, 8);
  const bottom = tabClearance + (lifted ? 72 : 14);

  function openCart() {
    const latest = cart.items[0];
    if (!latest) return;
    if (cart.count === 1) {
      router.push({ pathname: "/checkout/[id]", params: { id: latest.pieceId } });
      return;
    }
    router.push("/cart");
  }

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { bottom }, anim]}>
      <Pressable
        onPress={openCart}
        style={[styles.fab, { backgroundColor: colors.bone }]}
        accessibilityRole="button"
        accessibilityLabel={`Cart, ${cart.count} ${cart.count === 1 ? "item" : "items"}`}
        accessibilityHint="Double tap to check out."
      >
        <Ionicons name="cart" size={26} color={colors.ink} />
        <View style={[styles.badge, { backgroundColor: colors.success }]}>
          <Text style={[styles.badgeText, { color: colors.successInk }]}>{cart.count > 9 ? "9+" : cart.count}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 16, zIndex: 140, elevation: 140 },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
