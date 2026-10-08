import { router } from "expo-router";
import { TrendingNowPage } from "../components/TrendingNowPage";

export default function TrendingRoute() {
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  return <TrendingNowPage onClose={goBack} />;
}
