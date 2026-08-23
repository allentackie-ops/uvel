import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";

const MARK = require("../assets/icon.png");


export function useBrandGate(ms = 480) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return on;
}

export function BrandMark({ size = 86 }: { size?: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        transform: [{ scale: pulse }],
      }}
    >
      <Image source={MARK} style={{ width: size, height: size }} />
    </Animated.View>
  );
}

export function BrandLoader({
  fill = true,
}: {
  fill?: boolean;
}) {
  if (!fill) return <BrandMark />;
  return (
    <View pointerEvents="auto" style={styles.full}>
      <StatusBar style="light" />
      <BrandMark />
    </View>
  );
}

export function BrandScreen() {
  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <BrandMark />
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0B0A08",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    elevation: 200,
  },
  page: {
    flex: 1,
    backgroundColor: "#0B0A08",
    alignItems: "center",
    justifyContent: "center",
  },
});
