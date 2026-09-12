import { Stack } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, type Colors } from "../lib/theme";

const MAIL = "mailto:himforson@gmail.com?subject=About%20Uvel";

export default function AboutUvel() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerTitle: "About Uvel", headerTransparent: false, headerShadowVisible: false }} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 48 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>UVEL</Text>
        <Text style={styles.lede}>An app for clothes. That’s the whole plot.</Text>

        <P styles={styles}>
          You come here to find something, try it on a photo of yourself, buy it, sell something you’re done with, or start a small label if that’s the kind of person you are.
        </P>
        <P styles={styles}>
          We built it because a lot of fashion apps feel like they were made for a catalogue, not for getting dressed.
        </P>

        <H styles={styles}>Today</H>
        <P styles={styles}>
          The first screen is Today. It’s a floor of listings. Some are clothes people already wore. Some are first pieces from people just starting.
        </P>
        <P styles={styles}>
          What you see follows what you actually look at, what you like, and the style you set in You. It isn’t reading your mind. It’s just paying attention.
        </P>
        <P styles={styles}>
          If something is a First Find, we take a bit off the price at checkout. That’s a real credit, not a crossed-out number for show.
        </P>

        <H styles={styles}>Mirror</H>
        <P styles={styles}>
          Mirror is the try-on. You take a photo, or use one you already have, and we put the piece on you. It’s a preview. It will not tell you if the sleeves are too long. It will tell you if the jacket looks like you.
        </P>

        <H styles={styles}>Buying</H>
        <P styles={styles}>
          You add things to a bag on Today, then check out when you’re ready. Protection and extra fees show up at checkout, not on the floor. We don’t want a listing to feel like a lecture.
        </P>
        <P styles={styles}>
          When you pay, we hold the money until the thing is in your hands and you’ve said so. If it never shows, you shouldn’t be the one chasing it.
        </P>

        <H styles={styles}>Selling</H>
        <P styles={styles}>
          If you have something, you list it. Photos, a name, a price, where it ships. We try not to make you fill in a novel.
        </P>
        <P styles={styles}>
          When it sells, the money does not hit your pocket on the spot. We hold it. You send the thing. They confirm. Then it sits in your wallet, and you can send that to a bank. If you’re in the Ghana store, mobile money is there too.
        </P>
        <P styles={styles}>
          Don’t sell fakes. Don’t use someone else’s photos. We’ll take the listing down.
        </P>

        <H styles={styles}>Starting a label</H>
        <P styles={styles}>
          Founder Studio is for people making a house, not emptying a closet. You name it, you make one piece, you send it in. We look at the name, the pictures, and whether it reads like a replica of someone famous. That takes a little while. You go back to Today while we do it.
        </P>
        <P styles={styles}>
          If it goes through, you get a Brand HQ — the shop, the orders, the money, the page people see. If it doesn’t, we tell you why, and you can fix it and send it again.
        </P>
        <P styles={styles}>
          If you already run a registered company and just want that on Uvel, that’s a different door. It isn’t in the app yet.
        </P>

        <H styles={styles}>Stores</H>
        <P styles={styles}>
          You pick a store in Settings. The floor, the currency, and how you get paid follow that store. Ghana and the US are the ones that matter right now.
        </P>

        <H styles={styles}>Who this is</H>
        <P styles={styles}>
          Uvel is from Fitza. We’re small. There isn’t a press team. If you write, a person reads it.
        </P>
        <P styles={styles}>
          This isn’t a manifesto. Wear the thing. List the thing. If something’s broken, report it from Settings.
        </P>

        <H styles={styles}>Write to us</H>
        <P styles={styles}>himforson@gmail.com</P>
        <Pressable onPress={() => void Linking.openURL(MAIL)} style={styles.mail}>
          <Text style={styles.mailTxt}>Send a mail</Text>
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
    mail: { marginTop: 8, height: 48, borderRadius: 24, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    mailTxt: { color: colors.successInk, fontWeight: "800", fontSize: 15 },
  });
}
