import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

const SIZE = 84;
const DOT = 14;
const RADIUS = 32;
const CENTER = SIZE / 2;
const SPIN_MS = 2400;
const ease = Easing.bezier(0.65, 0, 0.35, 1);

const DOTS = [
  { key: "tiktok", color: "#EE1D52", angle: 0, delay: 0 },
  { key: "instagram", color: "#E1306C", angle: 120, delay: 300 },
  { key: "snapchat", color: "#FFFC00", angle: 240, delay: 600 },
] as const;

function xy(deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    left: CENTER + RADIUS * Math.cos(rad) - DOT / 2,
    top: CENTER + RADIUS * Math.sin(rad) - DOT / 2,
  };
}

function PulseDot({
  color,
  delay,
  left,
  top,
}: {
  color: string;
  delay: number;
  left: number;
  top: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
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
          backgroundColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] }) }],
        },
      ]}
    />
  );
}

export function OrbitLoader({
  label,
  caption,
}: {
  label?: string;
  caption?: string;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const core = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const rotate = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_MS,
        easing: ease,
        useNativeDriver: true,
      }),
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(core, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(core, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
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
    <View style={styles.wrap} accessibilityRole="progressbar">
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Animated.View
        style={[
          styles.orbit,
          { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] },
        ]}
      >
        <Animated.View
          style={[
            styles.core,
            {
              opacity: core.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            },
          ]}
        />
        {DOTS.map((d) => {
          const p = xy(d.angle);
          return <PulseDot key={d.key} color={d.color} delay={d.delay} left={p.left} top={p.top} />;
        })}
      </Animated.View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 36 },
  orbit: { width: SIZE, height: SIZE },
  core: {
    position: "absolute",
    top: CENTER - 4,
    left: CENTER - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F2EFEA",
  },
  dot: {
    position: "absolute",
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  label: {
    fontSize: 13,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#8C8880",
  },
  caption: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#8C8880",
    opacity: 0.5,
  },
});
