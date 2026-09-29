import { Ionicons } from "@expo/vector-icons";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { useColors, type Colors } from "../lib/theme";
import type { TodayTrack } from "../lib/todayMusic";

type MusicState = {
  track: TodayTrack;
  tracks: readonly TodayTrack[];
  enabled: boolean;
  playing: boolean;
  volume: number;
  toggle: () => void;
  setVolume: (value: number) => void;
  selectTrack: (id: string) => void;
};

export function ImmersiveShoppingButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.immersiveButton, pressed && { opacity: 0.72 }]}
      accessibilityRole="button"
      accessibilityLabel="Open Immersive Shopping"
      accessibilityHint="Open the endless shopping feed with its soundtrack."
    >
      <View style={styles.wave}>
        <View style={[styles.waveBar, styles.immersiveBarShort]} />
        <View style={[styles.waveBar, styles.immersiveBarTall]} />
        <View style={[styles.waveBar, styles.immersiveBarMedium]} />
        <View style={[styles.waveBar, styles.immersiveBarTall]} />
      </View>
    </Pressable>
  );
}

export function TodayMusicButton({ music, compact = false }: { music: MusicState; compact?: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const [open, setOpen] = useState(false);
  const barValues = useRef([0.55, 0.82, 0.42, 0.72, 0.5].map((value) => new Animated.Value(value))).current;

  useEffect(() => {
    if (!music.playing) {
      barValues.forEach((value, index) => {
        value.stopAnimation();
        value.setValue([0.55, 0.82, 0.42, 0.72, 0.5][index]);
      });
      return;
    }
    const animations = barValues.map((value, index) => Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 0.25 + ((index + 2) % 3) * 0.16, duration: 180 + index * 45, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0.78 - (index % 2) * 0.14, duration: 220 + index * 35, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0.38 + (index % 3) * 0.12, duration: 160 + index * 30, useNativeDriver: true }),
      ]),
    ));
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [barValues, music.playing]);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [compact ? styles.compactButton : styles.button, pressed && { opacity: 0.78 }]}
        accessibilityRole="button"
        accessibilityLabel={`${music.enabled ? "Soundtrack on" : "Turn on soundtrack"}: ${music.track.title}`}
        accessibilityHint="Open Today soundtrack controls."
      >
        <View style={[styles.wave, music.playing && styles.waveActive]}>
          {barValues.map((value, index) => (
            <Animated.View key={index} style={[styles.waveBar, { transform: [{ scaleY: value }] }]} />
          ))}
        </View>
        {compact ? null : <View style={styles.buttonCopy}>
          <Text style={styles.buttonKicker}>UVEL RADIO</Text>
          <Text style={styles.buttonTitle} numberOfLines={1}>{music.enabled ? music.track.title : "Soundtrack off"}</Text>
        </View>}
      </Pressable>
      <TodayMusicSheet visible={open} onClose={() => setOpen(false)} music={music} />
    </>
  );
}

function TodayMusicSheet({ visible, onClose, music }: { visible: boolean; onClose: () => void; music: MusicState }) {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close soundtrack controls" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <View>
              <Text style={styles.sheetKicker}>TODAY SOUNDTRACK</Text>
              <Text style={styles.sheetTitle}>{music.track.title}</Text>
              <Text style={styles.sheetMood}>{music.track.mood}</Text>
            </View>
            <Pressable onPress={music.toggle} style={styles.pause} accessibilityRole="button" accessibilityLabel={music.playing ? "Pause soundtrack" : "Play soundtrack"}>
              <Ionicons name={music.playing ? "pause" : "play"} size={21} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.volumeRow}>
            <Ionicons name="volume-low-outline" size={18} color={colors.muted} />
            <Pressable onPress={() => music.setVolume(music.volume >= 0.30 ? 0.08 : music.volume + 0.08)} style={styles.volumeTrack} accessibilityRole="adjustable" accessibilityLabel="Soundtrack volume" accessibilityValue={{ min: 0, max: 100, now: Math.round((music.volume / 0.35) * 100) }}><View style={[styles.volumeFill, { width: `${Math.max(0, Math.min(100, (music.volume / 0.35) * 100))}%` }]} /><View style={[styles.volumeThumb, { left: `${Math.max(0, Math.min(100, (music.volume / 0.35) * 100))}%` }]} /></Pressable>
            <Ionicons name="volume-high-outline" size={18} color={colors.muted} />
          </View>
          <Text style={styles.volumeHint}>Sound fades when you leave Today or open a listing.</Text>
          <Text style={styles.changeLabel}>CHANGE MOOD</Text>
          <View style={styles.trackList}>
            {music.tracks.map((track) => (
              <Pressable key={track.id} onPress={() => music.selectTrack(track.id)} style={[styles.trackRow, track.id === music.track.id && styles.trackRowActive]} accessibilityRole="button" accessibilityLabel={`Choose ${track.title} soundtrack`}>
                <View style={styles.trackIcon}><Ionicons name={track.id === music.track.id && music.playing ? "volume-high" : "musical-note"} size={16} color={track.id === music.track.id ? colors.successInk : colors.bone} /></View>
                <View style={{ flex: 1 }}><Text style={[styles.trackTitle, track.id === music.track.id && styles.trackTitleActive]}>{track.title}</Text><Text style={[styles.trackMood, track.id === music.track.id && styles.trackMoodActive]}>{track.mood}</Text></View>
                {track.id === music.track.id ? <Ionicons name="checkmark" size={19} color={colors.successInk} /> : null}
              </Pressable>
            ))}
          </View>
          <Text style={styles.license}>CC0 loop · credit kept in Uvel’s soundtrack notes</Text>
        </View>
      </View>
    </Modal>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    button: { minHeight: 50, maxWidth: 184, borderRadius: 17, borderWidth: 1, borderColor: "rgba(244,240,230,0.38)", backgroundColor: "rgba(10,10,9,0.70)", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
    compactButton: { width: 38, height: 42, alignItems: "center", justifyContent: "center" },
    immersiveButton: { width: 38, height: 42, alignItems: "center", justifyContent: "center" },
    wave: { width: 25, height: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
    waveActive: { opacity: 1 },
    waveBar: { width: 3, height: 18, borderRadius: 2, backgroundColor: colors.success },
    immersiveBarShort: { height: 10 },
    immersiveBarMedium: { height: 16 },
    immersiveBarTall: { height: 22 },
    buttonCopy: { flexShrink: 1 },
    buttonKicker: { color: colors.bone, fontSize: 9, fontWeight: "800", letterSpacing: 1.1 },
    buttonTitle: { color: `${colors.bone}B8`, fontSize: 11, marginTop: 2 },
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.48)" },
    sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28 },
    handle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: `${colors.bone}35`, marginBottom: 22 },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sheetKicker: { color: colors.subtle, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
    sheetTitle: { color: colors.bone, fontSize: 27, fontWeight: "700", marginTop: 6 },
    sheetMood: { color: colors.muted, fontSize: 14, marginTop: 4 },
    pause: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    volumeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 26 },
    volumeTrack: { flex: 1, height: 24, justifyContent: "center", position: "relative" },
    volumeFill: { position: "absolute", left: 0, height: 3, borderRadius: 2, backgroundColor: colors.success },
    volumeThumb: { position: "absolute", top: 7, width: 12, height: 12, borderRadius: 6, marginLeft: -6, backgroundColor: colors.bone },
    volumeHint: { color: colors.subtle, fontSize: 11, marginTop: 4 },
    changeLabel: { color: colors.subtle, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginTop: 26, marginBottom: 10 },
    trackList: { gap: 8 },
    trackRow: { minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: `${colors.bone}20`, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
    trackRowActive: { backgroundColor: colors.success, borderColor: colors.success },
    trackIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: `${colors.bone}14`, alignItems: "center", justifyContent: "center" },
    trackTitle: { color: colors.bone, fontSize: 14, fontWeight: "700" },
    trackTitleActive: { color: colors.successInk },
    trackMood: { color: colors.muted, fontSize: 11, marginTop: 2 },
    trackMoodActive: { color: `${colors.successInk}B8` },
    license: { color: colors.subtle, fontSize: 10, textAlign: "center", marginTop: 18 },
  });
}
