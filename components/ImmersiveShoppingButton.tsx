import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useColors } from "../lib/theme";

export function ImmersiveShoppingButton({ onPress, onHintVisibilityChange }: { onPress: () => void; onHintVisibilityChange?: (visible: boolean, dismiss?: () => void) => void }) {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => make(colors.success, screenWidth), [colors.success, screenWidth]);
  const [hintVisible, setHintVisible] = useState(false);
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const hintOffset = useRef(new Animated.Value(-5)).current;

  useEffect(() => {
    const revealDelay = 9_000 + Math.floor(Math.random() * 14_000);
    const revealTimer = setTimeout(() => {
      setHintVisible(true);
      onHintVisibilityChange?.(true, dismissHint);
      Animated.parallel([
        Animated.timing(hintOpacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(hintOffset, { toValue: 0, duration: 650, useNativeDriver: true }),
      ]).start();
    }, revealDelay);
    const dismissTimer = setTimeout(() => {
      Animated.timing(hintOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(({ finished }) => {
        if (finished) {
          setHintVisible(false);
          onHintVisibilityChange?.(false);
        }
      });
    }, revealDelay + 10_000);
    return () => {
      clearTimeout(revealTimer);
      clearTimeout(dismissTimer);
      hintOpacity.stopAnimation();
      hintOffset.stopAnimation();
      onHintVisibilityChange?.(false);
    };
  }, [hintOffset, hintOpacity, onHintVisibilityChange]);

  function dismissHint() {
    Animated.timing(hintOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
      if (finished) {
        setHintVisible(false);
        onHintVisibilityChange?.(false);
      }
    });
  }

  return (
    <View style={styles.anchor}>
      <Pressable
        onPress={() => {
          if (hintVisible) dismissHint();
          onPress();
        }}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.72 }]}
        accessibilityRole="button"
        accessibilityLabel="Open Immersive Shopping"
        accessibilityHint="Open the endless shopping feed."
      >
        <View style={styles.wave}>
          <View style={[styles.bar, styles.short]} />
          <View style={[styles.bar, styles.tall]} />
          <View style={[styles.bar, styles.medium]} />
          <View style={[styles.bar, styles.tall]} />
        </View>
      </Pressable>
      {hintVisible ? (
        <Animated.View style={[styles.hint, { opacity: hintOpacity, transform: [{ translateY: hintOffset }] }] }>
          <Pressable onPress={dismissHint} accessibilityRole="button" accessibilityLabel="Dismiss immersive shopping tip">
            <Text style={styles.hintTitle}>Try immersive shopping</Text>
            <Text style={styles.hintBody}>A simple new way to shop.</Text>
          </Pressable>
          <View pointerEvents="none" style={styles.hintCaret} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function make(success: string, screenWidth: number) {
  const hintWidth = Math.min(240, Math.max(190, screenWidth - 24));
  return StyleSheet.create({
    anchor: { width: 38, height: 42, position: "relative", zIndex: 8 },
    button: { width: 38, height: 42, alignItems: "center", justifyContent: "center" },
    wave: { width: 25, height: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
    bar: { width: 3, borderRadius: 2, backgroundColor: success },
    short: { height: 10 },
    medium: { height: 16 },
    tall: { height: 22 },
    hint: {
      position: "absolute",
      top: 46,
      left: -34,
      width: hintWidth,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: "#F4F0E6",
      shadowColor: "#000",
      shadowOpacity: 0.28,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 8,
    },
    hintTitle: { color: "#171510", fontSize: 13, fontWeight: "800", textAlign: "center" },
    hintBody: { color: "#514D43", fontSize: 12, lineHeight: 16, marginTop: 3, textAlign: "center" },
    hintCaret: {
      position: "absolute",
      top: -6,
      left: 47,
      width: 12,
      height: 12,
      backgroundColor: "#F4F0E6",
      transform: [{ rotate: "45deg" }],
    },
  });
}
