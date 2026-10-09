import * as DocumentPicker from "expo-document-picker";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { LensSearchStage } from "../components/LensSearchStage";
import { lensScan, type NormalizedBox } from "../lib/lookMatch";
import { pickFromLibrary, takePhoto } from "../lib/photo";
import { useUvel } from "../lib/store";
import { shopFloor, useWardrobe } from "../lib/wardrobe";

type SearchStatus = "idle" | "detecting" | "searching" | "ready" | "error";

export default function LensSearch() {
  const app = useUvel();
  const { photoUri } = useLocalSearchParams<{ photoUri?: string }>();
  const wardrobe = useWardrobe();
  const pieces = useMemo(() => shopFloor(app.country), [app.country, wardrobe]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [queryUri, setQueryUri] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [box, setBox] = useState<NormalizedBox | null>(null);
  const [detectionDone, setDetectionDone] = useState(false);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [matchIds, setMatchIds] = useState<string[]>([]);
  const [detectedItem, setDetectedItem] = useState("");

  useEffect(() => {
    if (!imageUri || !queryUri) return;
    let active = true;
    const isInitialImage = queryUri === imageUri;
    if (isInitialImage) {
      setBox(null);
      setDetectionDone(false);
      setStatus("detecting");
    } else {
      setStatus("searching");
    }
    void lensScan(queryUri, pieces).then((hit) => {
      if (!active) return;
      if (isInitialImage) {
        setBox(hit?.box ?? null);
        setDetectionDone(true);
      }
      setMatchIds(hit?.ids ?? []);
      setDetectedItem(hit?.detectedItem ?? "");
      setStatus(hit ? "ready" : "error");
    }).catch(() => {
      if (!active) return;
      if (isInitialImage) setDetectionDone(true);
      setStatus("error");
      setMatchIds([]);
    });
    return () => {
      active = false;
    };
  }, [imageUri, pieces, queryUri, requestVersion]);

  const matchingItems = useMemo(() => {
    const byId = new Map(pieces.map((piece) => [piece.id, piece]));
    return matchIds.map((id) => byId.get(id)).filter((piece): piece is NonNullable<typeof piece> => Boolean(piece));
  }, [matchIds, pieces]);

  const setPhoto = useCallback((uri: string) => {
    setImageUri(uri);
    setQueryUri(uri);
    setBox(null);
    setDetectionDone(false);
    setMatchIds([]);
    setDetectedItem("");
    setStatus("detecting");
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (photoUri && typeof photoUri === "string" && imageUri !== photoUri) setPhoto(photoUri);
  }, [imageUri, photoUri, setPhoto]);

  const onTakePhoto = useCallback(async () => {
    try {
      const uri = await takePhoto(false);
      if (uri) setPhoto(uri);
    } catch (error) {
      Alert.alert("Camera", error instanceof Error ? error.message : "Couldn’t open the camera.");
    }
  }, [setPhoto]);

  const onPickPhotos = useCallback(async () => {
    try {
      const uri = await pickFromLibrary();
      if (uri) setPhoto(uri);
    } catch (error) {
      Alert.alert("Photos", error instanceof Error ? error.message : "Couldn’t open Photos.");
    }
  }, [setPhoto]);

  const onPickFiles = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/*"], copyToCacheDirectory: true, multiple: false });
      if (!result.canceled && result.assets[0]?.uri) setPhoto(result.assets[0].uri);
    } catch (error) {
      Alert.alert("Files", error instanceof Error ? error.message : "Couldn’t open Files.");
    }
  }, [setPhoto]);

  const onCropChange = useCallback((uri: string) => {
    setQueryUri(uri);
    setRequestVersion((version) => version + 1);
  }, []);

  const onChangePhoto = useCallback(() => {
    setImageUri(null);
    setQueryUri(null);
    setBox(null);
    setDetectionDone(false);
    setMatchIds([]);
    setDetectedItem("");
    setStatus("idle");
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: "Search with a photo", headerShown: false, animation: "slide_from_right" }} />
      <LensSearchStage
        key={imageUri || "empty"}
        uri={imageUri}
        box={box}
        detectionDone={detectionDone}
        status={status}
        detectedItem={detectedItem}
        items={matchingItems}
        onBack={() => router.back()}
        onChangePhoto={onChangePhoto}
        onTakePhoto={() => void onTakePhoto()}
        onPickPhotos={() => void onPickPhotos()}
        onPickFiles={() => void onPickFiles()}
        onCropChange={onCropChange}
      />
    </>
  );
}
