import { StyleSheet, Text, View } from "react-native";
import { brandCheck, type Brand } from "../lib/brands";

const BLUE = "#3797FF";
const BLUE_CHECK = "#082844";
const LIME = "#D6E27A";
const LIME_CHECK = "#16140F";

export type VerifiedTone = "blue" | "lime";

export function VerifiedMark({ size = 16, tone = "blue" }: { size?: number; tone?: VerifiedTone }) {
  const bubble = tone === "lime" ? LIME : BLUE;
  const tick = tone === "lime" ? LIME_CHECK : BLUE_CHECK;
  const lobeSize = size * 0.34;
  const radius = size * 0.31;
  const coreSize = size * 0.68;
  const center = size / 2;
  const lobes = Array.from({ length: 10 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 10;
    return {
      left: center + Math.cos(angle) * radius - lobeSize / 2,
      top: center + Math.sin(angle) * radius - lobeSize / 2,
    };
  });

  return (
    <View accessibilityLabel={tone === "lime" ? "Verified founder" : "Verified brand"} accessibilityRole="image" style={{ width: size, height: size }}>
      {lobes.map((position, index) => (
        <View
          key={index}
          style={[
            styles.lobe,
            {
              backgroundColor: bubble,
              width: lobeSize,
              height: lobeSize,
              borderRadius: lobeSize / 2,
              left: position.left,
              top: position.top,
            },
          ]}
        />
      ))}
      <View
        style={[
          styles.core,
          {
            backgroundColor: bubble,
            width: coreSize,
            height: coreSize,
            borderRadius: coreSize / 2,
            left: center - coreSize / 2,
            top: center - coreSize / 2,
          },
        ]}
      >
        <Text style={[styles.check, { color: tick, fontSize: size * 0.55, lineHeight: size * 0.66 }]}>✓</Text>
      </View>
    </View>
  );
}

export function BrandVerifiedMark({ brand, size = 16 }: { brand?: Brand | null; size?: number }) {
  const tone = brandCheck(brand);
  if (tone === "none") return null;
  return <VerifiedMark size={size} tone={tone} />;
}

const styles = StyleSheet.create({
  lobe: {
    position: "absolute",
  },
  core: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    fontWeight: "900",
    includeFontPadding: false,
    marginTop: 0.5,
  },
});
