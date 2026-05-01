import {
  FormField,
  FormSettings,
  FormStep,
  FormVisibilityOperator,
  FormVisibilityRule,
} from "@/types/formBuilder";

export interface FormStepGroup {
  step: FormStep;
  fields: FormField[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStepIndex(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return 0;
}

export function createDefaultFormStep(index: number): FormStep {
  return {
    index,
    title: `Step ${index + 1}`,
    description: "",
  };
}

export function isMultiStepEnabled(
  settings: Pick<FormSettings, "steps">,
): boolean {
  return Array.isArray(settings.steps) && settings.steps.length > 0;
}

export function normalizeFieldStepIndex(
  field: Pick<FormField, "step_index">,
): number {
  return toStepIndex(field.step_index);
}

export function normalizeVisibilityOperator(
  value: unknown,
): FormVisibilityOperator {
  switch (value) {
    case "equals":
    case "not_equals":
    case "contains":
    case "not_empty":
    case "is_empty":
      return value;
    default:
      return "equals";
  }
}

export function normalizeVisibilityRules(value: unknown): FormVisibilityRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((rule) => {
      if (!isRecord(rule)) {
        return null;
      }

      const fieldId =
        typeof rule.field_id === "string" && rule.field_id.trim()
          ? rule.field_id.trim()
          : null;

      if (!fieldId) {
        return null;
      }

      const operator = normalizeVisibilityOperator(rule.operator);
      const shouldIncludeValue =
        operator !== "not_empty" && operator !== "is_empty";

      return {
        field_id: fieldId,
        operator,
        value:
          shouldIncludeValue && typeof rule.value === "string"
            ? rule.value
            : undefined,
      } satisfies FormVisibilityRule;
    })
    .filter((rule): rule is FormVisibilityRule => rule !== null);
}

export function reindexFormSteps(steps: FormStep[]): FormStep[] {
  return steps.map((step, index) => ({
    index,
    title: step.title.trim() || `Step ${index + 1}`,
    description: step.description || "",
  }));
}

function getConfiguredFormSteps(
  settings: Pick<FormSettings, "steps">,
): FormStep[] {
  const configuredSteps = Array.isArray(settings.steps) ? settings.steps : [];

  return configuredSteps
    .map((step, index) => ({
      index: toStepIndex(step.index ?? index),
      title: typeof step.title === "string" ? step.title : `Step ${index + 1}`,
      description: typeof step.description === "string" ? step.description : "",
    }))
    .sort((left, right) => left.index - right.index)
    .map((step, index) => ({
      ...step,
      index,
    }));
}

export function getEditableFormSteps(
  fields: FormField[],
  settings: Pick<FormSettings, "steps">,
): FormStep[] {
  const editableSteps = getConfiguredFormSteps(settings);

  if (editableSteps.length === 0) {
    return [createDefaultFormStep(0)];
  }

  const maxFieldStepIndex = fields.reduce(
    (maxIndex, field) => Math.max(maxIndex, normalizeFieldStepIndex(field)),
    0,
  );
  const nextSteps = [...editableSteps];

  for (let index = nextSteps.length; index <= maxFieldStepIndex; index += 1) {
    nextSteps.push(createDefaultFormStep(index));
  }

  return nextSteps;
}

export function getNormalizedFormSteps(
  fields: FormField[],
  settings: Pick<FormSettings, "steps">,
): FormStep[] {
  const normalizedConfigured = reindexFormSteps(
    getConfiguredFormSteps(settings),
  );

  if (normalizedConfigured.length === 0) {
    return [createDefaultFormStep(0)];
  }

  const maxFieldStepIndex = fields.reduce(
    (maxIndex, field) => Math.max(maxIndex, normalizeFieldStepIndex(field)),
    0,
  );
  const normalizedSteps = [...normalizedConfigured];

  for (
    let index = normalizedSteps.length;
    index <= maxFieldStepIndex;
    index += 1
  ) {
    normalizedSteps.push(createDefaultFormStep(index));
  }

  return reindexFormSteps(normalizedSteps);
}

export function sortFieldsByStepOrder(
  fields: FormField[] | undefined,
  steps: FormStep[] | undefined,
): FormField[] {
  const normalizedFields = Array.isArray(fields) ? fields : [];
  const normalizedSteps = Array.isArray(steps) ? steps : [];
  const stepOrder = new Map(
    normalizedSteps.map((step, index) => [step.index, index]),
  );

  return [...normalizedFields].sort((leftField, rightField) => {
    const leftOrder =
      stepOrder.get(normalizeFieldStepIndex(leftField)) ??
      normalizedSteps.length;
    const rightOrder =
      stepOrder.get(normalizeFieldStepIndex(rightField)) ??
      normalizedSteps.length;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return 0;
  });
}

export function groupFieldsByStep(
  fields: FormField[] | undefined,
  steps: FormStep[] | undefined,
): FormStepGroup[] {
  const normalizedSteps = Array.isArray(steps) ? steps : [];
  const orderedFields = sortFieldsByStepOrder(fields, normalizedSteps);

  return normalizedSteps.map((step) => ({
    step,
    fields: orderedFields.filter(
      (field) => normalizeFieldStepIndex(field) === step.index,
    ),
  }));
}

export function getOrderedFieldIds(
  fields: FormField[] | undefined,
  steps: FormStep[] | undefined,
): string[] {
  return sortFieldsByStepOrder(fields, steps).map((field) => field.id);
}

export function getAvailableConditionSourceFields(
  fields: FormField[] | undefined,
  currentFieldId: string,
  steps: FormStep[] | undefined,
): FormField[] {
  const orderedFields = sortFieldsByStepOrder(fields, steps).filter(
    (field) => field.type !== "hidden",
  );
  const currentFieldIndex = orderedFields.findIndex(
    (field) => field.id === currentFieldId,
  );

  if (currentFieldIndex <= 0) {
    return [];
  }

  return orderedFields.slice(0, currentFieldIndex);
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

export function evaluateVisibilityRule(
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

export function evaluateFieldVisibility(
  field: FormField,
  valuesByFieldId: Record<string, unknown>,
): boolean {
  if (field.type === "hidden") {
    return false;
  }

  const rules = normalizeVisibilityRules(field.visibility_rules);

  if (rules.length === 0) {
    return true;
  }

  return rules.every((rule) => evaluateVisibilityRule(rule, valuesByFieldId));
}

export function getVisibleRenderableFields(
  fields: FormField[],
  valuesByFieldId: Record<string, unknown>,
): FormField[] {
  return fields.filter((field) =>
    evaluateFieldVisibility(field, valuesByFieldId),
  );
}

export function getVisibleRenderableFieldsForStep(
  fields: FormField[],
  valuesByFieldId: Record<string, unknown>,
  stepIndex: number,
): FormField[] {
  return getVisibleRenderableFields(fields, valuesByFieldId).filter(
    (field) => normalizeFieldStepIndex(field) === stepIndex,
  );
}

export function filterVisibleSubmissionData<T extends Record<string, unknown>>(
  fields: FormField[],
  valuesByFieldId: T,
): Partial<T> {
  const nextData: Partial<T> = {};

  fields.forEach((field) => {
    if (!evaluateFieldVisibility(field, valuesByFieldId)) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(valuesByFieldId, field.id)) {
      nextData[field.id as keyof T] = valuesByFieldId[field.id] as T[keyof T];
    }
  });

  return nextData;
}
