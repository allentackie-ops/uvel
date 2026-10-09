import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dismissFounderDeskNotice, founderDeskRoute, useFounderDeskJob } from "../lib/founderDesk";

export function FounderDeskNotice() {
  const insets = useSafeAreaInsets();
  const job = useFounderDeskJob();
  if (!job?.notice) return null;
  const accepted = job.notice === "accepted";
  const rejected = job.notice === "rejected";
  const title = accepted ? `${job.name} is on Uvel` : rejected ? `We couldn’t take ${job.name}` : `${job.name} is in review`;
  const body = accepted
    ? "Open Brand HQ to dress the page."
    : rejected
      ? job.headline || "See why, then send again."
      : "We’ll let you know when the review is done.";
  const action = accepted ? "Open Brand HQ" : rejected ? "See why" : "Got it";
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, zIndex: 120 }}>
      <View style={{ backgroundColor: "#1A1915", borderColor: "#D6E27A", borderWidth: 1, borderRadius: 18, padding: 16, shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}>
        <Text style={{ color: "#D6E27A", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>{accepted ? "ACCEPTED" : rejected ? "NEEDS A CHANGE" : "IN REVIEW"}</Text>
        <Text style={{ color: "#F4F0E6", fontSize: 17, fontWeight: "700", marginTop: 6 }}>{title}</Text>
        <Text style={{ color: "rgba(244,240,230,0.62)", fontSize: 13, lineHeight: 19, marginTop: 4 }}>{body}</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Pressable onPress={() => dismissFounderDeskNotice()} style={{ flex: 1, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "rgba(244,240,230,0.2)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#F4F0E6", fontWeight: "700", fontSize: 13 }}>{accepted || rejected ? "Later" : "Got it"}</Text>
          </Pressable>
          {accepted || rejected ? (
            <Pressable
              onPress={() => {
                const route = founderDeskRoute(job);
                dismissFounderDeskNotice();
                router.push(route);
              }}
              style={{ flex: 1.2, height: 42, borderRadius: 21, backgroundColor: "#D6E27A", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: "#16140F", fontWeight: "800", fontSize: 13 }}>{action}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
