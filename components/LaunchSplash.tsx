import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
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
        <Text style={styles.word}>uvel</Text>
      </View>
      <Text style={[styles.fitza, { marginBottom: Math.max(insets.bottom, 12) + 32 }]}>
        from Fitza
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: "#2A320E",
    alignItems: "center",
  },
  middle: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  word: {
    color: "#fff",
    fontFamily: "Georgia",
    fontSize: 56,
    letterSpacing: 8,
    paddingLeft: 8,
    fontWeight: "600",
    textAlign: "center",
  },
  fitza: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    letterSpacing: 1.6,
    fontWeight: "500",
    textAlign: "center",
  },
});
