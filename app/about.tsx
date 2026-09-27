import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, type Colors } from "../lib/theme";

const MAIL = "mailto:himforson@gmail.com?subject=About%20Uvel";

const QUICK_GUIDE: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: "search-outline",
    title: "Find your next piece",
    body: "Browse pre-loved clothes and first pieces from new labels.",
  },
  {
    icon: "body-outline",
    title: "See it on you",
    body: "Mirror previews a piece on your photo. It shows the look, not the fit.",
  },
  {
    icon: "card-outline",
    title: "Buy with clarity",
    body: "See your total at checkout. Payment is held until you confirm delivery.",
  },
  {
    icon: "pricetag-outline",
    title: "Sell or start a label",
    body: "List something you own, or submit your first design in Founder Studio.",
  },
];

export default function AboutUvel() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerTitle: "About Uvel", headerTransparent: false, headerShadowVisible: false }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 36 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lede}>An app for clothes.{"\n"}That’s the whole plot.</Text>
        <Text style={styles.intro}>Find a piece. Try it on. Buy it, sell it, or start a label.</Text>

        <Text style={styles.section}>What you can do</Text>
        <View style={styles.cardGrid}>
          {QUICK_GUIDE.map((item) => (
            <View key={item.title} style={styles.card}>
              <Ionicons name={item.icon} size={21} color={colors.success} />
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.detailsSection}>A few useful details</Text>
        <View style={styles.details}>
          <DetailRow
            icon="ticket-outline"
            title="First Find"
            body="When you qualify, the credit is real and comes off at checkout."
            colors={colors}
            styles={styles}
          />
          <DetailRow
            icon="storefront-outline"
            title="Your store sets the details"
            body="Currency and payout options depend on the store you choose in Settings."
            colors={colors}
            styles={styles}
          />
          <DetailRow
            icon="business-outline"
            title="Building a brand?"
            body="Approved labels get a Brand HQ for their shop, orders, and earnings."
            colors={colors}
            styles={styles}
            last
          />
        </View>

        <View style={styles.contactCard}>
          <View style={styles.contactCopy}>
            <Text style={styles.contactTitle}>Need a hand?</Text>
            <Text style={styles.contactBody}>Uvel is from Fitza. A person reads your message.</Text>
          </View>
          <Pressable
            onPress={() => void Linking.openURL(MAIL)}
            style={({ pressed }) => [styles.mail, pressed && styles.mailPressed]}
            accessibilityRole="button"
            accessibilityLabel="Email the Uvel team"
          >
            <Text style={styles.mailTxt}>Email us</Text>
            <Ionicons name="arrow-forward" size={17} color={colors.successInk} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  icon,
  title,
  body,
  colors,
  styles,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  colors: Colors;
  styles: ReturnType<typeof make>;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Ionicons name={icon} size={19} color={colors.success} style={styles.detailIcon} />
      <View style={styles.detailCopy}>
        <Text style={styles.detailTitle}>{title}</Text>
        <Text style={styles.detailBody}>{body}</Text>
      </View>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingHorizontal: 20, paddingTop: 16, gap: 0 },
    lede: { color: colors.bone, fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.7, marginBottom: 8 },
    intro: { color: colors.muted, fontSize: 16, lineHeight: 23, marginBottom: 22 },
    section: { color: colors.bone, fontSize: 18, lineHeight: 23, fontWeight: "800", marginBottom: 11, marginTop: 3 },
    detailsSection: { color: colors.bone, fontSize: 18, lineHeight: 23, fontWeight: "800", marginBottom: 11, marginTop: 25 },
    cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    card: {
      flexGrow: 1,
      flexBasis: "46%",
      minHeight: 145,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.subtle + "28",
    },
    cardTitle: { color: colors.bone, fontSize: 15, lineHeight: 20, fontWeight: "800", marginTop: 11, marginBottom: 5 },
    cardBody: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    details: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.subtle + "28" },
    detailRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.subtle + "45" },
    detailRowLast: { borderBottomWidth: 0 },
    detailIcon: { width: 27, marginTop: 2 },
    detailCopy: { flex: 1 },
    detailTitle: { color: colors.bone, fontSize: 14, lineHeight: 19, fontWeight: "800", marginBottom: 2 },
    detailBody: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    contactCard: { marginTop: 16, marginBottom: 4, padding: 16, borderRadius: 17, backgroundColor: colors.pulse },
    contactCopy: { marginBottom: 13 },
    contactTitle: { color: colors.bone, fontSize: 18, lineHeight: 23, fontWeight: "800", marginBottom: 3 },
    contactBody: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    mail: { minHeight: 44, borderRadius: 22, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    mailPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
    mailTxt: { color: colors.successInk, fontWeight: "800", fontSize: 14 },
  });
}
