import { useIsFocused } from "expo-router";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const HERO_CLIP = require("../assets/lens/lens-hero-loop.mp4");
const HERO_POSTER = require("../assets/lens/lens-hero-poster.jpg");
const GALLERY_THUMBS = [
  HERO_POSTER,
  require("../assets/catalog/silk-slip.jpg"),
  require("../assets/catalog/leather-trench.jpg"),
  require("../assets/catalog/poet-blouse.jpg"),
] as const;
const MATCH_THUMBS = [
  require("../assets/catalog/silk-slip.jpg"),
  require("../assets/catalog/satin-skirt.jpg"),
  require("../assets/catalog/poet-blouse.jpg"),
] as const;

export function LensHeroClip({ height, topInset }: { height: number; topInset: number }) {
  const isFocused = useIsFocused();
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const progress = useSharedValue(0);
  const cropTop = Math.max(height * 0.28, topInset + 54);
  const cropHeight = Math.max(72, Math.min(height * 0.72, height - cropTop - 18));
  const player = useVideoPlayer(HERO_CLIP, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.volume = 0;
    instance.audioMixingMode = "mixWithOthers";
  });

  useEffect(() => {
    cancelAnimation(progress);
    if (!isFocused) {
      player.pause();
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false);
    player.play();
    return () => cancelAnimation(progress);
  }, [isFocused, player, progress]);

  const cropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.17, 0.24, 0.7, 0.78, 1], [0, 0, 1, 1, 0, 0], Extrapolation.CLAMP),
  }));
  const scanStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.23, 0.28, 0.68, 0.75, 1], [0, 0, 1, 1, 0, 0], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(progress.value, [0, 0.28, 0.7, 0.75, 1], [0, 0, Math.max(0, cropHeight - 3), Math.max(0, cropHeight - 3), 0], Extrapolation.CLAMP),
    }],
  }));
  const galleryStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.19, 0.92, 0.98, 1], [1, 1, 0, 0, 1, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0, 0.12, 0.2, 0.92, 0.98, 1], [0, 0, 14, 14, 0, 0], Extrapolation.CLAMP) }],
  }));
  const matchesStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.78, 0.84, 0.9, 0.96, 1], [0, 0, 1, 1, 0, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0, 0.78, 0.84, 0.9, 0.96, 1], [14, 14, 0, 0, 14, 14], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.clip} pointerEvents="none">
      <Image source={HERO_POSTER} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      <VideoView
        player={player}
        style={[StyleSheet.absoluteFill, !firstFrameReady && styles.waitingForFrame]}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
        onFirstFrameRender={() => setFirstFrameReady(true)}
      />
      <View style={styles.tint} />

      <Animated.View style={[styles.cropFrame, { top: cropTop, height: cropHeight }, cropStyle]}>
        <View style={styles.cropCornerTL} />
        <View style={styles.cropCornerTR} />
        <View style={styles.cropCornerBL} />
        <View style={styles.cropCornerBR} />
        {/* The beam lives inside this clipped frame, so it cannot scan outside the crop. */}
        <Animated.View style={[styles.scanBeam, scanStyle]} />
      </Animated.View>

      <Animated.View style={[styles.galleryPanel, galleryStyle]}>
        <Text style={styles.panelLabel}>Recents</Text>
        <View style={styles.thumbRow}>
          {GALLERY_THUMBS.map((source, index) => (
            <View key={index} style={[styles.thumb, index === 0 && styles.thumbSelected]}>
              <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View style={[styles.resultsPanel, matchesStyle]}>
        <Text style={styles.panelLabel}>Similar</Text>
        <View style={styles.thumbRow}>
          {MATCH_THUMBS.map((source, index) => (
            <View key={index} style={styles.matchThumb}>
              <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const LIME = "#B8EC55";
const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFill, overflow: "hidden", backgroundColor: "#0B0A08" },
  waitingForFrame: { opacity: 0 },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(11,10,8,0.08)" },
  cropFrame: {
    position: "absolute",
    left: "18%",
    width: "64%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(184,236,85,0.58)",
    borderRadius: 12,
    backgroundColor: "rgba(184,236,85,0.025)",
  },
  cropCornerTL: { position: "absolute", top: 0, left: 0, width: 18, height: 18, borderTopWidth: 3, borderLeftWidth: 3, borderColor: LIME, borderTopLeftRadius: 9 },
  cropCornerTR: { position: "absolute", top: 0, right: 0, width: 18, height: 18, borderTopWidth: 3, borderRightWidth: 3, borderColor: LIME, borderTopRightRadius: 9 },
  cropCornerBL: { position: "absolute", bottom: 0, left: 0, width: 18, height: 18, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: LIME, borderBottomLeftRadius: 9 },
  cropCornerBR: { position: "absolute", bottom: 0, right: 0, width: 18, height: 18, borderBottomWidth: 3, borderRightWidth: 3, borderColor: LIME, borderBottomRightRadius: 9 },
  scanBeam: { position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: LIME, shadowColor: LIME, shadowOpacity: 0.95, shadowRadius: 8, elevation: 3 },
  galleryPanel: { position: "absolute", left: 18, right: 18, bottom: 12, minHeight: 68, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(11,10,8,0.82)" },
  resultsPanel: { position: "absolute", left: 18, right: 18, bottom: 12, minHeight: 68, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(11,10,8,0.86)" },
  panelLabel: { width: 48, color: "rgba(255,255,255,0.88)", fontSize: 11, fontWeight: "600" },
  thumbRow: { flex: 1, flexDirection: "row", justifyContent: "space-between", gap: 7 },
  thumb: { width: 42, height: 48, borderRadius: 7, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  thumbSelected: { borderWidth: 2, borderColor: LIME },
  matchThumb: { width: 50, height: 48, borderRadius: 7, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
});
