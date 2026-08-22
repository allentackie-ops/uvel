import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDb, firebaseExtra, firebaseReady } from "./firebase";

export type Session = {
  uid: string;
  email: string;
  name: string;
  provider: string;
};

WebBrowser.maybeCompleteAuthSession();

function session(user: User): Session {
  const provider = user.providerData[0]?.providerId ?? "password";
  const map: Record<string, string> = {
    password: "email",
    "google.com": "google",
    "apple.com": "apple",
    "facebook.com": "facebook",
  };
  return {
    uid: user.uid,
    email: user.email ?? "",
    name: user.displayName ?? user.email?.split("@")[0] ?? "",
    provider: map[provider] ?? provider,
  };
}

function nice(err: unknown) {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
  if (code.includes("email-already-in-use")) return "That email already has an account. Log in instead.";
  if (code.includes("invalid-email")) return "That doesn’t look like an email.";
  if (code.includes("weak-password")) return "Password needs at least 6 characters.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Email or password isn’t right.";
  }
  if (code.includes("too-many-requests")) return "Too many tries. Wait a moment.";
  if (code.includes("network-request-failed")) return "No connection. Try again.";
  if (code.includes("account-exists-with-different-credential")) {
    return "That email is already used with another sign-in.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Couldn’t sign in. Try again.";
}

async function remember(user: User, provider: string) {
  try {
    await setDoc(
      doc(firebaseDb(), "users", user.uid),
      {
        email: user.email ?? "",
        name: user.displayName ?? "",
        provider,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    /* auth still counts if firestore isn’t on yet */
  }
}

function needFirebase() {
  if (!firebaseReady()) {
    throw new Error("Firebase isn’t connected yet.");
  }
}

export function subscribeAuth(cb: (session: Session | null) => void) {
  if (!firebaseReady()) {
    cb(null);
    return () => undefined;
  }
  return onAuthStateChanged(firebaseAuth(), (user) => {
    cb(user ? session(user) : null);
  });
}

export function currentSession(): Session | null {
  if (!firebaseReady()) return null;
  const user = firebaseAuth().currentUser;
  return user ? session(user) : null;
}

export async function signUpEmail(email: string, password: string) {
  needFirebase();
  try {
    const cred = await createUserWithEmailAndPassword(firebaseAuth(), email.trim(), password);
    const name = email.trim().split("@")[0];
    await updateProfile(cred.user, { displayName: name }).catch(() => undefined);
    await remember(cred.user, "email");
    return session(cred.user);
  } catch (err) {
    throw new Error(nice(err));
  }
}

export async function signInEmail(email: string, password: string) {
  needFirebase();
  try {
    const cred = await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
    await remember(cred.user, "email");
    return session(cred.user);
  } catch (err) {
    throw new Error(nice(err));
  }
}

export async function resetPassword(email: string) {
  needFirebase();
  try {
    await sendPasswordResetEmail(firebaseAuth(), email.trim());
  } catch (err) {
    throw new Error(nice(err));
  }
}

export async function signOut() {
  if (!firebaseReady()) return;
  await fbSignOut(firebaseAuth());
}

function randomNonce(n = 32) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function param(url: string, key: string) {
  const hash = url.split("#")[1] ?? "";
  const query = (url.split("?")[1] ?? "").split("#")[0];
  const blob = `${query}&${hash}`;
  const hit = blob.split("&").map((p) => p.split("=")).find(([k]) => k === key);
  return hit ? decodeURIComponent(hit[1] ?? "") : "";
}

function expoRedirect() {
  const owner = Constants.expoConfig?.owner ?? "allentackie-ops";
  const slug = Constants.expoConfig?.slug ?? "uvel";
  return `https://auth.expo.io/@${owner}/${slug}`;
}

export async function signInGoogle() {
  needFirebase();
  const clientId = firebaseExtra.googleWebClientId;
  const reversed = firebaseExtra.googleReversedClientId;
  if (!clientId) throw new Error("Google isn’t connected yet.");
  const redirect = reversed ? `${reversed}:/oauthredirect` : expoRedirect();
  const nonce = randomNonce();
  const url =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: "id_token",
      scope: "openid email profile",
      nonce,
      prompt: "select_account",
    }).toString();
  const result = await WebBrowser.openAuthSessionAsync(url, redirect);
  if (result.type !== "success" || !("url" in result) || !result.url) {
    throw new Error("Google sign in was cancelled.");
  }
  const idToken = param(result.url, "id_token");
  if (!idToken) throw new Error("Google didn’t return a sign-in token.");
  try {
    const cred = await signInWithCredential(firebaseAuth(), GoogleAuthProvider.credential(idToken));
    await remember(cred.user, "google");
    return session(cred.user);
  } catch (err) {
    throw new Error(nice(err));
  }
}

export async function signInFacebook() {
  needFirebase();
  const appId = firebaseExtra.facebookAppId;
  if (!appId) throw new Error("Facebook isn’t connected yet.");
  const redirect = expoRedirect();
  const url =
    "https://www.facebook.com/v21.0/dialog/oauth?" +
    new URLSearchParams({
      client_id: appId,
      redirect_uri: redirect,
      response_type: "token",
      scope: "email,public_profile",
    }).toString();
  const result = await WebBrowser.openAuthSessionAsync(url, redirect);
  if (result.type !== "success" || !("url" in result) || !result.url) {
    throw new Error("Facebook sign in was cancelled.");
  }
  const token = param(result.url, "access_token");
  if (!token) throw new Error("Facebook didn’t return a sign-in token.");
  try {
    const cred = await signInWithCredential(firebaseAuth(), FacebookAuthProvider.credential(token));
    await remember(cred.user, "facebook");
    return session(cred.user);
  } catch (err) {
    throw new Error(nice(err));
  }
}

export async function signInApple() {
  needFirebase();
  let Apple: {
    isAvailableAsync: () => Promise<boolean>;
    signInAsync: (opts: {
      requestedScopes: unknown[];
    }) => Promise<{
      identityToken: string | null;
      fullName?: { givenName?: string | null; familyName?: string | null } | null;
    }>;
    AppleAuthenticationScope: { FULL_NAME: unknown; EMAIL: unknown };
  } | null = null;
  try {
    // Native module is not in this binary yet — require so Metro doesn't typecheck it.
    Apple = require("expo-apple-authentication");
  } catch {
    Apple = null;
  }
  if (!Apple) {
    throw new Error("Apple Sign In needs the next App Store build.");
  }
  try {
    const available = await Apple.isAvailableAsync();
    if (!available) throw new Error("Apple Sign In isn’t available on this device.");
    const apple = await Apple.signInAsync({
      requestedScopes: [
        Apple.AppleAuthenticationScope.FULL_NAME,
        Apple.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!apple.identityToken) throw new Error("Apple didn’t return a sign-in token.");
    const provider = new OAuthProvider("apple.com");
    const oauth = provider.credential({ idToken: apple.identityToken });
    const cred = await signInWithCredential(firebaseAuth(), oauth);
    const given = [apple.fullName?.givenName, apple.fullName?.familyName].filter(Boolean).join(" ");
    if (given) await updateProfile(cred.user, { displayName: given }).catch(() => undefined);
    await remember(cred.user, "apple");
    return session(cred.user);
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
    if (code.includes("ERR_REQUEST_CANCELED") || code.includes("ERR_CANCELED")) {
      throw new Error("Apple sign in was cancelled.");
    }
    throw new Error(nice(err));
  }
}

export function oauthRedirectHint() {
  return expoRedirect() + " or " + Linking.createURL("oauth");
}
