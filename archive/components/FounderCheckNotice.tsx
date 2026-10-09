import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dismissFounderCheckNotice, useFounderCheckNotice } from "../lib/founderCheck";
import { VerifiedMark } from "./VerifiedMark";

export function FounderCheckNotice() {
  const insets = useSafeAreaInsets();
  const notice = useFounderCheckNotice();
  if (!notice) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, zIndex: 121 }}>
      <View style={{ backgroundColor: "#1A1915", borderColor: "#D6E27A", borderWidth: 1, borderRadius: 18, padding: 16, shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <VerifiedMark size={22} tone="lime" />
          <Text style={{ color: "#D6E27A", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>VERIFIED</Text>
        </View>
        <Text style={{ color: "#F4F0E6", fontSize: 17, fontWeight: "700", marginTop: 8 }}>{notice.name} has the green check</Text>
        <Text style={{ color: "rgba(244,240,230,0.62)", fontSize: 13, lineHeight: 19, marginTop: 4 }}>
          Two sales. Anyone looking at your name will see it.
        </Text>
        <Pressable onPress={() => dismissFounderCheckNotice()} style={{ marginTop: 14, height: 42, borderRadius: 21, backgroundColor: "#D6E27A", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#16140F", fontWeight: "800", fontSize: 13 }}>Got it</Text>
        </Pressable>
      </View>
    </View>
  );
}
