import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Dimensions, Image, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export function LaunchSplash({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get("window");

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <View style={[styles.root, { width, height }]}>
      <View style={styles.middle}>
        <Image source={require("../assets/splash-icon.png")} style={styles.mark} />
      </View>
      <Text style={[styles.fitza, { marginBottom: Math.max(insets.bottom, 12) + 32 }]}>
        from Fitza
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#2A320E", alignItems: "center" },
  middle: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" },
  mark: { width: 200, height: 200 },
  fitza: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    letterSpacing: 1.6,
    fontWeight: "500",
    textAlign: "center",
  },
});
