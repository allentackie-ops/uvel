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

export default function HowToUseUvel() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerTitle: "How to use Uvel", headerTransparent: false, headerShadowVisible: false }} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 48 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>A SHORT TOUR</Text>
        <Text style={styles.lede}>Four tabs. That’s most of it.</Text>
        <P styles={styles}>
          Today is the floor. Mirror is try-on. Sell is listing. You is you — saved pieces, wallet, the brand if you have one.
        </P>

        <H styles={styles}>Today</H>
        <P styles={styles}>
          Scroll the listings. Tap one to open it. Pull down on the photo to go back. Double-tap the photo to save it.
        </P>
        <P styles={styles}>
          Add to cart doesn’t yank you into checkout. A bag sits on Today so you can keep going. Tap the bag when you’re done.
        </P>
        <P styles={styles}>
          First Find pieces have a crossed-out price and a lower one next to it. That’s the credit. Style DNA and what you actually look at shape what shows up, but the grid won’t jump around under your thumb.
        </P>

        <H styles={styles}>Mirror</H>
        <P styles={styles}>
          Take a photo or pick one you have. We put the piece on you. Use it to decide. Then go buy it on Today, or don’t.
        </P>

        <H styles={styles}>Sell</H>
        <P styles={styles}>
          Follow the pills at the bottom. They go in order, so you’re not staring at Price while you’re still writing the name. Photos, story, details, price, ships to. Then you post it.
        </P>

        <H styles={styles}>You</H>
        <P styles={styles}>
          Your handle, your likes, Style DNA, Wallet, Founder Studio if you’re building a house. Settings is the gear.
        </P>

        <Text style={styles.faqKicker}>FAQ</Text>
        <Text style={styles.faqLede}>Things people actually ask.</Text>

        <View style={styles.faq}>
          {FAQ.map((item, index) => {
            const on = open === index;
            return (
              <Pressable
                key={item.q}
                onPress={() => setOpen(on ? null : index)}
                style={[styles.item, index === FAQ.length - 1 && styles.itemLast]}
                accessibilityRole="button"
                accessibilityState={{ expanded: on }}
              >
                <View style={styles.qRow}>
                  <Text style={styles.q}>{item.q}</Text>
                  <Text style={styles.chev}>{on ? "–" : "+"}</Text>
                </View>
                {on ? <Text style={styles.a}>{item.a}</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <P styles={styles}>Still stuck? Write. Don’t sit with it.</P>
        <Pressable onPress={() => void Linking.openURL(MAIL)} style={styles.mail} accessibilityRole="button" accessibilityLabel="Email Uvel">
          <Text style={styles.mailTxt}>Ask us</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function H({ children, styles }: { children: string; styles: ReturnType<typeof make> }) {
  return <Text style={styles.h}>{children}</Text>;
}

function P({ children, styles }: { children: string; styles: ReturnType<typeof make> }) {
  return <Text style={styles.p}>{children}</Text>;
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    kicker: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1.8, marginBottom: 10 },
    lede: { color: colors.bone, fontFamily: "Georgia", fontSize: 28, lineHeight: 34, marginBottom: 18 },
    h: { color: colors.bone, fontSize: 17, fontWeight: "700", marginTop: 22, marginBottom: 8 },
    p: { color: colors.muted, fontSize: 16, lineHeight: 24, marginBottom: 10 },
    faqKicker: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1.8, marginTop: 28, marginBottom: 8 },
    faqLede: { color: colors.bone, fontFamily: "Georgia", fontSize: 24, lineHeight: 30, marginBottom: 16 },
    faq: { backgroundColor: colors.surface, borderRadius: 16, overflow: "hidden", marginBottom: 22 },
    item: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.ink },
    itemLast: { borderBottomWidth: 0 },
    qRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    q: { flex: 1, color: colors.bone, fontSize: 16, fontWeight: "600", lineHeight: 22 },
    chev: { color: colors.subtle, fontSize: 22, width: 18, textAlign: "center" },
    a: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
    mail: { marginTop: 8, height: 48, borderRadius: 24, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    mailTxt: { color: colors.successInk, fontWeight: "800", fontSize: 15 },
  });
}
