import { GlassContainer, GlassView } from "expo-glass-effect";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";

export function Glass({
  children,
  style,
  effect = "regular",
  interactive,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  effect?: "regular" | "clear";
  interactive?: boolean;
}) {
  const { appearance } = useUvel();
  const colors = useColors();
  if (Platform.OS === "ios") {
    return (
      <GlassView
        glassEffectStyle={effect}
        isInteractive={interactive}
        colorScheme={appearance}
        style={style}
      >
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.fallback, { backgroundColor: appearance === "dark" ? "rgba(255,255,255,0.08)" : colors.surface, borderColor: appearance === "dark" ? "rgba(244,240,230,0.14)" : colors.subtle }, style]}>{children}</View>;
}

export { GlassContainer };

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22,20,15,0.12)",
  },
  fallbackDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(244,240,230,0.14)",
  },
});
