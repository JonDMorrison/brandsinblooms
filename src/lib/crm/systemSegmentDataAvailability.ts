import {
  SYSTEM_SEGMENTS,
  type SegmentDefinition,
} from "@/config/segmentDefinitions";

/**
 * Customer data that the built-in groups' rules depend on. When a tenant has
 * no customers with this data at all, a built-in group with 0 members is
 * empty because the data is missing, not because nobody qualifies.
 */
export type SegmentDataField =
  | "first_purchase_date"
  | "last_purchase_date"
  | "total_spent"
  | "pos_order_count"
  | "tags"
  | "is_perks_member";

export const SEGMENT_DATA_FIELDS: readonly SegmentDataField[] = [
  "first_purchase_date",
  "last_purchase_date",
  "total_spent",
  "pos_order_count",
  "tags",
  "is_perks_member",
];

/** true = at least one customer has the data; false = none do. */
export type SegmentDataAvailability = Record<SegmentDataField, boolean>;

export const MISSING_SEGMENT_DATA_MESSAGES: Record<SegmentDataField, string> = {
  first_purchase_date:
    "Needs purchase dates from your point of sale. Your imported reports don't include them yet.",
  last_purchase_date:
    "Needs purchase dates from your point of sale. Your imported reports don't include them yet.",
  total_spent:
    "Needs customer spending totals from your point of sale. Your imported reports don't include them yet.",
  pos_order_count:
    "Needs order counts from your point of sale. Your imported reports don't include them yet.",
  tags: "Needs customer tags. None of your customers have tags yet.",
  is_perks_member:
    "Needs Perks program sign-ups. None have been recorded yet.",
};

const isSegmentDataField = (field: string): field is SegmentDataField =>
  (SEGMENT_DATA_FIELDS as readonly string[]).includes(field);

const normalizeName = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

export function getSystemSegmentDefinition(
  name: string,
): SegmentDefinition | undefined {
  const key = normalizeName(name);
  return SYSTEM_SEGMENTS.find(
    (definition) => normalizeName(definition.name) === key,
  );
}

/** Data fields a built-in group's rules read, in rule order. */
export function getRequiredDataFields(
  definition: SegmentDefinition,
): SegmentDataField[] {
  const fields: SegmentDataField[] = [];
  for (const rule of definition.conditions.rules) {
    if (isSegmentDataField(rule.field) && !fields.includes(rule.field)) {
      fields.push(rule.field);
    }
  }
  return fields;
}

/**
 * Segment value for display. Unknown spend or an empty group is never
 * shown as "$0", which reads as "these customers spent nothing".
 */
export function formatSegmentValue(
  value: number | null,
  memberCount: number,
): string {
  if (value === null || memberCount === 0 || !Number.isFinite(value)) {
    return "Not available";
  }
  return `$${value.toLocaleString()}`;
}

/**
 * Plain explanation for a built-in group that is empty because the tenant has
 * none of the data its rule needs. Returns null when the group has members,
 * the group is not a known built-in, availability is unknown (loading or
 * query error), or the data exists (the group is honestly empty).
 */
export function getMissingDataExplanation({
  segmentName,
  memberCount,
  availability,
}: {
  segmentName: string;
  memberCount: number;
  availability: SegmentDataAvailability | null | undefined;
}): string | null {
  if (memberCount !== 0 || !availability) {
    return null;
  }

  const definition = getSystemSegmentDefinition(segmentName);
  if (!definition) {
    return null;
  }

  const missingField = getRequiredDataFields(definition).find(
    (field) => availability[field] === false,
  );

  return missingField ? MISSING_SEGMENT_DATA_MESSAGES[missingField] : null;
}
