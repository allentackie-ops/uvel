import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View, useColorScheme } from "react-native";
import { useUvel } from "../lib/store";
import { palettes, resolveAppearance, useColors } from "../lib/theme";

export default function Appearance() {
  const app = useUvel();
  const colors = useColors();
  const current = resolveAppearance(app.appearance, useColorScheme());
  const styles = makeStyles(colors);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Choose your look</Text>
      <Text style={styles.intro}>Pick a look for Uvel, or let it follow the appearance set on your phone.</Text>

      <View style={styles.options} accessibilityRole="radiogroup">
        <ThemeCard
          label="Light"
          description="Bright and airy"
          palette={palettes.light}
          selected={app.appearance === "light"}
          onPress={() => void app.setAppearance("light")}
        />
        <ThemeCard
          label="Dark"
          description="Low light, high contrast"
          palette={palettes.dark}
          selected={app.appearance === "dark"}
          onPress={() => void app.setAppearance("dark")}
        />
      </View>

      <View style={styles.systemRow}>
        <View style={styles.systemIcon}>
          <Ionicons name="phone-portrait-outline" size={20} color={colors.bone} />
        </View>
        <View style={styles.systemCopy}>
          <Text style={styles.systemTitle}>Match system</Text>
          <Text style={styles.systemHint}>Automatically match your phone’s light or dark mode</Text>
        </View>
        <Switch
          value={app.appearance === "system"}
          onValueChange={(enabled) => void app.setAppearance(enabled ? "system" : current)}
          trackColor={{ false: colors.neutral, true: colors.success }}
          thumbColor={app.appearance === "system" ? colors.successInk : "#FFFFFF"}
          accessibilityLabel="Match system"
          accessibilityHint="Automatically match your phone's light or dark mode"
        />
      </View>
      {app.appearance === "system" ? <Text style={styles.activeHint}>Following your phone’s current appearance</Text> : null}
    </ScrollView>
  );
}

function ThemeCard({ label, description, palette, selected, onPress }: { label: string; description: string; palette: typeof palettes.light; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [cardStyles.card, { backgroundColor: palette.ink, borderColor: selected ? palette.success : palette.subtle + "66", opacity: pressed ? 0.86 : 1 }]}
    >
      <View style={cardStyles.previewTop}>
        <Text style={[cardStyles.previewBrand, { color: palette.bone }]}>UVEL</Text>
        <View style={[cardStyles.previewDot, { backgroundColor: palette.success }]} />
      </View>
      <View style={[cardStyles.previewLine, { backgroundColor: palette.subtle + "55" }]} />
      <View style={cardStyles.previewBody}>
        <View style={[cardStyles.previewImage, { backgroundColor: palette.surface }]}>
          <View style={[cardStyles.previewImageLine, { backgroundColor: palette.success }]} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[cardStyles.shortLine, { backgroundColor: palette.bone }]} />
          <View style={[cardStyles.longLine, { backgroundColor: palette.muted }]} />
          <View style={[cardStyles.priceLine, { backgroundColor: palette.success }]} />
        </View>
      </View>
      <View style={cardStyles.cardFooter}>
        <View>
          <Text style={[cardStyles.label, { color: palette.bone }]}>{label}</Text>
          <Text style={[cardStyles.description, { color: palette.muted }]}>{description}</Text>
        </View>
        <View style={[cardStyles.radio, { borderColor: selected ? palette.success : palette.subtle }]}>{selected ? <View style={[cardStyles.radioDot, { backgroundColor: palette.success }]} /> : null}</View>
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: { flex: 1, minWidth: 145, borderWidth: 1.5, borderRadius: 20, padding: 12, overflow: "hidden" },
  previewTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  previewBrand: { fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  previewDot: { width: 8, height: 8, borderRadius: 4 },
  previewLine: { height: 1, marginTop: 10, marginBottom: 12 },
  previewBody: { flexDirection: "row", gap: 9, height: 74 },
  previewImage: { width: 52, borderRadius: 8, justifyContent: "flex-end", padding: 6 },
  previewImageLine: { height: 4, borderRadius: 2, width: 24 },
  shortLine: { width: "72%", height: 6, borderRadius: 3 },
  longLine: { width: "92%", height: 5, borderRadius: 3 },
  priceLine: { width: "40%", height: 6, borderRadius: 3, marginTop: 8 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  label: { fontSize: 16, fontWeight: "700" },
  description: { fontSize: 11, marginTop: 3 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});

function makeStyles(colors: typeof palettes.dark) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { padding: 20, paddingBottom: 72 },
    title: { color: colors.bone, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
    intro: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: 340 },
    options: { flexDirection: "row", gap: 12, marginTop: 28 },
    systemRow: { flexDirection: "row", alignItems: "center", marginTop: 28, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.subtle + "66" },
    systemIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    systemCopy: { flex: 1, marginHorizontal: 12 },
    systemTitle: { color: colors.bone, fontSize: 16, fontWeight: "700" },
    systemHint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
    activeHint: { color: colors.success, fontSize: 12, marginLeft: 52, marginTop: 10 },
  });
}
