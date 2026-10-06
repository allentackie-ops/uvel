import { useState } from "react";
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
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OrbitLoader } from "./OrbitLoader";
import {
  isAlreadyAccount,
  resetPassword,
  signInApple,
  signInEmail,
  signInGoogle,
  signUpEmail,
} from "../lib/auth";
import { useColors } from "../lib/theme";

type Mode = "signin" | "signup";

type Provider = "apple" | "google";

export function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<Provider | "email" | "reset" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isSignup = mode === "signup";

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
    setBusy(null);
  }

  async function run(provider: Provider | "email", action: () => Promise<unknown>) {
    setBusy(provider);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn’t sign in. Try again.";
      setError(isSignup && isAlreadyAccount(err) ? "You already have an account. Switch to Sign in." : message);
    } finally {
      setBusy(null);
    }
  }

  function submitEmail() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (isSignup && !name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (isSignup && !agreed) {
      setError("Accept the Uvel terms to create an account.");
      return;
    }
    void run("email", () =>
      isSignup ? signUpEmail(email, password, name) : signInEmail(email, password),
    );
  }

  async function sendReset() {
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
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

  return (
    <View style={[styles.root, { backgroundColor: colors.ink }]}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingTop: Math.max(insets.top, 22) + 18, paddingBottom: Math.max(insets.bottom, 22) + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Image source={require("../assets/icon.png")} style={styles.logo} contentFit="contain" />
            <Text style={[styles.wordmark, { color: colors.bone }]}>Uvel</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>Your closet, your finds, your style.</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.subtle }]}>
            <View style={[styles.segmented, { backgroundColor: colors.neutral }]}>
              <Pressable
                onPress={() => switchMode("signin")}
                style={[styles.segment, mode === "signin" && { backgroundColor: colors.bone }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === "signin" }}
              >
                <Text style={[styles.segmentText, { color: mode === "signin" ? colors.ink : colors.muted }]}>Sign in</Text>
              </Pressable>
              <Pressable
                onPress={() => switchMode("signup")}
                style={[styles.segment, mode === "signup" && { backgroundColor: colors.bone }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === "signup" }}
              >
                <Text style={[styles.segmentText, { color: mode === "signup" ? colors.ink : colors.muted }]}>Create account</Text>
              </Pressable>
            </View>

            <Text style={[styles.title, { color: colors.bone }]}>{isSignup ? "Create your Uvel account" : "Welcome back"}</Text>
            <Text style={[styles.lede, { color: colors.muted }]}>
              {isSignup ? "Save your style and shop Uvel finds anywhere." : "Sign in to continue to your closet."}
            </Text>

            <Pressable
              onPress={() => void run("apple", () => signInApple(isSignup ? "signup" : "login"))}
              disabled={busy !== null}
              style={[styles.providerButton, styles.appleButton, busy !== null && styles.disabled]}
            >
              {busy === "apple" ? <OrbitLoader size={22} /> : <><Image source={require("../assets/auth/apple.png")} style={styles.providerIcon} contentFit="contain" /><Text style={styles.appleLabel}>Continue with Apple</Text></>}
            </Pressable>
            <Pressable
              onPress={() => void run("google", () => signInGoogle(isSignup ? "signup" : "login"))}
              disabled={busy !== null}
              style={[styles.providerButton, styles.googleButton, { borderColor: colors.subtle }, busy !== null && styles.disabled]}
            >
              {busy === "google" ? <OrbitLoader size={22} /> : <><Image source={require("../assets/auth/google.png")} style={styles.providerIcon} contentFit="contain" /><Text style={[styles.googleLabel, { color: colors.bone }]}>Continue with Google</Text></>}
            </Pressable>

            <View style={styles.dividerRow}><View style={[styles.divider, { backgroundColor: colors.subtle }]} /><Text style={[styles.dividerText, { color: colors.muted }]}>or</Text><View style={[styles.divider, { backgroundColor: colors.subtle }]} /></View>

            {isSignup ? (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={colors.muted}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="name"
                style={[styles.input, { color: colors.bone, borderColor: colors.subtle }]}
              />
            ) : null}
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              style={[styles.input, { color: colors.bone, borderColor: colors.subtle }]}
            />
            <View style={styles.passwordWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
                textContentType={isSignup ? "newPassword" : "password"}
                style={[styles.input, styles.passwordInput, { color: colors.bone, borderColor: colors.subtle }]}
              />
              <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.showButton} hitSlop={8}>
                <Text style={[styles.showText, { color: colors.muted }]}>{showPassword ? "Hide" : "Show"}</Text>
              </Pressable>
            </View>

            {isSignup ? (
              <Pressable onPress={() => setAgreed((value) => !value)} style={styles.agreeRow} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
                <View style={[styles.checkbox, { borderColor: colors.subtle }, agreed && { backgroundColor: colors.bone, borderColor: colors.bone }]}>{agreed ? <Text style={[styles.check, { color: colors.ink }]}>✓</Text> : null}</View>
                <Text style={[styles.agreeText, { color: colors.muted }]}>I agree to Uvel’s terms and privacy policy.</Text>
              </Pressable>
            ) : null}

            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
            {notice ? <Text style={[styles.notice, { color: colors.success }]}>{notice}</Text> : null}
            <Pressable onPress={submitEmail} disabled={busy !== null} style={[styles.submit, { backgroundColor: colors.bone }, busy !== null && styles.disabled]}>
              {busy === "email" ? <OrbitLoader size={22} /> : <Text style={[styles.submitText, { color: colors.ink }]}>{isSignup ? "Create account" : "Sign in"}</Text>}
            </Pressable>
            {!isSignup ? <Pressable onPress={() => void sendReset()} disabled={busy !== null} style={styles.reset}><Text style={[styles.resetText, { color: colors.muted }]}>Forgot password?</Text></Pressable> : null}
          </View>

          <Text style={[styles.footer, { color: colors.muted }]}>You can change your preferences anytime.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  keyboard: { flex: 1 },
  header: { alignItems: "center", paddingHorizontal: 24, marginBottom: 24 },
  logo: { width: 64, height: 64, borderRadius: 16, marginBottom: 12 },
  wordmark: { fontSize: 32, fontWeight: "800", letterSpacing: -0.8 },
  subtitle: { fontSize: 14, marginTop: 6 },
  card: { marginHorizontal: 18, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  segmented: { flexDirection: "row", borderRadius: 12, padding: 4, marginBottom: 26 },
  segment: { flex: 1, minHeight: 42, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  segmentText: { fontSize: 14, fontWeight: "700" },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  lede: { fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 20 },
  providerButton: { height: 52, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 11 },
  appleButton: { backgroundColor: "#FFFFFF" },
  googleButton: { borderWidth: 1, backgroundColor: "transparent" },
  providerIcon: { width: 22, height: 22 },
  appleLabel: { color: "#111111", fontSize: 15, fontWeight: "700" },
  googleLabel: { fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.55 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 13 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 13 },
  input: { height: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, fontSize: 16, marginBottom: 11 },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 66 },
  showButton: { position: "absolute", right: 14, top: 0, height: 52, justifyContent: "center" },
  showText: { fontSize: 13, fontWeight: "700" },
  agreeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 3, marginBottom: 7 },
  checkbox: { width: 21, height: 21, borderWidth: 1.5, borderRadius: 5, alignItems: "center", justifyContent: "center", marginTop: 1 },
  check: { fontSize: 14, fontWeight: "800" },
  agreeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  error: { fontSize: 13, lineHeight: 18, marginTop: 5, marginBottom: 7 },
  notice: { fontSize: 13, lineHeight: 18, marginTop: 5, marginBottom: 7 },
  submit: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 7 },
  submitText: { fontSize: 15, fontWeight: "800" },
  reset: { alignItems: "center", paddingVertical: 15 },
  resetText: { fontSize: 14, fontWeight: "600" },
  footer: { textAlign: "center", fontSize: 12, marginTop: 18, paddingHorizontal: 34 },
});
