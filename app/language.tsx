import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LANGS, langLabel } from "../lib/i18n";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";

export default function Language() {
  const app = useUvel();
  const colors = useColors();
  const styles = make(colors);
  return <View style={styles.page}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>LANGUAGE</Text>
      <Text style={styles.title}>Choose your language.</Text>
      <Text style={styles.body}>Uvel updates the app as soon as you make a choice. Your preference is saved for next time.</Text>
      <View style={styles.list}>
        {LANGS.map((language) => {
          const selected = language.id === app.locale;
          return <Pressable key={language.id} onPress={() => { void app.setLocale(language.id); }} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && { opacity: 0.82 }]} accessibilityRole="radio" accessibilityLabel={language.label} accessibilityState={{ checked: selected }}>
            <View style={{ flex: 1 }}><Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{language.label}</Text><Text style={[styles.optionCode, selected && styles.optionCodeSelected]}>{language.id}</Text></View>
            <Text style={[styles.check, selected && styles.checkSelected]}>{selected ? "✓" : ""}</Text>
          </Pressable>;
        })}
      </View>
      <Text style={styles.current}>Current language · {langLabel(app.locale || "en-US")}</Text>
    </ScrollView>
  </View>;
}
function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink }, content: { padding: 20, paddingBottom: 40 }, eyebrow: { color: colors.success, fontSize: 10, fontWeight: "900", letterSpacing: 1.8, marginTop: 10 }, title: { color: colors.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 10 }, body: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 24 }, list: { gap: 10 }, option: { minHeight: 68, borderWidth: 1, borderColor: colors.subtle, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 13, flexDirection: "row", alignItems: "center", backgroundColor: colors.surface }, optionSelected: { borderColor: colors.success, backgroundColor: `${colors.success}1F` }, optionLabel: { color: colors.bone, fontSize: 16, fontWeight: "800" }, optionLabelSelected: { color: colors.success }, optionCode: { color: colors.muted, fontSize: 11, marginTop: 3 }, optionCodeSelected: { color: colors.bone }, check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.subtle, color: "transparent", textAlign: "center", lineHeight: 22, fontWeight: "900" }, checkSelected: { backgroundColor: colors.success, borderColor: colors.success, color: colors.successInk }, current: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 22 }
  });
}
