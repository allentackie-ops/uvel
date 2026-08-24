import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

function LoopVideo({ uri, style }: { uri: string; style: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = "mixWithOthers";
    p.play();
  });

  useEffect(() => {
    player.loop = true;
    player.muted = true;
    player.play();
  }, [player]);

  return (
    <View style={[style, { overflow: "hidden" }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
    </View>
  );
}

export function BrandBanner({
  uri,
  kind,
  style,
}: {
  uri?: string;
  kind?: "image" | "video";
  style: StyleProp<ViewStyle>;
}) {
  if (kind === "video" && uri) return <LoopVideo uri={uri} style={style} />;
  if (uri) return <Image source={{ uri }} style={style} contentFit="cover" />;
  return <View style={[style, styles.fallback]} />;
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: "#161512" },
});
