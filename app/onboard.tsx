import { useVideoPlayer, VideoView } from "expo-video";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUvel } from "../lib/store";

export default function Onboard() {
  const { completeOnboard } = useUvel();
  const insets = useSafeAreaInsets();
  const lastTime = useRef(0);
  const player = useVideoPlayer(require("../assets/onboarding/tryon.mp4"), (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const tick = setInterval(() => {
      lastTime.current = player.currentTime;
    }, 250);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        try {
          if (lastTime.current > 0.05) player.currentTime = lastTime.current;
          player.play();
        } catch {
          /* player may still be attaching */
        }
      } else {
        lastTime.current = player.currentTime;
      }
    });
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [player]);

  function go() {
    void completeOnboard();
    router.replace("/");
  }

  return (
    <View style={styles.root}>
      <View style={{ height: insets.top, backgroundColor: "#2A320E" }} />
      <View style={styles.film}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
        <Pressable onPress={go} style={styles.skip} hitSlop={16}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
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
  film: {
    width: "100%",
    aspectRatio: 3 / 4,
    maxHeight: "62%",
    backgroundColor: "#2A320E",
    overflow: "hidden",
  },
  skip: { position: "absolute", top: 14, right: 16, zIndex: 2 },
  skipText: { color: "rgba(255,255,255,0.78)", fontSize: 13, letterSpacing: 0.6 },
  panel: {
    flex: 1,
    backgroundColor: "#2A320E",
    paddingHorizontal: 22,
    paddingTop: 22,
    justifyContent: "flex-end",
  },
  kicker: { color: "rgba(255,255,255,0.7)", fontSize: 11, letterSpacing: 2.4, marginBottom: 8 },
  title: { color: "#fff", fontFamily: "Georgia", fontSize: 32, lineHeight: 34 },
  lede: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 20,
    maxWidth: 260,
  },
  cta: {
    height: 50,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#2A320E", fontSize: 15, fontWeight: "600" },
});
