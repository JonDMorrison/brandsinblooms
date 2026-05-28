import type {
  BloomMode,
  JsonArray,
  JsonObject,
  JsonValue,
  PersistenceClient,
} from "../types.ts";
import type { ToolName, ToolRiskLevel } from "../tools/types.ts";

export const TASK_PLAN_ACTIONS = [
  "create",
  "update",
  "delete",
  "send",
  "schedule",
  "assign",
  "tag",
  "consent_change",
] as const;

export const TASK_PLAN_ENTITY_TYPES = [
  "customer",
  "product",
  "campaign",
  "segment",
  "tag",
] as const;

export const TASK_PLAN_ITEM_STATUSES = [
  "pending",
  "approved",
  "skipped",
  "executing",
  "completed",
  "failed",
  "blocked",
] as const;

export const VALIDATION_ANNOTATION_TYPES = [
  "warning",
  "error",
  "suggestion",
  "info",
] as const;

export const VALIDATION_STEPS = [
  "duplicate_detection",
  "ambiguity_detection",
  "data_quality_validation",
  "constraint_checking",
  "cross_reference_validation",
  "conflict_detection",
  "smart_suggestions",
] as const;

export type TaskPlanAction = (typeof TASK_PLAN_ACTIONS)[number];
export type TaskPlanEntityType = (typeof TASK_PLAN_ENTITY_TYPES)[number];
export type TaskPlanItemStatus = (typeof TASK_PLAN_ITEM_STATUSES)[number];
export type ValidationAnnotationType =
  (typeof VALIDATION_ANNOTATION_TYPES)[number];
export type ValidationStep = (typeof VALIDATION_STEPS)[number];

export type FieldChange = {
  field: string;
  current_value: JsonValue | null;
  new_value: JsonValue | null;
};

export type ValidationResolutionOption = {
  id: string;
  label: string;
  value: JsonValue;
  description?: string | null;
};

export type EditableFieldInputType = "text" | "textarea" | "select";

export type EditableFieldMetadata = {
  field: string;
  input_type: EditableFieldInputType;
  label: string | null;
  auto_generated: boolean;
  source: string | null;
  options: ValidationResolutionOption[];
};

export type ValidationAnnotation = {
  type: ValidationAnnotationType;
  message: string;
  step: ValidationStep;
  resolution_options: ValidationResolutionOption[];
};

export type TaskPlanItem = {
  task_id: string;
  action: TaskPlanAction;
  entity_type: TaskPlanEntityType;
  entity_id: string | null;
  entity_name: string;
  tool_name: ToolName;
  tool_params: JsonObject;
  description: string;
  field_changes: FieldChange[] | null;
  risk_level: ToolRiskLevel;
  depends_on: string[];
  editable_fields: string[];
  editable_field_metadata?: EditableFieldMetadata[];
  validation_annotations: ValidationAnnotation[];
  status: TaskPlanItemStatus;
  error_message: string | null;
};

export type CompactConfirmation = {
  entity_name: string;
  field_name: string;
  current_value: JsonValue | null;
  new_value: JsonValue | null;
};

export type TaskPlan = {
  plan_id: string;
  originating_message_id: string;
  summary: string;
  risk_level: ToolRiskLevel;
  compact: boolean;
  compact_confirmation: CompactConfirmation | null;
  tasks: TaskPlanItem[];
  created_at: string;
};

export type TaskPlanToolResult = {
  tool_call_id: string;
  tool_name: string;
  tool_params: JsonObject;
  tool_result: JsonObject;
  block_type: string;
  execution_time_ms: number | null;
  error_message: string | null;
  iteration: number;
};

export type TaskPlanGenerationContext = {
  tenantId: string;
  userId: string;
  userRole: string;
  userName: string | null;
  conversationId: string;
  messageId: string;
  timezone: string;
};

export type TaskPlanApprovalPayload = {
  conversation_id: string;
  plan_id: string;
  approved_task_ids: string[];
  skipped_task_ids: string[];
  edited_fields: Record<string, JsonObject>;
  retry_task_id: string | null;
  mode: BloomMode;
  timezone: string;
};

export type PersistedTaskPlan = {
  plan: TaskPlan;
  messageId: string;
  conversationId: string;
  userId: string;
};

export type TaskExecutionResult = {
  task_id: string;
  tool_name: ToolName;
  status: TaskPlanItemStatus;
  result: JsonValue | null;
  error_message: string | null;
  execution_time_ms: number | null;
};

export type TaskPlanCompletionSummary = {
  plan_id: string;
  completed_count: number;
  skipped_count: number;
  failed_count: number;
  blocked_count: number;
  results: TaskExecutionResult[];
};

export type TaskProgressEmitter = (event: {
  plan_id: string;
  task_id: string;
  status: TaskPlanItemStatus;
  error_message?: string | null;
}) => void;

export type ApprovalExecutionContext = TaskPlanGenerationContext & {
  serviceClient: PersistenceClient;
  dataClient?: PersistenceClient;
  mode: BloomMode;
  emitProgress: TaskProgressEmitter;
};

export function taskPlanToJson(plan: TaskPlan): JsonObject {
  return {
    plan_id: plan.plan_id,
    originating_message_id: plan.originating_message_id,
    summary: plan.summary,
    risk_level: plan.risk_level,
    compact: plan.compact,
    compact_confirmation: plan.compact_confirmation,
    tasks: plan.tasks.map((task) => ({
      task_id: task.task_id,
      action: task.action,
      entity_type: task.entity_type,
      entity_id: task.entity_id,
      entity_name: task.entity_name,
      tool_name: task.tool_name,
      tool_params: task.tool_params,
      description: task.description,
      field_changes: task.field_changes,
      risk_level: task.risk_level,
      depends_on: task.depends_on.map((id) => id),
      editable_fields: task.editable_fields.map((field) => field),
      editable_field_metadata: (task.editable_field_metadata ?? []).map(
        (metadata) => ({
          field: metadata.field,
          input_type: metadata.input_type,
          label: metadata.label,
          auto_generated: metadata.auto_generated,
          source: metadata.source,
          options: metadata.options.map((option) => ({
            id: option.id,
            label: option.label,
            value: option.value,
            description: option.description ?? null,
          })),
        }),
      ),
      validation_annotations: task.validation_annotations.map((annotation) => ({
        type: annotation.type,
        message: annotation.message,
        step: annotation.step,
        resolution_options: annotation.resolution_options.map((option) => ({
          id: option.id,
          label: option.label,
          value: option.value,
          description: option.description ?? null,
        })),
      })),
      status: task.status,
      error_message: task.error_message,
    })),
    created_at: plan.created_at,
  };
}

export function taskPlanSummaryToJson(
  summary: TaskPlanCompletionSummary,
): JsonObject {
  return {
    plan_id: summary.plan_id,
    completed_count: summary.completed_count,
    skipped_count: summary.skipped_count,
    failed_count: summary.failed_count,
    blocked_count: summary.blocked_count,
    results: summary.results.map((result) => ({
      task_id: result.task_id,
      tool_name: result.tool_name,
      status: result.status,
      result: result.result,
      error_message: result.error_message,
      execution_time_ms: result.execution_time_ms,
    })) as JsonArray,
  };
}
