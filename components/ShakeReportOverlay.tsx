import { Ionicons } from "@expo/vector-icons";
import { Linking, StyleSheet, Switch, Text, View } from "react-native";
import { useCallback, useState } from "react";
import { Sheet } from "./Sheet";
import { AccessiblePressable } from "./AccessiblePressable";
import { useColors } from "../lib/theme";
import { setShakeReportEnabled, useShakeDetector } from "../lib/shakeReport";

const REPORT_EMAIL = "himforson@gmail.com";

export function ShakeReportOverlay() {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const onShake = useCallback(() => setOpen(true), []);
  const shakeEnabled = useShakeDetector(onShake);

  const report = useCallback(() => {
    setOpen(false);
    void Linking.openURL(`mailto:${REPORT_EMAIL}?subject=Report a problem in Uvel&body=What happened?%0A%0AWhere were you in the app?%0A%0ADevice / OS:`).catch(() => undefined);
  }, []);

  return (
    <Sheet open={open} onClose={() => setOpen(false)}>
      <View style={styles.content}>
        <Text style={styles.title}>Report a problem</Text>
        <Text style={styles.subtitle}>If something in Uvel isn’t working correctly, tell us what happened so we can make it better.</Text>
        <AccessiblePressable
          onPress={report}
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.success }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Report a problem"
          accessibilityHint="Opens an email so you can describe the problem to Uvel."
        >
          <Text style={[styles.primaryText, { color: colors.successInk }]}>Report a problem</Text>
        </AccessiblePressable>
        <AccessiblePressable
          onPress={() => setOpen(false)}
          style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Learn about safety reports"
        >
          <Ionicons name="information-circle-outline" size={28} color={colors.bone} />
          <View style={styles.infoCopy}>
            <Text style={styles.infoTitle}>For safety, report abuse or spam through support</Text>
            <Text style={styles.infoBody}>Use this form for product and technical problems. For urgent safety concerns, contact Uvel support directly.</Text>
          </View>
          <Ionicons name="chevron-forward" size={21} color={colors.muted} />
        </AccessiblePressable>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Shake phone to report a problem</Text>
            <Text style={styles.toggleBody}>Turn off to disable</Text>
          </View>
          <Switch
            value={shakeEnabled}
            onValueChange={(value) => void setShakeReportEnabled(value)}
            trackColor={{ false: "rgba(244,240,230,0.18)", true: "#D6E27A" }}
            thumbColor="#fff"
            accessibilityLabel="Shake phone to report a problem"
            accessibilityHint="Turn this off to disable shake reporting."
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 6 },
  title: { color: "#F4F0E6", fontSize: 22, fontWeight: "800", textAlign: "center" },
  subtitle: { color: "rgba(244,240,230,0.68)", fontSize: 15, lineHeight: 21, textAlign: "center", marginTop: 9, paddingHorizontal: 8 },
  primary: { minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 22 },
  primaryText: { fontSize: 16, fontWeight: "800" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(244,240,230,0.12)" },
  infoCopy: { flex: 1 },
  infoTitle: { color: "#F4F0E6", fontSize: 14, lineHeight: 19, fontWeight: "700" },
  infoBody: { color: "rgba(244,240,230,0.58)", fontSize: 12, lineHeight: 17, marginTop: 4 },
  pressed: { opacity: 0.78 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 18 },
  toggleCopy: { flex: 1 },
  toggleTitle: { color: "#F4F0E6", fontSize: 15, fontWeight: "700" },
  toggleBody: { color: "rgba(244,240,230,0.54)", fontSize: 12, marginTop: 4 },
});
