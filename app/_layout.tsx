import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { colors } from "../lib/theme";

export default function Root() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerTintColor: colors.bone,
          contentStyle: { backgroundColor: colors.ink },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
      </Stack>
    </GestureHandlerRootView>
  );
}
