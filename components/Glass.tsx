import { GlassContainer, GlassView } from "expo-glass-effect";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { useUvel } from "../lib/store";
import { alpha, useColors, type Colors } from "../lib/theme";

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
  const styles = make(colors);
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
  return <View style={[styles.fallback, appearance === "dark" && styles.fallbackDark, style]}>{children}</View>;
}

export { GlassContainer };

function make(colors: Colors) {
  return StyleSheet.create({
  fallback: {
    backgroundColor: alpha(colors.surface, 0.55),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(colors.bone, 0.12),
  },
  fallbackDark: {
    backgroundColor: alpha(colors.bone, 0.08),
    borderColor: alpha(colors.bone, 0.14),
  },
  });
}
