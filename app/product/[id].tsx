import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Glass } from "../../components/Glass";
import { ProductCard } from "../../components/ProductCard";
import { GARMENTS, getGarment, usd } from "../../lib/catalog";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";

export default function Product() {
  const colors = useColors();
  const styles = make(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useUvel();
  const garment = getGarment(id);
  if (!garment) {
    return (
      <View style={styles.page}>
        <Text style={styles.p}>That piece has left the floor.</Text>
      </View>
    );
  }
  const similar = GARMENTS.filter(
    (g) => g.id !== garment.id && (g.category === garment.category || g.color === garment.color),
  ).slice(0, 4);
  const saved = app.saved.includes(garment.id);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Image source={garment.image} style={styles.hero} contentFit="cover" />
        <View style={styles.body}>
          <Text style={styles.brand}>{garment.brand.toUpperCase()}</Text>
          <Text style={styles.title}>{garment.name}</Text>
          <View style={styles.row}>
            <Text style={styles.price}>{usd(garment.priceCents)}</Text>
            <Glass style={styles.tag}><Text style={styles.tagText}>{garment.condition}</Text></Glass>
            <Glass style={styles.tag}><Text style={styles.tagText}>{garment.size}</Text></Glass>
            <Glass style={styles.tag}><Text style={styles.tagText}>{garment.era}</Text></Glass>
          </View>
          <Text style={styles.p}>{garment.description}</Text>
          <View style={[styles.row, { marginTop: 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.meta}>Material</Text>
              <Text style={styles.val}>{garment.material}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.meta}>Color</Text>
              <Text style={styles.val}>{garment.color}</Text>
            </View>
          </View>
          {similar.length > 0 ? (
            <>
              <Text style={styles.h2}>Nearby on the rack</Text>
              <View style={styles.grid}>
                {similar.map((g) => (
                  <View key={g.id} style={styles.cell}>
                    <ProductCard garment={g} />
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
      <Glass style={styles.bar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.val} numberOfLines={1}>{garment.name}</Text>
          <Text style={styles.meta}>{usd(garment.priceCents)}</Text>
        </View>
        <Pressable onPress={() => app.toggleSaved(garment.id)}>
          <Glass interactive style={styles.iconBtn}>
            <Text>{saved ? "♥" : "♡"}</Text>
          </Glass>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!app.isPlus && app.remainingTryOns <= 0) router.push("/plus");
            else router.push(`/(tabs)/try-on?g=${garment.id}`);
          }}
        >
          <Glass interactive style={styles.cta}>
            <Text style={styles.ctaText}>Try on me</Text>
          </Glass>
        </Pressable>
      </Glass>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink },
  hero: { width: "100%", aspectRatio: 2 / 3 },
  body: { padding: 20 },
  brand: { color: colors.subtle, letterSpacing: 1.6, fontSize: 11 },
  title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, marginTop: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10 },
  price: { color: colors.bone, fontSize: 18 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { color: colors.bone, fontSize: 11 },
  p: { color: colors.muted, marginTop: 14, lineHeight: 22 },
  meta: { color: colors.subtle, fontSize: 12 },
  val: { color: colors.bone, marginTop: 2 },
  h2: { color: colors.bone, fontFamily: "Georgia", fontSize: 24, marginTop: 28, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { width: "47%", flexGrow: 1 },
  bar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  cta: { backgroundColor: colors.pulse, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 },
  ctaText: { color: colors.bone, fontWeight: "600" },
});
}
