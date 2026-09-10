import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { PhotoCrop } from "../components/PhotoCrop";
import { useUvel } from "../lib/store";
import { lensScan } from "../lib/lookMatch";
import { useWardrobe } from "../lib/wardrobe";

export default function VisualSearch() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const app = useUvel();
  const pieces = useWardrobe();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "searching" | "ready">("idle");
  const [matchIds, setMatchIds] = useState<string[]>([]);

  useEffect(() => {
    if (!uri) router.back();
  }, [uri]);

  useEffect(() => {
    if (!previewUri || !pieces.length) return;
    let active = true;
    setStatus("searching");
    void lensScan(previewUri, pieces).then((hit) => {
      if (!active) return;
      setMatchIds(hit?.ids ?? []);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, [pieces, previewUri]);

  const onPreview = useCallback((croppedUri: string) => {
    setPreviewUri(croppedUri);
  }, []);

  if (!uri) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#D6E27A" />
      </View>
    );
  }

  const matchNames = matchIds
    .map((id) => pieces.find((piece) => piece.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <PhotoCrop
      uri={uri}
      onPreview={onPreview}
      previewStatus={status}
      previewItems={matchNames}
      onCancel={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: "#0B0A08", alignItems: "center", justifyContent: "center" },
});
