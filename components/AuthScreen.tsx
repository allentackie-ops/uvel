import { useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OrbitLoader } from "./OrbitLoader";
import {
  resetPassword,
  signInApple,
  signInGoogle,
  signInOrCreateEmail,
} from "../lib/auth";
import { PRIVACY_URL, TERMS_URL } from "../lib/legal";
import { useColors, useResolvedAppearance } from "../lib/theme";

type Provider = "apple" | "google";
type Screen = "entry" | "email-password";
type Busy = Provider | "email" | "reset" | null;

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function AuthScreen({ onClose }: { onClose?: () => void } = {}) {
  const colors = useColors();
  const appearance = useResolvedAppearance();
  const insets = useSafeAreaInsets();
  const dark = appearance === "dark";
  const [screen, setScreen] = useState<Screen>("entry");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const emailReady = validEmail(email);
  const accent = colors.link || colors.pulse;
  const outline = dark ? "rgba(244,240,230,0.45)" : "#191919";

  async function run(provider: Busy, action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(provider);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t sign in. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function continueWithEmail() {
    if (!emailReady) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setNotice("");
    setScreen("email-password");
  }

  function submitPassword() {
    if (!password) {
      setError("Enter your password to continue.");
      return;
    }
    void run("email", () => signInOrCreateEmail(email, password));
  }

  async function sendReset() {
    if (!emailReady) {
      setError("Go back and enter a valid email address first.");
      return;
    }
    if (busy) return;
    setBusy("reset");
    setError("");
    setNotice("");
    try {
      await resetPassword(email);
      setNotice("Check your email for a password reset link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t send the reset email.");
    } finally {
      setBusy(null);
    }
  }

  const buttonDisabled = busy !== null;

  return (
    <View style={[styles.root, { backgroundColor: colors.ink }]}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: Math.max(insets.top, 20) + (screen === "entry" ? 46 : 20),
              paddingBottom: Math.max(insets.bottom, 20) + 28,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {screen === "entry" ? (
            <>
              {onClose ? (
                <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close sign in" style={[styles.closeButton, { backgroundColor: colors.surface }]}>
                  <Ionicons name="close" size={22} color={colors.bone} />
                </Pressable>
              ) : null}
              <Text style={[styles.title, { color: colors.bone }]}>Sign In or Create Account</Text>
              <Text style={[styles.subtitle, { color: colors.bone }]}>
                Pick up where you left off, or find your next favorite.
              </Text>

              <View style={styles.providers}>
                <Pressable
                  onPress={() => void run("apple", () => signInApple())}
                  disabled={buttonDisabled}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in with Apple"
                  accessibilityState={{ disabled: buttonDisabled, busy: busy === "apple" }}
                  style={[styles.providerButton, styles.appleButton, { borderColor: outline }, buttonDisabled && styles.disabled]}
                >
                  {busy === "apple" ? (
                    <OrbitLoader size={22} />
                  ) : (
                    <>
                      <Image source={require("../assets/auth/apple.png")} style={styles.appleIcon} contentFit="contain" />
                      <Text style={styles.appleLabel}>Sign in with Apple</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => void run("google", () => signInGoogle())}
                  disabled={buttonDisabled}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in with Google"
                  accessibilityState={{ disabled: buttonDisabled, busy: busy === "google" }}
                  style={[styles.providerButton, styles.googleButton, { borderColor: colors.subtle }, buttonDisabled && styles.disabled]}
                >
                  {busy === "google" ? (
                    <OrbitLoader size={22} />
                  ) : (
                    <>
                      <Image source={require("../assets/auth/google.png")} style={styles.googleIcon} contentFit="contain" />
                      <Text style={[styles.googleLabel, { color: colors.bone }]}>Sign in with Google</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <View style={styles.dividerRow}>
                <View style={[styles.divider, { backgroundColor: colors.subtle }]} />
                <Text style={[styles.dividerText, { color: colors.muted }]}>or</Text>
                <View style={[styles.divider, { backgroundColor: colors.subtle }]} />
              </View>

              <Text style={[styles.fieldLabel, { color: colors.bone }]}>Email address</Text>
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setError("");
                }}
                onSubmitEditing={continueWithEmail}
                placeholder=""
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="next"
                accessibilityLabel="Email address"
                style={[styles.emailInput, { color: colors.bone, borderBottomColor: accent }]}
              />

              {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
              <Pressable
                onPress={continueWithEmail}
                disabled={!emailReady || buttonDisabled}
                accessibilityRole="button"
                accessibilityState={{ disabled: !emailReady || buttonDisabled }}
                style={[
                  styles.continueButton,
                  { backgroundColor: emailReady ? colors.bone : (dark ? "#4A484C" : "#969499") },
                  (!emailReady || buttonDisabled) && styles.disabled,
                ]}
              >
                {busy === "email" ? (
                  <OrbitLoader size={22} />
                ) : (
                  <Text style={[styles.continueText, { color: emailReady ? colors.ink : "#FFFFFF" }]}>Continue</Text>
                )}
              </Pressable>

              <View style={styles.legalRow}>
                <Text style={[styles.legalText, { color: colors.bone }]}>By continuing, you agree to our </Text>
                <Pressable onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => undefined)}>
                  <Text style={[styles.legalLink, { color: accent }]}>privacy policy</Text>
                </Pressable>
                <Text style={[styles.legalText, { color: colors.bone }]}> and </Text>
                <Pressable onPress={() => void Linking.openURL(TERMS_URL).catch(() => undefined)}>
                  <Text style={[styles.legalLink, { color: accent }]}>terms of use</Text>
                </Pressable>
                <Text style={[styles.legalText, { color: colors.bone }]}>.</Text>
              </View>
            </>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  setScreen("entry");
                  setPassword("");
                  setError("");
                  setNotice("");
                }}
                accessibilityRole="button"
                accessibilityLabel="Back to sign in options"
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={22} color={colors.bone} />
              </Pressable>
              <Text style={[styles.emailEyebrow, { color: colors.muted }]}>EMAIL ADDRESS</Text>
              <Text style={[styles.emailDisplay, { color: colors.bone }]}>{email.trim()}</Text>
              <Text style={[styles.passwordTitle, { color: colors.bone }]}>Enter your password</Text>
              <Text style={[styles.passwordSubtitle, { color: colors.muted }]}>
                Sign in, or choose a password to create your Uvel account.
              </Text>

              <View style={[styles.passwordField, { borderBottomColor: accent }]}>
                <TextInput
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError("");
                  }}
                  onSubmitEditing={submitPassword}
                  placeholder="Password"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  autoComplete="current-password"
                  returnKeyType="go"
                  accessibilityLabel="Password"
                  style={[styles.passwordInput, { color: colors.bone }]}
                />
                <Pressable onPress={() => setShowPassword((value) => !value)} hitSlop={10}>
                  <Text style={[styles.showText, { color: colors.muted }]}>{showPassword ? "Hide" : "Show"}</Text>
                </Pressable>
              </View>

              {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
              {notice ? <Text style={[styles.notice, { color: colors.success }]}>{notice}</Text> : null}
              <Pressable
                onPress={submitPassword}
                disabled={!password || buttonDisabled}
                accessibilityRole="button"
                accessibilityState={{ disabled: !password || buttonDisabled, busy: busy === "email" }}
                style={[
                  styles.continueButton,
                  { backgroundColor: password ? colors.bone : (dark ? "#4A484C" : "#969499") },
                  (!password || buttonDisabled) && styles.disabled,
                ]}
              >
                {busy === "email" ? <OrbitLoader size={22} /> : <Text style={[styles.continueText, { color: password ? colors.ink : "#FFFFFF" }]}>Continue</Text>}
              </Pressable>
              <Pressable onPress={() => void sendReset()} disabled={buttonDisabled} style={styles.resetButton}>
                <Text style={[styles.resetText, { color: accent }]}>Forgot password?</Text>
              </Pressable>
              <Text style={[styles.passwordFootnote, { color: colors.muted }]}>New accounts continue with your date of birth and username.</Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  keyboard: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 26 },
  closeButton: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  title: { fontSize: 30, lineHeight: 37, fontWeight: "800", letterSpacing: -0.8 },
  subtitle: { fontSize: 16, lineHeight: 24, marginTop: 22 },
  providers: { marginTop: 48, gap: 12 },
  providerButton: { minHeight: 58, borderRadius: 30, borderWidth: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  appleButton: { backgroundColor: "#FFFFFF" },
  googleButton: { backgroundColor: "transparent" },
  appleIcon: { width: 20, height: 22 },
  googleIcon: { width: 21, height: 21 },
  appleLabel: { color: "#111111", fontSize: 17, fontWeight: "600" },
  googleLabel: { fontSize: 17, fontWeight: "600" },
  disabled: { opacity: 0.58 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 46, marginBottom: 34 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 16 },
  fieldLabel: { fontSize: 15, fontWeight: "500" },
  emailInput: { minHeight: 49, borderBottomWidth: 2, paddingHorizontal: 0, paddingVertical: 7, fontSize: 18 },
  error: { fontSize: 13, lineHeight: 18, marginTop: 10 },
  notice: { fontSize: 13, lineHeight: 18, marginTop: 10 },
  continueButton: { height: 58, borderRadius: 30, alignItems: "center", justifyContent: "center", marginTop: 42 },
  continueText: { fontSize: 17, fontWeight: "600" },
  legalRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "baseline", marginTop: 46, paddingHorizontal: 10 },
  legalText: { fontSize: 14, lineHeight: 21 },
  legalLink: { fontSize: 14, lineHeight: 21, textDecorationLine: "underline", fontWeight: "500" },
  backButton: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", marginBottom: 42 },
  emailEyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1 },
  emailDisplay: { fontSize: 19, lineHeight: 26, fontWeight: "600", marginTop: 8 },
  passwordTitle: { fontSize: 29, lineHeight: 36, fontWeight: "800", letterSpacing: -0.6, marginTop: 40 },
  passwordSubtitle: { fontSize: 15, lineHeight: 22, marginTop: 12 },
  passwordField: { minHeight: 54, borderBottomWidth: 2, flexDirection: "row", alignItems: "center", marginTop: 38 },
  passwordInput: { flex: 1, minHeight: 52, fontSize: 18, paddingVertical: 8 },
  showText: { fontSize: 14, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 12 },
  resetButton: { alignSelf: "center", paddingVertical: 18 },
  resetText: { fontSize: 14, fontWeight: "600" },
  passwordFootnote: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 20 },
});
