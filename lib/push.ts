import Constants from "expo-constants";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { AppState, Platform } from "react-native";
import { firebaseDb, firebaseReady } from "./firebase";

let handlerReady = false;

async function notifications() {
  return import("expo-notifications");
}

export function armNotificationHandler() {
  if (handlerReady) return;
  handlerReady = true;
  void notifications()
    .then((N) => {
      N.setNotificationHandler({
        handleNotification: async (notification) => {
          const kind = String(notification.request.content.data?.kind || "");
          if (kind === "founder_desk" && AppState.currentState === "active") {
            void import("./founderDesk").then((mod) => mod.revealFounderDesk()).catch(() => undefined);
            return {
              shouldShowAlert: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
              shouldShowBanner: false,
              shouldShowList: false,
            };
          }
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          };
        },
      });
    })
    .catch(() => undefined);
}

async function ensureAndroidChannels() {
  if (Platform.OS !== "android") return;
  const N = await notifications();
  await N.setNotificationChannelAsync("activity", { name: "Activity", importance: N.AndroidImportance.HIGH, sound: "default" });
  await N.setNotificationChannelAsync("social", { name: "Messages", importance: N.AndroidImportance.HIGH, sound: "default" });
  await N.setNotificationChannelAsync("orders", { name: "Orders", importance: N.AndroidImportance.HIGH, sound: "default" });
}

export async function registerPushToken(uid: string) {
  if (!uid || !firebaseReady()) return false;
  try {
    armNotificationHandler();
    await ensureAndroidChannels();
    const N = await notifications();
    const perm = await N.getPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") {
      const asked = await N.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      status = asked.status;
    }
    if (status !== "granted") return false;
    const projectId =
      Constants.easConfig?.projectId ??
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const token = (await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    if (!token) return false;
    await setDoc(
      doc(firebaseDb(), "users", uid),
      { expoPushToken: token, lastSeen: Date.now(), updatedAt: Date.now() },
      { merge: true },
    );
    return true;
  } catch {
    return false;
  }
}

export async function enablePush(uid: string) {
  const ok = await registerPushToken(uid);
  if (!ok) return "denied" as const;
  const { pingEnabled } = await import("./engagement");
  await pingEnabled();
  return "granted" as const;
}

export function watchLastSeen(uid: string) {
  if (!uid || !firebaseReady()) return () => undefined;
  const ping = () => {
    void setDoc(doc(firebaseDb(), "users", uid), { lastSeen: Date.now() }, { merge: true }).catch(() => undefined);
  };
  ping();
  const sub = AppState.addEventListener("change", (s) => {
    if (s === "active") ping();
  });
  return () => sub.remove();
}

export async function sendPush(toToken: string, title: string, body: string, data: Record<string, string>) {
  if (!toToken) return;
  try {
    const channel = data.kind === "friend_message" || data.kind === "listing_message" || data.kind === "friend_request" ? "social" : data.kind === "sold" || data.kind === "shipped" || data.kind === "delivered" || data.kind === "wallet" ? "orders" : "activity";
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to: toToken,
        title,
        body,
        sound: "default",
        channelId: channel,
        priority: "high",
        data,
      }),
    });
  } catch {
    /* push is best-effort */
  }
}

export async function notifyUser(uid: string, title: string, body: string, data: Record<string, string>) {
  if (!uid || !firebaseReady()) return;
  try {
    const snap = await getDoc(doc(firebaseDb(), "users", uid));
    const token = typeof snap.data()?.expoPushToken === "string" ? String(snap.data()?.expoPushToken) : "";
    if (!token) return;
    await sendPush(token, title, body, data);
  } catch {
    /* ignore */
  }
}
