import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { addFriendFromShare } from "../lib/friends";
import { useColors } from "../lib/theme";

type SharedFriend = { uid: string; name: string; username?: string; pieceId?: string };

type Props = { uid: string };

function parseSharedFriend(url: string): SharedFriend | null {
  if (!url.startsWith("uvel://")) return null;
  const match = url.match(/^uvel:\/\/(?:piece\/([^?]+)|[^?]+)(?:\?(.*))?$/);
  if (!match) return null;
  const getParam = (key: string) => {
    const encoded = (match[2] || "").split("&").find((item) => item.split("=")[0] === key)?.slice(key.length + 1);
    if (!encoded) return "";
    try { return decodeURIComponent(encoded); } catch { return encoded; }
  };
  const uid = getParam("sharedBy");
  if (!uid) return null;
  return {
    uid,
    name: getParam("sharedByName") || "A friend",
    username: getParam("sharedByUsername") || undefined,
    pieceId: match[1] || undefined,
  };
}

export function FriendShareLinkNotice({ uid }: Props) {
  const colors = useColors();
  const [sharedFriend, setSharedFriend] = useState<SharedFriend | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const seen = useRef("");

  useEffect(() => {
    const receive = (url: string | null) => {
      if (!url || url === seen.current) return;
      const parsed = parseSharedFriend(url);
      if (!parsed || parsed.uid === uid) return;
      seen.current = url;
      setConfirmed(false);
      setSharedFriend(parsed);
    };
    void Linking.getInitialURL().then(receive).catch(() => undefined);
    const subscription = Linking.addEventListener("url", ({ url }) => receive(url));
    return () => subscription.remove();
  }, [uid]);

  if (!sharedFriend) return null;
  const name = sharedFriend.name || (sharedFriend.username ? `@${sharedFriend.username}` : "your friend");

  async function addNow() {
    setBusy(true);
    try {
      await addFriendFromShare(sharedFriend.uid);
      setConfirmed(true);
      setTimeout(() => setSharedFriend(null), 1800);
    } catch {
      setBusy(false);
    }
  }

  function later() {
    setSharedFriend(null);
    setConfirmed(false);
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: `${colors.bone}20` }]}>
        <View style={[styles.avatar, { backgroundColor: colors.success }]}><Text style={[styles.avatarText, { color: colors.successInk }]}>{name.slice(0, 1).toUpperCase()}</Text></View>
        {confirmed ? <>
          <Text style={[styles.title, { color: colors.bone }]}>{name} has been added as a friend.</Text>
          <Text style={[styles.body, { color: colors.muted }]}>You’re now connected on Uvel.</Text>
        </> : <>
          <Text style={[styles.title, { color: colors.bone }]}>{name} shared this with you</Text>
          <Text style={[styles.body, { color: colors.muted }]}>Add them as a friend to stay connected on Uvel.</Text>
          <Text style={[styles.suggested, { color: colors.subtle }]}>SUGGESTED FOR YOU</Text>
          <View style={styles.actions}>
            <Pressable disabled={busy} onPress={() => void addNow()} style={[styles.primary, { backgroundColor: colors.success, opacity: busy ? 0.55 : 1 }]} accessibilityRole="button" accessibilityLabel={`Add ${name} as a friend`}><Text style={[styles.primaryText, { color: colors.successInk }]}>{busy ? "Adding…" : "Add now"}</Text></Pressable>
            <Pressable onPress={later} style={styles.secondary} accessibilityRole="button" accessibilityLabel="Add friend later"><Text style={[styles.secondaryText, { color: colors.bone }]}>Later</Text></Pressable>
          </View>
        </>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", padding: 24, zIndex: 200 },
  card: { width: "100%", maxWidth: 390, borderRadius: 28, borderWidth: 1, padding: 26, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 18 },
  avatar: { width: 78, height: 78, borderRadius: 39, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  avatarText: { fontSize: 32, fontWeight: "900" },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "800", textAlign: "center" },
  body: { fontSize: 15, lineHeight: 21, textAlign: "center", marginTop: 9 },
  suggested: { fontSize: 10, letterSpacing: 1.5, fontWeight: "800", marginTop: 20 },
  actions: { width: "100%", gap: 10, marginTop: 20 },
  primary: { height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  primaryText: { fontSize: 16, fontWeight: "900" },
  secondary: { height: 46, borderRadius: 23, borderWidth: 1, borderColor: "rgba(244,240,230,0.16)", alignItems: "center", justifyContent: "center" },
  secondaryText: { fontSize: 15, fontWeight: "700" },
});
