import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { alpha, useColors } from "../lib/theme";

export function Skeleton({
  width,
  height,
  radius = 10,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return <View accessibilityLabel="Loading" style={[styles.base, { width, height, borderRadius: radius, backgroundColor: alpha(colors.bone, 0.1) }, style]} />;
}

export const skeletonStyles = StyleSheet.create({
  rail: { flexDirection: "row", gap: 10 },
  column: { gap: 9 },
});

const styles = StyleSheet.create({
  base: {},
});
