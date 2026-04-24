import {
  SEGMENT_OPERATORS,
  getFieldById,
  isRuleGroup,
  type SegmentField,
  type SegmentRuleCondition,
  type SegmentRuleGroup,
  type SegmentRuleValue,
} from "@/lib/segmentFields";

function formatValue(value: SegmentRuleValue) {
  if (value === null || value === undefined) {
    return "empty";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return value.toLocaleString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    if ("amount" in value) {
      return `${value.amount} ${value.unit}`;
    }

    if ("min" in value || "max" in value) {
      return `${value.min ?? "?"} and ${value.max ?? "?"}`;
    }
  }

  return String(value);
}

function describeCondition(rule: SegmentRuleCondition, fields: SegmentField[]) {
  const field = getFieldById(fields, rule.fieldId);
  const operator = rule.operatorId ? SEGMENT_OPERATORS[rule.operatorId] : null;

  if (!field || !operator) {
    return "an incomplete rule";
  }

  if (!operator.requiresValue) {
    return `${field.label} ${operator.label}`;
  }

  return `${field.label} ${operator.label} ${formatValue(rule.value)}`;
}

function describeGroup(
  group: SegmentRuleGroup,
  fields: SegmentField[],
  nested = false,
): string {
  const joiner = group.operator === "OR" ? " OR " : " AND ";
  const parts = group.children.map((child) =>
    isRuleGroup(child)
      ? describeGroup(child, fields, true)
      : describeCondition(child, fields),
  );
  const sentence = parts.filter(Boolean).join(joiner);

  if (!sentence) {
    return "everyone";
  }

  return nested ? `(${sentence})` : sentence;
}

export function segmentRuleToNaturalLanguage(
  group: SegmentRuleGroup,
  fields: SegmentField[],
) {
  return describeGroup(group, fields);
}
