import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { ImageBackground, StyleSheet, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const MIN_INTRO_MS = 800;
const REVEAL_MS = 460;
const EXIT_MS = 200;

export function LaunchSplash({
  onDone,
  ready,
}: {
  onDone: () => void;
  ready: boolean;
}) {
  const { width } = useWindowDimensions();
  const started = useRef(false);
  const mountedAt = useRef(Date.now());
  const reveal = useSharedValue(0.01);
  const markOpacity = useSharedValue(0);
  const scale = useSharedValue(0.985);
  const opacity = useSharedValue(1);
  const cardSize = Math.min(width * 0.7, 292);

  useEffect(() => {
    const hideTimer = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 20);

    reveal.value = withTiming(1, {
      duration: REVEAL_MS,
      easing: Easing.out(Easing.cubic),
    });
    markOpacity.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
    scale.value = withTiming(1, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });

    return () => clearTimeout(hideTimer);
  }, [markOpacity, reveal, scale]);

  useEffect(() => {
    if (!ready || started.current) return;
    const remaining = Math.max(0, MIN_INTRO_MS - (Date.now() - mountedAt.current));
    const timer = setTimeout(() => {
      started.current = true;
      opacity.value = withTiming(
        0,
        { duration: EXIT_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onDone)();
        },
      );
    }, remaining);
    return () => clearTimeout(timer);
  }, [ready, onDone, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const clip = useAnimatedStyle(() => {
    const visibleWidth = cardSize * reveal.value;
    return {
      width: visibleWidth,
      left: (cardSize - visibleWidth) / 2,
      opacity: markOpacity.value,
    };
  });
  const imagePosition = useAnimatedStyle(() => ({
    left: -((cardSize - cardSize * reveal.value) / 2),
  }));

  return (
    <Animated.View pointerEvents="auto" style={[styles.root, fade]}>
      <ImageBackground
        source={require("../assets/splash.png")}
        resizeMode="cover"
        style={styles.paper}
        imageStyle={styles.paperImage}
      >
        <StatusBar style="dark" />
        <Animated.View style={[styles.stage, { width: cardSize, height: cardSize }, scaleStyle]}>
          <Animated.View style={[styles.revealWindow, { height: cardSize }, clip]}>
            <Animated.Image
              source={require("../assets/icon.png")}
              resizeMode="cover"
              style={[styles.mark, { width: cardSize, height: cardSize }, imagePosition]}
              accessible={false}
            />
          </Animated.View>
        </Animated.View>
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 80,
    elevation: 80,
  },
  paper: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5EEE7",
  },
  paperImage: {
    width: "100%",
    height: "100%",
  },
  stage: {
    alignItems: "center",
    justifyContent: "center",
  },
  revealWindow: {
    position: "absolute",
    top: 0,
    overflow: "hidden",
    borderRadius: 2,
    shadowColor: "#4A2019",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  mark: {
    position: "absolute",
    top: 0,
  },
});
