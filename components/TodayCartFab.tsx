import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
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
const PAD = 12;
const POS_KEY = "uvel-today-cart-fab-pos";

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
  const dropping = useRef(false);
  const droppingSV = useSharedValue(0);
  const placed = useRef(false);
  const hadItems = useRef(false);
  const tabBar = 64 + Math.max(insets.bottom, 8);
  const trashBottom = tabBar + 18;
  const minX = PAD;
  const maxX = Math.max(PAD, width - PAD - FAB);
  const minY = insets.top + 8;
  const maxY = Math.max(minY, height - tabBar - PAD - FAB);
  const defaultX = width - 16 - FAB;
  const defaultY = height - (tabBar + (listingOpen ? 68 : 14)) - FAB;
  const posX = useSharedValue(defaultX);
  const posY = useSharedValue(defaultY);
  const startX = useSharedValue(defaultX);
  const startY = useSharedValue(defaultY);
  const minXSV = useSharedValue(minX);
  const maxXSV = useSharedValue(maxX);
  const minYSV = useSharedValue(minY);
  const maxYSV = useSharedValue(maxY);
  const winW = useSharedValue(width);
  const winH = useSharedValue(height);
  const tabBarSV = useSharedValue(tabBar);

  useEffect(() => {
    minXSV.value = minX;
    maxXSV.value = maxX;
    minYSV.value = minY;
    maxYSV.value = maxY;
    winW.value = width;
    winH.value = height;
    tabBarSV.value = tabBar;
  }, [height, maxX, maxXSV, maxY, maxYSV, minX, minXSV, minY, minYSV, tabBar, tabBarSV, width, winH, winW]);

  useEffect(() => {
    let live = true;
    void AsyncStorage.getItem(POS_KEY)
      .then((raw) => {
        if (!live) return;
        const saved = raw ? (JSON.parse(raw) as { x?: number; y?: number }) : null;
        if (typeof saved?.x === "number" && typeof saved?.y === "number") {
          posX.value = clamp(saved.x, minX, maxX);
          posY.value = clamp(saved.y, minY, maxY);
          placed.current = true;
        } else {
          posX.value = defaultX;
          posY.value = Math.min(defaultY, maxY);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [defaultX, defaultY, maxX, maxY, minX, minY, posX, posY]);

  useEffect(() => {
    if (placed.current || dropping.current) return;
    posX.value = defaultX;
    posY.value = Math.min(defaultY, maxY);
  }, [defaultX, defaultY, maxY, posX, posY]);

  useEffect(() => {
    if (dropping.current) return;
    scale.value = withSpring(cart.count ? 1 : 0, { damping: 16, stiffness: 260, mass: 0.7 });
    if (cart.count) {
      bump.value = withSequence(
        withSpring(1.12, { damping: 9, stiffness: 340 }),
        withSpring(1, { damping: 14, stiffness: 240 }),
      );
    } else {
      armed.value = 0;
      hovering.value = 0;
    }
  }, [armed, bump, cart.count, hovering, scale]);

  function openCart() {
    if (!cart.count || dropping.current) return;
    onBeforeOpen?.();
    router.push("/cart");
  }

  function armHaptic() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }

  function hoverHaptic(on: number) {
    if (on) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
  }

  function persistPos(x: number, y: number) {
    placed.current = true;
    void AsyncStorage.setItem(POS_KEY, JSON.stringify({ x, y })).catch(() => undefined);
  }

  function forgetPos() {
    placed.current = false;
    void AsyncStorage.removeItem(POS_KEY).catch(() => undefined);
    posX.value = defaultX;
    posY.value = Math.min(defaultY, maxY);
  }

  useEffect(() => {
    if (cart.count > 0) {
      hadItems.current = true;
      return;
    }
    if (!hadItems.current) return;
    hadItems.current = false;
    forgetPos();
  }, [cart.count]);

  function finishDrop() {
    dropping.current = true;
    droppingSV.value = 1;
    setTimeout(() => {
      clearCart();
      forgetPos();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      bump.value = 1;
      armed.value = 0;
      hovering.value = 0;
      droppingSV.value = 0;
      dropping.current = false;
    }, 220);
  }

  const tap = Gesture.Tap().maxDistance(8).onEnd(() => {
    runOnJS(openCart)();
  });

  const move = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      startX.value = posX.value;
      startY.value = posY.value;
    })
    .onUpdate((event) => {
      posX.value = startX.value + event.translationX;
      posY.value = startY.value + event.translationY;
    })
    .onEnd(() => {
      const x = Math.min(maxXSV.value, Math.max(minXSV.value, posX.value));
      const y = Math.min(maxYSV.value, Math.max(minYSV.value, posY.value));
      posX.value = withSpring(x, { damping: 18, stiffness: 280 });
      posY.value = withSpring(y, { damping: 18, stiffness: 280 });
      runOnJS(persistPos)(x, y);
    });

  const dragDelete = Gesture.Pan()
    .activateAfterLongPress(380)
    .onStart(() => {
      if (droppingSV.value) return;
      startX.value = posX.value;
      startY.value = posY.value;
      armed.value = withSpring(1, { damping: 16, stiffness: 260 });
      runOnJS(armHaptic)();
    })
    .onUpdate((event) => {
      if (droppingSV.value) return;
      posX.value = startX.value + event.translationX;
      posY.value = startY.value + event.translationY;
      const fabX = posX.value + FAB / 2;
      const fabY = posY.value + FAB / 2;
      const trashX = winW.value / 2;
      const trashY = winH.value - tabBarSV.value - 18 - TRASH / 2;
      const next = Math.hypot(fabX - trashX, fabY - trashY) < HIT ? 1 : 0;
      if (next !== hovering.value) {
        hovering.value = next;
        runOnJS(hoverHaptic)(next);
      }
    })
    .onEnd(() => {
      if (droppingSV.value) return;
      if (hovering.value) {
        droppingSV.value = 1;
        const trashX = winW.value / 2 - FAB / 2;
        const trashY = winH.value - tabBarSV.value - 18 - TRASH / 2 - FAB / 2;
        posX.value = withTiming(trashX, { duration: 160 });
        posY.value = withTiming(trashY, { duration: 160 });
        scale.value = withTiming(0, { duration: 180 });
        bump.value = 1;
        hovering.value = 1;
        armed.value = 1;
        runOnJS(finishDrop)();
        return;
      }
      const x = Math.min(maxXSV.value, Math.max(minXSV.value, posX.value));
      const y = Math.min(maxYSV.value, Math.max(minYSV.value, posY.value));
      posX.value = withSpring(x, { damping: 18, stiffness: 280 });
      posY.value = withSpring(y, { damping: 18, stiffness: 280 });
      armed.value = withTiming(0, { duration: 180 });
      hovering.value = 0;
      runOnJS(persistPos)(x, y);
    });

  const gesture = Gesture.Race(dragDelete, move, tap);

  const fabStyle = useAnimatedStyle(() => ({
    left: posX.value,
    top: posY.value,
    transform: [
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
          style={[styles.wrap, { backgroundColor: colors.bone }, fabStyle]}
          accessibilityRole="button"
          accessibilityLabel={cart.count ? `Cart, ${cart.count} ${cart.count === 1 ? "item" : "items"}` : "Cart"}
          accessibilityHint="Double tap to open your bag. Drag to move it. Touch and hold, then drag to the trash to empty it."
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
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
