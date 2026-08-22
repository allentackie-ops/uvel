import { useVideoPlayer, VideoView } from "expo-video";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useUvel } from "../lib/store";

export default function Onboard() {
  const { completeOnboard } = useUvel();
  const player = useVideoPlayer(require("../assets/onboarding/tryon.mp4"), (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  function go() {
    void completeOnboard();
    router.replace("/");
  }

  return (
    <View style={styles.root}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <View style={styles.scrim} />
      <Pressable onPress={go} style={styles.skip} hitSlop={16}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
      <View style={styles.copy}>
        <Text style={styles.kicker}>TRY ON</Text>
        <Text style={styles.title}>See it on you{"\n"}before you buy.</Text>
        <Text style={styles.lede}>A look you love. On your body. Then you decide.</Text>
        <Pressable onPress={go} style={styles.cta}>
          <Text style={styles.ctaText}>Get started</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#2A320E" },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 340,
    backgroundColor: "rgba(42,50,14,0.78)",
  },
  skip: { position: "absolute", top: 62, right: 22, zIndex: 2 },
  skipText: { color: "rgba(255,255,255,0.7)", fontSize: 12, letterSpacing: 1 },
  copy: { position: "absolute", left: 22, right: 22, bottom: 48 },
  kicker: { color: "rgba(255,255,255,0.7)", fontSize: 11, letterSpacing: 2.4, marginBottom: 8 },
  title: { color: "#fff", fontFamily: "Georgia", fontSize: 34, lineHeight: 36 },
  lede: { color: "rgba(255,255,255,0.72)", fontSize: 15, lineHeight: 21, marginTop: 12, marginBottom: 22, maxWidth: 240 },
  cta: {
    height: 50,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#2A320E", fontSize: 15, fontWeight: "600" },
});
