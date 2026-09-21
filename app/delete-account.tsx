import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OrbitLoader } from "../components/OrbitLoader";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";

const REASONS = [
  "I don’t use Uvel anymore",
  "I want to open a new account",
  "My items aren’t selling",
  "I had an issue with a transaction",
  "I don’t agree with Uvel’s policies",
  "I don’t agree with Uvel’s fees",
  "I have safety or privacy concerns",
  "My reason isn’t listed",
] as const;

type Reason = (typeof REASONS)[number];

export default function DeleteAccount() {
  const app = useUvel();
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [selected, setSelected] = useState<Reason | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [ordersConfirmed, setOrdersConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const customSelected = selected === "My reason isn’t listed";
  const canDelete = Boolean(selected && (!customSelected || customReason.trim()) && ordersConfirmed);

  function choose(reason: Reason) {
    setSelected(reason);
    if (reason === "My reason isn’t listed") {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }

  function confirmDelete() {
    if (!canDelete || busy) return;
    Alert.alert("Delete account?", "Your account, profile, saved styles, and listings will be permanently deleted. This can’t be undone.", [
      { text: "Keep account", style: "cancel" },
      { text: "Delete account", style: "destructive", onPress: () => void runDelete() },
    ]);
  }

  async function runDelete() {
    setBusy(true);
    try {
      await app.deleteAccount();
      router.replace("/setup");
    } catch (error) {
      Alert.alert("Delete account", error instanceof Error ? error.message : "Sign in again and try once more.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.page, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={30} color={colors.bone} />
        </Pressable>
        <Text style={styles.title}>Delete account</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.heading}>Before you go</Text>
        <Text style={styles.lede}>
          If you delete your account, you won’t be able to access any of your sales or purchases.{"\n\n"}All of your data will be permanently deleted.
        </Text>
        <View style={styles.options}>
          {REASONS.map((reason) => {
            const on = selected === reason;
            return (
              <View key={reason}>
                <Pressable onPress={() => choose(reason)} style={styles.option} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                  <Text style={styles.optionText}>{reason}</Text>
                </Pressable>
                {reason === "My reason isn’t listed" && customSelected ? (
                  <View style={styles.customBox}>
                    <TextInput
                      ref={inputRef}
                      value={customReason}
                      onChangeText={setCustomReason}
                      style={styles.customInput}
                      placeholder="Tell us why you’re leaving"
                      placeholderTextColor={colors.muted}
                      multiline
                      textAlignVertical="top"
                      returnKeyType="done"
                      blurOnSubmit
                      accessibilityLabel="Your reason for deleting your account"
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        <Pressable
          onPress={() => setOrdersConfirmed((current) => !current)}
          style={styles.confirmRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ordersConfirmed }}
        >
          <View style={[styles.checkbox, ordersConfirmed && styles.checkboxOn]}>
            {ordersConfirmed ? <Ionicons name="checkmark" size={20} color={colors.ink} /> : null}
          </View>
          <Text style={styles.confirmText}>I confirm that all my orders are complete.</Text>
        </Pressable>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={confirmDelete}
          disabled={!canDelete || busy}
          style={[styles.deleteButton, (!canDelete || busy) && styles.deleteButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
        >
          {busy ? <OrbitLoader size={24} /> : <Text style={[styles.deleteButtonText, (!canDelete || busy) && styles.deleteButtonTextDisabled]}>Delete</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    header: { minHeight: 72, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: `${colors.bone}1F`, alignItems: "center", justifyContent: "center" },
    headerSpacer: { width: 48, height: 48 },
    title: { color: colors.bone, fontSize: 21, fontWeight: "800" },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 24 },
    heading: { color: colors.bone, fontSize: 24, fontWeight: "800" },
    lede: { color: colors.bone, fontSize: 16, lineHeight: 24, marginTop: 20 },
    options: { marginTop: 28 },
    option: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}55` },
    radio: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.bone, alignItems: "center", justifyContent: "center" },
    radioOn: { borderColor: colors.success },
    radioDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.success },
    optionText: { flex: 1, color: colors.bone, fontSize: 16, lineHeight: 22 },
    customBox: { marginLeft: 48, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.bone}55` },
    customInput: { minHeight: 84, borderRadius: 14, backgroundColor: colors.surface, color: colors.bone, fontSize: 16, lineHeight: 22, paddingHorizontal: 14, paddingVertical: 12 },
    confirmRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 26, paddingVertical: 8 },
    checkbox: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: colors.bone, alignItems: "center", justifyContent: "center" },
    checkboxOn: { backgroundColor: colors.success, borderColor: colors.success },
    confirmText: { flex: 1, color: colors.bone, fontSize: 15, lineHeight: 21 },
    footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.ink },
    deleteButton: { minHeight: 54, borderRadius: 28, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
    deleteButtonDisabled: { backgroundColor: `${colors.bone}55` },
    deleteButtonText: { color: colors.bone, fontSize: 17, fontWeight: "800" },
    deleteButtonTextDisabled: { color: `${colors.ink}99` },
  });
}
