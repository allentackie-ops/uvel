import { DarkTheme, Stack, ThemeProvider, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LaunchSplash } from "../components/LaunchSplash";
import { useOtaReady } from "../lib/ota";
import { armNotificationHandler, registerPushToken, watchLastSeen } from "../lib/push";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";
import { pullLooks } from "../lib/trends";
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
          const pieceId = res.notification.request.content.data?.pieceId;
          if (typeof pieceId === "string" && pieceId) {
            router.push({ pathname: "/ask/[id]", params: { id: pieceId } });
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
            name="settings"
            options={{
              headerTitle: "Settings",
              headerTransparent: false,
              headerShadowVisible: false,
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
        </Stack>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

export default function Root() {
  const { onboarded, hydrated, uid, profileDone } = useUvel();
  const otaReady = useOtaReady();
  const [intro, setIntro] = useState(true);
  const dismiss = useCallback(() => setIntro(false), []);
  const ready = hydrated && otaReady;
  const needProfile = Boolean(uid) && !profileDone;
  const showApp = ready && !intro;

  useEffect(() => {
    if (hydrated) void pullLooks();
  }, [hydrated]);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#2A320E" }}>
        <StatusBar style="light" />
        {showApp ? (
          !onboarded ? (
            <Onboard />
          ) : needProfile ? (
            <ProfileSetup />
          ) : (
            <AppStack />
          )
        ) : null}
        {intro ? <LaunchSplash ready={ready} onDone={dismiss} /> : null}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
