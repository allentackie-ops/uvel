import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { canStudio, findPeople, getBrand, sendInvite, useBrands, type BrandPerson } from "../../lib/brands";
import { useUvel } from "../../lib/store";

export default function BrandInvite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBrands();
  const app = useUvel();
  const insets = useSafeAreaInsets();
  const brand = getBrand(id);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<BrandPerson[]>([]);
  const [sent, setSent] = useState<string[]>([]);

  if (!brand || !canStudio(brand, app.uid)) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 20, paddingHorizontal: 20 }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backTxt}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Only the owner sends invites.</Text>
      </View>
    );
  }

  async function search(v: string) {
    setQ(v);
    const people = await findPeople(v);
    setHits(people.filter((p) => p.uid !== app.uid && !brand.members.some((m) => m.uid === p.uid)));
  }

  async function invite(person: BrandPerson) {
    try {
      await sendInvite({
        brandId: brand.id,
        fromUid: app.uid,
        fromName: app.displayName || "Owner",
        person,
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
        <Text style={styles.p}>Search a name or email. They join as a poster — they list, they don’t own the house.</Text>
        <TextInput
          style={styles.field}
          value={q}
          onChangeText={(v) => void search(v)}
          placeholder="Name or email"
          placeholderTextColor="rgba(244,240,230,0.32)"
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

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0B0A08" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  backTxt: { color: "#F4F0E6", fontSize: 34, lineHeight: 36, marginTop: -4 },
  topTitle: { color: "#F4F0E6", fontSize: 16, fontWeight: "600" },
  title: { color: "#F4F0E6", fontFamily: "Georgia", fontSize: 28, marginTop: 12, lineHeight: 34 },
  p: { color: "rgba(244,240,230,0.55)", fontSize: 15, lineHeight: 22, marginTop: 8 },
  field: {
    marginTop: 18,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#161512",
    borderWidth: 1,
    borderColor: "rgba(244,240,230,0.12)",
    color: "#F4F0E6",
    paddingHorizontal: 18,
    fontSize: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  face: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F4F0E6",
    alignItems: "center",
    justifyContent: "center",
  },
  init: { color: "#16140F", fontWeight: "800" },
  name: { color: "#F4F0E6", fontWeight: "700", fontSize: 16 },
  email: { color: "rgba(244,240,230,0.5)", fontSize: 13, marginTop: 2 },
  btn: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: "#F4F0E6", alignItems: "center", justifyContent: "center" },
  btnOff: { backgroundColor: "#2A2824" },
  btnTxt: { color: "#16140F", fontWeight: "800", fontSize: 13 },
  btnTxtOff: { color: "rgba(244,240,230,0.45)" },
  empty: { color: "rgba(244,240,230,0.45)", marginTop: 24, textAlign: "center" },
});
