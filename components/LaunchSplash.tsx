import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { Dimensions, Image, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const HOLD_MS = 220;

export function LaunchSplash({
  onDone,
  ready,
}: {
  onDone: () => void;
  ready: boolean;
}) {
  const { width, height } = Dimensions.get("window");
  const started = useRef(false);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    const t = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready || started.current) return;
    const wait = Math.max(0, HOLD_MS - (Date.now() - mountedAt.current));
    const t = setTimeout(() => {
      started.current = true;
      onDone();
    }, wait);
    return () => clearTimeout(t);
  }, [ready, onDone]);

  return (
    <View pointerEvents="auto" style={[styles.root, { width, height }]}>
      <StatusBar style="light" />
      <Image
        source={require("../assets/splash.png")}
        style={{ width, height }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#2A320E",
    zIndex: 80,
    elevation: 80,
  },
});
