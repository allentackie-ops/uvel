import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createFounderBoard, getFounderProject, updateFounderProject, useFounderProjects, type FounderStage } from "../../../lib/founder";
import { useColors, type Colors } from "../../../lib/theme";
import { FounderLaunchReview, FounderProductEditor, FounderProductionWorkspace, FounderSetupHub, FounderStrategy, SketchBoard, make } from "./../founder";

type JourneyStage = FounderStage | "production";
const JOURNEY: JourneyStage[] = ["idea", "identity", "design", "product", "source", "production", "launch"];
const TITLES: Record<JourneyStage, { kicker: string; title: string; body: string }> = {
  idea: { kicker: "01 · THE IDEA", title: "Make the idea specific.", body: "Start with the person, promise, and story behind your label." },
  identity: { kicker: "02 · IDENTITY", title: "Give the idea a direction.", body: "Choose the visual language that can carry the brand forward." },
  design: { kicker: "03 · DESIGN", title: "Put the first silhouette on a board.", body: "Sketch freely or collect references. Nothing has to be final yet." },
  product: { kicker: "04 · FIRST PRODUCT", title: "Turn the direction into one piece.", body: "Describe the first product clearly enough to discuss it with a maker." },
  source: { kicker: "05 · FOUNDATIONS", title: "Set up the parts around the product.", body: "Review the digital, payment, shipping, and policy decisions ahead." },
  production: { kicker: "06 · PRODUCTION", title: "Make the first run tangible.", body: "Compare supplier leads, track samples, and map production milestones." },
  launch: { kicker: "07 · READY", title: "Know what is ready before you apply.", body: "Review the private work before opening the separate public application." },
};
type JourneyColors = Colors & { card: string; lineColor: string; accent: string; accentInk: string };

export default function FounderStagePage() {
  const { stage: rawStage, id } = useLocalSearchParams<{ stage?: string; id?: string }>();
  const { projects, hydrated } = useFounderProjects();
  const palette = useColors();
  const colors: JourneyColors = { ...palette, ink: palette.bone, card: palette.surface, lineColor: palette.subtle, accent: palette.success, accentInk: palette.successInk };
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const project = getFounderProject(id) || projects[0];
  const stage = (JOURNEY.includes(rawStage as JourneyStage) ? rawStage : project?.stage || "idea") as JourneyStage;
  const index = JOURNEY.indexOf(stage);
  const [boardId, setBoardId] = useState("");
  const board = project?.boards.find((item) => item.id === boardId) || project?.boards[0];
  useEffect(() => { if (project && stage !== "production" && project.stage !== stage && stage !== "launch") updateFounderProject(project.id, { stage: stage as FounderStage }); }, [project?.id, stage]);
  const title = TITLES[stage];
  const next = () => {
    if (!project || index >= JOURNEY.length - 1) return;
    const nextStage = JOURNEY[index + 1];
    updateFounderProject(project.id, { stage: nextStage === "production" ? "source" : nextStage as FounderStage });
    router.push({ pathname: "/brand/founder/[stage]", params: { id: project.id, stage: nextStage } });
  };
  const back = () => index > 0 ? router.back() : router.replace("/brand/founder");
  const createBoard = () => { if (!project) return; const created = createFounderBoard(project.id, "sketch"); setBoardId(created.id); };
  if (!hydrated || !project) return <View style={[local.page, { backgroundColor: palette.ink, paddingTop: insets.top + 24 }]}><Text style={{ color: palette.muted }}>Loading your studio…</Text></View>;
  return <View style={[local.page, { backgroundColor: palette.ink }]}> 
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 42 }} keyboardShouldPersistTaps="handled">
      <View style={local.progress}>
<Text style={[local.progressCount, { color: palette.success }]}>{String(index + 1).padStart(2, "0")} / {String(JOURNEY.length).padStart(2, "0")}</Text><View style={local.progressLine}>{JOURNEY.map((item, itemIndex) => <View key={item} style={[local.progressDot, { backgroundColor: itemIndex <= index ? palette.success : palette.subtle }]} />)}</View></View>
      <View style={local.hero}><Text style={[styles.kicker, { color: colors.accent }]}>{title.kicker}</Text><Text style={[styles.title, { color: colors.ink }]}>{title.title}</Text><Text style={[styles.lede, { color: colors.muted }]}>{title.body}</Text></View>
      <View style={local.content}>
        {stage === "idea" || stage === "identity" ? <FounderStrategy project={project} colors={colors} /> : null}
        {stage === "design" ? <View style={styles.editor}><Text style={styles.cardTitle}>A board for the first direction</Text><Text style={styles.cardBody}>Draw a rough silhouette or keep a visual reference board. You can come back and change it.</Text>{board ? <SketchBoard board={board} projectId={project.id} colors={colors} /> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No board yet</Text><Text style={styles.empty}>Create a sketch canvas to begin.</Text></View>}<Pressable onPress={createBoard} style={styles.primary}><Text style={styles.primaryText}>{board ? "Create another sketch" : "Create sketch canvas"}</Text></Pressable></View> : null}
        {stage === "product" ? <FounderProductEditor project={project} colors={colors} /> : null}
        {stage === "source" ? <FounderSetupHub project={project} colors={colors} /> : null}
        {stage === "production" ? <FounderProductionWorkspace project={project} colors={colors} /> : null}
        {stage === "launch" ? <FounderLaunchReview project={project} colors={colors} /> : null}
        {stage !== "launch" ? <Pressable onPress={next} style={styles.primary} accessibilityRole="button"><Text style={styles.primaryText}>{stage === "production" ? "Continue to launch readiness" : "Save & continue"}</Text></Pressable> : null}
        {stage !== "idea" ? <Pressable onPress={back} style={styles.secondary}><Text style={styles.secondaryText}>Back</Text></Pressable> : null}
        {stage === "launch" ? <Text style={styles.handoffHint}>Your private work stays private until you choose to submit a separate public application.</Text> : <Text style={styles.saveHint}>Your progress saves locally as you work.</Text>}
      </View>
    </ScrollView>
  </View>;
}

const local = StyleSheet.create({
  page: { flex: 1 }, top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 8 }, back: { fontSize: 36, lineHeight: 38 }, topTitle: { fontSize: 17, fontWeight: "700" }, progress: { paddingHorizontal: 20, paddingTop: 6 }, progressCount: { fontSize: 11, fontWeight: "900", letterSpacing: 1.4 }, progressLine: { flexDirection: "row", gap: 6, marginTop: 10 }, progressDot: { height: 4, flex: 1, borderRadius: 2 }, hero: { padding: 20, paddingTop: 24, paddingBottom: 22 }, content: { paddingHorizontal: 20 } });
