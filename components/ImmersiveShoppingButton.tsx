import { Pressable, StyleSheet, View } from "react-native";
import { useMemo } from "react";
import { useColors } from "../lib/theme";

export function ImmersiveShoppingButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => make(colors.success), [colors.success]);
  return (
    <Pressable
      onPress={onPress}
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
  );
}

function make(success: string) {
  return StyleSheet.create({
    button: { width: 38, height: 42, alignItems: "center", justifyContent: "center" },
    wave: { width: 25, height: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
    bar: { width: 3, borderRadius: 2, backgroundColor: success },
    short: { height: 10 },
    medium: { height: 16 },
    tall: { height: 22 },
  });
}
