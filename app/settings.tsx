import { Pressable, StyleSheet, Text, View } from "react-native";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";

export default function Settings() {
  const { appearance, setAppearance, email, displayName, signedInWith, uid, signOutAccount } =
    useUvel();
  const colors = useColors();
  const styles = make(colors);

  return (
    <View style={styles.page}>
      <Text style={styles.kicker}>SETTINGS</Text>
      <Text style={styles.title}>The house</Text>
      <Text style={styles.p}>Olive and white. You pick the paper or the ink.</Text>

      <Text style={styles.h2}>Account</Text>
      <View style={styles.account}>
        <Text style={styles.cardTitle}>{displayName || (uid ? "Uvel member" : "Guest")}</Text>
        <Text style={styles.cardHint}>
          {email || (signedInWith ? `Signed in with ${signedInWith}` : "Not signed in")}
        </Text>
      </View>

      <Text style={styles.h2}>Appearance</Text>
      <View style={styles.row}>
        {(["light", "dark"] as const).map((mode) => {
          const on = appearance === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => setAppearance(mode)}
              style={[styles.card, on && styles.cardOn]}
            >
              <Text style={[styles.cardTitle, on && styles.cardTitleOn]}>
                {mode === "light" ? "Light" : "Dark"}
              </Text>
              <Text style={[styles.cardHint, on && styles.cardHintOn]}>
                {mode === "light" ? "Paper and olive" : "Ink, still the olive"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {uid || signedInWith ? (
        <Pressable onPress={() => void signOutAccount()} style={styles.out}>
          <Text style={styles.outText}>Log out</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink, padding: 24, paddingTop: 16 },
    kicker: { color: colors.subtle, letterSpacing: 2, fontSize: 11 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, marginTop: 8 },
    p: { color: colors.muted, marginTop: 10, fontSize: 14, lineHeight: 20 },
    h2: { color: colors.bone, fontFamily: "Georgia", fontSize: 24, marginTop: 28, marginBottom: 12 },
    row: { flexDirection: "row", gap: 12 },
    card: {
      flex: 1,
      borderRadius: 22,
      padding: 18,
      backgroundColor: colors.surface,
    },
    account: {
      borderRadius: 22,
      padding: 18,
      backgroundColor: colors.surface,
    },
    cardOn: { backgroundColor: colors.pulse },
    cardTitle: { color: colors.bone, fontWeight: "600", fontSize: 16 },
    cardTitleOn: { color: colors.pulseInk },
    cardHint: { color: colors.muted, fontSize: 12, marginTop: 6 },
    cardHintOn: { color: colors.pulseInk, opacity: 0.7 },
    out: { marginTop: 36, alignItems: "center", padding: 14 },
    outText: { color: colors.muted, fontSize: 16, fontWeight: "600" },
  });
}
