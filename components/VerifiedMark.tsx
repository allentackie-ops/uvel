import { StyleSheet, Text, View } from "react-native";

const BLUE = "#3797FF";
const CHECK = "#082844";

export function VerifiedMark({ size = 16 }: { size?: number }) {
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
    <View accessibilityLabel="Verified brand" accessibilityRole="image" style={{ width: size, height: size }}>
      {lobes.map((position, index) => (
        <View
          key={index}
          style={[
            styles.lobe,
            {
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
            width: coreSize,
            height: coreSize,
            borderRadius: coreSize / 2,
            left: center - coreSize / 2,
            top: center - coreSize / 2,
          },
        ]}
      >
        <Text style={[styles.check, { fontSize: size * 0.55, lineHeight: size * 0.66 }]}>✓</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lobe: {
    position: "absolute",
    backgroundColor: BLUE,
  },
  core: {
    position: "absolute",
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    color: CHECK,
    fontWeight: "900",
    includeFontPadding: false,
    marginTop: 0.5,
  },
});
