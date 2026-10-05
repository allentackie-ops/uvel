import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMarket, MARKETS } from "../lib/markets";
import { addAddress, loadAddress, saveAddress, type Address } from "../lib/orders";
import { useUvel } from "../lib/store";

const COLORS = {
  header: "#214F9C",
  blue: "#2E63D4",
  blueSoft: "#EAF1FF",
  blueBorder: "#D6E3FF",
  lime: "#D6E27A",
  page: "#F3F6FB",
  white: "#FFFFFF",
  text: "#17263B",
  muted: "#68778C",
  hint: "#8D9AAF",
  border: "#D8E1EE",
  separator: "#E7EDF5",
  success: "#247A59",
  successSoft: "#EAF6F0",
};

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts",
  "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

const CA_PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia",
  "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon",
];

type PickerMode = "country" | "region" | null;

export default function Address() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { displayName } = useUvel();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const adding = mode === "add";

  const [selectedCountry, setSelectedCountry] = useState("US");
  const [name, setName] = useState(displayName);
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const country = getMarket(selectedCountry);
  const regionOptions = selectedCountry === "US" ? US_STATES : selectedCountry === "CA" ? CA_PROVINCES : null;
  const postalLabel = selectedCountry === "US" ? "ZIP Code" : "Postal code";
  const valid = Boolean(name.trim() && line1.trim() && city.trim() && postal.trim());

  useEffect(() => {
    let active = true;
    if (adding) {
      setSelectedCountry("US");
      setName(displayName);
      setMakeDefault(false);
      return () => { active = false; };
    }
    void loadAddress().then((address) => {
      if (!active || !address) return;
      setName(address.name || displayName);
      setPhone(address.phone || "");
      setLine1(address.line1 || "");
      setLine2(address.line2 || "");
      setCity(address.city || "");
      setRegion(address.region || "");
      setPostal(address.postal || "");
      setSelectedCountry(getMarket(address.country || "US").code);
      setMakeDefault(true);
    });
    return () => { active = false; };
  }, [adding, displayName]);

  async function useMyLocation() {
    if (locating) return;
    Keyboard.dismiss();
    setLocationMessage("");
    setLocating(true);
    try {
      const Location = await import("expo-location");
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        if (!permission.canAskAgain) {
          Alert.alert(
            "Location permission is off",
            "Allow Uvel to use your location in Settings, then try again.",
            [
              { text: "Not now", style: "cancel" },
              { text: "Open Settings", onPress: () => { void Linking.openSettings(); } },
            ],
          );
        } else {
          Alert.alert("Location permission needed", "Uvel uses your location only when you tap Use my location to fill this address.");
        }
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (!place) {
        Alert.alert("Address not found", "Your location was received, but it could not be converted into an address. Please enter it manually.");
        return;
      }

      const street = [place.streetNumber, place.street].filter(Boolean).join(" ") || place.name || "";
      if (street) setLine1(street);
      if (place.city || place.subregion || place.district) setCity(place.city || place.subregion || place.district || "");
      if (place.region || place.subregion) setRegion(place.region || place.subregion || "");
      if (place.postalCode) setPostal(place.postalCode);

      const detectedCode = place.isoCountryCode?.toUpperCase();
      const supportedCountry = MARKETS.find((market) => market.code === detectedCode);
      if (supportedCountry) {
        setSelectedCountry(supportedCountry.code);
        setLocationMessage("Location filled in. Please review the address before saving.");
      } else if (place.country) {
        setLocationMessage(`Location filled in. Confirm Country/Region; ${place.country} may not be available as a Uvel store.`);
      } else {
        setLocationMessage("Location filled in. Please review the address before saving.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("expolocation") || message.includes("native module")) {
        Alert.alert("App update needed", "This installed version of Uvel does not include location support yet. You can enter the address manually until the native app update is available.");
      } else {
        Alert.alert("Couldn’t get your location", "Check that Location Services are on, then try again or enter the address manually.");
      }
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    const next: Address = {
      name: name.trim(),
      phone: phone.trim(),
      line1: line1.trim(),
      line2: line2.trim(),
      city: city.trim(),
      region: region.trim(),
      postal: postal.trim(),
      country: country.code,
    };
    try {
      if (adding) await addAddress(next, makeDefault);
      else await saveAddress(next, makeDefault);
      router.back();
    } catch {
      Alert.alert("Couldn’t save address", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function chooseCountry(code: string) {
    setSelectedCountry(code);
    setRegion("");
    setPickerMode(null);
  }

  function chooseRegion(value: string) {
    setRegion(value);
    setPickerMode(null);
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.cancelButton} accessibilityRole="button" accessibilityLabel="Cancel">
            <Ionicons name="chevron-back" size={18} color={COLORS.white} />
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <View style={styles.brandBadge}><View style={styles.brandDot} /><Text style={styles.brandBadgeText}>UVEL DELIVERY</Text></View>
          <View style={styles.navSide} />
        </View>
        <Text style={styles.navTitle}>Your Addresses</Text>
        <Text style={styles.headerSubtitle}>A smoother way to get your next favourite.</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 34 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageIntro}>
            <Text style={styles.eyebrow}>{adding ? "NEW DELIVERY ADDRESS" : "SAVED DELIVERY ADDRESS"}</Text>
            <Text style={styles.heading}>{adding ? "Add a new address" : "Edit address"}</Text>
            <Text style={styles.introCopy}>Keep your delivery details ready for a quicker Uvel checkout.</Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}><Ionicons name="person-outline" size={19} color={COLORS.blue} /></View>
              <View><Text style={styles.sectionTitle}>Contact</Text><Text style={styles.sectionHint}>Who should the courier reach?</Text></View>
            </View>
            <FormField label="Full name (First and Last name)" value={name} onChange={setName} placeholder="Full name" clearable autoCapitalize="words" textContentType="name" />
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone number</Text>
              <View style={styles.inputFrame}>
                <Ionicons name="call-outline" size={18} color={COLORS.muted} style={styles.inputIcon} />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Add a contact number"
                  placeholderTextColor={COLORS.hint}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  style={styles.input}
                  accessibilityLabel="Phone number"
                />
              </View>
              <Text style={styles.helper}>Only used if your courier needs help with delivery.</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}><Ionicons name="navigate-outline" size={19} color={COLORS.blue} /></View>
              <View><Text style={styles.sectionTitle}>Delivery destination</Text><Text style={styles.sectionHint}>Where should your order arrive?</Text></View>
            </View>
            <SelectField label="Country/Region" value={country.name} onPress={() => { Keyboard.dismiss(); setPickerMode("country"); }} />

            <View style={styles.locationPanel}>
              <View style={styles.locationPanelHead}>
                <View style={styles.locationIcon}><Ionicons name="locate-outline" size={20} color={COLORS.blue} /></View>
                <View style={styles.locationCopy}>
                  <Text style={styles.locationTitle}>Fill from your location</Text>
                  <Text style={styles.locationDescription}>We’ll suggest an address for you to review.</Text>
                </View>
              </View>
              <Pressable onPress={() => void useMyLocation()} disabled={locating} style={[styles.locationButton, locating && styles.buttonBusy]} accessibilityRole="button" accessibilityLabel="Use my location">
                {locating ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="locate" size={18} color={COLORS.white} /><Text style={styles.locationButtonText}>Use my location</Text></>}
              </Pressable>
            </View>
            {locationMessage ? <Text style={styles.locationMessage}>{locationMessage}</Text> : null}

            <FormField label="Street address" value={line1} onChange={setLine1} placeholder="Street address or P.O. Box" autoCapitalize="words" textContentType="streetAddressLine1" />
            <FormField label="Unit or suite number" value={line2} onChange={setLine2} placeholder="Apt, Suite, Unit, Building (optional)" autoCapitalize="words" textContentType="streetAddressLine2" />
            <FormField label="City" value={city} onChange={setCity} placeholder="City" autoCapitalize="words" textContentType="addressCity" />

            <View style={styles.splitRow}>
              <View style={styles.splitField}>
                {regionOptions ? (
                  <SelectField label="State" value={region || "Select"} onPress={() => { Keyboard.dismiss(); setPickerMode("region"); }} />
                ) : (
                  <FormField label="State / region" value={region} onChange={setRegion} placeholder="State / region" autoCapitalize="words" />
                )}
              </View>
              <View style={styles.splitField}>
                <FormField label={postalLabel} value={postal} onChange={setPostal} placeholder={postalLabel} autoCapitalize="characters" textContentType="postalCode" />
              </View>
            </View>
          </View>

          <Pressable onPress={() => setMakeDefault((value) => !value)} style={styles.defaultCard} accessibilityRole="checkbox" accessibilityState={{ checked: makeDefault }}>
            <View style={styles.defaultCopy}>
              <Text style={styles.defaultTitle}>Make this my default address</Text>
              <Text style={styles.defaultText}>Use it automatically at checkout.</Text>
            </View>
            <View style={[styles.toggleTrack, makeDefault && styles.toggleTrackOn]}>
              <View style={[styles.toggleThumb, makeDefault && styles.toggleThumbOn]} />
            </View>
          </Pressable>

          <Pressable onPress={() => void save()} disabled={!valid || saving} style={[styles.saveButton, (!valid || saving) && styles.saveDisabled]} accessibilityRole="button">
            {saving ? <ActivityIndicator color={COLORS.white} /> : <><Text style={styles.saveButtonText}>{adding ? "Save address" : "Save changes"}</Text><Ionicons name="arrow-forward" size={19} color={COLORS.white} /></>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickerMode !== null} transparent animationType="slide" onRequestClose={() => setPickerMode(null)} statusBarTranslucent>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerMode(null)} accessibilityRole="button" accessibilityLabel="Close selector" />
          <View style={[styles.pickerSheet, { maxHeight: screenHeight * 0.78, paddingBottom: insets.bottom + 14 }]}>
            <View style={styles.handle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{pickerMode === "country" ? "Country/Region" : "State"}</Text>
              <Pressable onPress={() => setPickerMode(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close selector">
                <Ionicons name="close" size={26} color={COLORS.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {pickerMode === "country" ? MARKETS.map((market) => (
                <PickerRow key={market.code} label={market.name} selected={selectedCountry === market.code} onPress={() => chooseCountry(market.code)} />
              )) : (regionOptions || []).map((value) => (
                <PickerRow key={value} label={value} selected={region === value} onPress={() => chooseRegion(value)} />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  clearable = false,
  autoCapitalize = "sentences",
  keyboardType,
  textContentType,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearable?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  keyboardType?: TextInputProps["keyboardType"];
  textContentType?: TextInputProps["textContentType"];
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputFrame}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.hint}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          textContentType={textContentType}
          style={styles.input}
          accessibilityLabel={label}
        />
        {clearable && value ? (
          <Pressable onPress={() => onChange("")} hitSlop={12} style={styles.clearButton} accessibilityRole="button" accessibilityLabel={`Clear ${label}`}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function SelectField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onPress} style={styles.select} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
        <Text style={styles.selectText} numberOfLines={1}>{value}</Text>
          <Ionicons name="chevron-down" size={20} color={COLORS.blue} />
      </Pressable>
    </View>
  );
}

function PickerRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.pickerRow} accessibilityRole="button" accessibilityState={{ selected }}>
      <Text style={[styles.pickerRowText, selected && styles.pickerRowSelected]}>{label}</Text>
      {selected ? <Ionicons name="checkmark-circle" size={21} color={COLORS.blue} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: COLORS.page },
  header: { backgroundColor: COLORS.header, paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  navRow: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cancelButton: { width: 82, height: 40, flexDirection: "row", alignItems: "center", gap: 2 },
  navSide: { width: 82, height: 40 },
  cancelText: { color: COLORS.white, fontSize: 14, fontWeight: "600" },
  brandBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)" },
  brandDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.lime },
  brandBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  navTitle: { color: COLORS.white, fontSize: 27, fontWeight: "800", letterSpacing: -0.4, marginTop: 9 },
  headerSubtitle: { color: "rgba(255,255,255,0.78)", fontSize: 13, marginTop: 4 },
  content: { paddingHorizontal: 16, paddingTop: 20 },
  pageIntro: { paddingHorizontal: 3, marginBottom: 16 },
  eyebrow: { color: COLORS.blue, fontSize: 10, fontWeight: "800", letterSpacing: 1.1, marginBottom: 6 },
  heading: { color: COLORS.text, fontSize: 23, fontWeight: "800", letterSpacing: -0.35 },
  introCopy: { color: COLORS.muted, fontSize: 13, lineHeight: 18, marginTop: 5 },
  formCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 16, marginBottom: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 17 },
  sectionIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: COLORS.blueSoft, alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  sectionHint: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  fieldGroup: { marginBottom: 15 },
  label: { color: COLORS.muted, fontSize: 12, lineHeight: 16, fontWeight: "800", letterSpacing: 0.25, marginBottom: 7 },
  inputFrame: { minHeight: 52, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white },
  input: { flex: 1, minHeight: 50, paddingHorizontal: 13, color: COLORS.text, fontSize: 15 },
  inputIcon: { marginLeft: 13 },
  clearButton: { width: 44, height: 50, alignItems: "center", justifyContent: "center" },
  helper: { color: COLORS.muted, fontSize: 11, lineHeight: 15, marginTop: 7 },
  select: { minHeight: 52, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.white },
  selectText: { flex: 1, color: COLORS.text, fontSize: 15, marginRight: 12 },
  locationPanel: { backgroundColor: COLORS.blueSoft, borderWidth: 1, borderColor: COLORS.blueBorder, borderRadius: 17, padding: 13, marginTop: 2, marginBottom: 18 },
  locationPanelHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  locationIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" },
  locationCopy: { flex: 1 },
  locationTitle: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  locationDescription: { color: COLORS.muted, fontSize: 11, lineHeight: 15, marginTop: 2 },
  locationButton: { minHeight: 46, borderRadius: 12, backgroundColor: COLORS.blue, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 },
  locationButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "800" },
  buttonBusy: { opacity: 0.72 },
  locationMessage: { color: COLORS.success, backgroundColor: COLORS.successSoft, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, lineHeight: 17, marginTop: -5, marginBottom: 16 },
  splitRow: { flexDirection: "row", gap: 10 },
  splitField: { flex: 1, minWidth: 0 },
  defaultCard: { minHeight: 76, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  defaultCopy: { flex: 1 },
  defaultTitle: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  defaultText: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  toggleTrack: { width: 48, height: 28, borderRadius: 16, backgroundColor: "#D7DFE9", padding: 3, justifyContent: "center" },
  toggleTrackOn: { backgroundColor: COLORS.blue },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.white, shadowColor: "#10213A", shadowOpacity: 0.16, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  toggleThumbOn: { alignSelf: "flex-end" },
  saveButton: { minHeight: 54, borderRadius: 15, backgroundColor: COLORS.blue, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  saveDisabled: { opacity: 0.42 },
  saveButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "800" },
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(12,28,50,0.44)" },
  pickerSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingHorizontal: 20 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 12 },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 46, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.separator, marginBottom: 4 },
  pickerTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  pickerRow: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.separator },
  pickerRowText: { color: COLORS.text, fontSize: 15 },
  pickerRowSelected: { color: COLORS.blue, fontWeight: "800" },
});
