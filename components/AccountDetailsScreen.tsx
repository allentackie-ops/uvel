import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OrbitLoader } from "./OrbitLoader";
import { DateOfBirthPicker } from "./DateOfBirthPicker";
import { checkUsernameAvailability, claimUsername } from "../lib/auth";
import { useColors, useResolvedAppearance } from "../lib/theme";
import { useUvel } from "../lib/store";
import { isValidUsername, normalizeUsername } from "../lib/username";

type Availability = "idle" | "invalid" | "checking" | "available" | "taken" | "unavailable";

function parseBirthDate(value: string) {
  const date = parseCalendarDate(value);
  if (!date) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  if (now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())) age -= 1;
  if (age < 18) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1920 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function dateError(value: string) {
  if (!value) return "";
  const date = parseCalendarDate(value);
  if (!date) return "Choose a valid date of birth.";
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  if (now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())) age -= 1;
  return age < 18 ? "You must be 18 or older to create an account." : "";
}

function formatBirthDate(value: string) {
  const date = parseCalendarDate(value);
  return date?.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) ?? "";
}

export function AccountDetailsScreen() {
  const app = useUvel();
  const colors = useColors();
  const appearance = useResolvedAppearance();
  const insets = useSafeAreaInsets();
  const dark = appearance === "dark";
  const accent = colors.link || colors.pulse;
  const positive = dark ? "#8DE4A5" : "#187443";
  const negative = dark ? "#FF8585" : "#B12631";
  const [birthdayIso, setBirthdayIso] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requestId = useRef(0);
  const username = normalizeUsername(usernameInput);
  const birthdayDate = useMemo(() => parseBirthDate(birthdayIso), [birthdayIso]);
  const dobError = useMemo(() => dateError(birthdayIso), [birthdayIso]);
  const usernameValid = isValidUsername(username);
  const canContinue = Boolean(
    birthdayDate &&
    usernameValid &&
    availability !== "checking" &&
    availability !== "taken" &&
    !submitting,
  );

  useEffect(() => {
    const id = ++requestId.current;
    if (!username) {
      setAvailability("idle");
      return;
    }
    if (!isValidUsername(username)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    const timer = setTimeout(() => {
      void checkUsernameAvailability(username)
        .then((available) => {
          if (requestId.current === id) setAvailability(available ? "available" : "taken");
        })
        .catch(() => {
          if (requestId.current === id) setAvailability("unavailable");
        });
    }, 320);
    return () => {
      clearTimeout(timer);
      if (requestId.current === id) requestId.current += 1;
    };
  }, [username]);

  const availabilityLabel: Record<Availability, string> = {
    idle: "",
    invalid: username ? "Check" : "",
    checking: "Checking",
    available: "Available",
    taken: "Taken",
    unavailable: "Retry",
  };
  const availabilityColor = availability === "available"
    ? positive
    : availability === "taken" || availability === "invalid"
      ? negative
      : colors.muted;

  async function leaveSetup() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await app.signOutAccount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not return to sign in.");
      setSubmitting(false);
    }
  }

  async function finish() {
    if (!birthdayDate || !usernameValid || availability === "taken" || availability === "checking" || submitting) {
      if (!birthdayDate && !dobError) setError("Choose your date of birth.");
      else if (!usernameValid) setError("Use 3–20 lowercase letters, numbers, or underscores.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const claimed = await claimUsername(username);
      await app.completeAccountSetup({
        username: claimed.username,
        usernameChangedAt: claimed.usernameChangedAt,
        birthday: birthdayDate,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not finish setting up your account.";
      if (/taken/i.test(message)) setAvailability("taken");
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.ink }]}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(insets.top, 18) + 10, paddingBottom: Math.max(insets.bottom, 18) + 26 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => void leaveSetup()}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Sign out and return to sign in"
            style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.subtle }]}
          >
            <Ionicons name="arrow-back" size={21} color={colors.bone} />
          </Pressable>

          <Text style={[styles.title, { color: colors.bone }]}>Welcome to Uvel</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>You’re new to Uvel. Add your date of birth and choose a username to get started.</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.bone }]}>Date of birth</Text>
            <Pressable
              onPress={() => {
                setError("");
                setDatePickerOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Date of birth"
              accessibilityHint="Opens a calendar. Tap the month and year to jump to your birth year."
              style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.subtle }]}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.muted} />
              <Text style={[styles.dobValue, { color: birthdayIso ? colors.bone : colors.muted }]}>
                {birthdayIso ? formatBirthDate(birthdayIso) : "Select your date of birth"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.muted} />
            </Pressable>
            {dobError ? <Text style={[styles.inlineError, { color: negative }]}>{dobError}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.bone }]}>Username</Text>
            <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.subtle }]}>
              <Text style={[styles.at, { color: colors.muted }]}>@</Text>
              <TextInput
                value={usernameInput}
                onChangeText={(value) => {
                  setUsernameInput(normalizeUsername(value).slice(0, 20));
                  setError("");
                }}
                placeholder="yourname"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                autoComplete="username"
                maxLength={20}
                accessibilityLabel="Username"
                style={[styles.fieldInput, styles.usernameInput, { color: colors.bone }]}
              />
              {availabilityLabel[availability] ? (
                <View style={styles.availability}>
                  {availability === "checking" ? <OrbitLoader size={15} /> : null}
                  {availability !== "checking" ? (
                    <Ionicons
                      name={availability === "available" ? "checkmark-circle" : availability === "taken" || availability === "invalid" ? "close-circle" : "information-circle-outline"}
                      size={16}
                      color={availabilityColor}
                    />
                  ) : null}
                  <Text style={[styles.availabilityText, { color: availabilityColor }]}>{availabilityLabel[availability]}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {error ? <Text style={[styles.formError, { color: negative }]}>{error}</Text> : null}

          <Pressable
            onPress={() => void finish()}
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canContinue, busy: submitting }}
            style={[
              styles.continueButton,
              { backgroundColor: canContinue ? colors.bone : (dark ? "#46444A" : "#969499") },
              !canContinue && styles.disabled,
            ]}
          >
            {submitting ? <OrbitLoader size={22} /> : <Text style={[styles.continueText, { color: canContinue ? colors.ink : "#FFFFFF" }]}>Continue</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <DateOfBirthPicker
        visible={datePickerOpen}
        value={birthdayIso || null}
        onClose={() => setDatePickerOpen(false)}
        onSelect={(value) => {
          setBirthdayIso(value);
          setError("");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  keyboard: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 26 },
  backButton: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, marginBottom: 30 },
  title: { fontSize: 31, lineHeight: 38, fontWeight: "800", letterSpacing: -0.8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 12, marginBottom: 32 },
  fieldGroup: { marginBottom: 22 },
  label: { fontSize: 15, fontWeight: "600", marginBottom: 9 },
  field: { minHeight: 58, borderRadius: 15, borderWidth: 1, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 11 },
  dobValue: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22 },
  fieldInput: { flex: 1, minWidth: 0, minHeight: 56, paddingVertical: 8, fontSize: 16 },
  at: { fontSize: 17, fontWeight: "700" },
  usernameInput: { paddingLeft: 0 },
  availability: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 2 },
  availabilityText: { fontSize: 12, fontWeight: "600" },
  inlineError: { fontSize: 12, lineHeight: 17, marginTop: 7 },
  formError: { fontSize: 13, lineHeight: 18, marginTop: 0, marginBottom: 12 },
  continueButton: { minHeight: 58, borderRadius: 30, alignItems: "center", justifyContent: "center", marginTop: "auto" },
  continueText: { fontSize: 17, fontWeight: "600" },
  disabled: { opacity: 0.65 },
});
