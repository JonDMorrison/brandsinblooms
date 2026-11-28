/**
 * Decides which segments a form submission may join.
 *
 * Segment ids come from the saved form (audience_json.segment_ids and the
 * Segment Opt-In field options). They are never trusted as-is: every id is
 * checked against crm_segments for the form's own tenant before a
 * customer_segments row is written.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FormSegmentSkipReason =
  "invalid_id" | "not_found" | "deleted" | "inactive" | "dynamic";

export interface FormSegmentRow {
  id: string;
  name: string | null;
  tenant_id: string | null;
  auto_update: boolean | null;
  status: string | null;
  deleted_at: string | null;
}

export interface FormSegmentDecision {
  assignable: Array<{ id: string; name: string }>;
  skipped: Array<{ id: string; reason: FormSegmentSkipReason }>;
}

/** Trimmed, de-duplicated ids in their saved order. Non-strings are dropped. */
export function normalizeSegmentIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const id = entry.trim().toLowerCase();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function isSegmentUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * `rows` must be the crm_segments rows found for `requestedIds`. A row from
 * another tenant is treated the same as a missing row.
 *
 * `allowDynamic` is false for automatic assignment: a rule-based segment
 * removes members that do not match its rules, so a direct add would not
 * last. The Segment Opt-In field keeps its earlier behaviour.
 */
export function decideFormSegments(params: {
  requestedIds: string[];
  rows: FormSegmentRow[];
  tenantId: string;
  allowDynamic: boolean;
}): FormSegmentDecision {
  const byId = new Map<string, FormSegmentRow>();
  for (const row of params.rows) {
    if (row.tenant_id === params.tenantId) {
      byId.set(row.id.toLowerCase(), row);
    }
  }

  const decision: FormSegmentDecision = { assignable: [], skipped: [] };

  for (const id of normalizeSegmentIdList(params.requestedIds)) {
    if (!isSegmentUuid(id)) {
      decision.skipped.push({ id, reason: "invalid_id" });
      continue;
    }

    const row = byId.get(id);
    if (!row) {
      decision.skipped.push({ id, reason: "not_found" });
    } else if (row.deleted_at) {
      decision.skipped.push({ id, reason: "deleted" });
    } else if (
      row.status === "archived" ||
      row.status === "draft" ||
      row.status === "paused"
    ) {
      decision.skipped.push({ id, reason: "inactive" });
    } else if (row.auto_update === true && !params.allowDynamic) {
      decision.skipped.push({ id, reason: "dynamic" });
    } else {
      decision.assignable.push({ id: row.id, name: row.name?.trim() || id });
    }
  }

  return decision;
}

/** Counts per reason, for the submission record. Holds no ids and no PII. */
export function summarizeSkippedSegments(
  skipped: FormSegmentDecision["skipped"],
): Record<string, number> | null {
  if (skipped.length === 0) {
    return null;
  }

  const summary: Record<string, number> = {};
  for (const entry of skipped) {
    summary[entry.reason] = (summary[entry.reason] ?? 0) + 1;
  }
  return summary;
}
