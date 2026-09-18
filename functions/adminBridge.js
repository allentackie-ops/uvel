const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret, defineString } = require("firebase-functions/params");

const adminPortalUrl = defineString("UVEL_ADMIN_PORTAL_URL", { description: "Stable HTTPS URL of the Uvel admin portal" });
const adminBridgeSecret = defineSecret("UVEL_ADMIN_BRIDGE_SECRET");

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function priority(value) {
  const normalized = text(value, "normal");
  return ["low", "normal", "high", "urgent"].includes(normalized) ? normalized : "normal";
}

function portalUrl() {
  return text(adminPortalUrl.value()).replace(/\/$/, "");
}

async function sendToAdminPortal(payload) {
  const base = portalUrl();
  const secret = text(adminBridgeSecret.value());
  if (!base || !secret) {
    console.warn("[AdminBridge] UVEL_ADMIN_PORTAL_URL or UVEL_ADMIN_BRIDGE_SECRET is not configured; skipping sync.");
    return { skipped: true };
  }

  const response = await fetch(`${base}/api/integrations/uvel/reports`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-uvel-bridge-token": secret,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Admin portal rejected report (${response.status}): ${detail.slice(0, 240)}`);
  }
  return response.json().catch(() => ({ ok: true }));
}

function feedbackPayload(id, data) {
  return {
    externalId: `feedback:${id}`,
    source: "feedback",
    category: text(data.category, "technical"),
    subject: `Technical feedback on ${text(data.screen, "Uvel")}`,
    body: text(data.body, "No written description was provided."),
    screen: text(data.screen) || undefined,
    reporterEmail: text(data.userEmail) || undefined,
    reporterName: text(data.userName) || undefined,
    priority: "normal",
    metadata: { syncStatus: text(data.syncStatus), screenshotUri: text(data.screenshotUri) || undefined },
  };
}

function supportPayload(id, data) {
  const supportStatus = text(data.status, "open");
  const mappedStatus = supportStatus === "resolved" ? "resolved" : supportStatus === "closed" ? "closed" : supportStatus === "open" ? "open" : "in_progress";
  return {
    externalId: `support_case:${id}`,
    source: "support_case",
    category: text(data.category, "other"),
    subject: text(data.subject, `Support case ${id}`),
    body: text(data.lastMessage, `Support case for ${text(data.productName, "an order")}.`),
    reporterName: text(data.buyerName) || undefined,
    priority: priority(data.priority),
    status: mappedStatus,
    metadata: { caseId: id, brandId: text(data.brandId), orderId: text(data.orderId), supportStatus },
  };
}

function reviewPayload(id, data) {
  const reviewStatus = text(data.reviewStatus, text(data.status, "pending"));
  const normalizedPriority = reviewStatus === "rejected" ? "high" : "normal";
  const mappedStatus = reviewStatus === "approved" || data.verified === true ? "resolved" : reviewStatus === "rejected" ? "in_progress" : "open";
  return {
    externalId: `brand_review:${id}`,
    source: "brand_review",
    category: "brand_verification",
    subject: `Brand review: ${text(data.name, id)}`,
    body: reviewStatus === "rejected" ? text(data.rejectHeadline, "Brand review needs follow-up.") : `Brand ${reviewStatus} and awaiting admin review.`,
    priority: normalizedPriority,
    status: mappedStatus,
    metadata: { brandId: id, brandName: text(data.name), reviewStatus, verified: data.verified === true, rejectReasons: data.rejectReasons || [] },
  };
}

function reviewFieldsChanged(before, after) {
  const keys = ["reviewStatus", "status", "verified", "rejectReasons", "rejectHeadline"];
  return keys.some((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]));
}

exports.syncFeedbackToAdminPortal = onDocumentCreated({ document: "feedback/{feedbackId}", secrets: [adminBridgeSecret] }, async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  await sendToAdminPortal(feedbackPayload(event.params.feedbackId, snapshot.data() || {}));
});

exports.syncSupportCaseToAdminPortal = onDocumentWritten({ document: "supportCases/{caseId}", secrets: [adminBridgeSecret] }, async (event) => {
  const snapshot = event.data?.after;
  if (!snapshot?.exists) return;
  const before = event.data?.before?.data() || {};
  const after = snapshot.data() || {};
  if (event.data?.before?.exists && JSON.stringify(before) === JSON.stringify(after)) return;
  await sendToAdminPortal(supportPayload(event.params.caseId, after));
});

exports.syncBrandReviewToAdminPortal = onDocumentWritten({ document: "brands/{brandId}", secrets: [adminBridgeSecret] }, async (event) => {
  const snapshot = event.data?.after;
  if (!snapshot?.exists) return;
  const before = event.data?.before?.data() || {};
  const after = snapshot.data() || {};
  if (!reviewFieldsChanged(before, after)) return;
  const reviewStatus = text(after.reviewStatus, text(after.status));
  if (!reviewStatus || (!["pending", "approved", "rejected", "in_review"].includes(reviewStatus) && after.verified !== false)) return;
  await sendToAdminPortal(reviewPayload(event.params.brandId, after));
});
