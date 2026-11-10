/**
 * Helpers for the `segment_checkbox` form field.
 *
 * Two responsibilities:
 *
 * 1. **Normalise legacy fields**: forms saved before the multi-segment-opt-in
 *    feature stored a single `segment_id` / `segment_name` pair on the field.
 *    `getSegmentOptions` returns a uniform `FormSegmentOption[]` view for
 *    both old and new fields, so the renderer and submission handler never
 *    need to branch on schema version.
 *
 * 2. **Coerce the submitted value**: visitors send back either a string
 *    (single-select / legacy boolean) or an array of segment ids
 *    (multi-select). `getSubmittedSegmentIds` parses whatever shape arrives
 *    and returns the durable list of segment ids the contact should join.
 *
 * Used by both the public renderer (`FormPreviewRenderer.tsx`) and the
 * submission edge function (`supabase/functions/submit-form/index.ts`) —
 * the two surfaces MUST agree on the encoding, so a single helper.
 */

import type { FormField, FormSegmentOption } from "@/types/formBuilder";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Returns the option list for a `segment_checkbox` field, regardless of
 * which schema version the field was saved with.
 *
 * - New shape (`segment_options` non-empty): returns it verbatim.
 * - Legacy shape (single `segment_id` + optional `segment_name`): returns
 *   a one-element list with the segment_id and a label inferred from
 *   segment_name → field.label → a generic fallback. Never silently drops
 *   the binding.
 * - Otherwise (broken legacy with neither): returns an empty array.
 */
export function getSegmentOptions(field: FormField): FormSegmentOption[] {
  const explicit = field.segment_options;
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit
      .filter(
        (option): option is FormSegmentOption =>
          Boolean(option) &&
          typeof option.segment_id === "string" &&
          option.segment_id.length > 0,
      )
      .map((option) => ({
        segment_id: option.segment_id,
        label:
          typeof option.label === "string" && option.label.trim().length > 0
            ? option.label
            : (field.label || "Add me to this segment"),
      }));
  }

  if (typeof field.segment_id === "string" && field.segment_id.length > 0) {
    const legacyLabel =
      (typeof field.segment_name === "string" && field.segment_name.trim()) ||
      field.label ||
      "Add me to this segment";
    return [{ segment_id: field.segment_id, label: legacyLabel }];
  }

  return [];
}

/**
 * True when this field has at least one selectable option after normalisation.
 * The renderer uses this to decide whether to show "(no options configured)".
 */
export function hasSegmentOptions(field: FormField): boolean {
  return getSegmentOptions(field).length > 0;
}

/**
 * Parses the value the visitor submitted for a `segment_checkbox` field and
 * returns the deduplicated list of segment ids to join. Only ids that
 * actually belong to one of the field's configured options are returned —
 * a client that tampers with the payload to inject an arbitrary
 * `segment_id` cannot make us join arbitrary segments.
 *
 * Submission shapes accepted:
 *  - `string[]` — checkbox group (one id per checked option)
 *  - `string` UUID — single-select (radio / dropdown)
 *  - `boolean` true — legacy single-segment field where the visitor
 *    simply checked the box
 *  - everything else (false, null, undefined, empty, junk) → []
 */
export function getSubmittedSegmentIds(
  field: FormField,
  value: unknown,
): string[] {
  const options = getSegmentOptions(field);
  if (options.length === 0) {
    return [];
  }
  const allowed = new Set(options.map((option) => option.segment_id));

  const ids: string[] = [];

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (isUuid(entry) && allowed.has(entry)) {
        ids.push(entry);
      }
    }
  } else if (isUuid(value) && allowed.has(value)) {
    ids.push(value);
  } else if (value === true && options.length === 1) {
    // Legacy single-segment field with a boolean checkbox value.
    ids.push(options[0].segment_id);
  }

  // Deduplicate while preserving the visitor's selection order.
  return Array.from(new Set(ids));
}

/**
 * The empty default submission value for a `segment_checkbox` field, used by
 * the renderer to initialise visitor state.
 */
export function getEmptySegmentValue(field: FormField): string[] | boolean {
  return field.segment_options ? [] : false;
}
