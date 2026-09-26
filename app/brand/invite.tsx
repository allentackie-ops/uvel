import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { canManageTeam, createExternalInvite, findPeople, getBrand, inviteLink, memberRoleLabel, sendInvite, themeFor, useBrands, type BrandPerson, type MemberRole } from "../../lib/brands";
import { useUvel } from "../../lib/store";
import { useColors, useResolvedAppearance } from "../../lib/theme";
import { adaptBrandThemeToAppearance } from "../../lib/brandThemes";

const INVITE_ROLES: Array<{ id: Exclude<MemberRole, "owner">; detail: string }> = [
  { id: "admin", detail: "Manage the workspace and team" },
  { id: "merchandiser", detail: "Manage products and inventory" },
  { id: "marketing", detail: "Manage brand content" },
  { id: "support", detail: "Handle buyers and orders" },
  { id: "finance", detail: "View orders and payouts" },
  { id: "viewer", detail: "View HQ without editing" },
];

export default function BrandInvite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBrands();
  const app = useUvel();
  const colors = useColors();
  const appearance = useResolvedAppearance();
  const insets = useSafeAreaInsets();
  const brand = getBrand(id);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<BrandPerson[]>([]);
  const [sent, setSent] = useState<string[]>([]);
  const [role, setRole] = useState<Exclude<MemberRole, "owner">>("viewer");
  const [external, setExternal] = useState("");
  const [copied, setCopied] = useState(false);
  const theme = brand
    ? adaptBrandThemeToAppearance(themeFor(brand), appearance, colors)
    : null;

  if (!brand || !canManageTeam(brand, app.uid)) {
    return <View style={[styles.page, { backgroundColor: colors.ink, paddingTop: insets.top + 20, paddingHorizontal: 20 }]}><Pressable onPress={() => router.back()}><Text style={[styles.backTxt, { color: colors.bone }]}>‹ Back</Text></Pressable><Text style={[styles.title, { color: colors.bone }]}>Only brand managers send invites.</Text></View>;
  }
  const activeBrand = brand;

  async function search(value: string) {
    setQ(value);
    const people = await findPeople(value);
    setHits(people.filter((p) => p.uid !== app.uid && !activeBrand.members.some((m) => m.uid === p.uid)));
  }

  async function invite(person: BrandPerson) {
    try {
      await sendInvite({ brandId: activeBrand.id, fromUid: app.uid, fromName: app.displayName || "Owner", person, role });
      setSent((items) => [...items, person.uid]);
    } catch (err) {
      Alert.alert("Invite", err instanceof Error ? err.message : "Couldn’t send that.");
    }
  }

  async function makeExternalInvite() {
    try {
      const invite = await createExternalInvite({ brandId: activeBrand.id, fromUid: app.uid, fromName: app.displayName || "Owner", role });
      setExternal(inviteLink(invite.id));
    } catch (err) {
      Alert.alert("Invite link", err instanceof Error ? err.message : "Couldn’t create that link.");
    }
  }

  async function shareExternal() {
    if (!external) return;
    try { await Share.share({ message: `Join ${activeBrand.name} on Uvel: ${external}`, title: `Join ${activeBrand.name}` }); } catch { /* cancelled */ }
  }

  async function copyExternal() {
    if (!external) return;
    await Clipboard.setStringAsync(external);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <View style={[styles.page, { backgroundColor: theme?.bg }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
        <View style={styles.top}><Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}><Text style={[styles.backTxt, { color: theme?.ink }]}>‹</Text></Pressable><Text style={[styles.topTitle, { color: theme?.ink }]}>Invite to {activeBrand.name}</Text><View style={{ width: 40 }} /></View>
        <Text style={[styles.title, { color: theme?.ink }]}>Bring the right people in.</Text>
        <Text style={[styles.p, { color: theme?.muted }]}>Search Uvel by name or username.</Text>
        <Text style={[styles.roleLabel, { color: theme?.muted }]}>Invite as</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roles}>{INVITE_ROLES.map((option) => <Pressable key={option.id} onPress={() => setRole(option.id)} style={[styles.roleChip, { borderColor: theme?.lineColor }, role === option.id && { backgroundColor: theme?.accent, borderColor: theme?.accent }]}><Text style={[styles.roleChipTxt, { color: theme?.muted }, role === option.id && { color: theme?.accentInk }]}>{memberRoleLabel(option.id)}</Text></Pressable>)}</ScrollView>
        <Text style={[styles.roleDetail, { color: theme?.muted }]}>{INVITE_ROLES.find((option) => option.id === role)?.detail}</Text>
        <TextInput style={[styles.field, { backgroundColor: theme?.card, borderColor: theme?.lineColor, color: theme?.ink }]} value={q} onChangeText={(value) => void search(value)} placeholder="Name or @username" placeholderTextColor={theme?.muted} autoCapitalize="none" autoCorrect={false} />
        {hits.map((person) => {
          const done = sent.includes(person.uid);
          return <View key={person.uid} style={styles.row}>{person.photo ? <Image source={{ uri: person.photo }} style={styles.face} /> : <View style={[styles.face, { backgroundColor: theme?.accent }]}><Text style={[styles.init, { color: theme?.accentInk }]}>{(person.name[0] || "U").toUpperCase()}</Text></View>}<View style={{ flex: 1 }}><Text style={[styles.name, { color: theme?.ink }]}>{person.name}</Text><Text style={[styles.handle, { color: theme?.muted }]}>{person.username ? `@${person.username}` : "Uvel member"}</Text></View><Pressable disabled={done} onPress={() => void invite(person)} style={[styles.btn, { backgroundColor: theme?.accent }, done && { backgroundColor: theme?.card }]}><Text style={[styles.btnTxt, { color: theme?.accentInk }, done && { color: theme?.muted }]}>{done ? "Sent" : "Invite"}</Text></Pressable></View>;
        })}
        {q && !hits.length ? <Text style={[styles.empty, { color: theme?.muted }]}>No Uvel profile found yet.</Text> : null}
        <View style={[styles.divider, { backgroundColor: theme?.lineColor }]} />
        <Text style={[styles.section, { color: theme?.muted }]}>INVITE EXTERNALLY</Text>
        <Text style={[styles.p, { color: theme?.muted }]}>Create one link to send outside Uvel. New people can download and set up Uvel first.</Text>
        {external ? <View style={[styles.linkBox, { backgroundColor: theme?.card }]}><Text selectable style={[styles.link, { color: theme?.muted }]}>{external}</Text><View style={styles.linkActions}><Pressable onPress={() => void copyExternal()}><Text style={[styles.action, { color: theme?.accent }]}>{copied ? "Copied" : "Copy link"}</Text></Pressable><Pressable onPress={() => void shareExternal()}><Text style={[styles.action, { color: theme?.accent }]}>Share</Text></Pressable></View></View> : <Pressable onPress={() => void makeExternalInvite()} style={[styles.primary, { backgroundColor: theme?.accent }]}><Text style={[styles.primaryTxt, { color: theme?.accentInk }]}>Create invite link</Text></Pressable>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#000000" }, top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 }, backTxt: { color: "#F4F0E6", fontSize: 34, lineHeight: 36, marginTop: -4 }, topTitle: { color: "#F4F0E6", fontSize: 16, fontWeight: "600" }, title: { color: "#F4F0E6", fontSize: 28, fontWeight: "800", marginTop: 12, lineHeight: 34 }, p: { color: "rgba(244,240,230,0.55)", fontSize: 15, lineHeight: 22, marginTop: 8 }, roleLabel: { color: "rgba(244,240,230,0.55)", fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginTop: 20 }, roles: { gap: 8, paddingVertical: 10 }, roleChip: { height: 34, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: "rgba(244,240,230,0.18)", justifyContent: "center" }, roleChipOn: { backgroundColor: "#D6E27A", borderColor: "#D6E27A" }, roleChipTxt: { color: "rgba(244,240,230,0.7)", fontSize: 12, fontWeight: "700" }, roleChipTxtOn: { color: "#16140F" }, roleDetail: { color: "rgba(244,240,230,0.45)", fontSize: 12, marginBottom: 2 }, field: { marginTop: 18, height: 48, borderRadius: 24, backgroundColor: "#161512", borderWidth: 1, borderColor: "rgba(244,240,230,0.12)", color: "#F4F0E6", paddingHorizontal: 18, fontSize: 16 }, row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }, face: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#D6E27A", alignItems: "center", justifyContent: "center" }, init: { color: "#16140F", fontWeight: "800" }, name: { color: "#F4F0E6", fontWeight: "700", fontSize: 16 }, handle: { color: "rgba(244,240,230,0.5)", fontSize: 13, marginTop: 2 }, btn: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: "#D6E27A", alignItems: "center", justifyContent: "center" }, btnOff: { backgroundColor: "#2A2824" }, btnTxt: { color: "#16140F", fontWeight: "800", fontSize: 13 }, btnTxtOff: { color: "rgba(244,240,230,0.45)" }, empty: { color: "rgba(244,240,230,0.45)", marginTop: 24, textAlign: "center" }, divider: { height: 1, backgroundColor: "rgba(244,240,230,0.12)", marginVertical: 28 }, section: { color: "rgba(244,240,230,0.5)", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }, linkBox: { marginTop: 14, backgroundColor: "#161512", borderRadius: 16, padding: 16 }, link: { color: "rgba(244,240,230,0.72)", fontSize: 13, lineHeight: 20 }, linkActions: { flexDirection: "row", gap: 20, marginTop: 14 }, action: { color: "#D6E27A", fontWeight: "800" }, primary: { marginTop: 18, height: 52, borderRadius: 26, backgroundColor: "#D6E27A", alignItems: "center", justifyContent: "center" }, primaryTxt: { color: "#16140F", fontWeight: "800", fontSize: 16 },
});
