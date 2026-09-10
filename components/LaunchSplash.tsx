import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { Dimensions, Image, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const HOLD_MS = 220;
const FADE_MS = 280;

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
  const opacity = useSharedValue(1);

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
      opacity.value = withTiming(
        0,
        { duration: FADE_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onDone)();
        },
      );
    }, wait);
    return () => clearTimeout(t);
  }, [ready, onDone, opacity]);

  const fade = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View pointerEvents="auto" style={[styles.root, { width, height }, fade]}>
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
