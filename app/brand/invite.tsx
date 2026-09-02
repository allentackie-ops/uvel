import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { canManageTeam, findPeople, getBrand, memberRoleLabel, sendInvite, useBrands, type BrandPerson, type MemberRole } from "../../lib/brands";
import { useUvel } from "../../lib/store";
import { alpha, useColors, type Colors } from "../../lib/theme";

const INVITE_ROLES: Array<{ id: Exclude<MemberRole, "owner">; detail: string }> = [
  { id: "admin", detail: "Manage the workspace and team" },
  { id: "merchandiser", detail: "Manage products and inventory" },
  { id: "marketing", detail: "Manage brand content" },
  { id: "support", detail: "Handle buyers and orders" },
  { id: "finance", detail: "View orders and payouts" },
  { id: "viewer", detail: "View HQ without editing" },
  { id: "poster", detail: "List products for the brand" },
];

export default function BrandInvite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBrands();
  const app = useUvel();
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const brand = getBrand(id);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<BrandPerson[]>([]);
  const [sent, setSent] = useState<string[]>([]);
  const [role, setRole] = useState<Exclude<MemberRole, "owner">>("poster");

  if (!brand || !canManageTeam(brand, app.uid)) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 20, paddingHorizontal: 20 }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backTxt}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Only brand managers send invites.</Text>
      </View>
    );
  }

  const activeBrand = brand;

  async function search(v: string) {
    setQ(v);
    const people = await findPeople(v);
    setHits(people.filter((p) => p.uid !== app.uid && !activeBrand.members.some((m) => m.uid === p.uid)));
  }

  async function invite(person: BrandPerson) {
    try {
      await sendInvite({
        brandId: activeBrand.id,
        fromUid: app.uid,
        fromName: app.displayName || "Owner",
        person,
        role,
      });
      setSent((s) => [...s, person.uid]);
    } catch (err) {
      Alert.alert("Invite", err instanceof Error ? err.message : "Couldn’t send that.");
    }
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>Invite</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.title}>Who posts on {brand.name}</Text>
        <Text style={styles.p}>Search a name or email, then choose the access they need for this brand workspace.</Text>
        <Text style={styles.roleLabel}>Invite as</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roles}>
          {INVITE_ROLES.map((option) => (
            <Pressable key={option.id} onPress={() => setRole(option.id)} style={[styles.roleChip, role === option.id && styles.roleChipOn]}>
              <Text style={[styles.roleChipTxt, role === option.id && styles.roleChipTxtOn]}>{memberRoleLabel(option.id)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.roleDetail}>{INVITE_ROLES.find((option) => option.id === role)?.detail}</Text>
        <TextInput
          style={styles.field}
          value={q}
          onChangeText={(v) => void search(v)}
          placeholder="Name or email"
          placeholderTextColor={alpha(colors.bone, 0.32)}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {hits.map((p) => {
          const done = sent.includes(p.uid);
          return (
            <View key={p.uid} style={styles.row}>
              <View style={styles.face}>
                <Text style={styles.init}>{(p.name[0] || "U").toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.email}>{p.email}</Text>
              </View>
              <Pressable disabled={done} onPress={() => void invite(p)} style={[styles.btn, done && styles.btnOff]}>
                <Text style={[styles.btnTxt, done && styles.btnTxtOff]}>{done ? "Sent" : "Invite"}</Text>
              </Pressable>
            </View>
          );
        })}
        {q && !hits.length ? <Text style={styles.empty}>Nobody with that name or email yet.</Text> : null}
      </ScrollView>
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  backTxt: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
  topTitle: { color: colors.bone, fontSize: 16, fontWeight: "600" },
  title: { color: colors.bone, fontFamily: "Georgia", fontSize: 28, marginTop: 12, lineHeight: 34 },
  p: { color: alpha(colors.bone, 0.55), fontSize: 15, lineHeight: 22, marginTop: 8 },
  roleLabel: { color: alpha(colors.bone, 0.55), fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginTop: 20 },
  roles: { gap: 8, paddingVertical: 10 },
  roleChip: { height: 34, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: alpha(colors.bone, 0.18), justifyContent: "center" },
  roleChipOn: { backgroundColor: colors.success, borderColor: colors.success },
  roleChipTxt: { color: alpha(colors.bone, 0.7), fontSize: 12, fontWeight: "700" },
  roleChipTxtOn: { color: colors.ink },
  roleDetail: { color: alpha(colors.bone, 0.45), fontSize: 12, marginBottom: 2 },
  field: {
    marginTop: 18,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: alpha(colors.bone, 0.12),
    color: colors.bone,
    paddingHorizontal: 18,
    fontSize: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  face: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bone,
    alignItems: "center",
    justifyContent: "center",
  },
  init: { color: colors.ink, fontWeight: "800" },
  name: { color: colors.bone, fontWeight: "700", fontSize: 16 },
  email: { color: alpha(colors.bone, 0.5), fontSize: 13, marginTop: 2 },
  btn: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.bone, alignItems: "center", justifyContent: "center" },
  btnOff: { backgroundColor: colors.surface },
  btnTxt: { color: colors.ink, fontWeight: "800", fontSize: 13 },
  btnTxtOff: { color: alpha(colors.bone, 0.45) },
  empty: { color: alpha(colors.bone, 0.45), marginTop: 24, textAlign: "center" },
  });
}
