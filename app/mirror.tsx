import { Stack } from "expo-router";
import Mirror from "./(tabs)/find";

export default function MirrorPage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: "slide_from_right", gestureEnabled: true, contentStyle: { backgroundColor: "#0B0A08" } }} />
      <Mirror standalone />
    </>
  );
}
