import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { usd } from "../../lib/catalog";
import {
  getPiece,
  listPiece,
  markSold,
  removePiece,
  unlistPiece,
  useWardrobe,
} from "../../lib/wardrobe";
import { useColors, type Colors } from "../../lib/theme";

export default function ClosetPiece() {
  const colors = useColors();
  const styles = make(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  useWardrobe();
  const piece = getPiece(id);
  const [price, setPrice] = useState(piece ? String(Math.round(piece.listPriceCents / 100)) : "80");
  const [notes, setNotes] = useState(piece?.notes ?? "");

  if (!piece) {
    return (
      <View style={styles.page}>
        <Text style={styles.p}>That piece isn’t in the wardrobe.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>CLOSET</Text>
      <Image source={{ uri: piece.photo }} style={styles.hero} contentFit="cover" />
      <Text style={styles.meta}>{piece.brand}</Text>
      <Text style={styles.title}>{piece.name}</Text>
      <Text style={styles.p}>
        {piece.color} · {piece.size} · {piece.category} · {piece.condition}
      </Text>
      <Text style={styles.meta}>{piece.status.toUpperCase()}</Text>

      {piece.status !== "sold" ? (
        <>
          <Text style={styles.h2}>List to sell</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={price}
            onChangeText={setPrice}
            placeholder="Price"
            placeholderTextColor={colors.subtle}
          />
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder="Note for the buyer"
            placeholderTextColor={colors.subtle}
          />
          {piece.status === "owned" ? (
            <Pressable
              onPress={() =>
                listPiece(piece.id, {
                  listPriceCents: Math.max(1, Number(price) || 0) * 100,
                  notes,
                })
              }
            >
              <View style={styles.cta}>
                <Text style={styles.ctaText}>
                  List for {usd(Math.max(1, Number(price) || 0) * 100)}
                </Text>
              </View>
            </Pressable>
          ) : (
            <>
              <Pressable onPress={() => unlistPiece(piece.id)}>
                <View style={[styles.cta, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.ctaText, { color: colors.bone }]}>Take off the floor</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => markSold(piece.id)}>
                <View style={[styles.cta, { marginTop: 8 }]}>
                  <Text style={styles.ctaText}>Mark sold</Text>
                </View>
              </Pressable>
            </>
          )}
        </>
      ) : (
        <Text style={styles.p}>Sold. It’s off the floor.</Text>
      )}

      <Pressable
        onPress={() => {
          removePiece(piece.id);
          router.back();
        }}
      >
        <Text style={[styles.meta, { marginTop: 28, textDecorationLine: "underline" }]}>
          Remove from wardrobe
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { padding: 20, paddingBottom: 48 },
    kicker: { color: colors.subtle, letterSpacing: 2, fontSize: 11 },
    hero: { width: "100%", aspectRatio: 3 / 4, borderRadius: 28, marginTop: 12 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 32, marginTop: 8 },
    p: { color: colors.muted, marginTop: 8, lineHeight: 20 },
    meta: { color: colors.subtle, fontSize: 12, marginTop: 10 },
    h2: { color: colors.bone, fontFamily: "Georgia", fontSize: 24, marginTop: 28, marginBottom: 12 },
    input: {
      height: 48,
      borderRadius: 999,
      paddingHorizontal: 16,
      color: colors.bone,
      backgroundColor: colors.surface,
      marginBottom: 10,
    },
    cta: { backgroundColor: colors.pulse, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
    ctaText: { color: colors.pulseInk, fontWeight: "600" },
  });
}
