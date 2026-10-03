import { useIsFocused } from "expo-router";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

const HERO_CLIP = require("../assets/lens/lens-hero-loop.mp4");
const HERO_POSTER = require("../assets/lens/lens-hero-poster.jpg");

export function LensHeroClip() {
  const isFocused = useIsFocused();
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const player = useVideoPlayer(HERO_CLIP, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.volume = 0;
    instance.audioMixingMode = "mixWithOthers";
  });

  useEffect(() => {
    player.loop = true;
    player.muted = true;
    player.volume = 0;
    if (isFocused) player.play();
    else player.pause();
  }, [isFocused, player]);

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
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFill, overflow: "hidden", backgroundColor: "#0B0A08" },
  waitingForFrame: { opacity: 0 },
});
