import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usd } from "../../lib/catalog";
import { getMarket } from "../../lib/markets";
import { shopLookOf, type ShopLook } from "../../lib/shopLook";
import { useUvel } from "../../lib/store";
import { getPiece, useWardrobe } from "../../lib/wardrobe";

const W = Dimensions.get("window").width;
const HERO_H = Math.round(W * 1.28);

const SWATCH: Record<string, string> = {
  olive: "#6E7C3A",
  green: "#2F6B3A",
  black: "#111111",
  white: "#F4F0E6",
  cream: "#E8DFD0",
  ivory: "#F4F0E6",
  navy: "#1B2A4A",
  blue: "#2C4C8A",
  red: "#9B1C2C",
  burgundy: "#6B1D2A",
  wine: "#5A1824",
  brown: "#5C3A24",
  tan: "#C4A574",
  beige: "#D8C7A8",
  pink: "#D9A3B0",
  gold: "#C9A96E",
  silver: "#C5C0B6",
  grey: "#8A8580",
  gray: "#8A8580",
  yellow: "#D6C25A",
  orange: "#C4652A",
  purple: "#5C3D7A",
  camel: "#C4A574",
  khaki: "#9A8B5C",
  rust: "#A24A2A",
};

function swatchOf(color?: string) {
  if (!color) return null;
  const n = color.toLowerCase();
  const hit = Object.keys(SWATCH).find((k) => n.includes(k));
  return hit ? SWATCH[hit] : null;
}

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
  const market = getMarket(piece?.country || app.country);
  const liked = piece ? app.saved.includes(piece.id) : false;

  if (!piece) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 24, paddingHorizontal: 20 }]}>
        <Text style={styles.p}>That piece isn’t on the floor.</Text>
      </View>
    );
  }

  const onFloor = piece.status === "listed";
  const gallery = piece.photos?.length ? piece.photos : piece.photo ? [piece.photo] : [];
  const pieceId = piece.id;
  const framed = look.photo === "frame";
  const runway = look.photo === "runway";
  const heroH = framed ? Math.round(W * 1.12) : HERO_H;
  const imgW = framed ? W - 28 : W;
  const imgH = framed ? heroH - 28 : heroH;
  const brand = piece.brand !== "Unlabeled" ? piece.brand : "Uvel closet";
  const chip = swatchOf(piece.color);
  const seller = piece.ownerName || "Uvel member";
  const plusLook = Boolean(piece.shopLook && piece.shopLook !== "uvel");

  function tryOnMe() {
    if (!app.isPlus && app.remainingTryOns <= 0) {
      router.push("/plus");
      return;
    }
    router.push({ pathname: "/try-on", params: { piece: pieceId } });
  }

  return (
    <View style={styles.page}>
      <StatusBar style={look.status} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: onFloor ? 176 : 56 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: heroH, paddingHorizontal: framed ? 14 : 0, paddingTop: framed ? 12 : 0 }}>
          <ScrollView
            horizontal
            pagingEnabled={!framed}
            snapToInterval={framed ? imgW + 8 : undefined}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setPage(Math.round(e.nativeEvent.contentOffset.x / (framed ? imgW + 8 : W)))
            }
          >
            {gallery.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={[styles.hero, { width: imgW, height: imgH, borderRadius: framed ? 4 : 0 }]}
                contentFit="cover"
              />
            ))}
          </ScrollView>
          {!framed && !runway ? (
            <View style={styles.fade} pointerEvents="none">
              <View style={[styles.fadeBand, { opacity: 0.12 }]} />
              <View style={[styles.fadeBand, { opacity: 0.28 }]} />
              <View style={[styles.fadeBand, { opacity: 0.55 }]} />
              <View style={[styles.fadeBand, { opacity: 0.85 }]} />
            </View>
          ) : null}
          {gallery.length > 1 ? (
            <View style={[styles.count, { top: insets.top + 10 }]}>
              <Text style={styles.countTxt}>
                {String(page + 1).padStart(2, "0")} / {String(gallery.length).padStart(2, "0")}
              </Text>
            </View>
          ) : null}
          {runway ? (
            <View style={styles.runway}>
              <Text style={styles.brand}>{brand}</Text>
              <Text style={styles.runwayTitle}>{piece.name}</Text>
              <Text style={styles.price}>{usd(piece.listPriceCents, piece.currency || "USD")}</Text>
            </View>
          ) : null}
          <Pressable onPress={() => router.back()} style={[styles.iconBtn, { top: insets.top + 6, left: 16 }]} hitSlop={8}>
            <Text style={[styles.iconTxt, { color: look.status === "dark" ? "#16140F" : "#F4F0E6" }]}>‹</Text>
          </Pressable>
          <Pressable
            onPress={() => app.toggleSaved(piece.id)}
            style={[styles.iconBtn, { top: insets.top + 6, right: 16 }]}
            hitSlop={8}
          >
            <Text style={[styles.heart, { color: liked ? look.accent : look.status === "dark" ? "#16140F" : "#F4F0E6" }]}>
              {liked ? "♥" : "♡"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {!runway ? (
            <>
              <View style={styles.kicker}>
                <Text style={styles.brand}>{brand}</Text>
                <View style={styles.rule} />
                {piece.status === "sold" ? <Text style={styles.sold}>Sold</Text> : null}
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

          <View style={styles.specs}>
            {piece.size ? (
              <View style={styles.spec}>
                <Text style={styles.factK}>Size</Text>
                <View style={styles.sizePill}>
                  <Text style={styles.sizeTxt}>{piece.size}</Text>
                </View>
              </View>
            ) : null}
            {piece.color ? (
              <View style={styles.spec}>
                <Text style={styles.factK}>Colour</Text>
                <View style={styles.colorRow}>
                  {chip ? <View style={[styles.swatch, { backgroundColor: chip }]} /> : null}
                  <Text style={styles.factV}>{piece.color}</Text>
                </View>
              </View>
            ) : null}
            {piece.condition ? (
              <View style={styles.spec}>
                <Text style={styles.factK}>Condition</Text>
                <Text style={styles.factV}>{piece.condition}</Text>
              </View>
            ) : null}
          </View>

          {piece.notes ? (
            <View style={styles.block}>
              <Text style={styles.section}>About this piece</Text>
              <Text style={styles.notes}>{piece.notes}</Text>
            </View>
          ) : null}

          {piece.material || piece.category ? (
            <View style={styles.block}>
              <Text style={styles.section}>The details</Text>
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
            </View>
          ) : null}

          <View style={styles.seller}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>{(seller[0] || "U").toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerK}>Sold by</Text>
              <Text style={styles.sellerN}>{seller}</Text>
              <Text style={styles.sellerP}>Ships from {market.name}</Text>
            </View>
          </View>

          {plusLook ? <Text style={styles.lookMark}>{look.name}</Text> : null}

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
            <Pressable onPress={() => router.push({ pathname: "/ask/[id]", params: { id: piece.id } })} style={styles.ask}>
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

function make(look: ShopLook) {
  const lightBar = look.status === "dark";
  const line = look.status === "dark" ? "rgba(22,20,15,0.14)" : "rgba(244,240,230,0.16)";
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: look.page },
    hero: { backgroundColor: look.surface },
    fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 88 },
    fadeBand: { flex: 1, backgroundColor: look.page },
    count: {
      position: "absolute",
      alignSelf: "center",
      left: 0,
      right: 0,
      alignItems: "center",
    },
    countTxt: {
      color: lightBar ? "#16140F" : "#F4F0E6",
      fontSize: 11,
      letterSpacing: 1.6,
      fontWeight: "600",
      backgroundColor: lightBar ? "rgba(244,240,230,0.7)" : "rgba(11,10,8,0.45)",
      overflow: "hidden",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    iconBtn: {
      position: "absolute",
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: lightBar ? "rgba(244,240,230,0.78)" : "rgba(18,17,14,0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
    iconTxt: { fontSize: 28, lineHeight: 30, marginTop: -2 },
    heart: { fontSize: 18, marginTop: 1 },
    body: { paddingHorizontal: 22, paddingTop: 10 },
    kicker: { flexDirection: "row", alignItems: "center", gap: 10 },
    brand: { color: look.muted, letterSpacing: 1.8, fontSize: 11, textTransform: "uppercase" },
    rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: look.accent, opacity: 0.55 },
    sold: { color: look.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
    title: { color: look.bone, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, marginTop: 12 },
    runwayTitle: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 28, lineHeight: 32, marginTop: 6 },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 14 },
    price: { color: look.bone, fontWeight: "700", fontSize: 26, letterSpacing: -0.3 },
    was: { color: look.muted, fontSize: 16, textDecorationLine: "line-through" },
    specs: {
      flexDirection: "row",
      gap: 8,
      marginTop: 22,
      paddingTop: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: line,
    },
    spec: { flex: 1, backgroundColor: look.surface, borderRadius: 16, padding: 12 },
    factK: { color: look.muted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" },
    factV: { color: look.bone, fontSize: 14, fontWeight: "600", marginTop: 6 },
    sizePill: {
      alignSelf: "flex-start",
      marginTop: 8,
      borderWidth: 1,
      borderColor: look.accent,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    sizeTxt: { color: look.bone, fontSize: 13, fontWeight: "700" },
    colorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
    swatch: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: line,
    },
    block: {
      marginTop: 22,
      paddingTop: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: line,
    },
    section: {
      color: look.muted,
      fontSize: 11,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    notes: { color: look.bone, fontSize: 16, lineHeight: 24 },
    metaRow: { flexDirection: "row", gap: 16 },
    seller: {
      marginTop: 22,
      paddingTop: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: line,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: look.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarTxt: { color: look.accentInk, fontWeight: "700", fontSize: 16 },
    sellerK: { color: look.muted, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase" },
    sellerN: { color: look.bone, fontSize: 16, fontWeight: "600", marginTop: 2 },
    sellerP: { color: look.muted, fontSize: 13, marginTop: 2 },
    lookMark: {
      marginTop: 28,
      color: look.muted,
      fontSize: 11,
      letterSpacing: 2,
      textTransform: "uppercase",
      textAlign: "center",
    },
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
      paddingTop: 12,
      backgroundColor: look.page,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: line,
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
