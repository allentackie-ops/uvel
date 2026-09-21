import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { updatePiece, useWardrobe, useWardrobeHydrated } from "../lib/wardrobe";

export default function SellingAvailability() {
  const app = useUvel();
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const pieces = useWardrobe();
  const hydrated = useWardrobeHydrated();
  const listings = pieces.filter((piece) => {
    const owner = piece.ownerId || piece.listedByUid;
    return owner === app.uid && !piece.brandId && piece.status === "listed";
  });
  const paused = listings.some((piece) => piece.sellerPaused);
  const disabled = !app.uid || !hydrated || listings.length === 0;

  function toggle(value: boolean) {
    if (disabled) return;
    listings.forEach((piece) => updatePiece(piece.id, { sellerPaused: value }));
  }

  return (
    <View style={styles.page}>
      <StatusBar style={colors.ink === "#000000" ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.row, disabled && styles.rowDisabled]}>
          <View style={styles.copy}>
            <Text style={styles.title}>Pause my listings</Text>
            <Text style={styles.hint}>
              {disabled
                ? hydrated ? "You have no normal listings yet." : "Loading your listings…"
                : paused
                  ? "Your listings are hidden from the marketplace."
                  : "Hide your normal listings from Today and Browse until you turn this off."}
            </Text>
          </View>
          <Switch
            value={paused}
            onValueChange={toggle}
            disabled={disabled}
            trackColor={{ false: colors.surface, true: colors.success }}
            thumbColor="#fff"
            accessibilityLabel="Pause my listings"
            accessibilityHint="Hide or show your normal listings in the marketplace."
          />
        </View>
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingBottom: 32 },
    row: { minHeight: 86, paddingHorizontal: 20, paddingVertical: 18, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}24` },
    rowDisabled: { opacity: 0.55 },
    copy: { flex: 1, paddingRight: 18 },
    title: { color: colors.bone, fontSize: 17, fontWeight: "700" },
    hint: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  });
}
