import { useEffect } from "react";
import { router } from "expo-router";

/** Legal brand filing is parked. Founders use Founder Studio. Established houses will use this later from the website. */
export default function BrandApply() {
  useEffect(() => {
    router.replace("/brand/founder");
  }, []);
  return null;
}
