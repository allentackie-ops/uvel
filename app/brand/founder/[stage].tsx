import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { appendFounderReference, createFounderBoard, getFounderProject, ideaReady, pieceReady, simpleStageOf, updateFounderProject, useFounderProjects } from "../../../lib/founder";
import { pickFromLibrary, saveFounderPhotoReference } from "../../../lib/photo";
import { brandApproved, ownedBrand, useBrands } from "../../../lib/brands";
import { useUvel } from "../../../lib/store";
import { useColors, type Colors } from "../../../lib/theme";
import { FounderLaunchReview, FounderProductEditor, FounderStrategy, SketchBoard, make } from "./../founder";

const JOURNEY = ["idea", "product", "launch"] as const;
type JourneyStage = (typeof JOURNEY)[number];
const TITLES: Record<JourneyStage, { kicker: string; title: string; body: string }> = {
  idea: { kicker: "01 · IDEA", title: "What’s the label?", body: "A name and who it’s for. That’s enough to start." },
  product: { kicker: "02 · MAKE IT", title: "One piece.", body: "A photo, a name, and a category. Not a factory." },
  launch: { kicker: "03 · READY", title: "Apply when this is true.", body: "Name + a piece. After you’re accepted, Brand HQ is shop, orders, and money." },
};
type JourneyColors = Colors & { card: string; lineColor: string; accent: string; accentInk: string };

export default function FounderStagePage() {
  const { stage: rawStage, id } = useLocalSearchParams<{ stage?: string; id?: string }>();
  const { projects, hydrated } = useFounderProjects();
  const palette = useColors();
  const colors: JourneyColors = { ...palette, ink: palette.bone, card: palette.surface, lineColor: palette.subtle, accent: palette.success, accentInk: palette.successInk };
  const styles = make(colors);
  const insets = useSafeAreaInsets();
  const app = useUvel();
  useBrands();
  const mine = ownedBrand(app.uid);
  const project = getFounderProject(id) || projects[0];
  const stage = simpleStageOf(String(rawStage || project?.stage || "idea")) as JourneyStage;
  const index = JOURNEY.indexOf(stage);
  const [boardId, setBoardId] = useState("");
  const board = project?.boards.find((item) => item.id === boardId) || project?.boards[0];
  useEffect(() => {
    if (!project) return;
    if (project.stage !== stage && (stage === "idea" || stage === "product" || stage === "launch")) {
      updateFounderProject(project.id, { stage });
    }
  }, [project?.id, stage]);

  const goTo = (nextStage: JourneyStage) => {
    if (!project) return;
    updateFounderProject(project.id, { stage: nextStage });
    router.replace({ pathname: "/brand/founder/[stage]", params: { id: project.id, stage: nextStage } });
  };
  const next = () => {
    if (!project) return;
    if (stage === "idea" && !ideaReady(project)) {
      Alert.alert("Name it first", "A name and who it’s for.");
      return;
    }
    if (stage === "product" && !pieceReady(project)) {
      Alert.alert("One piece first", "Give the piece a name and a category.");
      return;
    }
    if (index >= JOURNEY.length - 1) return;
    goTo(JOURNEY[index + 1]);
  };
  const headerBack = () => {
    if (index > 0) {
      goTo(JOURNEY[index - 1]);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/brand/founder");
  };
  const createBoard = () => {
    if (!project) return;
    const created = createFounderBoard(project.id, "sketch");
    setBoardId(created.id);
  };
  async function addPhoto() {
    if (!project) return;
    try {
      const uri = await pickFromLibrary();
      if (!uri) return;
      const saved = await saveFounderPhotoReference(uri);
      const target = board || createFounderBoard(project.id, "moodboard", "First piece");
      appendFounderReference(project.id, target.id, saved);
      setBoardId(target.id);
    } catch (error) {
      Alert.alert("Photo", error instanceof Error ? error.message : "Couldn’t add that photo.");
    }
  }

  if (!hydrated || !project) {
    return (
      <View style={[local.page, { backgroundColor: palette.ink, paddingTop: insets.top + 24 }]}>
        <Text style={{ color: palette.muted, paddingHorizontal: 20 }}>Loading your studio…</Text>
      </View>
    );
  }

  const title = TITLES[stage];
  const photo = board?.references[0] || board?.imports.find((item) => item.kind === "image")?.uri;

  return (
    <View style={[local.page, { backgroundColor: palette.ink }]}>
      <View style={[local.top, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={headerBack} hitSlop={16} style={local.backBtn} accessibilityRole="button" accessibilityLabel={index > 0 ? "Back to previous step" : "Close studio"}>
          <Text style={[local.back, { color: palette.bone }]}>‹</Text>
        </Pressable>
        <Text style={[local.topTitle, { color: palette.bone }]}>Founder Studio</Text>
        <View style={local.backBtn} />
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 36 }} keyboardShouldPersistTaps="handled">
        <View style={local.progress}>
          <Text style={[local.progressCount, { color: palette.success }]}>{String(index + 1).padStart(2, "0")} / 03</Text>
          <View style={local.progressLine}>
            {JOURNEY.map((item, itemIndex) => (
              <Pressable
                key={item}
                onPress={() => { if (itemIndex <= index) goTo(item); }}
                style={[local.progressDot, { backgroundColor: itemIndex <= index ? palette.success : palette.subtle }]}
                accessibilityRole="button"
                accessibilityLabel={TITLES[item].kicker}
              />
            ))}
          </View>
        </View>
        {brandApproved(mine) ? (
          <Pressable
            onPress={() => router.push({ pathname: "/brand/hq", params: { id: mine.id } })}
            style={[local.live, { borderColor: palette.success }]}
          >
            <Text style={[local.liveKicker, { color: palette.success }]}>YOUR BRAND IS ON UVEL</Text>
            <Text style={[styles.cardTitle, { color: colors.ink }]}>{mine.name}</Text>
            <Text style={[styles.cardBody, { color: colors.muted, marginBottom: 0 }]}>Shop, orders, inventory, and money live in Brand HQ.</Text>
          </Pressable>
        ) : null}
        <View style={local.hero}>
          <Text style={[styles.kicker, { color: colors.accent }]}>{title.kicker}</Text>
        </View>
        <View style={local.content}>
          {stage === "idea" ? <FounderStrategy project={project} colors={colors} /> : null}
          {stage === "product" ? (
            <>
              <FounderProductEditor project={project} colors={colors} />
              <View style={styles.editor}>
                <Text style={styles.cardTitle}>Photo or sketch</Text>
                <Text style={styles.cardBody}>Optional. One still of the piece is enough.</Text>
                {photo ? <Image source={{ uri: photo }} style={local.photo} contentFit="cover" /> : null}
                {board && board.kind === "sketch" ? <SketchBoard board={board} projectId={project.id} colors={colors} /> : null}
                <Pressable onPress={() => void addPhoto()} style={[local.ghost, { borderColor: palette.subtle }]}><Text style={[styles.secondaryText, { color: palette.bone }]}>{photo ? "Replace photo" : "Add a photo"}</Text></Pressable>
                <Pressable onPress={createBoard} style={styles.secondary}><Text style={styles.secondaryText}>{board ? "New sketch" : "Sketch instead"}</Text></Pressable>
              </View>
            </>
          ) : null}
          {stage === "launch" ? <FounderLaunchReview project={project} colors={colors} /> : null}
          {stage !== "launch" ? (
            <Pressable onPress={next} style={styles.primary} accessibilityRole="button">
              <Text style={styles.primaryText}>{stage === "idea" ? "Make the first piece" : "This is enough"}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  page: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 4 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  back: { fontSize: 36, lineHeight: 38, fontWeight: "300" },
  topTitle: { fontSize: 17, fontWeight: "700" },
  progress: { paddingHorizontal: 20, paddingTop: 4 },
  progressCount: { fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  progressLine: { flexDirection: "row", gap: 6, marginTop: 10 },
  progressDot: { height: 4, flex: 1, borderRadius: 2 },
  hero: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  content: { paddingHorizontal: 20 },
  photo: { width: "100%", height: 220, borderRadius: 16, marginBottom: 10, backgroundColor: "#161512" },
  live: { marginHorizontal: 20, marginTop: 12, borderWidth: 1, borderRadius: 18, padding: 16 },
  liveKicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginBottom: 6 },
  ghost: { height: 50, borderRadius: 25, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 14 },
});
