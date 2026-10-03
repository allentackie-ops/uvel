import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { alertKindLabel, enableAlert, setAlertPreference, type AlertKind, useAlertPreference } from "../lib/alerts";
import type { ClosetPiece } from "../lib/wardrobe";
import type { Colors } from "../lib/theme";
import { useUvel } from "../lib/store";

type Props = {
  piece: ClosetPiece;
  colors: Colors;
  appearance?: "inline" | "popup";
  collapsible?: boolean;
};

export function ListingAlertControls({ piece, colors, appearance = "inline", collapsible = false }: Props) {
  const app = useUvel();
  const preference = useAlertPreference(app.uid, piece.id);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const styles = make(colors);

  async function choose(kind: AlertKind) {
    if (!app.uid) {
      Alert.alert("Sign in to set an alert", "Create or sign in to your Uvel account first.");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      if (!app.saved.includes(piece.id)) await app.toggleSaved(piece.id);
      const result = await enableAlert(app.uid, piece, kind);
      if (!result.permission) {
        Alert.alert("Alert saved", "Your alert is saved in Uvel. Turn on notifications in Settings if you want device notifications when a change is recorded.");
      }
    } catch (error) {
      Alert.alert("Couldn’t save alert", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!app.uid || busy) return;
    setBusy(true);
    try {
      await setAlertPreference(app.uid, piece, "off");
    } catch (error) {
      Alert.alert("Couldn’t update alert", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const sellerId = piece.ownerId || piece.listedByUid || "";
  if (app.uid && sellerId === app.uid) return null;

  return (
    <View style={[styles.root, appearance === "popup" && styles.popupRoot]}>
      {collapsible ? (
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => [styles.disclosureRow, pressed && styles.disclosurePressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded, selected: Boolean(preference) }}
          accessibilityLabel={expanded ? "Hide price and restock alert options" : preference ? "Manage price and restock alerts" : "Set price and restock alerts"}
        >
          <View style={styles.disclosureIcon}>
            <Ionicons name="notifications-outline" size={18} color={colors.success} />
          </View>
          <View style={styles.disclosureCopy}>
            <Text style={styles.disclosureTitle}>Price & restock alerts</Text>
            <Text style={styles.disclosureSubtitle} numberOfLines={1}>
              {busy ? "Saving your alert…" : preference ? `Watching for ${alertKindLabel(preference.kind)}` : "Get notified when prices drop or items return"}
            </Text>
          </View>
          <View style={styles.disclosureEnd}>
            <Text style={styles.disclosureAction}>{expanded ? "Close" : preference ? "Manage" : "Set alert"}</Text>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={17} color={colors.bone} />
          </View>
        </Pressable>
      ) : (
        <>
          {appearance === "inline" ? (
            <View style={styles.head}>
              <Text style={styles.title}>Price & restock alerts</Text>
              {busy ? <Text style={styles.status}>Saving…</Text> : null}
            </View>
          ) : busy ? <Text style={styles.status}>Saving…</Text> : null}
        </>
      )}

      {(!collapsible || expanded) ? (
        <View style={collapsible ? styles.expandedContent : undefined}>
          <Text style={styles.copy}>{collapsible ? "Choose when you’d like to be notified." : "Save this item and get notified when its recorded price drops or its published inventory returns."}</Text>
          <View style={styles.options}>
            {(["price_drop", "restock", "both"] as const).map((kind) => {
              const selected = preference?.kind === kind;
              const label = kind === "price_drop" ? "Price drops" : kind === "restock" ? "Restocks" : "Both";
              return (
                <Pressable
                  key={kind}
                  onPress={() => void choose(kind)}
                  disabled={busy}
                  style={[styles.option, selected && styles.optionSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: busy }}
                  accessibilityLabel={`Set ${alertKindLabel(kind)} alert for ${piece.name}`}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={1}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {preference ? (
            <Pressable
              onPress={() => void turnOff()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Turn off ${alertKindLabel(preference.kind)} alerts for ${piece.name}`}
            >
              <Text style={styles.status}>Watching for {alertKindLabel(preference.kind)} · Turn off</Text>
            </Pressable>
          ) : (
            <Text style={styles.status}>Choose an alert to save this item and start watching it.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    root: {
      marginTop: 22,
      paddingTop: 18,
      borderTopWidth: 1,
      borderTopColor: `${colors.bone}20`,
    },
    popupRoot: {
      marginTop: 0,
      paddingTop: 14,
      paddingHorizontal: 0,
      paddingBottom: 0,
      borderWidth: 0,
      borderTopWidth: 0,
      borderRadius: 0,
      borderColor: "transparent",
      borderTopColor: `${colors.bone}20`,
      backgroundColor: "transparent",
    },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    title: { color: colors.bone, fontSize: 16, lineHeight: 20, fontWeight: "800", flexShrink: 1 },
    disclosureRow: {
      minHeight: 62,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 11,
      paddingVertical: 9,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: `${colors.bone}20`,
      backgroundColor: `${colors.bone}07`,
    },
    disclosurePressed: { opacity: 0.82 },
    disclosureIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${colors.success}1A`,
    },
    disclosureCopy: { flex: 1, minWidth: 0 },
    disclosureTitle: { color: colors.bone, fontSize: 13, lineHeight: 17, fontWeight: "800" },
    disclosureSubtitle: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 2 },
    disclosureEnd: { flexDirection: "row", alignItems: "center", gap: 4 },
    disclosureAction: { color: colors.success, fontSize: 10, fontWeight: "800" },
    expandedContent: { paddingTop: 11 },
    copy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
    options: { flexDirection: "row", gap: 7, marginTop: 12 },
    option: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      paddingHorizontal: 5,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: `${colors.bone}32`,
      alignItems: "center",
      justifyContent: "center",
    },
    optionSelected: { backgroundColor: colors.success, borderColor: colors.success },
    optionText: { color: colors.bone, fontSize: 10, fontWeight: "800", textAlign: "center" },
    optionTextSelected: { color: colors.successInk },
    status: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 9 },
  });
}
