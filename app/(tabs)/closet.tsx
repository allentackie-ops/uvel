import { Image } from "expo-image";
import { router } from "expo-router";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usd } from "../../lib/catalog";
import { useUvel } from "../../lib/store";
import { useColors, type Colors } from "../../lib/theme";
import { markSold, removePiece, unlistPiece, useWardrobe, type ClosetPiece } from "../../lib/wardrobe";

export default function Closet() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const pieces = useWardrobe();
  const { wardrobeUris } = useUvel();
  const owned = pieces.filter((p) => p.status === "owned");
  const listed = pieces.filter((p) => p.status === "listed");
  const sold = pieces.filter((p) => p.status === "sold");

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 108 }]}
    >
      <Text style={styles.kicker}>CLOSET</Text>
      <Text style={styles.title}>Sell on Uvel</Text>
      <Text style={styles.p}>
        Photograph a piece, or pull one from the fits you already showed us. We check the photo before it goes on the floor.
      </Text>

      <Pressable onPress={() => router.push("/sell")} style={styles.cta}>
        <Text style={styles.ctaText}>List an item</Text>
      </Pressable>

      {wardrobeUris.length > 0 ? (
        <Pressable onPress={() => router.push({ pathname: "/sell", params: { fits: "1" } })} style={styles.fitsLink}>
          <Text style={styles.fitsLinkTxt}>From your previous fits →</Text>
        </Pressable>
      ) : (
        <View style={{ height: 18 }} />
      )}

      <View style={styles.headRow}>
        <Text style={styles.h2}>In the shop</Text>
        <Pressable onPress={() => router.push("/(tabs)/shop")}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>

      {listed.length ? (
        listed.map((p) => <FloorCard key={p.id} piece={p} styles={styles} />)
      ) : (
        <Text style={styles.empty}>Nothing live yet. List a piece and it sits here.</Text>
      )}

      {owned.length > 0 ? (
        <>
          <Text style={[styles.h2, { marginTop: 28 }]}>In closet</Text>
          <Text style={styles.p}>Tap a piece to list it.</Text>
          <Grid pieces={owned} colors={colors} />
        </>
      ) : null}

      {sold.length > 0 ? (
        <>
          <Text style={[styles.h2, { marginTop: 28 }]}>Sold</Text>
          <Grid pieces={sold} colors={colors} />
        </>
      ) : null}
    </ScrollView>
  );
}

function FloorCard({
  piece: p,
  styles,
}: {
  piece: ClosetPiece;
  styles: ReturnType<typeof make>;
}) {
  function share() {
    void Share.share({
      message: `${p.name} · ${usd(p.listPriceCents, p.currency || "USD")} on Uvel`,
    });
  }

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/closet/[id]", params: { id: p.id, v: "own" } })}
      onLongPress={() => manageListing(p)}
      style={styles.floor}
    >
      <Image source={{ uri: p.photo }} style={styles.floorImg} contentFit="cover" />
      <View style={styles.floorMeta}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.brand}>{(p.brand === "Unlabeled" ? "Unlabeled" : p.brand).toUpperCase()}</Text>
          <Text style={styles.floorName} numberOfLines={2}>
            {p.name}
          </Text>
          <Text style={styles.floorPrice}>{usd(p.listPriceCents, p.currency || "USD")}</Text>
        </View>
        <Pressable onPress={share} hitSlop={8} style={styles.iconBtn}>
          <Text style={styles.iconTxt}>↗</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function manageListing(p: ClosetPiece) {
  if (p.status !== "listed") {
    router.push({ pathname: "/sell", params: { id: p.id } });
    return;
  }
  const options = ["Edit listing", "Unlist", "Mark sold", "Remove", "Cancel"];
  const run = (i: number) => {
    if (i === 0) router.push({ pathname: "/sell", params: { id: p.id } });
    if (i === 1) unlistPiece(p.id);
    if (i === 2) markSold(p.id);
    if (i === 3) removePiece(p.id);
  };
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 4, destructiveButtonIndex: 3 }, run);
    return;
  }
  Alert.alert(p.name, undefined, [
    { text: "Edit listing", onPress: () => run(0) },
    { text: "Unlist", onPress: () => run(1) },
    { text: "Mark sold", onPress: () => run(2) },
    { text: "Remove", style: "destructive", onPress: () => run(3) },
    { text: "Cancel", style: "cancel" },
  ]);
}

function Grid({ pieces, colors }: { pieces: ClosetPiece[]; colors: Colors }) {
  const styles = make(colors);
  return (
    <View style={styles.grid}>
      {pieces.map((p) => (
        <Pressable
          key={p.id}
          style={styles.cell}
          onPress={() => router.push({ pathname: "/sell", params: { id: p.id } })}
          onLongPress={() => manageListing(p)}
        >
          <Image source={{ uri: p.photo }} style={styles.thumb} contentFit="cover" />
          <Text style={styles.meta}>{p.brand}</Text>
          <Text style={styles.h3} numberOfLines={1}>
            {p.name}
          </Text>
          <Text style={styles.meta}>
            {p.status === "sold" ? "Sold" : p.color || p.size}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: "#0B0A08" },
    content: { paddingHorizontal: 20 },
    kicker: { color: "rgba(244,240,230,0.42)", letterSpacing: 1.8, fontSize: 11, fontWeight: "600" },
    title: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 34, marginTop: 8, lineHeight: 38 },
    p: { color: "rgba(244,240,230,0.58)", marginTop: 10, lineHeight: 22, fontSize: 15 },
    cta: {
      marginTop: 22,
      backgroundColor: "#F4F0E6",
      borderRadius: 28,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaText: { color: "#16140F", fontWeight: "600", fontSize: 16 },
    fitsLink: { alignSelf: "center", marginTop: 16, marginBottom: 8 },
    fitsLinkTxt: {
      color: "rgba(244,240,230,0.72)",
      fontSize: 15,
      textDecorationLine: "underline",
    },
    headRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginTop: 22,
      marginBottom: 14,
    },
    h2: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 26 },
    seeAll: { color: "rgba(244,240,230,0.42)", fontSize: 15 },
    empty: { color: "rgba(244,240,230,0.45)", fontSize: 14, lineHeight: 20 },
    floor: {
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: "#161512",
      marginBottom: 14,
    },
    floorImg: { width: "100%", height: 420, backgroundColor: "#1A1915" },
    floorMeta: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 16,
    },
    brand: { color: "rgba(244,240,230,0.42)", fontSize: 11, letterSpacing: 1.4, fontWeight: "700" },
    floorName: { color: "#F4F0E6", fontSize: 18, fontWeight: "700", marginTop: 6, lineHeight: 22 },
    floorPrice: { color: "#F4F0E6", fontSize: 17, fontWeight: "700", marginTop: 6 },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(244,240,230,0.22)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    iconTxt: { color: "#F4F0E6", fontSize: 14 },
    h3: { color: colors.bone, fontWeight: "600", marginTop: 6 },
    meta: { color: colors.subtle, fontSize: 11, marginTop: 6 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
    cell: { width: "47%", flexGrow: 1 },
    thumb: { width: "100%", aspectRatio: 2 / 3, borderRadius: 18 },
  });
}
