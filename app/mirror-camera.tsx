import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type CameraCapturedPicture, type CameraType, type FlashMode } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { pickFromLibrary } from "../lib/photo";

const ACCENT = "#D7F266";
const INK = "#10120D";
const BONE = "#F7F5EE";
const MUTED = "#B9B8AE";
const GLASS = "rgba(12, 14, 11, 0.72)";

const ZOOM_STEPS = [
  { label: "0.5x", value: 0 },
  { label: "1x", value: 0.34 },
  { label: "2x", value: 0.68 },
] as const;

const FLASH_STEPS: FlashMode[] = ["off", "auto", "on"];

type CaptureState = "camera" | "review";

export default function MirrorCamera() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("front");
  const [flash, setFlash] = useState<FlashMode>("screen");
  const [zoom, setZoom] = useState(0.34);
  const [grid, setGrid] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [captureState, setCaptureState] = useState<CaptureState>("camera");
  const [reviewUri, setReviewUri] = useState<string | null>(null);

  function close() {
    router.back();
  }

  function toggleFacing() {
    setFacing((current) => {
      const next = current === "front" ? "back" : "front";
      if (next === "front" && flash === "off") setFlash("screen");
      if (next === "back" && flash === "screen") setFlash("auto");
      return next;
    });
  }

  function cycleFlash() {
    const available = facing === "front" ? ["off", "screen", "auto"] as FlashMode[] : FLASH_STEPS;
    const index = available.indexOf(flash);
    setFlash(available[(index + 1) % available.length]);
  }

  async function capture() {
    if (!cameraRef.current || !ready || busy) return;
    setBusy(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const picture: CameraCapturedPicture | undefined = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        skipProcessing: false,
      });
      if (picture?.uri) {
        setReviewUri(picture.uri);
        setCaptureState("review");
      }
    } catch (error) {
      Alert.alert("Couldn’t take that photo", error instanceof Error ? error.message : "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function chooseFromLibrary() {
    try {
      const uri = await pickFromLibrary();
      if (uri) {
        setReviewUri(uri);
        setCaptureState("review");
      }
    } catch (error) {
      Alert.alert("Photos", error instanceof Error ? error.message : "Couldn’t open your photo library.");
    }
  }

  function retake() {
    setReviewUri(null);
    setCaptureState("camera");
    setReady(false);
  }

  function usePhoto() {
    if (!reviewUri) return;
    router.replace({
      pathname: "/(tabs)/find",
      params: { capturedUri: reviewUri, capturedAt: String(Date.now()) },
    });
  }

  if (!permission) {
    return <View style={styles.permissionPage} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionPage}>
        <StatusBar style="light" />
        <View style={[styles.permissionContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <Pressable onPress={close} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Close camera">
            <Ionicons name="close" size={26} color={BONE} />
          </Pressable>
          <View style={styles.permissionCopy}>
            <View style={styles.permissionIcon}><Ionicons name="camera-outline" size={34} color={ACCENT} /></View>
            <Text style={styles.permissionTitle}>A better Mirror starts with your camera</Text>
            <Text style={styles.permissionBody}>Give Uvel camera access to capture a full-length portrait and see how every look works on you.</Text>
          </View>
          <View style={styles.permissionActions}>
            <Pressable onPress={() => void requestPermission()} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
              <Text style={styles.primaryText}>Allow camera access</Text>
            </Pressable>
            {permission.canAskAgain === false ? (
              <Pressable onPress={() => void Linking.openSettings()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>Open Settings</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={close} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (captureState === "review" && reviewUri) {
    return (
      <View style={styles.page}>
        <StatusBar style="light" />
        <Image source={{ uri: reviewUri }} style={styles.reviewImage} resizeMode="cover" />
        <View style={styles.reviewShade} />
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={retake} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Retake photo">
            <Ionicons name="arrow-back" size={24} color={BONE} />
          </Pressable>
          <View style={styles.topTitleWrap}>
            <Text style={styles.topTitle}>CHECK YOUR MIRROR</Text>
            <Text style={styles.topSubtitle}>Portrait · head to shoes</Text>
          </View>
          <View style={styles.topSpacer} />
        </View>
        <View style={[styles.reviewBottom, { paddingBottom: insets.bottom + 22 }]}>
          <Text style={styles.reviewHint}>Good light, full length, and a little room around you works best.</Text>
          <View style={styles.reviewActions}>
            <Pressable onPress={retake} style={({ pressed }) => [styles.secondaryButton, styles.reviewSecondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>Retake</Text>
            </Pressable>
            <Pressable onPress={usePhoto} style={({ pressed }) => [styles.primaryButton, styles.reviewPrimary, pressed && styles.primaryPressed]}>
              <Text style={styles.primaryText}>Use this photo</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
        zoom={zoom}
        mode="picture"
        autofocus="on"
        mirror={facing === "front"}
        animateShutter
        responsiveOrientationWhenOrientationLocked
        onCameraReady={() => setReady(true)}
      />
      <View style={styles.previewShade} pointerEvents="none" />
      {grid ? (
        <View style={styles.gridOverlay} pointerEvents="none">
          <View style={styles.gridVertical} />
          <View style={styles.gridHorizontal} />
        </View>
      ) : null}
      <View style={styles.frameGuide} pointerEvents="none">
        <View style={styles.frameCornerTopLeft} />
        <View style={styles.frameCornerTopRight} />
        <View style={styles.frameCornerBottomLeft} />
        <View style={styles.frameCornerBottomRight} />
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={close} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Close camera">
          <Ionicons name="close" size={26} color={BONE} />
        </Pressable>
        <View style={styles.topTitleWrap}>
          <Text style={styles.topTitle}>MIRROR CAMERA</Text>
          <Text style={styles.topSubtitle}>Portrait · full-length</Text>
        </View>
        <Pressable onPress={cycleFlash} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Flash ${flash}`}>
          <Ionicons name={flash === "off" ? "flash-off-outline" : "flash-outline"} size={24} color={BONE} />
          {flash === "auto" ? <Text style={styles.controlTiny}>A</Text> : null}
          {flash === "screen" ? <Text style={styles.controlTiny}>S</Text> : null}
        </Pressable>
      </View>

      <View style={[styles.sideRail, { top: insets.top + 104 }]}>
        <Pressable onPress={toggleFacing} style={({ pressed }) => [styles.railButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Switch camera">
          <Ionicons name="camera-reverse-outline" size={24} color={BONE} />
          <Text style={styles.railText}>Flip</Text>
        </Pressable>
        <Pressable onPress={() => setGrid((current) => !current)} style={({ pressed }) => [styles.railButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={grid ? "Hide framing grid" : "Show framing grid"}>
          <Ionicons name="grid-outline" size={21} color={grid ? ACCENT : BONE} />
          <Text style={[styles.railText, grid && styles.railTextOn]}>Grid</Text>
        </Pressable>
        <Pressable onPress={cycleFlash} style={({ pressed }) => [styles.railButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Change flash mode">
          <Ionicons name="sunny-outline" size={23} color={flash === "off" ? BONE : ACCENT} />
          <Text style={[styles.railText, flash !== "off" && styles.railTextOn]}>Light</Text>
        </Pressable>
      </View>

      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.zoomRow}>
          {ZOOM_STEPS.map((step) => {
            const active = Math.abs(zoom - step.value) < 0.02;
            return (
              <Pressable key={step.label} onPress={() => setZoom(step.value)} style={({ pressed }) => [styles.zoomButton, active && styles.zoomButtonOn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Zoom ${step.label}`}>
                <Text style={[styles.zoomText, active && styles.zoomTextOn]}>{step.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.captureRow}>
          <Pressable onPress={() => void chooseFromLibrary()} style={({ pressed }) => [styles.galleryButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Choose a photo from your library">
            <Ionicons name="images-outline" size={25} color={BONE} />
          </Pressable>
          <Pressable onPress={() => void capture()} style={({ pressed }) => [styles.shutterOuter, pressed && styles.shutterPressed]} accessibilityRole="button" accessibilityLabel="Take portrait photo" disabled={busy || !ready}>
            <View style={[styles.shutterInner, (!ready || busy) && styles.shutterDisabled]} />
          </Pressable>
          <Pressable onPress={toggleFacing} style={({ pressed }) => [styles.galleryButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Flip to the other camera">
            <Ionicons name="camera-reverse-outline" size={25} color={BONE} />
          </Pressable>
        </View>
        <Text style={styles.captureHint}>{busy ? "Saving your portrait…" : ready ? "Keep your whole look in frame" : "Warming up camera…"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: INK },
  permissionPage: { flex: 1, backgroundColor: INK },
  permissionContent: { flex: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  permissionCopy: { alignItems: "center", paddingHorizontal: 12 },
  permissionIcon: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(215,242,102,0.12)", borderWidth: 1, borderColor: "rgba(215,242,102,0.35)" },
  permissionTitle: { color: BONE, fontFamily: "Georgia", fontSize: 30, lineHeight: 36, textAlign: "center", marginTop: 22 },
  permissionBody: { color: MUTED, fontSize: 16, lineHeight: 24, textAlign: "center", marginTop: 12 },
  permissionActions: { gap: 10 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, minHeight: 78, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(10,12,9,0.25)" },
  topTitleWrap: { alignItems: "center", gap: 3 },
  topTitle: { color: BONE, fontSize: 12, fontWeight: "900", letterSpacing: 1.6 },
  topSubtitle: { color: "rgba(247,245,238,0.75)", fontSize: 12 },
  topSpacer: { width: 48, height: 48 },
  iconButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(10,12,9,0.58)", borderWidth: 1, borderColor: "rgba(247,245,238,0.25)" },
  sideRail: { position: "absolute", right: 14, alignItems: "center", gap: 14 },
  railButton: { width: 54, minHeight: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: "rgba(10,12,9,0.55)", borderWidth: 1, borderColor: "rgba(247,245,238,0.18)" },
  railText: { color: "rgba(247,245,238,0.82)", fontSize: 10, fontWeight: "800" },
  railTextOn: { color: ACCENT },
  controlTiny: { position: "absolute", right: 10, top: 9, color: ACCENT, fontSize: 9, fontWeight: "900" },
  previewShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(6,8,5,0.08)" },
  gridOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  gridVertical: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(247,245,238,0.18)" },
  gridHorizontal: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(247,245,238,0.18)" },
  frameGuide: { position: "absolute", left: "16%", right: "16%", top: "18%", bottom: "22%" },
  frameCornerTopLeft: { position: "absolute", top: 0, left: 0, width: 34, height: 34, borderTopWidth: 2, borderLeftWidth: 2, borderColor: "rgba(247,245,238,0.72)" },
  frameCornerTopRight: { position: "absolute", top: 0, right: 0, width: 34, height: 34, borderTopWidth: 2, borderRightWidth: 2, borderColor: "rgba(247,245,238,0.72)" },
  frameCornerBottomLeft: { position: "absolute", bottom: 0, left: 0, width: 34, height: 34, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: "rgba(247,245,238,0.72)" },
  frameCornerBottomRight: { position: "absolute", bottom: 0, right: 0, width: 34, height: 34, borderBottomWidth: 2, borderRightWidth: 2, borderColor: "rgba(247,245,238,0.72)" },
  bottomPanel: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 16, paddingHorizontal: 18, backgroundColor: "rgba(10,12,9,0.62)" },
  zoomRow: { alignSelf: "center", flexDirection: "row", padding: 3, borderRadius: 22, backgroundColor: "rgba(10,12,9,0.8)", borderWidth: 1, borderColor: "rgba(247,245,238,0.2)" },
  zoomButton: { minWidth: 54, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  zoomButtonOn: { backgroundColor: ACCENT },
  zoomText: { color: BONE, fontSize: 12, fontWeight: "800" },
  zoomTextOn: { color: INK },
  captureRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, paddingHorizontal: 22 },
  galleryButton: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(10,12,9,0.62)", borderWidth: 1, borderColor: "rgba(247,245,238,0.3)" },
  shutterOuter: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", borderWidth: 5, borderColor: BONE, backgroundColor: "rgba(10,12,9,0.3)" },
  shutterInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: BONE },
  shutterDisabled: { opacity: 0.5 },
  shutterPressed: { transform: [{ scale: 0.94 }], opacity: 0.85 },
  captureHint: { color: "rgba(247,245,238,0.78)", textAlign: "center", fontSize: 12, marginTop: 12 },
  reviewImage: { ...StyleSheet.absoluteFill, backgroundColor: INK },
  reviewShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(6,8,5,0.16)" },
  reviewBottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 22, backgroundColor: "rgba(10,12,9,0.78)" },
  reviewHint: { color: "rgba(247,245,238,0.78)", textAlign: "center", fontSize: 13, lineHeight: 18, paddingHorizontal: 22 },
  reviewActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  primaryButton: { height: 54, borderRadius: 27, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  primaryText: { color: INK, fontWeight: "800", fontSize: 15 },
  secondaryButton: { height: 54, borderRadius: 27, backgroundColor: "rgba(247,245,238,0.12)", borderWidth: 1, borderColor: "rgba(247,245,238,0.4)", alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  secondaryText: { color: BONE, fontWeight: "700", fontSize: 15 },
  reviewPrimary: { flex: 1 },
  reviewSecondary: { minWidth: 112 },
  cancelButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  cancelText: { color: MUTED, fontSize: 14, fontWeight: "600" },
  pressed: { opacity: 0.68, transform: [{ scale: 0.97 }] },
  primaryPressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
});

// The app is locked to portrait while CameraView handles orientation-correct image processing.
