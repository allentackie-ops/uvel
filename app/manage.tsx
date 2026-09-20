import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { claimUsername, updateAccountProfile } from "../lib/auth";
import { pickAvatar, takeAvatar } from "../lib/photo";
import { useUvel } from "../lib/store";
import { useColors, type Colors } from "../lib/theme";
import { isValidUsername, normalizeUsername } from "../lib/username";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export default function Manage() {
  const app = useUvel();
  const colors = useColors();
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(app.displayName);
  const [username, setUsername] = useState(app.username);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const usernameLocked = Boolean(app.usernameChangedAt && Date.now() - app.usernameChangedAt < YEAR_MS);
  const nextUsernameDate = useMemo(() => {
    if (!app.usernameChangedAt) return "";
    return new Date(app.usernameChangedAt + YEAR_MS).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }, [app.usernameChangedAt]);
  const face = app.avatarUri || app.personUri;
  const initials = (app.displayName || "U").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  async function save() {
    if (!app.uid || saving) return;
    const nextName = name.trim();
    const nextUsername = normalizeUsername(username);
    if (!nextName) {
      Alert.alert("Name required", "Enter a name to continue.");
      return;
    }
    if (!isValidUsername(nextUsername)) {
      Alert.alert("Username not valid", "Use 3–20 lowercase letters, numbers, or underscores.");
      return;
    }
    if (usernameLocked && nextUsername !== app.username) {
      Alert.alert("Username can’t be changed yet", `You can change it again on ${nextUsernameDate}.`);
      return;
    }
    setSaving(true);
    try {
      let changedAt = app.usernameChangedAt || 0;
      if (nextUsername !== app.username) {
        const claimed = await claimUsername(nextUsername);
        changedAt = claimed.usernameChangedAt || Date.now();
      }
      await updateAccountProfile({ name: nextName });
      await app.setStyle({ displayName: nextName, username: nextUsername, usernameChangedAt: changedAt });
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (error) {
      Alert.alert("Couldn’t save", error instanceof Error ? error.message : "Try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  function changePhoto() {
    Alert.alert("Profile picture", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Take photo", onPress: () => { void takeAvatar().then((uri) => { if (uri) void app.setAvatar(uri); }).catch(() => undefined); } },
      { text: "Choose photo", onPress: () => { void pickAvatar().then((uri) => { if (uri) void app.setAvatar(uri); }).catch(() => undefined); } },
    ]);
  }

  function confirmDelete() {
    Alert.alert("Delete account?", "This permanently deletes your Uvel account, profile, saved styles, and listings. This can’t be undone.", [
      { text: "Keep account", style: "cancel" },
      { text: "Delete account", style: "destructive", onPress: () => Alert.alert("Delete forever?", "You won’t be able to recover this account.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: () => void runDelete() },
      ]) },
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
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="arrow-back" size={24} color={colors.bone} />
      </Pressable>

      <Text style={styles.section}>Profile</Text>
      <View style={styles.group}>
        <Pressable onPress={changePhoto} style={styles.photoRow} accessibilityRole="button" accessibilityLabel="Change profile picture">
          {face ? <Image source={{ uri: face }} style={styles.avatar} /> : <View style={styles.initials}><Text style={styles.initialsText}>{initials}</Text></View>}
          <View style={{ flex: 1 }}><Text style={styles.rowLabel}>Profile picture</Text><Text style={styles.hint}>Change photo</Text></View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <View style={styles.fieldRow}>
          <Text style={styles.rowLabel}>Name</Text>
          <TextInput value={name} onChangeText={setName} style={styles.field} placeholder="Your name" placeholderTextColor={colors.muted} autoCapitalize="words" />
        </View>
        <View style={[styles.fieldRow, styles.last]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Username</Text>
            {usernameLocked ? <Text style={styles.hint}>Available again {nextUsernameDate}</Text> : <Text style={styles.hint}>3–20 lowercase letters, numbers, or underscores</Text>}
          </View>
          <TextInput value={username} onChangeText={setUsername} editable={!usernameLocked} style={[styles.field, usernameLocked && styles.disabledField]} placeholder="username" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} />
        </View>
      </View>
      <Pressable onPress={() => void save()} disabled={saving} style={[styles.save, saving && styles.saveDisabled]}>
        {saving ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.saveText}>Save changes</Text>}
      </Pressable>

      <Text style={styles.section}>Account</Text>
      <View style={styles.group}>
        <View style={styles.accountRow}><Text style={styles.rowLabel}>Email</Text><Text style={styles.hint}>{app.email || "Not available"}</Text></View>
        <Pressable onPress={confirmDelete} disabled={busy} style={[styles.deleteRow, styles.last]}>
          {busy ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.deleteText}>Delete account</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function make(colors: Colors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    content: { paddingHorizontal: 20 },
    back: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center", marginBottom: 8 },
    section: { color: colors.bone, fontSize: 16, fontWeight: "700", marginTop: 18, marginBottom: 10 },
    group: { backgroundColor: colors.surface, borderRadius: 16, overflow: "hidden" },
    photoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.ink },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    initials: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
    initialsText: { color: colors.successInk, fontWeight: "800", fontSize: 17 },
    rowLabel: { color: colors.bone, fontSize: 16 },
    hint: { color: colors.muted, fontSize: 12, marginTop: 4 },
    chevron: { color: colors.subtle, fontSize: 22 },
    fieldRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.ink },
    field: { flex: 1, minWidth: 100, color: colors.bone, fontSize: 16, textAlign: "right", paddingVertical: 0 },
    disabledField: { color: colors.muted },
    last: { borderBottomWidth: 0 },
    save: { backgroundColor: colors.bone, borderRadius: 14, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 14 },
    saveDisabled: { opacity: 0.65 },
    saveText: { color: colors.ink, fontWeight: "800", fontSize: 16 },
    accountRow: { padding: 16 },
    deleteRow: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.ink },
    deleteText: { color: colors.danger, fontWeight: "700", fontSize: 16 },
  });
}
