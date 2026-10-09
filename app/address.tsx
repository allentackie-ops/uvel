import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
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
import { formatPhoneInput } from "../lib/phone";
import { loadSellerShippingSettings, saveSellerShippingSettings } from "../lib/sellerShipping";
import { useUvel } from "../lib/store";
import { useColors, useResolvedAppearance, type Colors } from "../lib/theme";

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
  const colors = useColors();
  const appearance = useResolvedAppearance();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { displayName, country: appCountry } = useUvel();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const adding = mode === "add";
  const sellerMode = mode === "seller";

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
    if (sellerMode) {
      void loadSellerShippingSettings().then((settings) => {
        if (!active) return;
        const saved = settings.address;
        setSelectedCountry(saved?.country || appCountry || "US");
        setName(saved?.name || displayName);
        setPhone(formatPhoneInput(saved?.phone || "", saved?.country || appCountry || "US"));
        setLine1(saved?.line1 || "");
        setLine2(saved?.line2 || "");
        setCity(saved?.city || "");
        setRegion(saved?.region || "");
        setPostal(saved?.postal || "");
      });
      return () => { active = false; };
    }
    if (adding) {
      setSelectedCountry("US");
      setName(displayName);
      setMakeDefault(false);
      return () => { active = false; };
    }
    void loadAddress().then((address) => {
      if (!active || !address) return;
      setName(address.name || displayName);
      setPhone(formatPhoneInput(address.phone || "", address.country || "US"));
      setLine1(address.line1 || "");
      setLine2(address.line2 || "");
      setCity(address.city || "");
      setRegion(address.region || "");
      setPostal(address.postal || "");
      setSelectedCountry(getMarket(address.country || "US").code);
      setMakeDefault(true);
    });
    return () => { active = false; };
  }, [adding, appCountry, displayName, sellerMode]);

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
      if (sellerMode) await saveSellerShippingSettings({ address: next });
      else if (adding) await addAddress(next, makeDefault);
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
      <StatusBar style={appearance === "dark" ? "light" : "dark"} />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.navSide} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.navTitle}>Your Address</Text>
          <View style={styles.navSide} />
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 34 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>{sellerMode ? "Where you send from" : adding ? "Add a new address" : "Edit address"}</Text>

          <SelectField styles={styles} colors={colors} label="Country/Region" value={country.name} onPress={() => { Keyboard.dismiss(); setPickerMode("country"); }} />

          <FormField styles={styles} colors={colors} label="Full name (First and Last name)" value={name} onChange={setName} placeholder="Full name" clearable autoCapitalize="words" textContentType="name" />
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone number</Text>
            <View style={styles.inputFrame}>
              <TextInput
                value={phone}
                onChangeText={(value) => setPhone(formatPhoneInput(value, selectedCountry))}
                placeholder=""
                placeholderTextColor={colors.subtle}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                style={styles.input}
                accessibilityLabel="Phone number"
              />
            </View>
            <Text style={styles.helper}>May be used to assist delivery</Text>
          </View>

          <Pressable onPress={() => void useMyLocation()} disabled={locating} style={[styles.locationButton, locating && styles.buttonBusy]} accessibilityRole="button" accessibilityLabel="Use my location">
            {locating ? <ActivityIndicator color={colors.bone} /> : <Text style={styles.locationButtonText}>Use my location</Text>}
          </Pressable>
          {locationMessage ? <Text style={styles.locationMessage}>{locationMessage}</Text> : null}

          <FormField styles={styles} colors={colors} label="Street address" value={line1} onChange={setLine1} placeholder="Street address or P.O. Box" autoCapitalize="words" textContentType="streetAddressLine1" />
          <FormField styles={styles} colors={colors} label="Unit or suite number" value={line2} onChange={setLine2} placeholder="Apt, Suite, Unit, Building (optional)" autoCapitalize="words" textContentType="streetAddressLine2" />
          <FormField styles={styles} colors={colors} label="City" value={city} onChange={setCity} placeholder="" autoCapitalize="words" textContentType="addressCity" />

          <View style={styles.splitRow}>
            <View style={styles.splitField}>
              {regionOptions ? (
                <SelectField styles={styles} colors={colors} label="State" value={region || "Select"} onPress={() => { Keyboard.dismiss(); setPickerMode("region"); }} />
              ) : (
                <FormField styles={styles} colors={colors} label="State / region" value={region} onChange={setRegion} placeholder="State / region" autoCapitalize="words" />
              )}
            </View>
            <View style={styles.splitField}>
              <FormField styles={styles} colors={colors} label={postalLabel} value={postal} onChange={setPostal} placeholder="" autoCapitalize="characters" textContentType="postalCode" />
            </View>
          </View>

          <Pressable onPress={() => setMakeDefault((value) => !value)} style={styles.defaultRow} accessibilityRole="checkbox" accessibilityState={{ checked: makeDefault }}>
            <View style={[styles.checkbox, makeDefault && styles.checkboxOn]}>
              {makeDefault ? <Ionicons name="checkmark" size={18} color={colors.ink} /> : null}
            </View>
            <Text style={styles.defaultText}>Make this my default address</Text>
          </Pressable>

          <View style={styles.separator} />
          <Pressable onPress={() => void save()} disabled={!valid || saving} style={[styles.saveButton, (!valid || saving) && styles.saveDisabled]} accessibilityRole="button">
            {saving ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.saveButtonText}>{adding ? "Save address" : "Save changes"}</Text>}
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
                <Ionicons name="close" size={26} color={colors.bone} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {pickerMode === "country" ? MARKETS.map((market) => (
                <PickerRow styles={styles} colors={colors} key={market.code} label={market.name} selected={selectedCountry === market.code} onPress={() => chooseCountry(market.code)} />
              )) : (regionOptions || []).map((value) => (
                <PickerRow styles={styles} colors={colors} key={value} label={value} selected={region === value} onPress={() => chooseRegion(value)} />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FormField({
  styles,
  colors,
  label,
  value,
  onChange,
  placeholder,
  clearable = false,
  autoCapitalize = "sentences",
  keyboardType,
  textContentType,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
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
          placeholderTextColor={colors.subtle}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          textContentType={textContentType}
          style={styles.input}
          accessibilityLabel={label}
        />
        {clearable && value ? (
          <Pressable onPress={() => onChange("")} hitSlop={12} style={styles.clearButton} accessibilityRole="button" accessibilityLabel={`Clear ${label}`}>
            <Ionicons name="close" size={24} color={colors.bone} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function SelectField({ styles, colors, label, value, onPress }: { styles: ReturnType<typeof makeStyles>; colors: Colors; label: string; value: string; onPress: () => void }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onPress} style={styles.select} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
        <Text style={styles.selectText} numberOfLines={1}>{value}</Text>
        <Ionicons name="chevron-down" size={22} color={colors.bone} />
      </Pressable>
    </View>
  );
}

function PickerRow({ styles, colors, label, selected, onPress }: { styles: ReturnType<typeof makeStyles>; colors: Colors; label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.pickerRow} accessibilityRole="button" accessibilityState={{ selected }}>
      <Text style={[styles.pickerRowText, selected && styles.pickerRowSelected]}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={21} color={colors.bone} /> : null}
    </Pressable>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: colors.ink },
  header: { backgroundColor: colors.ink },
  navRow: { height: 52, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navSide: { width: 84, height: 44, justifyContent: "center" },
  cancelText: { color: colors.bone, fontSize: 16, fontWeight: "500" },
  navTitle: { flex: 1, textAlign: "center", color: colors.bone, fontSize: 18, fontWeight: "700" },
  content: { paddingHorizontal: 22, paddingTop: 20 },
  heading: { color: colors.bone, fontSize: 18, fontWeight: "800", marginBottom: 22 },
  fieldGroup: { marginBottom: 22 },
  label: { color: colors.bone, fontSize: 16, lineHeight: 21, fontWeight: "700", marginBottom: 8 },
  inputFrame: { minHeight: 52, borderWidth: 1, borderColor: colors.subtle, borderRadius: 5, flexDirection: "row", alignItems: "center", backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 50, paddingHorizontal: 14, color: colors.bone, fontSize: 16 },
  clearButton: { width: 48, height: 50, alignItems: "center", justifyContent: "center" },
  helper: { color: colors.bone, fontSize: 13, marginTop: 10 },
  select: { minHeight: 52, borderWidth: 1, borderColor: colors.subtle, borderRadius: 14, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface },
  selectText: { flex: 1, color: colors.bone, fontSize: 16, marginRight: 12 },
  locationButton: { height: 52, borderWidth: 1, borderColor: colors.subtle, borderRadius: 28, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginTop: 2, marginBottom: 24 },
  locationButtonText: { color: colors.bone, fontSize: 16, fontWeight: "500" },
  buttonBusy: { opacity: 0.7 },
  locationMessage: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: -16, marginBottom: 22 },
  splitRow: { flexDirection: "row", gap: 18 },
  splitField: { flex: 1, minWidth: 0 },
  defaultRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2, marginBottom: 22, paddingHorizontal: 4, minHeight: 36 },
  checkbox: { width: 24, height: 24, borderWidth: 1.5, borderColor: colors.subtle, borderRadius: 5, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  checkboxOn: { backgroundColor: colors.success, borderColor: colors.success },
  defaultText: { color: colors.bone, fontSize: 15 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: `${colors.bone}20`, marginBottom: 20 },
  saveButton: { minHeight: 52, borderRadius: 26, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  saveDisabled: { opacity: 0.42 },
  saveButtonText: { color: colors.successInk, fontSize: 16, fontWeight: "700" },
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.52)" },
  pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10, paddingHorizontal: 20 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.subtle, alignSelf: "center", marginBottom: 12 },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 46, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20`, marginBottom: 4 },
  pickerTitle: { color: colors.bone, fontSize: 17, fontWeight: "700" },
  pickerRow: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}20` },
  pickerRowText: { color: colors.bone, fontSize: 16 },
  pickerRowSelected: { fontWeight: "700" },
  });
}
