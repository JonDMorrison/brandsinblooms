import type { JsonObject, JsonValue, PersistenceClient } from "../types.ts";
import { executeTool } from "../tools/executor.ts";
import { getRegisteredTool } from "../tools/registry.ts";
import type { ToolName, ToolResult, ToolRiskLevel } from "../tools/types.ts";
import type {
  CompactConfirmation,
  EditableFieldMetadata,
  FieldChange,
  TaskPlan,
  TaskPlanAction,
  TaskPlanEntityType,
  TaskPlanGenerationContext,
  TaskPlanItem,
  TaskPlanToolResult,
} from "./types.ts";

const RISK_ORDER: ToolRiskLevel[] = ["safe", "low", "medium", "high"];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NON_EDITABLE_FIELD_PATTERNS = [
  /(^|_)id$/,
  /(^|_)ids$/,
  /^tenant_id$/,
  /^user_id$/,
  /^deletion_mode$/,
  /^send_mode$/,
];

type CampaignPrefillContext = TaskPlanGenerationContext & {
  serviceClient: PersistenceClient;
  dataClient?: PersistenceClient;
  userMessage: string;
};

type CampaignPrefillDraft = {
  subjectOptions: string[];
  bodyText: string | null;
};

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

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(readString).filter((item): item is string => Boolean(item))
    : [];
}

function asJsonObject(value: unknown): JsonObject | null {
  return isJsonObject(value) ? value : null;
}

function asJsonValue(value: unknown): JsonValue | null {
  return isJsonValue(value) ? value : null;
}

function uniqueFields(fields: string[]): string[] {
  return Array.from(new Set(fields));
}

function addEditableField(fields: string[], field: string): string[] {
  return uniqueFields([...fields, field]);
}

function upsertFieldChange(
  fieldChanges: FieldChange[] | null,
  field: string,
  value: JsonValue,
): FieldChange[] {
  const next = [...(fieldChanges ?? [])];
  const existingIndex = next.findIndex((change) => change.field === field);
  const generatedChange = { field, current_value: null, new_value: value };

  if (existingIndex >= 0) {
    next[existingIndex] = generatedChange;
    return next;
  }

  return [...next, generatedChange];
}

function upsertFieldMetadata(
  metadata: EditableFieldMetadata[] | undefined,
  entry: EditableFieldMetadata,
): EditableFieldMetadata[] {
  const existing = metadata ?? [];
  const withoutField = existing.filter((item) => item.field !== entry.field);
  return [...withoutField, entry];
}

function isToolName(value: string): value is ToolName {
  return Boolean(getRegisteredTool(value));
}

function riskRank(riskLevel: ToolRiskLevel): number {
  return RISK_ORDER.indexOf(riskLevel);
}

function maxRisk(left: ToolRiskLevel, right: ToolRiskLevel): ToolRiskLevel {
  return riskRank(right) > riskRank(left) ? right : left;
}

function normalizeRisk(value: unknown, fallback: ToolRiskLevel): ToolRiskLevel {
  return value === "safe" ||
    value === "low" ||
    value === "medium" ||
    value === "high"
    ? value
    : fallback;
}

function inferAction(toolName: ToolName): TaskPlanAction {
  if (toolName.startsWith("create_") || toolName === "clone_campaign")
    return "create";
  if (
    toolName.startsWith("update_") ||
    toolName === "toggle_product_status" ||
    toolName === "pause_resume_campaign"
  )
    return "update";
  if (toolName.startsWith("delete_")) return "delete";
  if (toolName === "send_campaign") return "send";
  if (toolName === "schedule_campaign") return "schedule";
  if (toolName === "assign_segment") return "assign";
  if (toolName === "bulk_tag_customers") return "tag";
  if (toolName === "manage_consent") return "consent_change";
  return "update";
}

function inferEntityType(toolName: ToolName): TaskPlanEntityType {
  if (toolName.includes("customer") || toolName === "manage_consent")
    return "customer";
  if (toolName.includes("product")) return "product";
  if (toolName.includes("campaign")) return "campaign";
  if (toolName.includes("segment")) return "segment";
  return "tag";
}

function readToolOutputData(toolResult: JsonObject): JsonObject | null {
  return asJsonObject(toolResult.data);
}

function readConfirmationDetails(toolResult: JsonObject): JsonObject {
  return (
    asJsonObject(toolResult.confirmation_details) ??
    asJsonObject(readToolOutputData(toolResult)?.confirmation_details) ??
    {}
  );
}

function readEmbeddedTaskPlan(toolResult: JsonObject): JsonObject {
  return asJsonObject(readToolOutputData(toolResult)?.task_plan) ?? {};
}

function readFieldChange(record: unknown): FieldChange | null {
  if (!isRecord(record)) return null;
  const field = readString(record.field);
  if (!field) return null;
  const currentValue = asJsonValue(
    record.current_value ?? record.current ?? null,
  );
  const newValue = asJsonValue(
    record.new_value ?? record.proposed ?? record.new ?? null,
  );
  return {
    field,
    current_value: currentValue,
    new_value: newValue,
  };
}

function readFieldChangesFromTaskPlan(taskPlan: JsonObject): FieldChange[] {
  const fieldDiffs = Array.isArray(taskPlan.field_diffs)
    ? taskPlan.field_diffs
    : [];
  return fieldDiffs
    .map(readFieldChange)
    .filter((change): change is FieldChange => Boolean(change));
}

function fieldChangesFromParams(params: JsonObject): FieldChange[] {
  const changes = asJsonObject(params.changes);
  if (!changes) {
    return [];
  }

  return Object.entries(changes)
    .map(([field, value]) => ({
      field,
      current_value: null,
      new_value: asJsonValue(value),
    }))
    .filter((change): change is FieldChange => change.new_value !== undefined);
}

function directFieldChanges(
  toolName: ToolName,
  params: JsonObject,
): FieldChange[] {
  switch (toolName) {
    case "schedule_campaign":
      return [
        {
          field: "scheduled_at",
          current_value: null,
          new_value: asJsonValue(params.scheduled_at),
        },
      ];
    case "toggle_product_status":
      return [
        {
          field: "status",
          current_value: null,
          new_value: asJsonValue(params.status),
        },
      ];
    case "pause_resume_campaign":
      return [
        {
          field: "action",
          current_value: null,
          new_value: asJsonValue(params.action),
        },
      ];
    case "manage_consent":
      return [
        {
          field: "consent",
          current_value: null,
          new_value: asJsonValue(params.action),
        },
      ];
    default:
      return [];
  }
}

function inferFieldChanges(
  toolName: ToolName,
  params: JsonObject,
  taskPlan: JsonObject,
): FieldChange[] | null {
  const changes = [
    ...readFieldChangesFromTaskPlan(taskPlan),
    ...fieldChangesFromParams(params),
    ...directFieldChanges(toolName, params),
  ];
  const unique = new Map<string, FieldChange>();
  for (const change of changes) {
    if (!unique.has(change.field)) {
      unique.set(change.field, change);
    }
  }
  return unique.size > 0 ? [...unique.values()] : null;
}

function readNestedName(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return (
    readString(value.name) ||
    readString(value.persona_name) ||
    readString(value.email)
  );
}

function inferEntityName(
  toolName: ToolName,
  params: JsonObject,
  taskPlan: JsonObject,
  details: JsonObject,
): string {
  const current = asJsonObject(taskPlan.current);
  const proposed = asJsonObject(taskPlan.proposed);
  const campaign = asJsonObject(taskPlan.campaign);
  const segment = asJsonObject(taskPlan.segment);

  return (
    readNestedName(campaign) ||
    readNestedName(segment) ||
    readString(taskPlan.segment_name) ||
    readNestedName(proposed) ||
    readNestedName(current) ||
    readString(params.name) ||
    readString(params.new_name) ||
    readNestedName(params.changes) ||
    readString(params.tag_name) ||
    readString(params.email) ||
    readString(details.action) ||
    toolName.replace(/_/g, " ")
  );
}

function inferEntityId(
  entityType: TaskPlanEntityType,
  params: JsonObject,
): string | null {
  const candidates = [
    readString(params[`${entityType}_id`]),
    readString(params.entity_id),
    readString(params.id),
  ];
  const match = candidates.find(
    (candidate) => candidate && UUID_PATTERN.test(candidate),
  );
  return match ?? null;
}

function schemaProperties(schema: JsonObject): Record<string, JsonObject> {
  if (!isRecord(schema.properties)) return {};
  const properties: Record<string, JsonObject> = {};
  for (const [key, value] of Object.entries(schema.properties)) {
    if (isJsonObject(value)) {
      properties[key] = value;
    }
  }
  return properties;
}

function isEditableField(fieldPath: string): boolean {
  const leaf = fieldPath.split(".").at(-1) ?? fieldPath;
  return !NON_EDITABLE_FIELD_PATTERNS.some((pattern) => pattern.test(leaf));
}

function editableFieldsFromSchema(schema: JsonObject, prefix = ""): string[] {
  const fields: string[] = [];
  const properties = schemaProperties(schema);

  for (const [field, fieldSchema] of Object.entries(properties)) {
    const fieldPath = prefix ? `${prefix}.${field}` : field;
    if (!isEditableField(fieldPath)) {
      continue;
    }

    if (field === "changes" && fieldSchema.type === "object") {
      fields.push(...editableFieldsFromSchema(fieldSchema, fieldPath));
      continue;
    }

    fields.push(fieldPath);
  }

  return fields;
}

function inferDependencies(tasks: TaskPlanItem[]): TaskPlanItem[] {
  return tasks.map((task, index) => {
    if (index === 0 || task.depends_on.length > 0) {
      return task;
    }

    const createDependency = tasks
      .slice(0, index)
      .find(
        (candidate) =>
          candidate.action === "create" &&
          candidate.entity_type === task.entity_type &&
          (!task.entity_id ||
            candidate.entity_name.toLowerCase() ===
              task.entity_name.toLowerCase()),
      );

    return createDependency
      ? { ...task, depends_on: [createDependency.task_id] }
      : task;
  });
}

function compactConfirmationFor(
  tasks: TaskPlanItem[],
  riskLevel: ToolRiskLevel,
): CompactConfirmation | null {
  if (tasks.length !== 1 || (riskLevel !== "safe" && riskLevel !== "low")) {
    return null;
  }

  const [task] = tasks;
  const fieldChanges = task.field_changes ?? [];
  if (fieldChanges.length !== 1) {
    return null;
  }

  const [fieldChange] = fieldChanges;
  return {
    entity_name: task.entity_name,
    field_name: fieldChange.field,
    current_value: fieldChange.current_value,
    new_value: fieldChange.new_value,
  };
}

function taskSummary(tasks: TaskPlanItem[]): string {
  if (tasks.length === 0) {
    return "No executable tasks were produced.";
  }

  if (tasks.length === 1) {
    return tasks[0].description;
  }

  return `${tasks.length} tasks require approval: ${tasks.map((task) => task.description).join("; ")}`;
}

function isMissingString(value: unknown): boolean {
  return !readString(value);
}

function isEmailCampaignTask(task: TaskPlanItem): boolean {
  const deliveryMethod =
    readString(task.tool_params.delivery_method) ?? "email";
  return (
    task.tool_name === "create_campaign" &&
    task.entity_type === "campaign" &&
    task.action === "create" &&
    deliveryMethod === "email"
  );
}

function campaignNeedsPrefill(task: TaskPlanItem): boolean {
  return (
    isEmailCampaignTask(task) &&
    (isMissingString(task.tool_params.subject_line) ||
      isMissingString(task.tool_params.content))
  );
}

function inferCampaignTone(userMessage: string, params: JsonObject): string {
  const source = [
    userMessage,
    readString(params.name),
    readString(params.content),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /\b(sale|discount|promo|promotion|deal|limited time|clearance)\b/.test(
      source,
    )
  ) {
    return "urgent";
  }

  if (/\b(welcome|hello|introduce|intro|new customer)\b/.test(source)) {
    return "warm";
  }

  if (
    /\b(holiday|mother'?s day|seasonal|spring|summer|fall|autumn|winter|christmas|valentine)\b/.test(
      source,
    )
  ) {
    return "seasonal";
  }

  return "professional";
}

function campaignPrompt(task: TaskPlanItem, userMessage: string): string {
  const campaignName = readString(task.tool_params.name) ?? task.entity_name;
  const audienceParts = [
    task.tool_params.include_all_customers === true ? "all customers" : null,
    readString(task.tool_params.segment_id)
      ? `segment ${readString(task.tool_params.segment_id)}`
      : null,
  ].filter((part): part is string => Boolean(part));
  const audience =
    audienceParts.length > 0
      ? audienceParts.join(", ")
      : "the store's email audience";

  return [
    `Create campaign copy for: ${campaignName}.`,
    `Audience: ${audience}.`,
    `User request: ${userMessage}`,
  ].join("\n");
}

function stringOptionsFromResult(result: ToolResult): string[] {
  const data = asJsonObject(result.data);
  if (!data) {
    return [];
  }

  const options = Array.isArray(data.options)
    ? data.options
        .map(readString)
        .filter((option): option is string => Boolean(option))
    : [];
  if (options.length > 0) {
    return options.slice(0, 3);
  }

  const text = readString(data.text) ?? readString(data.content);
  return text
    ? text
        .split("\n")
        .map((line) => line.replace(/^\d+[.)]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
}

function textFromResult(result: ToolResult): string | null {
  const data = asJsonObject(result.data);
  return readString(data?.text) ?? readString(data?.content);
}

async function executeGenerateContent(
  params: JsonObject,
  context: CampaignPrefillContext,
): Promise<ToolResult> {
  return await executeTool("generate_content", params, {
    tenantId: context.tenantId,
    userId: context.userId,
    userRole: context.userRole,
    userName: context.userName,
    conversationId: context.conversationId,
    messageId: context.messageId,
    timezone: context.timezone,
    authenticatedTenantId: context.tenantId,
    serviceClient: context.serviceClient,
    dataClient: context.dataClient,
  });
}

async function generateCampaignPrefill(
  task: TaskPlanItem,
  context: CampaignPrefillContext,
): Promise<CampaignPrefillDraft> {
  const tone = inferCampaignTone(context.userMessage, task.tool_params);
  const prompt = campaignPrompt(task, context.userMessage);
  const campaignTitle = readString(task.tool_params.name) ?? task.entity_name;
  const [subjectResult, bodyResult] = await Promise.all([
    isMissingString(task.tool_params.subject_line)
      ? executeGenerateContent(
          {
            content_type: "subject_lines",
            tone,
            prompt,
            topic: campaignTitle,
            campaign_title: campaignTitle,
          },
          context,
        )
      : Promise.resolve(null),
    isMissingString(task.tool_params.content)
      ? executeGenerateContent(
          {
            content_type: "email_body",
            tone,
            prompt,
            topic: campaignTitle,
            campaign_title: campaignTitle,
          },
          context,
        )
      : Promise.resolve(null),
  ]);

  return {
    subjectOptions: subjectResult?.success
      ? stringOptionsFromResult(subjectResult)
      : [],
    bodyText: bodyResult?.success ? textFromResult(bodyResult) : null,
  };
}

function subjectMetadata(options: string[]): EditableFieldMetadata {
  return {
    field: "subject_line",
    input_type: "select",
    label: "Subject line",
    auto_generated: true,
    source: "generate_content",
    options: options.map((option, index) => ({
      id: `subject_${index + 1}`,
      label: option,
      value: option,
      description: index === 0 ? "Selected by default" : null,
    })),
  };
}

function contentMetadata(): EditableFieldMetadata {
  return {
    field: "content",
    input_type: "textarea",
    label: "Email body",
    auto_generated: true,
    source: "generate_content",
    options: [],
  };
}

function applyCampaignPrefill(
  task: TaskPlanItem,
  draft: CampaignPrefillDraft,
): TaskPlanItem {
  let nextTask = task;
  const firstSubject = draft.subjectOptions[0] ?? null;

  if (firstSubject && isMissingString(nextTask.tool_params.subject_line)) {
    nextTask = {
      ...nextTask,
      tool_params: { ...nextTask.tool_params, subject_line: firstSubject },
      field_changes: upsertFieldChange(
        nextTask.field_changes,
        "subject_line",
        firstSubject,
      ),
      editable_fields: addEditableField(
        nextTask.editable_fields,
        "subject_line",
      ),
      editable_field_metadata: upsertFieldMetadata(
        nextTask.editable_field_metadata,
        subjectMetadata(draft.subjectOptions),
      ),
    };
  }

  if (draft.bodyText && isMissingString(nextTask.tool_params.content)) {
    nextTask = {
      ...nextTask,
      tool_params: { ...nextTask.tool_params, content: draft.bodyText },
      field_changes: upsertFieldChange(
        nextTask.field_changes,
        "content",
        draft.bodyText,
      ),
      editable_fields: addEditableField(nextTask.editable_fields, "content"),
      editable_field_metadata: upsertFieldMetadata(
        nextTask.editable_field_metadata,
        contentMetadata(),
      ),
    };
  }

  return nextTask;
}

export async function prefillCampaignContent(
  plan: TaskPlan,
  context: CampaignPrefillContext,
): Promise<TaskPlan> {
  const tasks = await Promise.all(
    plan.tasks.map(async (task) => {
      if (!campaignNeedsPrefill(task)) {
        return task;
      }

      try {
        const draft = await generateCampaignPrefill(task, context);
        return applyCampaignPrefill(task, draft);
      } catch (error) {
        console.error("[bloom-assist] Campaign content prefill failed", error);
        return task;
      }
    }),
  );

  return { ...plan, tasks };
}

export function generateTaskPlan(
  toolResults: TaskPlanToolResult[],
  orchestratorContext: TaskPlanGenerationContext,
): TaskPlan {
  const tasks: TaskPlanItem[] = [];
  let overallRisk: ToolRiskLevel = "safe";

  for (const [index, toolResult] of toolResults.entries()) {
    if (!isToolName(toolResult.tool_name)) {
      continue;
    }

    const tool = getRegisteredTool(toolResult.tool_name);
    const details = readConfirmationDetails(toolResult.tool_result);
    const taskPlan = readEmbeddedTaskPlan(toolResult.tool_result);
    const riskLevel = normalizeRisk(
      details.risk_level ?? tool?.risk_level,
      tool?.risk_level ?? "medium",
    );
    const entityType = inferEntityType(toolResult.tool_name);
    const fieldChanges = inferFieldChanges(
      toolResult.tool_name,
      toolResult.tool_params,
      taskPlan,
    );
    const description =
      readString(details.action) ||
      readString(toolResult.tool_result.message) ||
      `${toolResult.tool_name.replace(/_/g, " ")} with approved parameters`;

    overallRisk = maxRisk(overallRisk, riskLevel);
    tasks.push({
      task_id: `task_${index + 1}`,
      action: inferAction(toolResult.tool_name),
      entity_type: entityType,
      entity_id: inferEntityId(entityType, toolResult.tool_params),
      entity_name: inferEntityName(
        toolResult.tool_name,
        toolResult.tool_params,
        taskPlan,
        details,
      ),
      tool_name: toolResult.tool_name,
      tool_params: toolResult.tool_params,
      description,
      field_changes: fieldChanges,
      risk_level: riskLevel,
      depends_on: readStringArray(taskPlan.depends_on).filter((taskId) =>
        /^task_[0-9]+$/.test(taskId),
      ),
      editable_fields: tool
        ? editableFieldsFromSchema(tool.function.parameters)
        : [],
      validation_annotations: [],
      status: "pending",
      error_message: null,
    });
  }

  const tasksWithDependencies = inferDependencies(tasks);
  const compactConfirmation = compactConfirmationFor(
    tasksWithDependencies,
    overallRisk,
  );
  const plan: TaskPlan = {
    plan_id: crypto.randomUUID(),
    originating_message_id: orchestratorContext.messageId,
    summary: taskSummary(tasksWithDependencies),
    risk_level: overallRisk,
    compact: Boolean(compactConfirmation),
    compact_confirmation: compactConfirmation,
    tasks: tasksWithDependencies,
    created_at: new Date().toISOString(),
  };

  return plan;
}
