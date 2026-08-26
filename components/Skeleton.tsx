import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

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
  return <View accessibilityLabel="Loading" style={[styles.base, { width, height, borderRadius: radius }, style]} />;
}

export const skeletonStyles = StyleSheet.create({
  rail: { flexDirection: "row", gap: 10 },
  column: { gap: 9 },
});

const styles = StyleSheet.create({
  base: {
    backgroundColor: "rgba(244,240,230,0.12)",
  },
});
