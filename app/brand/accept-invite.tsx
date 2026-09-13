import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { acceptInvite, getInvite, loadInvite, useBrands } from "../../lib/brands";
import { useUvel } from "../../lib/store";

const PENDING_INVITE = "uvel-pending-brand-invite";

export default function AcceptBrandInvite() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const app = useUvel();
  useBrands();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState(true);
  const [remoteInvite, setRemoteInvite] = useState(() => getInvite(String(id || "")));
  const invite = remoteInvite || getInvite(String(id || ""));

  useEffect(() => {
    if (!id) return;
    void AsyncStorage.setItem(PENDING_INVITE, String(id));
    void loadInvite(String(id)).then(setRemoteInvite);
  }, [id]);

  useEffect(() => {
    if (!app.uid || !id || !invite) {
      setPending(false);
      return;
    }
    void (async () => {
      try {
        await acceptInvite(String(id), app.uid, app.displayName || "Uvel member", app.avatarUri || app.personUri || undefined);
        await AsyncStorage.removeItem(PENDING_INVITE);
        router.replace({ pathname: "/brand/hq", params: { id: invite.brandId } });
      } catch (error) {
        setPending(false);
        Alert.alert("Invite", error instanceof Error ? error.message : "Couldn’t accept this invite.");
      }
    })();
  }, [app.uid, id, invite?.id]);

  if (pending && app.uid && invite) return <View style={[styles.page, { paddingTop: insets.top + 40 }]}><ActivityIndicator color="#D6E27A" /><Text style={styles.wait}>Joining {invite.brandName}…</Text></View>;
  if (!invite) return <View style={[styles.page, { paddingTop: insets.top + 40 }]}><Text style={styles.kicker}>BRAND INVITE</Text><Text style={styles.title}>This invite is unavailable.</Text><Text style={styles.body}>It may have expired or already been accepted.</Text><Pressable onPress={() => router.replace("/")} style={styles.primary}><Text style={styles.primaryTxt}>Go to Uvel</Text></Pressable></View>;
  return <View style={[styles.page, { paddingTop: insets.top + 40 }]}>{invite.brandLogo ? <Image source={{ uri: invite.brandLogo }} style={styles.logo} /> : null}<Text style={styles.kicker}>BRAND INVITE</Text><Text style={styles.title}>{invite.fromName} invited you to join {invite.brandName}.</Text><Text style={styles.body}>Create or sign in to your Uvel account, then open this link again to accept the invite and enter Brand HQ.</Text><Pressable onPress={() => router.push("/onboard")} style={styles.primary}><Text style={styles.primaryTxt}>Set up Uvel</Text></Pressable><Pressable onPress={() => router.push("/onboard")} style={styles.secondary}><Text style={styles.secondaryTxt}>I already have an account</Text></Pressable></View>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#000", paddingHorizontal: 24 }, logo: { width: 72, height: 72, borderRadius: 18, marginBottom: 22 }, kicker: { color: "#D6E27A", fontSize: 11, fontWeight: "800", letterSpacing: 1.6 }, title: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 29, lineHeight: 35, marginTop: 12 }, body: { color: "rgba(244,240,230,0.58)", fontSize: 16, lineHeight: 23, marginTop: 14 }, wait: { color: "#F4F0E6", fontSize: 16, marginTop: 14, textAlign: "center" }, primary: { height: 52, borderRadius: 26, backgroundColor: "#D6E27A", alignItems: "center", justifyContent: "center", marginTop: 28 }, primaryTxt: { color: "#16140F", fontWeight: "800", fontSize: 16 }, secondary: { height: 52, borderRadius: 26, borderWidth: 1, borderColor: "rgba(244,240,230,0.2)", alignItems: "center", justifyContent: "center", marginTop: 12 }, secondaryTxt: { color: "#F4F0E6", fontWeight: "800", fontSize: 16 } });
