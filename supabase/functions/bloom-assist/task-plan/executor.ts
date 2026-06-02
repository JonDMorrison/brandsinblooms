import type { JsonObject, JsonValue, PersistenceClient } from "../types.ts";
import { executeTool, validateToolParams } from "../tools/executor.ts";
import { getRegisteredTool } from "../tools/registry.ts";
import type { ToolName, ToolResult } from "../tools/types.ts";
import type {
  ApprovalExecutionContext,
  PersistedTaskPlan,
  TaskExecutionResult,
  TaskPlan,
  TaskPlanCompletionSummary,
  TaskPlanItem,
} from "./types.ts";
import { taskPlanSummaryToJson, taskPlanToJson } from "./types.ts";

type TaskPlanMessageRow = {
  id: string;
  conversation_id: string;
  tenant_id: string;
  user_id: string;
  block_data: JsonValue | null;
};

type ConversationSummaryRow = {
  user_id: string;
};

const PUBLIC_ERROR_MAX_LENGTH = 240;

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

function toPublicErrorMessage(value: unknown): string {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : "Task execution failed.";

  return (
    message.replace(/\s+/g, " ").trim().slice(0, PUBLIC_ERROR_MAX_LENGTH) ||
    "Task execution failed."
  );
}

function parseTaskPlan(value: unknown): TaskPlan | null {
  if (!isRecord(value)) return null;
  const plan = isRecord(value.task_plan) ? value.task_plan : value;
  if (
    !isRecord(plan) ||
    typeof plan.plan_id !== "string" ||
    !Array.isArray(plan.tasks)
  ) {
    return null;
  }

  return plan as TaskPlan;
}

function blockDataWithPlan(plan: TaskPlan, base: JsonObject = {}): JsonObject {
  return {
    ...base,
    block_type: "task_plan",
    task_plan: taskPlanToJson(plan),
  };
}

function mergeEditedFields(params: JsonObject, edits: JsonObject): JsonObject {
  const merged: JsonObject = { ...params };
  for (const [fieldPath, value] of Object.entries(edits)) {
    if (!isJsonValue(value)) continue;

    const [head, tail] = fieldPath.split(".", 2);
    if (tail && isJsonObject(merged[head])) {
      merged[head] = {
        ...(merged[head] as JsonObject),
        [tail]: value,
      };
      continue;
    }

    merged[fieldPath] = value;
  }
  return merged;
}

function validateEditedParams(
  task: TaskPlanItem,
  params: JsonObject,
): string | null {
  const tool = getRegisteredTool(task.tool_name);
  if (!tool) {
    return `Unknown tool: ${task.tool_name}`;
  }

  const validation = validateToolParams(tool, params);
  if (validation.ok) {
    return null;
  }

  return validation.issues
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("; ");
}

function statusCounts(
  plan: TaskPlan,
): Omit<TaskPlanCompletionSummary, "plan_id" | "results"> {
  return {
    completed_count: plan.tasks.filter((task) => task.status === "completed")
      .length,
    skipped_count: plan.tasks.filter((task) => task.status === "skipped")
      .length,
    failed_count: plan.tasks.filter((task) => task.status === "failed").length,
    blocked_count: plan.tasks.filter((task) => task.status === "blocked")
      .length,
  };
}

function toolResultToJson(result: ToolResult): JsonObject {
  return {
    success: result.success,
    data: result.data,
    count: result.count,
    message: result.message,
    error: result.error,
    block_type: result.block_type,
    confirmation_required: result.confirmation_required ?? false,
    confirmation_details: result.confirmation_details
      ? {
          action: result.confirmation_details.action,
          affected_count: result.confirmation_details.affected_count,
          reversible: result.confirmation_details.reversible,
          risk_level: result.confirmation_details.risk_level,
          tool_name: result.confirmation_details.tool_name,
        }
      : null,
  };
}

async function updatePersistedPlan(
  client: PersistenceClient,
  messageId: string,
  tenantId: string,
  plan: TaskPlan,
): Promise<void> {
  const { error } = await client
    .from("bloom_messages")
    .update({ block_data: blockDataWithPlan(plan) })
    .eq("id", messageId)
    .eq("tenant_id", tenantId);
  if (error) throw error;
}

async function refreshConversationSummary(
  client: PersistenceClient,
  tenantId: string,
  conversationId: string,
  preview: string,
): Promise<void> {
  const { count, error: countError } = await client
    .from("bloom_messages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId);
  if (countError) throw countError;

  const { error } = await client
    .from("bloom_conversations")
    .update({
      message_count: count ?? 0,
      last_message_preview: preview,
    })
    .eq("id", conversationId)
    .eq("tenant_id", tenantId);
  if (error) throw error;
}

async function persistCompletionMessage(
  client: PersistenceClient,
  context: ApprovalExecutionContext,
  summary: TaskPlanCompletionSummary,
): Promise<void> {
  const content = `Task plan complete: ${summary.completed_count} completed, ${summary.skipped_count} skipped, ${summary.failed_count} failed.`;
  const { error } = await client.from("bloom_messages").insert({
    conversation_id: context.conversationId,
    tenant_id: context.tenantId,
    user_id: context.userId,
    role: "assistant",
    content,
    thinking_content: null,
    block_data: {
      block_type: "confirmation",
      task_complete: taskPlanSummaryToJson(summary),
    },
    mode: context.mode,
    model: null,
    tokens_input: 0,
    tokens_output: 0,
    follow_up_chips: [],
  });
  if (error) throw error;
  await refreshConversationSummary(
    client,
    context.tenantId,
    context.conversationId,
    content,
  );
}

async function logApprovalAudit(
  client: PersistenceClient,
  context: ApprovalExecutionContext,
  eventData: JsonObject,
): Promise<void> {
  const { error } = await client.from("bloom_audit_log").insert({
    tenant_id: context.tenantId,
    user_id: context.userId,
    conversation_id: context.conversationId,
    message_id: context.messageId,
    event_type: "approval",
    event_data: eventData,
  });
  if (error) throw error;
}

function resultStatus(result: ToolResult): "completed" | "failed" {
  return result.success && result.confirmation_required !== true
    ? "completed"
    : "failed";
}

export async function executeTask(
  task: TaskPlanItem,
  serviceClient: PersistenceClient,
  tenantId: string,
  context: ApprovalExecutionContext,
): Promise<TaskExecutionResult> {
  const startedAt = Date.now();
  try {
    const result = await executeTool(task.tool_name, task.tool_params, {
      tenantId,
      userId: context.userId,
      userRole: context.userRole,
      userName: context.userName,
      conversationId: context.conversationId,
      messageId: context.messageId,
      timezone: context.timezone,
      authenticatedTenantId: tenantId,
      serviceClient,
      dataClient: context.dataClient,
      approved: true,
    });
    const status = resultStatus(result);
    return {
      task_id: task.task_id,
      tool_name: task.tool_name,
      status,
      result: toolResultToJson(result),
      error_message:
        status === "failed"
          ? toPublicErrorMessage(result.message || result.error)
          : null,
      execution_time_ms: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      task_id: task.task_id,
      tool_name: task.tool_name,
      status: "failed",
      result: null,
      error_message: toPublicErrorMessage(error),
      execution_time_ms: Date.now() - startedAt,
    };
  }
}

export async function loadTaskPlan(
  serviceClient: PersistenceClient,
  tenantId: string,
  conversationId: string,
  planId: string,
): Promise<PersistedTaskPlan | null> {
  const { data, error } = await serviceClient
    .from("bloom_messages")
    .select("id, conversation_id, tenant_id, user_id, block_data")
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  for (const row of (data ?? []) as TaskPlanMessageRow[]) {
    const plan = parseTaskPlan(row.block_data);
    if (plan?.plan_id === planId) {
      return {
        plan,
        messageId: row.id,
        conversationId: row.conversation_id,
        userId: row.user_id,
      };
    }
  }

  return null;
}

function preparePlanForApproval(
  plan: TaskPlan,
  approvedTaskIds: string[],
  skippedTaskIds: string[],
  editedFields: Record<string, JsonObject>,
  retryTaskId: string | null,
): { plan: TaskPlan; error: string | null } {
  const approved = new Set(retryTaskId ? [retryTaskId] : approvedTaskIds);
  const skipped = new Set(skippedTaskIds);
  const taskIds = new Set(plan.tasks.map((task) => task.task_id));

  for (const id of [...approved, ...skipped]) {
    if (!taskIds.has(id)) {
      return { plan, error: `Unknown task_id: ${id}` };
    }
  }

  if (retryTaskId) {
    const retryTask = plan.tasks.find((task) => task.task_id === retryTaskId);
    if (retryTask?.status !== "failed" && retryTask?.status !== "blocked") {
      return { plan, error: "Only failed or blocked tasks can be retried." };
    }
  }

  if (
    !retryTaskId &&
    plan.tasks.some(
      (task) =>
        approved.has(task.task_id) &&
        task.validation_annotations.some(
          (annotation) => annotation.type === "error",
        ),
    )
  ) {
    return {
      plan,
      error: "Resolve validation errors before approving the selected task.",
    };
  }

  const tasks = plan.tasks.map((task) => {
    if (skipped.has(task.task_id) && !retryTaskId) {
      return { ...task, status: "skipped" as const, error_message: null };
    }

    if (!approved.has(task.task_id)) {
      return task;
    }

    const editedParams = mergeEditedFields(
      task.tool_params,
      editedFields[task.task_id] ?? {},
    );
    const validationError = validateEditedParams(task, editedParams);
    if (validationError) {
      return {
        ...task,
        tool_params: editedParams,
        status: "failed" as const,
        error_message: validationError,
      };
    }

    return {
      ...task,
      tool_params: editedParams,
      status: "approved" as const,
      error_message: null,
    };
  });

  return { plan: { ...plan, tasks }, error: null };
}

function dependencyFailed(
  task: TaskPlanItem,
  tasksById: Map<string, TaskPlanItem>,
): boolean {
  return task.depends_on.some((dependencyId) => {
    const dependency = tasksById.get(dependencyId);
    return (
      dependency?.status === "failed" ||
      dependency?.status === "blocked" ||
      dependency?.status === "skipped"
    );
  });
}

function dependenciesComplete(
  task: TaskPlanItem,
  tasksById: Map<string, TaskPlanItem>,
): boolean {
  return task.depends_on.every(
    (dependencyId) => tasksById.get(dependencyId)?.status === "completed",
  );
}

function nextReadyTasks(tasks: TaskPlanItem[]): TaskPlanItem[] {
  const tasksById = new Map(tasks.map((task) => [task.task_id, task]));
  return tasks.filter(
    (task) =>
      task.status === "approved" && dependenciesComplete(task, tasksById),
  );
}

function markBlockedTasks(tasks: TaskPlanItem[]): TaskPlanItem[] {
  let changed = true;
  let nextTasks = tasks;
  while (changed) {
    changed = false;
    const tasksById = new Map(nextTasks.map((task) => [task.task_id, task]));
    nextTasks = nextTasks.map((task) => {
      if (task.status === "approved" && dependencyFailed(task, tasksById)) {
        changed = true;
        return {
          ...task,
          status: "blocked" as const,
          error_message: "A required earlier task did not complete.",
        };
      }
      return task;
    });
  }
  return nextTasks;
}

function applyTaskResult(
  tasks: TaskPlanItem[],
  result: TaskExecutionResult,
): TaskPlanItem[] {
  return tasks.map((task) =>
    task.task_id === result.task_id
      ? { ...task, status: result.status, error_message: result.error_message }
      : task,
  );
}

function incompleteApprovedTasks(tasks: TaskPlanItem[]): boolean {
  return tasks.some(
    (task) => task.status === "approved" || task.status === "executing",
  );
}

async function executeApprovedTasks(
  plan: TaskPlan,
  context: ApprovalExecutionContext,
): Promise<{ plan: TaskPlan; results: TaskExecutionResult[] }> {
  let tasks = markBlockedTasks(plan.tasks);
  const results: TaskExecutionResult[] = [];

  while (incompleteApprovedTasks(tasks)) {
    const readyTasks = nextReadyTasks(tasks);
    if (readyTasks.length === 0) {
      tasks = markBlockedTasks(tasks);
      break;
    }

    for (const readyTask of readyTasks) {
      context.emitProgress({
        plan_id: plan.plan_id,
        task_id: readyTask.task_id,
        status: "executing",
      });
      tasks = tasks.map((task) =>
        task.task_id === readyTask.task_id
          ? { ...task, status: "executing" as const, error_message: null }
          : task,
      );

      const result = await executeTask(
        readyTask,
        context.serviceClient,
        context.tenantId,
        context,
      );
      results.push(result);
      context.emitProgress({
        plan_id: plan.plan_id,
        task_id: result.task_id,
        status: result.status,
        error_message: result.error_message,
      });
      tasks = applyTaskResult(tasks, result);
    }

    const blockedBefore = new Set(
      tasks
        .filter((task) => task.status === "blocked")
        .map((task) => task.task_id),
    );
    tasks = markBlockedTasks(tasks);
    for (const task of tasks) {
      if (task.status === "blocked" && !blockedBefore.has(task.task_id)) {
        context.emitProgress({
          plan_id: plan.plan_id,
          task_id: task.task_id,
          status: "blocked",
          error_message: task.error_message,
        });
      }
    }
  }

  return { plan: { ...plan, tasks }, results };
}

export async function processApproval(
  planId: string,
  approvedTaskIds: string[],
  skippedTaskIds: string[],
  editedFields: Record<string, JsonObject>,
  context: ApprovalExecutionContext,
  retryTaskId: string | null = null,
): Promise<TaskPlanCompletionSummary> {
  const persisted = await loadTaskPlan(
    context.serviceClient,
    context.tenantId,
    context.conversationId,
    planId,
  );
  if (!persisted) {
    throw new Error("Task plan not found for this conversation.");
  }

  const executionContext: ApprovalExecutionContext = {
    ...context,
    messageId: persisted.messageId,
    userId: persisted.userId,
  };

  const prepared = preparePlanForApproval(
    persisted.plan,
    approvedTaskIds,
    skippedTaskIds,
    editedFields,
    retryTaskId,
  );
  if (prepared.error) {
    throw new Error(prepared.error);
  }

  for (const task of prepared.plan.tasks) {
    if (task.status === "skipped" || task.status === "failed") {
      executionContext.emitProgress({
        plan_id: prepared.plan.plan_id,
        task_id: task.task_id,
        status: task.status,
        error_message: task.error_message,
      });
    }
  }

  await logApprovalAudit(executionContext.serviceClient, executionContext, {
    plan_id: planId,
    approved_task_ids: approvedTaskIds.map((id) => id),
    skipped_task_ids: skippedTaskIds.map((id) => id),
    retry_task_id: retryTaskId,
  });

  const executed = await executeApprovedTasks(prepared.plan, executionContext);
  await updatePersistedPlan(
    executionContext.serviceClient,
    persisted.messageId,
    executionContext.tenantId,
    executed.plan,
  );
  const counts = statusCounts(executed.plan);
  const summary: TaskPlanCompletionSummary = {
    plan_id: planId,
    ...counts,
    results: executed.results,
  };
  await persistCompletionMessage(
    executionContext.serviceClient,
    executionContext,
    summary,
  );
  return summary;
}

export function isKnownToolName(value: string): value is ToolName {
  return Boolean(getRegisteredTool(value));
}
