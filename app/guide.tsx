import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, type Colors } from "../lib/theme";

const MAIL = "mailto:himforson@gmail.com?subject=Uvel%20help";

const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I buy a piece?",
    a: "Open a listing and tap Add to cart. When you’re ready, tap the bag on Today and check out. Fees and buyer protection are shown before you pay.",
  },
  {
    q: "Why is there a bag on Today?",
    a: "It keeps your cart handy while you browse. Tap it to check out. Drag it if it’s in the way, or long-press it to show the bin.",
  },
  {
    q: "What is First Find?",
    a: "A credit toward your first eligible piece after you set up Style DNA. It comes off at checkout; it isn’t cash. Friends you invite can get one too.",
  },
  {
    q: "What is Style DNA?",
    a: "A quick profile of your style. Set it up in You; it helps tailor Today using your preferences and the pieces you view or save.",
  },
  {
    q: "Why didn’t Today change when I liked something?",
    a: "Today stays put while you browse. Pull down to refresh, or reopen Uvel, to see a fresh mix.",
  },
  {
    q: "What happens to my payment?",
    a: "Uvel holds your payment while your order is on the way. After you confirm delivery, it’s released to the seller. If there’s a problem, contact Uvel.",
  },
  {
    q: "When do I get paid for a sale?",
    a: "After the buyer confirms delivery, your earnings appear in Wallet on You. Withdraw to your bank; stores in Ghana can use mobile money.",
  },
  {
    q: "Where can I see buyer protection fees?",
    a: "They’re shown at checkout, before you pay.",
  },
  {
    q: "How can I preview a piece on me?",
    a: "Open Mirror, or tap Try it on from a listing. Add a photo for a preview; it won’t show the exact fit.",
  },
  {
    q: "How do I list something?",
    a: "Open Create, choose Sell from your closet, then add your own photos and enter the name, category, condition, price, and shipping details. You can save and finish later. Don’t list replicas.",
  },
  {
    q: "How do I start a brand?",
    a: "Open Create, choose Start a brand, and use Founder Studio to shape your idea, first product, and identity. When you’re ready, apply. If approved, you’ll get Brand HQ.",
  },
  {
    q: "How do invites work?",
    a: "Share your invite with a friend. They can get First Find after setting up Style DNA.",
  },
  {
    q: "What does double-tapping a photo do?",
    a: "It likes and saves the piece. Find it later in Saves on You, or tap Save on the listing.",
  },
  {
    q: "How do I change the app’s appearance?",
    a: "Go to Settings → Appearance. Choose light, dark, or match your phone.",
  },
  {
    q: "How do I report a problem?",
    a: "Go to Settings → Report app issue, or tap Ask us below.",
  },
];

const TABS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: "compass-outline",
    title: "Today",
    body: "Browse listings, open a piece, and save it with a double-tap. Add to your bag and keep looking.",
  },
  {
    icon: "body-outline",
    title: "Mirror",
    body: "Take or choose a photo to preview how a piece looks on you. It won’t show the fit.",
  },
  {
    icon: "add-outline",
    title: "Create",
    body: "Start a brand in Founder Studio, or list something you already own from your closet.",
  },
  {
    icon: "person-outline",
    title: "You",
    body: "Find saved pieces, Style DNA, Wallet, Settings, Founder Studio, and Brand HQ.",
  },
];

export default function HowToUseUvel() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerTitle: "How to use Uvel", headerTransparent: false, headerShadowVisible: false }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 36 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lede}>Four tabs. That’s most of it.</Text>
        <Text style={styles.intro}>A quick guide to the main things you can do in Uvel.</Text>

        <View style={styles.cardGrid}>
          {TABS.map((tab) => (
            <View key={tab.title} style={styles.card}>
              <Ionicons name={tab.icon} size={21} color={colors.success} />
              <Text style={styles.cardTitle}>{tab.title}</Text>
              <Text style={styles.cardBody}>{tab.body}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>Quick answers</Text>
        <View style={styles.faq}>
          {FAQ.map((item, index) => {
            const expanded = open === index;
            return (
              <Pressable
                key={item.q}
                onPress={() => setOpen(expanded ? null : index)}
                style={[styles.item, index === FAQ.length - 1 && styles.itemLast]}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
              >
                <View style={styles.qRow}>
                  <Text style={styles.q}>{item.q}</Text>
                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={19} color={colors.subtle} style={styles.chev} />
                </View>
                {expanded ? <Text style={styles.a}>{item.a}</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.contactCopy}>Still stuck? Ask us.</Text>
        <Pressable
          onPress={() => void Linking.openURL(MAIL)}
          style={styles.mail}
          accessibilityRole="button"
          accessibilityLabel="Email Uvel"
        >
          <Text style={styles.mailTxt}>Ask us</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingHorizontal: 20, paddingTop: 16 },
    lede: { color: colors.bone, fontSize: 30, fontWeight: "800", lineHeight: 36, letterSpacing: -0.7, marginBottom: 8 },
    intro: { color: colors.muted, fontSize: 16, lineHeight: 23, marginBottom: 20 },
    cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    card: {
      flexGrow: 1,
      flexBasis: "46%",
      minHeight: 140,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.subtle + "28",
    },
    cardTitle: { color: colors.bone, fontSize: 16, lineHeight: 21, fontWeight: "800", marginTop: 10, marginBottom: 5 },
    cardBody: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    section: { color: colors.bone, fontSize: 19, lineHeight: 24, fontWeight: "800", marginTop: 26, marginBottom: 12 },
    faq: { backgroundColor: colors.surface, borderRadius: 16, overflow: "hidden", marginBottom: 20 },
    item: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.ink },
    itemLast: { borderBottomWidth: 0 },
    qRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    q: { flex: 1, color: colors.bone, fontSize: 16, fontWeight: "800", lineHeight: 22 },
    chev: { width: 20, textAlign: "center" },
    a: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 11 },
    contactCopy: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
    mail: { marginTop: 2, height: 48, borderRadius: 24, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    mailTxt: { color: colors.successInk, fontWeight: "800", fontSize: 15 },
  });
}
