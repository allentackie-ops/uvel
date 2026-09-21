import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadPrivacySettings } from "../lib/privacy";
import { useColors, type Colors } from "../lib/theme";
import { useUvel } from "../lib/store";
import { useWardrobe } from "../lib/wardrobe";

export default function ManageAccountData() {
  const app = useUvel();
  const pieces = useWardrobe();
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  async function exportData() {
    if (!app.uid) {
      Alert.alert("Sign in first", "You need to be signed in to download your account data.");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const privacySettings = await loadPrivacySettings(app.uid);
      const ownPieces = pieces.filter((piece) => piece.ownerId === app.uid || piece.listedByUid === app.uid);
      const payload = {
        exportedAt: new Date().toISOString(),
        account: {
          id: app.uid,
          email: app.email,
          displayName: app.displayName,
          username: app.username,
          birthday: app.birthday,
          gender: app.gender,
          styles: app.styles,
          archetype: app.archetype,
          palette: app.palette,
          silhouette: app.silhouette,
          country: app.country,
          locale: app.locale,
          appearance: app.appearance,
        },
        privacySettings,
        preferences: {
          wantsUpdates: app.wantsUpdates,
          accessibilityMode: app.accessibilityMode,
        },
        savedListingIds: app.saved,
        wardrobeAndListings: ownPieces.map((piece) => ({
          id: piece.id,
          name: piece.name,
          brand: piece.brand,
          category: piece.category,
          color: piece.color,
          size: piece.size,
          condition: piece.condition,
          material: piece.material,
          notes: piece.notes,
          listPriceCents: piece.listPriceCents,
          originalPriceCents: piece.originalPriceCents,
          status: piece.status,
          createdAt: piece.createdAt,
          photo: piece.photo,
          photos: piece.photos,
          clipUri: piece.clipUri,
          likes: piece.likedBy?.length ?? 0,
        })),
      };
      const uri = `${FileSystem.cacheDirectory}uvel-account-data-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2), { encoding: FileSystem.EncodingType.UTF8 });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Export ready", "Your device does not provide a share sheet for this file.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/json",
        dialogTitle: "Save your Uvel account data",
        UTI: "public.json",
      });
    } catch (error) {
      Alert.alert("Couldn’t export data", error instanceof Error ? error.message : "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={30} color={colors.bone} />
        </Pressable>
        <Text style={styles.headerTitle}>Manage account data</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}>
        <View style={styles.icon}><Ionicons name="download-outline" size={25} color={colors.successInk} /></View>
        <Text style={styles.title}>Your data, on your terms</Text>
        <Text style={styles.intro}>Create a copy of the information Uvel keeps for your account. The export includes your profile, preferences, saved listing IDs, and your wardrobe and listing details.</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What you’ll get</Text>
          <DataRow label="Account and profile" colors={colors} />
          <DataRow label="Privacy and app preferences" colors={colors} />
          <DataRow label="Saved listings and wardrobe details" colors={colors} last />
        </View>
        <Pressable onPress={() => void exportData()} disabled={busy} style={[styles.button, busy && styles.buttonDisabled]} accessibilityRole="button">
          <Ionicons name="download-outline" size={20} color={colors.successInk} />
          <Text style={styles.buttonText}>{busy ? "Preparing your data…" : "Download my data"}</Text>
        </Pressable>
        <Text style={styles.note}>Uvel creates a JSON file and opens your device’s share sheet. Choose “Save to Files” or another destination to keep a copy.</Text>
      </ScrollView>
    </View>
  );
}

function DataRow({ label, colors, last }: { label: string; colors: Colors; last?: boolean }) {
  return (
    <View style={[stylesData.row, { borderBottomColor: colors.ink }, last && stylesData.last]}>
      <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
      <Text style={[stylesData.label, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const stylesData = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  last: { borderBottomWidth: 0 },
  label: { fontSize: 14 },
});

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { minHeight: 72, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: `${colors.bone}1F`, alignItems: "center", justifyContent: "center" },
    headerSpacer: { width: 48, height: 48 },
    headerTitle: { color: colors.bone, fontSize: 20, fontWeight: "800" },
    content: { padding: 20 },
    icon: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    title: { color: colors.bone, fontSize: 28, fontWeight: "800", marginTop: 18, letterSpacing: -0.5 },
    intro: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
    card: { marginTop: 24, paddingHorizontal: 16, paddingTop: 8, borderRadius: 18, backgroundColor: colors.surface },
    cardTitle: { color: colors.bone, fontSize: 16, fontWeight: "800", paddingTop: 8, paddingBottom: 4 },
    button: { height: 54, borderRadius: 27, backgroundColor: colors.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 24 },
    buttonDisabled: { opacity: 0.55 },
    buttonText: { color: colors.successInk, fontSize: 16, fontWeight: "800" },
    note: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 13 },
  });
}
