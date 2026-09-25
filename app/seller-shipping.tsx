import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessiblePressable } from "../components/AccessiblePressable";
import { getMarket } from "../lib/markets";
import { carrierLogoUrl, loadSellerShippingSettings, carriersForCountry, saveSellerShippingSettings, type SellerShippingMethod, type SellerShippingSettings } from "../lib/sellerShipping";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";

export default function SellerShipping() {
  const colors = useColors();
  const styles = useMemo(() => make(colors), [colors]);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const market = getMarket(app.country);
  const [settings, setSettings] = useState<SellerShippingSettings | null>(null);

  useEffect(() => {
    void loadSellerShippingSettings().then((next) => {
      setSettings(next);
    });
  }, []);

  if (!settings) return <View style={[styles.page, { paddingTop: insets.top + 30 }]}><Text style={styles.muted}>Loading shipping settings…</Text></View>;

  const carriers = carriersForCountry(market.code);
  const enabled = new Set(settings.carriersByCountry[market.code] || carriers.map((carrier) => carrier.id));
  const persist = (patch: Partial<SellerShippingSettings>) => {
    setSettings((current) => current ? { ...current, ...patch } : current);
    void saveSellerShippingSettings(patch);
  };
  const toggleCarrier = (id: string, value: boolean) => {
    const next = new Set(enabled);
    if (value) next.add(id); else next.delete(id);
    if (!next.size) {
      Alert.alert("Keep one option available", "At least one delivery provider must stay enabled so buyers can complete checkout.");
      return;
    }
    persist({ carriersByCountry: { ...settings.carriersByCountry, [market.code]: [...next] } });
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 36 }} showsVerticalScrollIndicator={false}>
        <View style={styles.nav}><AccessiblePressable onPress={() => router.back()} style={styles.navBtn} accessibilityLabel="Go back"><Text style={styles.back}>‹</Text></AccessiblePressable><Text style={styles.title}>Seller shipping</Text><View style={{ width: 44 }} /></View>
        <View style={styles.content}>
          <Text style={styles.kicker}>SELLING IN {market.name.toUpperCase()}</Text>
          <Text style={styles.heading}>Set shipping once.</Text>
          <Text style={styles.lede}>When someone buys your item, they choose one of the providers you leave on. We’ll show the exact instructions on the order.</Text>
          <Text style={styles.section}>Your address</Text>
          <AccessiblePressable onPress={() => router.push("/seller-shipping-address")} style={[styles.addressCard, settings.address && styles.addressCardSaved]} accessibilityRole="button" accessibilityLabel={settings.address ? "Edit saved shipping address" : "Add shipping address"} accessibilityHint="Opens a separate page to enter your shipping address.">
            <View style={{ flex: 1 }}>
              <Text style={styles.addressTitle}>{settings.address ? "Address saved" : "Add your shipping address"}</Text>
              <Text style={styles.hint}>{settings.address ? `${settings.address.line1}, ${settings.address.city}${settings.address.region ? `, ${settings.address.region}` : ""} ${settings.address.postal}` : "Where you normally pack or hand over sold items."}</Text>
            </View>
            <Text style={styles.addressAction}>{settings.address ? "✓" : "+"}</Text>
          </AccessiblePressable>
          <Text style={styles.section}>How will you send items?</Text>
          {([['dropoff', 'From a drop-off point', 'You take the order to a supported carrier location.'], ['pickup', 'From your address', 'A courier collects the order from you when available.']] as Array<[SellerShippingMethod, string, string]>).map(([id, label, detail]) => <AccessiblePressable key={id} onPress={() => persist({ method: id })} style={[styles.method, settings.method === id && styles.methodOn]} accessibilityRole="radio" accessibilityState={{ selected: settings.method === id }}><View style={{ flex: 1 }}><Text style={[styles.methodTitle, settings.method === id && styles.methodTitleOn]}>{label}</Text><Text style={[styles.methodDetail, settings.method === id && styles.methodDetailOn]}>{detail}</Text></View><View style={[styles.radio, settings.method === id && styles.radioOn]}>{settings.method === id ? <View style={styles.dot} /> : null}</View></AccessiblePressable>)}
          <Text style={styles.section}>Delivery providers</Text>
          <Text style={styles.hint}>Buyers choose one of these at checkout. All providers available in your shop are on by default.</Text>
          <View style={styles.card}>{carriers.map((carrier, index) => <View key={carrier.id} style={[styles.carrier, index === carriers.length - 1 && styles.last]}><View style={styles.carrierInfo}><View style={styles.carrierNameRow}><Text style={styles.carrierName}>{carrier.name}</Text><CarrierLogo id={carrier.id} name={carrier.name} colors={colors} /></View><Text style={styles.carrierDetail}>{settings.method === "pickup" ? `A courier collects the package through ${carrier.name}.` : carrier.description}</Text></View><View style={styles.switchWrap}><Switch value={enabled.has(carrier.id)} onValueChange={(value) => toggleCarrier(carrier.id, value)} trackColor={{ false: colors.ink, true: colors.success }} thumbColor="#fff" accessibilityLabel={`Allow ${carrier.name}`} /></View></View>)}</View>
          <View style={styles.note}><Text style={styles.noteTitle}>What the toggle means</Text><Text style={styles.noteText}>You are telling buyers which providers you are comfortable using. The buyer chooses the final provider. After the sale, use the carrier receipt and add its tracking number to the order. Automatic labels and QR codes can be connected provider by provider later.</Text></View>
          <AccessiblePressable onPress={() => persist({ buyerPays: !settings.buyerPays })} style={styles.payRow} accessibilityRole="switch" accessibilityState={{ checked: settings.buyerPays }}><View style={{ flex: 1 }}><Text style={styles.payTitle}>Buyer pays delivery</Text><Text style={styles.hint}>Delivery is shown separately at checkout.</Text></View><Switch value={settings.buyerPays} onValueChange={(buyerPays) => persist({ buyerPays })} trackColor={{ false: colors.ink, true: colors.success }} thumbColor="#fff" /></AccessiblePressable>
        </View>
      </ScrollView>
    </View>
  );
}

function CarrierLogo({ id, name, colors }: { id: string; name: string; colors: Colors }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
  const uri = carrierLogoUrl(id);
  if (failed || !uri) return <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: colors.neutral, alignItems: "center", justifyContent: "center", marginRight: 12 }}><Text style={{ color: colors.success, fontSize: 10, fontWeight: "900" }}>{initials}</Text></View>;
  return <Image source={{ uri }} contentFit="contain" cachePolicy="memory-disk" onError={() => setFailed(true)} style={{ width: 34, height: 34, marginRight: 12 }} accessibilityLabel={`${name} logo`} />;
}

function make(colors: Colors) { return StyleSheet.create({ page: { flex: 1, backgroundColor: colors.ink }, nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 }, navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, back: { color: colors.bone, fontSize: 40, lineHeight: 40, fontWeight: "300" }, title: { color: colors.bone, fontSize: 18, fontWeight: "800" }, content: { paddingHorizontal: 20 }, kicker: { color: colors.subtle, fontSize: 11, letterSpacing: 1.6, marginTop: 14 }, heading: { color: colors.bone, fontSize: 30, fontWeight: "800", marginTop: 10 }, lede: { color: colors.muted, lineHeight: 21, fontSize: 15, marginTop: 10 }, section: { color: colors.bone, fontSize: 20, fontWeight: "800", marginTop: 28, marginBottom: 6 }, hint: { color: colors.muted, fontSize: 13, lineHeight: 18 }, addressCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.subtle + "55", borderRadius: 16, padding: 15, marginTop: 10 }, addressCardSaved: { borderColor: colors.success }, addressTitle: { color: colors.bone, fontSize: 16, fontWeight: "700", marginBottom: 4 }, addressAction: { color: colors.success, fontSize: 25, fontWeight: "800", paddingLeft: 12 }, method: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.subtle + "55", borderRadius: 16, padding: 15, marginTop: 10 }, methodOn: { borderColor: colors.success, backgroundColor: colors.success + "18" }, methodTitle: { color: colors.bone, fontSize: 16, fontWeight: "700" }, methodTitleOn: { color: colors.success }, methodDetail: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 }, methodDetailOn: { color: colors.bone }, radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.subtle, alignItems: "center", justifyContent: "center" }, radioOn: { borderColor: colors.success }, dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success }, card: { backgroundColor: colors.surface, borderRadius: 16, marginTop: 12, paddingHorizontal: 15 }, carrier: { minHeight: 84, paddingVertical: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.ink }, carrierInfo: { flex: 1, justifyContent: "center", paddingRight: 12 }, carrierNameRow: { flexDirection: "row", alignItems: "center" }, switchWrap: { width: 68, minHeight: 44, alignItems: "center", justifyContent: "center" }, last: { borderBottomWidth: 0 }, carrierName: { color: colors.bone, fontSize: 16, fontWeight: "700" }, carrierDetail: { color: colors.muted, fontSize: 13, marginTop: 4 }, note: { borderWidth: 1, borderColor: colors.success + "55", borderRadius: 16, padding: 14, marginTop: 18 }, noteTitle: { color: colors.success, fontWeight: "800", fontSize: 14 }, noteText: { color: colors.muted, lineHeight: 19, marginTop: 5, fontSize: 13 }, payRow: { flexDirection: "row", alignItems: "center", paddingVertical: 18, marginTop: 10 }, payTitle: { color: colors.bone, fontWeight: "700", fontSize: 16 }, muted: { color: colors.muted, paddingHorizontal: 20 } }); }
