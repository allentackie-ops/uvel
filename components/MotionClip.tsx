import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

export function MotionClip({
  uri,
  style,
  muted = true,
  playing = true,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  muted?: boolean;
  playing?: boolean;
}) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = muted;
    p.audioMixingMode = "mixWithOthers";
    if (playing) p.play();
  });

  useEffect(() => {
    player.loop = true;
    player.muted = muted;
    if (playing) player.play();
    else player.pause();
  }, [player, muted, playing]);

  return (
    <View style={[style, styles.clip]} pointerEvents="none">
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden", backgroundColor: "transparent" },
});
