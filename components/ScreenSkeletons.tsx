import { ScrollView, StyleSheet, View } from "react-native";
import { Skeleton, skeletonStyles } from "./Skeleton";
import type { Colors } from "../lib/theme";

function Line({ width = "100%", height = 13, radius = 7 }: { width?: number | `${number}%`; height?: number; radius?: number }) {
  return <Skeleton width={width} height={height} radius={radius} />;
}

function CardRail({ count = 3, width = 148, height = 190 }: { count?: number; width?: number; height?: number }) {
  return (
    <View style={skeletonStyles.rail}>
      {Array.from({ length: count }, (_, index) => <Skeleton key={index} width={width} height={height} radius={16} />)}
    </View>
  );
}

export function ShopSkeleton({ colors }: { colors: Colors }) {
  return (
    <ScrollView style={[styles.page, { backgroundColor: colors.ink }]} contentContainerStyle={styles.shopContent} scrollEnabled={false}>
      <View style={styles.rowBetween}><Line width={92} height={22} /><Line width={110} height={34} radius={17} /></View>
      <Line width="62%" height={15} />
      <View style={styles.search}><Line width="100%" height={18} radius={8} /></View>
      <View style={skeletonStyles.rail}><Line width={54} height={32} radius={16} /><Line width={72} height={32} radius={16} /><Line width={64} height={32} radius={16} /><Line width={82} height={32} radius={16} /></View>
      <Line width={82} height={18} />
      <CardRail count={3} width={178} height={72} />
      <Line width={126} height={18} />
      <CardRail count={2} width={154} height={218} />
      <View style={styles.grid}>
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} height={214} radius={14} style={styles.gridCell} />)}
      </View>
    </ScrollView>
  );
}

export function TodaySkeleton({ colors }: { colors: Colors }) {
  return (
    <ScrollView style={[styles.page, { backgroundColor: colors.ink }]} contentContainerStyle={styles.todayContent} scrollEnabled={false}>
      <Skeleton width="100%" height={330} radius={0} />
      <View style={styles.todayBody}>
        <View style={skeletonStyles.rail}><Line width={52} height={30} radius={15} /><Line width={68} height={30} radius={15} /><Line width={74} height={30} radius={15} /><Line width={55} height={30} radius={15} /></View>
        <View style={styles.inbox}><View style={{ flex: 1, gap: 8 }}><Line width={52} height={12} /><Line width="72%" height={14} /></View><Line width={26} height={26} radius={13} /></View>
        <Line width={112} height={18} />
        <CardRail count={3} width={142} height={184} />
        <Line width={140} height={18} />
        <CardRail count={2} width={186} height={94} />
        <Line width={86} height={18} />
        <View style={styles.grid}>{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={214} radius={14} style={styles.gridCell} />)}</View>
      </View>
    </ScrollView>
  );
}

export function BrandPageSkeleton({ colors }: { colors: Colors }) {
  return (
    <ScrollView style={[styles.page, { backgroundColor: colors.ink }]} contentContainerStyle={styles.brandContent} scrollEnabled={false}>
      <Skeleton width="100%" height={190} radius={0} />
      <View style={styles.brandHeader}><Skeleton width={88} height={88} radius={44} /><View style={{ flex: 1, gap: 10 }}><Line width="62%" height={18} /><Line width="84%" height={13} /><Line width="42%" height={12} /></View></View>
      <View style={styles.rowBetween}><Line width={118} height={18} /><Line width={82} height={34} radius={17} /></View>
      <CardRail count={2} width={214} height={92} />
      <Line width={128} height={18} />
      <Skeleton width="100%" height={238} radius={18} />
      <Line width={104} height={18} />
      <CardRail count={3} width={142} height={206} />
    </ScrollView>
  );
}

export function BrandHQSkeleton({ colors }: { colors: Colors }) {
  return (
    <ScrollView style={[styles.page, { backgroundColor: colors.ink }]} contentContainerStyle={styles.hqContent} scrollEnabled={false}>
      <View style={styles.rowBetween}><View style={{ gap: 9 }}><Line width={150} height={22} /><Line width={208} height={13} /></View><Line width={42} height={42} radius={21} /></View>
      <View style={styles.hqStats}>{Array.from({ length: 3 }, (_, index) => <View key={index} style={styles.stat}><Line width="54%" height={12} /><Line width="72%" height={22} /></View>)}</View>
      <View style={styles.hqPanel}><Line width="38%" height={17} /><Line width="92%" height={12} /><Line width="76%" height={12} /><Line width="84%" height={12} /></View>
      <Line width={132} height={18} />
      <View style={styles.hqPanel}><Line width="48%" height={17} /><Line width="96%" height={12} /><Line width="88%" height={12} /><Line width="72%" height={12} /></View>
      <View style={styles.hqPanel}><Line width="42%" height={17} /><Line width="90%" height={12} /><Line width="64%" height={12} /><Line width="82%" height={12} /></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  shopContent: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 120, gap: 15 },
  todayContent: { paddingBottom: 120 },
  todayBody: { padding: 16, gap: 18 },
  brandContent: { paddingBottom: 120, gap: 18 },
  hqContent: { padding: 20, paddingBottom: 120, gap: 18 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  search: { borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(244,240,230,0.08)" },
  inbox: { minHeight: 66, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "rgba(244,240,230,0.08)" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridCell: { width: "48%", flexGrow: 1, minWidth: 140 },
  brandHeader: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, marginTop: -32 },
  hqStats: { flexDirection: "row", gap: 9 },
  stat: { flex: 1, minHeight: 74, borderRadius: 14, padding: 12, gap: 10, borderWidth: 1, borderColor: "rgba(244,240,230,0.08)" },
  hqPanel: { minHeight: 116, borderRadius: 16, padding: 16, gap: 11, borderWidth: 1, borderColor: "rgba(244,240,230,0.08)" },
});
