import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
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

export function TodayMusicButton({ music }: { music: MusicState }) {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.78 }]}
        accessibilityRole="button"
        accessibilityLabel={`${music.enabled ? "Soundtrack on" : "Turn on soundtrack"}: ${music.track.title}`}
        accessibilityHint="Open Today soundtrack controls."
      >
        <View style={[styles.wave, music.playing && styles.waveActive]}>
          <View style={styles.waveBar} /><View style={[styles.waveBar, styles.waveBarTall]} /><View style={styles.waveBar} /><View style={[styles.waveBar, styles.waveBarTall]} /><View style={styles.waveBar} />
        </View>
        <View style={styles.buttonCopy}>
          <Text style={styles.buttonKicker}>UVEL RADIO</Text>
          <Text style={styles.buttonTitle} numberOfLines={1}>{music.enabled ? music.track.title : "Soundtrack off"}</Text>
        </View>
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
    button: { minHeight: 46, maxWidth: 166, borderRadius: 16, borderWidth: 1, borderColor: "rgba(244,240,230,0.30)", backgroundColor: "rgba(10,10,9,0.58)", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
    wave: { width: 25, height: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
    waveActive: { opacity: 1 },
    waveBar: { width: 2, height: 8, borderRadius: 1, backgroundColor: colors.success },
    waveBarTall: { height: 17 },
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
