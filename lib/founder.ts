import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type FounderStage = "idea" | "identity" | "design" | "product" | "source" | "launch";
export type FounderBoardKind = "moodboard" | "sketch";
export type FounderPoint = { x: number; y: number };
export type FounderStroke = { id: string; color: string; width: number; points: FounderPoint[] };

export type FounderBoard = {
  id: string;
  name: string;
  kind: FounderBoardKind;
  notes: string;
  colors: string[];
  references: string[];
  strokes: FounderStroke[];
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
  colors: string[];
  typography: string;
  logoDirection: string;
};

export type FounderProject = {
  id: string;
  name: string;
  description: string;
  stage: FounderStage;
  brief: FounderBrief;
  identity: FounderIdentity;
  boards: FounderBoard[];
  createdAt: number;
  updatedAt: number;
};

export const emptyFounderBrief = (): FounderBrief => ({ audience: "", category: "", pricePosition: "not-set", promise: "", values: "", tone: "", story: "" });
export const defaultFounderIdentity = (): FounderIdentity => ({ colors: ["#D6E27A", "#F4F0E6", "#161512"], typography: "Warm editorial sans", logoDirection: "" });

function normalizeProject(project: FounderProject): FounderProject {
  return { ...project, brief: { ...emptyFounderBrief(), ...(project.brief || {}) }, identity: { ...defaultFounderIdentity(), ...(project.identity || {}) }, boards: project.boards || [] };
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
    stage: "idea",
    brief: emptyFounderBrief(),
    identity: defaultFounderIdentity(),
    boards: [],
    createdAt: now,
    updatedAt: now,
  };
  projects = [project, ...projects];
  void persist();
  return project;
}

export function getFounderProject(id?: string) {
  return id ? projects.find((project) => project.id === id) : projects[0];
}

export function updateFounderProject(id: string, patch: Partial<FounderProject>) {
  projects = projects.map((project) => project.id === id ? { ...project, ...patch, updatedAt: Date.now() } : project);
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
    createdAt: now,
    updatedAt: now,
  };
  projects = projects.map((project) => project.id === projectId ? { ...project, boards: [board, ...project.boards], stage: "design", updatedAt: now } : project);
  void persist();
  return board;
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
