import { useEffect, type ReactNode } from "react";
import { Modal, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "./AccessiblePressable";

export function Sheet({
  open,
  onClose,
  expandable = false,
  surfaceColor,
  children,
}: {
  open: boolean;
  onClose: () => void;
  expandable?: boolean;
  surfaceColor?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const maxHeight = Math.max(360, windowHeight - insets.top - 8);
  const expandedOffset = 0;
  const collapsedOffset = expandable ? Math.min(maxHeight * 0.42, 420) : 0;
  const y = useSharedValue(expandable ? collapsedOffset : 420);
  const shown = useSharedValue(0);
  const gestureStart = useSharedValue(0);

  useEffect(() => {
    if (open) {
      shown.value = withTiming(1, { duration: 180 });
      y.value = withSpring(expandable ? collapsedOffset : 0, { damping: 28, stiffness: 240, mass: 0.9 });
    } else {
      shown.value = withTiming(0, { duration: 160 });
      y.value = withTiming(expandable ? maxHeight : 420, { duration: 180 });
    }
  }, [collapsedOffset, expandable, maxHeight, open, shown, y]);

  const pan = Gesture.Pan()
    .onStart(() => {
      gestureStart.value = y.value;
    })
    .onUpdate((e) => {
      if (expandable) {
        y.value = Math.max(expandedOffset, Math.min(maxHeight, gestureStart.value + e.translationY));
      } else if (e.translationY > 0) {
        y.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (!expandable) {
        if (e.translationY > 110 || e.velocityY > 900) {
          y.value = withTiming(480, { duration: 160 });
          shown.value = withTiming(0, { duration: 160 });
          runOnJS(onClose)();
        } else {
          y.value = withSpring(0, { damping: 28, stiffness: 240 });
        }
        return;
      }
      if (y.value > collapsedOffset + 100 || e.velocityY > 1100) {
        y.value = withTiming(maxHeight, { duration: 180 });
        shown.value = withTiming(0, { duration: 160 });
        runOnJS(onClose)();
      } else if (y.value < (collapsedOffset + expandedOffset) / 2 || e.velocityY < -650) {
        y.value = withSpring(expandedOffset, { damping: 28, stiffness: 240 });
      } else {
        y.value = withSpring(collapsedOffset, { damping: 28, stiffness: 240 });
      }
    });

  const veil = useAnimatedStyle(() => ({ opacity: shown.value * 0.28 }));
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  if (!open) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
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
            style={[styles.sheet, surfaceColor && { backgroundColor: surfaceColor }, expandable && { height: maxHeight }, { paddingBottom: insets.bottom + 16 }, sheet]}
          accessibilityViewIsModal
        >
          <View style={styles.grip} />
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
    </Modal>
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
