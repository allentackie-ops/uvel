import { GlassContainer, GlassView } from "expo-glass-effect";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

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
  if (Platform.OS === "ios") {
    return (
      <GlassView
        glassEffectStyle={effect}
        isInteractive={interactive}
        colorScheme="light"
        style={style}
      >
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.fallback, style]}>{children}</View>;
}

export { GlassContainer };

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22,20,15,0.12)",
  },
});
