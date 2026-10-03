import { Stack, useLocalSearchParams } from "expo-router";
import Mirror from "./(tabs)/find";

export default function MirrorPage() {
  const params = useLocalSearchParams<{ jobId?: string | string[] }>();
  const jobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: "slide_from_right", gestureEnabled: true, contentStyle: { backgroundColor: "#0B0A08" } }} />
      <Mirror standalone initialJobId={jobId} />
    </>
  );
}
