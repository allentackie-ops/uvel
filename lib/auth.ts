import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  getAdditionalUserInfo,
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

export const ALREADY_ACCOUNT = "You already have an account. Log in instead.";

function nice(err: unknown) {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
  if (code.includes("email-already-in-use")) return ALREADY_ACCOUNT;
  if (code.includes("invalid-email")) return "That doesn’t look like an email.";
  if (code.includes("weak-password")) return "Password needs at least 6 characters.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Email or password isn’t right.";
  }
  if (code.includes("too-many-requests")) return "Too many tries. Wait a moment.";
  if (code.includes("network-request-failed")) return "No connection. Try again.";
  if (code.includes("account-exists-with-different-credential")) {
    return ALREADY_ACCOUNT;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Couldn’t sign in. Try again.";
}

export function isAlreadyAccount(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes(ALREADY_ACCOUNT) || /already have an account|email-already-in-use|already used with another/i.test(msg);
}

async function afterAuth(cred: UserCredential, provider: string, mode: "signup" | "login") {
  const extra = getAdditionalUserInfo(cred);
  if (mode === "signup" && extra?.isNewUser === false) {
    await fbSignOut(firebaseAuth());
    throw new Error(ALREADY_ACCOUNT);
  }
  await remember(cred.user, provider);
  return session(cred.user);
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

export async function signUpEmail(email: string, password: string, name?: string) {
  needFirebase();
  try {
    try {
      const methods = await fetchSignInMethodsForEmail(firebaseAuth(), email.trim());
      if (methods.length) throw new Error(ALREADY_ACCOUNT);
    } catch (err) {
      if (isAlreadyAccount(err)) throw err;
    }
    const cred = await createUserWithEmailAndPassword(firebaseAuth(), email.trim(), password);
    const display = (name ?? "").trim() || email.trim().split("@")[0];
    await updateProfile(cred.user, { displayName: display }).catch(() => undefined);
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
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
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

function bytesToB64Url(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sha256Js(message: string): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  function rotr(n: number, x: number) {
    return (x >>> n) | (x << (32 - n));
  }
  const bytes = [];
  for (let i = 0; i < message.length; i++) bytes.push(message.charCodeAt(i) & 0xff);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push((bitLen / 2 ** (i * 8)) & 0xff);
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array<number>(64);
  for (let i = 0; i < bytes.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] =
        (bytes[i + t * 4] << 24) |
        (bytes[i + t * 4 + 1] << 16) |
        (bytes[i + t * 4 + 2] << 8) |
        bytes[i + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3);
      const s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    out[i * 4] = (H[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (H[i] >>> 8) & 0xff;
    out[i * 4 + 3] = H[i] & 0xff;
  }
  return out;
}

async function sha256Base64Url(value: string) {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
    return bytesToB64Url(new Uint8Array(digest));
  }
  return bytesToB64Url(sha256Js(value));
}

export async function signInGoogle(mode: "signup" | "login" = "login") {
  needFirebase();
  const clientId = firebaseExtra.googleWebClientId;
  const reversed = firebaseExtra.googleReversedClientId;
  if (!clientId) throw new Error("Google isn’t connected yet.");
  const redirect = reversed ? `${reversed}:/oauthredirect` : expoRedirect();
  const verifier = randomNonce(64);
  const challenge = await sha256Base64Url(verifier);
  const url =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: "code",
      scope: "openid email profile",
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
  const result = await WebBrowser.openAuthSessionAsync(url, redirect);
  if (result.type !== "success" || !("url" in result) || !result.url) {
    throw new Error("Google sign in was cancelled.");
  }
  const code = param(result.url, "code");
  if (!code) throw new Error("Google didn’t return a sign-in code.");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirect,
    }).toString(),
  });
  const tokens = (await tokenRes.json()) as { id_token?: string; error?: string };
  if (!tokens.id_token) {
    throw new Error(tokens.error ? `Google: ${tokens.error}` : "Google didn’t return a sign-in token.");
  }
  try {
    const cred = await signInWithCredential(firebaseAuth(), GoogleAuthProvider.credential(tokens.id_token));
    return await afterAuth(cred, "google", mode);
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

export async function signInApple(mode: "signup" | "login" = "login") {
  needFirebase();
  let Apple: typeof import("expo-apple-authentication") | null = null;
  try {
    Apple = require("expo-apple-authentication");
  } catch {
    Apple = null;
  }
  if (!Apple?.isAvailableAsync) {
    throw new Error("Apple Sign In needs the next App Store build.");
  }
  try {
    const available = await Apple.isAvailableAsync();
    if (!available) throw new Error("Apple Sign In isn’t available on this device.");
    const apple = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
    });
    if (!apple.identityToken) throw new Error("Apple didn’t return a sign-in token.");
    const provider = new OAuthProvider("apple.com");
    const oauth = provider.credential({ idToken: apple.identityToken });
    const cred = await signInWithCredential(firebaseAuth(), oauth);
    const given = [apple.fullName?.givenName, apple.fullName?.familyName].filter(Boolean).join(" ");
    if (given) await updateProfile(cred.user, { displayName: given }).catch(() => undefined);
    return await afterAuth(cred, "apple", mode);
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
