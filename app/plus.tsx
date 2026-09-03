import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function LegacyPlanRoute() {
  useEffect(() => {
    router.replace("/(tabs)/you");
  }, []);

  return <View style={{ flex: 1, backgroundColor: "#0B0A08" }} />;
}
