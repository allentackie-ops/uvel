import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

const DEFAULT_SIZE = 58;
const SPIN_MS = 2400;
const ease = Easing.bezier(0.65, 0, 0.35, 1);

const DOTS = [
  { key: "tiktok", color: "#EE1D52", angle: 0, delay: 0 },
  { key: "instagram", color: "#E1306C", angle: 120, delay: 300 },
  { key: "snapchat", color: "#FFFC00", angle: 240, delay: 600 },
] as const;

function xy(deg: number, size: number, dot: number, radius: number) {
  const rad = (deg * Math.PI) / 180;
  const center = size / 2;
  return {
    left: center + radius * Math.cos(rad) - dot / 2,
    top: center + radius * Math.sin(rad) - dot / 2,
  };
}

function PulseDot({
  color,
  delay,
  left,
  top,
  size,
}: {
  color: string;
  delay: number;
  left: number;
  top: number;
  size: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const start = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [delay, pulse]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          left,
          top,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] }) }],
        },
      ]}
    />
  );
}

/** Keep a flag true for at least `ms` so the orbit can actually play. */
export function useMinHold(on: boolean, ms = 1100) {
  const [held, setHeld] = useState(on);
  const started = useRef(on ? Date.now() : 0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (on) {
      started.current = Date.now();
      setHeld(true);
    } else {
      const left = ms - (Date.now() - started.current);
      t = setTimeout(() => setHeld(false), Math.max(0, left));
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [on, ms]);
  return held;
}

export function OrbitLoader({
  label,
  caption,
  size = DEFAULT_SIZE,
}: {
  label?: string;
  caption?: string;
  size?: number;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const core = useRef(new Animated.Value(0)).current;
  const dot = Math.max(5, Math.round(size * 0.155));
  const radius = size * 0.37;
  const center = size / 2;
  const coreSize = Math.max(4, Math.round(size * 0.095));

  useEffect(() => {
    const rotate = Animated.loop(Animated.timing(spin, { toValue: 1, duration: SPIN_MS, easing: ease, useNativeDriver: true }));
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(core, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(core, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    rotate.start();
    glow.start();
    return () => {
      rotate.stop();
      glow.stop();
    };
  }, [core, spin]);

  return (
    <View style={[styles.wrap, !label && !caption ? styles.wrapTight : null]} accessibilityRole="progressbar">
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Animated.View style={[styles.orbit, { width: size, height: size, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }]}>
        <Animated.View style={[styles.core, { top: center - coreSize / 2, left: center - coreSize / 2, width: coreSize, height: coreSize, borderRadius: coreSize / 2, opacity: core.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]} />
        {DOTS.map((item) => {
          const point = xy(item.angle, size, dot, radius);
          return <PulseDot key={item.key} color={item.color} delay={item.delay} left={point.left} top={point.top} size={dot} />;
        })}
      </Animated.View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 16 },
  wrapTight: { gap: 0 },
  orbit: {},
  core: { position: "absolute", backgroundColor: "#F2EFEA" },
  dot: { position: "absolute" },
  label: { fontSize: 13, letterSpacing: 1.8, textTransform: "uppercase", color: "#8C8880" },
  caption: { fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: "#8C8880", opacity: 0.5 },
});
