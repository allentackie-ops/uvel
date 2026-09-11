import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { clearCart, useCart } from "../lib/cart";
import { useColors } from "../lib/theme";

const FAB = 58;
const TRASH = 68;
const HIT = 56;

export function TodayCartFab({
  listingOpen,
  onBeforeOpen,
}: {
  listingOpen?: boolean;
  onBeforeOpen?: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cart = useCart();
  const scale = useSharedValue(cart.count ? 1 : 0);
  const bump = useSharedValue(1);
  const armed = useSharedValue(0);
  const hovering = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const tabBar = 64 + Math.max(insets.bottom, 8);
  const fabBottom = tabBar + (listingOpen ? 68 : 14);
  const trashBottom = tabBar + 18;
  const winW = useSharedValue(width);
  const winH = useSharedValue(height);
  const fabBottomSV = useSharedValue(fabBottom);
  const tabBarSV = useSharedValue(tabBar);

  useEffect(() => {
    winW.value = width;
    winH.value = height;
    fabBottomSV.value = fabBottom;
    tabBarSV.value = tabBar;
  }, [fabBottom, fabBottomSV, height, tabBar, tabBarSV, width, winH, winW]);

  useEffect(() => {
    scale.value = withSpring(cart.count ? 1 : 0, { damping: 16, stiffness: 260, mass: 0.7 });
    if (cart.count) {
      bump.value = withSequence(
        withSpring(1.12, { damping: 9, stiffness: 340 }),
        withSpring(1, { damping: 14, stiffness: 240 }),
      );
    } else {
      tx.value = 0;
      ty.value = 0;
      armed.value = 0;
      hovering.value = 0;
    }
  }, [armed, bump, cart.count, hovering, scale, tx, ty]);

  function openCart() {
    if (!cart.count) return;
    onBeforeOpen?.();
    router.push("/cart");
  }

  function armHaptic() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }

  function hoverHaptic(on: number) {
    if (on) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
  }

  function emptyBag() {
    clearCart();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }

  function resetDrag() {
    tx.value = withSpring(0, { damping: 18, stiffness: 280 });
    ty.value = withSpring(0, { damping: 18, stiffness: 280 });
    armed.value = withTiming(0, { duration: 180 });
    hovering.value = 0;
  }

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(openCart)();
  });

  const drag = Gesture.Pan()
    .activateAfterLongPress(380)
    .onStart(() => {
      armed.value = withSpring(1, { damping: 16, stiffness: 260 });
      runOnJS(armHaptic)();
    })
    .onUpdate((event) => {
      tx.value = event.translationX;
      ty.value = event.translationY;
      const fabX = winW.value - 16 - FAB / 2 + tx.value;
      const fabY = winH.value - fabBottomSV.value - FAB / 2 + ty.value;
      const trashX = winW.value / 2;
      const trashY = winH.value - tabBarSV.value - 18 - TRASH / 2;
      const next = Math.hypot(fabX - trashX, fabY - trashY) < HIT ? 1 : 0;
      if (next !== hovering.value) {
        hovering.value = next;
        runOnJS(hoverHaptic)(next);
      }
    })
    .onEnd(() => {
      if (hovering.value) {
        tx.value = 0;
        ty.value = 0;
        armed.value = 0;
        hovering.value = 0;
        runOnJS(emptyBag)();
        return;
      }
      runOnJS(resetDrag)();
    });

  const gesture = Gesture.Exclusive(drag, tap);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value * bump.value * (1 + armed.value * 0.08) * (hovering.value ? 0.86 : 1) },
    ],
    opacity: scale.value,
  }));

  const trashStyle = useAnimatedStyle(() => ({
    opacity: armed.value,
    transform: [{ scale: 0.72 + armed.value * 0.28 + hovering.value * 0.14 }],
    backgroundColor: interpolateColor(hovering.value, [0, 1], [colors.surface, colors.danger]),
  }));

  const idleIcon = useAnimatedStyle(() => ({ opacity: 1 - hovering.value }));
  const hotIcon = useAnimatedStyle(() => ({ opacity: hovering.value, position: "absolute" as const }));

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[styles.trash, { bottom: trashBottom, left: (width - TRASH) / 2 }, trashStyle]}>
        <Animated.View style={idleIcon}>
          <Ionicons name="trash" size={26} color={colors.danger} />
        </Animated.View>
        <Animated.View style={hotIcon}>
          <Ionicons name="trash" size={26} color={colors.dangerInk} />
        </Animated.View>
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View
          pointerEvents={cart.count ? "auto" : "none"}
          style={[styles.wrap, { bottom: fabBottom, backgroundColor: colors.bone }, fabStyle]}
          accessibilityRole="button"
          accessibilityLabel={cart.count ? `Cart, ${cart.count} ${cart.count === 1 ? "item" : "items"}` : "Cart"}
          accessibilityHint="Double tap to open your bag. Touch and hold, then drag to the trash to empty it."
        >
          <View style={styles.hit}>
            <Ionicons name="cart" size={26} color={colors.ink} />
            {cart.count ? (
              <View style={[styles.badge, { backgroundColor: colors.success }]}>
                <Text style={[styles.badgeText, { color: colors.successInk }]}>{cart.count > 9 ? "9+" : String(cart.count)}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 16,
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
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
  trash: {
    position: "absolute",
    width: TRASH,
    height: TRASH,
    borderRadius: TRASH / 2,
    zIndex: 139,
    elevation: 139,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
