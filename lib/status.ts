import type { Colors } from "./theme";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export function statusToneFor(value?: string | null): StatusTone {
  const normalized = String(value || "").toLowerCase().replace(/\s+/g, "_");
  if (["paid", "delivered", "succeeded", "approved", "refunded", "completed", "in_transit", "out_for_delivery", "live", "verified"].includes(normalized)) return "success";
  if (["pending", "processing", "requested", "refund_pending", "label_pending", "unfulfilled", "scheduled", "draft", "to_ship"].includes(normalized)) return "warning";
  if (["failed", "exception", "rejected", "canceled", "cancelled", "returned"].includes(normalized)) return "danger";
  if (["packed", "item_sent", "seen", "in_progress"].includes(normalized)) return "info";
  return "neutral";
}

export function semanticStatus(colors: Colors, tone: StatusTone) {
  const palette = {
    success: { backgroundColor: colors.success, color: colors.successInk, borderColor: colors.success },
    warning: { backgroundColor: colors.warning, color: colors.warningInk, borderColor: colors.warning },
    danger: { backgroundColor: colors.danger, color: colors.dangerInk, borderColor: colors.danger },
    info: { backgroundColor: colors.info, color: colors.infoInk, borderColor: colors.info },
    neutral: { backgroundColor: colors.neutral, color: colors.neutralInk, borderColor: colors.subtle },
  } satisfies Record<StatusTone, { backgroundColor: string; color: string; borderColor: string }>;
  return palette[tone];
}

export function semanticLabel(value?: string | null) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
