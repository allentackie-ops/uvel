import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useMemo, useState } from "react";

const PREFS_KEY = "uvel-today-soundtrack-v1";
const DEFAULT_VOLUME = 0.22;

export const TODAY_TRACKS = [
  {
    id: "after-hours",
    title: "After Hours",
    mood: "Quiet tailoring · warm neutrals",
    source: require("../assets/music/today/after-hours.m4a"),
    sourceUrl: "https://opengameart.org/content/short-loops-background-music-pack",
    originalTitle: "A Brand New Wisdom",
  },
  {
    id: "soft-morning",
    title: "Soft Morning",
    mood: "Light layers · clean lines",
    source: require("../assets/music/today/soft-morning.m4a"),
    sourceUrl: "https://opengameart.org/content/short-loops-background-music-pack",
    originalTitle: "Just Saying Tho",
  },
  {
    id: "vintage-room",
    title: "Vintage Room",
    mood: "Patina · old-world texture",
    source: require("../assets/music/today/vintage-room.m4a"),
    sourceUrl: "https://opengameart.org/content/short-loops-background-music-pack",
    originalTitle: "Winter Dust",
  },
  {
    id: "warm-edit",
    title: "Warm Edit",
    mood: "Soft structure · everyday ease",
    source: require("../assets/music/today/warm-edit.m4a"),
    sourceUrl: "https://opengameart.org/content/short-loops-background-music-pack",
    originalTitle: "Swinging Sweet",
  },
] as const;

export type TodayTrack = (typeof TODAY_TRACKS)[number];

type StoredPrefs = { enabled?: boolean; volume?: number; trackId?: string };
type TodayMusicCommand = "toggle" | "next";
const commandListeners = new Set<(command: TodayMusicCommand) => void>();

export function requestTodayMusicCommand(command: TodayMusicCommand) {
  commandListeners.forEach((listener) => listener(command));
}

function subscribeTodayMusicCommands(listener: (command: TodayMusicCommand) => void) {
  commandListeners.add(listener);
  return () => { commandListeners.delete(listener); };
}

export function useTodayMusic() {
  const [trackId, setTrackId] = useState<string>(TODAY_TRACKS[0].id);
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const [hydrated, setHydrated] = useState(false);
  const [ducked, setDuckedState] = useState(false);
  const player = useAudioPlayer(TODAY_TRACKS[0].source, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const track = useMemo(() => TODAY_TRACKS.find((item) => item.id === trackId) || TODAY_TRACKS[0], [trackId]);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "mixWithOthers",
    }).catch(() => undefined);
    void AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      try {
        const saved = raw ? (JSON.parse(raw) as StoredPrefs) : {};
        const savedTrack = TODAY_TRACKS.some((item) => item.id === saved.trackId) ? saved.trackId : TODAY_TRACKS[0].id;
        const savedVolume = typeof saved.volume === "number" ? Math.max(0, Math.min(0.35, saved.volume)) : DEFAULT_VOLUME;
        setTrackId(savedTrack || TODAY_TRACKS[0].id);
        setVolumeState(savedVolume);
        setEnabled(Boolean(saved.enabled));
        player.volume = savedVolume;
      } catch {
        player.volume = DEFAULT_VOLUME;
      } finally {
        setHydrated(true);
      }
    });
    return () => {
      player.pause();
    };
  }, [player]);

  useEffect(() => {
    player.loop = true;
    player.volume = ducked ? volume * 0.2 : volume;
  }, [ducked, player, volume]);

  useEffect(() => {
    if (!hydrated) return;
    if (enabled) player.play();
    else player.pause();
  }, [enabled, hydrated, player]);

  const persist = useCallback((next: StoredPrefs) => {
    void AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      if (next) player.play();
      else player.pause();
      persist({ enabled: next, volume, trackId });
      return next;
    });
  }, [persist, player, trackId, volume]);

  const setVolume = useCallback((next: number) => {
    const safe = Math.max(0, Math.min(0.35, next));
    setVolumeState(safe);
    player.volume = ducked ? safe * 0.2 : safe;
    persist({ enabled, volume: safe, trackId });
  }, [ducked, enabled, persist, player, trackId]);

  const selectTrack = useCallback((nextTrackId: string) => {
    const next = TODAY_TRACKS.find((item) => item.id === nextTrackId);
    if (!next || next.id === trackId) return;
    player.replace(next.source);
    player.loop = true;
    setTrackId(next.id);
    persist({ enabled, volume, trackId: next.id });
    if (enabled) player.play();
  }, [enabled, persist, player, trackId, volume]);

  const nextTrack = useCallback(() => {
    const index = TODAY_TRACKS.findIndex((item) => item.id === trackId);
    selectTrack(TODAY_TRACKS[(index + 1) % TODAY_TRACKS.length].id);
  }, [selectTrack, trackId]);

  useEffect(() => subscribeTodayMusicCommands((command) => {
    if (command === "toggle") toggle();
    else nextTrack();
  }), [nextTrack, toggle]);

  const setDucked = useCallback((value: boolean) => setDuckedState(value), []);

  return {
    track,
    tracks: TODAY_TRACKS,
    enabled,
    playing: Boolean(status.playing),
    volume,
    toggle,
    setVolume,
    selectTrack,
    nextTrack,
    setDucked,
  };
}
