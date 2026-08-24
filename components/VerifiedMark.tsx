import { StyleSheet, Text, View } from "react-native";

export function VerifiedMark({ size = 16 }: { size?: number }) {
  return (
    <View
      accessibilityLabel="Verified brand"
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={[styles.check, { fontSize: size * 0.62, lineHeight: size * 0.72 }]}>✓</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: "#0866FF",
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    color: "#FFFFFF",
    fontWeight: "800",
    marginTop: 0.5,
  },
});
