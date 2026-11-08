/** Support Desk navigation and header state. Pure: no React, no I/O. */

export type DeskView =
  | "today" | "queue" | "escalations" | "clients" | "reports"
  | "features" | "knowledge" | "problems" | "engineering" | "operations" | "readiness" | "settings";

/** Destinations used every day. Everything else lives under "More". */
export const MAIN_VIEWS: Array<{ value: DeskView; label: string }> = [
  { value: "today", label: "Today" },
  { value: "queue", label: "Requests" },
  { value: "escalations", label: "Decisions" },
  { value: "clients", label: "Clients" },
  { value: "reports", label: "Reports" },
];

export const MORE_VIEWS: Array<{ value: DeskView; label: string; short: string }> = [
  { value: "features", label: "Feature requests", short: "Ideas clients asked for, and who asked" },
  { value: "knowledge", label: "Saved answers", short: "Approved answers Bloom can reuse" },
  { value: "problems", label: "Shared problems", short: "One issue affecting several clients" },
  { value: "engineering", label: "Fixes in progress", short: "Bugs Bloom is investigating or fixing" },
  { value: "operations", label: "Account changes", short: "Look up or change a client's settings" },
  { value: "readiness", label: "System status", short: "Is Bloom running, and what needs setup" },
  { value: "settings", label: "Settings", short: "People, owners, notifications, automation" },
];

const ALL_VIEWS = new Set<string>([...MAIN_VIEWS, ...MORE_VIEWS].map((v) => v.value));

/** Reads a view from the URL. Unknown values fall back to Today so old links never show a blank page. */
export function parseDeskView(value: string | null): DeskView {
  return value && ALL_VIEWS.has(value) ? (value as DeskView) : "today";
}

/** The parts of /summary the header reads. Every value is optional because the summary may still be loading. */
export interface DeskSummary {
  automation_enabled?: unknown;
  dead_jobs?: unknown;
  queued?: unknown;
  running?: unknown;
  by_status?: unknown;
  open_escalations?: unknown;
}

export type DeskAlertTarget = "settings" | "decisions" | "urgent";
export type DeskAlertKind = "paused" | "failed" | "urgent" | "admin";

export interface DeskAlert {
  kind: DeskAlertKind;
  tone: "danger" | "warning";
  title: string;
  body: string;
  action: string;
  target: DeskAlertTarget;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v ?? 0) || 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Only exceptional states reach the header: Bloom paused, failed automatic steps,
 * urgent requests, and requests that need an admin. Normal counts stay off it.
 */
export function deskAlerts(summary: DeskSummary | undefined, urgent: number): DeskAlert[] {
  if (!summary) return [];
  const alerts: DeskAlert[] = [];
  if (summary.automation_enabled === false) {
    alerts.push({ kind: "paused", tone: "danger", title: "Bloom is paused", body: "No automatic replies, checks or fixes are running. Requests wait for a person.", action: "Open settings", target: "settings" });
  }
  const dead = num(summary.dead_jobs);
  if (dead > 0) {
    alerts.push({ kind: "failed", tone: "danger", title: `${plural(dead, "automatic step", "automatic steps")} failed this week`, body: "Bloom stopped retrying these. Retry or cancel them in settings.", action: "Review failures", target: "settings" });
  }
  if (urgent > 0) {
    alerts.push({ kind: "urgent", tone: "danger", title: `${plural(urgent, "urgent request", "urgent requests")} open`, body: "These are marked urgent. Check that each one is moving.", action: "See urgent requests", target: "urgent" });
  }
  const byStatus = (summary.by_status ?? {}) as Record<string, unknown>;
  const needsAdmin = num(byStatus.needs_owner);
  if (needsAdmin > 0) {
    alerts.push({ kind: "admin", tone: "warning", title: `${plural(needsAdmin, "request needs", "requests need")} an admin`, body: "Bloom cannot move these forward without an admin's decision.", action: "See decisions", target: "decisions" });
  }
  return alerts;
}

/** What Bloom is doing right now, in one short phrase. */
export function bloomState(summary: DeskSummary | undefined, failed: boolean): { tone: "primary" | "danger" | "neutral"; label: string } {
  if (failed) return { tone: "neutral", label: "Bloom's status is unavailable" };
  if (!summary) return { tone: "neutral", label: "Checking on Bloom…" };
  if (summary.automation_enabled === false) return { tone: "danger", label: "Bloom is paused" };
  const active = num(summary.running) + num(summary.queued);
  return { tone: "primary", label: active > 0 ? `Bloom is working on ${plural(active, "step", "steps")}` : "Bloom is on and ready" };
}
