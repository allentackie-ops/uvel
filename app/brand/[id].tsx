import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActionSheetIOS, Alert, Dimensions, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandBanner } from "../../components/BrandBanner";
import { ListingCard } from "../../components/ListingCard";
import { VerifiedMark } from "../../components/VerifiedMark";
import {
  brandListings,
  canPost,
  canSeeAnalytics,
  canStudio,
  getBrand,
  isFollowing,
  recordBrandView,
  roleOn,
  themeFor,
  toggleFollow,
  useBrands,
} from "../../lib/brands";
import { usd } from "../../lib/catalog";
import { useUvel } from "../../lib/store";
import { useWardrobe } from "../../lib/wardrobe";

const W = Dimensions.get("window").width;
const COL = (W - 48) / 2;

export default function BrandPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBrands();
  useWardrobe();
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const brand = getBrand(id);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (id) recordBrandView(id);
  }, [id]);

  const theme = brand ? themeFor(brand) : null;
  const listings = useMemo(() => (id ? brandListings(id) : []), [id, tick, brand?.id]);
  const collections = useMemo(() => {
    const map = new Map<string, typeof listings>();
    for (const p of listings) {
      const arr = map.get(p.category) || [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return Array.from(map.entries()).map(([cat, items]) => ({ cat, items }));
  }, [listings]);
  const featured = collections[0]?.items[0];
  const following = brand ? isFollowing(brand.id, app.uid) : false;
  const poster = brand ? canPost(brand, app.uid) : false;
  const owner = brand ? canStudio(brand, app.uid) : false;
  const role = brand ? roleOn(brand, app.uid) : null;

  if (!brand || !theme) {
    return (
      <View style={[styles.missing, { paddingTop: insets.top + 20 }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: "#F4F0E6", fontSize: 16 }}>‹ Back</Text>
        </Pressable>
        <Text style={styles.missingH}>This house isn’t here</Text>
      </View>
    );
  }

  function more() {
    const options = ["Share", ...(owner ? ["Studio", "Invite team"] : []), ...(brand && canSeeAnalytics(brand, app.uid) ? ["Analytics"] : []), "Cancel"];
    const run = (label: string) => {
      if (label === "Share") {
        void Share.share({ message: `${brand.name} on Uvel  uvel://brand/${brand.id}` });
        return;
      }
      if (label === "Studio") router.push({ pathname: "/brand/studio", params: { id: brand.id } });
      if (label === "Invite team") router.push({ pathname: "/brand/invite", params: { id: brand.id } });
      if (label === "Analytics") router.push({ pathname: "/brand/analytics", params: { id: brand.id } });
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, userInterfaceStyle: "dark" }, (i) => {
        if (i >= 0 && options[i] !== "Cancel") run(options[i]);
      });
      return;
    }
    Alert.alert(brand.name, undefined, [
      ...options.filter((o) => o !== "Cancel").map((o) => ({ text: o, onPress: () => run(o) })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View>
          <BrandBanner uri={brand.bannerUri || brand.logoUri} kind={brand.bannerKind} style={styles.banner} />
          <View style={[styles.nav, { top: insets.top + 4 }]}>
            <Pressable onPress={() => router.back()} style={[styles.orb, { backgroundColor: "rgba(0,0,0,0.42)" }]}>
              <Text style={styles.orbTxt}>‹</Text>
            </Pressable>
            <Pressable onPress={more} style={[styles.orb, { backgroundColor: "rgba(0,0,0,0.42)" }]}>
              <Text style={[styles.orbTxt, { fontSize: 18, marginTop: -6 }]}>· · ·</Text>
            </Pressable>
          </View>
          {brand.logoUri ? (
            <Image source={{ uri: brand.logoUri }} style={[styles.logo, { borderColor: theme.bg }]} contentFit="cover" />
          ) : (
            <View style={[styles.logo, { borderColor: theme.bg, backgroundColor: theme.card, alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ color: theme.ink, fontWeight: "800", fontSize: 22 }}>{brand.name[0]}</Text>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 56 }}>
          <Text style={[styles.kicker, { color: theme.muted }]}>{brand.verified ? "VERIFIED BRAND" : "BRAND · IN REVIEW"}</Text>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.ink }]}>{brand.name}</Text>
            {brand.verified ? <VerifiedMark size={20} /> : null}
          </View>
          <Text style={[styles.handle, { color: theme.muted }]}>@{brand.handle}</Text>
          {brand.tagline ? <Text style={[styles.tagline, { color: theme.ink }]}>{brand.tagline}</Text> : null}
          <Text style={[styles.owner, { color: theme.muted }]}>
            Owner · {brand.ownerName}
            {role === "poster" ? "  ·  You post here" : role === "owner" ? "  ·  You" : ""}
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                toggleFollow(brand.id, app.uid || "me");
                setTick((n) => n + 1);
              }}
              style={[styles.follow, { backgroundColor: following ? theme.card : theme.accent }]}
            >
              <Text style={[styles.followTxt, { color: following ? theme.ink : theme.accentInk }]}>{following ? "Following" : "Follow"}</Text>
            </Pressable>
            {poster ? (
              <Pressable
                onPress={() => router.push({ pathname: "/brand/list", params: { id: brand.id } })}
                style={[styles.ghost, { borderColor: theme.lineColor }]}
              >
                <Text style={[styles.ghostTxt, { color: theme.ink }]}>List an item</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {featured ? (
          <View style={{ marginTop: 28 }}>
            <Text style={[styles.meta, { color: theme.muted, paddingHorizontal: 20 }]}>UPDATED DROP</Text>
            <Text style={[styles.dropTitle, { color: theme.ink, paddingHorizontal: 20 }]}>{collections[0].cat}</Text>
            <Text style={[styles.dropSub, { color: theme.muted, paddingHorizontal: 20 }]}>{brand.name}</Text>
            <Pressable
              onPress={() => router.push({ pathname: "/closet/[id]", params: { id: featured.id } })}
              style={[styles.heroCard, { backgroundColor: theme.card }]}
            >
              <View style={styles.heroCopy}>
                <Text style={[styles.heroName, { color: theme.ink }]} numberOfLines={2}>
                  {featured.name}
                </Text>
                <Text style={[styles.heroP, { color: theme.muted }]} numberOfLines={3}>
                  {featured.notes || brand.tagline}
                </Text>
              </View>
              <Image source={{ uri: featured.photo }} style={styles.heroImg} contentFit="cover" />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={[styles.section, { color: theme.ink }]}>Latest</Text>
          <Text style={[styles.chev, { color: theme.muted }]}>›</Text>
        </View>
        {listings.length ? (
          listings.slice(0, 8).map((p) => (
            <Pressable
              key={p.id}
              onPress={() => router.push({ pathname: "/closet/[id]", params: { id: p.id } })}
              style={[styles.row, { borderBottomColor: theme.lineColor }]}
            >
              <Image source={{ uri: p.photo }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: theme.ink }]} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={[styles.rowSub, { color: theme.muted }]} numberOfLines={1}>
                  {(p.sizes?.length ? p.sizes.join("  ") : p.size) + "  ·  " + usd(p.listPriceCents, p.currency)}
                </Text>
              </View>
              <Text style={[styles.more, { color: theme.muted }]}>· · ·</Text>
            </Pressable>
          ))
        ) : (
          <Text style={[styles.empty, { color: theme.muted }]}>
            {brand.verified ? "Nothing listed yet." : "Verification first. Then they can post."}
          </Text>
        )}

        {collections.length ? (
          <View>
            <View style={styles.sectionHead}>
              <Text style={[styles.section, { color: theme.ink }]}>The rack</Text>
              <Text style={[styles.chev, { color: theme.muted }]}>›</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playlists}>
              {collections.map((c) => (
                <View key={c.cat} style={[styles.play, { backgroundColor: theme.card }]}>
                  <Image source={{ uri: c.items[0].photo }} style={styles.playImg} contentFit="cover" />
                  <Text style={[styles.playName, { color: theme.ink }]} numberOfLines={1}>
                    {c.cat}
                  </Text>
                  <Text style={[styles.playN, { color: theme.muted }]}>
                    {c.items.length} piece{c.items.length === 1 ? "" : "s"}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {listings.length > 3 ? (
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <View style={styles.grid}>
              {listings.map((p) => (
                <View key={p.id} style={{ width: COL }}>
                  <ListingCard piece={p} framed wide={COL} />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {brand.story ? (
          <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
            <Text style={[styles.section, { color: theme.ink }]}>About</Text>
            <Text style={[styles.story, { color: theme.muted }]}>{brand.story}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, backgroundColor: "#0B0A08", paddingHorizontal: 20 },
  missingH: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 28, marginTop: 24 },
  banner: { width: W, height: 280, backgroundColor: "#161512" },
  nav: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  orb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  orbTxt: { color: "#FFFFFF", fontSize: 26, lineHeight: 28, marginTop: -2 },
  logo: {
    position: "absolute",
    left: 20,
    bottom: -36,
    width: 88,
    height: 88,
    borderRadius: 22,
    borderWidth: 4,
    backgroundColor: "#161512",
  },
  kicker: { letterSpacing: 1.6, fontSize: 11, fontWeight: "700" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  name: { fontFamily: "Georgia", fontSize: 34, lineHeight: 38, flexShrink: 1 },
  handle: { fontSize: 15, marginTop: 6 },
  tagline: { fontSize: 17, lineHeight: 24, marginTop: 12 },
  owner: { fontSize: 14, marginTop: 10 },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  follow: { height: 42, paddingHorizontal: 22, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  followTxt: { fontWeight: "800", fontSize: 14 },
  ghost: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostTxt: { fontWeight: "700", fontSize: 14 },
  meta: { fontSize: 11, letterSpacing: 1.4, fontWeight: "700" },
  dropTitle: { fontSize: 22, fontWeight: "700", marginTop: 4 },
  dropSub: { fontSize: 15, marginTop: 2, marginBottom: 12 },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: "hidden",
    flexDirection: "row",
    minHeight: 180,
  },
  heroCopy: { flex: 1, padding: 16, justifyContent: "flex-end" },
  heroName: { fontFamily: "Georgia", fontSize: 22, lineHeight: 26 },
  heroP: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  heroImg: { width: W * 0.42, minHeight: 180 },
  sectionHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginTop: 32, marginBottom: 8, gap: 6 },
  section: { fontSize: 22, fontWeight: "700" },
  chev: { fontSize: 26, marginTop: -2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 48, height: 48, borderRadius: 6, backgroundColor: "#1A1915" },
  rowName: { fontSize: 16, fontWeight: "600" },
  rowSub: { fontSize: 13, marginTop: 3 },
  more: { fontSize: 16, paddingHorizontal: 4 },
  empty: { paddingHorizontal: 20, fontSize: 15, lineHeight: 22 },
  playlists: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  play: { width: 148, borderRadius: 14, overflow: "hidden" },
  playImg: { width: 148, height: 148, backgroundColor: "#1A1915" },
  playName: { fontWeight: "700", fontSize: 14, paddingHorizontal: 10, paddingTop: 10 },
  playN: { fontSize: 12, paddingHorizontal: 10, paddingBottom: 12, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  story: { fontSize: 15, lineHeight: 22, marginTop: 8 },
});
