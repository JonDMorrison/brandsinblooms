import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

import {
  preparePendingAttachments,
  processAttachments,
  updateMessageAttachments,
} from "./attachments.ts";
import {
  finishCacheAuditScope,
  readCacheAuditScope,
  startCacheAuditScope,
} from "./cache.ts";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { buildContextLayers } from "./context-builder.ts";
import { prefetchEntitySummary } from "./entity-prefetch.ts";
import { selectModel } from "./model-router.ts";
import {
  processPostResponse,
  type PostResponseToolExecution,
} from "./post-processor.ts";
import {
  compactAuditObject,
  logSecurityAuditEvent,
  stackTraceSummary,
  summarizeForAudit,
} from "./security/audit.ts";
import {
  checkRateLimit,
  releaseRateLimitSlot,
} from "./security/rate-limiter.ts";
import { sanitizeInput } from "./security/sanitizer.ts";
import { validateOutput } from "./security/output-validator.ts";
import { processOpenAIStream } from "./stream-handler.ts";
import { processApproval } from "./task-plan/executor.ts";
import {
  generateTaskPlan,
  prefillCampaignContent,
} from "./task-plan/generator.ts";
import { validateTaskPlan } from "./task-plan/validator.ts";
import type { TaskPlanApprovalPayload } from "./task-plan/types.ts";
import { taskPlanSummaryToJson, taskPlanToJson } from "./task-plan/types.ts";
import { executeTool } from "./tools/executor.ts";
import { classifyIntentWithComplexity } from "./tools/intent-classifier.ts";
import {
  filterRegisteredTools,
  getRegisteredTool,
  toOpenAIToolDefinition,
} from "./tools/registry.ts";
import type {
  IntentClassificationResult,
  ToolCategory,
  ToolResult,
} from "./tools/types.ts";
import type {
  BloomAssistRequest,
  BloomAuditEventType,
  BloomCacheStats,
  BloomLatencyBreakdown,
  EntitySummary,
  BloomResourceFocus,
  BloomResourceType,
  BloomSessionType,
  InputSecurityAssessment,
  BloomMode,
  BloomModelPreference,
  BloomSseEvent,
  JsonArray,
  JsonObject,
  JsonValue,
  LogAuditEventOptions,
  OrchestratorContext,
  PageContext,
  PersistenceClient,
  PersistAssistantResponseResult,
  PersistUserMessageResult,
  StreamCompletion,
  TokenCounts,
  ToolExecutor,
  ToolExecutorResult,
  ToolExecutionStatus,
} from "./types.ts";

const CORS_OPTIONS = { allowMethods: "POST, OPTIONS" };
const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";
const TITLE_MODEL = "gpt-4o-mini";
const OPENAI_MODEL = "gpt-4o";
const QUERY_TOOL_CATEGORIES = new Set<ToolCategory>(["query"]);
const QUERY_ANALYTICS_TOOL_CATEGORIES = new Set<ToolCategory>([
  "query",
  "analytics",
]);
const MUTATION_TOOL_CATEGORIES = new Set<ToolCategory>(["query", "mutation"]);
const CONTENT_TOOL_CATEGORIES = new Set<ToolCategory>(["content"]);
const NAVIGATION_TOOL_CATEGORIES = new Set<ToolCategory>(["navigation"]);
const RESEARCH_TOOL_CATEGORIES = QUERY_ANALYTICS_TOOL_CATEGORIES;
const RESEARCH_MAX_TOOL_ITERATIONS = 15;
const MAX_OUTPUT_TOKENS = 8_000;
const MAX_MESSAGE_LENGTH = 20_000;
const MAX_RESOURCE_SUMMARY_LENGTH = 5_000;
const MAX_TIMEZONE_LENGTH = 128;
const MAX_PAGE_PATH_LENGTH = 2_048;
const MAX_PAGE_NAME_LENGTH = 160;
const MAX_ENTITY_FIELD_LENGTH = 256;
const MAX_PAGE_CONTEXT_LIST_ITEMS = 8;
const MAX_PAGE_CONTEXT_LIST_ITEM_LENGTH = 160;
const CONVERSATION_PREVIEW_LENGTH = 80;
const RATE_LIMIT_MESSAGE =
  "You've sent a lot of messages recently. Please try again in a few minutes.";
const IMAGE_REFINEMENT_SIGNAL_PATTERN =
  /\b(more|less|add|remove|change|different|brighter|darker|bigger|smaller)\b/i;
const IMAGE_REFINEMENT_NEGATION_PATTERN =
  /\b(no|not|without|don't|dont|remove)\s+[a-z][a-z\s-]{1,40}/i;
const IMAGE_REFINEMENT_FOLLOW_UPS: JsonArray = [
  "Make it brighter",
  "Add more flowers",
  "Try a different composition",
];
const RESOURCE_PARAMETER_NAMES: Record<BloomResourceType, string> = {
  customer: "customer_id",
  product: "product_id",
  order: "order_id",
  campaign: "campaign_id",
  segment: "segment_id",
  automation: "automation_id",
  invoice: "invoice_id",
};

type UserContext = OrchestratorContext & {
  conversationId: string | null;
};

type PublicUserRow = {
  tenant_id: string | null;
  role: string | null;
  name: string | null;
  full_name: string | null;
};

type ImageRefinementSource = {
  prompt: string;
  originalPrompt: string | null;
  imageUrl: string | null;
  style: string | null;
  aspectRatio: string | null;
  context: JsonObject | null;
};

type ImageRefinementRequest = {
  params: JsonObject;
  previousImageUrl: string | null;
};

type ReasoningTokenBreakdown = {
  thinkingTokens: number;
  answerTokens: number;
  totalTokens: number;
};

type ConversationRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  status: string;
  title: string | null;
  message_count: number;
};

type MessageOwnershipRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  conversation_id: string;
};

type ParsedRequestResult =
  | { ok: true; value: BloomAssistRequest }
  | { ok: false; message: string };

type ParsedApprovalResult =
  | { ok: true; value: TaskPlanApprovalPayload }
  | { ok: false; message: string };

type ExecuteActionPayload = {
  mutationId: string;
  toolName: string;
  toolArgs: JsonObject;
};

type ExecuteActionRequest = {
  conversationId: string;
  assistantMessageId: string | null;
  action: ExecuteActionPayload;
};

type ParsedExecuteActionResult =
  | { ok: true; value: ExecuteActionRequest }
  | { ok: false; message: string };

type EnvConfig = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  openAiApiKey: string;
};

type StreamLatencyCapture = {
  requestStartedAt: number;
  contextBuildCompletedAt: number | null;
  openAiRequestStartedAt: number | null;
  firstOpenAiChunkAt: number | null;
  firstTokenEmittedAt: number | null;
  firstToolResultAt: number | null;
  doneEmittedAt: number | null;
};

type PendingResponseAudit = {
  assistantMessageId: string;
  model: string;
  tokenCounts: TokenCounts;
  eventData: JsonObject;
};

const EMPTY_BLOOM_CACHE_STATS: BloomCacheStats = {
  hits: 0,
  misses: 0,
  invalidations: 0,
};

function jsonResponse(
  req: Request,
  body: JsonObject,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req, CORS_OPTIONS),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (isRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isBloomMode(value: unknown): value is BloomMode {
  return (
    value === "standard" ||
    value === "reasoning" ||
    value === "research" ||
    value === "image"
  );
}

function isBloomModelPreference(value: unknown): value is BloomModelPreference {
  return value === "auto" || value === "standard" || value === "pro";
}

function isBloomResourceType(value: unknown): value is BloomResourceType {
  return (
    value === "customer" ||
    value === "product" ||
    value === "order" ||
    value === "campaign" ||
    value === "segment" ||
    value === "automation" ||
    value === "invoice"
  );
}

function isPageCategory(value: unknown): value is PageContext["pageCategory"] {
  return (
    value === "dashboard" ||
    value === "customers" ||
    value === "products" ||
    value === "campaigns" ||
    value === "segments" ||
    value === "analytics" ||
    value === "integrations" ||
    value === "settings" ||
    value === "bloom" ||
    value === "other"
  );
}

function isPageEntityType(
  value: unknown,
): value is NonNullable<PageContext["entityType"]> {
  return (
    value === "customer" ||
    value === "product" ||
    value === "campaign" ||
    value === "segment"
  );
}

function parseModelPreference(
  value: unknown,
):
  | { ok: true; value: BloomModelPreference | null }
  | { ok: false; message: string } {
  if (value === null || value === undefined || value === "auto") {
    return { ok: true, value: null };
  }

  if (!isBloomModelPreference(value)) {
    return {
      ok: false,
      message: "model_preference must be auto, standard, pro, or null",
    };
  }

  return { ok: true, value };
}

function normalizeNullableString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  if (typeof value !== "string") {
    return { ok: false, message: `${fieldName} must be a string or null` };
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return { ok: false, message: `${fieldName} is too long` };
  }

  return { ok: true, value: trimmed || null };
}

function normalizeRequiredString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): { ok: true; value: string } | { ok: false; message: string } {
  const normalized = normalizeNullableString(value, fieldName, maxLength);
  if (!normalized.ok) {
    return normalized;
  }

  if (!normalized.value) {
    return { ok: false, message: `${fieldName} is required` };
  }

  return { ok: true, value: normalized.value };
}

function parseSessionType(value: unknown): BloomSessionType {
  return value === "resource_focused" ? "resource_focused" : "standard";
}

function parseResourceFocus(
  value: unknown,
): { ok: true; value: BloomResourceFocus | null } | { ok: false; message: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  if (!isRecord(value)) {
    return { ok: false, message: "resource_focus must be an object or null" };
  }

  const rawResourceType = value.resourceType ?? value.resource_type;
  if (!isBloomResourceType(rawResourceType)) {
    return { ok: false, message: "resource_focus.resourceType is invalid" };
  }

  const resourceId = normalizeRequiredString(
    value.resourceId ?? value.resource_id,
    "resource_focus.resourceId",
    MAX_ENTITY_FIELD_LENGTH,
  );
  if (!resourceId.ok) {
    return resourceId;
  }

  const rawSummary = value.resourceSummary ?? value.resource_summary;
  if (typeof rawSummary !== "string") {
    return {
      ok: false,
      message: "resource_focus.resourceSummary is required",
    };
  }

  const resourceSummary = rawSummary.trim().slice(0, MAX_RESOURCE_SUMMARY_LENGTH);
  if (!resourceSummary) {
    return {
      ok: false,
      message: "resource_focus.resourceSummary is required",
    };
  }

  return {
    ok: true,
    value: {
      resourceType: rawResourceType,
      resourceId: resourceId.value,
      resourceSummary,
    },
  };
}

function normalizeStringArray(
  value: unknown,
  fieldName: string,
): { ok: true; value: string[] } | { ok: false; message: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(value)) {
    return { ok: false, message: `${fieldName} must be an array of strings` };
  }

  if (value.length > MAX_PAGE_CONTEXT_LIST_ITEMS) {
    return {
      ok: false,
      message: `${fieldName} contains too many items`,
    };
  }

  const normalized: string[] = [];
  for (const entry of value) {
    const item = normalizeRequiredString(
      entry,
      fieldName,
      MAX_PAGE_CONTEXT_LIST_ITEM_LENGTH,
    );

    if (!item.ok) {
      return item;
    }

    normalized.push(item.value);
  }

  return { ok: true, value: normalized };
}

function parsePageContext(
  value: unknown,
): { ok: true; value: PageContext | null } | { ok: false; message: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  if (!isRecord(value)) {
    return { ok: false, message: "page_context must be an object or null" };
  }

  if (typeof value.pathname !== "string") {
    return { ok: false, message: "page_context.pathname is required" };
  }

  const pathname = value.pathname.trim();
  if (!pathname || pathname.length > MAX_PAGE_PATH_LENGTH) {
    return { ok: false, message: "page_context.pathname is invalid" };
  }

  const rawPageCategory = value.pageCategory ?? value.page_category;
  if (!isPageCategory(rawPageCategory)) {
    return { ok: false, message: "page_context.pageCategory is invalid" };
  }

  const pageName = normalizeRequiredString(
    value.pageName ?? value.page_name,
    "page_context.pageName",
    MAX_PAGE_NAME_LENGTH,
  );
  if (!pageName.ok) {
    return pageName;
  }

  const rawEntityType = value.entityType ?? value.entity_type;
  if (
    rawEntityType !== null &&
    rawEntityType !== undefined &&
    !isPageEntityType(rawEntityType)
  ) {
    return { ok: false, message: "page_context.entityType is invalid" };
  }

  const entityType = normalizeNullableString(
    rawEntityType,
    "page_context.entityType",
    MAX_ENTITY_FIELD_LENGTH,
  );
  if (!entityType.ok) {
    return entityType;
  }

  if (entityType.value && !isPageEntityType(entityType.value)) {
    return { ok: false, message: "page_context.entityType is invalid" };
  }

  const entityId = normalizeNullableString(
    value.entityId ?? value.entity_id,
    "page_context.entityId",
    MAX_ENTITY_FIELD_LENGTH,
  );
  if (!entityId.ok) {
    return entityId;
  }

  if (entityId.value && !isUuid(entityId.value)) {
    return { ok: false, message: "page_context.entityId is invalid" };
  }

  const availableActions = normalizeStringArray(
    value.availableActions ?? value.available_actions,
    "page_context.availableActions",
  );
  if (!availableActions.ok) {
    return availableActions;
  }

  const suggestions = normalizeStringArray(
    value.suggestions,
    "page_context.suggestions",
  );
  if (!suggestions.ok) {
    return suggestions;
  }

  const pageEntityType =
    entityType.value && isPageEntityType(entityType.value)
      ? entityType.value
      : null;

  return {
    ok: true,
    value: {
      pathname,
      pageCategory: rawPageCategory,
      entityType: pageEntityType,
      entityId: entityId.value,
      pageName: pageName.value,
      availableActions: availableActions.value,
      suggestions: suggestions.value,
    },
  };
}

function parseAttachments(
  value: unknown,
): { ok: true; value: JsonArray | null } | { ok: false; message: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  if (!Array.isArray(value)) {
    return { ok: false, message: "attachments must be an array or null" };
  }

  if (!value.every(isJsonValue)) {
    return { ok: false, message: "attachments must contain JSON values only" };
  }

  return { ok: true, value };
}

function parseBloomAssistRequest(rawBody: unknown): ParsedRequestResult {
  if (!isRecord(rawBody)) {
    return { ok: false, message: "Request body must be a JSON object" };
  }

  const rawConversationId = rawBody.conversation_id ?? rawBody.conversationId;
  let conversationId: string | null = null;
  if (rawConversationId !== null && rawConversationId !== undefined) {
    if (typeof rawConversationId !== "string" || !isUuid(rawConversationId)) {
      return { ok: false, message: "conversation_id must be a UUID or null" };
    }
    conversationId = rawConversationId;
  }

  if (typeof rawBody.message !== "string") {
    return { ok: false, message: "message is required" };
  }

  const message = rawBody.message.trim();
  if (!message) {
    return { ok: false, message: "message cannot be empty" };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, message: "message is too long" };
  }

  if (!isBloomMode(rawBody.mode)) {
    return { ok: false, message: "mode is invalid" };
  }

  const modelPreference = parseModelPreference(
    rawBody.model_preference ?? rawBody.modelPreference ?? rawBody.model,
  );
  if (!modelPreference.ok) {
    return modelPreference;
  }

  const sessionType = parseSessionType(
    rawBody.session_type ?? rawBody.sessionType,
  );
  const resourceFocus = parseResourceFocus(
    rawBody.resource_focus ?? rawBody.resourceFocus,
  );
  if (!resourceFocus.ok) {
    return resourceFocus;
  }
  if (sessionType === "resource_focused" && resourceFocus.value === null) {
    return {
      ok: false,
      message: "resource_focus required for resource_focused sessions",
    };
  }

  if (typeof rawBody.timezone !== "string") {
    return { ok: false, message: "timezone is required" };
  }

  const timezone = rawBody.timezone.trim();
  if (!timezone || timezone.length > MAX_TIMEZONE_LENGTH) {
    return { ok: false, message: "timezone is invalid" };
  }

  const pageContext = parsePageContext(
    rawBody.page_context ?? rawBody.pageContext,
  );
  if (!pageContext.ok) {
    return pageContext;
  }

  const attachments = parseAttachments(rawBody.attachments);
  if (!attachments.ok) {
    return attachments;
  }

  return {
    ok: true,
    value: {
      conversation_id: conversationId,
      message,
      mode: rawBody.mode,
      model_preference: modelPreference.value,
      session_type: sessionType,
      resource_focus: resourceFocus.value,
      page_context: pageContext.value,
      timezone,
      attachments: attachments.value,
    },
  };
}

function looksLikeTaskPlanApprovalRequest(rawBody: unknown): boolean {
  const source =
    isRecord(rawBody) && isRecord(rawBody.approval)
      ? rawBody.approval
      : rawBody;
  return isRecord(source) && typeof source.plan_id === "string";
}

function parseStringArrayField(
  value: unknown,
  fieldName: string,
): { ok: true; value: string[] } | { ok: false; message: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: [] };
  }

  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string" && item.trim())
  ) {
    return { ok: false, message: `${fieldName} must be an array of strings` };
  }

  return { ok: true, value: value.map((item) => item.trim()) };
}

function parseEditedFields(
  value: unknown,
):
  | { ok: true; value: Record<string, JsonObject> }
  | { ok: false; message: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: {} };
  }

  if (!isRecord(value)) {
    return { ok: false, message: "edited_fields must be an object" };
  }

  const editedFields: Record<string, JsonObject> = {};
  for (const [taskId, fieldValues] of Object.entries(value)) {
    if (!/^task_[0-9]+$/.test(taskId)) {
      return {
        ok: false,
        message: `edited_fields contains invalid task id ${taskId}`,
      };
    }

    if (!isRecord(fieldValues)) {
      return {
        ok: false,
        message: `edited_fields.${taskId} must be an object`,
      };
    }

    const jsonFields: JsonObject = {};
    for (const [field, fieldValue] of Object.entries(fieldValues)) {
      if (!field.trim()) {
        return {
          ok: false,
          message: `edited_fields.${taskId} has an empty field name`,
        };
      }
      if (!isJsonValue(fieldValue)) {
        return {
          ok: false,
          message: `edited_fields.${taskId}.${field} must be JSON-compatible`,
        };
      }
      jsonFields[field] = fieldValue;
    }
    editedFields[taskId] = jsonFields;
  }

  return { ok: true, value: editedFields };
}

function parseTaskPlanApprovalRequest(rawBody: unknown): ParsedApprovalResult {
  const source =
    isRecord(rawBody) && isRecord(rawBody.approval)
      ? rawBody.approval
      : rawBody;

  if (!isRecord(source)) {
    return { ok: false, message: "Approval payload must be an object" };
  }

  const conversationId = readStringFromUnknown(source.conversation_id);
  if (!conversationId || !isUuid(conversationId)) {
    return { ok: false, message: "conversation_id must be a UUID" };
  }

  const planId = readStringFromUnknown(source.plan_id);
  if (!planId || !isUuid(planId)) {
    return { ok: false, message: "plan_id must be a UUID" };
  }

  const approvedTaskIds = parseStringArrayField(
    source.approved_task_ids,
    "approved_task_ids",
  );
  if (!approvedTaskIds.ok) return approvedTaskIds;

  const skippedTaskIds = parseStringArrayField(
    source.skipped_task_ids,
    "skipped_task_ids",
  );
  if (!skippedTaskIds.ok) return skippedTaskIds;

  const editedFields = parseEditedFields(source.edited_fields);
  if (!editedFields.ok) return editedFields;

  const rawRetryTaskId = readStringFromUnknown(source.retry_task_id);
  if (rawRetryTaskId && !/^task_[0-9]+$/.test(rawRetryTaskId)) {
    return { ok: false, message: "retry_task_id must be a task id" };
  }

  const mode = isBloomMode(source.mode) ? source.mode : "standard";
  const timezone =
    typeof source.timezone === "string" && source.timezone.trim().length > 0
      ? source.timezone.trim().slice(0, MAX_TIMEZONE_LENGTH)
      : "UTC";

  return {
    ok: true,
    value: {
      conversation_id: conversationId,
      plan_id: planId,
      approved_task_ids: approvedTaskIds.value,
      skipped_task_ids: skippedTaskIds.value,
      edited_fields: editedFields.value,
      retry_task_id: rawRetryTaskId,
      mode,
      timezone,
    },
  };
}

function looksLikeExecuteActionRequest(rawBody: unknown): boolean {
  return isRecord(rawBody) && isRecord(rawBody.execute_action);
}

function parseExecuteActionRequest(
  rawBody: unknown,
): ParsedExecuteActionResult {
  if (!isRecord(rawBody) || !isRecord(rawBody.execute_action)) {
    return { ok: false, message: "execute_action payload is required" };
  }

  const conversationId = readStringFromUnknown(
    rawBody.conversation_id ?? rawBody.conversationId,
  );
  if (!conversationId || !isUuid(conversationId)) {
    return { ok: false, message: "conversation_id must be a UUID" };
  }

  const assistantMessageId = readStringFromUnknown(
    rawBody.assistant_message_id ?? rawBody.assistantMessageId,
  );
  if (assistantMessageId && !isUuid(assistantMessageId)) {
    return { ok: false, message: "assistant_message_id must be a UUID" };
  }

  const action = rawBody.execute_action;
  const mutationId = readStringFromUnknown(
    action.mutationId ?? action.mutation_id,
  );
  const toolName = readStringFromUnknown(action.toolName ?? action.tool_name);
  const toolArgs = readJsonObjectFromUnknown(
    action.toolArgs ?? action.tool_args,
  );

  if (!mutationId) {
    return { ok: false, message: "execute_action.mutationId is required" };
  }

  if (!toolName) {
    return { ok: false, message: "execute_action.toolName is required" };
  }

  if (!toolArgs) {
    return { ok: false, message: "execute_action.toolArgs must be an object" };
  }

  return {
    ok: true,
    value: {
      conversationId,
      assistantMessageId,
      action: {
        mutationId,
        toolName,
        toolArgs,
      },
    },
  };
}

function readStringFromUnknown(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readJsonObjectFromUnknown(value: unknown): JsonObject | null {
  return isRecord(value) && Object.values(value).every(isJsonValue)
    ? (value as JsonObject)
    : null;
}

function readJsonArrayFromUnknown(value: unknown): JsonArray {
  return Array.isArray(value) && value.every(isJsonValue) ? value : [];
}

function hasImageRefinementSignal(message: string): boolean {
  return (
    IMAGE_REFINEMENT_SIGNAL_PATTERN.test(message) ||
    IMAGE_REFINEMENT_NEGATION_PATTERN.test(message)
  );
}

function truncateForToolParam(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1).trim()}...`;
}

function buildRefinementPrompt(
  previousPrompt: string,
  instruction: string,
): string {
  const basePrompt = truncateForToolParam(previousPrompt, 760);
  const refinementInstruction = truncateForToolParam(instruction, 220);
  return truncateForToolParam(
    `${basePrompt}. Additionally: ${refinementInstruction}`,
    1000,
  );
}

function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function selectMaxToolIterations(mode: BloomMode): number | undefined {
  return mode === "research" ? RESEARCH_MAX_TOOL_ITERATIONS : undefined;
}

function getToolCategoriesForRouting(
  mode: BloomMode,
  classification: IntentClassificationResult,
): Set<ToolCategory> | null {
  if (mode === "research") {
    return RESEARCH_TOOL_CATEGORIES;
  }

  if (mode === "image") {
    return CONTENT_TOOL_CATEGORIES;
  }

  switch (classification.category) {
    case "query":
      return classification.complexity === "simple"
        ? QUERY_TOOL_CATEGORIES
        : QUERY_ANALYTICS_TOOL_CATEGORIES;
    case "mutation":
      return MUTATION_TOOL_CATEGORIES;
    case "analytics":
      return QUERY_ANALYTICS_TOOL_CATEGORIES;
    case "content":
    case "image":
      return CONTENT_TOOL_CATEGORIES;
    case "navigation":
      return NAVIGATION_TOOL_CATEGORIES;
    case "general":
      return null;
  }
}

function getToolDefinitionsForMode(
  mode: BloomMode,
  userRole: string,
  classification: IntentClassificationResult,
) {
  const categories = getToolCategoriesForRouting(mode, classification);
  return filterRegisteredTools({ mode, userRole })
    .filter((tool) => !categories || categories.has(tool.category))
    .map(toOpenAIToolDefinition);
}

function splitReasoningOutputTokens(
  content: string,
  thinkingContent: string | null,
  totalTokens: number,
): ReasoningTokenBreakdown {
  const safeTotalTokens = Math.max(0, totalTokens);

  if (safeTotalTokens === 0) {
    return { thinkingTokens: 0, answerTokens: 0, totalTokens: 0 };
  }

  const thinkingEstimate = thinkingContent
    ? estimateTokenCount(thinkingContent)
    : 0;
  const answerEstimate = content.trim() ? estimateTokenCount(content) : 0;
  const combinedEstimate = thinkingEstimate + answerEstimate;

  if (thinkingEstimate === 0 || combinedEstimate === 0) {
    return {
      thinkingTokens: 0,
      answerTokens: safeTotalTokens,
      totalTokens: safeTotalTokens,
    };
  }

  const thinkingTokens = Math.min(
    safeTotalTokens,
    Math.round((thinkingEstimate / combinedEstimate) * safeTotalTokens),
  );

  return {
    thinkingTokens,
    answerTokens: safeTotalTokens - thinkingTokens,
    totalTokens: safeTotalTokens,
  };
}

function reasoningTokenAuditData(
  mode: BloomMode,
  content: string,
  thinkingContent: string | null,
  tokenCounts: TokenCounts,
): JsonObject {
  if (mode !== "reasoning") {
    return {};
  }

  const breakdown = splitReasoningOutputTokens(
    content,
    thinkingContent,
    tokenCounts.tokens_output,
  );

  return {
    thinking_tokens: breakdown.thinkingTokens,
    answer_tokens: breakdown.answerTokens,
    total_tokens: breakdown.totalTokens,
  };
}

function modelPreferenceMetadata(
  preference: BloomModelPreference | null,
): JsonObject {
  return preference && preference !== "auto"
    ? { model_preference: preference }
    : {};
}

function resolveEffectiveMode(
  requestedMode: BloomMode,
  classification: IntentClassificationResult,
): { mode: BloomMode; modeOverride: BloomMode | null } {
  if (classification.category !== "image") {
    return { mode: requestedMode, modeOverride: null };
  }

  return {
    mode: "image",
    modeOverride: requestedMode === "image" ? null : "image",
  };
}

function assistantResponseMetadata(
  preference: BloomModelPreference | null,
  modeOverride: BloomMode | null,
): JsonObject {
  return {
    ...modelPreferenceMetadata(preference),
    ...(modeOverride ? { mode_override: modeOverride } : {}),
  };
}

function readImageRefinementSource(row: unknown): ImageRefinementSource | null {
  if (!isRecord(row)) {
    return null;
  }

  const input = readJsonObjectFromUnknown(row.tool_input) ?? {};
  const output = readJsonObjectFromUnknown(row.tool_output);
  if (!output || output.success !== true) {
    return null;
  }

  const data = readJsonObjectFromUnknown(output.data);
  const prompt =
    readStringFromUnknown(data?.enhanced_prompt) ??
    readStringFromUnknown(data?.enriched_prompt) ??
    readStringFromUnknown(data?.original_prompt) ??
    readStringFromUnknown(input.prompt);

  if (!prompt) {
    return null;
  }

  return {
    prompt,
    originalPrompt:
      readStringFromUnknown(data?.original_prompt) ??
      readStringFromUnknown(input.prompt),
    imageUrl:
      readStringFromUnknown(data?.image_url) ??
      readStringFromUnknown(data?.url),
    style:
      readStringFromUnknown(data?.style) ?? readStringFromUnknown(input.style),
    aspectRatio:
      readStringFromUnknown(data?.aspect_ratio) ??
      readStringFromUnknown(input.aspect_ratio),
    context: readJsonObjectFromUnknown(input.context),
  };
}

function buildImageRefinementParams(
  source: ImageRefinementSource,
  instruction: string,
): JsonObject {
  const params: JsonObject = {
    prompt: buildRefinementPrompt(source.prompt, instruction),
    refinement_instruction: truncateForToolParam(instruction, 1000),
  };

  if (source.style) {
    params.style = source.style;
  }
  if (source.aspectRatio) {
    params.aspect_ratio = source.aspectRatio;
  }
  if (source.imageUrl) {
    params.previous_image_url = source.imageUrl;
  }
  if (source.context) {
    params.context = source.context;
  }
  return params;
}

async function detectImageRefinementRequest(
  serviceClient: PersistenceClient,
  tenantId: string,
  userId: string,
  conversationId: string,
  body: BloomAssistRequest,
): Promise<ImageRefinementRequest | null> {
  if (body.mode !== "image" || !hasImageRefinementSignal(body.message)) {
    return null;
  }

  const { data, error } = await serviceClient
    .from("bloom_tool_executions")
    .select("tool_input, tool_output, created_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .eq("tool_name", "generate_image")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "[bloom-assist] Failed to load prior image generation",
      toErrorMessage(error),
    );
    return null;
  }

  const source = readImageRefinementSource(data);
  if (!source) {
    return null;
  }

  return {
    params: buildImageRefinementParams(source, body.message),
    previousImageUrl: source.imageUrl,
  };
}

function imageBlockDataFromToolResult(result: JsonObject): JsonObject {
  const data = readJsonObjectFromUnknown(result.data) ?? {};
  return {
    ...data,
    block_type: "image",
    message: readStringFromUnknown(result.message) ?? "Generated an image.",
  };
}

function imageFollowUpChips(result: JsonObject): JsonArray {
  const data = readJsonObjectFromUnknown(result.data);
  const chips = readJsonArrayFromUnknown(data?.follow_up_chips)
    .filter(
      (chip): chip is string =>
        typeof chip === "string" && chip.trim().length > 0,
    )
    .slice(0, 4);

  return chips.length > 0 ? chips : IMAGE_REFINEMENT_FOLLOW_UPS;
}

function directImageResponseContent(result: ToolExecutorResult): string {
  const payload = readJsonObjectFromUnknown(result.result);
  const message = readStringFromUnknown(payload?.message);
  if (result.status === "completed") {
    return message ?? "I generated a refined image.";
  }

  return message ?? result.error_message ?? "I couldn't generate that image.";
}

function readSummaryLine(
  summary: string | null,
  label: string,
): string | null {
  if (!summary) {
    return null;
  }

  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = summary.match(new RegExp(`^${escapedLabel}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() || null;
}

function resourceLabelFromSummary(
  resourceFocus: BloomResourceFocus | null,
): string {
  if (!resourceFocus) {
    return "this resource";
  }

  return (
    readSummaryLine(resourceFocus.resourceSummary, "Name") ||
    readSummaryLine(resourceFocus.resourceSummary, "Order Number") ||
    readSummaryLine(resourceFocus.resourceSummary, "SKU") ||
    `this ${resourceFocus.resourceType}`
  );
}

function humanizeToolName(toolName: string): string {
  return toolName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function describeMutationAction(
  toolName: string,
  resourceFocus: BloomResourceFocus | null,
): string {
  const resourceLabel = resourceLabelFromSummary(resourceFocus);

  switch (toolName) {
    case "update_customer":
      return `Update ${resourceLabel}`;
    case "update_product":
      return `Update ${resourceLabel}`;
    case "toggle_product_status":
      return `Change ${resourceLabel} status`;
    case "update_campaign":
      return `Update campaign ${resourceLabel}`;
    case "clone_campaign":
      return `Duplicate campaign ${resourceLabel}`;
    case "schedule_campaign":
      return `Schedule campaign ${resourceLabel}`;
    case "send_campaign":
      return `Send campaign ${resourceLabel}`;
    case "pause_resume_campaign":
      return `Change campaign delivery for ${resourceLabel}`;
    case "update_segment":
      return `Update segment ${resourceLabel}`;
    case "assign_segment":
      return `Change membership for segment ${resourceLabel}`;
    default:
      return `${humanizeToolName(toolName)} for ${resourceLabel}`;
  }
}

function readEnvConfig(): EnvConfig | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !openAiApiKey) {
    return null;
  }

  return { supabaseUrl, anonKey, serviceRoleKey, openAiApiKey };
}

function parsePublicUserRow(rawValue: unknown): PublicUserRow | null {
  if (!isRecord(rawValue)) {
    return null;
  }

  return {
    tenant_id:
      typeof rawValue.tenant_id === "string" ? rawValue.tenant_id : null,
    role: typeof rawValue.role === "string" ? rawValue.role : null,
    name: typeof rawValue.name === "string" ? rawValue.name : null,
    full_name:
      typeof rawValue.full_name === "string" ? rawValue.full_name : null,
  };
}

function parseConversationRow(rawValue: unknown): ConversationRow | null {
  if (!isRecord(rawValue)) {
    return null;
  }

  if (
    typeof rawValue.id !== "string" ||
    typeof rawValue.tenant_id !== "string" ||
    typeof rawValue.user_id !== "string" ||
    typeof rawValue.status !== "string"
  ) {
    return null;
  }

  return {
    id: rawValue.id,
    tenant_id: rawValue.tenant_id,
    user_id: rawValue.user_id,
    status: rawValue.status,
    title: typeof rawValue.title === "string" ? rawValue.title : null,
    message_count:
      typeof rawValue.message_count === "number" ? rawValue.message_count : 0,
  };
}

function parseMessageOwnershipRow(
  rawValue: unknown,
): MessageOwnershipRow | null {
  if (!isRecord(rawValue)) {
    return null;
  }

  if (
    typeof rawValue.id !== "string" ||
    typeof rawValue.tenant_id !== "string" ||
    typeof rawValue.user_id !== "string" ||
    typeof rawValue.conversation_id !== "string"
  ) {
    return null;
  }

  return {
    id: rawValue.id,
    tenant_id: rawValue.tenant_id,
    user_id: rawValue.user_id,
    conversation_id: rawValue.conversation_id,
  };
}

function readMetadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getIdFromInsertResult(rawValue: unknown, tableName: string): string {
  if (isRecord(rawValue) && typeof rawValue.id === "string") {
    return rawValue.id;
  }

  throw new Error(`Failed to read ${tableName} id from insert result`);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

function createPreview(content: string): string {
  const preview = content.replace(/\s+/g, " ").trim();
  return preview.length > CONVERSATION_PREVIEW_LENGTH
    ? `${preview.slice(0, CONVERSATION_PREVIEW_LENGTH - 1)}...`
    : preview;
}

function fallbackTitle(message: string): string {
  const words = message
    .replace(/[^a-zA-Z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 6);

  if (words.length === 0) {
    return "New Bloom Chat";
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function sanitizeGeneratedTitle(value: string | null, message: string): string {
  if (!value) {
    return fallbackTitle(message);
  }

  const cleaned = value.replace(/["`]/g, "").replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return fallbackTitle(message);
  }

  return cleaned.split(" ").slice(0, 6).join(" ").slice(0, 80);
}

function extractOpenAiTitle(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return null;
  }

  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return null;
  }

  return typeof firstChoice.message.content === "string"
    ? firstChoice.message.content
    : null;
}

export async function generateConversationTitle(
  message: string,
): Promise<string> {
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    return fallbackTitle(message);
  }

  try {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TITLE_MODEL,
        temperature: 0.2,
        max_tokens: 24,
        messages: [
          {
            role: "system",
            content:
              "Summarize the user's message as a concise 4-6 word conversation title. Return only the title.",
          },
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[bloom-assist] Title generation failed", response.status);
      return fallbackTitle(message);
    }

    const payload: unknown = await response.json();
    return sanitizeGeneratedTitle(extractOpenAiTitle(payload), message);
  } catch (error) {
    console.error(
      "[bloom-assist] Title generation error",
      toErrorMessage(error),
    );
    return fallbackTitle(message);
  }
}

async function resolveUserContext(
  userClient: PersistenceClient,
  userId: string,
  userMetadata: Record<string, unknown>,
): Promise<UserContext | null> {
  const { data, error } = await userClient
    .from("users")
    .select("tenant_id, role, name, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve user tenant: ${error.message}`);
  }

  const userRow = parsePublicUserRow(data);
  if (!userRow?.tenant_id) {
    return null;
  }

  const metadataName =
    readMetadataString(userMetadata, "full_name") ||
    readMetadataString(userMetadata, "name");

  return {
    tenantId: userRow.tenant_id,
    userId,
    userRole: userRow.role || "user",
    userName: metadataName || userRow.full_name || userRow.name,
    conversationId: null,
  };
}

async function validateConversationOwnership(
  serviceClient: PersistenceClient,
  tenantId: string,
  userId: string,
  conversationId: string,
): Promise<ConversationRow | null> {
  const { data, error } = await serviceClient
    .from("bloom_conversations")
    .select("id, tenant_id, user_id, status, title, message_count")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate conversation: ${error.message}`);
  }

  const conversation = parseConversationRow(data);
  if (
    !conversation ||
    conversation.tenant_id !== tenantId ||
    conversation.user_id !== userId ||
    conversation.status === "deleted"
  ) {
    return null;
  }

  return conversation;
}

async function loadConversationForPersistence(
  serviceClient: PersistenceClient,
  tenantId: string,
  conversationId: string,
): Promise<ConversationRow> {
  const { data, error } = await serviceClient
    .from("bloom_conversations")
    .select("id, tenant_id, user_id, status, title, message_count")
    .eq("id", conversationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load conversation: ${error.message}`);
  }

  const conversation = parseConversationRow(data);
  if (!conversation) {
    throw new Error("Conversation not found for persistence");
  }

  return conversation;
}

async function loadMessageOwnership(
  serviceClient: PersistenceClient,
  tenantId: string,
  conversationId: string,
  messageId: string,
): Promise<MessageOwnershipRow> {
  const { data, error } = await serviceClient
    .from("bloom_messages")
    .select("id, tenant_id, user_id, conversation_id")
    .eq("id", messageId)
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load message ownership: ${error.message}`);
  }

  const message = parseMessageOwnershipRow(data);
  if (!message) {
    throw new Error("Message not found for tool execution persistence");
  }

  return message;
}

async function updateAssistantMessageActionCard(args: {
  serviceClient: PersistenceClient;
  tenantId: string;
  conversationId: string;
  messageId: string;
  mutationId: string;
  status: "executing" | "completed" | "failed";
  result: string | null;
}): Promise<void> {
  const { data, error } = await args.serviceClient
    .from("bloom_messages")
    .select("block_data")
    .eq("id", args.messageId)
    .eq("tenant_id", args.tenantId)
    .eq("conversation_id", args.conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Ask Bloom action card: ${error.message}`);
  }

  const blockData = isRecord(data?.block_data) ? data.block_data : {};
  const blocks = Array.isArray(blockData.blocks) ? blockData.blocks : [];
  const nextBlocks = blocks.map((block) => {
    if (!isRecord(block)) {
      return block;
    }

    const payload = isRecord(block.payload) ? block.payload : {};
    const mutationId =
      readStringFromUnknown(payload.mutationId ?? payload.mutation_id) ?? null;
    if (mutationId !== args.mutationId) {
      return block;
    }

    return {
      ...block,
      payload: {
        ...payload,
        status: args.status,
        result: args.result,
      },
    };
  });

  const { error: updateError } = await args.serviceClient
    .from("bloom_messages")
    .update({
      block_data: {
        ...blockData,
        blocks: nextBlocks,
      },
    })
    .eq("id", args.messageId)
    .eq("tenant_id", args.tenantId)
    .eq("conversation_id", args.conversationId);

  if (updateError) {
    throw new Error(`Failed to persist Ask Bloom action card: ${updateError.message}`);
  }
}

async function refreshConversationSummary(
  serviceClient: PersistenceClient,
  tenantId: string,
  conversationId: string,
  previewSource: string,
): Promise<void> {
  const { count, error: countError } = await serviceClient
    .from("bloom_messages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId);

  if (countError) {
    throw new Error(`Failed to count Bloom messages: ${countError.message}`);
  }

  const { error: updateError } = await serviceClient
    .from("bloom_conversations")
    .update({
      message_count: count ?? 0,
      last_message_preview: createPreview(previewSource),
    })
    .eq("id", conversationId)
    .eq("tenant_id", tenantId);

  if (updateError) {
    throw new Error(
      `Failed to update conversation summary: ${updateError.message}`,
    );
  }
}

export async function persistUserMessage(
  serviceClient: PersistenceClient,
  tenantId: string,
  userId: string,
  conversationId: string | null,
  message: string,
  mode: BloomMode,
  attachments: JsonArray | null = null,
  sessionType: BloomSessionType = "standard",
  resourceFocus: BloomResourceFocus | null = null,
): Promise<PersistUserMessageResult> {
  let resolvedConversationId = conversationId;
  let title: string | null = null;
  const isNewConversation = !resolvedConversationId;

  if (!resolvedConversationId) {
    title = await generateConversationTitle(message);

    const { data, error } = await serviceClient
      .from("bloom_conversations")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        title,
        status: "active",
        mode,
        session_type: sessionType,
        resource_type: resourceFocus?.resourceType ?? null,
        resource_id: resourceFocus?.resourceId ?? null,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to create Bloom conversation: ${error.message}`);
    }

    resolvedConversationId = getIdFromInsertResult(data, "bloom_conversations");
  } else {
    const existingConversation = await loadConversationForPersistence(
      serviceClient,
      tenantId,
      resolvedConversationId,
    );

    if (
      !existingConversation.title &&
      existingConversation.message_count === 0
    ) {
      title = await generateConversationTitle(message);

      const { error: updateError } = await serviceClient
        .from("bloom_conversations")
        .update({ title })
        .eq("id", resolvedConversationId)
        .eq("tenant_id", tenantId);

      if (updateError) {
        throw new Error(
          `Failed to update Bloom conversation title: ${updateError.message}`,
        );
      }
    }
  }

  const { data: messageData, error: messageError } = await serviceClient
    .from("bloom_messages")
    .insert({
      conversation_id: resolvedConversationId,
      tenant_id: tenantId,
      user_id: userId,
      role: "user",
      content: message,
      mode,
      attachments: attachments ?? [],
    })
    .select("id")
    .single();

  if (messageError) {
    throw new Error(
      `Failed to persist user Bloom message: ${messageError.message}`,
    );
  }

  const messageId = getIdFromInsertResult(messageData, "bloom_messages");
  await refreshConversationSummary(
    serviceClient,
    tenantId,
    resolvedConversationId,
    message,
  );

  return {
    conversationId: resolvedConversationId,
    messageId,
    isNewConversation,
    title,
  };
}

export async function persistAssistantResponse(
  serviceClient: PersistenceClient,
  tenantId: string,
  conversationId: string,
  content: string,
  thinkingContent: string | null,
  blockData: JsonObject,
  tokenCounts: TokenCounts,
  followUpChips: JsonArray,
  mode: BloomMode,
  model: string,
  metadata: JsonObject = {},
): Promise<PersistAssistantResponseResult> {
  const conversation = await loadConversationForPersistence(
    serviceClient,
    tenantId,
    conversationId,
  );

  const { data, error } = await serviceClient
    .from("bloom_messages")
    .insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      user_id: conversation.user_id,
      role: "assistant",
      content,
      thinking_content: thinkingContent,
      block_data: blockData,
      mode,
      model,
      tokens_input: tokenCounts.tokens_input,
      tokens_output: tokenCounts.tokens_output,
      follow_up_chips: followUpChips,
      metadata,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `Failed to persist assistant Bloom message: ${error.message}`,
    );
  }

  const messageId = getIdFromInsertResult(data, "bloom_messages");
  await refreshConversationSummary(
    serviceClient,
    tenantId,
    conversationId,
    content,
  );

  return { messageId };
}

export async function persistToolExecution(
  serviceClient: PersistenceClient,
  tenantId: string,
  conversationId: string,
  messageId: string,
  toolName: string,
  input: JsonObject,
  output: JsonValue | null,
  status: ToolExecutionStatus,
  executionTimeMs: number | null,
): Promise<string> {
  const message = await loadMessageOwnership(
    serviceClient,
    tenantId,
    conversationId,
    messageId,
  );

  const { data, error } = await serviceClient
    .from("bloom_tool_executions")
    .insert({
      message_id: messageId,
      conversation_id: conversationId,
      tenant_id: tenantId,
      user_id: message.user_id,
      tool_name: toolName,
      tool_input: input,
      tool_output: output,
      status,
      execution_time_ms: executionTimeMs,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to persist Bloom tool execution: ${error.message}`);
  }

  return getIdFromInsertResult(data, "bloom_tool_executions");
}

export async function logAuditEvent(
  serviceClient: PersistenceClient,
  tenantId: string,
  userId: string,
  eventType: BloomAuditEventType,
  eventData: JsonObject,
  options: LogAuditEventOptions = {},
): Promise<void> {
  const { error } = await serviceClient.from("bloom_audit_log").insert({
    tenant_id: tenantId,
    user_id: userId,
    conversation_id: options.conversationId ?? null,
    message_id: options.messageId ?? null,
    event_type: eventType,
    event_data: eventData,
    model_used: options.model ?? null,
    tokens_input: options.tokens?.input ?? null,
    tokens_output: options.tokens?.output ?? null,
    latency_ms: options.latencyMs ?? null,
  });

  if (error) {
    throw new Error(`Failed to log Bloom audit event: ${error.message}`);
  }
}

function formatSseEvent(event: BloomSseEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

function createSseHeaders(req: Request): HeadersInit {
  return {
    ...buildCorsHeaders(req, CORS_OPTIONS),
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
}

function toLatencyDelta(startedAt: number, completedAt: number | null) {
  return completedAt === null ? null : Math.max(0, completedAt - startedAt);
}

function buildLatencyBreakdown(
  capture: StreamLatencyCapture,
): BloomLatencyBreakdown {
  const doneAt = capture.doneEmittedAt ?? Date.now();

  return {
    server_ttft_ms: toLatencyDelta(
      capture.requestStartedAt,
      capture.firstTokenEmittedAt,
    ),
    server_ttfb_ms: toLatencyDelta(
      capture.requestStartedAt,
      capture.firstToolResultAt,
    ),
    server_total_ms: Math.max(0, doneAt - capture.requestStartedAt),
    context_build_ms: toLatencyDelta(
      capture.requestStartedAt,
      capture.contextBuildCompletedAt,
    ),
    llm_latency_ms:
      capture.openAiRequestStartedAt === null
        ? null
        : toLatencyDelta(
            capture.openAiRequestStartedAt,
            capture.firstOpenAiChunkAt,
          ),
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

function countToolResultRows(result: ToolResult): number | null {
  if (typeof result.count === "number") {
    return result.count;
  }

  if (Array.isArray(result.data)) {
    return result.data.length;
  }

  return result.data ? 1 : null;
}

function statusForToolResult(result: ToolResult): ToolExecutionStatus {
  return result.success || result.confirmation_required
    ? "completed"
    : "failed";
}

function injectImplicitResourceFocusArguments(
  toolName: string,
  rawArguments: JsonObject,
  request: BloomAssistRequest,
): JsonObject {
  if (
    request.session_type !== "resource_focused" ||
    request.resource_focus === null
  ) {
    return rawArguments;
  }

  const toolDefinition = getRegisteredTool(toolName);
  if (!toolDefinition || !isRecord(toolDefinition.function.parameters.properties)) {
    return rawArguments;
  }

  const resourceParamName =
    RESOURCE_PARAMETER_NAMES[request.resource_focus.resourceType];
  if (
    !Object.prototype.hasOwnProperty.call(
      toolDefinition.function.parameters.properties,
      resourceParamName,
    )
  ) {
    return rawArguments;
  }

  const existingValue = rawArguments[resourceParamName];
  if (typeof existingValue === "string" && existingValue.trim().length > 0) {
    return rawArguments;
  }

  return {
    ...rawArguments,
    [resourceParamName]: request.resource_focus.resourceId,
  };
}

function createMutationActionCard(
  toolName: string,
  toolArgs: JsonObject,
  request: BloomAssistRequest,
): JsonObject | null {
  const toolDefinition = getRegisteredTool(toolName);
  if (
    request.session_type !== "resource_focused" ||
    !request.resource_focus ||
    !toolDefinition ||
    toolDefinition.category !== "mutation"
  ) {
    return null;
  }

  return {
    mutationId: `mut_${crypto.randomUUID()}`,
    toolName,
    toolArgs,
    description: describeMutationAction(toolName, request.resource_focus),
    status: "pending",
    result: null,
  };
}

function createBloomToolExecutor(
  serviceClient: PersistenceClient,
  dataClient: PersistenceClient,
  context: UserContext,
  conversationId: string,
  messageId: string,
  timezone: string,
  cacheAuditScopeId: string,
  bloomRequest: BloomAssistRequest,
  onToolExecution?: (execution: PostResponseToolExecution) => void,
): ToolExecutor {
  return async (request): Promise<ToolExecutorResult> => {
    const startedAt = Date.now();
    const resolvedArguments = injectImplicitResourceFocusArguments(
      request.name,
      request.arguments,
      bloomRequest,
    );

    try {
      await logAuditEvent(
        serviceClient,
        context.tenantId,
        context.userId,
        "tool_call",
        {
          tool_name: request.name,
          parameter_summary: summarizeForAudit(resolvedArguments),
          iteration: request.iteration,
        },
        { conversationId, messageId },
      );
    } catch (error) {
      console.error(
        "[bloom-assist] Failed to log tool call audit event",
        toErrorMessage(error),
      );
    }

    const pendingActionCard = createMutationActionCard(
      request.name,
      resolvedArguments,
      bloomRequest,
    );
    if (pendingActionCard) {
      const executionTimeMs = Date.now() - startedAt;
      onToolExecution?.({
        toolName: request.name,
        input: resolvedArguments,
        output: pendingActionCard,
        status: "pending",
        errorMessage: null,
        executionTimeMs,
      });

      return {
        block_type: "mutation_action",
        result: pendingActionCard,
        status: "pending",
        execution_time_ms: executionTimeMs,
        error_message: null,
      };
    }

    const toolResult = await executeTool(request.name, resolvedArguments, {
      ...context,
      conversationId,
      messageId,
      timezone,
      authenticatedTenantId: context.tenantId,
      cacheAuditScopeId,
      serviceClient,
      dataClient,
    });
    const executionTimeMs = Date.now() - startedAt;
    const status = statusForToolResult(toolResult);
    const resultPayload = toolResultToJson(toolResult);

    onToolExecution?.({
      toolName: request.name,
      input: resolvedArguments,
      output: resultPayload,
      status,
      errorMessage: toolResult.error,
      executionTimeMs,
    });

    try {
      await logAuditEvent(
        serviceClient,
        context.tenantId,
        context.userId,
        "tool_result",
        {
          tool_name: request.name,
          status,
          success: toolResult.success,
          result_count: countToolResultRows(toolResult),
          execution_time_ms: executionTimeMs,
          error_message: toolResult.error,
        },
        {
          conversationId,
          messageId,
          latencyMs: executionTimeMs,
        },
      );
    } catch (error) {
      console.error(
        "[bloom-assist] Failed to log tool result audit event",
        toErrorMessage(error),
      );
    }

    return {
      block_type: toolResult.block_type,
      result: resultPayload,
      status,
      execution_time_ms: executionTimeMs,
      error_message: toolResult.error,
    };
  };
}

function createBloomStreamResponse(
  req: Request,
  serviceClient: PersistenceClient,
  dataClient: PersistenceClient,
  context: UserContext,
  body: BloomAssistRequest,
  resolvedEntitySummary: EntitySummary | null,
  inputSecurity: InputSecurityAssessment,
  openAiApiKey: string,
): Response {
  const encoder = new TextEncoder();
  let innerReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let streamCancelled = false;
  const toolExecutions: PostResponseToolExecution[] = [];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      const cacheAuditScopeId = crypto.randomUUID();
      startCacheAuditScope(cacheAuditScopeId);
      let conversationId = body.conversation_id;
      let conversationTitle: string | null = null;
      let userMessageId: string | null = null;
      let assistantMessageId: string | null = null;
      let effectiveBody: BloomAssistRequest = body;
      let modeOverride: BloomMode | null = null;
      let pendingResponseAudit: PendingResponseAudit | null = null;
      let responseAuditLogged = false;
      const latencyCapture: StreamLatencyCapture = {
        requestStartedAt: startedAt,
        contextBuildCompletedAt: null,
        openAiRequestStartedAt: null,
        firstOpenAiChunkAt: null,
        firstTokenEmittedAt: null,
        firstToolResultAt: null,
        doneEmittedAt: null,
      };

      const currentCacheStats = () => readCacheAuditScope(cacheAuditScopeId);

      const writeEvent = (event: BloomSseEvent) => {
        if (streamCancelled) {
          return;
        }

        const now = Date.now();
        if (
          event.event === "tool_result" &&
          latencyCapture.firstToolResultAt === null
        ) {
          latencyCapture.firstToolResultAt = now;
        }

        if (event.event === "done" && latencyCapture.doneEmittedAt === null) {
          latencyCapture.doneEmittedAt = now;
        }

        controller.enqueue(encoder.encode(formatSseEvent(event)));
      };

      const finalizeResponseAudit = async () => {
        if (
          responseAuditLogged ||
          !pendingResponseAudit ||
          !conversationId ||
          !assistantMessageId
        ) {
          return;
        }

        responseAuditLogged = true;
        const latencyMetrics = buildLatencyBreakdown(latencyCapture);
        const cacheStats = currentCacheStats();

        try {
          await logAuditEvent(
            serviceClient,
            context.tenantId,
            context.userId,
            "response",
            {
              ...pendingResponseAudit.eventData,
              metric_source: "server",
              latency_metrics: latencyMetrics,
              cache_stats: cacheStats,
              total_latency_ms: latencyMetrics.server_total_ms,
            },
            {
              conversationId,
              messageId: pendingResponseAudit.assistantMessageId,
              model: pendingResponseAudit.model,
              tokens: {
                input: pendingResponseAudit.tokenCounts.tokens_input,
                output: pendingResponseAudit.tokenCounts.tokens_output,
              },
              latencyMs: latencyMetrics.server_total_ms,
            },
          );
        } catch (error) {
          console.error(
            "[bloom-assist] Failed to log response audit event",
            toErrorMessage(error),
          );
        }
      };

      const logStreamError = async (error: unknown, stage: string) => {
        const message = toErrorMessage(error);
        try {
          await logAuditEvent(
            serviceClient,
            context.tenantId,
            context.userId,
            "error",
            {
              message,
              stage,
              error_type: error instanceof Error ? error.name : "stream_error",
              stack_trace_summary: stackTraceSummary(error),
            },
            {
              conversationId,
              messageId: assistantMessageId ?? userMessageId,
              latencyMs: Date.now() - startedAt,
            },
          );
        } catch (auditError) {
          console.error(
            "[bloom-assist] Failed to log error audit event",
            toErrorMessage(auditError),
          );
        }
      };

      const queuePostResponseProcessing = () => {
        const completedToolExecutions = [...toolExecutions];
        void processPostResponse(
          serviceClient,
          context.tenantId,
          context.userId,
          completedToolExecutions,
          effectiveBody.message,
          resolvedEntitySummary,
        ).catch((error) => {
          console.error(
            "[bloom-assist] Post-response processing failed",
            toErrorMessage(error),
          );
        });
      };

      const persistStreamCompletion = async (completion: StreamCompletion) => {
        if (!conversationId) {
          throw new Error(
            "Conversation was not initialized for response persistence",
          );
        }

        const assistantMessage = await persistAssistantResponse(
          serviceClient,
          context.tenantId,
          conversationId,
          completion.content,
          completion.thinkingContent,
          completion.blockData,
          completion.tokenCounts,
          completion.followUpChips,
          effectiveBody.mode,
          completion.model,
          assistantResponseMetadata(
            effectiveBody.model_preference,
            modeOverride,
          ),
        );

        assistantMessageId = assistantMessage.messageId;
        queuePostResponseProcessing();

        pendingResponseAudit = {
          assistantMessageId: assistantMessage.messageId,
          model: completion.model,
          tokenCounts: completion.tokenCounts,
          eventData: {
            status: completion.finishReason,
            stage: "m02b_context_streaming",
            assistant_message_id: assistantMessage.messageId,
            follow_up_chip_count: completion.followUpChips.length,
            has_thinking_content: Boolean(completion.thinkingContent),
            response_token_count: completion.tokenCounts.tokens_output,
            ...reasoningTokenAuditData(
              effectiveBody.mode,
              completion.content,
              completion.thinkingContent,
              completion.tokenCounts,
            ),
            tool_call_count: toolExecutions.length,
            model: completion.model,
          },
        };
      };

      try {
        const intentClassification = await classifyIntentWithComplexity(
          body.message,
          { openAiApiKey },
        );
        const { mode: effectiveMode, modeOverride: resolvedModeOverride } =
          resolveEffectiveMode(body.mode, intentClassification);
        effectiveBody =
          effectiveMode === body.mode ? body : { ...body, mode: effectiveMode };
        modeOverride = resolvedModeOverride;
        const pendingAttachments = preparePendingAttachments(body.attachments);

        const persistedUserMessage = await persistUserMessage(
          serviceClient,
          context.tenantId,
          context.userId,
          body.conversation_id,
          body.message,
          effectiveBody.mode,
          pendingAttachments,
          effectiveBody.session_type,
          effectiveBody.resource_focus,
        );

        conversationId = persistedUserMessage.conversationId;
        conversationTitle = persistedUserMessage.title;
        userMessageId = persistedUserMessage.messageId;
        const resolvedContext: UserContext = { ...context, conversationId };
        const attachmentProcessing = await processAttachments({
          storageClient: serviceClient,
          serviceClient,
          dataClient,
          attachments: pendingAttachments,
          tenantId: context.tenantId,
          conversationId,
          openAiApiKey,
        });

        if (pendingAttachments && pendingAttachments.length > 0) {
          await updateMessageAttachments({
            serviceClient,
            tenantId: context.tenantId,
            conversationId,
            messageId: userMessageId,
            attachments: attachmentProcessing.attachments,
          });
        }

        effectiveBody = {
          ...effectiveBody,
          attachments:
            attachmentProcessing.attachments.length > 0
              ? attachmentProcessing.attachments
              : null,
        };
        const selectedModel = selectModel(
          intentClassification.category,
          intentClassification.complexity,
          effectiveBody.mode,
          effectiveBody.model_preference,
        );
        const selectedMaxToolIterations = selectMaxToolIterations(
          effectiveBody.mode,
        );

        const imageRefinement =
          attachmentProcessing.context.imageParts.length === 0
            ? await detectImageRefinementRequest(
                serviceClient,
                context.tenantId,
                context.userId,
                conversationId,
                effectiveBody,
              )
            : null;

        if (imageRefinement) {
          const directExecutor = createBloomToolExecutor(
            serviceClient,
            dataClient,
            resolvedContext,
            conversationId,
            userMessageId,
            effectiveBody.timezone,
            cacheAuditScopeId,
            effectiveBody,
            (execution) => toolExecutions.push(execution),
          );
          writeEvent({
            event: "tool_start",
            data: { tool: "generate_image", params: imageRefinement.params },
          });
          const directResult = await directExecutor({
            id: `call_${crypto.randomUUID()}`,
            name: "generate_image",
            arguments: imageRefinement.params,
            conversationId,
            iteration: 1,
          });
          writeEvent({
            event: "tool_result",
            data: {
              tool: "generate_image",
              block_type: directResult.block_type,
              result: directResult.result,
            },
          });

          const resultPayload =
            readJsonObjectFromUnknown(directResult.result) ?? {};
          const isImageResult =
            directResult.status === "completed" &&
            directResult.block_type === "image";
          const followUpChips = isImageResult
            ? imageFollowUpChips(resultPayload)
            : [];
          const tokenCounts: TokenCounts = {
            tokens_input:
              estimateTokenCount(effectiveBody.message) +
              estimateTokenCount(String(imageRefinement.params.prompt ?? "")),
            tokens_output: estimateTokenCount(
              directImageResponseContent(directResult),
            ),
          };
          const assistantMessage = await persistAssistantResponse(
            serviceClient,
            context.tenantId,
            conversationId,
            directImageResponseContent(directResult),
            null,
            isImageResult ? imageBlockDataFromToolResult(resultPayload) : {},
            tokenCounts,
            followUpChips,
            effectiveBody.mode,
            selectedModel,
            assistantResponseMetadata(
              effectiveBody.model_preference,
              modeOverride,
            ),
          );

          assistantMessageId = assistantMessage.messageId;
          queuePostResponseProcessing();

          pendingResponseAudit = {
            assistantMessageId: assistantMessage.messageId,
            model: selectedModel,
            tokenCounts,
            eventData: {
              status: directResult.status,
              stage: "m14a_image_refinement",
              assistant_message_id: assistantMessage.messageId,
              previous_image_url: imageRefinement.previousImageUrl,
              tool_call_count: toolExecutions.length,
              intent_category: intentClassification.category,
              intent_complexity: intentClassification.complexity,
              requested_mode: body.mode,
              mode: effectiveBody.mode,
              mode_override: modeOverride,
              model: selectedModel,
            },
          };

          latencyCapture.doneEmittedAt = Date.now();
          const latencyMetrics = buildLatencyBreakdown(latencyCapture);
          writeEvent({
            event: "done",
            data: {
              tokens_input: tokenCounts.tokens_input,
              tokens_output: tokenCounts.tokens_output,
              model: selectedModel,
              conversation_id: conversationId,
              ...(conversationTitle ? { title: conversationTitle } : {}),
              follow_up_chips: followUpChips,
              latency_metrics: latencyMetrics,
              cache_stats: currentCacheStats(),
              ...(modeOverride ? { mode_override: modeOverride } : {}),
            },
          });

          return;
        }

        const contextBuildResult = await buildContextLayers({
          serviceClient,
          context: resolvedContext,
          request: effectiveBody,
          entitySummary: resolvedEntitySummary,
          attachmentContext: attachmentProcessing.context,
          currentMessageId: userMessageId,
          inputSecurity,
          toolDefinitionProvider: ({ mode, userRole }) =>
            getToolDefinitionsForMode(mode, userRole, intentClassification),
        });
        latencyCapture.contextBuildCompletedAt = Date.now();

        await logAuditEvent(
          serviceClient,
          context.tenantId,
          context.userId,
          "prompt",
          {
            mode: effectiveBody.mode,
            requested_mode: body.mode,
            mode_override: modeOverride,
            page_context: effectiveBody.page_context,
            prefetched_entity_summary: resolvedEntitySummary
              ? {
                  entity_type: resolvedEntitySummary.entityType,
                  entity_id: resolvedEntitySummary.entityId,
                  name: resolvedEntitySummary.name,
                }
              : null,
            timezone: effectiveBody.timezone,
            message_length: effectiveBody.message.length,
            is_new_conversation: persistedUserMessage.isNewConversation,
            context_estimated_input_tokens:
              contextBuildResult.estimatedInputTokens,
            truncated_history_count: contextBuildResult.truncatedHistoryCount,
            tool_count: contextBuildResult.tools.length,
            intent_category: intentClassification.category,
            intent_complexity: intentClassification.complexity,
            model_preference: effectiveBody.model_preference,
            selected_model: selectedModel,
            max_tool_iterations: selectedMaxToolIterations ?? null,
            attachment_count: attachmentProcessing.attachments.length,
            attachment_ready_count: attachmentProcessing.readyCount,
            attachment_failed_count: attachmentProcessing.failedCount,
            vision_attachment_count:
              attachmentProcessing.context.imageParts.length,
          },
          {
            conversationId,
            messageId: userMessageId,
          },
        );

        const openAiRequestBody: Record<string, unknown> = {
          model: selectedModel,
          messages: contextBuildResult.messages,
          temperature: 0.3,
          max_tokens: MAX_OUTPUT_TOKENS,
          stream: true,
          stream_options: { include_usage: true },
        };

        if (contextBuildResult.tools.length > 0) {
          openAiRequestBody.tools = contextBuildResult.tools;
          openAiRequestBody.tool_choice = "auto";
        }

        latencyCapture.openAiRequestStartedAt = Date.now();
        const openAiResponse = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(openAiRequestBody),
        });

        const bloomStream = processOpenAIStream(
          openAiResponse,
          createBloomToolExecutor(
            serviceClient,
            dataClient,
            resolvedContext,
            conversationId,
            userMessageId,
            effectiveBody.timezone,
            cacheAuditScopeId,
            effectiveBody,
            (execution) => toolExecutions.push(execution),
          ),
          {
            openAiApiKey,
            model: selectedModel,
            mode: effectiveBody.mode,
            modeOverride,
            conversationId,
            conversationTitle,
            messages: contextBuildResult.messages,
            tools: contextBuildResult.tools,
            estimatedInputTokens: contextBuildResult.estimatedInputTokens,
            maxToolIterations: selectedMaxToolIterations,
            validateOutput: (response, validationContext) =>
              validateOutput(response, context.userRole, validationContext),
            onOutputViolation: async (violation) => {
              await logSecurityAuditEvent(
                serviceClient,
                context.tenantId,
                context.userId,
                "output_violation",
                compactAuditObject({
                  violation_type: violation.violationType,
                  offending_content_fragment:
                    violation.offendingContentFragment ?? null,
                }),
                {
                  conversationId,
                  messageId: userMessageId,
                },
              );
            },
            onSuspiciousEntityIds: async ({
              suspiciousEntityIds,
              knownEntityIdCount,
            }) => {
              await logSecurityAuditEvent(
                serviceClient,
                context.tenantId,
                context.userId,
                "cross_tenant_attempt",
                compactAuditObject({
                  suspicious_entity_ids: suspiciousEntityIds,
                  known_entity_id_count: knownEntityIdCount,
                  check_mode: "audit_only",
                }),
                {
                  conversationId,
                  messageId: userMessageId,
                },
              );
            },
            onComplete: persistStreamCompletion,
            monitoring: {
              requestStartedAt: latencyCapture.requestStartedAt,
              contextBuildCompletedAt: latencyCapture.contextBuildCompletedAt,
              openAiRequestStartedAt: latencyCapture.openAiRequestStartedAt,
              getCacheStats: currentCacheStats,
              onFirstOpenAiChunk: (timestamp) => {
                if (latencyCapture.firstOpenAiChunkAt === null) {
                  latencyCapture.firstOpenAiChunkAt = timestamp;
                }
              },
              onFirstToken: (timestamp) => {
                if (latencyCapture.firstTokenEmittedAt === null) {
                  latencyCapture.firstTokenEmittedAt = timestamp;
                }
              },
              onFirstToolResult: (timestamp) => {
                if (latencyCapture.firstToolResultAt === null) {
                  latencyCapture.firstToolResultAt = timestamp;
                }
              },
              onDone: (timestamp) => {
                if (latencyCapture.doneEmittedAt === null) {
                  latencyCapture.doneEmittedAt = timestamp;
                }
              },
            },
            getDoneData: () =>
              assistantMessageId
                ? { assistant_message_id: assistantMessageId }
                : null,
            onTaskPlan: async (taskPlanRequest) => {
              if (!conversationId || !userMessageId) {
                throw new Error(
                  "Conversation was not initialized for task plan persistence",
                );
              }

              const generatedPlan = generateTaskPlan(
                taskPlanRequest.toolResults,
                {
                  tenantId: context.tenantId,
                  userId: context.userId,
                  userRole: context.userRole,
                  userName: context.userName,
                  conversationId,
                  messageId: userMessageId,
                  timezone: effectiveBody.timezone,
                },
              );
              const prefilledPlan = await prefillCampaignContent(
                generatedPlan,
                {
                  tenantId: context.tenantId,
                  userId: context.userId,
                  userRole: context.userRole,
                  userName: context.userName,
                  conversationId,
                  messageId: userMessageId,
                  timezone: effectiveBody.timezone,
                  serviceClient,
                  dataClient,
                  userMessage: effectiveBody.message,
                },
              );
              const validatedPlan = await validateTaskPlan(
                prefilledPlan,
                serviceClient,
                context.tenantId,
                context.userRole,
              );
              const assistantMessage = await persistAssistantResponse(
                serviceClient,
                context.tenantId,
                conversationId,
                taskPlanRequest.content,
                taskPlanRequest.thinkingContent,
                {
                  block_type: "task_plan",
                  task_plan: taskPlanToJson(validatedPlan),
                },
                taskPlanRequest.tokenCounts,
                taskPlanRequest.followUpChips,
                effectiveBody.mode,
                taskPlanRequest.model,
                assistantResponseMetadata(
                  effectiveBody.model_preference,
                  modeOverride,
                ),
              );

              assistantMessageId = assistantMessage.messageId;
              queuePostResponseProcessing();

              pendingResponseAudit = {
                assistantMessageId: assistantMessage.messageId,
                model: taskPlanRequest.model,
                tokenCounts: taskPlanRequest.tokenCounts,
                eventData: {
                  status: "task_plan",
                  stage: "m11a_task_plan_generation",
                  assistant_message_id: assistantMessage.messageId,
                  plan_id: validatedPlan.plan_id,
                  task_count: validatedPlan.tasks.length,
                  risk_level: validatedPlan.risk_level,
                  compact: validatedPlan.compact,
                  ...reasoningTokenAuditData(
                    effectiveBody.mode,
                    taskPlanRequest.content,
                    taskPlanRequest.thinkingContent,
                    taskPlanRequest.tokenCounts,
                  ),
                  model: taskPlanRequest.model,
                },
              };

              return taskPlanToJson(validatedPlan);
            },
            onError: (message, code) => logStreamError(message, code),
          },
        );

        innerReader = bloomStream.getReader();
        while (!streamCancelled) {
          const { done, value } = await innerReader.read();
          if (done) {
            break;
          }

          controller.enqueue(value);
        }
      } catch (error) {
        const message = toErrorMessage(error);
        console.error("[bloom-assist] Stream pipeline failed", message);

        await logStreamError(error, "m02b_context_streaming");

        writeEvent({
          event: "error",
          data: { message, code: "pipeline_error" },
        });
      } finally {
        await finalizeResponseAudit();
        finishCacheAuditScope(cacheAuditScopeId);
        releaseRateLimitSlot(context.userId);
        if (!streamCancelled) {
          controller.close();
        }
      }
    },
    async cancel(reason) {
      streamCancelled = true;
      if (innerReader) {
        await innerReader.cancel(reason);
      }
    },
  });

  return new Response(stream, { headers: createSseHeaders(req) });
}

function createTaskApprovalStreamResponse(
  req: Request,
  serviceClient: PersistenceClient,
  dataClient: PersistenceClient,
  context: UserContext,
  approval: TaskPlanApprovalPayload,
): Response {
  const encoder = new TextEncoder();
  let streamCancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      const writeEvent = (event: BloomSseEvent) => {
        if (streamCancelled) {
          return;
        }
        controller.enqueue(encoder.encode(formatSseEvent(event)));
      };

      try {
        const summary = await processApproval(
          approval.plan_id,
          approval.approved_task_ids,
          approval.skipped_task_ids,
          approval.edited_fields,
          {
            tenantId: context.tenantId,
            userId: context.userId,
            userRole: context.userRole,
            userName: context.userName,
            conversationId: approval.conversation_id,
            messageId: approval.plan_id,
            timezone: approval.timezone,
            serviceClient,
            dataClient,
            mode: approval.mode,
            emitProgress: (progress) => {
              writeEvent({ event: "task_progress", data: progress });
            },
          },
          approval.retry_task_id,
        );

        const summaryJson = taskPlanSummaryToJson(summary);
        writeEvent({ event: "task_complete", data: summaryJson });
        const totalLatencyMs = Date.now() - startedAt;
        writeEvent({
          event: "done",
          data: {
            tokens_input: 0,
            tokens_output: 0,
            model: OPENAI_MODEL,
            conversation_id: approval.conversation_id,
            follow_up_chips: [],
            latency_metrics: {
              server_ttft_ms: null,
              server_ttfb_ms: null,
              server_total_ms: totalLatencyMs,
              context_build_ms: null,
              llm_latency_ms: null,
            },
            cache_stats: EMPTY_BLOOM_CACHE_STATS,
          },
        });

        await logAuditEvent(
          serviceClient,
          context.tenantId,
          context.userId,
          "execution",
          {
            stage: "m11a_task_plan_approval",
            plan_id: approval.plan_id,
            completed_count: summary.completed_count,
            skipped_count: summary.skipped_count,
            failed_count: summary.failed_count,
            blocked_count: summary.blocked_count,
            total_latency_ms: totalLatencyMs,
          },
          {
            conversationId: approval.conversation_id,
            latencyMs: totalLatencyMs,
          },
        );
      } catch (error) {
        const message = toErrorMessage(error);
        console.error("[bloom-assist] Task approval failed", message);
        try {
          await logAuditEvent(
            serviceClient,
            context.tenantId,
            context.userId,
            "error",
            {
              stage: "m11a_task_plan_approval",
              plan_id: approval.plan_id,
              message,
              error_type:
                error instanceof Error ? error.name : "task_approval_error",
              stack_trace_summary: stackTraceSummary(error),
            },
            {
              conversationId: approval.conversation_id,
              latencyMs: Date.now() - startedAt,
            },
          );
        } catch (auditError) {
          console.error(
            "[bloom-assist] Failed to log task approval error",
            toErrorMessage(auditError),
          );
        }
        writeEvent({
          event: "error",
          data: { message, code: "task_approval_error" },
        });
      } finally {
        releaseRateLimitSlot(context.userId);
        if (!streamCancelled) {
          controller.close();
        }
      }
    },
    cancel() {
      streamCancelled = true;
    },
  });

  return new Response(stream, { headers: createSseHeaders(req) });
}

async function createExecuteActionResponse(
  req: Request,
  serviceClient: PersistenceClient,
  dataClient: PersistenceClient,
  context: UserContext,
  payload: ExecuteActionRequest,
): Promise<Response> {
  const { data, error } = await serviceClient
    .from("bloom_conversations")
    .select("id, tenant_id, user_id, session_type")
    .eq("id", payload.conversationId)
    .maybeSingle();

  if (error) {
    return jsonResponse(req, { error: error.message }, 400);
  }

  if (
    !isRecord(data) ||
    data.tenant_id !== context.tenantId ||
    data.user_id !== context.userId
  ) {
    return jsonResponse(req, { error: "Conversation access denied" }, 403);
  }

  if (data.session_type !== "resource_focused") {
    return jsonResponse(
      req,
      { error: "Ask Bloom actions are only available for resource-focused sessions." },
      400,
    );
  }

  const toolDefinition = getRegisteredTool(payload.action.toolName);
  if (!toolDefinition || toolDefinition.category !== "mutation") {
    return jsonResponse(req, { error: "execute_action requires a mutation tool" }, 400);
  }

  if (payload.assistantMessageId) {
    await loadMessageOwnership(
      serviceClient,
      context.tenantId,
      payload.conversationId,
      payload.assistantMessageId,
    );
    await updateAssistantMessageActionCard({
      serviceClient,
      tenantId: context.tenantId,
      conversationId: payload.conversationId,
      messageId: payload.assistantMessageId,
      mutationId: payload.action.mutationId,
      status: "executing",
      result: null,
    });
  }

  const toolResult = await executeTool(payload.action.toolName, payload.action.toolArgs, {
    ...context,
    conversationId: payload.conversationId,
    messageId: payload.assistantMessageId ?? payload.action.mutationId,
    timezone: "UTC",
    authenticatedTenantId: context.tenantId,
    serviceClient,
    dataClient,
    approved: true,
  });

  const status = toolResult.success ? "completed" : "failed";
  const resultMessage = toolResult.success
    ? toolResult.message
    : toolResult.error || toolResult.message;

  if (payload.assistantMessageId) {
    await updateAssistantMessageActionCard({
      serviceClient,
      tenantId: context.tenantId,
      conversationId: payload.conversationId,
      messageId: payload.assistantMessageId,
      mutationId: payload.action.mutationId,
      status,
      result: resultMessage,
    });
  }

  return jsonResponse(req, {
    mutationId: payload.action.mutationId,
    status,
    result: status === "completed" ? resultMessage : null,
    error: status === "failed" ? resultMessage : null,
    data: toolResult.data ?? null,
  });
}

export async function handleRequest(req: Request): Promise<Response> {
  let reservedRateLimitUserId: string | null = null;
  const releaseReservedRateLimit = () => {
    if (!reservedRateLimitUserId) {
      return;
    }

    releaseRateLimitSlot(reservedRateLimitUserId);
    reservedRateLimitUserId = null;
  };

  const corsPreflight = handleCorsPreflight(req, CORS_OPTIONS);
  if (corsPreflight) {
    return corsPreflight;
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(req, { error: "Authentication required" }, 401);
  }

  const envConfig = readEnvConfig();
  if (!envConfig) {
    return jsonResponse(req, { error: "Server configuration error" }, 500);
  }

  try {
    const userClient = createClient(envConfig.supabaseUrl, envConfig.anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(
      envConfig.supabaseUrl,
      envConfig.serviceRoleKey,
    );

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse(req, { error: "Invalid session" }, 401);
    }

    const userMetadata = isRecord(user.user_metadata) ? user.user_metadata : {};
    const context = await resolveUserContext(userClient, user.id, userMetadata);

    if (!context) {
      return jsonResponse(req, { error: "Tenant membership required" }, 403);
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse(req, { error: "Invalid JSON body" }, 400);
    }

    if (looksLikeExecuteActionRequest(rawBody)) {
      const parsedExecuteAction = parseExecuteActionRequest(rawBody);
      if (!parsedExecuteAction.ok) {
        return jsonResponse(req, { error: parsedExecuteAction.message }, 400);
      }

      return await createExecuteActionResponse(
        req,
        serviceClient,
        userClient,
        { ...context, conversationId: parsedExecuteAction.value.conversationId },
        parsedExecuteAction.value,
      );
    }

    if (looksLikeTaskPlanApprovalRequest(rawBody)) {
      const parsedApproval = parseTaskPlanApprovalRequest(rawBody);
      if (!parsedApproval.ok) {
        return jsonResponse(req, { error: parsedApproval.message }, 400);
      }

      const conversation = await validateConversationOwnership(
        serviceClient,
        context.tenantId,
        context.userId,
        parsedApproval.value.conversation_id,
      );

      if (!conversation) {
        return jsonResponse(req, { error: "Conversation access denied" }, 403);
      }

      const rateLimit = await checkRateLimit(
        context.tenantId,
        context.userId,
        serviceClient,
      );

      if (!rateLimit.allowed) {
        return jsonResponse(req, { error: RATE_LIMIT_MESSAGE }, 429, {
          "Retry-After": String(rateLimit.retryAfterSeconds ?? 300),
        });
      }

      reservedRateLimitUserId = context.userId;
      const response = createTaskApprovalStreamResponse(
        req,
        serviceClient,
        userClient,
        { ...context, conversationId: parsedApproval.value.conversation_id },
        parsedApproval.value,
      );
      reservedRateLimitUserId = null;
      return response;
    }

    const parsedBody = parseBloomAssistRequest(rawBody);
    if (!parsedBody.ok) {
      return jsonResponse(req, { error: parsedBody.message }, 400);
    }

    const rateLimit = await checkRateLimit(
      context.tenantId,
      context.userId,
      serviceClient,
    );

    if (!rateLimit.allowed) {
      return jsonResponse(req, { error: RATE_LIMIT_MESSAGE }, 429, {
        "Retry-After": String(rateLimit.retryAfterSeconds ?? 300),
      });
    }

    reservedRateLimitUserId = context.userId;

    const inputSecurity = sanitizeInput(parsedBody.value.message);
    const sanitizedMessage = inputSecurity.sanitized.trim();
    if (!sanitizedMessage) {
      releaseReservedRateLimit();
      return jsonResponse(req, { error: "message cannot be empty" }, 400);
    }

    const sanitizedBody: BloomAssistRequest = {
      ...parsedBody.value,
      message: sanitizedMessage,
    };

    if (inputSecurity.injectionDetected) {
      try {
        await logSecurityAuditEvent(
          serviceClient,
          context.tenantId,
          context.userId,
          "injection_attempt",
          compactAuditObject({
            detection_reason: inputSecurity.detectionReason,
            message_length: sanitizedBody.message.length,
          }),
        );
      } catch (error) {
        console.error(
          "[bloom-assist] Failed to log injection attempt audit event",
          toErrorMessage(error),
        );
      }
    }

    if (sanitizedBody.conversation_id) {
      const conversation = await validateConversationOwnership(
        serviceClient,
        context.tenantId,
        context.userId,
        sanitizedBody.conversation_id,
      );

      if (!conversation) {
        releaseReservedRateLimit();
        return jsonResponse(req, { error: "Conversation access denied" }, 403);
      }
    }

    const prefetchedEntitySummary =
      sanitizedBody.page_context?.entityType &&
      sanitizedBody.page_context?.entityId
        ? await prefetchEntitySummary(
            serviceClient,
            sanitizedBody.page_context.entityType,
            sanitizedBody.page_context.entityId,
            context.tenantId,
          )
        : null;

    const response = createBloomStreamResponse(
      req,
      serviceClient,
      userClient,
      { ...context, conversationId: sanitizedBody.conversation_id },
      sanitizedBody,
      prefetchedEntitySummary,
      inputSecurity,
      envConfig.openAiApiKey,
    );
    reservedRateLimitUserId = null;
    return response;
  } catch (error) {
    releaseReservedRateLimit();
    console.error("[bloom-assist] Request failed", toErrorMessage(error));
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
}

Deno.serve((req) => handleRequest(req));
