// Pure helpers for the /publish "Last 30 days" filter. Extracted from
// PublishPage so the math is unit-testable without rendering the page.
//
// Default-view behavior on /publish is to hide content_tasks older than
// RECENCY_WINDOW_MS days behind a "Show older items (N)" toggle. The
// rationale: tenants accumulate stale review-status content_tasks (Maple
// Park had a queue of 6-month-old Halloween content visible by default,
// which made the page feel broken to a May-2026 user). This filter does
// not delete or hide data permanently — it only drives the default view.

export const RECENCY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function isWithinRecencyWindow(
  createdAt: string | null | undefined,
  now: number = Date.now(),
  windowMs: number = RECENCY_WINDOW_MS,
): boolean {
  // Missing/unparseable timestamps are considered "in window" so the UI
  // never hides content that lacks a created_at — better to show extra
  // than to silently drop a row.
  if (!createdAt) return true;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return true;
  return now - t <= windowMs;
}
