import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export function LaunchSplash({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
    const t = setTimeout(onDone, 1050);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <View style={styles.root} pointerEvents="auto">
      <Text style={styles.word}>uvel</Text>
      <Text style={[styles.fitza, { bottom: Math.max(insets.bottom, 16) + 28 }]}>from Fitza</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    backgroundColor: "#2A320E",
    alignItems: "center",
    justifyContent: "center",
  },
  word: {
    color: "#fff",
    fontFamily: "Georgia",
    fontSize: 56,
    letterSpacing: 7,
    paddingLeft: 7,
    fontWeight: "600",
  },
  fitza: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    letterSpacing: 1.4,
    fontWeight: "500",
  },
});
