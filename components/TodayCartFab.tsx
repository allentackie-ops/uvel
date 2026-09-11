import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../lib/cart";
import { useColors } from "../lib/theme";

export function TodayCartFab({
  listingOpen,
  onBeforeOpen,
}: {
  listingOpen?: boolean;
  onBeforeOpen?: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const scale = useSharedValue(cart.count ? 1 : 0);
  const bump = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(cart.count ? 1 : 0, { damping: 16, stiffness: 260, mass: 0.7 });
    if (cart.count) {
      bump.value = withSequence(
        withSpring(1.12, { damping: 9, stiffness: 340 }),
        withSpring(1, { damping: 14, stiffness: 240 }),
      );
    }
  }, [bump, cart.count, scale]);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * bump.value }],
    opacity: scale.value,
  }));

  const tabBar = 64 + Math.max(insets.bottom, 8);
  const bottom = tabBar + (listingOpen ? 68 : 14);

  function openCart() {
    if (!cart.count) return;
    onBeforeOpen?.();
    router.push("/cart");
  }

  return (
    <Animated.View
      pointerEvents={cart.count ? "auto" : "none"}
      style={[styles.wrap, { bottom, backgroundColor: colors.bone }, fabStyle]}
    >
      <Pressable
        onPress={openCart}
        style={styles.hit}
        accessibilityRole="button"
        accessibilityLabel={cart.count ? `Cart, ${cart.count} ${cart.count === 1 ? "item" : "items"}` : "Cart"}
        accessibilityHint="Double tap to check out the pieces in your cart."
      >
        <Ionicons name="cart" size={26} color={colors.ink} />
        {cart.count ? (
          <View style={[styles.badge, { backgroundColor: colors.success }]}>
            <Text style={[styles.badgeText, { color: colors.successInk }]}>{cart.count > 9 ? "9+" : String(cart.count)}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    zIndex: 140,
    elevation: 140,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  hit: { flex: 1, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
