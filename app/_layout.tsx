import { Stack, router, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { useEffect } from "react";
import { Appearance } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useUvel } from "../lib/store";
import { useColors } from "../lib/theme";

function ThemeSync() {
  const { appearance } = useUvel();
  useEffect(() => {
    Appearance.setColorScheme(appearance);
  }, [appearance]);
  return null;
}

function OtaSync() {
  useEffect(() => {
    if (__DEV__) return;
    void (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        /* offline / first binary */
      }
    })();
  }, []);
  return null;
}

function OnboardGate() {
  const { onboarded, hydrated } = useUvel();
  const pathname = usePathname();
  useEffect(() => {
    if (!hydrated) return;
    if (!onboarded && pathname !== "/onboard") {
      router.replace("/onboard");
    }
  }, [hydrated, onboarded, pathname]);
  return null;
}

export default function Root() {
  const colors = useColors();
  const { appearance } = useUvel();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
      <ThemeSync />
      <OtaSync />
      <OnboardGate />
      <StatusBar style={appearance === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerTintColor: colors.bone,
          contentStyle: { backgroundColor: colors.ink },
          headerStyle: { backgroundColor: colors.ink },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboard" options={{ headerShown: false, animation: "fade" }} />
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
          name="closet/[id]"
          options={{
            headerTitle: "",
            headerTransparent: true,
            headerBackButtonDisplayMode: "minimal",
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
