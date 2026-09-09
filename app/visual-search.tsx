import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { PhotoCrop } from "../components/PhotoCrop";
import { setLookScan } from "../lib/lookSearch";

export default function VisualSearch() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();

  useEffect(() => {
    if (!uri) router.back();
  }, [uri]);

  if (!uri) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#D6E27A" />
      </View>
    );
  }

  return (
    <PhotoCrop
      uri={uri}
      onCancel={() => router.back()}
      onDone={(croppedUri) => {
        setLookScan(croppedUri, "Visual search");
        router.replace({ pathname: "/(tabs)/shop", params: { scan: "1" } });
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: "#0B0A08", alignItems: "center", justifyContent: "center" },
});
