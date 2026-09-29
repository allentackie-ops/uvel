import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Image as RNImage,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OrbitLoader } from "../components/OrbitLoader";
import { GARMENTS, getGarment } from "../lib/catalog";
import { pickFromLibrary, takePhoto } from "../lib/photo";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { dressPerson } from "../lib/tryon";
import { getPiece, useWardrobe } from "../lib/wardrobe";

export default function TryOn() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { g, piece: pieceId } = useLocalSearchParams<{ g?: string; piece?: string }>();
  const app = useUvel();
  useWardrobe();
  const closet = pieceId ? getPiece(pieceId) : undefined;
  const [picked, setPicked] = useState(g ?? GARMENTS[0].id);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const asked = useRef(false);
  const garment = closet ? null : getGarment(picked);
  const pieceName = closet?.name ?? garment?.name;
  const pieceCategory = closet?.category ?? garment?.category;
  const pieceImage = closet ? { uri: closet.photo } : garment?.image;
  const person = app.personUri;
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [photoSize, setPhotoSize] = useState<{ width: number; height: number } | null>(null);
  const photoZoom = useSharedValue(1);
  const photoX = useSharedValue(0);
  const photoY = useSharedValue(0);
  const frameWidth = useSharedValue(0);
  const frameHeight = useSharedValue(0);
  const renderedImageWidth = useSharedValue(0);
  const renderedImageHeight = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartZoom = useSharedValue(1);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);
  const imageLayout = useMemo(() => {
    if (!photoSize || frameSize.width <= 0 || frameSize.height <= 0) {
      return { left: 0, top: 0, width: frameSize.width, height: frameSize.height, coverScale: 1 };
    }
    const coverScale = Math.max(frameSize.width / photoSize.width, frameSize.height / photoSize.height);
    const width = photoSize.width * coverScale;
    const height = photoSize.height * coverScale;
    return { left: (frameSize.width - width) / 2, top: (frameSize.height - height) / 2, width, height, coverScale };
  }, [frameSize.height, frameSize.width, photoSize]);
  const photoPanStyle = useAnimatedStyle(() => ({ transform: [{ translateX: photoX.value }, { translateY: photoY.value }] }));
  const photoZoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: photoZoom.value }] }));
  const photoPan = useMemo(() => Gesture.Pan()
    .maxPointers(1)
    .onBegin(() => {
      panStartX.value = photoX.value;
      panStartY.value = photoY.value;
    })
    .onUpdate((event) => {
      const maxX = Math.max(0, (renderedImageWidth.value * photoZoom.value - frameWidth.value) / 2);
      const maxY = Math.max(0, (renderedImageHeight.value * photoZoom.value - frameHeight.value) / 2);
      photoX.value = Math.max(-maxX, Math.min(maxX, panStartX.value + event.translationX));
      photoY.value = Math.max(-maxY, Math.min(maxY, panStartY.value + event.translationY));
    }), [frameHeight, frameWidth, panStartX, panStartY, photoX, photoY, photoZoom, renderedImageHeight, renderedImageWidth]);
  const photoPinch = useMemo(() => Gesture.Pinch()
    .onBegin((event) => {
      pinchStartZoom.value = photoZoom.value;
      pinchStartX.value = photoX.value;
      pinchStartY.value = photoY.value;
      pinchFocalX.value = event.focalX;
      pinchFocalY.value = event.focalY;
    })
    .onUpdate((event) => {
      const nextZoom = Math.max(1, Math.min(4, pinchStartZoom.value * event.scale));
      const localX = (pinchFocalX.value - frameWidth.value / 2 - pinchStartX.value) / pinchStartZoom.value;
      const localY = (pinchFocalY.value - frameHeight.value / 2 - pinchStartY.value) / pinchStartZoom.value;
      const maxX = Math.max(0, (renderedImageWidth.value * nextZoom - frameWidth.value) / 2);
      const maxY = Math.max(0, (renderedImageHeight.value * nextZoom - frameHeight.value) / 2);
      photoX.value = Math.max(-maxX, Math.min(maxX, event.focalX - frameWidth.value / 2 - localX * nextZoom));
      photoY.value = Math.max(-maxY, Math.min(maxY, event.focalY - frameHeight.value / 2 - localY * nextZoom));
      photoZoom.value = nextZoom;
    }), [frameHeight, frameWidth, pinchFocalX, pinchFocalY, pinchStartX, pinchStartY, pinchStartZoom, photoX, photoY, photoZoom, renderedImageHeight, renderedImageWidth]);
  const photoGesture = useMemo(() => Gesture.Simultaneous(photoPan, photoPinch), [photoPan, photoPinch]);

  useEffect(() => {
    photoZoom.value = 1;
    photoX.value = 0;
    photoY.value = 0;
    setPhotoSize(null);
    if (!person) return;
    let current = true;
    RNImage.getSize(person, (width, height) => {
      if (current) setPhotoSize({ width, height });
    }, () => {
      if (current) setPhotoSize(null);
    });
    return () => { current = false; };
  }, [person, photoZoom, photoX, photoY]);

  useEffect(() => {
    frameWidth.value = frameSize.width;
    frameHeight.value = frameSize.height;
    renderedImageWidth.value = imageLayout.width;
    renderedImageHeight.value = imageLayout.height;
    const maxX = Math.max(0, (imageLayout.width * photoZoom.value - frameSize.width) / 2);
    const maxY = Math.max(0, (imageLayout.height * photoZoom.value - frameSize.height) / 2);
    photoX.value = Math.max(-maxX, Math.min(maxX, photoX.value));
    photoY.value = Math.max(-maxY, Math.min(maxY, photoY.value));
  }, [frameHeight, frameSize.height, frameSize.width, frameWidth, imageLayout.height, imageLayout.width, photoX, photoY, photoZoom, renderedImageHeight, renderedImageWidth]);

  useEffect(() => {
    if (g) setPicked(g);
  }, [g]);

  useEffect(() => {
    if (asked.current || person || !app.hydrated) return;
    asked.current = true;
    askPhoto();
  }, [person, app.hydrated]);

  function askPhoto() {
    const options = ["Camera", "Library", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2, title: "Full-length photo of you" },
        (i) => {
          if (i === 0) void fromCamera();
          if (i === 1) void fromLibrary();
        },
      );
      return;
    }
    Alert.alert("Full-length photo of you", "Mirror pic, head to shoes.", [
      { text: "Camera", onPress: () => void fromCamera() },
      { text: "Library", onPress: () => void fromLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function fromCamera() {
    try {
      const uri = await takePhoto(false);
      if (uri) {
        app.setPerson(uri);
        setResult(null);
      }
    } catch (e) {
      Alert.alert("Camera", e instanceof Error ? e.message : "Couldn’t open camera.");
    }
  }

  async function fromLibrary() {
    try {
      const uri = await pickFromLibrary();
      if (uri) {
        app.setPerson(uri);
        setResult(null);
      }
    } catch (e) {
      Alert.alert("Photos", e instanceof Error ? e.message : "Couldn’t open photos.");
    }
  }

  async function preparePersonPhoto(uri: string) {
    const zoom = photoZoom.value;
    const offsetX = photoX.value;
    const offsetY = photoY.value;
    if (zoom <= 1.001 && Math.abs(offsetX) < 0.5 && Math.abs(offsetY) < 0.5) return uri;
    if (!photoSize || frameSize.width <= 0 || frameSize.height <= 0) {
      throw new Error("Your photo is still loading. Please try again in a moment.");
    }
    const coverScale = Math.max(frameSize.width / photoSize.width, frameSize.height / photoSize.height);
    const scale = coverScale * zoom;
    const cropWidth = Math.max(1, Math.min(photoSize.width, Math.round(frameSize.width / scale)));
    const cropHeight = Math.max(1, Math.min(photoSize.height, Math.round(frameSize.height / scale)));
    const originX = Math.max(0, Math.min(photoSize.width - cropWidth, Math.round((photoSize.width - cropWidth) / 2 - offsetX / scale)));
    const originY = Math.max(0, Math.min(photoSize.height - cropHeight, Math.round((photoSize.height - cropHeight) / 2 - offsetY / scale)));
    const context = ImageManipulator.manipulate(uri);
    context.crop({ originX, originY, width: cropWidth, height: cropHeight });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
    return saved.uri;
  }

  async function run() {
    if (!person || !pieceImage) return;
    setErr("");
    setBusy(true);
    try {
      const framedPerson = await preparePersonPhoto(person);
      const dressed = await dressPerson({
        personUri: framedPerson,
        garment: pieceImage,
        garmentName: pieceName,
        category: pieceCategory,
      });
      app.consumeTryOn();
      setResult(dressed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t dress you in that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.page}>
      <StatusBar style={colors.ink === "#000000" ? "light" : "dark"} />
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.back}>
          <Text style={styles.backTxt}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle}>Try on me</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{pieceName ?? "Before you buy"}</Text>
        <Text style={styles.p}>
          {person
            ? "We’ll keep your face, body, and area. It’ll come back with you wearing the piece."
            : "Need a full-length mirror pic of you first. Head to shoes."}
        </Text>

        <View
          style={styles.hero}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setFrameSize((current) => Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5 ? current : { width, height });
          }}
        >
          {result ? (
            <Image cachePolicy="memory-disk" source={{ uri: result }} style={styles.fill} contentFit="contain" />
          ) : person ? (
            photoSize && frameSize.width > 0 && frameSize.height > 0 ? (
              <GestureDetector gesture={photoGesture}>
                <View style={StyleSheet.absoluteFill} collapsable={false} accessible accessibilityRole="image" accessibilityLabel="Your photo. Drag to position and pinch to zoom.">
                  <Animated.View
                    pointerEvents="none"
                    style={[{ position: "absolute", left: imageLayout.left, top: imageLayout.top, width: imageLayout.width, height: imageLayout.height }, photoPanStyle]}
                  >
                    <Animated.Image source={{ uri: person }} style={[StyleSheet.absoluteFill, photoZoomStyle]} resizeMode="stretch" />
                  </Animated.View>
                </View>
              </GestureDetector>
            ) : <Image cachePolicy="memory-disk" source={{ uri: person }} style={styles.fill} contentFit="cover" />
          ) : pieceImage ? (
            <Image cachePolicy="memory-disk" source={pieceImage} style={styles.fill} contentFit="cover" />
          ) : (
            <Text style={styles.placeholder}>Your photo</Text>
          )}
          {busy ? (
            <View style={styles.spin}>
              <OrbitLoader />
            </View>
          ) : null}
          {!person && !busy ? (
            <View style={styles.need}>
              <Text style={styles.needH}>Add your photo</Text>
              <Text style={styles.needP}>The one from setup, or a new mirror shot.</Text>
              <View style={styles.needRow}>
                <Pressable onPress={() => void fromCamera()} style={styles.needBtn}>
                  <Text style={styles.needBtnTxt}>Camera</Text>
                </Pressable>
                <Pressable onPress={() => void fromLibrary()} style={styles.needBtn}>
                  <Text style={styles.needBtnTxt}>Library</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {result ? <Text style={styles.caption}>You, in the {pieceName?.toLowerCase()}.</Text> : null}
        {person && !result && photoSize && frameSize.width > 0 ? <Text style={styles.photoHint}>Drag to position · Pinch to zoom</Text> : null}
        {person && !result ? (
          <Pressable onPress={askPhoto} style={styles.change}>
            <Text style={styles.changeTxt}>Change photo</Text>
          </Pressable>
        ) : null}

        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Pressable onPress={() => void run()} disabled={busy || !person} style={[styles.cta, (!person || busy) && styles.ctaOff]}>
          <Text style={[styles.ctaTxt, (!person || busy) && styles.ctaTxtOff]}>
            {busy ? "Dressing you…" : person ? `See me in this` : "Add a photo first"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    top: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingBottom: 8,
    },
    back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    backTxt: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    topTitle: { color: colors.bone, fontSize: 16, fontWeight: "600" },
    title: { color: colors.bone, fontSize: 28, lineHeight: 34, fontWeight: "800" },
    p: { color: colors.muted, marginTop: 8, fontSize: 15, lineHeight: 22, marginBottom: 16 },
    hero: {
      height: 480,
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    fill: { width: "100%", height: "100%" },
    caption: { color: colors.bone, marginTop: 12, fontSize: 15 },
    photoHint: { color: colors.subtle, fontSize: 12, textAlign: "center", marginTop: 10 },
    placeholder: { color: colors.subtle },
    change: { alignSelf: "center", marginTop: 12 },
    changeTxt: { color: colors.subtle, fontSize: 14, textDecorationLine: "underline" },
    cta: {
      marginTop: 24,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaOff: { backgroundColor: colors.surface },
    ctaTxt: { color: colors.successInk, fontWeight: "700", fontSize: 16 },
    ctaTxtOff: { color: colors.muted },
    err: { color: colors.danger, marginTop: 14, fontSize: 14, lineHeight: 20 },
    spin: {
      ...StyleSheet.absoluteFill,
      backgroundColor: `${colors.surface}80`,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    spinTxt: { color: colors.bone, letterSpacing: 1.2, textTransform: "uppercase", fontSize: 12 },
    need: {
      ...StyleSheet.absoluteFill,
      backgroundColor: `${colors.surface}B8`,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      gap: 8,
    },
    needH: { color: colors.bone, fontFamily: "Georgia", fontSize: 24 },
    needP: { color: `${colors.bone}B2`, textAlign: "center", marginBottom: 8 },
    needRow: { flexDirection: "row", gap: 10, marginTop: 8 },
    needBtn: {
      height: 44,
      paddingHorizontal: 20,
      borderRadius: 22,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    needBtnTxt: { color: colors.successInk, fontWeight: "700" },
  });
}
