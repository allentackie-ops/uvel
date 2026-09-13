import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ownedBrand, useBrands } from "../lib/brands";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { likesOnMine, useWardrobe } from "../lib/wardrobe";

export default function SellerAnalytics() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  useBrands();
  const pieces = useWardrobe();
  const mine = ownedBrand(app.uid);

  useEffect(() => {
    if (mine) router.replace({ pathname: "/brand/hq", params: { id: mine.id } });
  }, [mine?.id]);

  const owned = useMemo(
    () => pieces.filter((piece) => Boolean(app.uid) && piece.ownerId === app.uid),
    [pieces, app.uid],
  );
  const listed = owned.filter((piece) => piece.status === "listed");
  const sold = owned.filter((piece) => piece.status === "sold").length;
  const likes = likesOnMine(app.uid).length;
  const views = listed.reduce((sum, piece) => sum + Math.max(0, piece.views || 0), 0);
  const maxViews = Math.max(1, ...listed.map((piece) => Math.max(0, piece.views || 0)));
  const ranked = listed
    .slice()
    .sort((a, b) => (b.views || 0) + (b.likedBy?.length || 0) - ((a.views || 0) + (a.likedBy?.length || 0)));

  if (!app.uid) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
        <Header styles={styles} />
        <Text style={styles.empty}>Sign in to see how your pieces are doing.</Text>
      </View>
    );
  }

  if (mine) return <View style={styles.page} />;

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Header styles={styles} />
        <View style={styles.stats}>
          <Stat label="Listed" value={String(listed.length)} styles={styles} />
          <Stat label="Views" value={String(views)} styles={styles} />
          <Stat label="Likes" value={String(likes)} styles={styles} />
          <Stat label="Sold" value={String(sold)} styles={styles} />
        </View>
        {ranked.length ? (
          ranked.map((piece) => {
            const pieceViews = Math.max(0, piece.views || 0);
            const saves = (piece.likedBy || []).length;
            return (
              <Pressable
                key={piece.id}
                onPress={() => router.push({ pathname: "/closet/[id]", params: { id: piece.id } })}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={`${piece.name}, ${pieceViews} views, ${saves} likes`}
              >
                {piece.photo ? <Image source={{ uri: piece.photo }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>{piece.name}</Text>
                  <Text style={styles.meta}>{pieceViews} views · {saves} likes</Text>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.max(3, (pieceViews / maxViews) * 100)}%` }]} />
                  </View>
                </View>
                <Text style={styles.go}>›</Text>
              </Pressable>
            );
          })
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Nothing listed yet</Text>
            <Pressable onPress={() => router.push("/sell")} style={styles.cta} accessibilityRole="button" accessibilityLabel="List a piece">
              <Text style={styles.ctaTxt}>List a piece</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Header({ styles }: { styles: ReturnType<typeof make> }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
        <Text style={styles.backTxt}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle}>Your listings</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

function Stat({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof make> }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
    back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    backTxt: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    headerTitle: { color: colors.bone, fontSize: 17, fontWeight: "600" },
    stats: { flexDirection: "row", gap: 8, marginBottom: 22 },
    stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center" },
    statValue: { color: colors.bone, fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
    statLabel: { color: colors.muted, fontSize: 11, marginTop: 4 },
    row: { backgroundColor: colors.surface, borderRadius: 16, padding: 10, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    thumb: { width: 54, height: 68, borderRadius: 10, backgroundColor: colors.ink },
    name: { color: colors.bone, fontSize: 15, fontWeight: "700" },
    meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
    track: { height: 4, borderRadius: 2, backgroundColor: colors.ink, marginTop: 8, overflow: "hidden" },
    fill: { height: 4, borderRadius: 2, backgroundColor: colors.success },
    go: { color: colors.muted, fontSize: 22 },
    emptyBox: { backgroundColor: colors.surface, borderRadius: 18, padding: 22, alignItems: "center", marginTop: 8 },
    emptyTitle: { color: colors.bone, fontSize: 16, fontWeight: "700" },
    cta: { marginTop: 16, minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    ctaTxt: { color: colors.successInk, fontSize: 14, fontWeight: "800" },
    empty: { color: colors.muted, fontSize: 15, paddingHorizontal: 20, marginTop: 24 },
  });
}
