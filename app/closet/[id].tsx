import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { usd } from "../../lib/catalog";
import { useColors, type Colors } from "../../lib/theme";
import { getPiece, markSold, removePiece, unlistPiece, useWardrobe } from "../../lib/wardrobe";

export default function ClosetPiece() {
  const colors = useColors();
  const styles = make(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  useWardrobe();
  const piece = getPiece(id);

  if (!piece) {
    return (
      <View style={styles.page}>
        <Text style={styles.p}>That piece isn’t in the wardrobe.</Text>
      </View>
    );
  }

  const gallery = piece.photos?.length ? piece.photos : [piece.photo];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>{piece.status.toUpperCase()}</Text>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.pager}>
        {gallery.map((uri) => (
          <Image key={uri} source={{ uri }} style={styles.hero} contentFit="cover" />
        ))}
      </ScrollView>
      <Text style={styles.meta}>
        {piece.brand}
        {piece.size ? ` · ${piece.size}` : ""}
      </Text>
      <Text style={styles.title}>{piece.name}</Text>
      <Text style={styles.price}>{usd(piece.listPriceCents)}</Text>
      {piece.originalPriceCents > 0 ? (
        <Text style={styles.was}>Was {usd(piece.originalPriceCents)}</Text>
      ) : null}
      <Text style={styles.p}>
        {[piece.color, piece.material, piece.category, piece.condition].filter(Boolean).join(" · ")}
      </Text>
      {piece.notes ? <Text style={styles.body}>{piece.notes}</Text> : null}

      {piece.status === "owned" ? (
        <Pressable onPress={() => router.push({ pathname: "/sell", params: { id: piece.id } })}>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>List this piece</Text>
          </View>
        </Pressable>
      ) : null}

      {piece.status === "listed" ? (
        <>
          <Pressable onPress={() => router.push({ pathname: "/sell", params: { id: piece.id } })}>
            <View style={styles.cta}>
              <Text style={styles.ctaText}>Edit listing</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => unlistPiece(piece.id)}>
            <View style={[styles.cta, styles.ghost]}>
              <Text style={[styles.ctaText, { color: colors.bone }]}>Take off the floor</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => markSold(piece.id)}>
            <View style={[styles.cta, styles.ghost]}>
              <Text style={[styles.ctaText, { color: colors.bone }]}>Mark sold</Text>
            </View>
          </Pressable>
        </>
      ) : null}

      {piece.status === "sold" ? <Text style={styles.p}>Sold. It’s off the floor.</Text> : null}

      <Pressable
        onPress={() => {
          removePiece(piece.id);
          router.back();
        }}
      >
        <Text style={[styles.meta, { marginTop: 28, textDecorationLine: "underline" }]}>Remove from wardrobe</Text>
      </Pressable>
    </ScrollView>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { padding: 20, paddingBottom: 48 },
    kicker: { color: colors.subtle, letterSpacing: 2, fontSize: 11 },
    pager: { marginTop: 12, marginHorizontal: -20 },
    hero: { width: 320, height: 420, borderRadius: 24, marginLeft: 20 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, marginTop: 8 },
    price: { color: colors.bone, fontSize: 20, fontWeight: "600", marginTop: 8 },
    was: { color: colors.subtle, textDecorationLine: "line-through", marginTop: 4 },
    p: { color: colors.muted, marginTop: 8, lineHeight: 20 },
    body: { color: colors.bone, marginTop: 16, lineHeight: 22, fontSize: 16 },
    meta: { color: colors.subtle, fontSize: 12, marginTop: 10 },
    cta: {
      marginTop: 14,
      backgroundColor: "#D6E27A",
      borderRadius: 999,
      paddingVertical: 16,
      alignItems: "center",
    },
    ghost: { backgroundColor: colors.surface },
    ctaText: { color: "#16140F", fontWeight: "600" },
  });
}
