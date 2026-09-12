import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getFounderDeskJob, startFounderDesk, useFounderDeskJob } from "../../lib/founderDesk";
import { getFounderProject } from "../../lib/founder";
import { useUvel } from "../../lib/store";
import { useColors } from "../../lib/theme";

export default function FounderDecision() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const app = useUvel();
  const { id } = useLocalSearchParams<{ id?: string }>();
  useFounderDeskJob();
  const job = getFounderDeskJob();
  const name = job?.name || "the label";
  const reasons = job?.reasons?.length ? job.reasons : ["Change the name or the picture, then send again."];
  const nameIssue = reasons.some((reason) => /name|trademark|handle|label|uspto/i.test(reason));
  const pictureIssue = reasons.some((reason) => /picture|photo|logo|image|mark|screenshot/i.test(reason));
  const styles = make(colors);

  async function resubmit() {
    if (!job || !app.uid) return;
    const project = getFounderProject(job.projectId);
    if (!project) {
      router.replace("/brand/founder");
      return;
    }
    await startFounderDesk({
      project,
      uid: app.uid,
      displayName: app.displayName || "Owner",
      avatarUri: app.avatarUri || app.personUri,
      country: app.country,
    });
    router.replace("/");
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top + 6 }]}>
      <Pressable onPress={() => router.replace("/")} hitSlop={12} style={styles.back}>
        <Text style={styles.backTxt}>‹</Text>
      </Pressable>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>NOT THIS TIME</Text>
        <Text style={styles.title}>{job?.headline || `We couldn’t take ${name}`}</Text>
        <Text style={styles.lede}>Fix what’s below, then send it again. The desk looks at the name, the pictures, and replica language.</Text>
        {reasons.map((reason) => (
          <View key={reason} style={styles.reason}>
            <Text style={styles.reasonTxt}>{reason}</Text>
          </View>
        ))}
        {nameIssue ? (
          <Pressable onPress={() => router.push({ pathname: "/brand/founder/[stage]", params: { id: job?.projectId || "", stage: "idea" } })} style={styles.primary}>
            <Text style={styles.primaryTxt}>Change the name</Text>
          </Pressable>
        ) : null}
        {pictureIssue ? (
          <Pressable onPress={() => router.push({ pathname: "/brand/founder/[stage]", params: { id: job?.projectId || "", stage: "product" } })} style={styles.ghost}>
            <Text style={styles.ghostTxt}>Change the picture</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => void resubmit()} style={nameIssue || pictureIssue ? styles.ghost : styles.primary}>
          <Text style={nameIssue || pictureIssue ? styles.ghostTxt : styles.primaryTxt}>Send again</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function make(colors: { ink: string; bone: string; muted: string; surface: string; success: string; successInk: string }) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.ink },
    back: { width: 44, height: 44, marginLeft: 8, alignItems: "center", justifyContent: "center" },
    backTxt: { color: colors.bone, fontSize: 34, lineHeight: 36, marginTop: -4 },
    kicker: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1.8, marginTop: 8 },
    title: { color: colors.bone, fontFamily: "Georgia", fontSize: 34, lineHeight: 38, marginTop: 10 },
    lede: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 18 },
    reason: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 8 },
    reasonTxt: { color: colors.bone, fontSize: 15, lineHeight: 21 },
    primary: { height: 52, borderRadius: 26, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginTop: 16 },
    primaryTxt: { color: colors.successInk, fontWeight: "800", fontSize: 15 },
    ghost: { height: 52, borderRadius: 26, borderWidth: 1, borderColor: "rgba(244,240,230,0.16)", alignItems: "center", justifyContent: "center", marginTop: 10 },
    ghostTxt: { color: colors.bone, fontWeight: "800", fontSize: 15 },
  });
}
