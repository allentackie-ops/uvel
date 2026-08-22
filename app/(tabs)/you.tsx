import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Glass, GlassContainer } from "../../components/Glass";
import { ProductCard } from "../../components/ProductCard";
import { GARMENTS } from "../../lib/catalog";
import { useUvel } from "../../lib/store";
import { colors } from "../../lib/theme";

const ARCH = ["Quiet luxury", "Bourgeois chic", "Vintage archive", "Utility", "Romantic", "Western city", "Tailored city"];
const PALS = ["Earth & camel", "Ivory & ink", "Warm rust", "Stone & olive"];
const SILS = ["Oversized", "Tailored", "Fluid", "Cropped"];

export default function You() {
  const app = useUvel();
  const saved = GARMENTS.filter((g) => app.saved.includes(g.id));

  async function photo() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!res.canceled) app.setPerson(res.assets[0].uri);
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>YOU</Text>
      <Text style={styles.title}>Your closet</Text>

      <Glass style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.h3}>{app.isPlus ? "Uvel+" : "Free plan"}</Text>
            <Text style={styles.p}>
              {app.isPlus
                ? `${app.plusPlan === "yearly" ? "Yearly" : "Monthly"} membership`
                : `${app.remainingFinds} finds · ${app.remainingTryOns} try-on left`}
            </Text>
          </View>
          {!app.isPlus ? (
            <Pressable onPress={() => router.push("/plus")}>
              <Glass interactive style={styles.smallCta}>
                <Text style={styles.ctaText}>Get Uvel+</Text>
              </Glass>
            </Pressable>
          ) : null}
        </View>
      </Glass>

      <Text style={styles.h2}>Style DNA</Text>
      <ChipRow label="Style" items={ARCH} value={app.archetype} onPick={(v) => app.setStyle({ archetype: v })} />
      <ChipRow label="Palette" items={PALS} value={app.palette} onPick={(v) => app.setStyle({ palette: v })} />
      <ChipRow label="Silhouette" items={SILS} value={app.silhouette} onPick={(v) => app.setStyle({ silhouette: v })} />

      <Pressable onPress={() => void photo()}>
        <Glass style={styles.photoRow}>
          {app.personUri ? (
            <Image source={{ uri: app.personUri }} style={styles.avatar} contentFit="cover" />
          ) : null}
          <View>
            <Text style={styles.h3}>Try-on photo</Text>
            <Text style={styles.p}>Full length, natural light</Text>
          </View>
        </Glass>
      </Pressable>

      {saved.length > 0 ? (
        <>
          <Text style={styles.h2}>Saved</Text>
          <View style={styles.grid}>
            {saved.map((g) => (
              <View key={g.id} style={styles.cell}>
                <ProductCard garment={g} />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function ChipRow({
  label,
  items,
  value,
  onPick,
}: {
  label: string;
  items: string[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.meta}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <GlassContainer spacing={8} style={styles.row}>
          {items.map((item) => (
            <Pressable key={item} onPress={() => onPick(item)}>
              <Glass interactive style={[styles.chip, value === item && styles.chipOn]}>
                <Text style={[styles.chipText, value === item && styles.chipTextOn]}>{item}</Text>
              </Glass>
            </Pressable>
          ))}
        </GlassContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink },
  content: { padding: 20, paddingBottom: 48 },
  kicker: { color: colors.subtle, letterSpacing: 2, fontSize: 11 },
  title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, marginTop: 8, marginBottom: 16 },
  h2: { color: colors.bone, fontFamily: "Georgia", fontSize: 24, marginTop: 20, marginBottom: 10 },
  h3: { color: colors.bone, fontWeight: "600" },
  p: { color: colors.muted, marginTop: 4, fontSize: 13 },
  meta: { color: colors.subtle, fontSize: 12, marginBottom: 8 },
  card: { borderRadius: 24, padding: 18 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  smallCta: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  ctaText: { color: colors.bone, fontWeight: "600", fontSize: 13 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, marginTop: 8 },
  avatar: { width: 56, height: 72, borderRadius: 10 },
  row: { flexDirection: "row", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.bone },
  chipText: { color: colors.bone, fontSize: 13 },
  chipTextOn: { color: colors.ink },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { width: "47%", flexGrow: 1 },
});
