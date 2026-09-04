import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useUvel } from "../lib/store";

const BG = "#0B0A08";
const INK = "#F4F0E6";
const MUTED = "rgba(244,240,230,0.68)";
const ACCENT = "#D6E27A";
const DIAL_WIDTH = 240;

export default function MirrorCamera() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const app = useUvel();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("front");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [flash, setFlash] = useState<"off" | "on">("off");
  const zoomStart = useSharedValue(0);

  function setCameraZoom(value: number) {
    setZoom(Math.max(0, Math.min(1, value)));
  }

  function setDialZoom(position: number) {
    setCameraZoom(Math.max(0, Math.min(0.5, position / DIAL_WIDTH * 0.5)));
  }

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      zoomStart.value = zoom;
    })
    .onUpdate((event) => {
      runOnJS(setCameraZoom)(zoomStart.value + (event.scale - 1) * 0.5);
    });
  const dialSwipe = Gesture.Pan()
    .onUpdate((event) => {
      runOnJS(setDialZoom)(event.x);
    });

  async function capture() {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.78, skipProcessing: false });
      if (result?.uri) setPhoto(result.uri);
    } finally {
      setBusy(false);
    }
  }

  function usePhoto() {
    if (!photo) return;
    app.setPerson(photo);
    router.back();
  }

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={ACCENT} /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.kicker}>ON YOU</Text>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.copy}>Uvel uses your camera to create a full-length photo for Mirror. Your photo stays on your device unless you choose to use or share it.</Text>
        <Pressable onPress={() => void requestPermission()} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Allow camera</Text>
        </Pressable>
        {permission.canAskAgain === false ? (
          <Pressable onPress={() => void Linking.openSettings()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Open Settings</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.back()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Not now</Text>
        </Pressable>
      </View>
    );
  }

  if (photo) {
    return (
      <View style={styles.screen}>
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={[styles.reviewTop, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.close}>×</Text></Pressable>
          <Text style={styles.reviewTitle}>Review photo</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={[styles.reviewBottom, { paddingBottom: insets.bottom + 18 }]}>
          <Text style={styles.reviewHint}>Make sure your full body is visible, from head to shoes.</Text>
          <View style={styles.reviewActions}>
            <Pressable onPress={() => setPhoto(null)} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Retake</Text>
            </Pressable>
            <Pressable onPress={usePhoto} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Use this photo</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <GestureDetector gesture={pinch}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode="picture" zoom={zoom} flash={flash} />
      </GestureDetector>
      <View pointerEvents="none" style={styles.scrim} />
      <View style={[styles.cameraTop, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.close}>×</Text></Pressable>
        <View style={styles.topCopy}>
          <Text style={styles.kicker}>ON YOU</Text>
          <Text style={styles.title}>Full-length photo</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable
            onPress={() => setFlash((current) => current === "on" ? "off" : "on")}
            style={({ pressed }) => [styles.flashButton, flash === "on" && styles.flashButtonOn, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel={flash === "on" ? "Turn flash off" : "Turn flash on"}
          >
            <Ionicons name={flash === "on" ? "flash" : "flash-outline"} size={20} color={flash === "on" ? BG : INK} />
          </Pressable>
          <Pressable onPress={() => setFacing((current) => current === "front" ? "back" : "front")} hitSlop={12}>
            <Text style={styles.flip}>↻</Text>
          </Pressable>
        </View>
      </View>
      <View pointerEvents="none" style={styles.guideWrap}>
        <Text style={styles.guideTitle}>Stand where we can see the whole look</Text>
        <Text style={styles.guideCopy}>Keep your head and shoes inside the frame.</Text>
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL]} /><View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} /><View style={[styles.corner, styles.cornerBR]} />
          <View style={styles.gridV} /><View style={styles.gridH} />
        </View>
      </View>
      <View style={[styles.cameraBottom, { paddingBottom: insets.bottom + 22 }]}>
        <Text style={styles.bottomHint}>Portrait · head to shoes · pinch or swipe to zoom</Text>
        <GestureDetector gesture={dialSwipe}>
          <View style={styles.zoomDial}>
            <View style={styles.zoomArc} />
            {[{ label: "0.5×", value: 0, position: "left" }, { label: "1×", value: 0.25, position: "middle" }, { label: "2×", value: 0.5, position: "right" }].map((option) => (
              <Pressable
                key={option.label}
                onPress={() => setCameraZoom(option.value)}
                style={({ pressed }) => [
                  styles.zoomStop,
                  option.position === "left" && styles.zoomStopLeft,
                  option.position === "middle" && styles.zoomStopMiddle,
                  option.position === "right" && styles.zoomStopRight,
                  Math.abs(zoom - option.value) < 0.03 && styles.zoomStopOn,
                  pressed && { opacity: 0.75 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Set zoom to ${option.label}`}
              >
                <Text style={[styles.zoomText, Math.abs(zoom - option.value) < 0.03 && styles.zoomTextOn]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </GestureDetector>
        <Pressable accessibilityRole="button" accessibilityLabel="Take full-length photo" onPress={() => void capture()} style={styles.shutterOuter}>
          <View style={styles.shutterInner}>{busy ? <ActivityIndicator color={BG} /> : null}</View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  kicker: { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 2, textAlign: "center" },
  title: { color: INK, fontFamily: "Georgia", fontSize: 28, marginTop: 6, textAlign: "center" },
  copy: { color: MUTED, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 14, maxWidth: 320 },
  primaryButton: { backgroundColor: ACCENT, borderRadius: 24, minHeight: 48, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", marginTop: 24 },
  primaryText: { color: BG, fontWeight: "800", fontSize: 15 },
  secondaryButton: { backgroundColor: "rgba(11,10,8,0.64)", borderColor: "rgba(244,240,230,0.5)", borderWidth: 1, borderRadius: 24, minHeight: 48, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: INK, fontWeight: "800", fontSize: 15 },
  cancelButton: { padding: 16, marginTop: 6 },
  cancelText: { color: MUTED, fontWeight: "700", fontSize: 14 },
  cameraTop: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  topCopy: { alignItems: "center" },
  topActions: { alignItems: "center", gap: 12 },
  close: { color: INK, fontSize: 36, lineHeight: 34, fontWeight: "300" },
  flip: { color: INK, fontSize: 32, lineHeight: 32 },
  flashButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(11,10,8,0.42)", alignItems: "center", justifyContent: "center" },
  flashButtonOn: { backgroundColor: ACCENT },
  flashText: { color: INK },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.18)" },
  zoomDial: { width: DIAL_WIDTH, height: 76, marginBottom: 4, position: "relative", alignItems: "center" },
  zoomArc: { position: "absolute", top: 18, left: 8, width: DIAL_WIDTH - 16, height: 54, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: "rgba(244,240,230,0.38)", borderTopLeftRadius: 120, borderTopRightRadius: 120 },
  zoomStop: { position: "absolute", top: 28, minWidth: 52, height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: "rgba(11,10,8,0.62)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(244,240,230,0.28)" },
  zoomStopLeft: { left: 0, top: 40 },
  zoomStopMiddle: { left: (DIAL_WIDTH - 52) / 2, top: 20 },
  zoomStopRight: { right: 0, top: 40 },
  zoomStopOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  zoomText: { color: INK, fontSize: 13, fontWeight: "800" },
  zoomTextOn: { color: BG },
  guideWrap: { flex: 1, alignItems: "center", paddingTop: 132 },
  guideTitle: { color: INK, fontSize: 17, fontWeight: "800", textAlign: "center" },
  guideCopy: { color: MUTED, fontSize: 13, marginTop: 6, textAlign: "center" },
  frame: { width: "70%", height: "61%", marginTop: 22, borderColor: "rgba(244,240,230,0.28)", borderWidth: 1, position: "relative" },
  corner: { position: "absolute", width: 28, height: 28, borderColor: ACCENT },
  cornerTL: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },
  gridV: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, backgroundColor: "rgba(244,240,230,0.16)" },
  gridH: { position: "absolute", left: 0, right: 0, top: "50%", height: 1, backgroundColor: "rgba(244,240,230,0.16)" },
  cameraBottom: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" },
  bottomHint: { color: MUTED, fontSize: 13, marginBottom: 14 },
  shutterOuter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: INK, alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: INK, alignItems: "center", justifyContent: "center" },
  reviewTop: { position: "absolute", zIndex: 2, top: 0, left: 0, right: 0, paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewTitle: { color: INK, fontSize: 16, fontWeight: "800" },
  reviewBottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, backgroundColor: "rgba(11,10,8,0.76)", paddingTop: 18 },
  reviewHint: { color: MUTED, fontSize: 13, textAlign: "center", marginBottom: 14 },
  reviewActions: { flexDirection: "row", gap: 12, justifyContent: "center" },
});
