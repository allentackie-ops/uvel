import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import { useMemo, useRef, useState } from "react";
import { Animated, PanResponder, useWindowDimensions } from "react-native";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, type Colors } from "../lib/theme";

export type CapturePhoto = { uri: string };
export type CaptureBackground = { id: string; name: string; color: string; accent: string };

type Props = {
  photos: CapturePhoto[];
  backgrounds: CaptureBackground[];
  onCapture: (uri: string) => Promise<void> | void;
  onDeleteCapture: (uri: string) => void;
  onContinue: (backgroundByPhoto: Record<string, string>) => void;
  onClose: () => void;
};

const REQUIRED = 3;
const MAX = 6;
const FRAME_ASPECT = 4 / 5;

export function ListingCaptureStudio({ photos, backgrounds, onCapture, onDeleteCapture, onContinue, onClose }: Props) {
  const colors = useColors();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<"capture" | "backgrounds">("capture");
  const [busy, setBusy] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [backgroundByPhoto, setBackgroundByPhoto] = useState<Record<string, string>>({});
  const [reuseBackground, setReuseBackground] = useState(false);
  const [draggingPhotoIndex, setDraggingPhotoIndex] = useState<number | null>(null);
  const [dragOverDelete, setDragOverDelete] = useState(false);

  async function takePicture() {
    if (busy || photos.length >= MAX || !cameraRef.current) return;
    setBusy(true);
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.82, skipProcessing: false });
      if (!result?.uri) return;
      const sourceAspect = result.width / result.height;
      const cropWidth = sourceAspect > FRAME_ASPECT ? Math.round(result.height * FRAME_ASPECT) : result.width;
      const cropHeight = sourceAspect > FRAME_ASPECT ? result.height : Math.round(result.width / FRAME_ASPECT);
      const framed = await ImageManipulator.manipulateAsync(
        result.uri,
        [{ crop: { originX: Math.round((result.width - cropWidth) / 2), originY: Math.round((result.height - cropHeight) / 2), width: cropWidth, height: cropHeight } }],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
      );
      await onCapture(framed.uri);
      const nextCount = photos.length + 1;
      if (nextCount === REQUIRED) {
        Alert.alert("Three views captured", "Would you like to take more pictures? You can add up to six total.", [
          { text: "Not now", style: "cancel", onPress: () => setMode("backgrounds") },
          { text: "Yes, take more", onPress: () => setMode("capture") },
        ]);
      } else if (nextCount >= MAX) {
        setMode("backgrounds");
      }
    } catch (error) {
      Alert.alert("Camera", error instanceof Error ? error.message : "Couldn’t capture that photo.");
    } finally {
      setBusy(false);
    }
  }

  function chooseBackground(id: string) {
    const uri = photos[selectedPhoto]?.uri;
    if (!uri) return;
    if (reuseBackground) {
      setBackgroundByPhoto(Object.fromEntries(photos.map((photo) => [photo.uri, id])));
    } else {
      setBackgroundByPhoto((current) => ({ ...current, [uri]: id }));
    }
  }

  function toggleReuseBackground() {
    const next = !reuseBackground;
    setReuseBackground(next);
    if (next && selectedBackgroundId) {
      setBackgroundByPhoto(Object.fromEntries(photos.map((photo) => [photo.uri, selectedBackgroundId])));
    }
  }

  if (mode === "capture") {
    if (!permission) return <View style={styles.root} />;
    if (!permission.granted) {
      return (
        <View style={[styles.permission, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <Pressable onPress={onClose} style={styles.permissionClose} accessibilityRole="button" accessibilityLabel="Close listing studio"><Ionicons name="close" size={24} color={colors.bone} /></Pressable>
          <View style={styles.permissionContent}>
            <View style={styles.permissionIcon}><Ionicons name="camera" size={34} color={colors.successInk} /></View>
            <Text style={styles.eyebrow}>LIST AN ITEM</Text>
            <Text style={styles.permissionTitle}>Show the piece from every angle.</Text>
            <Text style={styles.permissionBody}>Uvel needs camera access to capture three clear views. You can take up to six, and the camera never leaves this studio.</Text>
            <Pressable onPress={() => void requestPermission()} style={styles.primaryButton} accessibilityRole="button"><Text style={styles.primaryText}>Allow camera</Text></Pressable>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.root}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <View style={styles.cameraShade} />
        <View style={[styles.cameraTop, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close listing studio"><Ionicons name="close" size={25} color="#FFFFFF" /></Pressable>
          <View style={styles.captureCopy}><Text style={styles.captureKicker}>LIST AN ITEM</Text><Text style={styles.captureTitle}>Take three pictures of your piece</Text></View>
          <View style={styles.countPill}><Text style={styles.countText}>{photos.length}/{MAX}</Text></View>
        </View>
        <View style={[styles.guide, { top: insets.top + 152 }]} pointerEvents="none"><View style={styles.cornerTopLeft} /><View style={styles.cornerTopRight} /><View style={styles.cornerBottomLeft} /><View style={styles.cornerBottomRight} /></View>
        <View style={[styles.cameraBottom, { paddingBottom: insets.bottom + 18 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRail}>
            {photos.map((photo, index) => <DraggableCaptureThumb key={`${photo.uri}-${index}`} uri={photo.uri} index={index} styles={styles} isDragging={draggingPhotoIndex === index} onDragStart={() => { setDraggingPhotoIndex(index); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} onDragMove={(moveX, moveY) => { const targetX = windowWidth / 2; const targetY = windowHeight - insets.bottom - 61; setDragOverDelete(Math.hypot(moveX - targetX, moveY - targetY) < 88); }} onDragEnd={(dragIndex) => { const targetX = windowWidth / 2; const targetY = windowHeight - insets.bottom - 61; const shouldDelete = Math.hypot(targetX - windowWidth / 2, targetY - (windowHeight - insets.bottom - 61)) < 88 && dragIndex === draggingPhotoIndex && dragOverDelete; if (shouldDelete) { onDeleteCapture(photo.uri); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } setDraggingPhotoIndex(null); setDragOverDelete(false); }} />)}
            {Array.from({ length: Math.max(0, REQUIRED - photos.length) }).map((_, index) => <View key={`empty-${index}`} style={styles.emptyThumb}><Ionicons name="add" size={18} color="#FFFFFF99" /></View>)}
          </ScrollView>
          <View style={styles.captureActionRow}>
            <View style={styles.actionHint}><Ionicons name="sparkles-outline" size={16} color="#FFFFFFCC" /><Text style={styles.actionHintText}>{photos.length < REQUIRED ? `${REQUIRED - photos.length} more required` : photos.length < MAX ? "Add up to 3 more" : "All views captured"}</Text></View>
            {draggingPhotoIndex !== null ? <View style={[styles.shutter, styles.deleteTarget, dragOverDelete && styles.deleteTargetActive]} accessibilityRole="button" accessibilityLabel="Delete photo"><Ionicons name="trash" size={27} color="#FFFFFF" /></View> : <Pressable onPress={() => void takePicture()} disabled={busy || photos.length >= MAX} style={[styles.shutter, (busy || photos.length >= MAX) && styles.shutterDisabled]} accessibilityRole="button" accessibilityLabel="Take listing photo"><View style={styles.shutterInner} /></Pressable>}
            <Pressable onPress={() => photos.length >= REQUIRED && setMode("backgrounds")} disabled={photos.length < REQUIRED} style={[styles.nextButton, photos.length < REQUIRED && styles.nextDisabled]} accessibilityRole="button" accessibilityLabel="Continue to backgrounds"><Text style={styles.nextText}>Next</Text></Pressable>
          </View>
        </View>
      </View>
    );
  }

  const activePhoto = photos[selectedPhoto];
  const selectedBackgroundId = activePhoto ? backgroundByPhoto[activePhoto.uri] : undefined;
  const canContinue = photos.length >= REQUIRED && photos.every((photo) => Boolean(backgroundByPhoto[photo.uri]));
  return (
    <View style={[styles.backgroundRoot, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.backgroundHeader}><Pressable onPress={() => setMode("capture")} style={styles.close} accessibilityRole="button" accessibilityLabel="Back to camera"><Ionicons name="chevron-back" size={25} color={colors.bone} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>STEP 2 OF 3</Text><Text style={styles.backgroundTitle}>Set the scene</Text></View><Text style={styles.headerCount}>{photos.length} photos</Text></View>
      <ScrollView contentContainerStyle={styles.backgroundContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.backgroundIntro}>Choose a background for each photo. Then Uvel will lift out the piece and draft the listing for you.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoPicker}>
          {photos.map((photo, index) => <Pressable key={`${photo.uri}-${index}`} onPress={() => setSelectedPhoto(index)} style={[styles.largeThumb, index === selectedPhoto && styles.largeThumbOn]} accessibilityRole="button" accessibilityLabel={`Choose photo ${index + 1}`}><Image source={{ uri: photo.uri }} style={styles.largeThumbImage} contentFit="cover" />{backgroundByPhoto[photo.uri] ? <View style={styles.selectedCheck}><Ionicons name="checkmark" size={13} color={colors.ink} /></View> : null}<Text style={styles.thumbNumber}>{index + 1}</Text></Pressable>)}
        </ScrollView>
        {activePhoto ? <View style={styles.sceneCard}><Text style={styles.sceneLabel}>PHOTO {selectedPhoto + 1} · CHOOSE A BACKGROUND</Text><View style={styles.scenePreview}><Image source={{ uri: activePhoto.uri }} style={styles.sceneImage} contentFit="contain" /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.backgroundRail}>{backgrounds.map((background) => <Pressable key={background.id} onPress={() => chooseBackground(background.id)} style={[styles.backgroundChoice, selectedBackgroundId === background.id && styles.backgroundChoiceOn]} accessibilityRole="button" accessibilityLabel={`Use ${background.name} background`} accessibilityState={{ selected: selectedBackgroundId === background.id }}><View style={[styles.backgroundSwatch, { backgroundColor: background.color }, selectedBackgroundId === background.id && { borderColor: colors.success }]}><View style={[styles.backgroundDot, { backgroundColor: background.accent }]} /></View><Text style={styles.backgroundName} numberOfLines={1}>{background.name}</Text></Pressable>)}</ScrollView></View> : null}
        <Pressable onPress={toggleReuseBackground} style={styles.reuseRow} accessibilityRole="checkbox" accessibilityState={{ checked: reuseBackground }}><Ionicons name={reuseBackground ? "checkbox" : "square-outline"} size={23} color={reuseBackground ? colors.success : colors.subtle} /><View style={{ flex: 1 }}><Text style={styles.reuseTitle}>Use this background for the rest of the pictures</Text><Text style={styles.reuseBody}>You can still change any photo before continuing.</Text></View></Pressable>
      </ScrollView>
      <View style={styles.backgroundFooter}><Pressable onPress={() => onContinue(backgroundByPhoto)} disabled={!canContinue} style={[styles.primaryButton, !canContinue && styles.primaryDisabled]} accessibilityRole="button"><Text style={[styles.primaryText, !canContinue && styles.primaryTextDisabled]}>{canContinue ? "Continue My Listing" : "Choose a background for each photo"}</Text></Pressable></View>
    </View>
  );
}

function DraggableCaptureThumb({ uri, index, styles, isDragging, onDragStart, onDragMove, onDragEnd }: { uri: string; index: number; styles: ReturnType<typeof makeStyles>; isDragging: boolean; onDragStart: () => void; onDragMove: (moveX: number, moveY: number) => void; onDragEnd: (index: number) => void }) {
  const offset = useRef(new Animated.ValueXY()).current;
  const dragStarted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      timer.current = setTimeout(() => { dragStarted.current = true; onDragStart(); }, 300);
    },
    onPanResponderMove: (event, gesture) => {
      if (!dragStarted.current) return;
      offset.setValue({ x: gesture.dx, y: gesture.dy });
      onDragMove(gesture.moveX, gesture.moveY);
    },
    onPanResponderRelease: (_, gesture) => {
      if (timer.current) clearTimeout(timer.current);
      if (dragStarted.current) onDragEnd(index);
      dragStarted.current = false;
      Animated.spring(offset, { toValue: { x: 0, y: 0 }, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
    },
    onPanResponderTerminate: () => {
      if (timer.current) clearTimeout(timer.current);
      if (dragStarted.current) onDragEnd(index);
      dragStarted.current = false;
      Animated.spring(offset, { toValue: { x: 0, y: 0 }, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
    },
    onPanResponderTerminationRequest: () => false,
  }), [index, offset, onDragEnd, onDragMove, onDragStart]);
  return <Animated.View style={[styles.captureThumbWrap, isDragging && styles.captureThumbWrapActive, { transform: offset.getTranslateTransform() }]} {...responder.panHandlers}><Image source={{ uri }} style={styles.captureThumb} contentFit="cover" accessibilityRole="image" accessibilityLabel={`Captured photo ${index + 1}. Hold and drag to delete.`} /></Animated.View>;
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: "#111" }, cameraShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.18)" }, cameraTop: { position: "absolute", left: 0, right: 0, paddingHorizontal: 18, flexDirection: "row", alignItems: "flex-start", gap: 12 }, close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#00000055" }, captureCopy: { flex: 1 }, captureKicker: { color: "#FFFFFFAA", fontSize: 10, fontWeight: "800", letterSpacing: 1.6 }, captureTitle: { color: "#FFF", fontSize: 20, fontWeight: "800", marginTop: 3 }, countPill: { minWidth: 48, height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: "#00000066", alignItems: "center", justifyContent: "center" }, countText: { color: "#FFF", fontWeight: "800" }, guide: { position: "absolute", width: "88%", aspectRatio: FRAME_ASPECT, alignSelf: "center", borderWidth: 1, borderColor: "#FFFFFF66", borderRadius: 26 }, cornerTopLeft: { position: "absolute", left: -1, top: -1, width: 34, height: 34, borderLeftWidth: 3, borderTopWidth: 3, borderColor: colors.success, borderTopLeftRadius: 26 }, cornerTopRight: { position: "absolute", right: -1, top: -1, width: 34, height: 34, borderRightWidth: 3, borderTopWidth: 3, borderColor: colors.success, borderTopRightRadius: 26 }, cornerBottomLeft: { position: "absolute", left: -1, bottom: -1, width: 34, height: 34, borderLeftWidth: 3, borderBottomWidth: 3, borderColor: colors.success, borderBottomLeftRadius: 26 }, cornerBottomRight: { position: "absolute", right: -1, bottom: -1, width: 34, height: 34, borderRightWidth: 3, borderBottomWidth: 3, borderColor: colors.success, borderBottomRightRadius: 26 }, cameraBottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, backgroundColor: "#00000066" }, thumbRail: { gap: 8, paddingVertical: 12 }, captureThumbWrap: { width: 48, height: 60 }, captureThumbWrapActive: { zIndex: 20, elevation: 20 }, captureThumb: { width: 48, height: 60, borderRadius: 10, borderWidth: 2, borderColor: colors.success }, emptyThumb: { width: 48, height: 60, borderRadius: 10, borderWidth: 1, borderColor: "#FFFFFF55", alignItems: "center", justifyContent: "center" }, captureActionRow: { minHeight: 86, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, actionHint: { width: 96, gap: 4 }, actionHintText: { color: "#FFFFFFCC", fontSize: 11, lineHeight: 15 }, shutter: { width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: "#FFF", alignItems: "center", justifyContent: "center" }, shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.success }, deleteTarget: { backgroundColor: "#8F2424", borderColor: "#FFFFFF99", zIndex: 5, elevation: 5 }, deleteTargetActive: { backgroundColor: "#D33131", transform: [{ scale: 1.08 }] }, shutterDisabled: { opacity: 0.45 }, nextButton: { width: 96, height: 42, borderRadius: 21, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }, nextDisabled: { backgroundColor: "#FFFFFF22" }, nextText: { color: colors.ink, fontWeight: "800" }, permission: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: 28, justifyContent: "center", position: "relative" }, permissionClose: { position: "absolute", top: 14, left: 18, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }, permissionContent: { width: "100%", maxWidth: 420, alignSelf: "center" }, permissionIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginBottom: 30 }, eyebrow: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1.8 }, permissionTitle: { color: colors.bone, fontSize: 32, lineHeight: 38, fontWeight: "800", marginTop: 14, maxWidth: 390 }, permissionBody: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 18, maxWidth: 390 }, primaryButton: { minHeight: 54, borderRadius: 27, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20, marginTop: 32 }, primaryText: { color: colors.successInk, fontSize: 15, fontWeight: "800" }, primaryDisabled: { backgroundColor: colors.surface }, primaryTextDisabled: { color: colors.muted }, backgroundRoot: { flex: 1, backgroundColor: colors.ink }, backgroundHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingBottom: 12 }, headerCount: { color: colors.muted, fontSize: 12 }, backgroundTitle: { color: colors.bone, fontSize: 23, fontWeight: "800", marginTop: 2 }, backgroundContent: { paddingHorizontal: 18, paddingBottom: 30 }, backgroundIntro: { color: colors.muted, fontSize: 15, lineHeight: 21, marginTop: 12, marginBottom: 18 }, photoPicker: { gap: 10, paddingBottom: 8 }, largeThumb: { width: 78, height: 96, borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: "transparent", position: "relative" }, largeThumbOn: { borderColor: colors.success }, largeThumbImage: { width: "100%", height: "100%" }, selectedCheck: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" }, thumbNumber: { position: "absolute", left: 7, bottom: 6, color: "#FFF", fontSize: 12, fontWeight: "800" }, sceneCard: { marginTop: 16, padding: 12, borderRadius: 20, backgroundColor: colors.surface }, sceneLabel: { color: colors.subtle, fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginBottom: 10 }, scenePreview: { height: 240, borderRadius: 14, backgroundColor: colors.ink, overflow: "hidden", alignItems: "center", justifyContent: "center" }, sceneImage: { width: "94%", height: "94%" }, backgroundRail: { gap: 8, paddingTop: 14, paddingBottom: 2 }, backgroundChoice: { width: 76, opacity: 0.68 }, backgroundChoiceOn: { opacity: 1 }, backgroundSwatch: { height: 54, borderRadius: 12, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center" }, backgroundDot: { width: 17, height: 17, borderRadius: 9, opacity: 0.7 }, backgroundName: { color: colors.muted, fontSize: 10, textAlign: "center", marginTop: 5 }, reuseRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 20 }, reuseTitle: { color: colors.bone, fontSize: 14, fontWeight: "700" }, reuseBody: { color: colors.muted, fontSize: 12, marginTop: 3 }, backgroundFooter: { paddingHorizontal: 18, paddingTop: 10 }
  });
}

export default ListingCaptureStudio;
