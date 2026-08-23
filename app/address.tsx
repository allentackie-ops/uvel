import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMarket } from "../lib/markets";
import { loadAddress, saveAddress } from "../lib/orders";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";

export default function Address() {
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const { country, displayName } = useUvel();
  const market = getMarket(country);
  const [name, setName] = useState(displayName);
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");
  const ph = "rgba(244,240,230,0.28)";
  const ok = name.trim() && line1.trim() && city.trim() && postal.trim();

  useEffect(() => {
    void loadAddress().then((a) => {
      if (!a) return;
      setName(a.name);
      setPhone(a.phone);
      setLine1(a.line1);
      setLine2(a.line2);
      setCity(a.city);
      setRegion(a.region);
      setPostal(a.postal);
    });
  }, []);

  async function save() {
    await saveAddress({
      name: name.trim(),
      phone: phone.trim(),
      line1: line1.trim(),
      line2: line2.trim(),
      city: city.trim(),
      region: region.trim(),
      postal: postal.trim(),
      country: market.code,
    });
    router.back();
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn}>
          <Text style={styles.navBack}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>Shipping address</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
          <Field label="Full name" value={name} onChange={setName} ph={ph} colors={colors} />
          <Field label="Phone" value={phone} onChange={setPhone} ph={ph} colors={colors} keyboard="phone-pad" />
          <Field label="Address" value={line1} onChange={setLine1} ph={ph} colors={colors} />
          <Field label="Apt, suite (optional)" value={line2} onChange={setLine2} ph={ph} colors={colors} />
          <Field label="City" value={city} onChange={setCity} ph={ph} colors={colors} />
          <Field label="State / region" value={region} onChange={setRegion} ph={ph} colors={colors} />
          <Field label="Postal code" value={postal} onChange={setPostal} ph={ph} colors={colors} />
          <Text style={styles.note}>Ships to {market.name}.</Text>
          <Pressable onPress={() => void save()} disabled={!ok} style={[styles.save, !ok && { opacity: 0.4 }]}>
            <Text style={styles.saveTxt}>Save address</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  ph,
  colors,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  ph: string;
  colors: Colors;
  keyboard?: "phone-pad";
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={ph}
        keyboardType={keyboard}
        style={{
          height: 48,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "rgba(244,240,230,0.18)",
          paddingHorizontal: 14,
          color: colors.bone,
          fontSize: 16,
        }}
      />
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    nav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 6,
      paddingBottom: 8,
    },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navBack: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    navTitle: { color: colors.bone, fontSize: 16, fontWeight: "600" },
    note: { color: colors.muted, marginTop: 4, marginBottom: 20 },
    save: {
      height: 52,
      borderRadius: 26,
      backgroundColor: "#D6E27A",
      alignItems: "center",
      justifyContent: "center",
    },
    saveTxt: { color: "#16140F", fontWeight: "700", fontSize: 16 },
  });
}
