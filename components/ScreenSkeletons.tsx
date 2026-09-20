import { StyleSheet, View } from "react-native";
import { OrbitLoader } from "./OrbitLoader";
import type { Colors } from "../lib/theme";

function LoadingScreen({ colors }: { colors: Colors }) {
  return (
    <View style={[styles.page, { backgroundColor: colors.ink }]} accessibilityLabel="Loading">
      <OrbitLoader />
    </View>
  );
}

export function ShopSkeleton({ colors }: { colors: Colors }) {
  return <LoadingScreen colors={colors} />;
}

export function TodaySkeleton({ colors }: { colors: Colors }) {
  return <LoadingScreen colors={colors} />;
}

export function BrandPageSkeleton({ colors }: { colors: Colors }) {
  return <LoadingScreen colors={colors} />;
}

export function BrandHQSkeleton({ colors }: { colors: Colors }) {
  return <LoadingScreen colors={colors} />;
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center" },
});
