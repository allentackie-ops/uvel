import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { openWithLoad } from "../../lib/brandLoad";
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
import { BrandScreen } from "../../components/BrandLoader";
import { usd } from "../../lib/catalog";
import { shopLookOf, type ShopLook } from "../../lib/shopLook";
import { useUvel } from "../../lib/store";
import { getPiece, useWardrobe, wardrobeReady } from "../../lib/wardrobe";

const W = Dimensions.get("window").width;
const HERO_H = Math.round(W * (5 / 4));

export default function ClosetPiece() {
  const insets = useSafeAreaInsets();
  const { id, v } = useLocalSearchParams<{ id: string; v?: string }>();
  useWardrobe();
  const piece = getPiece(id);
  const buying = v === "buy";
  const [page, setPage] = useState(0);
  const app = useUvel();
  const look = shopLookOf(piece?.shopLook);
  const styles = useMemo(() => make(look), [look]);

  if (!piece) {
    if (!wardrobeReady()) return <BrandScreen />;
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
  const framed = look.photo === "frame";
  const runway = look.photo === "runway";
  const heroH = framed ? Math.round(W * 1.05) : HERO_H;
  const imgW = framed ? W - 32 : W;
  const imgH = framed ? heroH - 24 : heroH;

  function tryOnMe() {
    if (!app.isPlus && app.remainingTryOns <= 0) {
      router.push("/plus");
      return;
    }
    openWithLoad({ pathname: "/try-on", params: { piece: pieceId } });
  }

  return (
    <View style={styles.page}>
      <StatusBar style={look.status} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: onFloor ? 168 : 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: heroH, paddingHorizontal: framed ? 16 : 0, paddingTop: framed ? 8 : 0 }}>
          <ScrollView
            horizontal
            pagingEnabled={!framed}
            snapToInterval={framed ? imgW : undefined}
            decelerationRate={framed ? "fast" : "normal"}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (framed ? imgW : W)))}
          >
            {gallery.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={[styles.hero, { width: imgW, height: imgH, borderRadius: framed ? 18 : 0 }]}
                contentFit="cover"
              />
            ))}
          </ScrollView>
          {gallery.length > 1 ? (
            <View style={styles.dots}>
              {gallery.map((_, i) => (
                <View key={i} style={[styles.dot, i === page && { backgroundColor: look.accent, width: 16 }]} />
              ))}
            </View>
          ) : null}
          {runway ? (
            <View style={styles.runway}>
              <Text style={styles.brand}>{piece.brand !== "Unlabeled" ? piece.brand : "Uvel closet"}</Text>
              <Text style={styles.runwayTitle}>{piece.name}</Text>
              <Text style={styles.price}>{usd(piece.listPriceCents, piece.currency || "USD")}</Text>
            </View>
          ) : null}
          <Pressable onPress={() => router.back()} style={[styles.back, { top: insets.top + 6 }]} hitSlop={8}>
            <Text style={[styles.backTxt, { color: look.status === "dark" ? "#16140F" : "#F4F0E6" }]}>‹</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {!runway ? (
            <>
              <View style={styles.topline}>
                <Text style={styles.brand}>{piece.brand !== "Unlabeled" ? piece.brand : "Uvel closet"}</Text>
                {piece.status === "sold" ? <Text style={[styles.sold, { color: look.accent }]}>Sold</Text> : null}
              </View>
              <Text style={styles.title}>{piece.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{usd(piece.listPriceCents, piece.currency || "USD")}</Text>
                {piece.originalPriceCents > 0 ? (
                  <Text style={styles.was}>{usd(piece.originalPriceCents, piece.currency || "USD")}</Text>
                ) : null}
              </View>
            </>
          ) : null}

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

          {piece.material || piece.category ? (
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
              onPress={() => openWithLoad({ pathname: "/ask/[id]", params: { id: piece.id } })}
              style={styles.ask}
            >
              <Text style={styles.askTxt}>Ask</Text>
            </Pressable>
            <Pressable
              onPress={() => openWithLoad({ pathname: "/checkout/[id]", params: { id: piece.id } })}
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

function make(look: ShopLook) {
  const lightBar = look.status === "dark";
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: look.page },
    hero: { backgroundColor: look.surface },
    dots: {
      position: "absolute",
      bottom: 16,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: look.muted },
    back: {
      position: "absolute",
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: lightBar ? "rgba(244,240,230,0.72)" : "rgba(18,17,14,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    backTxt: { fontSize: 28, lineHeight: 30, marginTop: -2 },
    body: { paddingHorizontal: 22, paddingTop: 20 },
    topline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    brand: { color: look.muted, letterSpacing: 1.4, fontSize: 11, textTransform: "uppercase" },
    sold: { fontSize: 12, fontWeight: "700", letterSpacing: 1 },
    title: { color: look.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 8 },
    runwayTitle: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 28, lineHeight: 32, marginTop: 6 },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 12 },
    price: { color: look.bone, fontWeight: "700", fontSize: 28 },
    was: { color: look.muted, fontSize: 16, textDecorationLine: "line-through" },
    facts: {
      flexDirection: "row",
      marginTop: 22,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: look.muted,
    },
    fact: { flex: 1, paddingVertical: 14 },
    factK: { color: look.muted, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" },
    factV: { color: look.bone, fontSize: 15, fontWeight: "600", marginTop: 4 },
    metaRow: { flexDirection: "row", gap: 16, marginTop: 18 },
    notes: { color: look.bone, fontSize: 16, lineHeight: 24, marginTop: 22 },
    p: { color: look.muted, lineHeight: 22 },
    cta: {
      marginTop: 28,
      height: 54,
      borderRadius: 27,
      backgroundColor: look.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaTxt: { color: look.accentInk, fontWeight: "700", fontSize: 16 },
    dock: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 10,
      backgroundColor: look.page,
    },
    try: {
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: look.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    tryTxt: { color: look.accent, fontWeight: "700", fontSize: 15 },
    dockRow: { flexDirection: "row", gap: 10 },
    ask: {
      height: 54,
      paddingHorizontal: 22,
      borderRadius: 27,
      backgroundColor: look.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    askTxt: { color: look.bone, fontWeight: "600", fontSize: 16 },
    buy: {
      flex: 1,
      height: 54,
      borderRadius: 27,
      backgroundColor: look.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    runway: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 22,
      paddingBottom: 28,
      paddingTop: 64,
      backgroundColor: "rgba(11,10,8,0.42)",
    },
  });
}
