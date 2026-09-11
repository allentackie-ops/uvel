import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type FounderStage = "idea" | "identity" | "design" | "product" | "source" | "launch";
export type FounderBoardKind = "moodboard" | "sketch";
export type FounderPoint = { x: number; y: number };
export type FounderStroke = { id: string; color: string; width: number; points: FounderPoint[] };
export type FounderCanvasTool = "draw" | "line" | "rectangle";
export type FounderImportedWork = { id: string; uri: string; name: string; kind: "image" | "document"; createdAt: number };

export type FounderBoard = {
  id: string;
  name: string;
  kind: FounderBoardKind;
  notes: string;
  colors: string[];
  references: string[];
  strokes: FounderStroke[];
  annotation: string;
  imports: FounderImportedWork[];
  createdAt: number;
  updatedAt: number;
};

export type FounderBrief = {
  audience: string;
  category: string;
  pricePosition: "accessible" | "mid-market" | "premium" | "not-set";
  promise: string;
  values: string;
  tone: string;
  story: string;
};

export type FounderIdentity = {
  workingName: string;
  handleIdeas: string;
  tone: string;
  story: string;
  colors: string[];
  typography: string;
  logoDirection: string;
  photographyDirection: string;
  packagingNotes: string;
};

export type FounderProductBrief = {
  name: string;
  category: string;
  silhouette: string;
  fit: string;
  materials: string;
  trims: string;
  colorway: string;
  sizes: string;
  measurements: string;
  construction: string;
  care: string;
  targetUnitCost: string;
  targetPrice: string;
  sampleQuantity: string;
  sampleStatus: "not-started" | "requested" | "received" | "changes-needed" | "approved";
  productionQuestions: string;
  boardId: string;
};

export type FounderProductSnapshot = FounderProductBrief & { version: number; savedAt: number };
export type FounderAuditEvent = { id: string; action: string; fields: string[]; createdAt: number };

export type FounderSetup = {
  completedTaskIds: string[];
  notes: string;
  launchDate: string;
  integrations: FounderIntegration[];
};

export type FounderIntegrationStatus = "not-started" | "preparing" | "connected" | "needs-attention" | "unavailable";
export type FounderIntegration = { id: string; label: string; outcome: string; status: FounderIntegrationStatus; notes: string };

export type FounderSupplierStatus = "researching" | "contacted" | "sample" | "shortlisted" | "passed";
export type FounderSampleStatus = "not-requested" | "requested" | "received" | "approved" | "changes-needed";
export type FounderProductionMilestoneStatus = "todo" | "in-progress" | "done";

export type FounderSupplier = {
  id: string;
  name: string;
  location: string;
  specialty: string;
  contact: string;
  minimumOrder: string;
  leadTime: string;
  quote: string;
  quoteCurrency: string;
  qualityNotes: string;
  status: FounderSupplierStatus;
  notes: string;
  attachments: FounderImportedWork[];
  createdAt: number;
  updatedAt: number;
};

export type FounderSample = {
  id: string;
  supplierId: string;
  name: string;
  status: FounderSampleStatus;
  cost: string;
  receivedAt: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type FounderProduction = {
  targetUnits: string;
  targetCost: string;
  currency: string;
  notes: string;
  suppliers: FounderSupplier[];
  samples: FounderSample[];
  milestones: { id: string; title: string; status: FounderProductionMilestoneStatus }[];
};

export type FounderTaskStatus = "todo" | "in-progress" | "done";
export type FounderTask = {
  id: string;
  title: string;
  body: string;
  stage: FounderStage;
  status: FounderTaskStatus;
};

export type FounderProject = {
  id: string;
  name: string;
  description: string;
  /** Founder projects are private planning records until explicitly handed off. */
  visibility: "private";
  /** Archived projects remain recoverable and never become public brand records. */
  archived: boolean;
  country: string;
  stage: FounderStage;
  tasks: FounderTask[];
  brief: FounderBrief;
  identity: FounderIdentity;
  product: FounderProductBrief;
  productVersions: FounderProductSnapshot[];
  handoffStatus: "not-started" | "in-review" | "submitted" | "rejected";
  cloudSyncStatus: "local-only" | "ready" | "synced" | "needs-auth" | "unavailable";
  lastSyncedAt?: number;
  auditLog: FounderAuditEvent[];
  setup: FounderSetup;
  production: FounderProduction;
  boards: FounderBoard[];
  createdAt: number;
  updatedAt: number;
};

export const emptyFounderBrief = (): FounderBrief => ({ audience: "", category: "", pricePosition: "not-set", promise: "", values: "", tone: "", story: "" });
export const defaultFounderIdentity = (): FounderIdentity => ({ workingName: "", handleIdeas: "", tone: "", story: "", colors: ["#D6E27A", "#F4F0E6", "#161512"], typography: "Warm editorial sans", logoDirection: "", photographyDirection: "", packagingNotes: "" });
export const emptyFounderProduct = (): FounderProductBrief => ({ name: "", category: "", silhouette: "", fit: "", materials: "", trims: "", colorway: "", sizes: "", measurements: "", construction: "", care: "", targetUnitCost: "", targetPrice: "", sampleQuantity: "", sampleStatus: "not-started", productionQuestions: "", boardId: "" });
export const defaultFounderIntegrations = (): FounderIntegration[] => [
  { id: "domain-email", label: "Domain & email", outcome: "A recognizable web address and professional inbox", status: "not-started", notes: "" },
  { id: "storefront", label: "Storefront", outcome: "A place where products can be sold", status: "not-started", notes: "" },
  { id: "payments", label: "Payments", outcome: "A safe way to accept money", status: "not-started", notes: "" },
  { id: "shipping", label: "Shipping & returns", outcome: "Rates, delivery, tracking, and returns", status: "not-started", notes: "" },
  { id: "social", label: "Social profiles", outcome: "A consistent public identity", status: "not-started", notes: "" },
  { id: "analytics", label: "Analytics", outcome: "Confirmed visits and purchases", status: "unavailable", notes: "Live analytics is unavailable until a real data connection exists." },
  { id: "support", label: "Customer support", outcome: "A reliable buyer contact route", status: "not-started", notes: "" },
];
export const emptyFounderSetup = (): FounderSetup => ({ completedTaskIds: [], notes: "", launchDate: "", integrations: defaultFounderIntegrations() });
export const emptyFounderProduction = (): FounderProduction => ({
  targetUnits: "",
  targetCost: "",
  currency: "USD",
  notes: "",
  suppliers: [],
  samples: [],
  milestones: [
    { id: "spec", title: "Lock the product spec", status: "todo" },
    { id: "supplier", title: "Choose a supplier to sample with", status: "todo" },
    { id: "sample", title: "Review the first sample", status: "todo" },
    { id: "cost", title: "Confirm cost and first run", status: "todo" },
  ],
});

export const defaultFounderTasks = (): FounderTask[] => [
  { id: "idea-brief", title: "Name the label", body: "A name and who it’s for.", stage: "idea", status: "todo" },
  { id: "product-brief", title: "Make the first piece", body: "A photo, a name, and a category.", stage: "product", status: "todo" },
  { id: "launch-checklist", title: "Apply as a brand", body: "When the name and the piece are there, apply.", stage: "launch", status: "todo" },
];

function normalizeProject(project: FounderProject): FounderProject {
  return { ...project, visibility: "private", archived: Boolean(project.archived), country: project.country || "", tasks: project.tasks?.length ? project.tasks : defaultFounderTasks(), brief: { ...emptyFounderBrief(), ...(project.brief || {}) }, identity: { ...defaultFounderIdentity(), ...(project.identity || {}) }, product: { ...emptyFounderProduct(), ...(project.product || {}) }, productVersions: project.productVersions || [], handoffStatus: project.handoffStatus || "not-started", cloudSyncStatus: project.cloudSyncStatus || "local-only", lastSyncedAt: project.lastSyncedAt, auditLog: project.auditLog || [], setup: { ...emptyFounderSetup(), ...(project.setup || {}), integrations: project.setup?.integrations?.length ? project.setup.integrations : defaultFounderIntegrations() }, production: { ...emptyFounderProduction(), ...(project.production || {}), suppliers: (project.production?.suppliers || []).map((supplier) => ({ ...supplier, contact: supplier.contact || "", quote: supplier.quote || "", quoteCurrency: supplier.quoteCurrency || "USD", qualityNotes: supplier.qualityNotes || "", attachments: supplier.attachments || [] })), samples: project.production?.samples || [], milestones: project.production?.milestones?.length ? project.production.milestones : emptyFounderProduction().milestones }, boards: (project.boards || []).map((board) => ({ ...board, annotation: board.annotation || "", imports: board.imports || [] })) };
}

const KEY = "uvel-founder-projects-v1";
let projects: FounderProject[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function persist() {
  await AsyncStorage.setItem(KEY, JSON.stringify(projects));
  emit();
}

async function hydrate() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    projects = raw ? (JSON.parse(raw) as FounderProject[]).map(normalizeProject) : [];
  } catch {
    projects = [];
  }
  hydrated = true;
  emit();
}
void hydrate();

export function useFounderProjects() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return { projects, hydrated };
}

export function createFounderProject(name: string, description = "") {
  const now = Date.now();
  const project: FounderProject = {
    id: uid("founder"),
    name: name.trim() || "Untitled label",
    description: description.trim(),
    visibility: "private",
    archived: false,
    country: "",
    stage: "idea",
    tasks: defaultFounderTasks(),
    brief: emptyFounderBrief(),
    identity: { ...defaultFounderIdentity(), workingName: name.trim() },
    product: emptyFounderProduct(),
    productVersions: [],
    handoffStatus: "not-started",
    cloudSyncStatus: "local-only",
    auditLog: [],
    setup: emptyFounderSetup(),
    production: emptyFounderProduction(),
    boards: [],
    createdAt: now,
    updatedAt: now,
  };
  projects = [project, ...projects];
  void persist();
  return project;
}

export function ideaReady(project: FounderProject) {
  return Boolean((project.identity.workingName || project.name).trim() && project.brief.audience.trim());
}

export function pieceReady(project: FounderProject) {
  return Boolean(project.product.name.trim() && project.product.category.trim());
}

export function applyReady(project: FounderProject) {
  return ideaReady(project) && pieceReady(project);
}

export function simpleStageOf(stage: string): "idea" | "product" | "launch" {
  if (stage === "product" || stage === "design") return "product";
  if (stage === "launch" || stage === "source") return "launch";
  return "idea";
}

export function getFounderProject(id?: string) {
  return id ? projects.find((project) => project.id === id) : projects[0];
}

export function archiveFounderProject(id: string, archived: boolean) {
  updateFounderProject(id, { archived });
}

export function updateFounderTask(projectId: string, taskId: string, status: FounderTaskStatus) {
  const project = getFounderProject(projectId);
  if (!project) return;
  updateFounderProject(projectId, { tasks: project.tasks.map((task) => task.id === taskId ? { ...task, status } : task) });
}

export function saveFounderProduct(projectId: string, product: FounderProductBrief) {
  const project = getFounderProject(projectId);
  if (!project) return;
  const changed = JSON.stringify(project.product) !== JSON.stringify(product);
  const nextVersion = project.productVersions.length ? Math.max(...project.productVersions.map((item) => item.version)) + 1 : 1;
  updateFounderProject(projectId, { product, stage: "product", productVersions: changed ? [...project.productVersions, { ...product, version: nextVersion, savedAt: Date.now() }].slice(-10) : project.productVersions });
}

export function updateFounderProject(id: string, patch: Partial<FounderProject>) {
  const now = Date.now();
  projects = projects.map((project) => project.id === id ? { ...project, ...patch, updatedAt: now, auditLog: [...project.auditLog, { id: `audit-${now}-${Math.random().toString(36).slice(2, 6)}`, action: "project-update", fields: Object.keys(patch).filter((field) => field !== "auditLog"), createdAt: now }].slice(-100) } : project);
  void persist();
}

export function createFounderBoard(projectId: string, kind: FounderBoardKind, name?: string) {
  const now = Date.now();
  const board: FounderBoard = {
    id: uid("board"),
    name: name?.trim() || (kind === "sketch" ? "First garment sketch" : "Untitled moodboard"),
    kind,
    notes: "",
    colors: ["#D6E27A", "#F4F0E6", "#161512"],
    references: [],
    strokes: [],
    annotation: "",
    imports: [],
    createdAt: now,
    updatedAt: now,
  };
  projects = projects.map((project) => project.id === projectId ? { ...project, boards: [board, ...project.boards], stage: "design", updatedAt: now } : project);
  void persist();
  return board;
}

export function updateFounderProduction(projectId: string, production: FounderProduction) {
  updateFounderProject(projectId, { production, stage: "source" });
}

export function updateFounderBoard(projectId: string, boardId: string, patch: Partial<FounderBoard>) {
  projects = projects.map((project) => project.id !== projectId ? project : {
    ...project,
    updatedAt: Date.now(),
    boards: project.boards.map((board) => board.id === boardId ? { ...board, ...patch, updatedAt: Date.now() } : board),
  });
  void persist();
}

export function appendFounderReference(projectId: string, boardId: string, uri: string) {
  const project = getFounderProject(projectId);
  const board = project?.boards.find((item) => item.id === boardId);
  if (!board || board.references.includes(uri)) return;
  updateFounderBoard(projectId, boardId, { references: [...board.references, uri].slice(-12) });
}

export function replaceFounderProjects(next: FounderProject[]) {
  projects = next;
  void persist();
}
