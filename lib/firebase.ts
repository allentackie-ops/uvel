import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  getAuth,
  initializeAuth,
  type Persistence,
} from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

type Extra = {
  firebase?: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
    googleWebClientId?: string;
    googleReversedClientId?: string;
    appleHandler?: string;
    facebookAppId?: string;
  };
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
export const firebaseExtra = extra.firebase ?? {};

export function firebaseReady() {
  return Boolean(firebaseExtra.apiKey && firebaseExtra.projectId && firebaseExtra.appId);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function persistence(): Persistence | undefined {
  const authMod = require("firebase/auth") as {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
  };
  return authMod.getReactNativePersistence?.(AsyncStorage);
}

export function firebaseApp() {
  if (!firebaseReady()) {
    throw new Error("Firebase isn’t connected yet.");
  }
  if (!app) {
    app = getApps().length
      ? getApp()
      : initializeApp({
          apiKey: firebaseExtra.apiKey!,
          authDomain: firebaseExtra.authDomain,
          projectId: firebaseExtra.projectId,
          storageBucket: firebaseExtra.storageBucket,
          messagingSenderId: firebaseExtra.messagingSenderId,
          appId: firebaseExtra.appId!,
        });
  }
  return app;
}

export function firebaseAuth() {
  if (auth) return auth;
  const instance = firebaseApp();
  const persist = persistence();
  try {
    auth = persist
      ? initializeAuth(instance, { persistence: persist })
      : getAuth(instance);
  } catch {
    auth = getAuth(instance);
  }
  return auth;
}

export function firebaseDb() {
  if (!db) db = getFirestore(firebaseApp());
  return db;
}
