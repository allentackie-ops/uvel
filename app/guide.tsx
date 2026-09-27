import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, type Colors } from "../lib/theme";

const MAIL = "mailto:himforson@gmail.com?subject=Uvel%20help";

const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I buy something?",
    a: "Open a listing on Today, tap Add to cart. A bag shows up on the bottom right of Today and stays with you while you keep looking. When you’re ready, tap that bag and check out. Protection and extra fees show there, not on the floor.",
  },
  {
    q: "Why is there a bag floating on Today?",
    a: "So you can keep shopping. It only lives on Today. Drag it if it’s in the way. Long-press it and a bin shows up if you want to dump the bag. Opening it takes you to checkout.",
  },
  {
    q: "What is First Find?",
    a: "A real credit on a first piece that matches you, after Style DNA is set. The old price is crossed out. The lower one is what you pay. It is not cash and you cannot withdraw it. Invite a friend and they get one too.",
  },
  {
    q: "What is Style DNA?",
    a: "A short set of what you actually wear — cut, colour, how loud you like things. It sits in You. Today uses it, along with what you look at and save, so the floor feels closer to you. It does not rewrite the feed while you’re in the middle of tapping something.",
  },
  {
    q: "Why didn’t Today change after I liked something?",
    a: "On purpose. The floor stays still while you’re on it. It only reshuffles if you pull to refresh, or you leave the app and come back.",
  },
  {
    q: "Where does my money go when I buy?",
    a: "We hold it. The seller sends the piece. You say you got it. Then the seller can take it out of their wallet. If it never shows, you should not be the one chasing it.",
  },
  {
    q: "When do I get paid if I sell?",
    a: "Not the second it sells. We hold it until the buyer confirms they have it. Then it sits in Wallet, on You. From there you send it to a bank. If your store is Ghana, mobile money is there too.",
  },
  {
    q: "Why don’t I see buyer protection on the listing?",
    a: "Because it belongs at checkout. Putting a fee on the floor makes people flinch before they’ve even decided they want the thing.",
  },
  {
    q: "How do I try something on?",
    a: "Mirror, or Try it on from a listing. Use a photo of you. It’s a preview of whether the piece looks like you. It will not tell you if the sleeves are long.",
  },
  {
    q: "How do I list something?",
    a: "Sell. Photos first, then the name, then the rest in order — category, condition, price, where it ships. You can leave and come back. Don’t use someone else’s photos. Don’t list a fake.",
  },
  {
    q: "How do I start a brand?",
    a: "Founder Studio, from You. Name it, make one piece, apply. You go back to Today while we look at the name, the pictures, and whether it reads like a replica. That takes a little while. If it goes through, you get Brand HQ. If it doesn’t, we tell you why and you can send it again.",
  },
  {
    q: "Can I invite someone?",
    a: "Yes. Share your invite. They get a First Find after they set Style DNA. Same as yours — toward a piece, not cash.",
  },
  {
    q: "I double-tapped a photo. What was that?",
    a: "That’s a like. The heart flies into Save. Same as tapping Save in the corner. It’s on your You page after that.",
  },
  {
    q: "How do I change the look of the app?",
    a: "Settings, then Appearance. Light, dark, or whatever your phone is doing.",
  },
  {
    q: "Something’s broken. Who do I tell?",
    a: "Settings → Report app issue. Or mail himforson@gmail.com. A person reads it.",
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
    title: "Sell",
    body: "Add photos, fill in the details and price, then post your listing.",
  },
  {
    icon: "person-outline",
    title: "You",
    body: "Find saved pieces, Style DNA, Wallet, Settings, and Founder Studio.",
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
                  <Text style={styles.chev}>{expanded ? "−" : "+"}</Text>
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
    item: { paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.ink },
    itemLast: { borderBottomWidth: 0 },
    qRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    q: { flex: 1, color: colors.bone, fontSize: 15, fontWeight: "700", lineHeight: 21 },
    chev: { color: colors.subtle, fontSize: 22, width: 18, textAlign: "center" },
    a: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10 },
    contactCopy: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
    mail: { marginTop: 2, height: 48, borderRadius: 24, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    mailTxt: { color: colors.successInk, fontWeight: "800", fontSize: 15 },
  });
}
