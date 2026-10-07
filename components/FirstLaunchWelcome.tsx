import { useFonts } from "expo-font";
import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { MARKET_RED, useResolvedAppearance } from "../lib/theme";

const GARMENTS = [
  {
    id: "blazer",
    source: require("../assets/onboarding/welcome/burgundy-blazer-mobile.png"),
    width: 0.7,
    top: 0.07,
    from: "left" as const,
    delay: 0,
    flutter: 5.4,
    startAngle: -10,
    endAngle: 9,
  },
  {
    id: "denim",
    source: require("../assets/onboarding/welcome/denim-shirt-mobile.png"),
    width: 0.66,
    top: 0.15,
    from: "right" as const,
    delay: 300,
    flutter: 7.2,
    startAngle: 9,
    endAngle: -8,
  },
  {
    id: "tee",
    source: require("../assets/onboarding/welcome/white-tee-mobile.png"),
    width: 0.57,
    top: 0.23,
    from: "left" as const,
    delay: 640,
    flutter: 9.5,
    startAngle: 8,
    endAngle: 11,
  },
  {
    id: "knit",
    source: require("../assets/onboarding/welcome/striped-knit-mobile.png"),
    width: 0.67,
    top: 0.29,
    from: "right" as const,
    delay: 980,
    flutter: 6.4,
    startAngle: -7,
    endAngle: 7,
  },
  {
    id: "bag",
    source: require("../assets/onboarding/welcome/leather-bag-mobile.png"),
    width: 0.45,
    top: 0.34,
    from: "bottom" as const,
    delay: 1_260,
    flutter: 4.2,
    startAngle: 7,
    endAngle: -10,
  },
];

type Direction = "left" | "right" | "bottom";
type GarmentProps = {
  source: number;
  containerStyle: StyleProp<ViewStyle>;
  imageStyle: StyleProp<ImageStyle>;
  width: number;
  height: number;
  top: number;
  screenWidth: number;
  from: Direction;
  delay: number;
  flutter: number;
  startAngle: number;
  endAngle: number;
  active: boolean;
};

function MovingGarment({
  source,
  containerStyle,
  imageStyle,
  width,
  height,
  top,
  screenWidth,
  from,
  delay,
  flutter,
  startAngle,
  endAngle,
  active,
}: GarmentProps) {
  const x = useSharedValue(from === "left" ? -screenWidth * 0.82 : from === "right" ? screenWidth * 0.82 : 0);
  const y = useSharedValue(from === "bottom" ? height * 0.9 : 0);
  const rotation = useSharedValue(startAngle);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.96);

  useEffect(() => {
    cancelAnimation(x);
    cancelAnimation(y);
    cancelAnimation(rotation);
    cancelAnimation(opacity);
    cancelAnimation(scale);
    if (!active) {
      opacity.value = 0;
      return;
    }

    const fromLeft = from === "left";
    const fromRight = from === "right";
    const passX = fromLeft ? screenWidth * 0.06 : fromRight ? -screenWidth * 0.06 : screenWidth * 0.12;
    const exitX = fromLeft ? screenWidth * 1.05 : fromRight ? -screenWidth * 1.05 : -screenWidth * 0.18;
    const entryY = from === "bottom" ? -height * 0.08 : 0;
    const driftY = from === "bottom" ? -height * 0.86 : -height * 0.055;

    x.value = from === "left" ? -screenWidth * 0.82 : from === "right" ? screenWidth * 0.82 : 0;
    y.value = from === "bottom" ? height * 0.9 : 0;
    rotation.value = startAngle;
    scale.value = 0.94;
    opacity.value = 0;

    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 230, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 1_260 }),
        withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) }),
      ),
    );
    x.value = withDelay(
      delay,
      withSequence(
        withTiming(passX, { duration: 720, easing: Easing.out(Easing.cubic) }),
        withTiming(passX * -0.48, { duration: 460, easing: Easing.inOut(Easing.sin) }),
        withTiming(exitX, { duration: 740, easing: Easing.in(Easing.cubic) }),
      ),
    );
    y.value = withDelay(
      delay,
      withSequence(
        withTiming(entryY, { duration: 680, easing: Easing.out(Easing.cubic) }),
        withTiming(driftY, { duration: 480, easing: Easing.inOut(Easing.sin) }),
        withTiming(from === "bottom" ? -height * 1.05 : height * 0.06, {
          duration: 760,
          easing: Easing.in(Easing.cubic),
        }),
      ),
    );
    rotation.value = withDelay(
      delay,
      withSequence(
        withTiming(startAngle + flutter, { duration: 420, easing: Easing.out(Easing.cubic) }),
        withTiming(startAngle - flutter * 0.68, { duration: 440, easing: Easing.inOut(Easing.sin) }),
        withTiming(endAngle, { duration: 1_060, easing: Easing.inOut(Easing.cubic) }),
      ),
    );
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }),
        withTiming(1.025, { duration: 560, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.97, { duration: 710, easing: Easing.in(Easing.cubic) }),
      ),
    );

    return () => {
      cancelAnimation(x);
      cancelAnimation(y);
      cancelAnimation(rotation);
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [active, delay, endAngle, flutter, from, height, screenWidth, startAngle, opacity, rotation, scale, x, y]);

  const motionStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  if (!active) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        containerStyle,
        { left: (screenWidth - width) / 2, top, width, height },
        motionStyle,
      ]}
    >
      <Image source={source} style={imageStyle} contentFit="contain" cachePolicy="memory-disk" />
    </Animated.View>
  );
}

export function FirstLaunchWelcome({
  active,
  onContinue,
}: {
  active: boolean;
  onContinue: () => void;
}) {
  const appearance = useResolvedAppearance();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [fontLoaded, fontError] = useFonts({
    UvelAllura: require("../assets/fonts/Allura-Regular.ttf"),
  });
  const [canContinue, setCanContinue] = useState(false);
  const dark = appearance === "dark";
  const background = dark ? "#0B0D12" : "#F7F5EF";
  const accent = MARKET_RED;
  const textColor = dark ? "#F5F6FA" : "#171518";
  const secondaryColor = dark ? "#CFCDD1" : "#555158";
  const pageMuted = dark ? "rgba(245,246,250,0.2)" : "rgba(23,21,24,0.16)";
  const pageActive = accent;
  const logoWidth = Math.min(screenWidth * 0.82, 360);
  const logoFontSize = Math.min(screenWidth * 0.245, 104);
  const logoHeight = logoFontSize * 1.23;
  const stylesForTheme = useMemo(
    () => makeStyles({ background, accent, pageMuted, pageActive }),
    [accent, background, pageActive, pageMuted],
  );

  const kickerOpacity = useSharedValue(0);
  const kickerY = useSharedValue(9);
  const logoReveal = useSharedValue(0);
  const line1Opacity = useSharedValue(0);
  const line1Y = useSharedValue(8);
  const line2Opacity = useSharedValue(0);
  const line2Y = useSharedValue(8);
  const line3Opacity = useSharedValue(0);
  const line3Y = useSharedValue(8);
  const buttonOpacity = useSharedValue(0);
  const buttonY = useSharedValue(12);

  useEffect(() => {
    const ready = fontLoaded || Boolean(fontError);
    if (!active || !ready) {
      setCanContinue(false);
      return;
    }

    setCanContinue(false);
    kickerOpacity.value = 0;
    kickerY.value = 9;
    logoReveal.value = 0;
    line1Opacity.value = 0;
    line1Y.value = 8;
    line2Opacity.value = 0;
    line2Y.value = 8;
    line3Opacity.value = 0;
    line3Y.value = 8;
    buttonOpacity.value = 0;
    buttonY.value = 12;
    const kickerTimer = setTimeout(() => {
      kickerOpacity.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
      kickerY.value = withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) });
    }, 3_460);
    logoReveal.value = withDelay(
      3_760,
      withTiming(1, { duration: 1_350, easing: Easing.inOut(Easing.cubic) }),
    );
    const line1Timer = setTimeout(() => {
      line1Opacity.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
      line1Y.value = withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) });
    }, 5_180);
    const line2Timer = setTimeout(() => {
      line2Opacity.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
      line2Y.value = withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) });
    }, 5_770);
    const line3Timer = setTimeout(() => {
      line3Opacity.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
      line3Y.value = withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) });
    }, 6_360);
    const buttonTimer = setTimeout(() => {
      buttonOpacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
      buttonY.value = withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) });
      setCanContinue(true);
    }, 7_070);

    return () => {
      clearTimeout(kickerTimer);
      clearTimeout(line1Timer);
      clearTimeout(line2Timer);
      clearTimeout(line3Timer);
      clearTimeout(buttonTimer);
      cancelAnimation(kickerOpacity);
      cancelAnimation(kickerY);
      cancelAnimation(logoReveal);
      cancelAnimation(line1Opacity);
      cancelAnimation(line1Y);
      cancelAnimation(line2Opacity);
      cancelAnimation(line2Y);
      cancelAnimation(line3Opacity);
      cancelAnimation(line3Y);
      cancelAnimation(buttonOpacity);
      cancelAnimation(buttonY);
    };
  }, [active, fontError, fontLoaded, buttonOpacity, buttonY, kickerOpacity, kickerY, line1Opacity, line1Y, line2Opacity, line2Y, line3Opacity, line3Y, logoReveal]);

  const kickerStyle = useAnimatedStyle(() => ({
    opacity: kickerOpacity.value,
    transform: [{ translateY: kickerY.value }],
  }));
  const logoClipStyle = useAnimatedStyle(() => ({
    width: Math.max(0, logoWidth * logoReveal.value),
  }));
  const line1Style = useAnimatedStyle(() => ({ opacity: line1Opacity.value, transform: [{ translateY: line1Y.value }] }));
  const line2Style = useAnimatedStyle(() => ({ opacity: line2Opacity.value, transform: [{ translateY: line2Y.value }] }));
  const line3Style = useAnimatedStyle(() => ({ opacity: line3Opacity.value, transform: [{ translateY: line3Y.value }] }));
  const buttonStyle = useAnimatedStyle(() => ({ opacity: buttonOpacity.value, transform: [{ translateY: buttonY.value }] }));

  const baseTop = Math.max(insets.top + 22, screenHeight * 0.065);
  const garmentLayout = GARMENTS.map((item) => {
    const width = Math.min(screenWidth * item.width, 286);
    const aspect = item.id === "bag" ? 0.94 : item.id === "blazer" ? 1.03 : item.id === "tee" ? 0.99 : item.id === "denim" ? 0.97 : 0.96;
    return {
      ...item,
      width,
      height: width / aspect,
      top: baseTop + screenHeight * item.top,
    };
  });

  return (
    <View style={[stylesForTheme.root, { backgroundColor: background }]}>
      <View pointerEvents="none" style={[stylesForTheme.glow, stylesForTheme.glowTop]} />
      <View pointerEvents="none" style={[stylesForTheme.glow, stylesForTheme.glowBottom]} />

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {garmentLayout.map((item) => (
          <MovingGarment
            key={item.id}
            source={item.source}
            containerStyle={stylesForTheme.garment}
            imageStyle={stylesForTheme.garmentImage}
            width={item.width}
            height={item.height}
            top={item.top}
            screenWidth={screenWidth}
            from={item.from}
            delay={item.delay}
            flutter={item.flutter}
            startAngle={item.startAngle}
            endAngle={item.endAngle}
            active={active}
          />
        ))}
      </View>

      <View
        pointerEvents="box-none"
        style={[
          stylesForTheme.content,
          { bottom: Math.max(insets.bottom, 14) + 18, paddingHorizontal: Math.max(24, screenWidth * 0.07) },
        ]}
      >
        <Animated.View style={[stylesForTheme.kickerWrap, kickerStyle]}>
          <Text style={[stylesForTheme.kicker, { color: secondaryColor }]}>Welcome to</Text>
        </Animated.View>

        <View style={[stylesForTheme.logoStage, { height: logoHeight }]}>
          <Animated.View style={[stylesForTheme.logoClip, { height: logoHeight }, logoClipStyle]}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                stylesForTheme.logo,
                {
                  color: accent,
                  width: logoWidth,
                  height: logoHeight,
                  fontSize: logoFontSize,
                  lineHeight: logoFontSize * 1.18,
                  fontFamily: fontLoaded ? "UvelAllura" : "Georgia",
                  fontStyle: fontLoaded ? "normal" : "italic",
                },
              ]}
            >
              Uvel
            </Text>
          </Animated.View>
        </View>

        <View style={stylesForTheme.taglines}>
          <Animated.Text style={[stylesForTheme.tagline, { color: textColor }, line1Style]}>
            Shop one-of-a-kind finds.
          </Animated.Text>
          <Animated.Text style={[stylesForTheme.tagline, { color: textColor }, line2Style]}>
            Turn your idea into a brand.
          </Animated.Text>
          <Animated.Text style={[stylesForTheme.tagline, { color: textColor }, line3Style]}>
            Sell alongside labels you love.
          </Animated.Text>
        </View>

        <Animated.View style={[stylesForTheme.buttonWrap, buttonStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get started with Uvel"
            accessibilityHint="Continues to the Uvel introduction."
            accessibilityState={{ disabled: !canContinue }}
            disabled={!canContinue}
            onPress={onContinue}
            style={({ pressed }) => [
              stylesForTheme.cta,
              { backgroundColor: accent, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={stylesForTheme.ctaText}>Get started</Text>
          </Pressable>
        </Animated.View>

        <View style={stylesForTheme.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                stylesForTheme.dot,
                { backgroundColor: i === 0 ? pageActive : pageMuted },
                i === 0 && stylesForTheme.dotActive,
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function makeStyles({
  background,
  accent,
  pageMuted,
  pageActive,
}: {
  background: string;
  accent: string;
  pageMuted: string;
  pageActive: string;
}) {
  return StyleSheet.create({
    root: { flex: 1, overflow: "hidden" },
    glow: { position: "absolute", width: 280, height: 280, borderRadius: 140 },
    glowTop: { top: -170, left: -110, backgroundColor: accent, opacity: background === "#0B0D12" ? 0.08 : 0.045 },
    glowBottom: { right: -155, bottom: "28%", backgroundColor: accent, opacity: background === "#0B0D12" ? 0.06 : 0.035 },
    garment: {
      position: "absolute",
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000000",
      shadowOpacity: background === "#0B0D12" ? 0.38 : 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 9,
    },
    garmentImage: { width: "100%", height: "100%" },
    content: { position: "absolute", left: 0, right: 0, alignItems: "center" },
    kickerWrap: { alignItems: "center" },
    kicker: { fontSize: 17, fontWeight: "500", letterSpacing: 0.15 },
    logoStage: { width: "100%", alignItems: "center", justifyContent: "center", overflow: "visible", marginTop: -2 },
    logoClip: { overflow: "hidden", alignItems: "flex-start" },
    logo: { textAlign: "center", includeFontPadding: false },
    taglines: { width: "100%", alignItems: "center", marginTop: 3, gap: 2 },
    tagline: { fontSize: 15, lineHeight: 21, fontWeight: "500", letterSpacing: 0.05, textAlign: "center" },
    buttonWrap: { width: "100%", marginTop: 20 },
    cta: { height: 54, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    ctaText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", letterSpacing: 0.15 },
    dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 15, minHeight: 9 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotActive: { width: 20, backgroundColor: pageActive },
  });
}
