import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { usd } from "../../lib/catalog";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { useWardrobe, type ClosetPiece } from "../../lib/wardrobe";

export default function Closet() {
  const colors = useColors();
  const styles = make(colors);
  const pieces = useWardrobe();
  const { wardrobeUris } = useUvel();
  const owned = pieces.filter((p) => p.status === "owned");
  const listed = pieces.filter((p) => p.status === "listed");
  const sold = pieces.filter((p) => p.status === "sold");

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>CLOSET</Text>
      <Text style={styles.title}>Sell on Uvel</Text>
      <Text style={styles.p}>
        Photograph a piece, or pull one from the fits you already showed us. We check the photo before it goes on the floor.
      </Text>

      <Pressable onPress={() => router.push("/sell")}>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>List an item</Text>
        </View>
      </Pressable>

      {wardrobeUris.length > 0 ? (
        <>
          <Text style={styles.h2}>From your fits</Text>
          <Text style={styles.p}>Looks you uploaded when we asked what feels like you.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            {wardrobeUris.map((uri) => (
              <Pressable key={uri} onPress={() => router.push("/sell")} style={{ marginRight: 10 }}>
                <Image source={{ uri }} style={styles.fit} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {listed.length > 0 ? (
        <>
          <Text style={styles.h2}>On the floor</Text>
          <Grid pieces={listed} colors={colors} />
        </>
      ) : null}

      {owned.length > 0 ? (
        <>
          <Text style={styles.h2}>In closet</Text>
          <Text style={styles.p}>Tap a piece to list it.</Text>
          <Grid pieces={owned} colors={colors} />
        </>
      ) : null}

      {sold.length > 0 ? (
        <>
          <Text style={styles.h2}>Sold</Text>
          <Grid pieces={sold} colors={colors} />
        </>
      ) : null}

      {pieces.length === 0 ? (
        <Text style={[styles.p, { marginTop: 28 }]}>
          Nothing listed yet. Lay it on the bed, shoot it in good light, and we’ll tell you if the photo will sell.
        </Text>
      ) : null}
    </ScrollView>
  );
}

function Grid({ pieces, colors }: { pieces: ClosetPiece[]; colors: Colors }) {
  const styles = make(colors);
  return (
    <View style={styles.grid}>
      {pieces.map((p) => (
        <Pressable key={p.id} style={styles.cell} onPress={() => router.push(`/closet/${p.id}`)}>
          <Image source={{ uri: p.photo }} style={styles.thumb} contentFit="cover" />
          <Text style={styles.meta}>{p.brand}</Text>
          <Text style={styles.h3} numberOfLines={1}>
            {p.name}
          </Text>
          <Text style={styles.meta}>
            {p.status === "listed" ? usd(p.listPriceCents) : p.status === "sold" ? "Sold" : p.color || p.size}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { padding: 20, paddingBottom: 48 },
    kicker: { color: colors.subtle, letterSpacing: 2, fontSize: 11 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, marginTop: 8 },
    p: { color: colors.muted, marginTop: 8, lineHeight: 20, fontSize: 14 },
    cta: {
      marginTop: 18,
      backgroundColor: "#D6E27A",
      borderRadius: 999,
      paddingVertical: 16,
      alignItems: "center",
    },
    ctaText: { color: "#16140F", fontWeight: "600", fontSize: 16 },
    h2: { color: colors.bone, fontFamily: "Georgia", fontSize: 24, marginTop: 28, marginBottom: 4 },
    h3: { color: colors.bone, fontWeight: "600", marginTop: 6 },
    meta: { color: colors.subtle, fontSize: 11, marginTop: 6 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
    cell: { width: "47%", flexGrow: 1 },
    thumb: { width: "100%", aspectRatio: 2 / 3, borderRadius: 18 },
    fit: { width: 92, height: 122, borderRadius: 12 },
  });
}
