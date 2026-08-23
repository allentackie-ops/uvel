import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "../../components/ListingCard";
import { seedFromStyles, ARCH, PALS, SILS, dnaHint } from "../../lib/styleDna";
import { useUvel } from "../../lib/store";
import { pullLooks } from "../../lib/trends";
import { useColors, type Colors } from "../../lib/theme";
import { useWardrobe } from "../../lib/wardrobe";

export default function You() {
  const app = useUvel();
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const pieces = useWardrobe();
  const mine = pieces.filter((p) => p.ownerId === app.uid && p.status === "listed");

  useEffect(() => {
    if (app.archetype || !app.styles.length) return;
    const seed = seedFromStyles(app.styles);
    if (seed.archetype || seed.palette || seed.silhouette) app.setStyle(seed);
  }, [app.archetype, app.styles]);

  function pick(patch: { archetype?: string; palette?: string; silhouette?: string }) {
    app.setStyle(patch);
    void pullLooks({ fresh: true });
  }

  const dnaReady = Boolean(app.archetype || app.palette || app.silhouette);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 108 }]}
    >
      <View style={styles.top}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.kicker}>YOU</Text>
          <Text style={styles.title}>{app.displayName || "Your closet"}</Text>
        </View>
        {app.personUri ? (
          <Image source={{ uri: app.personUri }} style={styles.avatar} contentFit="cover" />
        ) : null}
        <Pressable onPress={() => router.push("/settings")} style={styles.menuBtn} accessibilityLabel="Settings">
          <View style={styles.dash} />
          <View style={styles.dash} />
          <View style={styles.dash} />
        </Pressable>
      </View>

      <Text style={styles.h2}>Style DNA</Text>
      <Text style={styles.lede}>
        This is how Uvel decides what you see on Today, and which pieces we put in front of you to buy.
      </Text>

      <ChipBlock
        label="Style"
        items={[...ARCH]}
        value={app.archetype}
        hint={app.archetype ? dnaHint("arch", app.archetype) : ""}
        onPick={(v) => pick({ archetype: v })}
      />
      <ChipBlock
        label="Palette"
        items={[...PALS]}
        value={app.palette}
        hint={app.palette ? dnaHint("pal", app.palette) : ""}
        onPick={(v) => pick({ palette: v })}
      />
      <ChipBlock
        label="Silhouette"
        items={[...SILS]}
        value={app.silhouette}
        hint={app.silhouette ? dnaHint("sil", app.silhouette) : ""}
        onPick={(v) => pick({ silhouette: v })}
      />

      <Text style={styles.foot}>
        {dnaReady
          ? "Today and Shop now pull looks that match this mix. Change it anytime."
          : "Pick a style to start. We’ll reshape Today around it."}
      </Text>

      <Pressable onPress={() => router.push("/plus")} style={styles.plan}>
        <View>
          <Text style={styles.planH}>{app.isPlus ? "Uvel+" : "Free plan"}</Text>
          <Text style={styles.planP}>
            {app.isPlus
              ? `${app.plusPlan === "yearly" ? "Yearly" : "Monthly"} · unlimited try-on`
              : `${app.remainingFinds} finds · ${app.remainingTryOns} try-on left`}
          </Text>
        </View>
        {!app.isPlus ? <Text style={styles.planGo}>Get Uvel+</Text> : null}
      </Pressable>

      {mine.length ? (
        <>
          <View style={styles.headRow}>
            <Text style={styles.h2}>Your listings</Text>
            <Pressable onPress={() => router.push("/(tabs)/closet")}>
              <Text style={styles.see}>See all</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {mine.slice(0, 6).map((p) => (
              <View key={p.id} style={{ width: 168 }}>
                <ListingCard piece={p} framed />
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}
    </ScrollView>
  );
}

function ChipBlock({
  label,
  items,
  value,
  hint,
  onPick,
}: {
  label: string;
  items: string[];
  value: string;
  hint: string;
  onPick: (v: string) => void;
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={chip.meta}>{label}</Text>
      <View style={chip.wrap}>
        {items.map((item) => {
          const on = value === item;
          return (
            <Pressable key={item} onPress={() => onPick(item)} style={[chip.chip, on && chip.chipOn]}>
              <Text style={[chip.txt, on && chip.txtOn]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
      {hint ? <Text style={chip.hint}>{hint}</Text> : null}
    </View>
  );
}

const chip = StyleSheet.create({
  meta: { color: "rgba(244,240,230,0.42)", fontSize: 12, marginBottom: 8, letterSpacing: 0.4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(244,240,230,0.14)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141310",
  },
  chipOn: { backgroundColor: "#F4F0E6", borderColor: "#F4F0E6" },
  txt: { color: "#F4F0E6", fontSize: 13, fontWeight: "600" },
  txtOn: { color: "#16140F" },
  hint: { color: "rgba(244,240,230,0.38)", fontSize: 12, marginTop: 8 },
});

function make(_colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: "#0B0A08" },
    content: { paddingHorizontal: 20 },
    kicker: { color: "rgba(244,240,230,0.42)", letterSpacing: 1.8, fontSize: 11, fontWeight: "600" },
    title: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 32, marginTop: 6, lineHeight: 36 },
    top: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1A1915", marginRight: 8, marginTop: 4 },
    menuBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.16)",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      marginTop: 4,
    },
    dash: { width: 16, height: 1.5, borderRadius: 1, backgroundColor: "#F4F0E6" },
    h2: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 26, marginTop: 22 },
    lede: { color: "rgba(244,240,230,0.58)", fontSize: 15, lineHeight: 22, marginTop: 8 },
    foot: { color: "rgba(244,240,230,0.4)", fontSize: 13, lineHeight: 19, marginTop: 16 },
    plan: {
      marginTop: 22,
      backgroundColor: "#161512",
      borderRadius: 20,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    planH: { color: "#F4F0E6", fontWeight: "700", fontSize: 16 },
    planP: { color: "rgba(244,240,230,0.5)", marginTop: 4, fontSize: 13 },
    planGo: { color: "#F4F0E6", fontWeight: "700", fontSize: 13 },
    headRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    see: { color: "rgba(244,240,230,0.42)", fontSize: 15 },
    strip: { gap: 12, paddingTop: 14, paddingRight: 8 },
  });
}
