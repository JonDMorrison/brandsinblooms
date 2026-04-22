/**
 * Shared segment rule evaluator.
 * Handles the conditions shape: { logic: "AND"|"OR", rules: [{ field, operator, value }] }
 */

export interface SegmentRule {
  field: string;
  operator: string;
  value: any;
}

export interface SegmentConditions {
  logic?: "AND" | "OR";
  rules?: SegmentRule[];
}

export function evaluateRule(rule: SegmentRule, customer: Record<string, any>): boolean {
  const { field, operator, value } = rule;

  // Resolve field value — support 'custom_fields.xyz' paths
  let cv: any;
  if (field.includes(".")) {
    const parts = field.split(".");
    cv = parts.reduce((obj, key) => obj?.[key], customer);
  } else {
    cv = customer[field];
  }

  switch (operator) {
    // Equality
    case "=":
    case "equals":
    case "eq":
      return cv === value || String(cv) === String(value);
    case "!=":
    case "not_equals":
    case "neq":
      return cv !== value && String(cv) !== String(value);

    // Numeric comparison
    case ">":
    case "greater_than":
    case "gt":
      return Number(cv ?? 0) > Number(value);
    case "<":
    case "less_than":
    case "lt":
      return Number(cv ?? 0) < Number(value);
    case ">=":
    case "greater_than_or_equal":
    case "gte":
      return Number(cv ?? 0) >= Number(value);
    case "<=":
    case "less_than_or_equal":
    case "lte":
      return Number(cv ?? 0) <= Number(value);

    // Date-relative: value is number of days
    case "within_days": {
      if (!cv) return false;
      const cutoff = new Date(Date.now() - Number(value) * 86400000);
      return new Date(cv) >= cutoff;
    }
    case "older_than_days": {
      if (!cv) return false;
      const cutoff = new Date(Date.now() - Number(value) * 86400000);
      return new Date(cv) < cutoff;
    }
    case "before": {
      if (!cv) return false;
      return new Date(cv) < new Date(value);
    }
    case "after": {
      if (!cv) return false;
      return new Date(cv) > new Date(value);
    }

    // String/array
    case "contains":
      if (Array.isArray(cv)) return cv.some((v) => String(v).toLowerCase().includes(String(value).toLowerCase()));
      return String(cv ?? "").toLowerCase().includes(String(value).toLowerCase());
    case "not_contains":
      if (Array.isArray(cv)) return !cv.some((v) => String(v).toLowerCase().includes(String(value).toLowerCase()));
      return !String(cv ?? "").toLowerCase().includes(String(value).toLowerCase());
    case "in":
      return Array.isArray(value) ? value.includes(cv) : false;
    case "not_in":
      return Array.isArray(value) ? !value.includes(cv) : true;

    // Between: value is [min, max]
    case "between":
      if (!Array.isArray(value) || value.length < 2) return false;
      return Number(cv ?? 0) >= Number(value[0]) && Number(cv ?? 0) <= Number(value[1]);

    default:
      return false;
  }
}

export function evaluateConditions(conditions: SegmentConditions, customer: Record<string, any>): boolean {
  const rules = conditions.rules || [];
  if (rules.length === 0) return false;

  const logic = conditions.logic || "AND";
  if (logic === "OR") {
    return rules.some((rule) => evaluateRule(rule, customer));
  }
  return rules.every((rule) => evaluateRule(rule, customer));
}
