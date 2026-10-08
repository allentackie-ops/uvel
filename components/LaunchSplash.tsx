import * as SplashScreen from "expo-splash-screen";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";

const INTRO_VIDEO = require("../assets/launch/uvel-intro.mp4");
const INTRO_POSTER = require("../assets/launch/uvel-intro-poster.jpg");
const MIN_INTRO_MS = 800;
const EXIT_MS = 260;
const NATIVE_SPLASH_FALLBACK_MS = 1_200;
const PLAYBACK_FALLBACK_MS = 15_000;

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export function LaunchSplash({
  onDone,
  ready,
}: {
  onDone: () => void;
  ready: boolean;
}) {
  const player = useVideoPlayer(INTRO_VIDEO, (instance) => {
    instance.loop = false;
    instance.muted = true;
  });
  const started = useRef(false);
  const dismissed = useRef(false);
  const mountedAt = useRef(Date.now());
  const [videoHasFrame, setVideoHasFrame] = useState(false);
  const [playbackFinished, setPlaybackFinished] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const opacity = useSharedValue(1);

  const hideNativeSplash = useCallback(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  const startPlayback = useCallback(() => {
    if (started.current) return;
    started.current = true;
    player.play();
  }, [player]);

  const handleFirstFrame = useCallback(() => {
    setVideoHasFrame(true);
    hideNativeSplash();
  }, [hideNativeSplash]);

  const handleDone = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    const statusSubscription = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") startPlayback();
      if (status === "error") {
        setPlaybackFailed(true);
        hideNativeSplash();
      }
    });
    const endSubscription = player.addListener("playToEnd", () => {
      setPlaybackFinished(true);
    });
    const initialStatus = player.status;
    if (initialStatus === "readyToPlay") startPlayback();
    if (initialStatus === "error") {
      setPlaybackFailed(true);
      hideNativeSplash();
    }

    const nativeSplashTimer = setTimeout(hideNativeSplash, NATIVE_SPLASH_FALLBACK_MS);
    const playbackTimer = setTimeout(() => {
      setPlaybackFailed(true);
      player.pause();
    }, PLAYBACK_FALLBACK_MS);

    return () => {
      statusSubscription.remove();
      endSubscription.remove();
      clearTimeout(nativeSplashTimer);
      clearTimeout(playbackTimer);
    };
  }, [hideNativeSplash, player, startPlayback]);

  useEffect(() => {
    if (!ready || (!playbackFinished && !playbackFailed) || dismissed.current) return;
    const remaining = Math.max(0, MIN_INTRO_MS - (Date.now() - mountedAt.current));
    const timer = setTimeout(() => {
      opacity.value = withTiming(
        0,
        { duration: EXIT_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(handleDone)();
        },
      );
    }, remaining);
    return () => clearTimeout(timer);
  }, [handleDone, opacity, playbackFailed, playbackFinished, ready]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="auto"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.root, fade]}
    >
      <StatusBar style="dark" />
      <View style={styles.stage}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          surfaceType="textureView"
          useExoShutter={false}
          onFirstFrameRender={handleFirstFrame}
        />
        {!videoHasFrame ? (
          <Image
            source={INTRO_POSTER}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            onLoad={hideNativeSplash}
            accessibilityLabel="Uvel crimson woven logo"
          />
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 80,
    elevation: 80,
    backgroundColor: "#F5EEE7",
  },
  stage: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#F5EEE7",
    overflow: "hidden",
  },
});
