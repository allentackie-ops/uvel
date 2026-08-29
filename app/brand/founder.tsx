import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { pickFromLibrary } from "../../lib/photo";
import { appendFounderReference, createFounderBoard, createFounderProject, getFounderProject, updateFounderBoard, updateFounderProject, useFounderProjects, type FounderBoard, type FounderPoint, type FounderProject, type FounderStage, type FounderStroke } from "../../lib/founder";
import { useColors, type Colors } from "../../lib/theme";

const STAGES: FounderStage[] = ["idea", "identity", "design", "product", "source", "launch"];
const STAGE_LABELS: Record<FounderStage, string> = { idea: "Idea", identity: "Identity", design: "Design", product: "Product", source: "Source", launch: "Launch" };
const SWATCHES = ["#D6E27A", "#F4F0E6", "#161512", "#B77457", "#6D8795"];
const SETUP_TASKS = [
  { id: "domain", category: "FOUNDATION", title: "Choose a domain", body: "Find a short home for the label and check that the name is available." },
  { id: "storefront", category: "DIGITAL PRESENCE", title: "Choose a storefront", body: "Decide where your first collection will live before you build the full site." },
  { id: "email", category: "DIGITAL PRESENCE", title: "Create a brand email", body: "Use a reliable contact route for customers, makers, and collaborators." },
  { id: "payments", category: "OPERATIONS", title: "Plan payments", body: "Choose how customers will pay; provider onboarding and eligibility happen outside Uvel." },
  { id: "shipping", category: "OPERATIONS", title: "Map shipping and returns", body: "Write down where you can ship, expected timing, and what happens when something comes back." },
  { id: "policies", category: "TRUST", title: "Prepare customer policies", body: "Draft clear terms, privacy, delivery, and returns information for your future storefront." },
  { id: "analytics", category: "LAUNCH", title: "Plan measurement", body: "Choose the few signals you will watch after launch instead of guessing at performance." },
  { id: "qa", category: "LAUNCH", title: "Run launch QA", body: "Check mobile layout, links, forms, accessibility, and the buying path before sharing it." },
] as const;
const RESOURCES = [
  { title: "Domain basics", body: "Learn how domain names work before choosing one.", url: "https://www.icann.org/resources/pages/what-is-a-domain-name-2018-08-28-en" },
  { title: "Storefront starting points", body: "Compare the shape of a hosted storefront before committing.", url: "https://www.shopify.com/start" },
  { title: "Payments for platforms", body: "Review how connected payments and onboarding work.", url: "https://stripe.com/connect" },
] as const;
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

function FounderSetupHub({ project, colors }: { project: FounderProject; colors: FounderColors }) {
  const styles = make(colors);
  const [notes, setNotes] = useState(project.setup.notes);
  useEffect(() => { setNotes(project.setup.notes); }, [project.id]);
  const completed = new Set(project.setup.completedTaskIds);
  const toggleTask = (id: string) => {
    const next = completed.has(id) ? project.setup.completedTaskIds.filter((taskId) => taskId !== id) : [...project.setup.completedTaskIds, id];
    updateFounderProject(project.id, { setup: { ...project.setup, completedTaskIds: next }, stage: next.length ? "source" : project.stage });
  };
  const saveNotes = () => updateFounderProject(project.id, { setup: { ...project.setup, notes }, stage: project.setup.completedTaskIds.length ? "source" : project.stage });
  const openResource = async (url: string) => {
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    } catch {
      Alert.alert("Resource unavailable", "This resource could not be opened right now.");
    }
  };
  const doneCount = SETUP_TASKS.filter((task) => completed.has(task.id)).length;
  return <View style={styles.setupCard}>
    <Text style={styles.sectionLabel}>SOURCE & LAUNCH</Text>
    <Text style={styles.cardTitle}>Build the parts around the product.</Text>
    <Text style={styles.cardBody}>Use this as a guide. Uvel does not create provider accounts or claim that setup is complete for you.</Text>
    <View style={styles.readinessRow}><Text style={styles.saveHint}>Setup readiness</Text><Text style={styles.readinessCount}>{doneCount}/{SETUP_TASKS.length} complete</Text></View>
    <View style={styles.taskList}>{SETUP_TASKS.map((task) => <Pressable key={task.id} onPress={() => toggleTask(task.id)} style={[styles.setupTask, completed.has(task.id) && styles.setupTaskDone]}><View style={[styles.taskCheck, completed.has(task.id) && styles.taskCheckDone]}><Text style={styles.taskCheckText}>{completed.has(task.id) ? "✓" : ""}</Text></View><View style={{ flex: 1 }}><Text style={styles.taskCategory}>{task.category}</Text><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskBody}>{task.body}</Text></View></Pressable>)}</View>
    <Text style={styles.fieldLabel}>FOUNDER NOTES</Text>
    <TextInput value={notes} onChangeText={setNotes} onBlur={saveNotes} placeholder="Questions, links, or decisions to revisit" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.longInput]} />
    <Pressable onPress={saveNotes} style={styles.secondary}><Text style={styles.secondaryText}>Save setup notes</Text></Pressable>
    <Text style={[styles.fieldLabel, { marginTop: 18 }]}>STARTER RESOURCES</Text>
    {RESOURCES.map((resource) => <Pressable key={resource.url} onPress={() => void openResource(resource.url)} style={styles.resourceCard}><View style={{ flex: 1 }}><Text style={styles.resourceTitle}>{resource.title}</Text><Text style={styles.resourceBody}>{resource.body}</Text></View><Text style={styles.resourceArrow}>↗</Text></Pressable>)}
  </View>;
}

function FounderLaunchReview({ project, colors }: { project: FounderProject; colors: FounderColors }) {
  const styles = make(colors);
  const strategyReady = Boolean(project.brief.audience.trim() && project.brief.category.trim() && project.brief.promise.trim() && project.brief.values.trim() && project.brief.tone.trim() && project.brief.story.trim());
  const identityReady = Boolean(project.identity.colors.length && project.identity.typography.trim() && project.identity.logoDirection.trim());
  const productReady = Boolean(project.product.name.trim() && project.product.silhouette.trim() && project.product.materials.trim() && project.product.sizes.trim() && project.product.targetPrice.trim() && project.product.productionQuestions.trim() && project.product.boardId);
  const setupReady = project.setup.completedTaskIds.length >= 6;
  const checks = [
    { id: "strategy", label: "Brand idea brief", done: strategyReady, detail: "Audience, category, promise, values, tone, and story" },
    { id: "identity", label: "Identity direction", done: identityReady, detail: "Palette, typography, and logo direction" },
    { id: "product", label: "First-product brief", done: productReady, detail: "A product concept connected to a saved board" },
    { id: "setup", label: "Source & launch plan", done: setupReady, detail: "At least six setup tasks reviewed" },
  ];
  const ready = checks.every((check) => check.done);
  const openApplication = () => {
    if (!ready) {
      Alert.alert("A few things are still open", checks.filter((check) => !check.done).map((check) => check.label).join("\n"));
      return;
    }
    router.push({ pathname: "/brand/apply", params: { founderProjectId: project.id } });
  };
  return <View style={styles.launchCard}>
    <Text style={styles.sectionLabel}>LAUNCH READINESS</Text>
    <Text style={styles.cardTitle}>Know what is ready before you apply.</Text>
    <Text style={styles.cardBody}>This review checks your private preparation. It does not verify a business, reserve a trademark, or publish anything.</Text>
    <View style={styles.readinessRow}><Text style={styles.saveHint}>Founder readiness</Text><Text style={styles.readinessCount}>{checks.filter((check) => check.done).length}/{checks.length} ready</Text></View>
    <View style={styles.launchChecks}>{checks.map((check) => <View key={check.id} style={styles.launchCheck}><View style={[styles.taskCheck, check.done && styles.taskCheckDone]}><Text style={styles.taskCheckText}>{check.done ? "✓" : ""}</Text></View><View style={{ flex: 1 }}><Text style={styles.taskTitle}>{check.label}</Text><Text style={styles.taskBody}>{check.detail}</Text></View></View>)}</View>
    <Pressable onPress={openApplication} style={[styles.primary, !ready && styles.primaryMuted]}><Text style={[styles.primaryText, !ready && styles.primaryMutedText]}>{ready ? "Open brand application" : "Finish readiness first"}</Text></Pressable>
    <Text style={styles.handoffHint}>{ready ? "Your private work stays private. The application is a separate review step." : "Complete the missing sections above before starting the public brand application."}</Text>
  </View>;
}

function FounderProductEditor({ project, colors }: { project: FounderProject; colors: FounderColors }) {
  const styles = make(colors);
  const [product, setProduct] = useState(project.product);
  useEffect(() => { setProduct(project.product); }, [project.id]);
  const setField = <K extends keyof typeof product>(key: K, value: (typeof product)[K]) => setProduct((current) => ({ ...current, [key]: value }));
  const completion = [product.name, product.silhouette, product.materials, product.sizes, product.targetPrice, product.productionQuestions, product.boardId].filter((value) => value.trim()).length;
  const save = () => updateFounderProject(project.id, { product, stage: "product" });
  return <View style={styles.productCard}>
    <Text style={styles.sectionLabel}>FIRST-PRODUCT BRIEF</Text>
    <Text style={styles.cardTitle}>Turn the direction into one piece.</Text>
    <Text style={styles.cardBody}>This is a working concept, not a live listing or a production promise.</Text>
    <TextInput value={product.name} onChangeText={(value) => setField("name", value)} placeholder="Product name" placeholderTextColor={colors.muted} style={styles.input} />
    <TextInput value={product.silhouette} onChangeText={(value) => setField("silhouette", value)} placeholder="Silhouette · shape, fit, key details" placeholderTextColor={colors.muted} style={styles.input} />
    <TextInput value={product.materials} onChangeText={(value) => setField("materials", value)} placeholder="Materials · what could it be made from?" placeholderTextColor={colors.muted} style={styles.input} />
    <TextInput value={product.sizes} onChangeText={(value) => setField("sizes", value)} placeholder="Sizes or measurements to explore" placeholderTextColor={colors.muted} style={styles.input} />
    <TextInput value={product.targetPrice} onChangeText={(value) => setField("targetPrice", value)} placeholder="Target price · include currency" placeholderTextColor={colors.muted} style={styles.input} />
    <TextInput value={product.productionQuestions} onChangeText={(value) => setField("productionQuestions", value)} placeholder="Questions for a maker or supplier" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.longInput]} />
    <Text style={styles.fieldLabel}>CONNECT A BOARD</Text>
    {project.boards.length ? <View style={styles.optionRow}>{project.boards.map((board) => <Pressable key={board.id} onPress={() => setField("boardId", board.id)} style={[styles.option, product.boardId === board.id && styles.optionOn]}><Text style={[styles.optionText, product.boardId === board.id && styles.optionTextOn]}>{board.name}</Text></Pressable>)}</View> : <Text style={styles.empty}>Create a moodboard or sketch above to connect visual direction here.</Text>}
    <View style={styles.readinessRow}><Text style={styles.saveHint}>Readiness</Text><Text style={styles.readinessCount}>{completion}/7 complete</Text></View>
    <Pressable onPress={save} style={styles.primary}><Text style={styles.primaryText}>Save product brief</Text></Pressable>
  </View>;
}

function FounderStrategy({ project, colors }: { project: FounderProject; colors: FounderColors }) {
  const styles = make(colors);
  const [brief, setBrief] = useState(project.brief);
  const [identity, setIdentity] = useState(project.identity);
  useEffect(() => { setBrief(project.brief); setIdentity(project.identity); }, [project.id]);
  const setBriefField = <K extends keyof typeof brief>(key: K, value: (typeof brief)[K]) => setBrief((current) => ({ ...current, [key]: value }));
  const save = () => updateFounderProject(project.id, { brief, identity, stage: "identity" });
  return <View style={styles.strategyCard}>
    <Text style={styles.sectionLabel}>BRAND IDEA BRIEF</Text>
    <Text style={styles.cardTitle}>Make the idea specific.</Text>
    <Text style={styles.cardBody}>A clear brief gives your visual direction something real to express.</Text>
    <TextInput value={brief.audience} onChangeText={(value) => setBriefField("audience", value)} placeholder="Who is this for?" placeholderTextColor={colors.muted} style={styles.input} />
    <TextInput value={brief.category} onChangeText={(value) => setBriefField("category", value)} placeholder="What will you make first?" placeholderTextColor={colors.muted} style={styles.input} />
    <TextInput value={brief.promise} onChangeText={(value) => setBriefField("promise", value)} placeholder="What should people feel or get?" placeholderTextColor={colors.muted} style={styles.input} />
    <TextInput value={brief.values} onChangeText={(value) => setBriefField("values", value)} placeholder="Values · separated by commas" placeholderTextColor={colors.muted} style={styles.input} />
    <TextInput value={brief.tone} onChangeText={(value) => setBriefField("tone", value)} placeholder="Tone · e.g. quiet, playful, precise" placeholderTextColor={colors.muted} style={styles.input} />
    <TextInput value={brief.story} onChangeText={(value) => setBriefField("story", value)} placeholder="What is the story behind the label?" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.longInput]} />
    <Text style={styles.fieldLabel}>PRICE POSITION</Text>
    <View style={styles.optionRow}>{(["accessible", "mid-market", "premium"] as const).map((option) => <Pressable key={option} onPress={() => setBriefField("pricePosition", option)} style={[styles.option, brief.pricePosition === option && styles.optionOn]}><Text style={[styles.optionText, brief.pricePosition === option && styles.optionTextOn]}>{option === "mid-market" ? "Mid-market" : option[0].toUpperCase() + option.slice(1)}</Text></Pressable>)}</View>
    <Text style={[styles.sectionLabel, { marginTop: 22 }]}>IDENTITY STARTER KIT</Text>
    <Text style={styles.cardBody}>Choose a starting direction. You can change it as the brand becomes clearer.</Text>
    <Text style={styles.fieldLabel}>PALETTE</Text>
    <View style={styles.identitySwatches}>{identity.colors.map((swatch) => <View key={swatch} style={[styles.identitySwatch, { backgroundColor: swatch }]} />)}<Text style={styles.boardMeta}>Base palette</Text></View>
    <Text style={styles.fieldLabel}>TYPE DIRECTION</Text>
    <View style={styles.optionRow}>{["Warm editorial sans", "Sharp modern grotesk", "Soft expressive serif"].map((option) => <Pressable key={option} onPress={() => setIdentity((current) => ({ ...current, typography: option }))} style={[styles.option, identity.typography === option && styles.optionOn]}><Text style={[styles.optionText, identity.typography === option && styles.optionTextOn]}>{option}</Text></Pressable>)}</View>
    <TextInput value={identity.logoDirection} onChangeText={(logoDirection) => setIdentity((current) => ({ ...current, logoDirection }))} placeholder="Logo direction · wordmark, symbol, monogram…" placeholderTextColor={colors.muted} style={styles.input} />
    <Pressable onPress={save} style={styles.primary}><Text style={styles.primaryText}>Save brief and identity</Text></Pressable>
  </View>;
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
        <View style={stylesFor.progressCard}><View style={{ flex: 1 }}><Text style={stylesFor.sectionLabel}>CURRENT STAGE</Text><Text style={stylesFor.progressTitle}>{project.stage === "design" ? "Design your direction" : project.stage === "identity" ? "Build your identity" : project.stage === "product" ? "Shape your first product" : project.stage === "source" ? "Set up the foundations" : project.stage === "launch" ? "Prepare to launch" : "Capture the idea"}</Text><Text style={stylesFor.progressBody}>A saved board is a real step forward. Nothing here is treated as a business claim or a finished production spec.</Text></View><Text style={stylesFor.progressCount}>{Math.max(1, STAGES.indexOf(project.stage) + 1)}/{STAGES.length}</Text></View>
        <View style={stylesFor.stageRow}>{STAGES.map((stage, index) => <View key={stage} style={stylesFor.stageItem}><View style={[stylesFor.stageDot, index <= STAGES.indexOf(project.stage) && stylesFor.stageDotOn]} /><Text style={stylesFor.stageText}>{STAGE_LABELS[stage]}</Text></View>)}</View>
        <FounderStrategy project={project} colors={colors} />
        <FounderProductEditor project={project} colors={colors} />
        <FounderSetupHub project={project} colors={colors} />
        <FounderLaunchReview project={project} colors={colors} />
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
  page: { flex: 1, backgroundColor: colors.ink }, muted: { color: colors.muted, paddingHorizontal: 20 }, top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 10 }, back: { color: colors.ink, fontSize: 36, lineHeight: 38 }, topTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" }, hero: { padding: 20, paddingTop: 22, paddingBottom: 28 }, kicker: { color: colors.accent, fontSize: 11, letterSpacing: 2.5, fontWeight: "800" }, title: { color: colors.ink, fontFamily: "Georgia", fontSize: 34, marginTop: 12 }, lede: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 8, maxWidth: 440 }, sectionLabel: { color: colors.muted, fontSize: 11, letterSpacing: 1.8, fontWeight: "800", marginBottom: 9 }, projectPicker: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.lineColor, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 8 }, projectPickerOn: { borderColor: colors.accent }, projectName: { color: colors.ink, fontSize: 16, fontWeight: "800" }, projectMeta: { color: colors.muted, fontSize: 12, marginTop: 4 }, chevron: { color: colors.accent, fontSize: 14 }, createCard: { margin: 20, backgroundColor: colors.card, borderColor: colors.lineColor, borderWidth: 1, borderRadius: 22, padding: 18 }, cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" }, cardBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 14 }, input: { borderWidth: 1, borderColor: colors.lineColor, backgroundColor: colors.ink, color: colors.ink, borderRadius: 14, paddingHorizontal: 14, height: 50, marginTop: 10, fontSize: 16 }, primary: { height: 50, borderRadius: 25, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginTop: 14 }, primaryText: { color: colors.accentInk, fontWeight: "900", fontSize: 15 }, secondary: { alignItems: "center", padding: 13 }, secondaryText: { color: colors.ink, fontWeight: "800", fontSize: 14 }, progressCard: { backgroundColor: colors.card, borderRadius: 20, padding: 16, flexDirection: "row", borderWidth: 1, borderColor: colors.lineColor }, progressTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" }, progressBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }, progressCount: { color: colors.accent, fontSize: 22, fontWeight: "900" }, stageRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 18 }, stageItem: { alignItems: "center", gap: 5 }, stageDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lineColor }, stageDotOn: { backgroundColor: colors.accent }, stageText: { color: colors.muted, fontSize: 10 }, actionRow: { flexDirection: "row", gap: 10, marginBottom: 20 }, actionCard: { flex: 1, backgroundColor: colors.card, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: colors.lineColor, minHeight: 130 }, actionIcon: { color: colors.accent, fontSize: 28 }, actionTitle: { color: colors.ink, fontWeight: "800", fontSize: 15, marginTop: 7 }, actionBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }, editor: { backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.lineColor }, editorHead: { flexDirection: "row", alignItems: "center", marginBottom: 10 }, boardTitleInput: { color: colors.ink, fontSize: 21, fontWeight: "800", paddingVertical: 0 }, smallButton: { borderWidth: 1, borderColor: colors.lineColor, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 }, smallButtonText: { color: colors.ink, fontWeight: "800", fontSize: 12 }, canvas: { height: 430, borderRadius: 16, borderWidth: 1, overflow: "hidden", position: "relative" }, canvasHint: { position: "absolute", top: 16, left: 16, fontSize: 12 }, stroke: { position: "absolute", borderRadius: 4, transformOrigin: "left center" as never }, toolRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 10 }, swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2 }, toolButton: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginLeft: "auto" }, toolText: { fontSize: 12, fontWeight: "800" }, moodboard: { minHeight: 230 }, moodColors: { flexDirection: "row", gap: 10, marginVertical: 14 }, moodColor: { height: 52, flex: 1, borderRadius: 13 }, noteInput: { minHeight: 86, color: colors.ink, fontSize: 15, lineHeight: 21, padding: 0, textAlignVertical: "top" }, reference: { width: 112, height: 140, borderRadius: 14, backgroundColor: colors.ink }, empty: { color: colors.muted, fontSize: 13, lineHeight: 19 }, saveHint: { color: colors.muted, fontSize: 11, marginTop: 14 }, emptyCard: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineColor, borderRadius: 18, padding: 18 }, emptyTitle: { color: colors.ink, fontWeight: "800", fontSize: 16, marginBottom: 6 }, addProject: { alignItems: "center", paddingVertical: 24 }, boardCard: { flexDirection: "row", gap: 12, borderRadius: 18, borderWidth: 1, padding: 12, marginBottom: 8 }, boardPreview: { width: 58, height: 68, borderRadius: 12, overflow: "hidden", position: "relative" }, previewDot: { width: 26, height: 26, borderRadius: 13, margin: 16 }, boardKind: { fontSize: 10, letterSpacing: 1.2, fontWeight: "800" }, boardName: { fontSize: 16, fontWeight: "800", marginTop: 4 }, boardMeta: { fontSize: 12, marginTop: 5 }, strategyCard: { backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.lineColor, marginBottom: 20 }, productCard: { backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.lineColor, marginBottom: 20 }, launchCard: { backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.lineColor, marginBottom: 20 }, launchChecks: { gap: 10, marginTop: 12 }, launchCheck: { flexDirection: "row", gap: 11, alignItems: "flex-start" }, handoffHint: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 9 }, primaryMuted: { backgroundColor: colors.lineColor }, primaryMutedText: { color: colors.muted }, setupCard: { backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.lineColor, marginBottom: 20 }, taskList: { gap: 8, marginTop: 12 }, setupTask: { flexDirection: "row", gap: 11, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.lineColor, backgroundColor: colors.ink }, setupTaskDone: { borderColor: colors.accent, backgroundColor: colors.card }, taskCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.lineColor, alignItems: "center", justifyContent: "center", marginTop: 1 }, taskCheckDone: { backgroundColor: colors.accent, borderColor: colors.accent }, taskCheckText: { color: colors.accentInk, fontSize: 15, fontWeight: "900" }, taskCategory: { color: colors.accent, fontSize: 9, letterSpacing: 1.4, fontWeight: "900" }, taskTitle: { color: colors.ink, fontSize: 15, fontWeight: "800", marginTop: 3 }, taskBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }, resourceCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: colors.lineColor, marginTop: 8 }, resourceTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" }, resourceBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }, resourceArrow: { color: colors.accent, fontSize: 22, fontWeight: "800" }, longInput: { height: 92, textAlignVertical: "top", paddingTop: 14 }, fieldLabel: { color: colors.muted, fontSize: 10, letterSpacing: 1.6, fontWeight: "800", marginTop: 14, marginBottom: 8 }, optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, option: { borderWidth: 1, borderColor: colors.lineColor, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 9 }, optionOn: { backgroundColor: colors.accent, borderColor: colors.accent }, optionText: { color: colors.ink, fontSize: 12, fontWeight: "700" }, optionTextOn: { color: colors.accentInk }, identitySwatches: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }, identitySwatch: { width: 42, height: 42, borderRadius: 12 }, readinessRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 }, readinessCount: { color: colors.accent, fontSize: 13, fontWeight: "900" },
});
