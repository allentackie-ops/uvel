import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Dimensions, Image, StyleSheet, View } from "react-native";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export function LaunchSplash({ onDone }: { onDone: () => void }) {
  const { width, height } = Dimensions.get("window");

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <View style={[styles.root, { width, height }]}>
      <Image
        source={require("../assets/splash.png")}
        style={{ width, height }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#2A320E" },
});
