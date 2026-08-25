import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { canSeeAnalytics, getBrand, useBrands } from "../../lib/brands";
import { usd } from "../../lib/catalog";
import { readBrandAnalytics } from "../../lib/analytics";
import { getMarket } from "../../lib/markets";
import { useUvel } from "../../lib/store";
import { useWardrobe } from "../../lib/wardrobe";

export default function BrandAnalytics() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBrands();
  useWardrobe();
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const brand = getBrand(id);
  const [data, setData] = useState<Awaited<ReturnType<typeof readBrandAnalytics>>>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const market = getMarket(brand?.country || app.country);

  useEffect(() => {
    let alive = true;
    if (!id || !app.uid) {
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    setLoading(true);
    setUnavailable(false);
    void readBrandAnalytics(id, market.currency)
      .then((next) => {
        if (alive) {
          setData(next);
          setUnavailable(!next);
        }
      })
      .catch(() => {
        if (alive) {
          setData(null);
          setUnavailable(true);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, app.uid, market.currency]);

  if (loading) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 20, paddingHorizontal: 20 }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backTxt}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Loading the house’s numbers.</Text>
      </View>
    );
  }

  if (!brand || !canSeeAnalytics(brand, app.uid)) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 20, paddingHorizontal: 20 }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backTxt}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Analytics stay with the owner unless they share them.</Text>
      </View>
    );
  }

  if (unavailable || !data) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 20, paddingHorizontal: 20 }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backTxt}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Real analytics are not connected yet.</Text>
      </View>
    );
  }

  const maxV = Math.max(1, ...data.daily.map((d) => d.views));

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}>
        <View style={styles.top}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>Analysis</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.kicker}>{brand.name.toUpperCase()}</Text>
        <Text style={styles.title}>How the house is doing</Text>
        <Text style={styles.p}>
          {brand.analyticsShared ? "Shared with the team." : "Only you see this. Turn sharing on in Studio."}
        </Text>

        <View style={styles.grid}>
          <Stat label="Earnings" value={usd(data.earningsCents, data.currency || market.currency)} />
          <Stat label="Page views" value={fmt(data.views)} />
          <Stat label="Unique" value={fmt(data.unique)} />
          <Stat label="Likes" value={fmt(data.likes)} />
          <Stat label="Follows" value={fmt(data.follows)} />
          <Stat label="Live listings" value={String(data.listings)} />
          <Stat label="Sold" value={String(data.sold)} />
          <Stat label="Conversion" value={`${data.conversion}%`} />
        </View>

        <Text style={styles.h2}>Last 14 days</Text>
        <View style={styles.chart}>
          {data.daily.map((d) => (
            <View key={d.day} style={styles.col}>
              <View style={[styles.bar, { height: 8 + (d.views / maxV) * 92 }]} />
              <Text style={styles.day}>{d.day.slice(3)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.legend}>Views</Text>

        <Text style={styles.h2}>Top pieces</Text>
        {data.top.map((p) => (
          <Pressable key={p.id} onPress={() => router.push({ pathname: "/closet/[id]", params: { id: p.id } })} style={styles.row}>
            {p.photo ? <Image source={{ uri: p.photo }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.rowN} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={styles.rowP}>
                {fmt(p.views)} views · {p.likes} likes · {p.sold} sold
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statV}>{value}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0B0A08" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  backTxt: { color: "#F4F0E6", fontSize: 34, lineHeight: 36, marginTop: -4 },
  topTitle: { color: "#F4F0E6", fontSize: 16, fontWeight: "600" },
  kicker: { color: "rgba(244,240,230,0.42)", letterSpacing: 1.6, fontSize: 11, fontWeight: "700", marginTop: 8 },
  title: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 28, marginTop: 8, lineHeight: 34 },
  p: { color: "rgba(244,240,230,0.55)", fontSize: 14, marginTop: 8, lineHeight: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 22 },
  stat: { width: "48%", backgroundColor: "#161512", borderRadius: 16, padding: 14 },
  statV: { color: "#F4F0E6", fontWeight: "800", fontSize: 22, fontVariant: ["tabular-nums"] },
  statL: { color: "rgba(244,240,230,0.5)", fontSize: 12, marginTop: 4 },
  h2: { color: "#F4F0E6", fontWeight: "700", fontSize: 18, marginTop: 28, marginBottom: 12 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 120 },
  col: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bar: { width: "70%", borderRadius: 4, backgroundColor: "#D6E27A", minHeight: 8 },
  day: { color: "rgba(244,240,230,0.35)", fontSize: 8, marginTop: 6 },
  legend: { color: "rgba(244,240,230,0.4)", fontSize: 12, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  thumb: { width: 48, height: 60, borderRadius: 8, backgroundColor: "#161512" },
  rowN: { color: "#F4F0E6", fontWeight: "700", fontSize: 15 },
  rowP: { color: "rgba(244,240,230,0.5)", fontSize: 12, marginTop: 3 },
});
