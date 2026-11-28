import type { SegmentListItem } from "@/hooks/useSegments";
import type { FormAudience } from "@/types/formBuilder";

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      ),
    ),
  );
}

/**
 * Reads forms.audience_json into the editor shape.
 *
 * Every key the submit-form function reads must survive this step. A key
 * dropped here is erased from the saved form on the next save or duplicate.
 */
export function normalizeFormAudience(value: unknown): FormAudience {
  const candidate =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    assign_personas: stringList(candidate.assign_personas),
    assign_tags: stringList(candidate.assign_tags),
    segment_ids: stringList(candidate.segment_ids),
  };
}

/**
 * Why a saved segment will not be assigned. Mirrors the checks in
 * supabase/functions/_shared/formSegmentAssignment.ts.
 */
export function segmentAssignmentProblem(
  segment: Pick<SegmentListItem, "deletedAt" | "status" | "type"> | undefined,
): string | null {
  if (!segment || segment.deletedAt) {
    return "This segment was deleted. Remove it from this form.";
  }
  if (segment.status !== "active") {
    return "This segment is not active, so nobody is added to it.";
  }
  if (segment.type === "dynamic") {
    return "This segment now fills by its own rules, so this form cannot add people to it.";
  }
  return null;
}
