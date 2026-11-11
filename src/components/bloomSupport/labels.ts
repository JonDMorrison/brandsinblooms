import { labelFor } from "@/components/admin/readableFormat";
import { PRODUCT_LABEL, STATUS_LABEL, type SupportStatus } from "@/lib/bloomSupport/api";

/** Plain-English labels for Bloom Support codes shown to staff. */
export const ENGINEERING_TEXT: Record<string, string> = {
  open: "Reported, not started yet",
  investigating: "Investigating",
  reproduced: "Bug reproduced",
  not_reproduced: "Could not reproduce the bug",
  fixing: "Writing the fix",
  awaiting_approval: "Fix ready and tested, waiting for approval",
  approved: "Fix approved, waiting to release",
  merging: "Releasing the fix",
  deploying: "Releasing the fix",
  verifying: "Checking the fix on the live site",
  verified: "Fix is live and checked",
  failed: "The fix attempt failed",
  rolled_back: "Fix rolled back",
  escalated: "Needs a person",
};

export type FixStageTone = "neutral" | "primary" | "warning" | "success" | "danger";

/** The fix's progress in one word-pair a person can scan: Not started, In progress, Needs approval, Fixed or Needs a person. */
export function fixStage(status: string): { label: string; tone: FixStageTone } {
  switch (status) {
    case "open":
      return { label: "Not started", tone: "neutral" };
    case "awaiting_approval":
      return { label: "Needs approval", tone: "warning" };
    case "verified":
      return { label: "Fixed", tone: "success" };
    case "not_reproduced":
    case "failed":
    case "rolled_back":
    case "escalated":
      return { label: "Needs a person", tone: "warning" };
    default:
      return { label: "In progress", tone: "primary" };
  }
}

export const FEATURE_STATUS: Record<string, string> = {
  awaiting_decision: "Waiting for a decision",
  accepted: "We'll build it",
  planned: "On the plan",
  declined: "Not now",
  delivered: "Built",
};

export const PROBLEM_STATUS: Record<string, string> = { open: "Open", investigating: "Being looked into", monitoring: "Watching", resolved: "Solved", closed: "Closed" };

export const PRIORITY_LABEL: Record<string, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

export const engineeringLabel = (s: unknown) => ENGINEERING_TEXT[String(s)] ?? labelFor(String(s));
export const featureLabel = (s: unknown) => FEATURE_STATUS[String(s)] ?? labelFor(String(s));
export const problemLabel = (s: unknown) => PROBLEM_STATUS[String(s)] ?? labelFor(String(s));
export const reasonLabel = (s: unknown) => labelFor(String(s));
export const ticketStatusLabel = (s: unknown) => STATUS_LABEL[String(s) as SupportStatus] ?? labelFor(String(s));

/** Labels for the "open by …" breakdowns in Reports. */
export const OPEN_BY: Record<"status" | "priority" | "product", { title: string; value: (k: string) => string }> = {
  status: { title: "Open requests by status", value: (k) => ticketStatusLabel(k) },
  priority: { title: "Open requests by priority", value: (k) => PRIORITY_LABEL[k] ?? labelFor(k) },
  product: { title: "Open requests by product", value: (k) => PRODUCT_LABEL[k] ?? labelFor(k) },
};
