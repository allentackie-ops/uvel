import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usd } from "../../lib/catalog";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { getPiece, useWardrobe } from "../../lib/wardrobe";

const W = Dimensions.get("window").width;
const HERO_H = Math.round(W * (5 / 4));

export default function ClosetPiece() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { id, v } = useLocalSearchParams<{ id: string; v?: string }>();
  useWardrobe();
  const piece = getPiece(id);
  const buying = v === "buy";
  const [page, setPage] = useState(0);
  const app = useUvel();

  if (!piece) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 24, paddingHorizontal: 20 }]}>
        <Text style={styles.p}>That piece isn’t on the floor.</Text>
      </View>
    );
  }

  const onFloor = piece.status === "listed";

  const gallery = piece.photos?.length ? piece.photos : piece.photo ? [piece.photo] : [];
  const facts = [
    { k: "Size", v: piece.size },
    { k: "Colour", v: piece.color },
    { k: "Condition", v: piece.condition },
  ].filter((f) => f.v);
  const pieceId = piece.id;

  function tryOnMe() {
    if (!app.isPlus && app.remainingTryOns <= 0) {
      router.push("/plus");
      return;
    }
    router.push({ pathname: "/try-on", params: { piece: pieceId } });
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: onFloor ? 168 : 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: HERO_H }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / W))}
          >
            {gallery.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.hero} contentFit="cover" />
            ))}
          </ScrollView>
          {gallery.length > 1 ? (
            <View style={styles.dots}>
              {gallery.map((_, i) => (
                <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
              ))}
            </View>
          ) : null}
          <Pressable onPress={() => router.back()} style={[styles.back, { top: insets.top + 6 }]} hitSlop={8}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.topline}>
            <Text style={styles.brand}>{piece.brand !== "Unlabeled" ? piece.brand : "Uvel closet"}</Text>
            {piece.status === "sold" ? <Text style={styles.sold}>Sold</Text> : null}
          </View>
          <Text style={styles.title}>{piece.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{usd(piece.listPriceCents, piece.currency || "USD")}</Text>
            {piece.originalPriceCents > 0 ? (
              <Text style={styles.was}>{usd(piece.originalPriceCents, piece.currency || "USD")}</Text>
            ) : null}
          </View>

          {facts.length ? (
            <View style={styles.facts}>
              {facts.map((f) => (
                <View key={f.k} style={styles.fact}>
                  <Text style={styles.factK}>{f.k}</Text>
                  <Text style={styles.factV}>{f.v}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {(piece.material || piece.category) ? (
            <View style={styles.metaRow}>
              {piece.material ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.factK}>Material</Text>
                  <Text style={styles.factV}>{piece.material}</Text>
                </View>
              ) : null}
              {piece.category ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.factK}>Category</Text>
                  <Text style={styles.factV}>{piece.category}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {piece.notes ? <Text style={styles.notes}>{piece.notes}</Text> : null}

          {!buying && piece.status === "owned" ? (
            <Pressable onPress={() => router.push({ pathname: "/sell", params: { id: piece.id } })} style={styles.cta}>
              <Text style={styles.ctaTxt}>List this piece</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {onFloor ? (
        <View style={[styles.dock, { paddingBottom: insets.bottom + 10 }]}>
          <Pressable onPress={tryOnMe} style={styles.try}>
            <Text style={styles.tryTxt}>Try on me</Text>
          </Pressable>
          <View style={styles.dockRow}>
            <Pressable
              onPress={() => router.push({ pathname: "/ask/[id]", params: { id: piece.id } })}
              style={styles.ask}
            >
              <Text style={styles.askTxt}>Ask</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/checkout/[id]", params: { id: piece.id } })}
              style={styles.buy}
            >
              <Text style={styles.ctaTxt}>Buy · {usd(piece.listPriceCents, piece.currency || "USD")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    hero: { width: W, height: HERO_H, backgroundColor: colors.surface },
    dots: {
      position: "absolute",
      bottom: 16,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(244,240,230,0.35)" },
    dotOn: { backgroundColor: "#D6E27A", width: 16 },
    back: {
      position: "absolute",
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(18,17,14,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    backTxt: { color: "#F4F0E6", fontSize: 28, lineHeight: 30, marginTop: -2 },
    more: {
      position: "absolute",
      right: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(18,17,14,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    moreTxt: { color: "#F4F0E6", fontSize: 18, letterSpacing: 1, fontWeight: "700" },
    body: { paddingHorizontal: 22, paddingTop: 20 },
    topline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    brand: { color: colors.subtle, letterSpacing: 1.4, fontSize: 11, textTransform: "uppercase" },
    sold: { color: "#D6E27A", fontSize: 12, fontWeight: "700", letterSpacing: 1 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 8 },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 12 },
    price: { color: colors.bone, fontWeight: "700", fontSize: 28 },
    was: { color: colors.subtle, fontSize: 16, textDecorationLine: "line-through" },
    facts: {
      flexDirection: "row",
      marginTop: 22,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(244,240,230,0.12)",
    },
    fact: { flex: 1, paddingVertical: 14 },
    factK: { color: colors.subtle, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" },
    factV: { color: colors.bone, fontSize: 15, fontWeight: "600", marginTop: 4 },
    metaRow: { flexDirection: "row", gap: 16, marginTop: 18 },
    notes: { color: colors.bone, fontSize: 16, lineHeight: 24, marginTop: 22 },
    p: { color: colors.muted, lineHeight: 22 },
    cta: {
      marginTop: 28,
      height: 54,
      borderRadius: 27,
      backgroundColor: "#D6E27A",
      alignItems: "center",
      justifyContent: "center",
    },
    ctaTxt: { color: "#16140F", fontWeight: "700", fontSize: 16 },
    dock: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 10,
      backgroundColor: colors.ink,
    },
    try: {
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: "#D6E27A",
      alignItems: "center",
      justifyContent: "center",
    },
    tryTxt: { color: "#D6E27A", fontWeight: "700", fontSize: 15 },
    dockRow: { flexDirection: "row", gap: 10 },
    ask: {
      height: 54,
      paddingHorizontal: 22,
      borderRadius: 27,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    askTxt: { color: colors.bone, fontWeight: "600", fontSize: 16 },
    buy: {
      flex: 1,
      height: 54,
      borderRadius: 27,
      backgroundColor: "#D6E27A",
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
