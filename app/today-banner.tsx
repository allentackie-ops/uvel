import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { TodayBannerStoryPage } from "../components/TodayBannerStoryPage";
import { TrendingNowPage } from "../components/TrendingNowPage";
import { useColors } from "../lib/theme";
import { getTodayBannerStory, releaseTodayBannerStory } from "../lib/todayBannerStories";
import { recordReviewListingView } from "../lib/appReview";

export default function TodayBannerRoute() {
  const colors = useColors();
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] ?? "" : rawId ?? "";
  const story = useMemo(() => getTodayBannerStory(id), [id]);

  useEffect(() => () => releaseTodayBannerStory(id), [id]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  if (!story) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, paddingTop: 56, paddingHorizontal: 20 }}>
        <Pressable onPress={goBack} hitSlop={12} style={{ width: 44, height: 44, justifyContent: "center" }} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.bone} />
        </Pressable>
        <Text style={{ color: colors.bone, fontSize: 20, fontWeight: "800", marginTop: 20 }}>This edit is no longer available.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      {story.id === "trending-now" ? (
        <TrendingNowPage story={story} onClose={goBack} />
      ) : (
        <TodayBannerStoryPage
          story={story}
          onClose={goBack}
          onOpenPiece={(piece) => {
            void recordReviewListingView();
            router.push({ pathname: "/closet/[id]", params: { id: piece.id, v: "buy", source: "today-banner" } });
          }}
        />
      )}
    </View>
  );
}
