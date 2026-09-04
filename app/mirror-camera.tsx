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
  const [flash, setFlash] = useState<"off" | "auto" | "on">("auto");
  const [screenFlash, setScreenFlash] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [availableLenses, setAvailableLenses] = useState<string[] | null>(null);
  const [selectedLens, setSelectedLens] = useState("builtInWideAngleCamera");
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  function focusAt(x: number, y: number) {
    setFocusPoint({ x, y });
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => setFocusPoint(null), 900);
  }
  const focusTap = Gesture.Tap().onEnd((event, success) => {
    if (success) runOnJS(focusAt)(event.x, event.y);
  });
  const cameraGestures = Gesture.Simultaneous(pinch, focusTap);
  const hasUltraWide = Boolean(availableLenses?.includes("builtInUltraWideCamera"));
  const hasTelephoto = Boolean(availableLenses?.includes("builtInTelephotoCamera"));
  const zoomOptions = [
    ...(hasUltraWide ? [{ label: "0.5×", value: 0, lens: "builtInUltraWideCamera", position: "left" }] : []),
    { label: "1×", value: 0, lens: "builtInWideAngleCamera", position: hasUltraWide ? "middle" : "left" },
    ...(hasTelephoto ? [{ label: "2×", value: 0, lens: "builtInTelephotoCamera", position: "right" }] : []),
  ];
  function chooseLens(option: (typeof zoomOptions)[number]) {
    setSelectedLens(option.lens);
    setCameraZoom(option.value);
  }
  function switchFacing() {
    setFacing((current) => current === "front" ? "back" : "front");
    setAvailableLenses(null);
    setSelectedLens("builtInWideAngleCamera");
    setCameraZoom(0);
  }

  async function capture() {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    const useScreenFlash = facing === "front" && flash !== "off";
    try {
      if (useScreenFlash) {
        setScreenFlash(true);
        await new Promise((resolve) => setTimeout(resolve, 140));
      }
      const result = await cameraRef.current.takePictureAsync({ quality: 0.78, skipProcessing: false });
      if (result?.uri) setPhoto(result.uri);
    } finally {
      setScreenFlash(false);
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
      <GestureDetector gesture={cameraGestures}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="picture"
          autofocus="on"
          selectedLens={selectedLens}
          onAvailableLensesChanged={(event) => {
            setAvailableLenses(event.lenses);
            setSelectedLens((current) => event.lenses.includes(current) ? current : "builtInWideAngleCamera");
          }}
          zoom={zoom}
          flash={flash}
          enableTorch={facing === "back" && flash === "on"}
        />
      </GestureDetector>
      {screenFlash ? <View pointerEvents="none" style={styles.screenFlash} /> : null}
      <View pointerEvents="none" style={styles.scrim} />
      {focusPoint ? (
        <View pointerEvents="none" style={[styles.focusIndicator, { left: focusPoint.x - 28, top: focusPoint.y - 28 }]}>
          <View style={styles.focusCornerTopLeft} />
          <View style={styles.focusCornerTopRight} />
          <View style={styles.focusCornerBottomLeft} />
          <View style={styles.focusCornerBottomRight} />
        </View>
      ) : null}
      <View style={[styles.cameraTop, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.close}>×</Text></Pressable>
        <View style={styles.topCopy}>
          <Text style={styles.kicker}>ON YOU</Text>
          <Text style={styles.title}>Full-length photo</Text>
        </View>
        <View style={styles.topActions}>
          {facing === "back" ? (
            <View style={styles.flashControls} accessibilityRole="radiogroup" accessibilityLabel="Flash mode">
              {(["auto", "off", "on"] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setFlash(mode)}
                  style={({ pressed }) => [styles.flashMode, flash === mode && styles.flashModeOn, pressed && { opacity: 0.75 }]}
                  accessibilityRole="radio"
                  accessibilityLabel={`Flash ${mode}`}
                  accessibilityState={{ selected: flash === mode }}
                >
                  {mode === "on" ? <Ionicons name="flash" size={14} color={flash === mode ? BG : INK} /> : null}
                  <Text style={[styles.flashModeText, flash === mode && styles.flashModeTextOn]}>{mode === "auto" ? "Auto" : mode === "off" ? "Off" : "On"}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.screenFlashBadge}>
              <Ionicons name="phone-portrait-outline" size={14} color={INK} />
              <Text style={styles.screenFlashBadgeText}>{flash === "off" ? "No flash" : "Screen flash"}</Text>
            </View>
          )}
          <Pressable
            onPress={switchFacing}
            hitSlop={8}
            style={({ pressed }) => [styles.topActionButton, pressed && { opacity: 0.72, transform: [{ scale: 0.96 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Switch camera"
            accessibilityHint="Double tap to switch between the front and back camera."
          >
            <Ionicons name="camera-reverse-outline" size={21} color={INK} />
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
        <Text style={styles.bottomHint}>Tap to focus · pinch or swipe to zoom</Text>
        <GestureDetector gesture={dialSwipe}>
          <View style={styles.zoomControl}>
            <View style={styles.zoomTrack}>
              {zoomOptions.map((option) => {
                const active = selectedLens === option.lens && Math.abs(zoom - option.value) < 0.03;
                return (
                  <Pressable
                    key={option.label}
                    onPress={() => chooseLens(option)}
                    style={({ pressed }) => [styles.zoomStop, active && styles.zoomStopOn, pressed && { opacity: 0.72 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Set zoom to ${option.label}`}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.zoomText, active && styles.zoomTextOn]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
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
  topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  close: { color: INK, fontSize: 36, lineHeight: 34, fontWeight: "300" },
  topActionButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(11,10,8,0.58)", borderWidth: 1, borderColor: "rgba(244,240,230,0.28)", alignItems: "center", justifyContent: "center" },
  flashControls: { flexDirection: "row", alignItems: "center", gap: 4, padding: 3, borderRadius: 18, backgroundColor: "rgba(11,10,8,0.58)", borderWidth: 1, borderColor: "rgba(244,240,230,0.28)" },
  flashMode: { minWidth: 38, height: 28, paddingHorizontal: 7, borderRadius: 14, flexDirection: "row", gap: 3, alignItems: "center", justifyContent: "center" },
  flashModeOn: { backgroundColor: ACCENT },
  flashModeText: { color: INK, fontSize: 11, fontWeight: "800" },
  flashModeTextOn: { color: BG },
  screenFlashBadge: { height: 32, paddingHorizontal: 10, borderRadius: 16, flexDirection: "row", gap: 5, alignItems: "center", backgroundColor: "rgba(11,10,8,0.58)", borderWidth: 1, borderColor: "rgba(244,240,230,0.28)" },
  screenFlashBadgeText: { color: INK, fontSize: 11, fontWeight: "800" },
  screenFlash: { ...StyleSheet.absoluteFill, zIndex: 30, backgroundColor: INK },
  focusIndicator: { position: "absolute", zIndex: 20, width: 56, height: 56, borderColor: ACCENT },
  focusCornerTopLeft: { position: "absolute", top: 0, left: 0, width: 14, height: 14, borderTopWidth: 2, borderLeftWidth: 2, borderColor: ACCENT },
  focusCornerTopRight: { position: "absolute", top: 0, right: 0, width: 14, height: 14, borderTopWidth: 2, borderRightWidth: 2, borderColor: ACCENT },
  focusCornerBottomLeft: { position: "absolute", bottom: 0, left: 0, width: 14, height: 14, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: ACCENT },
  focusCornerBottomRight: { position: "absolute", bottom: 0, right: 0, width: 14, height: 14, borderBottomWidth: 2, borderRightWidth: 2, borderColor: ACCENT },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.18)" },
  zoomControl: { width: DIAL_WIDTH, height: 50, marginBottom: 8, padding: 4, borderRadius: 25, backgroundColor: "rgba(11,10,8,0.62)", borderWidth: 1, borderColor: "rgba(244,240,230,0.28)" },
  zoomTrack: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  zoomStop: { minWidth: 58, height: 40, paddingHorizontal: 12, borderRadius: 20, alignItems: "center", justifyContent: "center" },
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
