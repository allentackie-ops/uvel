import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { importFounderWork, pickFromLibrary, saveFounderPhotoReference } from "../../lib/photo";
import { workspaceStyles } from "./founder-workspace-styles";
import { appendFounderReference, archiveFounderProject, applyReady, createFounderBoard, createFounderProject, getFounderProject, ideaReady, pieceReady, saveFounderProduct, simpleStageOf, updateFounderBoard, updateFounderProject, updateFounderProduction, updateFounderTask, useFounderProjects, type FounderBoard, type FounderCanvasTool, type FounderPoint, type FounderProduction, type FounderProject, type FounderSetup, type FounderStage, type FounderStroke, type FounderSupplier, type FounderSample, type FounderImportedWork } from "../../lib/founder";
import { useColors, type Colors } from "../../lib/theme";
import { founderCloudCapability, type FounderCloudCapability } from "../../lib/firebase";
import { openFounderBrand, submitFounderReview, useBrands } from "../../lib/brands";
import { useUvel } from "../../lib/store";
import { FOUNDER_REVIEW_STAGES } from "../../lib/founderReview";
import { OrbitLoader } from "../../components/OrbitLoader";

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

export function SketchBoard({ board, projectId, colors }: { board: FounderBoard; projectId: string; colors: FounderColors }) {
  const styles = make(colors);
  const [active, setActive] = useState<FounderPoint[]>([]);
  const [selected, setSelected] = useState(board.colors[0] || SWATCHES[0]);
  const [tool, setTool] = useState<FounderCanvasTool>("draw");
  const [history, setHistory] = useState<FounderStroke[][]>([board.strokes]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const start = useRef<FounderPoint | null>(null);
  useEffect(() => { setHistory([board.strokes]); setHistoryIndex(0); }, [board.id]);
  const commitStrokes = (strokes: FounderStroke[]) => {
    const nextHistory = [...history.slice(0, historyIndex + 1), strokes].slice(-25);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    updateFounderBoard(projectId, board.id, { strokes });
  };
  const shapePoints = (points: FounderPoint[]) => {
    if (tool === "draw" || points.length < 2) return points;
    const first = points[0];
    const last = points[points.length - 1];
    if (tool === "line") return [first, last];
    return [first, { x: last.x, y: first.y }, last, { x: first.x, y: last.y }, first];
  };
  const importedImage = board.imports.find((item) => item.kind === "image");
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
          const stroke: FounderStroke = { id: `stroke-${Date.now()}`, color: selected, width: tool === "line" ? 5 : 4, points: shapePoints(points) };
          commitStrokes([...board.strokes, stroke]);
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
        {importedImage ? <Image pointerEvents="none" source={{ uri: importedImage.uri }} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, opacity: 0.62 }} contentFit="contain" /> : null}
        <Text pointerEvents="none" style={[styles.canvasHint, { color: colors.muted }]}>Draw a rough silhouette or annotate an idea</Text>
        {board.strokes.map((stroke) => <StrokeLines key={stroke.id} stroke={stroke} />)}
        {active.length > 1 ? <StrokeLines stroke={{ id: "active", color: selected, width: 4, points: active }} /> : null}
      </View>
      <View style={styles.toolRow}>
        {(["draw", "line", "rectangle"] as FounderCanvasTool[]).map((item) => <Pressable key={item} onPress={() => setTool(item)} style={[styles.toolButton, { borderColor: tool === item ? colors.ink : colors.lineColor, backgroundColor: tool === item ? colors.card : "transparent" }]}><Text style={[styles.toolText, { color: colors.ink }]}>{item === "draw" ? "Draw" : item === "line" ? "Line" : "Box"}</Text></Pressable>)}
        {SWATCHES.map((swatch) => <Pressable key={swatch} onPress={() => setSelected(swatch)} style={[styles.swatch, { backgroundColor: swatch, borderColor: selected === swatch ? colors.ink : colors.lineColor }]} accessibilityLabel={`Use ${swatch} drawing color`} />)}
      </View>
      <View style={styles.historyRow}>
        <Pressable disabled={historyIndex === 0} onPress={() => { const index = historyIndex - 1; setHistoryIndex(index); updateFounderBoard(projectId, board.id, { strokes: history[index] }); }} style={[styles.toolButton, { borderColor: colors.lineColor, opacity: historyIndex === 0 ? 0.35 : 1 }]}><Text style={[styles.toolText, { color: colors.ink }]}>Undo</Text></Pressable>
        <Pressable disabled={historyIndex >= history.length - 1} onPress={() => { const index = historyIndex + 1; setHistoryIndex(index); updateFounderBoard(projectId, board.id, { strokes: history[index] }); }} style={[styles.toolButton, { borderColor: colors.lineColor, opacity: historyIndex >= history.length - 1 ? 0.35 : 1 }]}><Text style={[styles.toolText, { color: colors.ink }]}>Redo</Text></Pressable>
        <Pressable onPress={() => commitStrokes([])} style={[styles.toolButton, { borderColor: colors.lineColor }]}><Text style={[styles.toolText, { color: colors.ink }]}>Clear</Text></Pressable>
      </View>
      <TextInput value={board.annotation} onChangeText={(annotation) => updateFounderBoard(projectId, board.id, { annotation })} placeholder="Add a note about this version, fit, or construction idea" placeholderTextColor={colors.muted} multiline style={[styles.noteInput, { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.lineColor, paddingTop: 12 }]} />
    </View>
  );
}

export function FounderSetupHub({ project, colors }: { project: FounderProject; colors: FounderColors }) {
  const styles = make(colors);
  const [notes, setNotes] = useState(project.setup.notes);
  useEffect(() => { setNotes(project.setup.notes); }, [project.id]);
  const completed = new Set(project.setup.completedTaskIds);
  const toggleTask = (id: string) => {
    const next = completed.has(id) ? project.setup.completedTaskIds.filter((taskId) => taskId !== id) : [...project.setup.completedTaskIds, id];
    updateFounderProject(project.id, { setup: { ...project.setup, completedTaskIds: next }, stage: next.length ? "source" : project.stage });
  };
  const saveNotes = () => updateFounderProject(project.id, { setup: { ...project.setup, notes }, stage: project.setup.completedTaskIds.length ? "source" : project.stage });
  const cycleIntegration = (id: string) => {
    const statuses: FounderSetup["integrations"][number]["status"][] = ["not-started", "preparing", "connected", "needs-attention", "unavailable"];
    const integrations = project.setup.integrations.map((item) => item.id === id ? { ...item, status: statuses[(statuses.indexOf(item.status) + 1) % statuses.length] } : item);
    updateFounderProject(project.id, { setup: { ...project.setup, integrations }, stage: "source" });
  };
  const statusLabel = (value: string) => value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
    <Text style={[styles.fieldLabel, { marginTop: 18 }]}>PLANNED LAUNCH DATE</Text>
    <TextInput value={project.setup.launchDate} onChangeText={(launchDate) => updateFounderProject(project.id, { setup: { ...project.setup, launchDate }, stage: "source" })} placeholder="YYYY-MM-DD · planning only" placeholderTextColor={colors.muted} style={styles.input} />
    <Text style={[styles.fieldLabel, { marginTop: 18 }]}>SERVICE SETUP GUIDE</Text>
    <Text style={styles.cardBody}>Tap a service to cycle its planning state. “Connected” is a founder-entered planning state here, not proof that Uvel has a live provider connection.</Text>
    <View style={styles.integrationList}>{project.setup.integrations.map((item) => <Pressable key={item.id} onPress={() => cycleIntegration(item.id)} style={styles.integrationRow}><View style={{ flex: 1 }}><Text style={styles.taskTitle}>{item.label}</Text><Text style={styles.resourceBody}>{item.outcome}</Text></View><Text style={styles.statusPill}>{statusLabel(item.status)}</Text></Pressable>)}</View>
    <Text style={[styles.fieldLabel, { marginTop: 18 }]}>STARTER RESOURCES</Text>
    {RESOURCES.map((resource) => <Pressable key={resource.url} onPress={() => void openResource(resource.url)} style={styles.resourceCard}><View style={{ flex: 1 }}><Text style={styles.resourceTitle}>{resource.title}</Text><Text style={styles.resourceBody}>{resource.body}</Text></View><Text style={styles.resourceArrow}>↗</Text></Pressable>)}
  </View>;
}

export function FounderProductionWorkspace({ project, colors }: { project: FounderProject; colors: FounderColors }) {
  const styles = make(colors);
  const [production, setProduction] = useState<FounderProduction>(project.production);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [supplier, setSupplier] = useState({ name: "", location: "", specialty: "", contact: "", minimumOrder: "", leadTime: "", quote: "", quoteCurrency: "USD", qualityNotes: "", notes: "", attachments: [] as FounderImportedWork[] });
  const [sampleName, setSampleName] = useState("");
  useEffect(() => setProduction(project.production), [project.id, project.production]);
  const save = (next: FounderProduction) => { setProduction(next); updateFounderProduction(project.id, next); };
  const updateField = (key: "targetUnits" | "targetCost" | "currency" | "notes", value: string) => save({ ...production, [key]: value });
  const addSupplier = () => {
    if (!supplier.name.trim()) { Alert.alert("Name the supplier", "Add a working name so you can compare this lead later."); return; }
    const now = Date.now();
    const nextSupplier: FounderSupplier = { ...supplier, id: `supplier-${now}`, name: supplier.name.trim(), location: supplier.location.trim(), specialty: supplier.specialty.trim(), contact: supplier.contact.trim(), minimumOrder: supplier.minimumOrder.trim(), leadTime: supplier.leadTime.trim(), quote: supplier.quote.trim(), quoteCurrency: supplier.quoteCurrency.trim().toUpperCase() || "USD", qualityNotes: supplier.qualityNotes.trim(), notes: supplier.notes.trim(), status: "researching", createdAt: now, updatedAt: now };
    save({ ...production, suppliers: [nextSupplier, ...production.suppliers] });
    setSupplier({ name: "", location: "", specialty: "", contact: "", minimumOrder: "", leadTime: "", quote: "", quoteCurrency: "USD", qualityNotes: "", notes: "", attachments: [] });
    setShowSupplierForm(false);
  };
  const attachSupplierFile = async () => {
    try {
      const imported = await importFounderWork();
      if (imported) setSupplier((current) => ({ ...current, attachments: [...current.attachments, { id: `attachment-${Date.now()}`, ...imported, createdAt: Date.now() }] }));
    } catch (error) { Alert.alert("Attachment unavailable", error instanceof Error ? error.message : "We could not add that file."); }
  };
  const addSample = () => {
    if (!sampleName.trim() || !production.suppliers.length) { Alert.alert("Add a supplier first", "A sample should always be linked to the supplier it came from."); return; }
    const now = Date.now();
    const nextSample: FounderSample = { id: `sample-${now}`, supplierId: production.suppliers[0].id, name: sampleName.trim(), status: "requested", cost: "", receivedAt: "", notes: "", createdAt: now, updatedAt: now };
    save({ ...production, samples: [nextSample, ...production.samples] });
    setSampleName("");
  };
  const cycleSample = (sample: FounderSample) => { const statuses: FounderSample["status"][] = ["requested", "received", "approved", "changes-needed"]; const nextStatus = statuses[(statuses.indexOf(sample.status) + 1) % statuses.length]; save({ ...production, samples: production.samples.map((item) => item.id === sample.id ? { ...item, status: nextStatus, updatedAt: Date.now() } : item) }); };
  const cycleMilestone = (id: string) => { const statuses: FounderProduction["milestones"][number]["status"][] = ["todo", "in-progress", "done"]; save({ ...production, milestones: production.milestones.map((item) => item.id === id ? { ...item, status: statuses[(statuses.indexOf(item.status) + 1) % statuses.length] } : item) }); };
  const statusLabel = (value: string) => value.replaceAll("-", " ").replace(/\\b\\w/g, (letter) => letter.toUpperCase());
  return <View style={styles.productionCard}>
    <Text style={styles.sectionLabel}>SUPPLIER & PRODUCTION</Text>
    <Text style={styles.cardTitle}>Make the first run tangible.</Text>
    <Text style={styles.cardBody}>Keep your production conversations in one private place. These are founder notes, not verified supplier listings, quotes, or purchase orders.</Text>
    <View style={styles.productionGrid}><View style={{ flex: 1 }}><Text style={styles.fieldLabel}>FIRST RUN UNITS</Text><TextInput value={production.targetUnits} onChangeText={(value) => updateField("targetUnits", value)} placeholder="e.g. 50" placeholderTextColor={colors.muted} style={styles.input} /></View><View style={{ flex: 1 }}><Text style={styles.fieldLabel}>TARGET COST</Text><TextInput value={production.targetCost} onChangeText={(value) => updateField("targetCost", value)} placeholder="e.g. 28" placeholderTextColor={colors.muted} style={styles.input} /></View></View>
    <TextInput value={production.currency} onChangeText={(value) => updateField("currency", value.toUpperCase().slice(0, 3))} placeholder="Currency · USD" placeholderTextColor={colors.muted} style={styles.input} />
    <TextInput value={production.notes} onChangeText={(value) => updateField("notes", value)} placeholder="What must a maker understand about this product?" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.longInput]} />
    <View style={styles.productionHeader}><Text style={styles.subsectionTitle}>Supplier shortlist</Text><Pressable onPress={() => setShowSupplierForm((value) => !value)} style={styles.smallButton}><Text style={styles.smallButtonText}>{showSupplierForm ? "Close" : "＋ Add supplier"}</Text></Pressable></View>
    {showSupplierForm ? <View style={styles.innerCard}><TextInput value={supplier.name} onChangeText={(value) => setSupplier((current) => ({ ...current, name: value }))} placeholder="Supplier or maker name" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={supplier.location} onChangeText={(value) => setSupplier((current) => ({ ...current, location: value }))} placeholder="Location" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={supplier.specialty} onChangeText={(value) => setSupplier((current) => ({ ...current, specialty: value }))} placeholder="Specialty · knitwear, cut-and-sew…" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={supplier.contact} onChangeText={(value) => setSupplier((current) => ({ ...current, contact: value }))} placeholder="Contact or source link" placeholderTextColor={colors.muted} style={styles.input} /><View style={styles.productionGrid}><TextInput value={supplier.minimumOrder} onChangeText={(value) => setSupplier((current) => ({ ...current, minimumOrder: value }))} placeholder="Minimum order" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} /><TextInput value={supplier.leadTime} onChangeText={(value) => setSupplier((current) => ({ ...current, leadTime: value }))} placeholder="Lead time" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} /></View><View style={styles.productionGrid}><TextInput value={supplier.quote} onChangeText={(value) => setSupplier((current) => ({ ...current, quote: value }))} placeholder="Quote / unit" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} /><TextInput value={supplier.quoteCurrency} onChangeText={(value) => setSupplier((current) => ({ ...current, quoteCurrency: value }))} placeholder="USD" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} /></View><TextInput value={supplier.qualityNotes} onChangeText={(value) => setSupplier((current) => ({ ...current, qualityNotes: value }))} placeholder="Quality notes · evidence, questions, standards" placeholderTextColor={colors.muted} style={[styles.input, styles.longInput]} /><TextInput value={supplier.notes} onChangeText={(value) => setSupplier((current) => ({ ...current, notes: value }))} placeholder="Private conversation notes" placeholderTextColor={colors.muted} style={[styles.input, styles.longInput]} multiline /><Pressable onPress={() => void attachSupplierFile()} style={styles.secondary}><Text style={styles.secondaryText}>＋ Attach quote, certificate, or reference</Text></Pressable>{supplier.attachments.length ? <Text style={styles.saveHint}>{supplier.attachments.length} attachment(s) staged</Text> : null}<Pressable onPress={addSupplier} style={styles.primary}><Text style={styles.primaryText}>Save supplier brief</Text></Pressable></View> : null}
    {production.suppliers.length ? production.suppliers.map((item) => <View key={item.id} style={styles.supplierRow}><View style={{ flex: 1 }}><Text style={styles.taskTitle}>{item.name}</Text><Text style={styles.resourceBody}>{[item.location, item.specialty, item.minimumOrder && `MOQ ${item.minimumOrder}`, item.leadTime, item.quote && `${item.quoteCurrency} ${item.quote}/unit`].filter(Boolean).join(" · ") || "Add details as you learn more"}</Text><Text style={styles.saveHint}>{item.attachments.length} attachment(s) · founder-entered record</Text></View><Text style={styles.statusPill}>{statusLabel(item.status)}</Text></View>) : <Text style={styles.empty}>Add a supplier lead when you find one. Uvel will not call it verified.</Text>}
    {production.suppliers.length > 1 ? <Pressable onPress={() => setShowCompare((value) => !value)} style={styles.secondary}><Text style={styles.secondaryText}>{showCompare ? "Hide comparison" : "Compare supplier briefs"}</Text></Pressable> : null}
    {showCompare ? <View style={styles.compareCard}>{production.suppliers.map((item) => <View key={item.id} style={styles.compareRow}><Text style={styles.compareName}>{item.name}</Text><Text style={styles.resourceBody}>Quote: {item.quote ? `${item.quoteCurrency} ${item.quote}` : "Not recorded"} · MOQ: {item.minimumOrder || "Not recorded"} · Lead: {item.leadTime || "Not recorded"}</Text><Text style={styles.resourceBody}>Quality: {item.qualityNotes || "No quality notes yet"}</Text></View>)}</View> : null}
    <View style={styles.productionHeader}><Text style={styles.subsectionTitle}>Sample tracker</Text><Text style={styles.saveHint}>{production.samples.length} tracked</Text></View>
    <View style={styles.sampleAdd}><TextInput value={sampleName} onChangeText={setSampleName} placeholder="Sample name or version" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1, marginTop: 0 }]} /><Pressable onPress={addSample} style={styles.smallButton}><Text style={styles.smallButtonText}>＋ Track</Text></Pressable></View>
    {production.samples.map((sample) => <Pressable key={sample.id} onPress={() => cycleSample(sample)} style={styles.supplierRow}><View style={{ flex: 1 }}><Text style={styles.taskTitle}>{sample.name}</Text><Text style={styles.resourceBody}>Tap to move through sample stages</Text></View><Text style={styles.statusPill}>{statusLabel(sample.status)}</Text></Pressable>)}
    <Text style={styles.subsectionTitle}>Production milestones</Text>
    {production.milestones.map((milestone) => <Pressable key={milestone.id} onPress={() => cycleMilestone(milestone.id)} style={styles.milestoneRow}><View style={[styles.taskCheck, milestone.status === "done" && styles.taskCheckDone]}><Text style={styles.taskCheckText}>{milestone.status === "done" ? "✓" : ""}</Text></View><Text style={styles.taskTitle}>{milestone.title}</Text><Text style={styles.statusPill}>{statusLabel(milestone.status)}</Text></Pressable>)}
  </View>;
}

export function FounderLaunchReview({ project, colors }: { project: FounderProject; colors: FounderColors }) {
  const styles = make(colors);
  const app = useUvel();
  useBrands();
  const name = (project.identity.workingName || project.name).trim();
  const piece = project.product.name.trim();
  const ready = applyReady(project);
  const [more, setMore] = useState(false);
  const [applying, setApplying] = useState(false);
  const [stage, setStage] = useState(0);
  const [rename, setRename] = useState(name);
  const [block, setBlock] = useState<{ headline: string; reasons: string[] } | null>(
    project.handoffStatus === "rejected" ? { headline: "This filing was rejected", reasons: [] } : null,
  );
  useEffect(() => {
    if (!applying) return;
    setStage(0);
    const t = setInterval(() => setStage((n) => (n + 1) % FOUNDER_REVIEW_STAGES.length), 3800);
    return () => clearInterval(t);
  }, [applying]);
  const openApplication = async (nextName = name) => {
    if (!ready || applying) {
      if (!ready) Alert.alert("A name and a piece", [!ideaReady(project) ? "Name the label and who it’s for." : "", !pieceReady(project) ? "Add the first piece." : ""].filter(Boolean).join("\n"));
      return;
    }
    if (!app.uid) {
      Alert.alert("Sign in", "Open a brand from the account that will own it.");
      return;
    }
    const label = nextName.trim() || name;
    setApplying(true);
    setBlock(null);
    try {
      updateFounderProject(project.id, {
        name: label,
        identity: { ...project.identity, workingName: label },
        handoffStatus: "in-review",
      });
      const photo = project.boards[0]?.references[0] || project.boards[0]?.imports.find((item) => item.kind === "image")?.uri;
      const brand = await openFounderBrand({
        name: label,
        audience: project.brief.audience,
        story: project.identity.story || project.brief.story || project.brief.audience,
        vertical: project.product.category || "Unisex",
        country: project.country || app.country || "US",
        ownerId: app.uid,
        ownerName: app.displayName || "Owner",
        ownerPhoto: app.avatarUri || app.personUri,
        logoUri: photo,
      });
      const result = await submitFounderReview(brand.id, {
        name: label,
        handle: brand.handle,
        piece,
        category: project.product.category,
        audience: project.brief.audience,
        story: [project.brief.audience, project.identity.story, project.brief.story, project.product.productionQuestions].filter(Boolean).join("\n"),
        photos: [photo, brand.logoUri, brand.bannerUri].filter(Boolean) as string[],
        brandId: brand.id,
      });
      if (result.ok && result.decision === "uvel_reviewed") {
        updateFounderProject(project.id, { handoffStatus: "submitted" });
        router.replace({ pathname: "/brand/[id]", params: { id: brand.id } });
        return;
      }
      updateFounderProject(project.id, { handoffStatus: "rejected" });
      setRename(label);
      setBlock({ headline: result.headline || "This filing was rejected", reasons: result.reasons });
    } catch (error) {
      Alert.alert("Couldn’t open the brand", error instanceof Error ? error.message : "Try again in a moment.");
    } finally {
      setApplying(false);
    }
  };
  return <View style={styles.launchCard}>
    {applying ? (
      <View style={{ alignItems: "center", paddingVertical: 28 }}>
        <OrbitLoader />
        <Text style={[styles.cardTitle, { textAlign: "center", marginTop: 18 }]}>{FOUNDER_REVIEW_STAGES[stage]}</Text>
        <Text style={[styles.cardBody, { textAlign: "center" }]}>Name, handle, pictures, replica language. USPTO for the name.</Text>
      </View>
    ) : null}
    {!applying && block ? (
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.cardTitle}>{block.headline}</Text>
        {block.reasons.map((reason) => <Text key={reason} style={styles.cardBody}>{reason}</Text>)}
        <TextInput value={rename} onChangeText={setRename} placeholder="New name" placeholderTextColor={colors.muted} style={styles.input} />
        <Pressable onPress={() => void openApplication(rename)} style={styles.primary}><Text style={styles.primaryText}>Change name and send again</Text></Pressable>
        <Pressable onPress={() => router.replace({ pathname: "/brand/founder/[stage]", params: { id: project.id, stage: "product" } })} style={styles.secondary}><Text style={styles.secondaryText}>Change the picture</Text></Pressable>
      </View>
    ) : null}
    {!applying && !block ? <>
      <View style={styles.launchChecks}>
        <View style={styles.launchCheck}><View style={[styles.taskCheck, ideaReady(project) && styles.taskCheckDone]}><Text style={styles.taskCheckText}>{ideaReady(project) ? "✓" : ""}</Text></View><View style={{ flex: 1 }}><Text style={styles.taskTitle}>{name || "Name the label"}</Text><Text style={styles.taskBody}>{project.brief.audience.trim() || "Who it’s for"}</Text></View></View>
        <View style={styles.launchCheck}><View style={[styles.taskCheck, pieceReady(project) && styles.taskCheckDone]}><Text style={styles.taskCheckText}>{pieceReady(project) ? "✓" : ""}</Text></View><View style={{ flex: 1 }}><Text style={styles.taskTitle}>{piece || "First piece"}</Text><Text style={styles.taskBody}>{project.product.category || "A name and a category"}</Text></View></View>
      </View>
      <Pressable onPress={() => void openApplication()} style={[styles.primary, !ready && styles.primaryMuted]}><Text style={[styles.primaryText, !ready && styles.primaryMutedText]}>{ready ? "Apply as a brand" : "Finish the name and the piece"}</Text></Pressable>
      <Pressable onPress={() => setMore((value) => !value)} style={styles.secondary}><Text style={styles.secondaryText}>{more ? "Hide more" : "More · makers and setup"}</Text></Pressable>
      {more ? <>
        <FounderSetupHub project={project} colors={colors} />
        <FounderProductionWorkspace project={project} colors={colors} />
      </> : null}
      <Text style={styles.handoffHint}>We’ll check the name on the USPTO, the pictures, and replica language.</Text>
    </> : null}
  </View>;
}

export function FounderProductEditor({ project, colors }: { project: FounderProject; colors: FounderColors }) {
  const styles = make(colors);
  const [product, setProduct] = useState(project.product);
  const [more, setMore] = useState(false);
  useEffect(() => { setProduct(project.product); }, [project.id]);
  const setField = <K extends keyof typeof product>(key: K, value: (typeof product)[K]) => {
    setProduct((current) => {
      const next = { ...current, [key]: value };
      saveFounderProduct(project.id, next);
      return next;
    });
  };
  const categories = ["Outerwear", "Dresses", "Tops", "Trousers", "Knitwear", "Skirts", "Shoes", "Bags", "Accessories"];
  return <View style={styles.productCard}>
    <TextInput value={product.name} onChangeText={(value) => setField("name", value)} placeholder="What’s the piece?" placeholderTextColor={colors.muted} style={[styles.input, { marginTop: 0 }]} />
    <Text style={styles.fieldLabel}>CATEGORY</Text>
    <View style={styles.optionRow}>{categories.map((option) => <Pressable key={option} onPress={() => setField("category", option)} style={[styles.option, product.category === option && styles.optionOn]}><Text style={[styles.optionText, product.category === option && styles.optionTextOn]}>{option}</Text></Pressable>)}</View>
    <Pressable onPress={() => setMore((value) => !value)} style={styles.secondary}><Text style={styles.secondaryText}>{more ? "Hide extra spec" : "More · fit, fabric, maker notes"}</Text></Pressable>
    {more ? <>
      <TextInput value={product.silhouette} onChangeText={(value) => setField("silhouette", value)} placeholder="Silhouette" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={product.materials} onChangeText={(value) => setField("materials", value)} placeholder="Materials" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={product.colorway} onChangeText={(value) => setField("colorway", value)} placeholder="Colorway" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={product.sizes} onChangeText={(value) => setField("sizes", value)} placeholder="Size range" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={product.targetPrice} onChangeText={(value) => setField("targetPrice", value)} placeholder="Target price" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={product.productionQuestions} onChangeText={(value) => setField("productionQuestions", value)} placeholder="Notes for a maker · later" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.longInput]} />
    </> : null}
  </View>;
}

export function FounderStrategy({ project, colors }: { project: FounderProject; colors: FounderColors }) {
  const styles = make(colors);
  const [brief, setBrief] = useState(project.brief);
  const [identity, setIdentity] = useState(project.identity);
  useEffect(() => { setBrief(project.brief); setIdentity(project.identity); }, [project.id]);
  const persist = (nextBrief: typeof brief, nextIdentity: typeof identity) => {
    updateFounderProject(project.id, { brief: nextBrief, identity: nextIdentity, name: nextIdentity.workingName.trim() || project.name, stage: "idea" });
  };
  const setBriefField = <K extends keyof typeof brief>(key: K, value: (typeof brief)[K]) => {
    setBrief((current) => {
      const next = { ...current, [key]: value };
      persist(next, identity);
      return next;
    });
  };
  return <View style={styles.strategyCard}>
    <TextInput value={identity.workingName} onChangeText={(workingName) => setIdentity((current) => { const next = { ...current, workingName }; persist(brief, next); return next; })} placeholder="Name" placeholderTextColor={colors.muted} style={[styles.input, { marginTop: 0 }]} />
    <TextInput value={brief.audience} onChangeText={(value) => setBriefField("audience", value)} placeholder="Who it’s for" placeholderTextColor={colors.muted} style={styles.input} />
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
  const [showSettings, setShowSettings] = useState(false);
  const [cloudCapability, setCloudCapability] = useState<FounderCloudCapability>("unavailable");
  const [settingsName, setSettingsName] = useState("");
  const [settingsCountry, setSettingsCountry] = useState("");
  const activeProjects = projects.filter((item) => !item.archived);
  const archivedProjects = projects.filter((item) => item.archived);
  const project = activeProjects.find((item) => item.id === selectedId) || activeProjects[0];
  const board = project?.boards.find((item) => item.id === boardId) || project?.boards[0];
  useEffect(() => {
    if (hydrated && project && !showCreate) router.replace({ pathname: "/brand/founder/[stage]", params: { stage: simpleStageOf(project.stage), id: project.id } });
  }, [hydrated, project?.id, project?.stage, showCreate]);
  useEffect(() => {
    setSettingsName(project?.name || "");
    setSettingsCountry(project?.country || "");
  }, [project?.id, project?.name, project?.country]);
  useEffect(() => { setCloudCapability(founderCloudCapability()); }, [project?.id]);
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
      if (uri) appendFounderReference(project.id, board.id, await saveFounderPhotoReference(uri));
    } catch (error) {
      Alert.alert("Photo unavailable", error instanceof Error ? error.message : "We could not add that reference.");
    }
  }

  async function importWork() {
    if (!project || !board) {
      Alert.alert("Create a board first", "Choose a moodboard or sketch canvas, then import your existing work into it.");
      return;
    }
    try {
      const imported = await importFounderWork();
      if (!imported) return;
      const entry: FounderImportedWork = { id: `import-${Date.now()}`, uri: imported.uri, name: imported.name, kind: imported.kind, createdAt: Date.now() };
      updateFounderBoard(project.id, board.id, { imports: [...board.imports, entry] });
      Alert.alert("Imported into your board", imported.kind === "image" ? "Your work is now visible behind the editable canvas. Add notes, draw over it, or keep it as a reference." : "Your PDF is saved as a private reference on this board.");
    } catch (error) {
      Alert.alert("Import unavailable", error instanceof Error ? error.message : "We could not import that file right now.");
    }
  }

  if (!hydrated) return <View style={[stylesFor.page, { backgroundColor: palette.ink, paddingTop: insets.top + 24 }]}><Text style={stylesFor.muted}>Loading your studio…</Text></View>;

  return <View style={[stylesFor.page, { backgroundColor: palette.ink }]}>

    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48 }} keyboardShouldPersistTaps="handled">
      <View style={stylesFor.top}><Pressable onPress={() => router.back()} hitSlop={12}><Text style={stylesFor.back}>‹</Text></Pressable><Text style={stylesFor.topTitle}>Founder Studio</Text><View style={{ width: 36 }} /></View>
      <View style={stylesFor.hero}><Text style={stylesFor.kicker}>PRIVATE WORKSPACE</Text><Text style={stylesFor.title}>Start with the idea.</Text><Text style={stylesFor.lede}>Shape your first fashion direction before it becomes a public brand.</Text></View>

      {activeProjects.length > 0 ? <View style={{ paddingHorizontal: 20 }}><Text style={stylesFor.sectionLabel}>YOUR PRIVATE PROJECTS</Text>{activeProjects.map((item: FounderProject) => <Pressable key={item.id} onPress={() => { setSelectedId(item.id); setBoardId(""); }} style={[stylesFor.projectPicker, item.id === project?.id && stylesFor.projectPickerOn]}><View style={{ flex: 1 }}><Text style={stylesFor.projectName}>{item.name}</Text><Text style={stylesFor.projectMeta}>{item.boards.length} saved boards · {STAGE_LABELS[item.stage]} · private on this device</Text></View><Text style={stylesFor.chevron}>{item.id === project?.id ? "●" : "○"}</Text></Pressable>)}</View> : null}
      {archivedProjects.length > 0 ? <View style={{ paddingHorizontal: 20, marginTop: 12 }}><Text style={stylesFor.sectionLabel}>ARCHIVED PROJECTS</Text>{archivedProjects.map((item: FounderProject) => <Pressable key={item.id} onPress={() => archiveFounderProject(item.id, false)} style={stylesFor.projectPicker}><View style={{ flex: 1 }}><Text style={stylesFor.projectName}>{item.name}</Text><Text style={stylesFor.projectMeta}>Archived · tap to restore</Text></View><Text style={stylesFor.chevron}>↻</Text></Pressable>)}</View> : null}

      {!project || showCreate ? <View style={stylesFor.createCard}><Text style={stylesFor.cardTitle}>Create a private project</Text><Text style={stylesFor.cardBody}>This stays private on your device for now. It is not a public brand or a verification application.</Text><TextInput value={projectName} onChangeText={setProjectName} placeholder="Working name" placeholderTextColor={colors.muted} style={stylesFor.input} /><TextInput value={projectDescription} onChangeText={setProjectDescription} placeholder="What are you imagining?" placeholderTextColor={colors.muted} style={[stylesFor.input, { height: 76, textAlignVertical: "top", paddingTop: 14 }]} multiline /><Pressable onPress={createProject} style={stylesFor.primary}><Text style={stylesFor.primaryText}>Create project</Text></Pressable>{project ? <Pressable onPress={() => setShowCreate(false)} style={stylesFor.secondary}><Text style={stylesFor.secondaryText}>Cancel</Text></Pressable> : null}</View> : <View style={{ paddingHorizontal: 20 }}>
        <View style={stylesFor.progressCard}><View style={{ flex: 1 }}><Text style={stylesFor.sectionLabel}>CURRENT STAGE</Text><Text style={stylesFor.progressTitle}>{project.stage === "design" ? "Design your direction" : project.stage === "identity" ? "Build your identity" : project.stage === "product" ? "Shape your first product" : project.stage === "source" ? "Set up the foundations" : project.stage === "launch" ? "Prepare to launch" : "Capture the idea"}</Text><Text style={stylesFor.progressBody}>A saved board is a real step forward. Nothing here is treated as a business claim or a finished production spec.</Text></View><Text style={stylesFor.progressCount}>{Math.max(1, STAGES.indexOf(project.stage) + 1)}/{STAGES.length}</Text></View>
        <View style={workspaceStyles.taskCard}><View style={workspaceStyles.taskHeader}><View style={{ flex: 1 }}><Text style={stylesFor.sectionLabel}>NEXT ACTIONS</Text><Text style={stylesFor.progressTitle}>Keep the project moving.</Text></View><Text style={workspaceStyles.taskCount}>{project.tasks.filter((task) => task.status === "done").length}/{project.tasks.length}</Text></View>{project.tasks.map((task) => <Pressable key={task.id} onPress={() => updateFounderTask(project.id, task.id, task.status === "done" ? "todo" : "done")} style={workspaceStyles.workspaceTask}><View style={[workspaceStyles.taskCheck, task.status === "done" && workspaceStyles.taskCheckDone]}><Text style={workspaceStyles.taskCheckText}>{task.status === "done" ? "✓" : ""}</Text></View><View style={{ flex: 1 }}><Text style={[workspaceStyles.taskTitle, task.status === "done" && workspaceStyles.taskDone]}>{task.title}</Text><Text style={workspaceStyles.taskBody}>{task.body}</Text></View><Text style={workspaceStyles.taskStage}>{STAGE_LABELS[task.stage]}</Text></Pressable>)}</View>
        <Pressable onPress={() => setShowSettings((value) => !value)} style={workspaceStyles.settingsToggle}><Text style={stylesFor.secondaryText}>{showSettings ? "Hide project settings" : "Project settings"}</Text><Text style={workspaceStyles.settingsHint}>Private on this device · rename or add a market</Text></Pressable>
        {showSettings ? <View style={workspaceStyles.settingsCard}><Text style={stylesFor.fieldLabel}>PROJECT NAME</Text><TextInput value={settingsName} onChangeText={setSettingsName} onBlur={() => settingsName.trim() && updateFounderProject(project.id, { name: settingsName.trim() })} placeholder="Working name" placeholderTextColor={colors.muted} style={stylesFor.input} /><Text style={stylesFor.fieldLabel}>COUNTRY OR MARKET</Text><TextInput value={settingsCountry} onChangeText={setSettingsCountry} onBlur={() => updateFounderProject(project.id, { country: settingsCountry.trim() })} placeholder="Where will you start?" placeholderTextColor={colors.muted} style={stylesFor.input} /><Text style={stylesFor.fieldLabel}>CLOUD STORAGE BOUNDARY</Text><View style={workspaceStyles.cloudCard}><Text style={workspaceStyles.cloudTitle}>{cloudCapability === "ready-to-connect" ? "Secure backend is available" : cloudCapability === "sign-in-required" ? "Sign in to connect securely" : "Local-only mode"}</Text><Text style={workspaceStyles.settingsHint}>{cloudCapability === "ready-to-connect" ? "A signed-in Firebase session exists, but Founder Studio sync is not enabled in this build. Your project remains on this device." : cloudCapability === "sign-in-required" ? "Firebase configuration exists, but a signed-in account is required before private project sync can be considered." : "Firebase backend configuration is unavailable. Private Founder data remains stored locally and no credentials are collected here."}</Text></View><Text style={stylesFor.fieldLabel}>AUDIT TRAIL</Text><Text style={stylesFor.saveHint}>{project.auditLog.length} local change event(s) recorded · field names only · no credential values</Text><Text style={stylesFor.saveHint}>These are planning details only. A private project is not a legal registration or public brand.</Text></View> : null}
        <View style={stylesFor.stageRow}>{STAGES.map((stage, index) => <View key={stage} style={stylesFor.stageItem}><View style={[stylesFor.stageDot, index <= STAGES.indexOf(project.stage) && stylesFor.stageDotOn]} /><Text style={stylesFor.stageText}>{STAGE_LABELS[stage]}</Text></View>)}</View>
        <FounderStrategy project={project} colors={colors} />
        <FounderProductEditor project={project} colors={colors} />
        <FounderSetupHub project={project} colors={colors} />
        <FounderProductionWorkspace project={project} colors={colors} />
        <FounderLaunchReview project={project} colors={colors} />
        <Text style={stylesFor.sectionLabel}>MAKE A BOARD</Text>
        <View style={stylesFor.actionRow}><Pressable onPress={() => newBoard("moodboard")} style={stylesFor.actionCard}><Text style={stylesFor.actionIcon}>＋</Text><Text style={stylesFor.actionTitle}>Moodboard</Text><Text style={stylesFor.actionBody}>Collect visual direction and color.</Text></Pressable><Pressable onPress={() => newBoard("sketch")} style={stylesFor.actionCard}><Text style={stylesFor.actionIcon}>✎</Text><Text style={stylesFor.actionTitle}>Sketch canvas</Text><Text style={stylesFor.actionBody}>Draw the first silhouette.</Text></Pressable></View>
        {board ? <View style={stylesFor.editor}><View style={stylesFor.editorHead}><View style={{ flex: 1 }}><Text style={stylesFor.sectionLabel}>{board.kind === "sketch" ? "SKETCH CANVAS" : "MOODBOARD"}</Text><TextInput value={board.name} onChangeText={(name) => updateFounderBoard(project.id, board.id, { name })} style={stylesFor.boardTitleInput} placeholder="Name this board" placeholderTextColor={colors.muted} /></View><Pressable onPress={() => void importWork()} style={stylesFor.smallButton}><Text style={stylesFor.smallButtonText}>＋ Import work</Text></Pressable></View>
          {board.kind === "sketch" ? <SketchBoard board={board} projectId={project.id} colors={colors} /> : <View style={stylesFor.moodboard}><View style={stylesFor.moodColors}>{board.colors.map((swatch) => <View key={swatch} style={[stylesFor.moodColor, { backgroundColor: swatch }]} />)}</View><TextInput value={board.notes} onChangeText={(notes) => updateFounderBoard(project.id, board.id, { notes })} placeholder="What should this collection feel like?" placeholderTextColor={colors.muted} multiline style={stylesFor.noteInput} />{board.references.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>{board.references.map((uri) => <Image key={uri} source={{ uri }} style={stylesFor.reference} contentFit="cover" />)}</ScrollView> : <Text style={stylesFor.empty}>Add a photo reference to start the board.</Text>}</View>}
          {board.kind === "sketch" && board.references.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginTop: 12 }}>{board.references.map((uri) => <Image key={uri} source={{ uri }} style={stylesFor.reference} contentFit="cover" />)}</ScrollView> : null}
          {board.imports.length ? <View style={{ marginTop: 12, gap: 8 }}>{board.imports.map((item) => item.kind === "image" ? <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Image source={{ uri: item.uri }} style={{ width: 42, height: 42, borderRadius: 8 }} contentFit="cover" /><Text style={stylesFor.empty} numberOfLines={1}>{item.name} · editable reference</Text></View> : <Text key={item.id} style={stylesFor.empty}>▧ {item.name} · private reference</Text>)}</View> : null}
          <Text style={stylesFor.saveHint}>Saved locally as you work · {Math.round(canvasWidth)}px workspace</Text>
        </View> : <View style={stylesFor.emptyCard}><Text style={stylesFor.emptyTitle}>Your first board goes here.</Text><Text style={stylesFor.empty}>Choose a moodboard or sketch canvas above. Your work stays private until you choose to use it.</Text></View>}
        <View><Pressable onPress={() => setShowCreate(true)} style={stylesFor.addProject}><Text style={stylesFor.secondaryText}>＋ Start another project</Text></Pressable><Pressable onPress={() => Alert.alert("Archive this project?", "Your private project will remain on this device and can be restored from Archived projects.", [{ text: "Cancel", style: "cancel" }, { text: "Archive", style: "destructive", onPress: () => { archiveFounderProject(project.id, true); setSelectedId(""); } }])} style={{ alignItems: "center", paddingBottom: 20 }}><Text style={{ color: colors.muted, fontSize: 12 }}>Archive current project</Text></Pressable></View>
      </View>}
    </ScrollView>
  </View>;
}

export const make = (colors: FounderColors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink }, muted: { color: colors.muted, paddingHorizontal: 20 }, top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 10 }, back: { color: colors.ink, fontSize: 36, lineHeight: 38 }, topTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" }, hero: { padding: 20, paddingTop: 22, paddingBottom: 28 }, kicker: { color: colors.accent, fontSize: 11, letterSpacing: 2.5, fontWeight: "800" }, title: { color: colors.ink, fontFamily: "Georgia", fontSize: 34, marginTop: 12 }, lede: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 8, maxWidth: 440 }, sectionLabel: { color: colors.muted, fontSize: 11, letterSpacing: 1.8, fontWeight: "800", marginBottom: 9 }, projectPicker: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.lineColor, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 8 }, projectPickerOn: { borderColor: colors.accent }, projectName: { color: colors.ink, fontSize: 16, fontWeight: "800" }, projectMeta: { color: colors.muted, fontSize: 12, marginTop: 4 }, chevron: { color: colors.accent, fontSize: 14 }, createCard: { margin: 20, backgroundColor: colors.card, borderColor: colors.lineColor, borderWidth: 1, borderRadius: 22, padding: 18 }, cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" }, cardBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 14 }, input: { borderWidth: 1, borderColor: colors.lineColor, backgroundColor: colors.card, color: colors.ink, borderRadius: 14, paddingHorizontal: 14, height: 50, marginTop: 10, fontSize: 16 }, primary: { height: 50, borderRadius: 25, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginTop: 14 }, primaryText: { color: colors.accentInk, fontWeight: "900", fontSize: 15 }, secondary: { alignItems: "center", padding: 13 }, secondaryText: { color: colors.ink, fontWeight: "800", fontSize: 14 }, progressCard: { backgroundColor: colors.card, borderRadius: 20, padding: 16, flexDirection: "row", borderWidth: 1, borderColor: colors.lineColor }, progressTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" }, progressBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }, progressCount: { color: colors.accent, fontSize: 22, fontWeight: "900" }, stageRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 18 }, stageItem: { alignItems: "center", gap: 5 }, stageDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lineColor }, stageDotOn: { backgroundColor: colors.accent }, stageText: { color: colors.muted, fontSize: 10 }, actionRow: { flexDirection: "row", gap: 10, marginBottom: 20 }, actionCard: { flex: 1, backgroundColor: colors.card, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: colors.lineColor, minHeight: 130 }, actionIcon: { color: colors.accent, fontSize: 28 }, actionTitle: { color: colors.ink, fontWeight: "800", fontSize: 15, marginTop: 7 }, actionBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }, editor: { backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.lineColor }, editorHead: { flexDirection: "row", alignItems: "center", marginBottom: 10 }, boardTitleInput: { color: colors.ink, fontSize: 21, fontWeight: "800", paddingVertical: 0 }, smallButton: { borderWidth: 1, borderColor: colors.lineColor, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 }, smallButtonText: { color: colors.ink, fontWeight: "800", fontSize: 12 }, canvas: { height: 430, borderRadius: 16, borderWidth: 1, overflow: "hidden", position: "relative" }, canvasHint: { position: "absolute", top: 16, left: 16, fontSize: 12 }, stroke: { position: "absolute", borderRadius: 4, transformOrigin: "left center" as never }, toolRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }, historyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }, swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2 }, toolButton: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginLeft: "auto" }, toolText: { fontSize: 12, fontWeight: "800" }, moodboard: { minHeight: 230 }, moodColors: { flexDirection: "row", gap: 10, marginVertical: 14 }, moodColor: { height: 52, flex: 1, borderRadius: 13 }, noteInput: { minHeight: 86, color: colors.ink, fontSize: 15, lineHeight: 21, padding: 0, textAlignVertical: "top" }, reference: { width: 112, height: 140, borderRadius: 14, backgroundColor: colors.ink }, empty: { color: colors.muted, fontSize: 13, lineHeight: 19 }, saveHint: { color: colors.muted, fontSize: 11, marginTop: 14 }, emptyCard: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineColor, borderRadius: 18, padding: 18 }, emptyTitle: { color: colors.ink, fontWeight: "800", fontSize: 16, marginBottom: 6 }, addProject: { alignItems: "center", paddingVertical: 24 }, boardCard: { flexDirection: "row", gap: 12, borderRadius: 18, borderWidth: 1, padding: 12, marginBottom: 8 }, boardPreview: { width: 58, height: 68, borderRadius: 12, overflow: "hidden", position: "relative" }, previewDot: { width: 26, height: 26, borderRadius: 13, margin: 16 }, boardKind: { fontSize: 10, letterSpacing: 1.2, fontWeight: "800" }, boardName: { fontSize: 16, fontWeight: "800", marginTop: 4 }, boardMeta: { fontSize: 12, marginTop: 5 }, strategyCard: { backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.lineColor, marginBottom: 20 }, productCard: { backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.lineColor, marginBottom: 20 }, launchCard: { backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.lineColor, marginBottom: 20 }, productionCard: { backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.lineColor, marginBottom: 20 }, productionGrid: { flexDirection: "row", gap: 10 }, productionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 }, subsectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" }, innerCard: { backgroundColor: colors.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.lineColor, marginBottom: 10 }, supplierRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 15, borderWidth: 1, borderColor: colors.lineColor, marginTop: 8 }, compareCard: { marginTop: 8, borderWidth: 1, borderColor: colors.lineColor, borderRadius: 16, padding: 12 }, compareRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.lineColor }, compareName: { color: colors.ink, fontSize: 14, fontWeight: "800" }, statusPill: { color: colors.accent, fontSize: 10, fontWeight: "900", textTransform: "uppercase", maxWidth: 90, textAlign: "right" }, sampleAdd: { flexDirection: "row", alignItems: "center", gap: 8 }, milestoneRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.lineColor }, launchChecks: { gap: 10, marginTop: 12 }, launchCheck: { flexDirection: "row", gap: 11, alignItems: "flex-start" }, versionList: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.lineColor }, versionRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.lineColor }, versionTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" }, versionMeta: { color: colors.muted, fontSize: 11, marginTop: 3 }, handoffHint: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 9 }, primaryMuted: { backgroundColor: colors.lineColor }, primaryMutedText: { color: colors.muted }, setupCard: { backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.lineColor, marginBottom: 20 }, taskList: { gap: 8, marginTop: 12 }, integrationList: { gap: 8, marginTop: 8 }, integrationRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 15, borderWidth: 1, borderColor: colors.lineColor, backgroundColor: colors.card }, setupTask: { flexDirection: "row", gap: 11, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.lineColor, backgroundColor: colors.card }, setupTaskDone: { borderColor: colors.accent, backgroundColor: colors.card }, taskCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.lineColor, alignItems: "center", justifyContent: "center", marginTop: 1 }, taskCheckDone: { backgroundColor: colors.accent, borderColor: colors.accent }, taskCheckText: { color: colors.accentInk, fontSize: 15, fontWeight: "900" }, taskCategory: { color: colors.accent, fontSize: 9, letterSpacing: 1.4, fontWeight: "900" }, taskTitle: { color: colors.ink, fontSize: 15, fontWeight: "800", marginTop: 3 }, taskBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }, resourceCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: colors.lineColor, marginTop: 8 }, resourceTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" }, resourceBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }, resourceArrow: { color: colors.accent, fontSize: 22, fontWeight: "800" }, longInput: { height: 92, textAlignVertical: "top", paddingTop: 14 }, fieldLabel: { color: colors.muted, fontSize: 10, letterSpacing: 1.6, fontWeight: "800", marginTop: 14, marginBottom: 8 }, optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, option: { borderWidth: 1, borderColor: colors.lineColor, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 9 }, optionOn: { backgroundColor: colors.accent, borderColor: colors.accent }, optionText: { color: colors.ink, fontSize: 12, fontWeight: "700" }, optionTextOn: { color: colors.accentInk }, identitySwatches: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }, identitySwatch: { width: 42, height: 42, borderRadius: 12 }, readinessRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 }, readinessCount: { color: colors.accent, fontSize: 13, fontWeight: "900" },
});
