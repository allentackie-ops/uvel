import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { useEffect, useState } from "react";
import { applyFounderReviewResult, openFounderBrand, submitFounderReview } from "./brands";
import { updateFounderProject, type FounderProject } from "./founder";
import type { BrandReview } from "./brandVerify";
import type { FounderFiling } from "./founderReview";
import { armNotificationHandler } from "./push";

const KEY = "uvel-founder-desk-v1";
export const FOUNDER_REVIEW_WAIT_MS = 10 * 60 * 1000;

export type FounderDeskNotice = "submitted" | "accepted" | "rejected";

export type FounderDeskJob = {
  id: string;
  brandId: string;
  projectId: string;
  name: string;
  handle: string;
  submittedAt: number;
  revealAt: number;
  phase: "reviewing" | "accepted" | "rejected";
  headline: string;
  reasons: string[];
  notice: FounderDeskNotice | null;
  delivered: boolean;
  filing: FounderFiling;
};

let job: FounderDeskJob | null = null;
let hydrated = false;
const listeners = new Set<() => void>();
let revealTimer: ReturnType<typeof setTimeout> | null = null;
let appStateArmed = false;

function emit() {
  listeners.forEach((listener) => listener());
}

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(job));
  } catch {
    /* in-memory still holds the desk */
  }
}

async function hydrate() {
  if (hydrated) return job;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    job = raw ? (JSON.parse(raw) as FounderDeskJob) : null;
  } catch {
    job = null;
  }
  emit();
  return job;
}

export function getFounderDeskJob() {
  return job;
}

export function useFounderDeskJob() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    void hydrate().then(() => void armFounderDesk());
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return job;
}

function patch(next: Partial<FounderDeskJob>) {
  if (!job) return;
  job = { ...job, ...next };
  void persist();
  emit();
}

async function scheduleDecisionNotice(seconds: number, next: FounderDeskJob) {
  try {
    armNotificationHandler();
    const Notifications = await import("expo-notifications");
    await Notifications.cancelScheduledNotificationAsync(`founder-desk-${next.id}`).catch(() => undefined);
    if (seconds <= 0) return;
    await Notifications.scheduleNotificationAsync({
      identifier: `founder-desk-${next.id}`,
      content: {
        title: next.phase === "accepted" ? `${next.name} is on Uvel` : next.phase === "rejected" ? `We couldn’t take ${next.name}` : `${next.name} is in review`,
        body:
          next.phase === "accepted"
            ? "Open Brand HQ to dress the page."
            : next.phase === "rejected"
              ? next.headline || "See why, then send again."
              : "We’ll let you know when the review is done.",
        sound: "default",
        data: { kind: "founder_desk", jobId: next.id, brandId: next.brandId, phase: next.phase },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)), repeats: false },
    });
  } catch {
    /* local notices still work in-app */
  }
}

async function deliverDecision(forceInApp: boolean) {
  if (!job || job.delivered || job.phase === "reviewing") return;
  const accepted = job.phase === "accepted";
  applyFounderReviewResult(job.brandId, {
    ok: accepted,
    decision: accepted ? "uvel_reviewed" : "rejected",
    headline: job.headline,
    reasons: job.reasons,
    notes: "",
  });
  updateFounderProject(job.projectId, { handoffStatus: accepted ? "submitted" : "rejected" });
  const active = AppState.currentState === "active";
  patch({
    delivered: true,
    notice: forceInApp || active ? (accepted ? "accepted" : "rejected") : job.notice,
  });
  if (!active && !forceInApp) {
    await scheduleDecisionNotice(1, job);
  }
}

function armRevealTimer() {
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = null;
  if (!job || job.delivered) return;
  const wait = Math.max(0, job.revealAt - Date.now());
  revealTimer = setTimeout(() => {
    void revealFounderDesk();
  }, wait);
}

export async function revealFounderDesk() {
  await hydrate();
  if (!job) return;
  if (job.phase === "reviewing") {
    if (Date.now() < job.revealAt) {
      armRevealTimer();
      return;
    }
    await runFounderDeskReview();
  }
  if (!job || job.phase === "reviewing") return;
  if (Date.now() < job.revealAt) {
    armRevealTimer();
    await scheduleDecisionNotice((job.revealAt - Date.now()) / 1000, job);
    return;
  }
  await deliverDecision(true);
}

async function runFounderDeskReview() {
  if (!job || job.phase !== "reviewing") return;
  try {
    const result: BrandReview = await submitFounderReview(job.brandId, job.filing, { apply: false });
    const accepted = result.ok && result.decision === "uvel_reviewed";
    patch({
      phase: accepted ? "accepted" : "rejected",
      headline: result.headline || (accepted ? "Uvel review complete." : "This filing was rejected"),
      reasons: result.reasons || [],
    });
  } catch {
    patch({
      phase: "rejected",
      headline: "We couldn’t finish the review",
      reasons: ["Try sending again in a moment."],
    });
  }
}

export async function startFounderDesk(input: {
  project: FounderProject;
  uid: string;
  displayName: string;
  avatarUri?: string;
  country?: string;
}) {
  await hydrate();
  const name = (input.project.identity.workingName || input.project.name).trim();
  const photo = input.project.boards[0]?.references[0] || input.project.boards[0]?.imports.find((item) => item.kind === "image")?.uri;
  updateFounderProject(input.project.id, {
    name,
    identity: { ...input.project.identity, workingName: name },
    handoffStatus: "in-review",
  });
  const brand = await openFounderBrand({
    name,
    audience: input.project.brief.audience,
    story: input.project.identity.story || input.project.brief.story || input.project.brief.audience,
    vertical: input.project.product.category || "Unisex",
    country: input.project.country || input.country || "US",
    ownerId: input.uid,
    ownerName: input.displayName || "Owner",
    ownerPhoto: input.avatarUri,
    logoUri: photo,
  });
  const now = Date.now();
  job = {
    id: `fd-${now.toString(36)}`,
    brandId: brand.id,
    projectId: input.project.id,
    name,
    handle: brand.handle,
    submittedAt: now,
    revealAt: now + FOUNDER_REVIEW_WAIT_MS,
    phase: "reviewing",
    headline: "",
    reasons: [],
    notice: "submitted",
    delivered: false,
    filing: {
      name,
      handle: brand.handle,
      piece: input.project.product.name.trim(),
      category: input.project.product.category,
      audience: input.project.brief.audience,
      story: [input.project.brief.audience, input.project.identity.story, input.project.brief.story].filter(Boolean).join("\n"),
      photos: [photo, brand.logoUri].filter(Boolean) as string[],
      brandId: brand.id,
    },
  };
  await persist();
  emit();
  await scheduleDecisionNotice(FOUNDER_REVIEW_WAIT_MS / 1000, job);
  armRevealTimer();
  void runFounderDeskReview().then(() => {
    if (job && job.phase !== "reviewing") {
      const wait = Math.max(1, (job.revealAt - Date.now()) / 1000);
      void scheduleDecisionNotice(wait, job);
      armRevealTimer();
    }
  });
  return job;
}

export function dismissFounderDeskNotice() {
  if (!job) return;
  patch({ notice: null });
}

export function founderDeskRoute(next: FounderDeskJob) {
  if (next.phase === "accepted") return { pathname: "/brand/hq" as const, params: { id: next.brandId } };
  return { pathname: "/brand/decision" as const, params: { id: next.brandId } };
}

export async function armFounderDesk() {
  await hydrate();
  armNotificationHandler();
  if (!appStateArmed) {
    appStateArmed = true;
    AppState.addEventListener("change", (state) => {
      if (state === "active") void revealFounderDesk();
    });
  }
  if (!job) return;
  if (!job.delivered && Date.now() >= job.revealAt) {
    void revealFounderDesk();
    return;
  }
  armRevealTimer();
}
