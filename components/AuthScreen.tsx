import { useState } from "react";
import {
  KeyboardAvoidingView,
  Keyboard,
  Modal,
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
  signInEmail,
  signUpEmail,
} from "../lib/auth";
import { requestTodayFeedRefreshAfterSignIn } from "../lib/store";
import { DOCS } from "../lib/legal";
import { useColors, useResolvedAppearance } from "../lib/theme";

type Provider = "apple" | "google";
type Screen = "entry" | "email-password";
type EmailIntent = "sign-in" | "create";
type Busy = Provider | "email" | "reset" | null;
type LegalId = "privacy" | "terms";

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
  const [legalId, setLegalId] = useState<LegalId | null>(null);
  const emailReady = validEmail(email);
  const accent = colors.link || colors.pulse;
  const outline = dark ? "rgba(244,240,230,0.45)" : "#191919";

  async function run(provider: Busy, action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(provider);
    setError("");
    setNotice("");
    try {
      const session = await action();
      if (session) requestTodayFeedRefreshAfterSignIn();
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

  function submitPassword(intent: EmailIntent = "sign-in") {
    if (!password) {
      setError("Enter your password to continue.");
      return;
    }
    void run("email", () => intent === "create" ? signUpEmail(email, password) : signInEmail(email, password));
  }

  function openLegal(id: LegalId) {
    Keyboard.dismiss();
    setLegalId(id);
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
                <Pressable onPress={() => openLegal("privacy")} accessibilityRole="link">
                  <Text style={[styles.legalLink, { color: accent }]}>privacy policy</Text>
                </Pressable>
                <Text style={[styles.legalText, { color: colors.bone }]}> and </Text>
                <Pressable onPress={() => openLegal("terms")} accessibilityRole="link">
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
                Use your existing password to sign in, or choose Create account if this email is new to Uvel.
              </Text>

              <View style={[styles.passwordField, { borderBottomColor: accent }]}>
                <TextInput
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError("");
                  }}
                  onSubmitEditing={() => submitPassword("sign-in")}
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
                onPress={() => submitPassword("sign-in")}
                disabled={!password || buttonDisabled}
                accessibilityRole="button"
                accessibilityState={{ disabled: !password || buttonDisabled, busy: busy === "email" }}
                style={[
                  styles.continueButton,
                  { backgroundColor: password ? colors.bone : (dark ? "#4A484C" : "#969499") },
                  (!password || buttonDisabled) && styles.disabled,
                ]}
              >
                {busy === "email" ? <OrbitLoader size={22} /> : <Text style={[styles.continueText, { color: password ? colors.ink : "#FFFFFF" }]}>Sign in</Text>}
              </Pressable>
              <Pressable
                onPress={() => submitPassword("create")}
                disabled={!password || buttonDisabled}
                accessibilityRole="button"
                accessibilityState={{ disabled: !password || buttonDisabled, busy: busy === "email" }}
                style={[styles.createAccountButton, (!password || buttonDisabled) && styles.disabled]}
              >
                <Text style={[styles.createAccountText, { color: accent }]}>Create account</Text>
              </Pressable>
              <Pressable onPress={() => void sendReset()} disabled={buttonDisabled} style={styles.resetButton}>
                <Text style={[styles.resetText, { color: accent }]}>Forgot password?</Text>
              </Pressable>
              <Text style={[styles.passwordFootnote, { color: colors.muted }]}>New accounts continue with your date of birth and username.</Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={legalId !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setLegalId(null)}
      >
        {legalId ? (
          <View style={[styles.legalPage, { backgroundColor: colors.ink, paddingTop: Math.max(insets.top, 12) }]}>
            <View style={[styles.legalHeader, { borderBottomColor: colors.subtle }]}>
              <Pressable
                onPress={() => setLegalId(null)}
                accessibilityRole="button"
                accessibilityLabel="Back to sign in"
                style={[styles.legalBack, { backgroundColor: colors.surface }]}
              >
                <Ionicons name="arrow-back" size={21} color={colors.bone} />
              </Pressable>
              <Text style={[styles.legalTitle, { color: colors.bone }]}>{DOCS[legalId].title}</Text>
              <View style={styles.legalBackSpacer} />
            </View>
            <ScrollView
              contentContainerStyle={[styles.legalContent, { paddingBottom: Math.max(insets.bottom, 16) + 28 }]}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.legalMeta, { color: colors.subtle }]}>Last updated {DOCS[legalId].updated}</Text>
              {DOCS[legalId].sections.map((section) => (
                <View key={section.heading} style={styles.legalSection}>
                  <Text style={[styles.legalHeading, { color: colors.bone }]}>{section.heading}</Text>
                  {section.body.map((paragraph) => (
                    <Text key={paragraph} style={[styles.legalParagraph, { color: colors.muted }]}>{paragraph}</Text>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </Modal>
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
  createAccountButton: { alignItems: "center", justifyContent: "center", minHeight: 48, marginTop: 8 },
  createAccountText: { fontSize: 15, fontWeight: "600" },
  legalRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "baseline", marginTop: 46, paddingHorizontal: 10 },
  legalText: { fontSize: 14, lineHeight: 21 },
  legalLink: { fontSize: 14, lineHeight: 21, textDecorationLine: "underline", fontWeight: "500" },
  legalPage: { flex: 1 },
  legalHeader: { minHeight: 62, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth },
  legalBack: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  legalBackSpacer: { width: 42, height: 42 },
  legalTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", paddingHorizontal: 8 },
  legalContent: { paddingHorizontal: 22, paddingTop: 18 },
  legalMeta: { fontSize: 12, marginBottom: 22 },
  legalSection: { marginBottom: 22 },
  legalHeading: { fontSize: 17, fontWeight: "600", marginBottom: 8 },
  legalParagraph: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
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
