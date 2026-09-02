import { useEffect, type ReactNode } from "react";
import {  StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "./AccessiblePressable";
import { useColors } from "../lib/theme";
import { useUvel } from "../lib/store";

export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { appearance } = useUvel();
  const y = useSharedValue(420);
  const shown = useSharedValue(0);

  useEffect(() => {
    if (open) {
      shown.value = withTiming(1, { duration: 180 });
      y.value = withSpring(0, { damping: 28, stiffness: 240, mass: 0.9 });
    } else {
      shown.value = withTiming(0, { duration: 160 });
      y.value = withTiming(420, { duration: 180 });
    }
  }, [open, shown, y]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) y.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 900) {
        y.value = withTiming(480, { duration: 160 });
        shown.value = withTiming(0, { duration: 160 });
        runOnJS(onClose)();
      } else {
        y.value = withSpring(0, { damping: 28, stiffness: 240 });
      }
    });

  const veil = useAnimatedStyle(() => ({ opacity: shown.value * 0.28 }));
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  if (!open) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <AccessiblePressable        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close dialog"
        accessibilityHint="Double tap to dismiss this dialog."
      >
        <Animated.View style={[styles.veil, veil]} />
      </AccessiblePressable>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + 16, backgroundColor: colors.surface }, sheet]}
          accessibilityViewIsModal
        >
          <View style={[styles.grip, { backgroundColor: appearance === "dark" ? "rgba(244,240,230,0.28)" : colors.subtle }]} />
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  veil: { flex: 1, backgroundColor: "#000" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#1A1916",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  grip: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(244,240,230,0.28)",
    marginBottom: 14,
  },
});
