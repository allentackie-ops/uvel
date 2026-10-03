import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../lib/theme";

export function TodayMessagesButton({
  onPress,
  unread,
  onHintVisibilityChange,
}: {
  onPress: () => void;
  unread: number;
  onHintVisibilityChange?: (visible: boolean, dismiss?: () => void) => void;
}) {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => make(colors.bone, colors.success, screenWidth), [colors.bone, colors.success, screenWidth]);
  const iconColor = colors.bone;
  const [hintVisible, setHintVisible] = useState(false);
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const hintOffset = useRef(new Animated.Value(-5)).current;

  useEffect(() => {
    // Immersive Shopping is scheduled in the first 9–23 seconds and stays up
    // for 10 seconds. Start Messages later so the two tips never overlap.
    const revealDelay = 35_000 + Math.floor(Math.random() * 14_000);
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
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.84 }]}
        accessibilityRole="button"
        accessibilityLabel={`${unread ? `${unread} unread ` : ""}Messages`}
        accessibilityHint="Add friends, talk to sellers, and review your conversations."
      >
        <Ionicons name="chatbubble-ellipses-outline" size={24} color={iconColor} />
        {unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text></View> : null}
      </Pressable>
      {hintVisible ? (
        <Animated.View style={[styles.hint, { opacity: hintOpacity, transform: [{ translateY: hintOffset }] }]}>
          <Pressable onPress={dismissHint} accessibilityRole="button" accessibilityLabel="Dismiss messages tip">
            <Text style={styles.hintTitle}>Messages</Text>
            <Text style={styles.hintBody}>Add friends, talk to sellers, and review your conversations and purchases here.</Text>
          </Pressable>
          <View pointerEvents="none" style={styles.hintCaret} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function make(iconColor: string, accent: string, screenWidth: number) {
  const hintWidth = Math.min(240, Math.max(190, screenWidth - 24));
  // The anchor ends 22px inside the right edge. Keep the bubble 12px from
  // that edge while placing its caret over the icon center.
  const hintLeft = 54 - hintWidth;
  return StyleSheet.create({
    anchor: { width: 44, height: 44, position: "relative", zIndex: 8 },
    button: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    badge: { position: "absolute", right: -2, top: -3, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: accent, alignItems: "center", justifyContent: "center" },
    badgeText: { color: "#161512", fontSize: 9, fontWeight: "900" },
    hint: { position: "absolute", top: 48, left: hintLeft, width: hintWidth, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: "#F4F0E6", shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
    hintTitle: { color: "#171510", fontSize: 13, fontWeight: "800", textAlign: "center" },
    hintBody: { color: "#514D43", fontSize: 12, lineHeight: 16, marginTop: 3, textAlign: "center" },
    hintCaret: { position: "absolute", top: -6, left: hintWidth - 48, width: 12, height: 12, backgroundColor: "#F4F0E6", transform: [{ rotate: "45deg" }] },
  });
}
