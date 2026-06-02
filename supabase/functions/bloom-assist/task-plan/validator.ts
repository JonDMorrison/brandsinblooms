import type { JsonObject, JsonValue, PersistenceClient } from "../types.ts";
import { getRegisteredTool, normalizeToolRole } from "../tools/registry.ts";
import type { ToolName } from "../tools/types.ts";
import type {
  TaskPlan,
  TaskPlanEntityType,
  TaskPlanItem,
  ValidationAnnotation,
  ValidationStep,
} from "./types.ts";

const ACTIVE_CAMPAIGN_STATUSES = new Set([
  "scheduled",
  "queued",
  "partially_queued",
  "sending",
  "paused",
]);

type EntityLookup = {
  table: string;
  labelField: string;
  duplicateFields: string[];
  deletedAtField: string | null;
};

const ENTITY_LOOKUPS: Record<TaskPlanEntityType, EntityLookup> = {
  customer: {
    table: "crm_customers",
    labelField: "email",
    duplicateFields: ["email"],
    deletedAtField: "deleted_at",
  },
  product: {
    table: "products",
    labelField: "name",
    duplicateFields: ["name", "sku"],
    deletedAtField: null,
  },
  campaign: {
    table: "crm_campaigns",
    labelField: "name",
    duplicateFields: ["name"],
    deletedAtField: null,
  },
  segment: {
    table: "crm_segments",
    labelField: "name",
    duplicateFields: ["name"],
    deletedAtField: "deleted_at",
  },
  tag: {
    table: "crm_tags",
    labelField: "name",
    duplicateFields: ["name"],
    deletedAtField: null,
  },
};

type ReferenceSpec = {
  field: string;
  table: string;
  displayField: string;
  deletedAtField: string | null;
};

const REFERENCE_SPECS: ReferenceSpec[] = [
  {
    field: "customer_id",
    table: "crm_customers",
    displayField: "email",
    deletedAtField: "deleted_at",
  },
  {
    field: "product_id",
    table: "products",
    displayField: "name",
    deletedAtField: null,
  },
  {
    field: "campaign_id",
    table: "crm_campaigns",
    displayField: "name",
    deletedAtField: null,
  },
  {
    field: "segment_id",
    table: "crm_segments",
    displayField: "name",
    deletedAtField: "deleted_at",
  },
  {
    field: "persona_id",
    table: "crm_personas",
    displayField: "persona_name",
    deletedAtField: null,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isJsonObject(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readObject(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {};
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(readString).filter((item): item is string => Boolean(item))
    : [];
}

function annotation(
  step: ValidationStep,
  type: ValidationAnnotation["type"],
  message: string,
  resolutionOptions: ValidationAnnotation["resolution_options"] = [],
): ValidationAnnotation {
  return {
    step,
    type,
    message,
    resolution_options: resolutionOptions,
  };
}

function taskParamSource(task: TaskPlanItem): JsonObject {
  const changes = readObject(task.tool_params.changes);
  return { ...task.tool_params, ...changes };
}

function displayValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return null;
}

function duplicateCandidates(
  task: TaskPlanItem,
): Array<{ field: string; value: string }> {
  const lookup = ENTITY_LOOKUPS[task.entity_type];
  const source = taskParamSource(task);

  return lookup.duplicateFields
    .map((field) => ({ field, value: displayValue(source[field]) }))
    .filter((candidate): candidate is { field: string; value: string } =>
      Boolean(candidate.value),
    );
}

async function countEntityMatches(
  client: PersistenceClient,
  tenantId: string,
  lookup: EntityLookup,
  field: string,
  value: string,
): Promise<number> {
  let query = client
    .from(lookup.table)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .ilike(field, value);

  if (lookup.deletedAtField) {
    query = query.is(lookup.deletedAtField, null);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function duplicateDetection(
  task: TaskPlanItem,
  client: PersistenceClient,
  tenantId: string,
): Promise<ValidationAnnotation[]> {
  if (task.action !== "create") return [];

  const lookup = ENTITY_LOOKUPS[task.entity_type];
  const annotations: ValidationAnnotation[] = [];
  for (const candidate of duplicateCandidates(task)) {
    const count = await countEntityMatches(
      client,
      tenantId,
      lookup,
      candidate.field,
      candidate.value,
    );
    if (count > 0) {
      annotations.push(
        annotation(
          "duplicate_detection",
          "warning",
          `A ${task.entity_type} with ${candidate.field} "${candidate.value}" already exists. Create anyway?`,
        ),
      );
    }
  }

  return annotations;
}

async function ambiguityDetection(
  task: TaskPlanItem,
  client: PersistenceClient,
  tenantId: string,
): Promise<ValidationAnnotation[]> {
  if (task.entity_id || task.action === "create" || !task.entity_name.trim())
    return [];

  const lookup = ENTITY_LOOKUPS[task.entity_type];
  let query = client
    .from(lookup.table)
    .select(`id, ${lookup.labelField}`)
    .eq("tenant_id", tenantId)
    .ilike(lookup.labelField, task.entity_name)
    .limit(4);

  if (lookup.deletedAtField) {
    query = query.is(lookup.deletedAtField, null);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (
    Array.isArray(data as unknown) ? (data as unknown[]) : []
  ).filter(isRecord);
  if (rows.length <= 1) return [];

  return [
    annotation(
      "ambiguity_detection",
      "error",
      `${rows.length} ${task.entity_type} records match "${task.entity_name}". Choose the exact record before approval.`,
      rows.map((row) => ({
        id: readString(row.id) ?? "unknown",
        label:
          readString(row[lookup.labelField]) ??
          readString(row.id) ??
          "Unknown record",
        value: readString(row.id) ?? null,
        description: null,
      })),
    ),
  ];
}

function validateDataQualityValue(
  field: string,
  value: unknown,
): ValidationAnnotation[] {
  const annotations: ValidationAnnotation[] = [];
  const normalizedField = field.toLowerCase();
  const text = readString(value);
  const number = readNumber(value);

  if (
    normalizedField.includes("email") &&
    text &&
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)
  ) {
    annotations.push(
      annotation(
        "data_quality_validation",
        "warning",
        `The email value for ${field} does not look valid.`,
      ),
    );
  }

  if (
    normalizedField.includes("phone") &&
    text &&
    !text.startsWith("+") &&
    text.replace(/\D/g, "").length >= 10
  ) {
    annotations.push(
      annotation(
        "data_quality_validation",
        "warning",
        `The phone value for ${field} is missing an explicit country code.`,
      ),
    );
  }

  if (
    (normalizedField.includes("price") ||
      normalizedField.includes("amount") ||
      normalizedField.includes("discount")) &&
    number !== null
  ) {
    if (number < 0) {
      annotations.push(
        annotation(
          "data_quality_validation",
          "warning",
          `${field} is negative.`,
        ),
      );
    }
    if (number === 0) {
      annotations.push(
        annotation(
          "data_quality_validation",
          "warning",
          `${field} is set to 0.`,
        ),
      );
    }
    if (number >= 999_999) {
      annotations.push(
        annotation(
          "data_quality_validation",
          "warning",
          `${field} is unusually high.`,
        ),
      );
    }
  }

  if (
    (normalizedField.includes("quantity") ||
      normalizedField.includes("inventory")) &&
    number !== null &&
    number < 0
  ) {
    annotations.push(
      annotation(
        "data_quality_validation",
        "warning",
        `${field} cannot normally be negative.`,
      ),
    );
  }

  if (
    (normalizedField === "name" || normalizedField.endsWith("_name")) &&
    text &&
    text.length > 180
  ) {
    annotations.push(
      annotation(
        "data_quality_validation",
        "warning",
        `${field} is unusually long.`,
      ),
    );
  }

  return annotations;
}

async function dataQualityValidation(
  task: TaskPlanItem,
): Promise<ValidationAnnotation[]> {
  const source = taskParamSource(task);
  return Object.entries(source).flatMap(([field, value]) =>
    validateDataQualityValue(field, value),
  );
}

async function constraintChecking(
  task: TaskPlanItem,
  userRole: string,
): Promise<ValidationAnnotation[]> {
  const tool = getRegisteredTool(task.tool_name);
  if (!tool) {
    return [
      annotation(
        "constraint_checking",
        "error",
        `Tool ${task.tool_name} is not registered.`,
      ),
    ];
  }

  const role = normalizeToolRole(userRole);
  if (!tool.allowed_roles.includes(role)) {
    return [
      annotation(
        "constraint_checking",
        "error",
        `The ${role} role is not allowed to run ${task.tool_name}.`,
      ),
    ];
  }

  return [];
}

function collectReferenceIds(
  task: TaskPlanItem,
): Array<{ spec: ReferenceSpec; ids: string[] }> {
  const source = taskParamSource(task);
  return REFERENCE_SPECS.map((spec) => {
    const singular = readString(source[spec.field]);
    const plural = readStringArray(source[`${spec.field}s`]);
    const ids = [...(singular ? [singular] : []), ...plural];
    return { spec, ids };
  }).filter((entry) => entry.ids.length > 0);
}

async function findMissingReferenceIds(
  client: PersistenceClient,
  tenantId: string,
  spec: ReferenceSpec,
  ids: string[],
): Promise<string[]> {
  let query = client
    .from(spec.table)
    .select("id")
    .eq("tenant_id", tenantId)
    .in("id", ids);

  if (spec.deletedAtField) {
    query = query.is(spec.deletedAtField, null);
  }

  const { data, error } = await query;
  if (error) throw error;
  const foundIds = new Set(
    (data ?? [])
      .filter(isRecord)
      .map((row) => readString(row.id))
      .filter(Boolean),
  );
  return ids.filter((id) => !foundIds.has(id));
}

async function crossReferenceValidation(
  task: TaskPlanItem,
  client: PersistenceClient,
  tenantId: string,
): Promise<ValidationAnnotation[]> {
  const annotations: ValidationAnnotation[] = [];
  for (const entry of collectReferenceIds(task)) {
    const missingIds = await findMissingReferenceIds(
      client,
      tenantId,
      entry.spec,
      entry.ids,
    );
    if (missingIds.length > 0) {
      annotations.push(
        annotation(
          "cross_reference_validation",
          "error",
          `${missingIds.length} referenced ${entry.spec.field.replace("_id", "")} record(s) were not found for this tenant.`,
        ),
      );
    }
  }
  return annotations;
}

async function activeCampaignsForSegment(
  client: PersistenceClient,
  tenantId: string,
  segmentId: string,
): Promise<string[]> {
  const direct = await client
    .from("crm_campaigns")
    .select("id, name, status")
    .eq("tenant_id", tenantId)
    .eq("segment_id", segmentId);
  if (direct.error) throw direct.error;

  const junction = await client
    .from("campaign_segments")
    .select("campaign_id")
    .eq("segment_id", segmentId);
  if (junction.error) throw junction.error;

  const campaignIds = readStringArray(
    (junction.data ?? []).map((row) =>
      isRecord(row) ? row.campaign_id : null,
    ),
  );
  const linked =
    campaignIds.length > 0
      ? await client
          .from("crm_campaigns")
          .select("id, name, status")
          .eq("tenant_id", tenantId)
          .in("id", campaignIds)
      : { data: [], error: null };
  if (linked.error) throw linked.error;

  return [...(direct.data ?? []), ...(linked.data ?? [])]
    .filter(isRecord)
    .filter((row) => {
      const status = readString(row.status);
      return Boolean(status && ACTIVE_CAMPAIGN_STATUSES.has(status));
    })
    .map(
      (row) => readString(row.name) ?? readString(row.id) ?? "Unnamed campaign",
    );
}

async function conflictDetection(
  task: TaskPlanItem,
  client: PersistenceClient,
  tenantId: string,
): Promise<ValidationAnnotation[]> {
  if (
    task.entity_type !== "segment" ||
    !task.entity_id ||
    (task.action !== "update" && task.action !== "delete")
  ) {
    return [];
  }

  const campaignNames = await activeCampaignsForSegment(
    client,
    tenantId,
    task.entity_id,
  );
  if (campaignNames.length === 0) return [];

  return [
    annotation(
      "conflict_detection",
      "warning",
      `This segment is used by active campaign(s): ${campaignNames.slice(0, 3).join(", ")}.`,
    ),
  ];
}

async function smartSuggestions(
  task: TaskPlanItem,
): Promise<ValidationAnnotation[]> {
  const source = taskParamSource(task);
  const annotations: ValidationAnnotation[] = [];

  if (
    task.entity_type === "campaign" &&
    (task.action === "create" || task.action === "update")
  ) {
    const deliveryMethod = readString(source.delivery_method) ?? "email";
    if (deliveryMethod === "email" && !readString(source.subject_line)) {
      annotations.push(
        annotation(
          "smart_suggestions",
          "suggestion",
          "This campaign does not include a subject line yet. Bloom can generate options before you send it.",
        ),
      );
    }
  }

  if (
    task.entity_type === "segment" &&
    task.action === "create" &&
    !source.rules &&
    !source.conditions &&
    !source.filters
  ) {
    annotations.push(
      annotation(
        "smart_suggestions",
        "suggestion",
        "This segment has no explicit rules. Consider previewing the audience size before approval.",
      ),
    );
  }

  return annotations;
}

async function validateTask(
  task: TaskPlanItem,
  serviceClient: PersistenceClient,
  tenantId: string,
  userRole: string,
): Promise<TaskPlanItem> {
  const annotations = [
    ...(await duplicateDetection(task, serviceClient, tenantId)),
    ...(await ambiguityDetection(task, serviceClient, tenantId)),
    ...(await dataQualityValidation(task)),
    ...(await constraintChecking(task, userRole)),
    ...(await crossReferenceValidation(task, serviceClient, tenantId)),
    ...(await conflictDetection(task, serviceClient, tenantId)),
    ...(await smartSuggestions(task)),
  ];

  return {
    ...task,
    validation_annotations: annotations,
  };
}

export async function validateTaskPlan(
  plan: TaskPlan,
  serviceClient: PersistenceClient,
  tenantId: string,
  userRole = "viewer",
): Promise<TaskPlan> {
  const tasks = await Promise.all(
    plan.tasks.map((task) =>
      validateTask(task, serviceClient, tenantId, userRole),
    ),
  );

  return {
    ...plan,
    tasks,
  };
}

export function hasBlockingValidationErrors(plan: TaskPlan): boolean {
  return plan.tasks.some((task) =>
    task.validation_annotations.some(
      (annotation) => annotation.type === "error",
    ),
  );
}

export function toolNameFromTask(task: TaskPlanItem): ToolName {
  return task.tool_name;
}
