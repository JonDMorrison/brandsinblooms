export type FormVisibilityOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_empty"
  | "is_empty";

export interface FormVisibilityRule {
  field_id: string;
  operator: FormVisibilityOperator;
  value?: string;
}

export interface FormFieldWithVisibility {
  id: string;
  type: string;
  required: boolean;
  mapping_key?: string;
  field_key?: string;
  default_value?: string | boolean;
  visibility_rules?: FormVisibilityRule[];
}

export interface SanitizedFormSubmission {
  activeFields: FormFieldWithVisibility[];
  sanitizedData: Record<string, unknown>;
  valuesByFieldId: Record<string, unknown>;
}

function hasMeaningfulFieldValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

function toComparableValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === undefined || value === null) {
    return "";
  }

  return JSON.stringify(value);
}

function getFieldLookupKeys(field: FormFieldWithVisibility): string[] {
  return [field.mapping_key, field.id, field.field_key].filter(
    (key, index, allKeys): key is string =>
      typeof key === "string" &&
      key.length > 0 &&
      allKeys.indexOf(key) === index,
  );
}

function getSubmittedFieldValue(
  field: FormFieldWithVisibility,
  data: Record<string, unknown>,
): unknown {
  for (const key of getFieldLookupKeys(field)) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      return data[key];
    }
  }

  return undefined;
}

function evaluateVisibilityRule(
  rule: FormVisibilityRule,
  valuesByFieldId: Record<string, unknown>,
): boolean {
  const sourceValue = valuesByFieldId[rule.field_id];
  const comparableValue = toComparableValue(sourceValue);

  switch (rule.operator) {
    case "equals":
      return comparableValue === (rule.value ?? "");
    case "not_equals":
      return comparableValue !== (rule.value ?? "");
    case "contains":
      return comparableValue.includes(rule.value ?? "");
    case "not_empty":
      return hasMeaningfulFieldValue(sourceValue);
    case "is_empty":
      return !hasMeaningfulFieldValue(sourceValue);
    default:
      return true;
  }
}

function isFieldVisible(
  field: FormFieldWithVisibility,
  valuesByFieldId: Record<string, unknown>,
): boolean {
  if (field.type === "hidden") {
    return true;
  }

  const rules = Array.isArray(field.visibility_rules)
    ? field.visibility_rules
    : [];

  if (rules.length === 0) {
    return true;
  }

  return rules.every((rule) => evaluateVisibilityRule(rule, valuesByFieldId));
}

export function sanitizeFormSubmissionData(
  fields: FormFieldWithVisibility[],
  data: Record<string, unknown>,
): SanitizedFormSubmission {
  const valuesByFieldId = Object.fromEntries(
    fields.map((field) => {
      if (field.type === "hidden") {
        return [field.id, field.default_value];
      }

      return [field.id, getSubmittedFieldValue(field, data)];
    }),
  );

  const activeFields = fields.filter((field) =>
    isFieldVisible(field, valuesByFieldId),
  );

  const sanitizedData: Record<string, unknown> = {};

  activeFields.forEach((field) => {
    const targetKey = field.mapping_key || field.id;

    if (field.type === "hidden") {
      if (field.default_value !== undefined && field.default_value !== "") {
        sanitizedData[targetKey] = field.default_value;
      }
      return;
    }

    const value = valuesByFieldId[field.id];

    if (value !== undefined) {
      sanitizedData[targetKey] = value;
    }
  });

  return {
    activeFields,
    sanitizedData,
    valuesByFieldId,
  };
}
