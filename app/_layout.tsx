import { DarkTheme, Stack, ThemeProvider, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Appearance, Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LaunchSplash } from "../components/LaunchSplash";
import { useOtaReady } from "../lib/ota";
import { armNotificationHandler, registerPushToken, watchLastSeen } from "../lib/push";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";
import { pullLooks } from "../lib/trends";
import { useWardrobe } from "../lib/wardrobe";
import { consumeListingDraftNotice } from "../lib/listingDraft";
import Onboard from "./onboard";
import ProfileSetup from "./setup";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function ThemeSync() {
  const { appearance } = useUvel();
  useEffect(() => {
    Appearance.setColorScheme(appearance);
  }, [appearance]);
  return null;
}

function LikesSync() {
  const app = useUvel();
  const pieces = useWardrobe();
  useEffect(() => {
    if (!app.hydrated || !pieces.length) return;
    app.seedSavedLikes();
  }, [app.hydrated, pieces.length, app.saved.join("|")]);
  return null;
}

function PushSync() {
  const { uid } = useUvel();
  useEffect(() => {
    armNotificationHandler();
  }, []);
  useEffect(() => {
    if (!uid) return;
    void registerPushToken(uid);
    const stop = watchLastSeen(uid);
    let sub: { remove: () => void } | undefined;
    void import("expo-notifications")
      .then((N) => {
        sub = N.addNotificationResponseReceivedListener((res) => {
          const data = res.notification.request.content.data || {};
          const pieceId = data.pieceId;
          const threadId = data.threadId;
          if (typeof pieceId === "string" && pieceId) {
            router.push({
              pathname: "/ask/[id]",
              params: { id: pieceId, ...(typeof threadId === "string" && threadId ? { threadId } : {}) },
            });
          }
        });
      })
      .catch(() => undefined);
    return () => {
      stop();
      sub?.remove();
    };
  }, [uid]);
  return null;
}

function AppStack() {
  const colors = useColors();
  const { appearance } = useUvel();
  const navTheme = useMemo(
    () => ({
      ...DarkTheme,
      dark: appearance === "dark",
      colors: {
        ...DarkTheme.colors,
        background: colors.ink,
        card: colors.ink,
        text: colors.bone,
        border: colors.ink,
        primary: colors.bone,
        notification: colors.pulse,
      },
    }),
    [appearance, colors],
  );
  return (
    <ThemeProvider value={navTheme}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
        <ThemeSync />
        <PushSync />
        <LikesSync />
        <StatusBar style={appearance === "dark" ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerTintColor: colors.bone,
            contentStyle: { backgroundColor: colors.ink },
            headerStyle: { backgroundColor: colors.ink },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: "minimal",
            headerBackTitle: "",
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Closet", animation: "none" }} />
          <Stack.Screen name="onboard" options={{ headerShown: false, animation: "none" }} />
          <Stack.Screen
            name="product/[id]"
            options={{
              headerTransparent: true,
              headerTitle: "",
              headerBackButtonDisplayMode: "minimal",
            }}
          />
          <Stack.Screen
            name="plus"
            options={{
              presentation: "modal",
              headerTitle: "Uvel+",
              headerTransparent: true,
            }}
          />
          <Stack.Screen
            name="legal/[id]"
            options={{
              headerTransparent: false,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              headerTitle: "Settings",
              headerTransparent: false,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="price"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#12110E" },
            }}
          />
          <Stack.Screen
            name="sell"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: colors.ink },
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="style-dna"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#12110E" },
            }}
          />
          <Stack.Screen
            name="sell-category"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#12110E" },
            }}
          />
          <Stack.Screen
            name="sell-condition"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#12110E" },
            }}
          />
          <Stack.Screen
            name="closet/[id]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#12110E" },
            }}
          />
          <Stack.Screen
            name="try-on"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#12110E" },
            }}
          />
          <Stack.Screen
            name="scan"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#12110E" },
            }}
          />
          <Stack.Screen
            name="ask/[id]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#12110E" },
            }}
          />
          <Stack.Screen
            name="inbox"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#12110E" },
            }}
          />
          <Stack.Screen
            name="store"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#12110E" },
            }}
          />
          <Stack.Screen
            name="checkout/[id]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#12110E" },
            }}
          />
          <Stack.Screen
            name="address"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#12110E" },
            }}
          />
          <Stack.Screen
            name="order/[id]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#12110E" },
            }}
          />
          <Stack.Screen
            name="brand/apply"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#0B0A08" },
            }}
          />
          <Stack.Screen
            name="brand/[id]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#0B0A08" },
            }}
          />
          <Stack.Screen
            name="brand/hq"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#0B0A08" },
            }}
          />
          <Stack.Screen
            name="brand/studio"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#0B0A08" },
            }}
          />
          <Stack.Screen
            name="brand/list"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#0B0A08" },
            }}
          />
          <Stack.Screen
            name="brand/analytics"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#0B0A08" },
            }}
          />
          <Stack.Screen
            name="brand/invite"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#0B0A08" },
            }}
          />
        </Stack>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

function DraftResumeNotice() {
  const [draft, setDraft] = useState<Awaited<ReturnType<typeof consumeListingDraftNotice>>>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    void consumeListingDraftNotice().then((saved) => {
      if (!active || !saved) return;
      setDraft(saved);
      setVisible(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!visible || !draft) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 58, left: 16, right: 16, zIndex: 100 }}>
      <View style={{ backgroundColor: "#1A1915", borderColor: "#D6E27A", borderWidth: 1, borderRadius: 18, padding: 16, shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}>
        <Text style={{ color: "#D6E27A", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>DRAFT SAVED</Text>
        <Text style={{ color: "#F4F0E6", fontSize: 17, fontWeight: "700", marginTop: 6 }}>Your listing draft was saved.</Text>
        <Text style={{ color: "rgba(244,240,230,0.62)", fontSize: 13, lineHeight: 19, marginTop: 4 }}>Continue where you left off in your listing.</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Pressable onPress={() => setVisible(false)} style={{ flex: 1, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "rgba(244,240,230,0.2)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#F4F0E6", fontWeight: "700", fontSize: 13 }}>Later</Text>
          </Pressable>
          <Pressable onPress={() => { setVisible(false); router.push({ pathname: "/sell", params: { draft: "1" } }); }} style={{ flex: 1.2, height: 42, borderRadius: 21, backgroundColor: "#D6E27A", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#16140F", fontWeight: "800", fontSize: 13 }}>Continue draft</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function Root() {
  const { onboarded, hydrated, uid, profileDone, profileChecked } = useUvel();
  useOtaReady();
  const [intro, setIntro] = useState(true);
  const dismiss = useCallback(() => setIntro(false), []);
  const gateReady = hydrated && profileChecked;
  const needProfile = Boolean(uid) && profileChecked && !profileDone;
  const signedIn = Boolean(uid);

  useEffect(() => {
    if (!hydrated) return;
    void pullLooks();
  }, [hydrated]);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: intro ? "#2A320E" : "#0B0A08" }}>
        <StatusBar style="light" />
        {gateReady ? (
          !onboarded && !signedIn ? (
            <Onboard />
          ) : needProfile ? (
            <ProfileSetup />
          ) : (
            <AppStack />
          )
        ) : null}
        {signedIn && gateReady && !intro ? <DraftResumeNotice /> : null}
        {intro || !gateReady ? <LaunchSplash ready={gateReady} onDone={dismiss} /> : null}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
