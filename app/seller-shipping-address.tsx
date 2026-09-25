import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMarket } from "../lib/markets";
import { loadSellerShippingSettings, saveSellerShippingSettings, type SellerAddress } from "../lib/sellerShipping";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";

type AddressField = "name" | "phone" | "line1" | "line2" | "city" | "region" | "postal";
type AddressForm = Omit<SellerAddress, "country">;

type AddressLabels = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  regionRequired: boolean;
};

function labelsFor(country: string): AddressLabels {
  switch (getMarket(country).code) {
    case "US": return { line1: "Street address", line2: "Apartment, suite (optional)", city: "City", region: "State", postal: "ZIP code", regionRequired: true };
    case "CA": return { line1: "Street address", line2: "Apartment, unit (optional)", city: "City or town", region: "Province", postal: "Postal code", regionRequired: true };
    case "MX": return { line1: "Street and number", line2: "Apartment, interior (optional)", city: "City or municipality", region: "State", postal: "Postal code", regionRequired: true };
    case "BR": return { line1: "Street and number", line2: "Apartment, complement (optional)", city: "City", region: "State", postal: "CEP", regionRequired: true };
    case "AR": return { line1: "Street and number", line2: "Apartment (optional)", city: "City", region: "Province", postal: "Postal code", regionRequired: true };
    case "CO": return { line1: "Street and number", line2: "Apartment, unit (optional)", city: "City or municipality", region: "Department", postal: "Postal code", regionRequired: true };
    case "CL": return { line1: "Street and number", line2: "Apartment (optional)", city: "Commune", region: "Region", postal: "Postal code", regionRequired: true };
    case "PE": return { line1: "Street and number", line2: "Apartment, interior (optional)", city: "District or city", region: "Province or region", postal: "Postal code", regionRequired: false };
    case "IN": return { line1: "Address and area", line2: "Apartment, landmark (optional)", city: "City", region: "State or union territory", postal: "PIN code", regionRequired: true };
    case "AU": return { line1: "Street address", line2: "Unit, apartment (optional)", city: "Suburb or locality", region: "State or territory", postal: "Postcode", regionRequired: true };
    case "JP": return { line1: "Street address", line2: "Building, room (optional)", city: "City, ward or town", region: "Prefecture", postal: "Postal code", regionRequired: true };
    case "CN": return { line1: "Street address", line2: "Building, room (optional)", city: "City", region: "Province or municipality", postal: "Postal code", regionRequired: true };
    case "ZA": return { line1: "Street address", line2: "Unit, building (optional)", city: "City or suburb", region: "Province", postal: "Postal code", regionRequired: true };
    case "NG": return { line1: "Street address", line2: "Apartment, landmark (optional)", city: "City or town", region: "State", postal: "Postal code", regionRequired: true };
    case "GH": return { line1: "Street address or digital address", line2: "Apartment, landmark (optional)", city: "City or town", region: "Region", postal: "Postcode (optional)", regionRequired: true };
    case "KE": return { line1: "Street, building or estate", line2: "Apartment, unit (optional)", city: "Town or city", region: "County", postal: "Postal code", regionRequired: false };
    case "AE": return { line1: "Street and building", line2: "Apartment, unit (optional)", city: "City", region: "Emirate", postal: "Postal code (optional)", regionRequired: true };
    default: return { line1: "Address line", line2: "Apartment, suite or unit (optional)", city: "City or locality", region: "State, province or region", postal: "Postal code", regionRequired: false };
  }
}

const emptyAddress = (name: string): AddressForm => ({ name, phone: "", line1: "", line2: "", city: "", region: "", postal: "" });

export default function SellerShippingAddress() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const market = getMarket(app.country);
  const labels = labelsFor(market.code);
  const [address, setAddress] = useState<AddressForm>(() => emptyAddress(app.displayName || ""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadSellerShippingSettings().then((settings) => {
      if (!settings.address) return;
      const next = settings.address;
      setAddress({ name: next.name || app.displayName || "", phone: next.phone || "", line1: next.line1 || "", line2: next.line2 || "", city: next.city || "", region: next.region || "", postal: next.postal || "" });
    });
  }, [app.displayName]);

  const update = (field: AddressField, value: string) => setAddress((current) => ({ ...current, [field]: value }));
  const valid = Boolean(address.name.trim() && address.phone.trim() && address.line1.trim() && address.city.trim() && (labels.postal.includes("optional") || address.postal.trim()) && (!labels.regionRequired || address.region.trim()));

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await saveSellerShippingSettings({ address: { ...address, name: address.name.trim(), phone: address.phone.trim(), line1: address.line1.trim(), line2: address.line2?.trim() || undefined, city: address.city.trim(), region: address.region.trim(), postal: address.postal.trim(), country: market.code } });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.page}>
      <StatusBar style={colors.ink === "#000000" ? "light" : "dark"} />
      <View style={[styles.nav, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navBtn} accessibilityLabel="Go back"><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.navTitle}>Shipping address</Text>
        <View style={styles.navSpacer} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>Where you send from</Text>
          <Text style={styles.lede}>Add the address where you normally pack or hand over sold items.</Text>
          <Field label="Full name" value={address.name} onChange={(value) => update("name", value)} colors={colors} required />
          <Field label="Phone number" value={address.phone} onChange={(value) => update("phone", value)} colors={colors} keyboard="phone-pad" required />
          <Field label={labels.line1} value={address.line1} onChange={(value) => update("line1", value)} colors={colors} required />
          <Field label={labels.line2} value={address.line2 || ""} onChange={(value) => update("line2", value)} colors={colors} />
          <Field label={labels.city} value={address.city} onChange={(value) => update("city", value)} colors={colors} required />
          <Field label={`${labels.region}${labels.regionRequired ? "" : " (optional)"}`} value={address.region} onChange={(value) => update("region", value)} colors={colors} required={labels.regionRequired} />
          <Field label={labels.postal} value={address.postal} onChange={(value) => update("postal", value)} colors={colors} required={!labels.postal.includes("optional")} />
          <Text style={styles.note}>This address is for the {market.name} store.</Text>
          <Pressable onPress={() => void save()} disabled={!valid || saving} style={[styles.save, (!valid || saving) && styles.saveDisabled]} accessibilityRole="button"><Text style={styles.saveText}>{saving ? "Saving…" : "Save address"}</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, value, onChange, colors, keyboard, required }: { label: string; value: string; onChange: (value: string) => void; colors: Colors; keyboard?: "phone-pad"; required?: boolean }) {
  return <View style={{ marginBottom: 16 }}><Text style={{ color: colors.muted, fontSize: 13, marginBottom: 6 }}>{label}{required ? " *" : ""}</Text><TextInput value={value} onChangeText={onChange} placeholder={label} placeholderTextColor={`${colors.bone}47`} keyboardType={keyboard} style={{ height: 50, borderRadius: 12, borderWidth: 1, borderColor: `${colors.bone}2E`, paddingHorizontal: 14, color: colors.bone, fontSize: 16 }} /></View>;
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    flex: { flex: 1 },
    nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, paddingBottom: 8 },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navSpacer: { width: 44 },
    back: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    navTitle: { color: colors.bone, fontSize: 16, fontWeight: "600" },
    heading: { color: colors.bone, fontSize: 28, fontWeight: "800", marginBottom: 8 },
    lede: { color: colors.muted, fontSize: 15, lineHeight: 21, marginBottom: 24 },
    note: { color: colors.muted, marginTop: 4, marginBottom: 20 },
    save: { height: 52, borderRadius: 26, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    saveDisabled: { opacity: 0.4 },
    saveText: { color: colors.successInk, fontWeight: "700", fontSize: 16 },
  });
}
