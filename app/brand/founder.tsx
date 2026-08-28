import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { pickFromLibrary } from "../../lib/photo";
import { appendFounderReference, createFounderBoard, createFounderProject, getFounderProject, updateFounderBoard, useFounderProjects, type FounderBoard, type FounderPoint, type FounderProject, type FounderStage, type FounderStroke } from "../../lib/founder";
import { useColors, type Colors } from "../../lib/theme";

const STAGES: FounderStage[] = ["idea", "identity", "design", "product", "source", "launch"];
const STAGE_LABELS: Record<FounderStage, string> = { idea: "Idea", identity: "Identity", design: "Design", product: "Product", source: "Source", launch: "Launch" };
const SWATCHES = ["#D6E27A", "#F4F0E6", "#161512", "#B77457", "#6D8795"];
type FounderColors = Colors & { card: string; lineColor: string; accent: string; accentInk: string };
const strokeStyle = { position: "absolute" as const };

function lineStyle(a: FounderPoint, b: FounderPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  return { left: a.x, top: a.y, width: length, transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] };
}

function StrokeLines({ stroke }: { stroke: FounderStroke }) {
  return <>{stroke.points.slice(1).map((point, index) => <View key={`${stroke.id}-${index}`} pointerEvents="none" style={[strokeStyle, lineStyle(stroke.points[index], point), { backgroundColor: stroke.color, height: stroke.width }]} />)}</>;
}

function SketchBoard({ board, projectId, colors }: { board: FounderBoard; projectId: string; colors: FounderColors }) {
  const styles = make(colors);
  const [active, setActive] = useState<FounderPoint[]>([]);
  const [selected, setSelected] = useState(board.colors[0] || SWATCHES[0]);
  const start = useRef<FounderPoint | null>(null);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      start.current = point;
      setActive([point]);
    },
    onPanResponderMove: (event) => {
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      setActive((points) => [...points, point]);
    },
    onPanResponderRelease: () => {
      setActive((points) => {
        if (points.length > 1) {
          const stroke: FounderStroke = { id: `stroke-${Date.now()}`, color: selected, width: 4, points };
          updateFounderBoard(projectId, board.id, { strokes: [...board.strokes, stroke] });
        }
        start.current = null;
        return [];
      });
    },
    onPanResponderTerminate: () => setActive([]),
  }), [board.id, board.strokes, projectId, selected]);

  return (
    <View>
      <View style={[styles.canvas, { backgroundColor: colors.card, borderColor: colors.lineColor }]} {...pan.panHandlers}>
        <Text pointerEvents="none" style={[styles.canvasHint, { color: colors.muted }]}>Draw a rough silhouette or annotate an idea</Text>
        {board.strokes.map((stroke) => <StrokeLines key={stroke.id} stroke={stroke} />)}
        {active.length > 1 ? <StrokeLines stroke={{ id: "active", color: selected, width: 4, points: active }} /> : null}
      </View>
      <View style={styles.toolRow}>
        {SWATCHES.map((swatch) => <Pressable key={swatch} onPress={() => setSelected(swatch)} style={[styles.swatch, { backgroundColor: swatch, borderColor: selected === swatch ? colors.ink : colors.lineColor }]} accessibilityLabel={`Use ${swatch} drawing color`} />)}
        <Pressable onPress={() => updateFounderBoard(projectId, board.id, { strokes: [] })} style={[styles.toolButton, { borderColor: colors.lineColor }]}><Text style={[styles.toolText, { color: colors.ink }]}>Clear</Text></Pressable>
      </View>
    </View>
  );
}

function BoardCard({ board, projectId, colors, onOpen }: { board: FounderBoard; projectId: string; colors: FounderColors; onOpen: () => void }) {
  const styles = make(colors);
  return <Pressable onPress={onOpen} style={[styles.boardCard, { backgroundColor: colors.card, borderColor: colors.lineColor }]}>
    <View style={[styles.boardPreview, { backgroundColor: colors.ink }]}>
      {board.kind === "sketch" && board.strokes.length ? <StrokeLines stroke={board.strokes[0]} /> : <View style={[styles.previewDot, { backgroundColor: board.colors[0] || colors.accent }]} />}
    </View>
    <View style={{ flex: 1 }}><Text style={[styles.boardKind, { color: colors.muted }]}>{board.kind === "sketch" ? "SKETCH" : "MOODBOARD"}</Text><Text style={[styles.boardName, { color: colors.ink }]} numberOfLines={1}>{board.name}</Text><Text style={[styles.boardMeta, { color: colors.muted }]}>{board.references.length} references · {board.strokes.length} strokes</Text></View>
  </Pressable>;
}

export default function FounderStudio() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { projects, hydrated } = useFounderProjects();
  const palette = useColors();
  const colors: FounderColors = { ...palette, ink: palette.bone, card: palette.surface, lineColor: palette.subtle, accent: palette.success, accentInk: palette.successInk };
  const stylesFor = make(colors);
  const insets = useSafeAreaInsets();
  const width = useWindowDimensions().width;
  const [selectedId, setSelectedId] = useState(id || projects[0]?.id || "");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [boardId, setBoardId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const project = getFounderProject(selectedId) || projects[0];
  const board = project?.boards.find((item) => item.id === boardId) || project?.boards[0];
  const canvasWidth = Math.min(Math.max(width - 40, 280), 520);

  function createProject() {
    if (!projectName.trim()) { Alert.alert("Name your project", "Give your first fashion idea a working name."); return; }
    const created = createFounderProject(projectName, projectDescription);
    setSelectedId(created.id);
    setProjectName("");
    setProjectDescription("");
    setShowCreate(false);
  }

  function newBoard(kind: "moodboard" | "sketch") {
    if (!project) return;
    const created = createFounderBoard(project.id, kind);
    setBoardId(created.id);
  }

  async function addReference() {
    if (!project || !board) return;
    try {
      const uri = await pickFromLibrary();
      if (uri) appendFounderReference(project.id, board.id, uri);
    } catch (error) {
      Alert.alert("Photo unavailable", error instanceof Error ? error.message : "We could not add that reference.");
    }
  }

  if (!hydrated) return <View style={[stylesFor.page, { backgroundColor: palette.ink, paddingTop: insets.top + 24 }]}><Text style={stylesFor.muted}>Loading your studio…</Text></View>;

  return <View style={[stylesFor.page, { backgroundColor: palette.ink }]}>

    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48 }} keyboardShouldPersistTaps="handled">
      <View style={stylesFor.top}><Pressable onPress={() => router.back()} hitSlop={12}><Text style={stylesFor.back}>‹</Text></Pressable><Text style={stylesFor.topTitle}>Founder Studio</Text><View style={{ width: 36 }} /></View>
      <View style={stylesFor.hero}><Text style={stylesFor.kicker}>PRIVATE WORKSPACE</Text><Text style={stylesFor.title}>Start with the idea.</Text><Text style={stylesFor.lede}>Shape your first fashion direction before it becomes a public brand.</Text></View>

      {projects.length > 0 ? <View style={{ paddingHorizontal: 20 }}><Text style={stylesFor.sectionLabel}>YOUR PROJECTS</Text>{projects.map((item: FounderProject) => <Pressable key={item.id} onPress={() => { setSelectedId(item.id); setBoardId(""); }} style={[stylesFor.projectPicker, item.id === project?.id && stylesFor.projectPickerOn]}><View style={{ flex: 1 }}><Text style={stylesFor.projectName}>{item.name}</Text><Text style={stylesFor.projectMeta}>{item.boards.length} saved boards · {STAGE_LABELS[item.stage]}</Text></View><Text style={stylesFor.chevron}>{item.id === project?.id ? "●" : "○"}</Text></Pressable>)}</View> : null}

      {!project || showCreate ? <View style={stylesFor.createCard}><Text style={stylesFor.cardTitle}>Create a private project</Text><Text style={stylesFor.cardBody}>This stays private on your device for now. It is not a public brand or a verification application.</Text><TextInput value={projectName} onChangeText={setProjectName} placeholder="Working name" placeholderTextColor={colors.muted} style={stylesFor.input} /><TextInput value={projectDescription} onChangeText={setProjectDescription} placeholder="What are you imagining?" placeholderTextColor={colors.muted} style={[stylesFor.input, { height: 76, textAlignVertical: "top", paddingTop: 14 }]} multiline /><Pressable onPress={createProject} style={stylesFor.primary}><Text style={stylesFor.primaryText}>Create project</Text></Pressable>{project ? <Pressable onPress={() => setShowCreate(false)} style={stylesFor.secondary}><Text style={stylesFor.secondaryText}>Cancel</Text></Pressable> : null}</View> : <View style={{ paddingHorizontal: 20 }}>
        <View style={stylesFor.progressCard}><View style={{ flex: 1 }}><Text style={stylesFor.sectionLabel}>CURRENT STAGE</Text><Text style={stylesFor.progressTitle}>{project.stage === "design" ? "Design your direction" : "Capture the idea"}</Text><Text style={stylesFor.progressBody}>A saved board is a real step forward. Nothing here is treated as a business claim or a finished production spec.</Text></View><Text style={stylesFor.progressCount}>{Math.max(1, STAGES.indexOf(project.stage) + 1)}/{STAGES.length}</Text></View>
        <View style={stylesFor.stageRow}>{STAGES.map((stage, index) => <View key={stage} style={stylesFor.stageItem}><View style={[stylesFor.stageDot, index <= STAGES.indexOf(project.stage) && stylesFor.stageDotOn]} /><Text style={stylesFor.stageText}>{STAGE_LABELS[stage]}</Text></View>)}</View>
        <Text style={stylesFor.sectionLabel}>MAKE A BOARD</Text>
        <View style={stylesFor.actionRow}><Pressable onPress={() => newBoard("moodboard")} style={stylesFor.actionCard}><Text style={stylesFor.actionIcon}>＋</Text><Text style={stylesFor.actionTitle}>Moodboard</Text><Text style={stylesFor.actionBody}>Collect visual direction and color.</Text></Pressable><Pressable onPress={() => newBoard("sketch")} style={stylesFor.actionCard}><Text style={stylesFor.actionIcon}>✎</Text><Text style={stylesFor.actionTitle}>Sketch canvas</Text><Text style={stylesFor.actionBody}>Draw the first silhouette.</Text></Pressable></View>
        {board ? <View style={stylesFor.editor}><View style={stylesFor.editorHead}><View style={{ flex: 1 }}><Text style={stylesFor.sectionLabel}>{board.kind === "sketch" ? "SKETCH CANVAS" : "MOODBOARD"}</Text><TextInput value={board.name} onChangeText={(name) => updateFounderBoard(project.id, board.id, { name })} style={stylesFor.boardTitleInput} placeholder="Name this board" placeholderTextColor={colors.muted} /></View><Pressable onPress={addReference} style={stylesFor.smallButton}><Text style={stylesFor.smallButtonText}>＋ Photo</Text></Pressable></View>
          {board.kind === "sketch" ? <SketchBoard board={board} projectId={project.id} colors={colors} /> : <View style={stylesFor.moodboard}><View style={stylesFor.moodColors}>{board.colors.map((swatch) => <View key={swatch} style={[stylesFor.moodColor, { backgroundColor: swatch }]} />)}</View><TextInput value={board.notes} onChangeText={(notes) => updateFounderBoard(project.id, board.id, { notes })} placeholder="What should this collection feel like?" placeholderTextColor={colors.muted} multiline style={stylesFor.noteInput} />{board.references.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>{board.references.map((uri) => <Image key={uri} source={{ uri }} style={stylesFor.reference} contentFit="cover" />)}</ScrollView> : <Text style={stylesFor.empty}>Add a photo reference to start the board.</Text>}</View>}
          {board.kind === "sketch" && board.references.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginTop: 12 }}>{board.references.map((uri) => <Image key={uri} source={{ uri }} style={stylesFor.reference} contentFit="cover" />)}</ScrollView> : null}
          <Text style={stylesFor.saveHint}>Saved locally as you work · {Math.round(canvasWidth)}px workspace</Text>
        </View> : <View style={stylesFor.emptyCard}><Text style={stylesFor.emptyTitle}>Your first board goes here.</Text><Text style={stylesFor.empty}>Choose a moodboard or sketch canvas above. Your work stays private until you choose to use it.</Text></View>}
        <Pressable onPress={() => setShowCreate(true)} style={stylesFor.addProject}><Text style={stylesFor.secondaryText}>＋ Start another project</Text></Pressable>
      </View>}
    </ScrollView>
  </View>;
}

const make = (colors: FounderColors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink }, muted: { color: colors.muted, paddingHorizontal: 20 }, top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 10 }, back: { color: colors.ink, fontSize: 36, lineHeight: 38 }, topTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" }, hero: { padding: 20, paddingTop: 22, paddingBottom: 28 }, kicker: { color: colors.accent, fontSize: 11, letterSpacing: 2.5, fontWeight: "800" }, title: { color: colors.ink, fontFamily: "Georgia", fontSize: 34, marginTop: 12 }, lede: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 8, maxWidth: 440 }, sectionLabel: { color: colors.muted, fontSize: 11, letterSpacing: 1.8, fontWeight: "800", marginBottom: 9 }, projectPicker: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.lineColor, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 8 }, projectPickerOn: { borderColor: colors.accent }, projectName: { color: colors.ink, fontSize: 16, fontWeight: "800" }, projectMeta: { color: colors.muted, fontSize: 12, marginTop: 4 }, chevron: { color: colors.accent, fontSize: 14 }, createCard: { margin: 20, backgroundColor: colors.card, borderColor: colors.lineColor, borderWidth: 1, borderRadius: 22, padding: 18 }, cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" }, cardBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 14 }, input: { borderWidth: 1, borderColor: colors.lineColor, backgroundColor: colors.ink, color: colors.ink, borderRadius: 14, paddingHorizontal: 14, height: 50, marginTop: 10, fontSize: 16 }, primary: { height: 50, borderRadius: 25, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginTop: 14 }, primaryText: { color: colors.accentInk, fontWeight: "900", fontSize: 15 }, secondary: { alignItems: "center", padding: 13 }, secondaryText: { color: colors.ink, fontWeight: "800", fontSize: 14 }, progressCard: { backgroundColor: colors.card, borderRadius: 20, padding: 16, flexDirection: "row", borderWidth: 1, borderColor: colors.lineColor }, progressTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" }, progressBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }, progressCount: { color: colors.accent, fontSize: 22, fontWeight: "900" }, stageRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 18 }, stageItem: { alignItems: "center", gap: 5 }, stageDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lineColor }, stageDotOn: { backgroundColor: colors.accent }, stageText: { color: colors.muted, fontSize: 10 }, actionRow: { flexDirection: "row", gap: 10, marginBottom: 20 }, actionCard: { flex: 1, backgroundColor: colors.card, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: colors.lineColor, minHeight: 130 }, actionIcon: { color: colors.accent, fontSize: 28 }, actionTitle: { color: colors.ink, fontWeight: "800", fontSize: 15, marginTop: 7 }, actionBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }, editor: { backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.lineColor }, editorHead: { flexDirection: "row", alignItems: "center", marginBottom: 10 }, boardTitleInput: { color: colors.ink, fontSize: 21, fontWeight: "800", paddingVertical: 0 }, smallButton: { borderWidth: 1, borderColor: colors.lineColor, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 }, smallButtonText: { color: colors.ink, fontWeight: "800", fontSize: 12 }, canvas: { height: 430, borderRadius: 16, borderWidth: 1, overflow: "hidden", position: "relative" }, canvasHint: { position: "absolute", top: 16, left: 16, fontSize: 12 }, stroke: { position: "absolute", borderRadius: 4, transformOrigin: "left center" as never }, toolRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 10 }, swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2 }, toolButton: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginLeft: "auto" }, toolText: { fontSize: 12, fontWeight: "800" }, moodboard: { minHeight: 230 }, moodColors: { flexDirection: "row", gap: 10, marginVertical: 14 }, moodColor: { height: 52, flex: 1, borderRadius: 13 }, noteInput: { minHeight: 86, color: colors.ink, fontSize: 15, lineHeight: 21, padding: 0, textAlignVertical: "top" }, reference: { width: 112, height: 140, borderRadius: 14, backgroundColor: colors.ink }, empty: { color: colors.muted, fontSize: 13, lineHeight: 19 }, saveHint: { color: colors.muted, fontSize: 11, marginTop: 14 }, emptyCard: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineColor, borderRadius: 18, padding: 18 }, emptyTitle: { color: colors.ink, fontWeight: "800", fontSize: 16, marginBottom: 6 }, addProject: { alignItems: "center", paddingVertical: 24 }, boardCard: { flexDirection: "row", gap: 12, borderRadius: 18, borderWidth: 1, padding: 12, marginBottom: 8 }, boardPreview: { width: 58, height: 68, borderRadius: 12, overflow: "hidden", position: "relative" }, previewDot: { width: 26, height: 26, borderRadius: 13, margin: 16 }, boardKind: { fontSize: 10, letterSpacing: 1.2, fontWeight: "800" }, boardName: { fontSize: 16, fontWeight: "800", marginTop: 4 }, boardMeta: { fontSize: 12, marginTop: 5 },
});
