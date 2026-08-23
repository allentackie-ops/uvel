import Constants from "expo-constants";
import { doc, setDoc } from "firebase/firestore";
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
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    })
    .catch(() => undefined);
}

export async function registerPushToken(uid: string) {
  if (!uid || !firebaseReady()) return;
  try {
    const N = await notifications();
    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync("activity", {
        name: "Activity",
        importance: N.AndroidImportance.HIGH,
      });
    }
    const perm = await N.getPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") {
      const asked = await N.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== "granted") return;
    const projectId =
      Constants.easConfig?.projectId ??
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const token = (await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await setDoc(
      doc(firebaseDb(), "users", uid),
      { expoPushToken: token, lastSeen: Date.now(), updatedAt: Date.now() },
      { merge: true },
    );
  } catch {
    /* current binary may not have the native module */
  }
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
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: toToken, title, body, sound: "default", channelId: "activity", data }),
    });
  } catch {
    /* push is best-effort */
  }
}
