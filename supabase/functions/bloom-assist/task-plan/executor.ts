import type { JsonObject, JsonValue, PersistenceClient } from "../types.ts";
import { executeTool, validateToolParams } from "../tools/executor.ts";
import { getRegisteredTool } from "../tools/registry.ts";
import type { ToolName, ToolResult } from "../tools/types.ts";
import type {
  ApprovalExecutionContext,
  PersistedTaskPlan,
  TaskPlan,
  TaskPlanCompletionSummary,
  TaskPlanItem,
} from "./types.ts";
import { taskPlanSummaryToJson, taskPlanToJson } from "./types.ts";
import { claimAction, finishClaim } from "../action-claims.ts";
import {
  assertPlanOwner,
  cancelPlanSteps,
  enqueueRemainingSteps,
  type PlanStepJob,
  type PlanStepQueue,
  remainingTaskIds,
  runPlanSteps,
  type StepClaims,
  type StepExecution,
} from "./durable-runner.ts";

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
  // An export approval binds the audience, not a movable "latest" pointer.
  if (task.tool_name === "export_data" &&
      ["scope", "set_id", "entity"].some((field) => params[field] !== task.tool_params[field])) {
    return "The export audience cannot change after preview. Request a new export approval.";
  }
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
    cancelled_count: plan.tasks.filter((task) => task.status === "cancelled")
      .length,
    unknown_count: plan.tasks.filter((task) => task.status === "unknown")
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
  const extra = [
    summary.cancelled_count > 0 ? `${summary.cancelled_count} cancelled` : null,
    summary.unknown_count > 0 ? `${summary.unknown_count} not confirmed` : null,
  ].filter(Boolean).join(", ");
  const content = `Task plan complete: ${summary.completed_count} completed, ${summary.skipped_count} skipped, ${summary.failed_count} failed${extra ? `, ${extra}` : ""}.`;
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

export function preparePlanForApproval(
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
        tool_params: task.tool_name === "export_data" ? task.tool_params : editedParams,
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

const TRANSIENT_TOOL_ERRORS = new Set(["timeout_error", "execution_error"]);

/** Turns one tool run into a step outcome. A thrown error means the outcome is unknown. */
async function executeStep(
  task: TaskPlanItem,
  params: JsonObject,
  context: ApprovalExecutionContext,
): Promise<StepExecution> {
  const result = await executeTool(task.tool_name, params, {
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
    approved: true,
    clientContext: context.clientContext ?? null,
  });
  if (resultStatus(result) === "completed") {
    return { kind: "completed", result: toolResultToJson(result), message: result.message ?? null };
  }
  return {
    kind: "failed",
    transient: !result.confirmation_required && TRANSIENT_TOOL_ERRORS.has(result.error ?? ""),
    result: toolResultToJson(result),
    message: toPublicErrorMessage(result.message || result.error),
  };
}

function isPlanStepJob(value: unknown): value is PlanStepJob {
  return isRecord(value) && typeof value.job_id === "string" && typeof value.task_id === "string" &&
    typeof value.status === "string" && isJsonObject(value.tool_params);
}

function readJobs(value: unknown): PlanStepJob[] {
  return Array.isArray(value) ? value.filter(isPlanStepJob) : [];
}

/** bloom_support.jobs for one plan, through the service-role-only gateway. */
export function createPlanStepQueue(
  client: PersistenceClient,
  owner: { tenantId: string; userId: string; conversationId: string; messageId: string; planId: string },
): PlanStepQueue {
  const base = { tenant_id: owner.tenantId, user_id: owner.userId, plan_id: owner.planId };
  const call = async (fn: string, args: Record<string, unknown> = {}): Promise<unknown> => {
    const { data, error } = await client.rpc("bloom_chat_plan_rpc", { p_fn: fn, p: { ...base, ...args } });
    if (error) throw new Error(`Plan step queue (${fn}) failed: ${error.message}`);
    return data;
  };
  return {
    enqueue: async (steps) =>
      readJobs(await call("enqueue", { conversation_id: owner.conversationId, message_id: owner.messageId, steps })),
    steps: async () => readJobs(await call("steps")),
    claim: async (taskId, worker) => {
      const job = await call("claim", { task_id: taskId, worker });
      return isPlanStepJob(job) ? job : null;
    },
    finish: async (job, worker, finish) => {
      const status = await call("finish", finish.outcome === "succeeded"
        ? { job_id: job.job_id, worker, outcome: "succeeded", result: finish.result }
        : { job_id: job.job_id, worker, outcome: "failed", error: finish.error, permanent: finish.permanent, retry_in: finish.retryIn });
      return status === "succeeded" || status === "queued" ? status : "dead";
    },
    cancel: async (taskIds, reason) => {
      const ids = await call("cancel", { task_ids: taskIds, reason });
      return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
    },
    requeue: async (taskId) => {
      const job = await call("requeue", { task_id: taskId });
      return isPlanStepJob(job) ? job : null;
    },
  };
}

function createStepClaims(client: PersistenceClient, context: ApprovalExecutionContext): StepClaims {
  return {
    claim: (mutationId, toolName) =>
      claimAction(client, {
        mutationId,
        tenantId: context.tenantId,
        userId: context.userId,
        conversationId: context.conversationId,
        messageId: context.messageId,
        toolName,
      }),
    finish: (mutationId, status, result) => finishClaim(client, mutationId, status, result),
  };
}

const WORKER_PREFIX = "bloom-assist";

async function loadOwnedPlan(planId: string, context: ApprovalExecutionContext) {
  const persisted = await loadTaskPlan(
    context.serviceClient,
    context.tenantId,
    context.conversationId,
    planId,
  );
  if (!persisted) {
    throw new Error("Task plan not found for this conversation.");
  }
  // Same person and company that the plan was made for (the conversation check
  // in index.ts already guarantees this; the plan message is checked as well).
  assertPlanOwner({ tenantId: context.tenantId, userId: persisted.userId }, { tenantId: context.tenantId, userId: context.userId });
  const executionContext: ApprovalExecutionContext = { ...context, messageId: persisted.messageId };
  const queue = createPlanStepQueue(context.serviceClient, {
    tenantId: context.tenantId,
    userId: context.userId,
    conversationId: context.conversationId,
    messageId: persisted.messageId,
    planId,
  });
  return { persisted, executionContext, queue };
}

async function runAndSummarise(
  plan: TaskPlan,
  messageId: string,
  queue: PlanStepQueue,
  context: ApprovalExecutionContext,
): Promise<TaskPlanCompletionSummary> {
  await enqueueRemainingSteps(plan, queue);
  const executed = await runPlanSteps(plan, {
    queue,
    claims: createStepClaims(context.serviceClient, context),
    execute: (task, params) => executeStep(task, params, context),
    persist: (next) => updatePersistedPlan(context.serviceClient, messageId, context.tenantId, next),
    emit: context.emitProgress,
    worker: `${WORKER_PREFIX}-${crypto.randomUUID().slice(0, 8)}`,
  });
  const summary: TaskPlanCompletionSummary = {
    plan_id: plan.plan_id,
    ...statusCounts(executed.plan),
    results: executed.results,
  };
  await persistCompletionMessage(context.serviceClient, context, summary);
  return summary;
}

export async function processApproval(
  planId: string,
  approvedTaskIds: string[],
  skippedTaskIds: string[],
  editedFields: Record<string, JsonObject>,
  context: ApprovalExecutionContext,
  retryTaskId: string | null = null,
): Promise<TaskPlanCompletionSummary> {
  const { persisted, executionContext, queue } = await loadOwnedPlan(planId, context);

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

  // The approved plan is saved before anything runs, so a crash can be resumed.
  await updatePersistedPlan(executionContext.serviceClient, persisted.messageId, executionContext.tenantId, prepared.plan);
  if (retryTaskId) {
    await queue.requeue(retryTaskId);
  }
  return await runAndSummarise(prepared.plan, persisted.messageId, queue, executionContext);
}

/** Continues an interrupted plan. Finished steps are not run again. */
export async function processResume(
  planId: string,
  context: ApprovalExecutionContext,
): Promise<TaskPlanCompletionSummary> {
  const { persisted, executionContext, queue } = await loadOwnedPlan(planId, context);
  if (remainingTaskIds(persisted.plan).length === 0) {
    throw new Error("Nothing is left to run in this plan.");
  }
  await logApprovalAudit(executionContext.serviceClient, executionContext, {
    plan_id: planId,
    action: "resume",
    remaining_task_ids: remainingTaskIds(persisted.plan),
  });
  return await runAndSummarise(persisted.plan, persisted.messageId, queue, executionContext);
}

/** Stops the steps that have not started. A step that is running finishes. */
export async function processCancel(
  planId: string,
  context: ApprovalExecutionContext,
): Promise<{ plan: JsonObject; cancelled_task_ids: string[]; running_task_ids: string[] }> {
  const { persisted, executionContext, queue } = await loadOwnedPlan(planId, context);
  const cancelled = await cancelPlanSteps(persisted.plan, queue);
  await updatePersistedPlan(executionContext.serviceClient, persisted.messageId, executionContext.tenantId, cancelled.plan);
  await logApprovalAudit(executionContext.serviceClient, executionContext, {
    plan_id: planId,
    action: "cancel",
    cancelled_task_ids: cancelled.cancelledTaskIds,
    running_task_ids: cancelled.runningTaskIds,
  });
  return {
    plan: taskPlanToJson(cancelled.plan),
    cancelled_task_ids: cancelled.cancelledTaskIds,
    running_task_ids: cancelled.runningTaskIds,
  };
}

export function isKnownToolName(value: string): value is ToolName {
  return Boolean(getRegisteredTool(value));
}
