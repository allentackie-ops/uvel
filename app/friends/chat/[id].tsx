import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { File } from "expo-file-system";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Animated, FlatList, ImageBackground, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { impactAsync, ImpactFeedbackStyle, notificationAsync, NotificationFeedbackType } from "../../../lib/haptics";
import { blockFriend, deleteFriendMessage, getCachedFriendMessages, getFriendConversationStatus, listFriends, markFriendChatRead, reportFriendConversation, sendFriendMessage, subscribeFriendMessages, unblockFriend, uploadFriendAttachment, friendMessagePreview, sendFriendVoiceMessage, type FriendMessage } from "../../../lib/friendChat";
import { BlockedAvatar } from "../../../components/BlockedAvatar";
import type { PublicUser } from "../../../lib/friends";
import { pickFromLibrary } from "../../../lib/photo";
import { useColors, useResolvedAppearance } from "../../../lib/theme";
import { useUvel } from "../../../lib/store";
import { getGarment, usd } from "../../../lib/catalog";
import { getPiece, useWardrobe } from "../../../lib/wardrobe";
import { parseSharedListing, sharedListingPayload, type SharedListingShare } from "../../../lib/sharedListing";

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  if (typeof value === "string") { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
  if (value && typeof value === "object" && "seconds" in value && typeof (value as { seconds?: unknown }).seconds === "number") return new Date(Number((value as { seconds: number }).seconds) * 1000);
  return null;
}

function dayKey(value: unknown) {
  const date = asDate(value);
  return date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : "unknown";
}

function dayLabel(value: unknown) {
  const date = asDate(value);
  if (!date) return "Earlier";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((today.getTime() - thatDay.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

function timestampLabel(value: unknown) {
  const date = asDate(value);
  return date ? `Sent · ${date.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Time unavailable";
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "F";
}

type ShareOption = SharedListingShare;
function displayMessageText(message?: FriendMessage | null) {
  return message ? friendMessagePreview(message.text) : "";
}
function shareOptionKey(item: ShareOption) { return `${item.kind}:${item.id}`; }

const VOICE_NOTE_PREFIX = "uvel_voice_note:";
const MAX_VOICE_NOTE_SECONDS = 180;
const VOICE_RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, sampleRate: 22050, numberOfChannels: 1, bitRate: 64000, isMeteringEnabled: true };
type VoiceNoteMeta = { durationMs: number; waveform: number[] };
function parseVoiceNote(text: string): VoiceNoteMeta | null {
  if (!text.startsWith(VOICE_NOTE_PREFIX)) return null;
  try {
    const value = JSON.parse(text.slice(VOICE_NOTE_PREFIX.length)) as VoiceNoteMeta;
    if (!Number.isFinite(value.durationMs) || !Array.isArray(value.waveform)) return null;
    return { durationMs: Math.max(0, value.durationMs), waveform: value.waveform.filter(Number.isFinite).slice(0, 48).map((bar) => Math.max(3, Math.min(22, Math.round(bar)))) };
  } catch { return null; }
}
function makeVoicePayload(durationMs: number, waveform: number[]) {
  return `${VOICE_NOTE_PREFIX}${JSON.stringify({ durationMs, waveform })}`;
}
function formatVoiceTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
function makeVoiceWaveform(samples: number[]) {
  const count = 42;
  if (!samples.length) return Array.from({ length: count }, () => 5);
  return Array.from({ length: count }, (_, index) => {
    const position = index * (samples.length - 1) / (count - 1);
    const low = Math.floor(position);
    const fraction = position - low;
    const level = samples[low] * (1 - fraction) + (samples[Math.min(samples.length - 1, low + 1)] || 0) * fraction;
    return Math.max(4, Math.min(22, Math.round(4 + level * 18)));
  });
}
async function localUriAsBase64(uri: string) {
  if (Platform.OS !== "web") return new File(uri).base64();
  const response = await fetch(uri);
  if (!response.ok) throw new Error("The file could not be read.");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result.slice(reader.result.indexOf(",") + 1)) : reject(new Error("The voice note could not be read."));
    reader.onerror = () => reject(reader.error || new Error("The voice note could not be read."));
    reader.readAsDataURL(blob);
  });
}
function removeLocalRecording(uri: string) {
  if (Platform.OS === "web") {
    if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
    return;
  }
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch { /* Temporary recording cleanup is best-effort. */ }
}

function VoiceNoteBubble({ uri, note, mine, styles, onLongPress }: { uri: string; note: VoiceNoteMeta; mine: boolean; styles: ReturnType<typeof make>; onLongPress: () => void }) {
  const player = useAudioPlayer(uri, { updateInterval: 120 });
  const status = useAudioPlayerStatus(player);
  const duration = Math.max(note.durationMs / 1000, status.duration || 0);
  const [playbackCompleted, setPlaybackCompleted] = useState(false);
  useEffect(() => {
    if (status.playing) setPlaybackCompleted(false);
    else if (status.didJustFinish || (duration > 0 && duration - status.currentTime <= 0.15)) setPlaybackCompleted(true);
  }, [duration, status.currentTime, status.didJustFinish, status.playing]);
  const playbackFinished = playbackCompleted || Boolean(status.didJustFinish) || (duration > 0 && duration - status.currentTime <= 0.15);
  const progress = playbackFinished ? 1 : duration ? Math.min(1, status.currentTime / duration) : 0;
  const bars = note.waveform.length ? note.waveform : Array.from({ length: 42 }, () => 5);
  const suppressNextPress = useRef(false);
  function handleLongPress() {
    suppressNextPress.current = true;
    setTimeout(() => { suppressNextPress.current = false; }, 500);
    onLongPress();
  }
  function togglePlayback() {
    if (status.playing) player.pause();
    else {
      if (status.didJustFinish || (duration > 0 && status.currentTime >= duration)) { setPlaybackCompleted(false); void player.seekTo(0); }
      player.play();
    }
  }
  return <Pressable onPress={() => { if (suppressNextPress.current) { suppressNextPress.current = false; return; } togglePlayback(); }} onLongPress={handleLongPress} delayLongPress={430} style={[styles.voiceNote, mine && styles.voiceNoteMine]} accessibilityRole="button" accessibilityLabel={`${status.playing ? "Pause" : "Play"} voice note, ${formatVoiceTime(duration)}`}>
    <View style={styles.voicePlayButton}><Ionicons name={status.playing ? "pause" : "play"} size={20} color="#FFFFFF" /></View>
    <View style={styles.voiceWaveform}>{bars.map((height, index) => <View key={index} style={[styles.voiceWaveBar, { height, opacity: (index + 1) / bars.length <= progress ? 1 : 0.48 }]} />)}</View>
    <Text style={styles.voiceDuration}>{formatVoiceTime(status.playing ? Math.max(0, duration - status.currentTime) : duration)}</Text>
  </Pressable>;
}

function SwipeToReply({ children, direction, onReply }: { children: ReactNode; direction: "left" | "right"; onReply: () => void }) {
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => direction === "right"
      ? gesture.dx > 18 && gesture.dx > Math.abs(gesture.dy) * 1.25
      : gesture.dx < -18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_event, gesture) => {
      const reachedReplyThreshold = direction === "right" ? gesture.dx >= 68 : gesture.dx <= -68;
      if (reachedReplyThreshold) onReplyRef.current();
    },
  }), [direction]);
  return <View {...panResponder.panHandlers}>{children}</View>;
}

function friendChatErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (/failed to send a request to the edge function/i.test(message)) {
    console.warn("[FriendChat] Edge Function transport failure", error);
    return fallback;
  }
  return message || fallback;
}

export default function FriendChat() {
  const colors = useColors();
  const appearance = useResolvedAppearance();
  const styles = useMemo(() => make(colors), [colors]);
  const voiceRecorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const voiceRecorderState = useAudioRecorderState(voiceRecorder, 120);
  const insets = useSafeAreaInsets();
  const { id: routeId, name: routeName, username: routeUsername, avatarUri: routeAvatarUri, blockedInitial: routeBlockedInitial } = useLocalSearchParams<{ id: string; name?: string; username?: string; avatarUri?: string; blockedInitial?: string }>();
  const chatId = Array.isArray(routeId) ? routeId[0] : routeId;
  const name = Array.isArray(routeName) ? routeName[0] : routeName;
  const app = useUvel();
  const { uid } = app;
  const wardrobePieces = useWardrobe();
  const peerUid = String(chatId || "").split("_").find((participant) => participant && participant !== uid) || "";
  const [peer, setPeer] = useState<PublicUser | undefined>(() => routeName || routeUsername || routeAvatarUri ? { uid: peerUid, displayName: routeName === "Blocked" ? "" : routeName || "", username: routeUsername || "", avatarUri: routeAvatarUri || undefined } : undefined);
  const [conversationStatus, setConversationStatus] = useState<Awaited<ReturnType<typeof getFriendConversationStatus>> | null>(null);
  const blockedByMe = Boolean(conversationStatus?.blockedByMe || (!conversationStatus && routeName === "Blocked"));
  const blockedByThem = Boolean(conversationStatus?.blockedByThem);
  const conversationUnavailable = blockedByMe || blockedByThem || Boolean(conversationStatus && !conversationStatus.isFriend);
  const blockedInitial = conversationStatus?.blockedInitial || (Array.isArray(routeBlockedInitial) ? routeBlockedInitial[0] : routeBlockedInitial) || peer?.displayName || peer?.username || "U";
  const [messages, setMessages] = useState<FriendMessage[]>(() => getCachedFriendMessages(String(chatId || "")) || []);
  const [optimisticMessages, setOptimisticMessages] = useState<FriendMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<FriendMessage | null>(null);
  const [activeMessage, setActiveMessage] = useState<FriendMessage | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !getCachedFriendMessages(String(chatId || "")));
  const [loadError, setLoadError] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [previewUri, setPreviewUri] = useState<string | undefined>();
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceElapsedMs, setVoiceElapsedMs] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [shareSheetMode, setShareSheetMode] = useState<"saved" | "mine" | null>(null);
  const [shareSearchQuery, setShareSearchQuery] = useState("");
  const [selectedShareKeys, setSelectedShareKeys] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const listRef = useRef<FlatList<FriendMessage>>(null);
  const messageInputRef = useRef<TextInput>(null);
  const lastReadMessage = useRef("");
  const sheetDragY = useRef(new Animated.Value(0)).current;
  const voiceHoldActive = useRef(false);
  const voiceRecordingActive = useRef(false);
  const voiceStartedAt = useRef(0);
  const voiceLevels = useRef<number[]>([]);
  const listName = blockedByMe ? "Blocked" : blockedByThem || (conversationStatus && !conversationStatus.isFriend) ? "Unavailable" : peer?.displayName || peer?.username || (name === "Blocked" && conversationStatus ? "Friend" : name) || "Friend";
  const messageRecipientName = (peer?.displayName || peer?.username || name || "friend").trim().replace(/^@/, "").split(/\s+/)[0] || "friend";
  const visibleMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const combined = [...messages, ...optimisticMessages].sort((a, b) => (asDate(a.createdAt)?.getTime() || 0) - (asDate(b.createdAt)?.getTime() || 0));
    return query ? combined.filter((message) => displayMessageText(message).toLowerCase().includes(query)) : combined;
  }, [messages, optimisticMessages, searchQuery]);
  // app.saved is the same ID collection written by the Today heart button.
  const savedShareOptions = useMemo<ShareOption[]>(() => app.saved.flatMap<ShareOption>((id): ShareOption[] => {
    const piece = wardrobePieces.find((item) => item.id === id) || getPiece(id);
    if (piece) return [{ id: piece.id, kind: "closet", name: piece.name, brand: piece.brand, priceCents: piece.listPriceCents, currency: piece.currency, photoUri: piece.photo || piece.photos?.[0] }];
    const garment = getGarment(id);
    return garment ? [{ id: garment.id, kind: "catalog", name: garment.name, brand: garment.brand, priceCents: garment.priceCents }] : [];
  }), [app.saved, wardrobePieces]);
  const myShareOptions = useMemo<ShareOption[]>(() => wardrobePieces.filter((piece) => piece.status === "listed" && (piece.ownerId === uid || piece.listedByUid === uid)).map((piece) => ({ id: piece.id, kind: "closet", name: piece.name, brand: piece.brand, priceCents: piece.listPriceCents, currency: piece.currency, photoUri: piece.photo || piece.photos?.[0] })), [wardrobePieces, uid]);
  const sheetOptions = shareSheetMode === "saved" ? savedShareOptions : myShareOptions;
  const filteredSheetOptions = useMemo(() => {
    const query = shareSearchQuery.trim().toLowerCase();
    return query ? sheetOptions.filter((item) => `${item.name} ${item.brand} ${item.id}`.toLowerCase().includes(query)) : sheetOptions;
  }, [sheetOptions, shareSearchQuery]);
  const sheetPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 8,
    onPanResponderMove: (_event, gesture) => sheetDragY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 120) { setShareSheetMode(null); sheetDragY.setValue(0); }
      else Animated.spring(sheetDragY, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 3 }).start();
    },
  }), [sheetDragY]);

  useEffect(() => {
    let active = true;
    setConversationStatus(null);
    const refreshStatus = () => {
      if (!chatId) return;
      void getFriendConversationStatus(String(chatId)).then((status) => {
        if (!active) return;
        setConversationStatus(status);
        if (status.blockedByMe || status.blockedByThem || !status.isFriend) {
          setMessages([]);
          setOptimisticMessages([]);
          setDraft("");
          setPhotoUri(undefined);
        }
      }).catch(() => undefined);
    };
    refreshStatus();
    const timer = setInterval(refreshStatus, 8000);
    return () => { active = false; clearInterval(timer); };
  }, [chatId, retryCount]);

  useEffect(() => {
    let active = true;
    if (conversationUnavailable) {
      setMessages([]);
      setOptimisticMessages([]);
      setLoading(false);
      setLoadError("");
      return () => { active = false; };
    }
    const cachedMessages = getCachedFriendMessages(String(chatId || ""));
    setMessages(cachedMessages || []);
    setLoading(!cachedMessages);
    setLoadError("");
    if (peerUid && (!peer?.username || !peer?.avatarUri)) void listFriends().then((friends) => { if (active) setPeer(friends.find((friend) => friend.uid === peerUid) || peer); }).catch(() => undefined);
    if (chatId) void markFriendChatRead(String(chatId)).catch(() => undefined);
    const unsubscribe = subscribeFriendMessages(String(chatId || ""), (next) => {
      if (!active) return;
      setMessages(next);
      setOptimisticMessages((current) => current.filter((message) => !next.some((serverMessage) => serverMessage.id === message.id)));
      setLoading(false);
      setLoadError("");
      const last = next[next.length - 1];
      if (last && last.from !== uid && last.id !== lastReadMessage.current) {
        lastReadMessage.current = last.id;
        void markFriendChatRead(String(chatId)).catch(() => undefined);
      }
    }, (error) => {
      if (!active) return;
      setLoading(false);
      setLoadError(friendChatErrorMessage(error, "Messages are temporarily unavailable. Please try again shortly."));
    });
    return () => { active = false; unsubscribe(); };
  }, [chatId, peerUid, retryCount, uid, conversationUnavailable]);

  useEffect(() => {
    if (!voiceRecordingActive.current) return;
    if (typeof voiceRecorderState.metering === "number" && Number.isFinite(voiceRecorderState.metering)) {
      const normalized = Math.max(0, Math.min(1, (voiceRecorderState.metering + 60) / 60));
      voiceLevels.current.push(normalized);
      if (voiceLevels.current.length > 1800) voiceLevels.current.shift();
    }
    const elapsed = Math.max(voiceRecorderState.durationMillis || 0, Date.now() - voiceStartedAt.current);
    setVoiceElapsedMs((previous) => Math.floor(elapsed / 120) === Math.floor(previous / 120) ? previous : elapsed);
  }, [voiceRecorderState.durationMillis, voiceRecorderState.metering, voiceRecorderState.isRecording]);

  useEffect(() => {
    if (!searchQuery && messages.length) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [visibleMessages.length, searchQuery]);

  function beginVoicePress() {
    if (voiceHoldActive.current) return;
    voiceHoldActive.current = true;
    voiceLevels.current = [];
    voiceStartedAt.current = 0;
    setVoiceElapsedMs(0);
    setIsRecordingVoice(true);
    setAttachMenuOpen(false);
    // Keep the composer focused while the mic is held. Toggling editable to
    // false here would blur the TextInput and dismiss the keyboard on iOS.
    requestAnimationFrame(() => messageInputRef.current?.focus());
    void startVoiceRecording();
  }

  async function startVoiceRecording() {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!voiceHoldActive.current) return;
      if (!permission.granted) {
        voiceHoldActive.current = false;
        setIsRecordingVoice(false);
        Alert.alert("Microphone access needed", "Allow Uvel to use your microphone to send voice notes.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: "doNotMix" });
      await voiceRecorder.prepareToRecordAsync();
      if (!voiceHoldActive.current) {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, interruptionMode: "mixWithOthers" });
        setIsRecordingVoice(false);
        return;
      }
      voiceRecorder.record({ forDuration: MAX_VOICE_NOTE_SECONDS });
      voiceRecordingActive.current = true;
      voiceStartedAt.current = Date.now();
      void impactAsync(ImpactFeedbackStyle.Light);
    } catch (error) {
      voiceHoldActive.current = false;
      voiceRecordingActive.current = false;
      setIsRecordingVoice(false);
      setLoadError(friendChatErrorMessage(error, "Couldn’t start recording. Check microphone access and try again."));
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, interruptionMode: "mixWithOthers" }).catch(() => undefined);
    }
  }

  function releaseVoicePress() {
    voiceHoldActive.current = false;
    if (!voiceRecordingActive.current) {
      setIsRecordingVoice(false);
      return;
    }
    voiceRecordingActive.current = false;
    setIsRecordingVoice(false);
    void finishVoiceRecording();
  }

  async function finishVoiceRecording() {
    let uri = "";
    let localId = "";
    try {
      if (voiceRecorder.isRecording) await voiceRecorder.stop();
      const recorderStatus = voiceRecorder.getStatus();
      uri = voiceRecorder.uri || recorderStatus.url || "";
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, interruptionMode: "mixWithOthers" });
      if (!uri) throw new Error("No recording was saved. Please try again.");
      const durationMs = Math.min(MAX_VOICE_NOTE_SECONDS * 1000, Math.round(Math.max(recorderStatus.durationMillis || 0, Date.now() - voiceStartedAt.current)));
      if (durationMs < 320) {
        removeLocalRecording(uri);
        return;
      }
      const payload = makeVoicePayload(durationMs, makeVoiceWaveform(voiceLevels.current));
      const replyTarget = replyingTo;
      localId = `local-voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: FriendMessage = { id: localId, text: payload, from: uid, photoUrl: uri, createdAt: new Date(), status: "sending", replyTo: replyTarget ? { id: replyTarget.id, text: replyTarget.text, from: replyTarget.from, photoUrl: replyTarget.photoUrl } : undefined };
      setOptimisticMessages((current) => [...current, optimistic]);
      if (replyTarget) setReplyingTo(null);
      setLoadError("");
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      const base64 = await localUriAsBase64(uri);
      const contentType = Platform.OS === "web" ? "audio/webm" : "audio/mp4";
      const result = await sendFriendVoiceMessage(String(chatId), base64, contentType, payload, replyTarget?.id);
      setOptimisticMessages((current) => current.map((message) => message.id === localId ? { ...message, id: result.messageId, photoUrl: result.audioUrl, status: "sent" } : message));
      void notificationAsync(NotificationFeedbackType.Success);
      removeLocalRecording(uri);
    } catch (error) {
      if (localId) setOptimisticMessages((current) => current.filter((message) => message.id !== localId));
      setLoadError(friendChatErrorMessage(error, "Couldn’t send your voice note. Please try again."));
      if (uri) removeLocalRecording(uri);
    } finally {
      voiceLevels.current = [];
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, interruptionMode: "mixWithOthers" }).catch(() => undefined);
    }
  }

  async function send() {
    const text = draft.trim();
    const localPhotoUri = photoUri;
    const replyTarget = replyingTo;
    if ((!text && !localPhotoUri) || !chatId || conversationUnavailable) return;

    // Render locally first so the sender sees the message immediately instead of
    // waiting on token renewal, the Edge Function, and sequential database writes.
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: FriendMessage = {
      id: localId,
      text,
      from: uid,
      photoUrl: localPhotoUri,
      createdAt: new Date(),
      status: "sending",
      replyTo: replyTarget ? { id: replyTarget.id, text: replyTarget.text, from: replyTarget.from, photoUrl: replyTarget.photoUrl } : undefined,
    };
    setOptimisticMessages((current) => [...current, optimistic]);
    setDraft("");
    setPhotoUri(undefined);
    setReplyingTo(null);
    setLoadError("");
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

    try {
      let uploaded = "";
      if (localPhotoUri) {
        const base64 = await localUriAsBase64(localPhotoUri);
        uploaded = await uploadFriendAttachment(base64, "image/jpeg");
      }
      const result = await sendFriendMessage(String(chatId), text, uploaded, replyTarget?.id);
      setOptimisticMessages((current) => current.map((message) => message.id === localId ? { ...message, id: result.messageId, photoUrl: uploaded || undefined, status: "sent" } : message));
    } catch (error) {
      setOptimisticMessages((current) => current.filter((message) => message.id !== localId));
      setDraft((current) => current || text);
      if (localPhotoUri) setPhotoUri((current) => current || localPhotoUri);
      setLoadError(friendChatErrorMessage(error, "Couldn’t send your message just now. Your draft is saved—please try again."));
    }
  }

  function openShareSheet(mode: "saved" | "mine") {
    setAttachMenuOpen(false);
    setSelectedShareKeys([]);
    setShareSearchQuery("");
    sheetDragY.setValue(0);
    setShareSheetMode(mode);
  }

  function toggleShareSelection(item: ShareOption) {
    const key = shareOptionKey(item);
    setSelectedShareKeys((current) => current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]);
  }

  function sendSelectedListings() {
    const selected = sheetOptions.filter((item) => selectedShareKeys.includes(shareOptionKey(item)));
    if (!selected.length || !chatId) return;
    const now = Date.now();
    const outgoing = selected.map((item, index) => ({
      item,
      message: { id: `local-listing-${now}-${index}-${Math.random().toString(36).slice(2, 7)}`, text: sharedListingPayload(item), from: uid, photoUrl: item.photoUri, createdAt: new Date(now + index), status: "sending" } as FriendMessage,
    }));
    setOptimisticMessages((current) => [...current, ...outgoing.map((entry) => entry.message)]);
    setShareSheetMode(null);
    setSelectedShareKeys([]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    outgoing.forEach(({ item, message }) => {
      void sendFriendMessage(String(chatId), message.text, item.photoUri).then((result) => {
        setOptimisticMessages((current) => current.map((entry) => entry.id === message.id ? { ...entry, id: result.messageId, status: "sent" } : entry));
      }).catch((error) => {
        setOptimisticMessages((current) => current.filter((entry) => entry.id !== message.id));
        setLoadError(friendChatErrorMessage(error, "Couldn’t share that listing just now. Please try again."));
      });
    });
  }

  async function attachPhoto() {
    try {
      const uri = await pickFromLibrary();
      if (uri) setPhotoUri(uri);
    } catch (error) {
      Alert.alert("Couldn’t open photos", error instanceof Error ? error.message : "Check photo permissions and try again.");
    }
  }

  async function unblockCurrentFriend() {
    try {
      await unblockFriend(peerUid);
      setConversationStatus((status) => status ? { ...status, blockedByMe: false } : { isFriend: true, blockedByMe: false, blockedByThem: false, hidden: false });
      void getFriendConversationStatus(String(chatId)).then(setConversationStatus).catch(() => undefined);
      Alert.alert("Friend unblocked", "You can message each other again.");
    } catch { Alert.alert("Couldn’t unblock friend", "Please try again."); }
  }

  async function blockCurrentFriend() {
    try {
      await blockFriend(peerUid);
      setConversationStatus((status) => status ? { ...status, blockedByMe: true, blockedInitial: blockedInitial.slice(0, 1).toUpperCase() } : { isFriend: true, blockedByMe: true, blockedByThem: false, blockedInitial: blockedInitial.slice(0, 1).toUpperCase(), hidden: false });
      setMessages([]);
      setOptimisticMessages([]);
      Alert.alert("Friend blocked", "New messages from this friend are blocked.");
    } catch { Alert.alert("Couldn’t block friend", "Please try again."); }
  }

  function safetyActions() {
    const actions = [
      { text: "Cancel", style: "cancel" as const },
      ...(conversationUnavailable ? [] : [{ text: "Search messages", onPress: () => { setSearchOpen(true); setSearchQuery(""); } }]),
      { text: "Report conversation", style: "destructive" as const, onPress: () => { void reportFriendConversation(String(chatId), "Reported from friend chat").then(() => Alert.alert("Report sent", "Thanks. We’ll review this conversation.")).catch(() => Alert.alert("Report not sent", "Please try again.")); } },
      ...(blockedByMe ? [{ text: "Unblock friend", onPress: () => { void unblockCurrentFriend(); } }] : blockedByThem ? [] : conversationUnavailable ? [] : [{ text: "Block friend", style: "destructive" as const, onPress: () => Alert.alert("Block this friend?", "Their profile and chat details will be hidden, and you won’t be able to message each other.", [{ text: "Cancel", style: "cancel" }, { text: "Block", style: "destructive", onPress: () => { void blockCurrentFriend(); } }]) }]),
    ];
    Alert.alert(listName, "Manage this conversation", actions);
  }

  function closeMessageSearch() {
    Keyboard.dismiss();
    setSearchOpen(false);
    setSearchQuery("");
  }

  function showMessageActions(message: FriendMessage) {
    setCopiedMessageId(null);
    setActiveMessage(message);
    void notificationAsync(NotificationFeedbackType.Success);
  }

  function replyToMessage(message: FriendMessage) {
    setReplyingTo(message);
    void impactAsync(ImpactFeedbackStyle.Light).catch(() => undefined);
    requestAnimationFrame(() => messageInputRef.current?.focus());
  }

  function confirmDeleteMessage() {
    const message = activeMessage;
    if (!message || message.from !== uid) return;
    setActiveMessage(null);
    Alert.alert("Delete message?", "This removes your message from this conversation.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { void deleteFriendMessage(String(chatId), message.id).then(() => { setMessages((current) => current.filter((entry) => entry.id !== message.id)); setReplyingTo((current) => current?.id === message.id ? null : current); }).catch((error) => Alert.alert("Couldn’t delete message", friendChatErrorMessage(error, "Please check your connection and try again."))); } },
    ]);
  }

  const renderMessage = ({ item, index }: { item: FriendMessage; index: number }) => {
    const mine = item.from === uid;
    const previous = visibleMessages[index - 1];
    const next = visibleMessages[index + 1];
    const startsDay = index === 0 || dayKey(previous?.createdAt) !== dayKey(item.createdAt);
    const grouped = previous?.from === item.from && !startsDay;
    const showPeerAvatar = !mine && (next?.from !== item.from || dayKey(next?.createdAt) !== dayKey(item.createdAt));
    const sharedListing = parseSharedListing(item.text);
    const voiceNote = parseVoiceNote(item.text);
    const sharedCatalogItem = sharedListing?.kind === "catalog" ? getGarment(sharedListing.id) : undefined;
    const bubbleContent = <>
      {item.replyTo ? <View style={styles.replyQuote}><View style={[styles.replyQuoteBar, mine && styles.replyQuoteBarMine]} /><View style={styles.replyQuoteCopy}><Text style={[styles.replyQuoteName, mine && styles.replyQuoteMine]} numberOfLines={1}>{item.replyTo.from === uid ? "You" : listName}</Text><Text style={[styles.replyQuoteText, mine && styles.replyQuoteMine]} numberOfLines={2}>{parseSharedListing(item.replyTo.text)?.name || displayMessageText(item.replyTo) || (item.replyTo.photoUrl ? "Photo" : "Message")}</Text></View></View> : null}
      {!sharedListing && !voiceNote && item.photoUrl ? <View style={styles.senderPanel}><Avatar uri={mine ? undefined : peer?.avatarUri} label={mine ? "You" : listName} styles={styles} /><View style={styles.senderPanelCopy}><Text numberOfLines={1} style={[styles.senderName, mine && styles.senderNameMine]}>{mine ? "You" : listName}</Text><Text numberOfLines={1} style={[styles.senderHandle, mine && styles.senderHandleMine]}>{mine ? "Shared a photo" : peer?.username ? `@${peer.username}` : ""}</Text></View></View> : null}
      {sharedListing ? <Pressable style={styles.sharedListingCard} onPress={() => router.push(sharedListing.kind === "catalog" ? { pathname: "/product/[id]", params: { id: sharedListing.id, source: "friendChat" } } : { pathname: "/closet/[id]", params: { id: sharedListing.id, source: "friendChat" } })} onLongPress={() => showMessageActions(item)} delayLongPress={430} accessibilityRole="button" accessibilityLabel={`Open shared listing ${sharedListing.name}`}>
        {sharedCatalogItem ? <Image cachePolicy="memory-disk" source={sharedCatalogItem.image} style={styles.sharedListingImage} contentFit="cover" /> : item.photoUrl ? <Image cachePolicy="memory-disk" source={{ uri: item.photoUrl }} style={styles.sharedListingImage} contentFit="cover" /> : <View style={[styles.sharedListingImage, styles.sharedListingImageFallback]}><Ionicons name="shirt-outline" size={27} color={colors.muted} /></View>}
        <View style={styles.sharedListingCopy}>
          <Text numberOfLines={1} style={styles.sharedListingBrand}>{sharedListing.brand}</Text>
          <Text numberOfLines={2} style={styles.sharedListingName}>{sharedListing.name}</Text>
          <Text style={styles.sharedListingPrice}>{usd(sharedListing.priceCents, sharedListing.currency || "USD")}</Text>
        </View>
      </Pressable> : null}
      {sharedListing?.message ? <Text style={[styles.sharedListingNote, mine && styles.bubbleTextMine]}>{sharedListing.message}</Text> : null}
      {voiceNote && item.photoUrl ? <VoiceNoteBubble uri={item.photoUrl} note={voiceNote} mine={mine} styles={styles} onLongPress={() => showMessageActions(item)} /> : null}
      {!sharedListing && !voiceNote && item.photoUrl ? <Pressable onPress={() => setPreviewUri(item.photoUrl)} accessibilityRole="imagebutton" accessibilityLabel="View attached photo"><Image cachePolicy="memory-disk" source={{ uri: item.photoUrl }} style={styles.messagePhoto} contentFit="cover" /></Pressable> : null}
      {item.text && !sharedListing && !voiceNote ? <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextPeer]}>{item.text}</Text> : null}
    </>;
    return <SwipeToReply direction={mine ? "left" : "right"} onReply={() => replyToMessage(item)}>
      {startsDay ? <View style={styles.dayRule}><Text style={styles.dayPill}>{dayLabel(item.createdAt).toUpperCase()}</Text></View> : null}
      <View style={[styles.messageLine, mine ? styles.messageLineMine : styles.messageLinePeer, grouped && styles.messageLineGrouped]}>
        {!mine ? <View style={styles.avatarSlot}>{showPeerAvatar ? <Avatar uri={peer?.avatarUri} label={listName} styles={styles} /> : null}</View> : null}
        <Pressable style={[styles.bubbleFrame, grouped && (mine ? styles.bubbleMineGrouped : styles.bubblePeerGrouped)]} onLongPress={voiceNote || sharedListing ? undefined : () => showMessageActions(item)} delayLongPress={430} accessibilityRole="text" accessibilityLabel={`${mine ? "You" : listName}: ${displayMessageText(item) || "Photo"}`}>
          {mine ? <ImageBackground source={require("../../../assets/chat/message-bubble-gradient.png")} resizeMode="stretch" imageStyle={styles.bubbleGradientImage} style={[styles.bubble, styles.bubbleMine, grouped && styles.bubbleMineGrouped, item.photoUrl && !voiceNote && styles.bubbleWithPhoto, item.status === "sending" && styles.bubblePending]}>{bubbleContent}</ImageBackground> : <View style={[styles.bubble, styles.bubblePeer, grouped && styles.bubblePeerGrouped, item.photoUrl && !voiceNote && styles.bubbleWithPhoto]}>{bubbleContent}</View>}
        </Pressable>
      </View>
    </SwipeToReply>;
  };

  return <View style={styles.page}>
    <StatusBar style={appearance === "dark" ? "light" : "dark"} />
    <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
      <Pressable onPress={() => router.back()} style={styles.headerIcon} accessibilityRole="button" accessibilityLabel="Back to messages"><Ionicons name="chevron-back" size={27} color={colors.bone} /></Pressable>
      <View style={styles.profileHeader}>
        {conversationUnavailable ? <BlockedAvatar initial={blockedInitial} size={58} backgroundColor={colors.neutral} textColor={colors.bone} slashColor={colors.danger} /> : <Avatar uri={peer?.avatarUri} label={listName} styles={styles} large />}
        <View style={styles.profileCopy}><Text numberOfLines={1} style={styles.headerTitle}>{listName}</Text><Text numberOfLines={1} style={styles.headerSubtitle}>{conversationUnavailable ? blockedByMe ? "Blocked" : "Messaging unavailable" : peer?.username ? `@${peer.username}` : ""}</Text></View>
        <Ionicons name="chevron-forward" size={15} color={colors.subtle} />
      </View>
      <Pressable onPress={safetyActions} style={styles.headerIcon} accessibilityRole="button" accessibilityLabel="Conversation options"><Ionicons name="ellipsis-horizontal" size={23} color={colors.bone} /></Pressable>
    </View>

    {searchOpen ? <View style={styles.searchBox}><Ionicons name="search" size={17} color={colors.subtle} /><TextInput autoFocus value={searchQuery} onChangeText={setSearchQuery} placeholder="Search messages" placeholderTextColor={colors.subtle} style={styles.searchInput} returnKeyType="search" /><Pressable onPress={closeMessageSearch} accessibilityRole="button" accessibilityLabel="Close search"><Ionicons name="close-circle" size={18} color={colors.subtle} /></Pressable></View> : null}

    <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
      {conversationUnavailable ? <View style={styles.blockedConversation}><Ionicons name="ban-outline" size={34} color={colors.danger} /><Text style={styles.blockedConversationTitle}>{blockedByMe ? "Blocked" : "Unavailable"}</Text><Text style={styles.blockedConversationCopy}>{blockedByMe ? "You blocked this person. Their profile and conversation details are hidden." : blockedByThem ? "This person is unavailable. You can’t view or send messages in this conversation." : "You’re no longer friends, so this conversation is unavailable."}</Text>{blockedByMe ? <Pressable onPress={() => void unblockCurrentFriend()} style={styles.unblockButton}><Text style={styles.unblockButtonText}>Unblock</Text></Pressable> : null}</View> : <>
      {loadError ? <View style={styles.errorBanner}><Ionicons name="cloud-offline-outline" size={17} color={colors.danger} /><Text style={styles.errorText} numberOfLines={3}>{loadError}</Text><Pressable onPress={() => { setLoading(true); setLoadError(""); setRetryCount((count) => count + 1); }} accessibilityRole="button" accessibilityLabel="Retry loading messages"><Text style={styles.retryText}>Retry</Text></Pressable></View> : null}
      {!loading && !loadError && visibleMessages.length === 0 ? <View pointerEvents="none" style={styles.emptyPrompt}><Text style={styles.emptyPromptText}>Say hi to {listName}</Text></View> : null}
      {!loading && searchQuery.trim() && visibleMessages.length === 0 ? <View style={styles.searchEmpty}><Ionicons name="search-outline" size={26} color={colors.subtle} /><Text style={styles.searchEmptyTitle}>No matching messages</Text><Text style={styles.searchEmptyCopy}>Try another word or name.</Text></View> : null}
      <FlatList
        ref={listRef}
        data={visibleMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.list}
        contentContainerStyle={[styles.listContent, visibleMessages.length === 0 && styles.listContentEmpty]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        onContentSizeChange={() => { if (!searchQuery) listRef.current?.scrollToEnd({ animated: false }); }}
        ListFooterComponent={<View style={{ height: 10 }} />}
        showsVerticalScrollIndicator={false}
      />
      {isRecordingVoice ? <View style={styles.voiceLiveBanner}><View style={styles.voiceLiveDot} /><Text style={styles.voiceLiveText}>Recording {formatVoiceTime(voiceElapsedMs / 1000)} · release to send</Text></View> : null}
      {replyingTo ? <View style={styles.replyComposer}><View style={styles.replyComposerAccent} /><View style={styles.replyComposerCopy}><Text style={styles.replyComposerTitle}>Replying to {replyingTo.from === uid ? "your message" : listName}</Text><Text numberOfLines={1} style={styles.replyComposerText}>{displayMessageText(replyingTo) || (replyingTo.photoUrl ? "Photo" : "Message")}</Text></View><Pressable onPress={() => setReplyingTo(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel reply"><Ionicons name="close" size={19} color={colors.muted} /></Pressable></View> : null}
      {photoUri ? <View style={styles.attachmentPreview}><Image cachePolicy="memory-disk" source={{ uri: photoUri }} style={styles.previewImage} contentFit="cover" /><View style={styles.previewCopy}><Text style={styles.previewTitle}>Photo attached</Text><Text style={styles.previewSubtitle}>Add a note or send it as is</Text></View><Pressable onPress={() => setPhotoUri(undefined)} style={styles.removePhoto} accessibilityRole="button" accessibilityLabel="Remove attached photo"><Ionicons name="close" size={18} color={colors.bone} /></Pressable></View> : null}
      <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.attachWrap}>
          <Pressable onPress={() => setAttachMenuOpen((open) => !open)} style={styles.attachButton} accessibilityRole="button" accessibilityLabel="Add to message" accessibilityState={{ expanded: attachMenuOpen }}><Ionicons name={attachMenuOpen ? "close" : "add"} size={26} color={colors.bone} /></Pressable>
          {attachMenuOpen ? <View style={styles.attachMenu}>
            <Pressable style={styles.attachMenuRow} onPress={() => { setAttachMenuOpen(false); void attachPhoto(); }}><Ionicons name="images-outline" size={20} color={colors.bone} /><Text style={styles.attachMenuText}>Camera roll</Text></Pressable>
            <Pressable style={styles.attachMenuRow} onPress={() => openShareSheet("saved")}><Ionicons name="heart" size={20} color={colors.danger} /><Text style={styles.attachMenuText}>Saved</Text></Pressable>
            <Pressable style={styles.attachMenuRow} onPress={() => openShareSheet("mine")}><Ionicons name="pricetag-outline" size={20} color={colors.bone} /><Text style={styles.attachMenuText}>My listings</Text></Pressable>
          </View> : null}
        </View>
        <View style={styles.composerField}>
          <TextInput ref={messageInputRef} value={draft} onChangeText={setDraft} editable={!conversationUnavailable} placeholder={isRecordingVoice ? "Recording voice note…" : `Message ${messageRecipientName}`} placeholderTextColor={colors.subtle} style={styles.input} maxLength={2000} multiline blurOnSubmit={false} textAlignVertical="center" accessibilityLabel="Write a message" />
          <Text style={styles.charCount}>{draft.length >= 1800 ? `${draft.length}/2000` : ""}</Text>
        </View>
        <Pressable onPressIn={beginVoicePress} onPressOut={releaseVoicePress} style={[styles.voiceRecordButton, isRecordingVoice && styles.voiceRecordButtonActive]} accessibilityRole="button" accessibilityLabel={isRecordingVoice ? "Recording voice note, release to send" : "Hold to record a voice note"} accessibilityHint="Press and hold to record. Release to send the voice note.">
          <Ionicons name="mic" size={21} color={isRecordingVoice ? "#FFFFFF" : "#E5465E"} />
        </Pressable>
        <Pressable onPress={() => void send()} disabled={!draft.trim() && !photoUri} style={[styles.sendButton, (!draft.trim() && !photoUri) && styles.sendButtonDisabled]} accessibilityRole="button" accessibilityLabel="Send message">
          <Text style={styles.sendTxt}>Send</Text>
        </Pressable>
      </View>
      </>}
    </KeyboardAvoidingView>

    <Modal visible={Boolean(activeMessage)} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setActiveMessage(null)}>
      <View style={styles.actionModal}><Pressable style={styles.actionScrim} onPress={() => setActiveMessage(null)} accessibilityRole="button" accessibilityLabel="Dismiss message actions" /><View style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 18) }]}><View style={styles.actionHandle} /><Text style={styles.actionTimestamp}>{timestampLabel(activeMessage?.createdAt)}</Text><Text numberOfLines={2} style={styles.actionExcerpt}>{displayMessageText(activeMessage) || (activeMessage?.photoUrl ? "Photo message" : "Message")}</Text>
        <Pressable style={styles.actionRow} onPress={() => { if (activeMessage) setReplyingTo(activeMessage); setActiveMessage(null); }}><Ionicons name="arrow-undo-outline" size={21} color={colors.bone} /><Text style={styles.actionLabel}>Reply</Text></Pressable>
        {activeMessage?.text ? <Pressable style={styles.actionRow} onPress={() => { const message = activeMessage; void Clipboard.setStringAsync(displayMessageText(message)).then(() => { setCopiedMessageId(message.id); void notificationAsync(NotificationFeedbackType.Success); }); }} accessibilityRole="button" accessibilityLabel={copiedMessageId === activeMessage.id ? "Copied to clipboard" : "Copy message"}><Ionicons name={copiedMessageId === activeMessage.id ? "checkmark-circle-outline" : "copy-outline"} size={22} color={copiedMessageId === activeMessage.id ? colors.success : colors.bone} /><Text style={[styles.actionLabel, copiedMessageId === activeMessage.id && styles.actionCopiedLabel]}>{copiedMessageId === activeMessage.id ? "Copied to clipboard" : "Copy"}</Text></Pressable> : null}
        {activeMessage?.photoUrl && !parseVoiceNote(activeMessage.text) ? <Pressable style={styles.actionRow} onPress={() => { setPreviewUri(activeMessage.photoUrl); setActiveMessage(null); }}><Ionicons name="image-outline" size={21} color={colors.bone} /><Text style={styles.actionLabel}>View photo</Text></Pressable> : null}
        {activeMessage?.from === uid ? <Pressable style={styles.actionRow} onPress={confirmDeleteMessage}><Ionicons name="trash-outline" size={21} color={colors.danger} /><Text style={styles.actionDeleteLabel}>Delete message</Text></Pressable> : null}
      </View></View>
    </Modal>


    <Modal visible={shareSheetMode !== null} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShareSheetMode(null)}>
      <View style={styles.shareSheetModal}>
        <Pressable style={styles.shareSheetScrim} onPress={() => setShareSheetMode(null)} accessibilityRole="button" accessibilityLabel="Close listings" />
        <KeyboardAvoidingView style={styles.shareSheetKeyboardDock} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Animated.View style={[styles.shareSheet, { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY: sheetDragY }] }]}>
          <View {...sheetPanResponder.panHandlers} style={styles.shareSheetHandleArea}><View style={styles.actionHandle} /></View>
          <View style={styles.shareSheetHeading}><View><Text style={styles.shareSheetTitle}>{shareSheetMode === "saved" ? "Saved listings" : "My listings"}</Text><Text style={styles.shareSheetSubtitle}>Select one or more to share</Text></View><Pressable onPress={() => setShareSheetMode(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={21} color={colors.muted} /></Pressable></View>
          <View style={styles.shareSearchRow}><Ionicons name="search" size={17} color={colors.subtle} /><TextInput value={shareSearchQuery} onChangeText={setShareSearchQuery} placeholder={shareSheetMode === "saved" ? "Search saved items" : "Search my listings"} placeholderTextColor={colors.subtle} style={styles.shareSearchInput} autoCapitalize="none" returnKeyType="search" accessibilityLabel="Search listings" />{shareSearchQuery ? <Pressable onPress={() => setShareSearchQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear listing search"><Ionicons name="close-circle" size={18} color={colors.subtle} /></Pressable> : null}</View>
          {filteredSheetOptions.length ? <ScrollView style={styles.shareListingScroll} contentContainerStyle={styles.shareListingContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {filteredSheetOptions.map((item) => {
              const key = shareOptionKey(item);
              const selected = selectedShareKeys.includes(key);
              const garment = item.kind === "catalog" ? getGarment(item.id) : undefined;
              return <Pressable key={key} onPress={() => toggleShareSelection(item)} style={[styles.shareListingRow, selected && styles.shareListingRowSelected]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
                {garment ? <Image cachePolicy="memory-disk" source={garment.image} style={styles.shareListingThumb} contentFit="cover" /> : item.photoUri ? <Image cachePolicy="memory-disk" source={{ uri: item.photoUri }} style={styles.shareListingThumb} contentFit="cover" /> : <View style={[styles.shareListingThumb, styles.sharedListingImageFallback]}><Ionicons name="shirt-outline" size={22} color={colors.muted} /></View>}
                <View style={styles.shareListingInfo}><Text numberOfLines={1} style={styles.shareListingBrand}>{item.brand}</Text><Text numberOfLines={1} style={styles.shareListingName}>{item.name}</Text><Text style={styles.shareListingPrice}>{usd(item.priceCents, item.currency || "USD")}</Text></View>
                <View style={[styles.shareCheck, selected && styles.shareCheckSelected]}>{selected ? <Ionicons name="checkmark" size={15} color={colors.ink} /> : null}</View>
              </Pressable>;
            })}
          </ScrollView> : <View style={styles.shareEmpty}><Ionicons name={shareSheetMode === "saved" ? "heart-outline" : "pricetag-outline"} size={28} color={shareSheetMode === "saved" ? colors.danger : colors.muted} /><Text style={styles.shareEmptyText}>{sheetOptions.length === 0 ? shareSheetMode === "saved" ? "You don’t have any listings saved." : "You have not posted a listing." : "No listings match your search."}</Text></View>}
          <Pressable onPress={sendSelectedListings} disabled={!selectedShareKeys.length} style={[styles.shareSendButton, !selectedShareKeys.length && styles.shareSendDisabled]} accessibilityRole="button" accessibilityLabel={`Send ${selectedShareKeys.length} selected listing${selectedShareKeys.length === 1 ? "" : "s"}`}>
            <Text style={styles.shareSendText}>{selectedShareKeys.length ? `Send ${selectedShareKeys.length > 1 ? `(${selectedShareKeys.length})` : ""}` : "Select listings to send"}</Text>
          </Pressable>
        </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>

    <Modal visible={Boolean(previewUri)} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPreviewUri(undefined)}>
      <View style={styles.viewer}><Pressable onPress={() => setPreviewUri(undefined)} style={[styles.viewerClose, { top: insets.top + 16 }]} accessibilityRole="button" accessibilityLabel="Close photo"><Ionicons name="close" size={24} color="#FFFFFF" /></Pressable>{previewUri ? <Image source={{ uri: previewUri }} style={styles.viewerImage} contentFit="contain" /> : null}</View>
    </Modal>
  </View>;
}

function Avatar({ uri, label, styles, large = false, extraLarge = false }: { uri?: string; label: string; styles: ReturnType<typeof make>; large?: boolean; extraLarge?: boolean }) {
  return <View style={[styles.avatar, large && styles.avatarLarge, extraLarge && styles.avatarExtraLarge]}>{uri ? <Image cachePolicy="memory-disk" source={{ uri }} style={styles.avatarImage} contentFit="cover" /> : <Text style={[styles.avatarInitial, large && styles.avatarInitialLarge, extraLarge && styles.avatarInitialExtraLarge]}>{initials(label)}</Text>}</View>;
}

function make(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingBottom: 7, backgroundColor: colors.ink },
    headerIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
    profileHeader: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 },
    profileCopy: { flex: 1, minWidth: 0 },
    headerTitle: { color: colors.bone, fontSize: 19, fontWeight: "800", letterSpacing: -0.35 },
    headerSubtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
    avatar: { width: 38, height: 38, borderRadius: 19, overflow: "hidden", backgroundColor: colors.neutral, alignItems: "center", justifyContent: "center" },
    avatarLarge: { width: 54, height: 54, borderRadius: 27 },
    avatarExtraLarge: { width: 78, height: 78, borderRadius: 39 },
    avatarImage: { width: "100%", height: "100%" },
    avatarInitial: { color: colors.bone, fontWeight: "800", fontSize: 13 },
    avatarInitialLarge: { fontSize: 18 },
    avatarInitialExtraLarge: { fontSize: 25 },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 9, marginHorizontal: 14, marginTop: 12, marginBottom: 3, paddingHorizontal: 12, height: 42, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}15` },
    searchInput: { flex: 1, color: colors.bone, fontSize: 14, paddingVertical: 0 },
    keyboardArea: { flex: 1 },
    blockedConversation: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36, gap: 12 },
    blockedConversationTitle: { color: colors.bone, fontSize: 24, fontWeight: "800", textAlign: "center" },
    blockedConversationCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 320 },
    unblockButton: { minHeight: 46, minWidth: 132, paddingHorizontal: 22, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: colors.success, marginTop: 8 },
    unblockButtonText: { color: colors.successInk, fontSize: 15, fontWeight: "800" },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, flexGrow: 1, justifyContent: "flex-end" },
    listContentEmpty: { minHeight: 120 },
    dayRule: { alignItems: "center", alignSelf: "center", marginTop: 8, marginBottom: 13, paddingHorizontal: 8, paddingVertical: 4 },
    dayPill: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.55 },
    messageLine: { flexDirection: "row", alignItems: "flex-end", marginBottom: 3 },
    messageLineMine: { justifyContent: "flex-end" },
    messageLinePeer: { justifyContent: "flex-start" },
    messageLineGrouped: { marginTop: -2 },
    avatarSlot: { width: 40, marginRight: 6, alignItems: "center" },
    bubbleFrame: { maxWidth: "86%", minWidth: 56, borderRadius: 21, overflow: "hidden" },
    bubble: { paddingHorizontal: 16, paddingTop: 13, paddingBottom: 12, borderRadius: 21 },
    bubbleGradientImage: { borderRadius: 19 },
    bubbleMine: { backgroundColor: "transparent", borderBottomRightRadius: 7 },
    bubblePending: { opacity: 0.48 },
    bubblePeer: { backgroundColor: colors.neutral, borderBottomLeftRadius: 7 },
    bubbleMineGrouped: { borderBottomRightRadius: 7 },
    bubblePeerGrouped: { borderBottomLeftRadius: 7 },
    bubbleWithPhoto: { paddingHorizontal: 5, paddingTop: 5, paddingBottom: 6 },
    sharedListingCard: { width: 250, maxWidth: "100%", borderRadius: 14, overflow: "hidden", backgroundColor: colors.surface },
    sharedListingImage: { width: "100%", height: 178, backgroundColor: colors.neutral },
    sharedListingImageFallback: { alignItems: "center", justifyContent: "center" },
    sharedListingCopy: { paddingHorizontal: 11, paddingVertical: 9 },
    sharedListingBrand: { color: colors.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
    sharedListingName: { color: colors.bone, fontSize: 14, fontWeight: "800", marginTop: 3 },
    sharedListingPrice: { color: colors.bone, fontSize: 13, fontWeight: "700", marginTop: 4 },
    sharedListingNote: { color: colors.bone, fontSize: 14, lineHeight: 20, marginTop: 8, paddingHorizontal: 3 },
    voiceNote: { minWidth: 248, maxWidth: 292, minHeight: 65, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 18, backgroundColor: "#D92D4B" },
    voiceNoteMine: { backgroundColor: "#C92543" },
    voicePlayButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.22)" },
    voiceWaveform: { flex: 1, minWidth: 0, height: 25, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 1.4 },
    voiceWaveBar: { width: 2, borderRadius: 2, backgroundColor: "#FFFFFF" },
    voiceDuration: { color: "#FFFFFF", fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "700", minWidth: 29, textAlign: "right" },
    voiceLiveBanner: { flexDirection: "row", alignItems: "center", gap: 9, marginHorizontal: 16, marginBottom: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: "rgba(229,70,94,0.13)" },
    voiceLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E5465E" },
    voiceLiveText: { color: "#E5465E", fontSize: 12, fontWeight: "700" },
    senderPanel: { minHeight: 45, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 5, borderRadius: 0, backgroundColor: "transparent" },
    senderPanelCopy: { flex: 1, minWidth: 0 },
    senderName: { color: colors.bone, fontSize: 15, fontWeight: "800" },
    senderNameMine: { color: "#FFFFFF" },
    senderHandle: { color: colors.muted, fontSize: 11, marginTop: 2 },
    senderHandleMine: { color: "rgba(255,255,255,0.78)" },
    bubbleText: { fontSize: 18, lineHeight: 27 },
    bubbleTextMine: { color: "#FFFFFF" },
    bubbleTextPeer: { color: colors.bone },
    replyQuote: { flexDirection: "row", alignItems: "stretch", gap: 8, marginBottom: 9, paddingVertical: 2 },
    replyQuoteBar: { width: 3, borderRadius: 2, backgroundColor: colors.danger },
    replyQuoteBarMine: { backgroundColor: "rgba(255,255,255,0.85)" },
    replyQuoteCopy: { flex: 1, minWidth: 0 },
    replyQuoteName: { color: colors.bone, fontSize: 12, fontWeight: "800" },
    replyQuoteText: { color: colors.muted, fontSize: 13, marginTop: 2 },
    replyQuoteMine: { color: "rgba(255,255,255,0.9)" },
    messagePhoto: { width: 270, height: 430, maxWidth: "100%", borderRadius: 12, marginBottom: 5, backgroundColor: colors.neutral },
    emptyPrompt: { position: "absolute", zIndex: 1, alignSelf: "center", top: "47%" },
    emptyPromptText: { color: colors.muted, fontSize: 13 },
    loading: { position: "absolute", zIndex: 2, alignSelf: "center", top: "43%", alignItems: "center", gap: 10 },
    loadingText: { color: colors.muted, fontSize: 12 },
    errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginTop: 8, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12, backgroundColor: `${colors.danger}12` },
    errorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 17 },
    retryText: { color: colors.danger, fontSize: 12, fontWeight: "800", paddingHorizontal: 4 },
    searchEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 7 },
    searchEmptyTitle: { color: colors.bone, fontSize: 15, fontWeight: "700" },
    searchEmptyCopy: { color: colors.muted, fontSize: 12 },
    attachmentPreview: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 12, marginBottom: 7, padding: 8, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}12` },
    previewImage: { width: 44, height: 44, borderRadius: 9, backgroundColor: colors.neutral },
    previewCopy: { flex: 1 },
    previewTitle: { color: colors.bone, fontWeight: "700", fontSize: 12 },
    previewSubtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
    removePhoto: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.neutral },
    replyComposer: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.surface },
    replyComposerAccent: { width: 3, height: 34, borderRadius: 2, backgroundColor: colors.danger },
    replyComposerCopy: { flex: 1, minWidth: 0 },
    replyComposerTitle: { color: colors.bone, fontSize: 12, fontWeight: "800" },
    replyComposerText: { color: colors.muted, fontSize: 12, marginTop: 2 },
    composerWrap: { position: "relative", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, paddingTop: 7, backgroundColor: colors.ink },
    attachWrap: { width: 36, height: 44, zIndex: 30 },
    attachButton: { width: 36, height: 44, alignItems: "center", justifyContent: "center", marginBottom: 1 },
    attachMenu: { position: "absolute", left: -3, bottom: 51, width: 178, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.bone}18`, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 12, zIndex: 50 },
    attachMenuRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 14 },
    attachMenuText: { color: colors.bone, fontSize: 14, fontWeight: "600" },
    composerField: { flex: 1, minHeight: 46, maxHeight: 118, flexDirection: "row", alignItems: "center", borderRadius: 17, paddingLeft: 14, paddingRight: 11, backgroundColor: colors.surface },
    input: { flex: 1, maxHeight: 102, color: colors.bone, fontSize: 16, lineHeight: 22, paddingVertical: 10 },
    charCount: { color: colors.subtle, fontSize: 9, marginLeft: 5 },
    voiceRecordButton: { width: 42, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 1, backgroundColor: "rgba(229,70,94,0.10)", borderWidth: 1, borderColor: "rgba(229,70,94,0.28)" },
    voiceRecordButtonActive: { backgroundColor: "#E5465E", borderColor: "#E5465E", transform: [{ scale: 1.06 }] },
    sendButton: { minWidth: 51, height: 44, alignItems: "center", justifyContent: "center", marginBottom: 1 },
    sendTxt: { color: colors.success, fontSize: 14, fontWeight: "800" },
    sendButtonDisabled: { opacity: 0.35 },
    actionModal: { flex: 1, justifyContent: "flex-end" },
    actionScrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)" },
    actionSheet: { paddingHorizontal: 22, paddingTop: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
    actionHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", backgroundColor: colors.subtle, opacity: 0.6, marginBottom: 15 },
    actionTimestamp: { color: colors.muted, fontSize: 12, textAlign: "center", fontWeight: "700" },
    actionExcerpt: { color: colors.bone, fontSize: 15, textAlign: "center", marginTop: 7, marginBottom: 12 },
    actionRow: { minHeight: 51, flexDirection: "row", alignItems: "center", gap: 15 },
    actionLabel: { color: colors.bone, fontSize: 17, fontWeight: "600" },
    actionCopiedLabel: { color: colors.success },
    actionDeleteLabel: { color: colors.danger, fontSize: 16, fontWeight: "700" },
    viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)", alignItems: "center", justifyContent: "center" },
    viewerClose: { position: "absolute", zIndex: 2, right: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(35,35,35,0.75)", alignItems: "center", justifyContent: "center" },
    viewerImage: { width: "100%", height: "82%" },
    shareSheetModal: { flex: 1, justifyContent: "flex-end" },
    shareSheetKeyboardDock: { flex: 1, justifyContent: "flex-end" },
    shareSheetScrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.48)" },
    shareSheet: { maxHeight: "82%", paddingHorizontal: 18, paddingTop: 8, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.surface },
    shareSheetHandleArea: { height: 24, alignItems: "center", justifyContent: "center" },
    shareSheetHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 5, paddingBottom: 13 },
    shareSearchRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 11, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.ink, borderWidth: 1, borderColor: `${colors.bone}15` },
    shareSearchInput: { flex: 1, color: colors.bone, fontSize: 14, paddingVertical: 0 },
    shareSheetTitle: { color: colors.bone, fontSize: 20, fontWeight: "800" },
    shareSheetSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
    shareListingScroll: { flexGrow: 0, maxHeight: 440 },
    shareListingContent: { paddingBottom: 10, gap: 8 },
    shareListingRow: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 11, padding: 8, borderRadius: 15, borderWidth: 1, borderColor: `${colors.bone}12`, backgroundColor: colors.ink },
    shareListingRowSelected: { borderColor: colors.success, backgroundColor: `${colors.success}14` },
    shareListingThumb: { width: 58, height: 62, borderRadius: 10, backgroundColor: colors.neutral },
    shareListingInfo: { flex: 1, minWidth: 0 },
    shareListingBrand: { color: colors.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
    shareListingName: { color: colors.bone, fontSize: 13, fontWeight: "700", marginTop: 3 },
    shareListingPrice: { color: colors.bone, fontSize: 12, marginTop: 3 },
    shareCheck: { width: 23, height: 23, borderRadius: 12, borderWidth: 1.5, borderColor: colors.subtle, alignItems: "center", justifyContent: "center" },
    shareCheckSelected: { borderColor: colors.success, backgroundColor: colors.success },
    shareEmpty: { minHeight: 205, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
    shareEmptyText: { color: colors.muted, textAlign: "center", fontSize: 14 },
    shareSendButton: { minHeight: 50, borderRadius: 25, marginTop: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.success },
    shareSendDisabled: { opacity: 0.45 },
    shareSendText: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  });
}
