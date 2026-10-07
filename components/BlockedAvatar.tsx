import { StyleSheet, Text, View } from "react-native";

export function BlockedAvatar({
  initial,
  size = 54,
  backgroundColor = "#252525",
  textColor = "#F4F0E6",
  slashColor = "#E24B4B",
}: {
  initial: string;
  size?: number;
  backgroundColor?: string;
  textColor?: string;
  slashColor?: string;
}) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
      ]}
      accessibilityRole="image"
      accessibilityLabel={`Blocked contact ${initial || ""}`}
    >
      <Text style={[styles.initial, { color: textColor, fontSize: size * 0.34 }]} numberOfLines={1}>
        {(initial || "U").slice(0, 1).toUpperCase()}
      </Text>
      <View
        style={[
          styles.slash,
          { width: size * 0.92, height: Math.max(2, size * 0.045), borderRadius: size * 0.03, backgroundColor: slashColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initial: { fontWeight: "900", lineHeight: undefined },
  slash: { position: "absolute", transform: [{ rotate: "-48deg" }] },
});
