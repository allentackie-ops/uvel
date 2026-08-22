import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { Dimensions, Image, StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const HOLD_MS = 1000;
const FADE_MS = 900;

export function LaunchSplash({
  onDone,
  ready,
}: {
  onDone: () => void;
  ready: boolean;
}) {
  const { width, height } = Dimensions.get("window");
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const started = useRef(false);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ready || started.current) return;
    const wait = Math.max(0, HOLD_MS - (Date.now() - mountedAt.current));
    const t = setTimeout(() => {
      started.current = true;
      opacity.value = withTiming(0, {
        duration: FADE_MS,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      });
      scale.value = withTiming(1.04, {
        duration: FADE_MS,
        easing: Easing.out(Easing.cubic),
      });
      setTimeout(onDone, FADE_MS + 40);
    }, wait);
    return () => clearTimeout(t);
  }, [ready, onDone, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="auto"
      style={[styles.root, { width, height }, style]}
    >
      <StatusBar style="light" />
      <Image
        source={require("../assets/splash.png")}
        style={{ width, height }}
        resizeMode="contain"
      />
    </Animated.View>
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
