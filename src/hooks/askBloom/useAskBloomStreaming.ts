import * as React from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  analyzeStreamingContent,
  extractPreFormText,
  labelToFieldName,
  type DetectedTextPlan,
} from "@/components/bloom/utils/contentGate";
import {
  contentBlockFromStreamingBlock,
  extractIdentifiersFromToolResults,
  stripRedundantContent,
} from "@/components/bloom/content/parseContentBlocks";
import { stripEchoedToolPayloads } from "@/components/bloom/content/sanitizeBloomContent";
import { stripToolJsonFromText } from "@/components/bloom/utils/stripToolJson";
import type { PendingResourceForm } from "@/components/bloom/utils/resourceFormRegistry";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/config";
import type { Json } from "@/integrations/supabase/types";
import {
  bloomSupabase,
  isBloomMode,
  type BloomConversation,
  type BloomJsonArray,
  type BloomMessage,
  type BloomModelPreference,
  type BloomMode,
  type BloomPageContextPayload,
} from "@/hooks/bloom/types";
import {
  bloomConversationsQueryBaseKey,
  sortBloomConversations,
} from "@/hooks/bloom/useBloomConversations";
import {
  bloomMessagesQueryKey,
  fetchBloomMessagesPage,
  type BloomMessagesPage,
} from "@/hooks/bloom/useBloomMessages";
import {
  parseBloomTaskCompletionSummary,
  parseBloomTaskPlan,
  parseBloomTaskStatusUpdate,
  taskPlanBlockData,
  type BloomTaskJsonObject,
  type BloomTaskCompletionSummary,
  type BloomTaskPlanAction,
  type BloomTaskPlanEntityType,
  type BloomTaskRiskLevel,
  type BloomTaskPlan,
  type BloomTaskStatusUpdate,
  type BloomValidationAnnotation,
} from "@/hooks/bloom/taskPlanTypes";
import type {
  AskBloomActionCard,
  AskBloomBlock,
  AskBloomMessage,
  AskBloomToolCall,
  AskBloomToolCallStatus,
  BloomContentBlock,
  ResourceFocus,
} from "@/types/askBloom";
import {
  bloomContentBlockToAskBloomBlock,
  isRecord,
  readString,
  toAskBloomActionCard,
  toDataRecord,
} from "@/utils/askBloomBlocks";
import { bloomChatClientContext } from "@/lib/bloomSupport/api";

/*
 * The one client conversation hook for Bloom. Every surface that talks to the
 * `bloom-assist` edge function — the Ask Bloom drawer, the /bloom workspace and
 * the command-palette compact panel — streams through `useAskBloomStreaming`.
 *
 * Two message stores are supported:
 * - "local": the caller owns the message list and receives the finished
 *   assistant message through `onMessage` (Ask Bloom drawer).
 * - "bloomMessageCache": the hook writes the optimistic user message, the
 *   streaming placeholder and the persisted page into the Bloom React Query
 *   message cache (/bloom workspace and the compact panel).
 *
 * Live stream state (text, thinking, tool calls, blocks, research progress,
 * pending task plan, latency) is returned for every store.
 */

const TOKEN_FLUSH_INTERVAL_MS = 50;
const TOKEN_FLUSH_COUNT = 5;
const MAX_CONSECUTIVE_PARSE_ERRORS = 5;
const STREAM_INTERRUPTED_MESSAGE = "Connection lost. Partial response preserved.";

export type BloomStreamingConnectionState =
  | "idle"
  | "connecting"
  | "streaming"
  | "error"
  | "done";

export interface BloomActiveToolCall {
  toolName: string;
  description: string;
}

export interface BloomStreamingBlock {
  id: string;
  toolName: string | null;
  blockType: string;
  payload: Json;
  createdAt: string;
}

export type BloomResearchStepState =
  | "pending"
  | "executing"
  | "completed"
  | "failed";

export interface BloomResearchPlan {
  totalSteps: number;
  stepLabels: string[];
}

export interface BloomResearchStepStatus {
  status: BloomResearchStepState;
  toolName: string;
  label: string;
  startedAt: string;
  updatedAt: string;
}

interface BloomServerLatencyMetrics {
  server_ttft_ms: number | null;
  server_ttfb_ms: number | null;
  server_total_ms: number | null;
  context_build_ms: number | null;
  llm_latency_ms: number | null;
}

interface BloomCacheAuditStats {
  hits: number;
  misses: number;
  invalidations: number;
}

export interface BloomStreamingDoneMetadata {
  conversationId: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  model: string | null;
  title: string | null;
  followUpChips: BloomJsonArray;
  modeOverride: BloomMode | null;
  latencyMetrics: BloomServerLatencyMetrics | null;
  cacheStats: BloomCacheAuditStats | null;
}

export interface BloomStreamingLatencyMetrics {
  clientTtftMs: number | null;
  clientTtfbMs: number | null;
  clientTotalMs: number | null;
  serverMetrics: BloomServerLatencyMetrics | null;
  cacheStats: BloomCacheAuditStats | null;
}

export type AskBloomMessageStore = "local" | "bloomMessageCache";

export interface UseAskBloomStreamingOptions {
  /** Default conversation for `sendMessage`; an override wins. */
  conversationId?: string | null;
  /** Default resource focus for `sendMessage`; an override wins. */
  resourceFocus?: ResourceFocus | null;
  /** Where conversation messages live. Defaults to "local". */
  messageStore?: AskBloomMessageStore;
  /**
   * Tenant that scopes the Bloom message cache and latency audit rows. Required
   * for the "bloomMessageCache" store; ignored by the "local" store.
   */
  tenantId?: string | null;
  /**
   * Surface a plan Bloom wrote as text through `onTaskPlan`. Defaults to on for
   * the "local" store and off for "bloomMessageCache".
   */
  interceptTextPlans?: boolean;
  onMessage?: (message: AskBloomMessage) => void;
  onStreamingUpdate?: (partialContent: string) => void;
  onActionCard?: (card: AskBloomActionCard, blocks: AskBloomBlock[]) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
  onStreamComplete?: () => void;
  onThinkingToken?: (thinkingContent: string) => void;
  onToolStart?: (toolCall: BloomActiveToolCall) => void;
  onToolResult?: (block: BloomStreamingBlock) => void;
  onActiveToolCall?: (toolCall: BloomActiveToolCall | null) => void;
  onBloomStreamingBlock?: (block: BloomStreamingBlock) => void;
  onStreamingBlock?: (block: AskBloomBlock) => void;
  onResearchProgress?: (payload: unknown) => void;
  onTaskPlan?: (payload: BloomTaskPlan) => void;
  onTaskProgress?: (payload: BloomTaskStatusUpdate) => void;
  onTaskComplete?: (payload: BloomTaskCompletionSummary) => void;
  onFollowUpChips?: (chips: string[]) => void;
  onResourceFormDetected?: (form: PendingResourceForm) => void;
  onModeOverride?: (mode: BloomMode) => void;
  onConversationResolved?: (conversationId: string) => void;
}

export interface AskBloomSendMessageOverrides {
  conversationId?: string | null;
  resourceFocus?: ResourceFocus | null;
  assistantMessageId?: string | null;
  /** Defaults to "standard". */
  mode?: BloomMode;
  /** "auto" (the default) lets bloom-assist pick the model. */
  modelPreference?: BloomModelPreference;
  /**
   * Page context sent to bloom-assist. When omitted it is derived from the
   * resource focus (Ask Bloom drawer behaviour).
   */
  pageContext?: BloomPageContextPayload | null;
  timezone?: string;
  attachments?: BloomJsonArray;
}

interface StreamRequest {
  conversationId: string | null;
  message: string;
  mode: BloomMode;
}

interface ParsedSseEvent {
  event: string;
  data: Json;
}

interface ParseResult {
  event: ParsedSseEvent | null;
  error: string | null;
}

type ResearchStepSsePayload = {
  stepNumber: number;
  totalSteps: number;
  label: string;
  status: Exclude<BloomResearchStepState, "pending">;
  toolName: string;
};

type TerminalEvent = "done" | "error" | null;

const ASK_BLOOM_UNAVAILABLE_MESSAGE =
  "Ask Bloom is temporarily unavailable. The Bloom Assist edge function may be down, undeployed, or failing to start.";

/**
 * Error copy per store, so each surface keeps the wording it already shows.
 */
const STORE_COPY: Record<
  AskBloomMessageStore,
  {
    requestFailed: (status: number) => string;
    noStream: string;
    streamFailed: string;
    missingSession: string;
  }
> = {
  local: {
    requestFailed: (status) =>
      `Ask Bloom request failed with status ${status}.`,
    noStream: "Ask Bloom did not return a readable stream.",
    streamFailed: "Ask Bloom could not complete that request.",
    missingSession: "Sign in to message Ask Bloom.",
  },
  bloomMessageCache: {
    requestFailed: (status) =>
      `Bloom Assist request failed with status ${status}.`,
    noStream: "Bloom Assist did not return a readable stream.",
    streamFailed: "Bloom Assist stream failed.",
    missingSession: "Sign in to message Bloom.",
  },
};

const getTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const isJsonValue = (value: unknown): value is Json => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every(
    (entry) => entry === undefined || isJsonValue(entry),
  );
};

/** Trimmed non-empty string, or null. */
const readOptionalString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readBloomMode = (value: unknown): BloomMode | null => {
  const mode = readOptionalString(value);
  return mode && isBloomMode(mode) ? mode : null;
};

const parseSseMessage = (rawMessage: string): ParseResult => {
  const lines = rawMessage.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return { event: null, error: null };
  }

  const dataText = dataLines.join("\n");
  if (!dataText || dataText === "[DONE]") {
    return { event: null, error: null };
  }

  try {
    const parsed: unknown = JSON.parse(dataText);
    if (!isJsonValue(parsed)) {
      return { event: null, error: "SSE data was not JSON-compatible." };
    }
    return { event: { event, data: parsed }, error: null };
  } catch {
    return { event: null, error: "SSE data was malformed JSON." };
  }
};

const readResponseErrorMessage = async (
  response: Response,
  store: AskBloomMessageStore,
) => {
  if (
    store === "local" &&
    (response.status === 502 ||
      response.status === 503 ||
      response.status === 504)
  ) {
    return `${ASK_BLOOM_UNAVAILABLE_MESSAGE} Received ${response.status} from the service.`;
  }

  const text = await response.text();
  if (!text.trim()) {
    return STORE_COPY[store].requestFailed(response.status);
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed)) {
      return (
        readOptionalString(parsed.error) ??
        readOptionalString(parsed.message) ??
        text
      );
    }
  } catch {
    return text;
  }

  return text;
};

const toRequestErrorMessage = (
  error: unknown,
  store: AskBloomMessageStore,
) => {
  if (store === "bloomMessageCache") {
    return error instanceof Error ? error.message : STREAM_INTERRUPTED_MESSAGE;
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "Ask Bloom request was cancelled.";
    }

    if (error instanceof TypeError) {
      return `${ASK_BLOOM_UNAVAILABLE_MESSAGE} The browser could not complete the network request.`;
    }

    return error.message;
  }

  return STORE_COPY.local.streamFailed;
};

const readSseErrorMessage = (data: Json, store: AskBloomMessageStore) => {
  if (isRecord(data)) {
    return readOptionalString(data.message) ?? STORE_COPY[store].streamFailed;
  }

  return readOptionalString(data) ?? STORE_COPY[store].streamFailed;
};

/**
 * Reads streaming token text WITHOUT trimming. The SSE token payload carries
 * the leading/trailing spaces that ARE the inter-word whitespace (e.g.
 * " customer"). Routing token text through the trimming `readString` collapses
 * adjacent tokens together ("Certainly!Tohelp...").
 */
const readRawTokenText = (data: unknown): string => {
  if (typeof data === "string") {
    return data;
  }

  if (isRecord(data) && typeof data.text === "string") {
    return data.text;
  }

  return "";
};

const toJsonPayload = (value: unknown): Json => {
  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value) || isRecord(value)) {
    return value as Json;
  }

  return null;
};

const toToolCallStatus = (value: unknown): AskBloomToolCallStatus => {
  const normalized = readString(value).toLowerCase();
  switch (normalized) {
    case "executing":
    case "running":
      return "running";
    case "complete":
    case "completed":
      return "complete";
    case "failed":
    case "error":
      return "error";
    case "pending":
    default:
      return "pending";
  }
};

type BloomToolResultStatus = NonNullable<
  Extract<BloomContentBlock, { type: "tool_result" }>["status"]
>;

const formatToolLabel = (toolName: string) =>
  toolName
    .replace(/^(query|get|generate|create|update)_/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const describeToolCall = (toolName: string): string => {
  if (toolName.startsWith("query_")) {
    return `Querying ${formatToolLabel(toolName)}...`;
  }

  if (toolName.startsWith("get_")) {
    return `Fetching ${formatToolLabel(toolName)}...`;
  }

  if (toolName.startsWith("generate_")) {
    return `Generating ${formatToolLabel(toolName)}...`;
  }

  return `Running ${formatToolLabel(toolName) || "tool"}...`;
};

const toBloomToolResultStatus = (value: unknown): BloomToolResultStatus => {
  switch (readString(value).toLowerCase()) {
    case "error":
      return "error";
    case "failed":
      return "failed";
    case "pending":
      return "pending";
    case "executing":
      return "executing";
    case "completed":
      return "completed";
    case "success":
    default:
      return "success";
  }
};

const appendToolCall = (
  current: AskBloomToolCall[],
  next: AskBloomToolCall,
): AskBloomToolCall[] => {
  const existingIndex = current.findIndex(
    (toolCall) => toolCall.id === next.id,
  );
  if (existingIndex === -1) {
    return [...current, next];
  }

  return current.map((toolCall, index) =>
    index === existingIndex ? { ...toolCall, ...next } : toolCall,
  );
};

const buildAssistantBlocks = (
  content: string,
  blocks: AskBloomBlock[],
): AskBloomBlock[] => {
  const normalizedContent = content.trim();
  const normalizedBlocks = blocks.filter(
    (block) => block.type !== "text" || block.content.trim().length > 0,
  );

  if (
    normalizedContent &&
    normalizedBlocks.every((block) => block.type !== "text")
  ) {
    return [{ type: "text", content, data: {} }, ...normalizedBlocks];
  }

  return normalizedBlocks;
};

const isPageEntityType = (
  value: ResourceFocus["resourceType"] | null,
): value is "customer" | "product" | "campaign" | "segment" =>
  value === "customer" ||
  value === "product" ||
  value === "campaign" ||
  value === "segment";

const resolvePageContext = (resourceFocus: ResourceFocus | null) => {
  const pathname =
    resourceFocus?.sourceRoute ||
    (typeof window !== "undefined" ? window.location.pathname : "/");
  const entityType = isPageEntityType(resourceFocus?.resourceType ?? null)
    ? resourceFocus?.resourceType
    : null;

  return {
    pathname,
    pageCategory: pathname.startsWith("/bloom") ? "bloom" : "other",
    entityType,
    entityId: entityType ? (resourceFocus?.resourceId ?? null) : null,
    pageName: "Ask Bloom",
    availableActions: [],
    suggestions: [],
  };
};

type ToolResultContentBlock = Extract<
  BloomContentBlock,
  { type: "tool_result" }
>;

const isToolResultContentBlock = (
  block: BloomContentBlock,
): block is ToolResultContentBlock => block.type === "tool_result";

const toolResultBlocksFromStreamingBlocks = (
  streamingBlocks: BloomStreamingBlock[],
): ToolResultContentBlock[] =>
  streamingBlocks
    .map((block) => contentBlockFromStreamingBlock(block))
    .filter(isToolResultContentBlock);

const analyzeAssistantStreamingState = (
  assistantContent: string,
  streamingBlocks: BloomStreamingBlock[],
) => {
  const toolResultBlocks = toolResultBlocksFromStreamingBlocks(streamingBlocks);
  return {
    toolResultBlocks,
    gateDecision: analyzeStreamingContent(assistantContent, {
      hasToolResultBlocks: toolResultBlocks.length > 0,
      toolResultIdentifiers:
        extractIdentifiersFromToolResults(toolResultBlocks),
      isAfterToolResult: toolResultBlocks.length > 0,
    }),
  };
};

const normalizeTextPlanEntityType = (
  value: string | null,
): BloomTaskPlanEntityType | null => {
  switch (value?.trim().toLowerCase()) {
    case "customer":
      return "customer";
    case "product":
      return "product";
    case "campaign":
      return "campaign";
    case "segment":
      return "segment";
    case "tag":
      return "tag";
    default:
      return null;
  }
};

const inferTextPlanAction = (actionText: string): BloomTaskPlanAction => {
  const normalized = actionText.trim().toLowerCase();

  if (/consent|opt[ -]?in|opt[ -]?out|unsubscribe/.test(normalized)) {
    return "consent_change";
  }

  if (/^send\b|\blaunch\b|\bblast\b/.test(normalized)) {
    return "send";
  }

  if (/^schedule\b|\bqueue\b/.test(normalized)) {
    return "schedule";
  }

  if (
    /^assign\b/.test(normalized) ||
    ((/^add\b/.test(normalized) || /^remove\b/.test(normalized)) &&
      /segment|audience|list|group/.test(normalized))
  ) {
    return "assign";
  }

  if (/\btag\b|\blabel\b/.test(normalized)) {
    return "tag";
  }

  if (/^delete\b|^remove\b|\barchive\b|\bpurge\b/.test(normalized)) {
    return "delete";
  }

  if (/^create\b|^add\b|\bclone\b|\bduplicate\b/.test(normalized)) {
    return "create";
  }

  return "update";
};

const inferTextPlanEntityType = (
  actionText: string,
  params: Record<string, string>,
  resourceType: string,
  action: BloomTaskPlanAction,
): BloomTaskPlanEntityType => {
  if (action === "send" || action === "schedule") {
    return "campaign";
  }

  if (action === "consent_change") {
    return "customer";
  }

  const normalizedText = `${actionText} ${Object.keys(params).join(" ")}`
    .trim()
    .toLowerCase();
  const normalizedResourceType = normalizeTextPlanEntityType(resourceType);

  if (/customer|contact|subscriber|buyer|shopper/.test(normalizedText)) {
    return "customer";
  }

  if (/product|sku|item|inventory|catalog/.test(normalizedText)) {
    return "product";
  }

  if (/campaign|newsletter|email|sms|promotion|blast/.test(normalizedText)) {
    return "campaign";
  }

  if (/segment|audience|list|group/.test(normalizedText)) {
    return "segment";
  }

  if (/tag|label/.test(normalizedText)) {
    return action === "tag" ? "customer" : "tag";
  }

  if (normalizedResourceType) {
    return normalizedResourceType;
  }

  if (action === "tag") {
    return "customer";
  }

  return "customer";
};

const inferTextPlanRiskLevel = (
  action: BloomTaskPlanAction,
): BloomTaskRiskLevel => {
  switch (action) {
    case "delete":
    case "send":
    case "schedule":
    case "assign":
    case "tag":
    case "consent_change":
      return "medium";
    case "create":
    case "update":
    default:
      return "low";
  }
};

const coerceTextPlanValue = (value: string): Json => {
  const trimmed = value.trim();
  if (/^(true|false)$/i.test(trimmed)) {
    return trimmed.toLowerCase() === "true";
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const numericValue = Number(trimmed);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return trimmed;
};

const normalizeTextPlanParams = (
  params: Record<string, string>,
): BloomTaskJsonObject => {
  const normalized: BloomTaskJsonObject = {};

  for (const [key, value] of Object.entries(params)) {
    const normalizedKey = labelToFieldName(key);
    const trimmedValue = value.trim();
    if (!normalizedKey || !trimmedValue) {
      continue;
    }

    normalized[normalizedKey] = coerceTextPlanValue(trimmedValue);
  }

  return normalized;
};

const inferTextPlanToolName = (
  actionText: string,
  action: BloomTaskPlanAction,
  entityType: BloomTaskPlanEntityType,
  params: BloomTaskJsonObject,
): string => {
  const normalizedActionText = actionText.trim().toLowerCase();

  if (action === "send") {
    return "send_campaign";
  }

  if (action === "schedule") {
    return "schedule_campaign";
  }

  if (action === "assign") {
    return "assign_segment";
  }

  if (action === "tag") {
    return entityType === "tag" ? "create_tag" : "bulk_tag_customers";
  }

  if (action === "consent_change") {
    return "manage_consent";
  }

  if (action === "delete") {
    return entityType === "customer"
      ? "delete_customer"
      : `update_${entityType}`;
  }

  if (action === "create") {
    return entityType === "tag" ? "create_tag" : `create_${entityType}`;
  }

  if (action === "update" && entityType === "campaign") {
    if (
      /pause\b/.test(normalizedActionText) ||
      /resume\b/.test(normalizedActionText)
    ) {
      return "pause_resume_campaign";
    }
  }

  if (
    action === "update" &&
    entityType === "product" &&
    params.status !== undefined &&
    Object.keys(params).length === 1
  ) {
    return "toggle_product_status";
  }

  return entityType === "tag" ? "create_tag" : `update_${entityType}`;
};

const buildTextPlanToolParams = (
  rawParams: Record<string, string>,
  actionText: string,
  entityType: BloomTaskPlanEntityType,
  toolName: string,
): BloomTaskJsonObject => {
  const normalizedParams = normalizeTextPlanParams(rawParams);

  // send_campaign is passed through untouched: a missing send_mode is never
  // defaulted to "now" (or to a schedule). textPlanValidationAnnotations
  // blocks the task and asks the person when to send instead.

  if (toolName === "schedule_campaign") {
    const scheduledAt =
      normalizedParams.scheduled_at ??
      normalizedParams.send_at ??
      normalizedParams.date ??
      normalizedParams.time;
    return scheduledAt === undefined
      ? normalizedParams
      : { ...normalizedParams, scheduled_at: scheduledAt };
  }

  if (toolName === "assign_segment") {
    return {
      ...normalizedParams,
      action:
        normalizedParams.action ??
        (/^remove\b/i.test(actionText) ? "remove" : "add"),
    };
  }

  if (toolName === "manage_consent") {
    return {
      ...normalizedParams,
      action:
        normalizedParams.action ??
        (/opt[ -]?out|unsubscribe/i.test(actionText) ? "opt_out" : "opt_in"),
    };
  }

  if (toolName === "pause_resume_campaign") {
    return {
      ...normalizedParams,
      action:
        normalizedParams.action ??
        (/pause\b/i.test(actionText) ? "pause" : "resume"),
    };
  }

  if (toolName === "toggle_product_status") {
    return {
      ...normalizedParams,
      status: normalizedParams.status ?? "archived",
    };
  }

  if (toolName === "delete_customer") {
    return {
      ...normalizedParams,
      deletion_mode: normalizedParams.deletion_mode ?? "soft_delete",
    };
  }

  if (toolName.startsWith("update_")) {
    const entityIdKey = `${entityType}_id`;
    const changes: BloomTaskJsonObject = {};
    for (const [key, value] of Object.entries(normalizedParams)) {
      if (key !== entityIdKey && key !== "id") {
        changes[key] = value;
      }
    }

    return {
      ...(normalizedParams[entityIdKey] !== undefined
        ? { [entityIdKey]: normalizedParams[entityIdKey] }
        : normalizedParams.id !== undefined
          ? { [entityIdKey]: normalizedParams.id }
          : {}),
      changes,
    };
  }

  return normalizedParams;
};

const readTextPlanParam = (
  params: BloomTaskJsonObject,
  key: string,
): string | null => {
  const value = params[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
};

const titleCase = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const inferTextPlanEntityName = (
  actionText: string,
  params: BloomTaskJsonObject,
  entityType: BloomTaskPlanEntityType,
): string => {
  const firstName = readTextPlanParam(params, "first_name");
  const lastName = readTextPlanParam(params, "last_name");
  if (firstName) {
    return `${firstName}${lastName ? ` ${lastName}` : ""}`.trim();
  }

  for (const key of [
    "name",
    "title",
    "subject",
    "new_name",
    "tag_name",
    "email",
  ]) {
    const value = readTextPlanParam(params, key);
    if (value) {
      return value;
    }
  }

  const strippedAction = actionText
    .replace(
      /^(create|update|delete|send|schedule|assign|remove|add|set|tag|pause|resume|toggle)\s+/i,
      "",
    )
    .replace(/^(?:a|an|the)\s+/i, "")
    .replace(/\s*:\s*$/, "")
    .trim();

  return strippedAction ? titleCase(strippedAction) : titleCase(entityType);
};

const inferTextPlanDescription = (
  actionText: string,
  action: BloomTaskPlanAction,
  entityName: string,
): string => {
  const normalized = actionText.replace(/\s+/g, " ").trim();
  return normalized
    ? titleCase(normalized)
    : `${titleCase(action)} ${entityName}`;
};

export const MISSING_SEND_MODE_MESSAGE =
  "Bloom didn't say when to send this campaign. Tell Bloom to send it now or give a date and time to schedule it.";

/**
 * Blocking checks for a plan intercepted from Bloom's text. A send whose
 * timing Bloom left out must stop and ask the person — it is never sent now
 * or scheduled by default.
 */
const textPlanValidationAnnotations = (
  toolName: string,
  toolParams: BloomTaskJsonObject,
): BloomValidationAnnotation[] => {
  if (toolName === "send_campaign" && readTextPlanParam(toolParams, "send_mode") === null) {
    return [
      {
        type: "error",
        message: MISSING_SEND_MODE_MESSAGE,
        step: "send_mode",
      },
    ];
  }

  return [];
};

export const buildTaskPlanFromDetectedTextPlan = (
  plan: DetectedTextPlan,
  originatingMessageId: string,
): BloomTaskPlan => {
  const createdAt = new Date().toISOString();
  const tasks = plan.steps.map((step, index) => {
    const action = inferTextPlanAction(step.action);
    const entityType = inferTextPlanEntityType(
      step.action,
      step.params,
      plan.resourceType,
      action,
    );
    const normalizedParams = normalizeTextPlanParams(step.params);
    const toolName = inferTextPlanToolName(
      step.action,
      action,
      entityType,
      normalizedParams,
    );
    const toolParams = buildTextPlanToolParams(
      step.params,
      step.action,
      entityType,
      toolName,
    );
    const entityName = inferTextPlanEntityName(
      step.action,
      toolParams,
      entityType,
    );
    const riskLevel = inferTextPlanRiskLevel(action);

    return {
      taskId: `text-plan-task-${index + 1}`,
      action,
      entityType,
      entityId: null,
      entityName,
      toolName,
      toolParams,
      description: inferTextPlanDescription(step.action, action, entityName),
      fieldChanges: [],
      riskLevel,
      dependsOn: [],
      editableFields: [],
      editableFieldMetadata: [],
      validationAnnotations: textPlanValidationAnnotations(toolName, toolParams),
      notice: null,
      status: "pending" as const,
      errorMessage: null,
    };
  });

  const riskLevel = tasks.some((task) => task.riskLevel === "medium")
    ? "medium"
    : "low";

  return {
    planId: `text-plan-${crypto.randomUUID()}`,
    originatingMessageId,
    summary: plan.title,
    riskLevel,
    compact: false,
    compactConfirmation: null,
    tasks,
    createdAt,
  };
};

const sanitizeFinalAssistantContent = (
  assistantContent: string,
  streamingBlocks: BloomStreamingBlock[],
) => {
  const { gateDecision, toolResultBlocks } = analyzeAssistantStreamingState(
    assistantContent,
    streamingBlocks,
  );

  let finalContent = assistantContent;

  if (
    gateDecision.action === "gate_json" ||
    (gateDecision.action === "suppress" &&
      (gateDecision.reason === "tool_error_json" ||
        gateDecision.reason === "tool_json_payload"))
  ) {
    finalContent = "";
  } else if (
    gateDecision.action === "intercept_form" ||
    gateDecision.action === "intercept_plan"
  ) {
    finalContent = extractPreFormText(finalContent);
  }

  finalContent = stripToolJsonFromText(finalContent);

  if (toolResultBlocks.length > 0) {
    finalContent = stripRedundantContent(finalContent, toolResultBlocks);
  }

  return finalContent.trim();
};

const STEP_LINE_PATTERN =
  /^\s*(?:(\d{1,2})[.)]|step\s+(\d{1,2})\s*[:.)-])\s*(.+?)\s*$/gim;
const MAX_RESEARCH_STEP_LABEL_LENGTH = 180;

const emptyResearchPlan = (): BloomResearchPlan => ({
  totalSteps: 0,
  stepLabels: [],
});

const normalizeResearchStepLabel = (value: string) => {
  const label = value.replace(/\s+/g, " ").trim();
  if (label.length <= MAX_RESEARCH_STEP_LABEL_LENGTH) {
    return label;
  }

  return `${label.slice(0, MAX_RESEARCH_STEP_LABEL_LENGTH - 3).trim()}...`;
};

const parseResearchPlanFromThinking = (content: string): BloomResearchPlan => {
  const labelsByStepNumber = new Map<number, string>();

  for (const match of content.matchAll(STEP_LINE_PATTERN)) {
    const stepNumber = Number(match[1] ?? match[2]);
    const label = normalizeResearchStepLabel(match[3] ?? "");
    if (!Number.isInteger(stepNumber) || stepNumber <= 0 || !label) {
      continue;
    }
    labelsByStepNumber.set(stepNumber, label);
  }

  if (labelsByStepNumber.size === 0) {
    return emptyResearchPlan();
  }

  const totalSteps = Math.max(...labelsByStepNumber.keys());
  return {
    totalSteps,
    stepLabels: Array.from(
      { length: totalSteps },
      (_item, index) => labelsByStepNumber.get(index + 1) ?? "",
    ),
  };
};

const isResearchStepState = (
  value: unknown,
): value is ResearchStepSsePayload["status"] =>
  value === "executing" || value === "completed" || value === "failed";

const readResearchStep = (data: Json): ResearchStepSsePayload | null => {
  if (!isRecord(data)) {
    return null;
  }

  const stepNumber =
    readNumber(data.step_number) ?? readNumber(data.stepNumber);
  const totalSteps =
    readNumber(data.total_steps) ?? readNumber(data.totalSteps);
  const label = readOptionalString(data.label);
  const toolName =
    readOptionalString(data.tool_name) ?? readOptionalString(data.toolName);
  const status = readOptionalString(data.status);

  if (
    stepNumber === null ||
    stepNumber <= 0 ||
    !Number.isInteger(stepNumber) ||
    totalSteps === null ||
    totalSteps < 0 ||
    !label ||
    !toolName ||
    !isResearchStepState(status)
  ) {
    return null;
  }

  return {
    stepNumber,
    totalSteps,
    label: normalizeResearchStepLabel(label),
    status,
    toolName,
  };
};

const readToolStart = (data: Json): BloomActiveToolCall | null => {
  if (!isRecord(data)) {
    return null;
  }

  const toolName =
    readOptionalString(data.tool) ?? readOptionalString(data.tool_name);
  if (!toolName) {
    return null;
  }

  return {
    toolName,
    description:
      readOptionalString(data.description) ?? describeToolCall(toolName),
  };
};

const readToolResult = (
  data: Json,
): Omit<BloomStreamingBlock, "id" | "createdAt"> | null => {
  if (!isRecord(data)) {
    return null;
  }

  const blockType =
    readOptionalString(data.block_type) ?? readOptionalString(data.blockType);
  const payload = data.result;
  if (!blockType || !isJsonValue(payload)) {
    return null;
  }

  return {
    toolName: readOptionalString(data.tool) ?? readOptionalString(data.tool_name),
    blockType,
    payload,
  };
};

const readLatencyMetrics = (
  source: Record<string, unknown>,
): BloomServerLatencyMetrics | null => {
  if (!isRecord(source.latency_metrics)) {
    return null;
  }

  const metrics = source.latency_metrics;
  return {
    server_ttft_ms: readNumber(metrics.server_ttft_ms),
    server_ttfb_ms: readNumber(metrics.server_ttfb_ms),
    server_total_ms: readNumber(metrics.server_total_ms),
    context_build_ms: readNumber(metrics.context_build_ms),
    llm_latency_ms: readNumber(metrics.llm_latency_ms),
  };
};

const readCacheStats = (
  source: Record<string, unknown>,
): BloomCacheAuditStats | null => {
  if (!isRecord(source.cache_stats)) {
    return null;
  }

  const stats = source.cache_stats;
  const hits = readNumber(stats.hits);
  const misses = readNumber(stats.misses);
  const invalidations = readNumber(stats.invalidations);

  if (hits === null || misses === null || invalidations === null) {
    return null;
  }

  return { hits, misses, invalidations };
};

const latencyDelta = (startAt: number | null, endAt: number | null) =>
  startAt === null || endAt === null ? null : Math.max(0, endAt - startAt);

const readDoneMetadata = (
  source: Record<string, unknown>,
): BloomStreamingDoneMetadata => {
  const followUpChips = Array.isArray(source.follow_up_chips)
    ? source.follow_up_chips.filter(isJsonValue)
    : [];

  return {
    conversationId:
      readOptionalString(source.conversation_id) ??
      readOptionalString(source.conversationId),
    tokensInput:
      readNumber(source.tokens_input) ?? readNumber(source.tokensInput),
    tokensOutput:
      readNumber(source.tokens_output) ?? readNumber(source.tokensOutput),
    model: readOptionalString(source.model),
    title: readOptionalString(source.title),
    followUpChips,
    modeOverride:
      readBloomMode(source.mode_override) ?? readBloomMode(source.modeOverride),
    latencyMetrics: readLatencyMetrics(source),
    cacheStats: readCacheStats(source),
  };
};

type BloomMessagesCache = InfiniteData<BloomMessagesPage, string | null>;

const appendMessage = (
  current: BloomMessagesCache | undefined,
  message: BloomMessage,
): BloomMessagesCache => {
  if (!current || current.pages.length === 0) {
    return {
      pages: [{ messages: [message], nextCursor: null }],
      pageParams: [null],
    };
  }

  const [recentPage, ...olderPages] = current.pages;
  return {
    ...current,
    pages: [
      {
        ...recentPage,
        messages: [...recentPage.messages, message],
      },
      ...olderPages,
    ],
  };
};

const upsertMessage = (
  current: BloomMessagesCache | undefined,
  message: BloomMessage,
): BloomMessagesCache => {
  if (!current || current.pages.length === 0) {
    return appendMessage(current, message);
  }

  const exists = current.pages.some((page) =>
    page.messages.some((candidate) => candidate.id === message.id),
  );

  if (!exists) {
    return appendMessage(current, message);
  }

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      messages: page.messages.map((candidate) =>
        candidate.id === message.id ? message : candidate,
      ),
    })),
  };
};

const patchMessage = (
  current: BloomMessagesCache | undefined,
  messageId: string,
  patch: Partial<BloomMessage>,
): BloomMessagesCache | undefined => {
  if (!current) {
    return current;
  }

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.id === messageId ? { ...message, ...patch } : message,
      ),
    })),
  };
};

const createLiveTaskPlanMessage = (
  conversationId: string,
  mode: BloomMode,
  plan: BloomTaskPlan,
): BloomMessage => ({
  id: `live-task-plan-${plan.planId}`,
  conversationId,
  role: "assistant",
  text: plan.summary || "I prepared a task plan for your approval.",
  thinkingContent: null,
  blockData: taskPlanBlockData(plan),
  mode,
  model: null,
  tokensInput: null,
  tokensOutput: null,
  attachments: [],
  followUpChips: [],
  isBookmarked: false,
  isCompacted: false,
  metadata: {},
  createdAt: plan.createdAt,
});

const createOptimisticUserMessage = (
  conversationId: string,
  mode: BloomMode,
  text: string,
  attachments: BloomJsonArray,
  createdAt: string,
): BloomMessage => ({
  id: `optimistic-${crypto.randomUUID()}`,
  conversationId,
  role: "user",
  text,
  thinkingContent: null,
  blockData: {},
  mode,
  model: null,
  tokensInput: null,
  tokensOutput: null,
  attachments,
  followUpChips: [],
  isBookmarked: false,
  isCompacted: false,
  metadata: {},
  createdAt,
});

const createStreamingAssistantMessage = (
  conversationId: string,
  mode: BloomMode,
  id: string,
  createdAt: string,
): BloomMessage => ({
  id,
  conversationId,
  role: "assistant",
  text: "",
  thinkingContent: null,
  blockData: {},
  mode,
  model: null,
  tokensInput: null,
  tokensOutput: null,
  attachments: [],
  followUpChips: [],
  isBookmarked: false,
  isCompacted: false,
  metadata: { render_key: id },
  createdAt,
});

const messageHasBlocks = (message: BloomMessage) => {
  const blockData = message.blockData;
  return isRecord(blockData) && Array.isArray(blockData.blocks)
    ? blockData.blocks.length > 0
    : false;
};

const renderKeyForMessage = (message: BloomMessage) => {
  const renderKey = message.metadata.render_key;
  return typeof renderKey === "string" && renderKey.trim()
    ? renderKey
    : message.id;
};

const mergePersistedPageWithStreamingState = (
  current: BloomMessagesCache | undefined,
  persistedPage: BloomMessagesPage,
  placeholderId: string | null,
): BloomMessagesPage => {
  if (!current || !placeholderId) {
    return persistedPage;
  }

  const currentMessages = current.pages.flatMap((page) => page.messages);
  const placeholder = currentMessages.find(
    (message) => message.id === placeholderId && message.role === "assistant",
  );

  if (!placeholder) {
    return persistedPage;
  }

  const persistedMessages = [...persistedPage.messages];
  const persistedAssistantIndex = [...persistedMessages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) => message.role === "assistant")?.index;

  if (persistedAssistantIndex === undefined) {
    return persistedPage;
  }

  const persistedAssistant = persistedMessages[persistedAssistantIndex];
  persistedMessages[persistedAssistantIndex] = {
    ...persistedAssistant,
    blockData: messageHasBlocks(placeholder)
      ? placeholder.blockData
      : persistedAssistant.blockData,
    thinkingContent:
      placeholder.thinkingContent ?? persistedAssistant.thinkingContent,
    metadata: {
      ...persistedAssistant.metadata,
      render_key: renderKeyForMessage(placeholder),
    },
  };

  return {
    ...persistedPage,
    messages: persistedMessages,
  };
};

const createStreamingBlockData = (blocks: BloomStreamingBlock[]): Json => {
  if (blocks.length === 0) {
    return {};
  }

  return {
    blocks: blocks.map((block) => ({
      id: block.id,
      block_type: block.blockType,
      payload: block.payload,
    })),
  };
};

export function useAskBloomStreaming(options: UseAskBloomStreamingOptions) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const store: AskBloomMessageStore = options.messageStore ?? "local";
  const tenantId = options.tenantId ?? null;
  const userId = session?.user.id ?? null;
  const accessToken = session?.access_token ?? null;
  const conversationsQueryBaseKey = React.useMemo(
    () => bloomConversationsQueryBaseKey(tenantId),
    [tenantId],
  );

  const [connectionState, setConnectionStateValue] =
    React.useState<BloomStreamingConnectionState>("idle");
  const [streamingContent, setStreamingContent] = React.useState("");
  const [streamingThinking, setStreamingThinking] = React.useState("");
  const [activeToolCall, setActiveToolCall] =
    React.useState<BloomActiveToolCall | null>(null);
  const [streamError, setStreamError] = React.useState<string | null>(null);
  const [streamingBlocks, setStreamingBlocks] = React.useState<
    BloomStreamingBlock[]
  >([]);
  const [pendingTaskPlan, setPendingTaskPlan] =
    React.useState<BloomTaskPlan | null>(null);
  const [researchPlan, setResearchPlan] = React.useState<BloomResearchPlan>(
    () => emptyResearchPlan(),
  );
  const [researchSteps, setResearchSteps] = React.useState<
    Map<number, BloomResearchStepStatus>
  >(() => new Map());
  const [researchConversationId, setResearchConversationId] = React.useState<
    string | null
  >(null);
  const [lastLatencyMetrics, setLastLatencyMetrics] =
    React.useState<BloomStreamingLatencyMetrics | null>(null);
  const [lastDoneMetadata, setLastDoneMetadata] =
    React.useState<BloomStreamingDoneMetadata | null>(null);

  const optionsRef = React.useRef(options);
  const connectionStateRef = React.useRef<BloomStreamingConnectionState>("idle");
  const tokenBufferRef = React.useRef("");
  const tokenBufferCountRef = React.useRef(0);
  const streamingContentRef = React.useRef("");
  const streamingThinkingRef = React.useRef("");
  const streamingBlocksRef = React.useRef<BloomStreamingBlock[]>([]);
  const researchPlanRef = React.useRef<BloomResearchPlan>(emptyResearchPlan());
  const researchStepsRef = React.useRef<Map<number, BloomResearchStepStatus>>(
    new Map(),
  );
  // window.setInterval returns a DOM interval id (number).
  const flushIntervalRef = React.useRef<number | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const readerRef =
    React.useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const activeStreamIdRef = React.useRef<string | null>(null);
  const activeConversationIdRef = React.useRef<string | null>(null);
  const activePlaceholderMessageIdRef = React.useRef<string | null>(null);
  const cancelRequestedRef = React.useRef(false);
  const consecutiveParseErrorsRef = React.useRef(0);
  const streamStartTimeRef = React.useRef<number | null>(null);
  const firstTokenTimeRef = React.useRef<number | null>(null);
  const firstBlockTimeRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const setConnectionState = React.useCallback(
    (next: BloomStreamingConnectionState) => {
      connectionStateRef.current = next;
      setConnectionStateValue(next);
    },
    [],
  );

  const patchConversationLists = React.useCallback(
    (updater: (conversation: BloomConversation) => BloomConversation) => {
      queryClient
        .getQueriesData<BloomConversation[]>({
          queryKey: conversationsQueryBaseKey,
        })
        .forEach(([queryKey, conversations]) => {
          if (!conversations) {
            return;
          }

          queryClient.setQueryData<BloomConversation[]>(
            queryKey,
            sortBloomConversations(conversations.map(updater)),
          );
        });
    },
    [conversationsQueryBaseKey, queryClient],
  );

  const flushTextBuffer = React.useCallback(() => {
    const bufferedText = tokenBufferRef.current;
    if (!bufferedText) {
      return;
    }

    tokenBufferRef.current = "";
    tokenBufferCountRef.current = 0;
    streamingContentRef.current += bufferedText;
    setStreamingContent(streamingContentRef.current);
  }, []);

  const clearFlushInterval = React.useCallback(() => {
    if (flushIntervalRef.current !== null) {
      window.clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
  }, []);

  const startFlushInterval = React.useCallback(() => {
    clearFlushInterval();
    flushIntervalRef.current = window.setInterval(
      flushTextBuffer,
      TOKEN_FLUSH_INTERVAL_MS,
    );
  }, [clearFlushInterval, flushTextBuffer]);

  const resetStreamState = React.useCallback(() => {
    tokenBufferRef.current = "";
    tokenBufferCountRef.current = 0;
    streamingContentRef.current = "";
    streamingThinkingRef.current = "";
    streamingBlocksRef.current = [];
    researchPlanRef.current = emptyResearchPlan();
    researchStepsRef.current = new Map();
    consecutiveParseErrorsRef.current = 0;
    streamStartTimeRef.current = null;
    firstTokenTimeRef.current = null;
    firstBlockTimeRef.current = null;
    setStreamingContent("");
    setStreamingThinking("");
    setStreamingBlocks([]);
    setResearchPlan(emptyResearchPlan());
    setResearchSteps(new Map());
    setResearchConversationId(null);
    setPendingTaskPlan(null);
    setActiveToolCall(null);
    setStreamError(null);
    setLastLatencyMetrics(null);
    setLastDoneMetadata(null);
  }, []);

  const dismissPendingTaskPlan = React.useCallback(() => {
    setPendingTaskPlan(null);
  }, []);

  const logClientLatencyMetrics = React.useCallback(
    async (
      request: StreamRequest,
      doneMetadata: BloomStreamingDoneMetadata,
      latencyMetrics: BloomStreamingLatencyMetrics,
    ) => {
      const resolvedConversationId =
        doneMetadata.conversationId ?? request.conversationId;

      if (!tenantId || !userId || !resolvedConversationId) {
        return;
      }

      const { error } = await bloomSupabase.from("bloom_audit_log").insert({
        tenant_id: tenantId,
        user_id: userId,
        conversation_id: resolvedConversationId,
        event_type: "response",
        event_data: {
          metric_source: "client",
          stage: "m36a_client_stream_metrics",
          mode: request.mode,
          model: doneMetadata.model,
          mode_override: doneMetadata.modeOverride,
          latency_metrics: {
            client_ttft_ms: latencyMetrics.clientTtftMs,
            client_ttfb_ms: latencyMetrics.clientTtfbMs,
            client_total_ms: latencyMetrics.clientTotalMs,
            server_ttft_ms: doneMetadata.latencyMetrics?.server_ttft_ms ?? null,
            server_ttfb_ms: doneMetadata.latencyMetrics?.server_ttfb_ms ?? null,
            server_total_ms:
              doneMetadata.latencyMetrics?.server_total_ms ?? null,
            context_build_ms:
              doneMetadata.latencyMetrics?.context_build_ms ?? null,
            llm_latency_ms: doneMetadata.latencyMetrics?.llm_latency_ms ?? null,
          },
          cache_stats: doneMetadata.cacheStats,
        },
        model_used: doneMetadata.model,
        latency_ms: latencyMetrics.clientTotalMs,
      });

      if (error) {
        throw error;
      }
    },
    [tenantId, userId],
  );

  const mergeResearchPlan = React.useCallback((nextPlan: BloomResearchPlan) => {
    if (nextPlan.totalSteps <= 0) {
      return;
    }

    const currentPlan = researchPlanRef.current;
    const totalSteps = Math.max(currentPlan.totalSteps, nextPlan.totalSteps);
    const stepLabels = Array.from({ length: totalSteps }, (_item, index) => {
      return nextPlan.stepLabels[index] || currentPlan.stepLabels[index] || "";
    });
    const changed =
      totalSteps !== currentPlan.totalSteps ||
      stepLabels.some(
        (label, index) => label !== currentPlan.stepLabels[index],
      );

    if (!changed) {
      return;
    }

    const mergedPlan = { totalSteps, stepLabels };
    researchPlanRef.current = mergedPlan;
    setResearchPlan(mergedPlan);
  }, []);

  const updateResearchStep = React.useCallback(
    (step: ResearchStepSsePayload) => {
      const stepLabels = Array.from(
        { length: Math.max(step.totalSteps, step.stepNumber) },
        (_item, index) => (index + 1 === step.stepNumber ? step.label : ""),
      );
      mergeResearchPlan({
        totalSteps: Math.max(step.totalSteps, step.stepNumber),
        stepLabels,
      });

      const now = new Date().toISOString();
      const nextSteps = new Map(researchStepsRef.current);
      const existing = nextSteps.get(step.stepNumber);
      nextSteps.set(step.stepNumber, {
        status: step.status,
        toolName: step.toolName,
        label: step.label,
        startedAt: existing?.startedAt ?? now,
        updatedAt: now,
      });
      researchStepsRef.current = nextSteps;
      setResearchSteps(nextSteps);
    },
    [mergeResearchPlan],
  );

  const markResearchComplete = React.useCallback(() => {
    if (researchStepsRef.current.size === 0) {
      return;
    }

    const now = new Date().toISOString();
    const nextSteps = new Map<number, BloomResearchStepStatus>();
    researchStepsRef.current.forEach((step, stepNumber) => {
      nextSteps.set(stepNumber, { ...step, updatedAt: now });
    });
    researchStepsRef.current = nextSteps;
    setResearchSteps(nextSteps);
  }, []);

  const abortActiveTransport = React.useCallback(() => {
    abortControllerRef.current?.abort();
    if (readerRef.current) {
      void readerRef.current.cancel().catch(() => undefined);
    }
    abortControllerRef.current = null;
    readerRef.current = null;
    clearFlushInterval();
  }, [clearFlushInterval]);

  const patchPartialAssistantMessage = React.useCallback(() => {
    const conversationId = activeConversationIdRef.current;
    const placeholderId = activePlaceholderMessageIdRef.current;
    if (!conversationId || !placeholderId) {
      return;
    }

    flushTextBuffer();
    queryClient.setQueryData<BloomMessagesCache>(
      bloomMessagesQueryKey(conversationId),
      (current) =>
        patchMessage(current, placeholderId, {
          text: stripEchoedToolPayloads(streamingContentRef.current),
          thinkingContent: streamingThinkingRef.current.trim() || null,
          blockData: createStreamingBlockData(streamingBlocksRef.current),
        }),
    );
  }, [flushTextBuffer, queryClient]);

  const cancelStream = React.useCallback(() => {
    const state = connectionStateRef.current;
    if (state === "idle" || state === "done") {
      // Nothing is in flight, but a superseded request may still hold a
      // controller: make sure nothing can call back after a cancel.
      activeStreamIdRef.current = null;
      abortActiveTransport();
      return;
    }

    cancelRequestedRef.current = true;
    patchPartialAssistantMessage();
    activeStreamIdRef.current = null;
    setActiveToolCall(null);
    setStreamError("Response cancelled.");
    setConnectionState("done");
    abortActiveTransport();
  }, [abortActiveTransport, patchPartialAssistantMessage, setConnectionState]);

  const appendToken = React.useCallback(
    (text: string) => {
      tokenBufferRef.current += text;
      tokenBufferCountRef.current += 1;

      if (tokenBufferCountRef.current >= TOKEN_FLUSH_COUNT) {
        flushTextBuffer();
      }
    },
    [flushTextBuffer],
  );

  const appendThinkingToken = React.useCallback(
    (text: string, mode: BloomMode) => {
      streamingThinkingRef.current += text;
      setStreamingThinking(streamingThinkingRef.current);

      if (mode === "research") {
        mergeResearchPlan(
          parseResearchPlanFromThinking(streamingThinkingRef.current),
        );
      }
    },
    [mergeResearchPlan],
  );

  const addStreamingBlock = React.useCallback(
    (block: Omit<BloomStreamingBlock, "id" | "createdAt">) => {
      const nextBlock: BloomStreamingBlock = {
        ...block,
        id: `stream-block-${crypto.randomUUID()}`,
        createdAt: new Date().toISOString(),
      };
      streamingBlocksRef.current = [...streamingBlocksRef.current, nextBlock];
      setStreamingBlocks(streamingBlocksRef.current);
    },
    [],
  );

  const insertOptimisticMessages = React.useCallback(
    async (
      request: StreamRequest,
      attachments: BloomJsonArray,
      placeholderId: string,
    ) => {
      if (!request.conversationId) {
        return;
      }

      const conversationId = request.conversationId;
      const messageQueryKey = bloomMessagesQueryKey(conversationId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: messageQueryKey }),
        queryClient.cancelQueries({ queryKey: conversationsQueryBaseKey }),
      ]);

      const now = new Date().toISOString();
      const userMessage = createOptimisticUserMessage(
        conversationId,
        request.mode,
        request.message,
        attachments,
        now,
      );
      const assistantMessage = createStreamingAssistantMessage(
        conversationId,
        request.mode,
        placeholderId,
        now,
      );

      queryClient.setQueryData<BloomMessagesCache>(
        messageQueryKey,
        (current) =>
          appendMessage(appendMessage(current, userMessage), assistantMessage),
      );

      patchConversationLists((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messageCount: conversation.messageCount + 1,
              lastMessagePreview: request.message.slice(0, 180),
              updatedAt: now,
            }
          : conversation,
      );
    },
    [conversationsQueryBaseKey, patchConversationLists, queryClient],
  );

  const upsertLiveTaskPlan = React.useCallback(
    (conversationId: string, mode: BloomMode, plan: BloomTaskPlan) => {
      queryClient.setQueryData<BloomMessagesCache>(
        bloomMessagesQueryKey(conversationId),
        (current) =>
          upsertMessage(
            current,
            createLiveTaskPlanMessage(conversationId, mode, plan),
          ),
      );
    },
    [queryClient],
  );

  const finalizePersistedMessages = React.useCallback(
    async (
      request: StreamRequest,
      doneMetadata: BloomStreamingDoneMetadata,
    ) => {
      const resolvedConversationId =
        doneMetadata.conversationId ?? request.conversationId;
      if (!resolvedConversationId || !tenantId || !userId) {
        return;
      }

      optionsRef.current.onConversationResolved?.(resolvedConversationId);
      const currentMessages = queryClient.getQueryData<BloomMessagesCache>(
        bloomMessagesQueryKey(resolvedConversationId),
      );
      const page = await fetchBloomMessagesPage({
        conversationId: resolvedConversationId,
        tenantId,
        userId,
      });
      const mergedPage = mergePersistedPageWithStreamingState(
        currentMessages,
        page,
        activePlaceholderMessageIdRef.current,
      );

      queryClient.setQueryData<BloomMessagesCache>(
        bloomMessagesQueryKey(resolvedConversationId),
        { pages: [mergedPage], pageParams: [null] },
      );
      activePlaceholderMessageIdRef.current = null;

      if (doneMetadata.title) {
        patchConversationLists((conversation) =>
          conversation.id === resolvedConversationId
            ? {
                ...conversation,
                title: doneMetadata.title ?? conversation.title,
                updatedAt: new Date().toISOString(),
              }
            : conversation,
        );
      }

      void queryClient.invalidateQueries({
        queryKey: conversationsQueryBaseKey,
      });
    },
    [
      conversationsQueryBaseKey,
      patchConversationLists,
      queryClient,
      tenantId,
      userId,
    ],
  );

  const sendMessage = React.useCallback(
    (userMessage: string, overrides: AskBloomSendMessageOverrides = {}) => {
      const trimmedMessage = userMessage.trim();
      if (!trimmedMessage) {
        return;
      }

      const copy = STORE_COPY[store];
      if (store === "local" && !accessToken) {
        optionsRef.current.onError?.(copy.missingSession);
        return;
      }

      // Supersede any stream still in flight; its callbacks stop here.
      cancelRequestedRef.current = true;
      activeStreamIdRef.current = null;
      abortActiveTransport();
      resetStreamState();

      const streamId = crypto.randomUUID();
      const conversationId =
        overrides.conversationId ?? optionsRef.current.conversationId ?? null;
      const resourceFocus =
        overrides.resourceFocus === undefined
          ? (optionsRef.current.resourceFocus ?? null)
          : overrides.resourceFocus;
      const mode = overrides.mode ?? "standard";
      const modelPreference = overrides.modelPreference ?? "auto";
      const attachments = overrides.attachments ?? [];
      const pageContext =
        overrides.pageContext === undefined
          ? resolvePageContext(resourceFocus)
          : overrides.pageContext;
      const timezone = overrides.timezone ?? getTimezone();
      const usesMessageCache = store === "bloomMessageCache";
      const placeholderId = usesMessageCache
        ? `streaming-${streamId}`
        : (overrides.assistantMessageId ?? `ask-bloom-assistant-${streamId}`);
      const interceptTextPlans =
        optionsRef.current.interceptTextPlans ?? store === "local";
      const request: StreamRequest = {
        conversationId,
        message: trimmedMessage,
        mode,
      };
      const createdAt = new Date().toISOString();

      streamStartTimeRef.current = Date.now();
      activeStreamIdRef.current = streamId;
      activeConversationIdRef.current = usesMessageCache
        ? conversationId
        : null;
      activePlaceholderMessageIdRef.current =
        usesMessageCache && conversationId ? placeholderId : null;
      if (mode === "research") {
        setResearchConversationId(conversationId);
      }
      cancelRequestedRef.current = false;
      setConnectionState("connecting");
      startFlushInterval();

      void (async () => {
        let terminalEvent: TerminalEvent = null;
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        let abortController: AbortController | null = null;
        const isCurrentStream = () => activeStreamIdRef.current === streamId;

        // Raw text and the drawer's message-block view of this stream.
        let assistantContent = "";
        let assistantThinking = "";
        let blockIndex = 0;
        let assistantBlocks: AskBloomBlock[] = [];
        let rawStreamingBlocks: BloomStreamingBlock[] = [];
        let toolCalls: AskBloomToolCall[] = [];
        let textPlanDetected = false;

        const maybeHandleStreamingInterception = () => {
          if (!interceptTextPlans || textPlanDetected) {
            return;
          }

          const { gateDecision } = analyzeAssistantStreamingState(
            assistantContent,
            rawStreamingBlocks,
          );

          if (gateDecision.action === "intercept_plan") {
            textPlanDetected = true;
            optionsRef.current.onActiveToolCall?.(null);
            optionsRef.current.onTaskPlan?.(
              buildTaskPlanFromDetectedTextPlan(
                gateDecision.plan,
                placeholderId,
              ),
            );
          }
        };

        const failStream = (message: string) => {
          flushTextBuffer();
          patchPartialAssistantMessage();
          setActiveToolCall(null);
          setStreamError(message);
          setConnectionState("error");
          optionsRef.current.onError?.(message);
        };

        const handleEvent = async (
          event: ParsedSseEvent,
        ): Promise<TerminalEvent> => {
          const callbacks = optionsRef.current;

          switch (event.event) {
            case "token": {
              const tokenText = readRawTokenText(event.data);
              if (tokenText) {
                if (firstTokenTimeRef.current === null) {
                  firstTokenTimeRef.current = Date.now();
                }
                assistantContent += tokenText;
                appendToken(tokenText);
                maybeHandleStreamingInterception();
                callbacks.onStreamingUpdate?.(assistantContent);
              }
              return null;
            }
            case "thinking_token": {
              const thinkingText = readRawTokenText(event.data);
              if (thinkingText) {
                assistantThinking += thinkingText;
                appendThinkingToken(thinkingText, mode);
                callbacks.onThinkingToken?.(assistantThinking);
              }
              return null;
            }
            case "research_step": {
              const step = readResearchStep(event.data);
              if (step) {
                updateResearchStep(step);
              }
              callbacks.onResearchProgress?.(event.data);
              return null;
            }
            case "task_plan": {
              const plan = parseBloomTaskPlan(event.data);
              if (plan) {
                setActiveToolCall(null);
                setPendingTaskPlan(plan);
                callbacks.onActiveToolCall?.(null);
                callbacks.onTaskPlan?.(plan);
                if (usesMessageCache && conversationId) {
                  upsertLiveTaskPlan(conversationId, mode, plan);
                }
              }
              return null;
            }
            case "task_progress": {
              const progress = parseBloomTaskStatusUpdate(event.data);
              if (progress) {
                callbacks.onTaskProgress?.(progress);
              }
              return null;
            }
            case "task_complete": {
              const summary = parseBloomTaskCompletionSummary(event.data);
              if (summary) {
                callbacks.onTaskComplete?.(summary);
              }
              return null;
            }
            case "action_card": {
              const actionCard = toAskBloomActionCard(event.data);
              if (actionCard) {
                assistantBlocks = [...assistantBlocks, actionCard];
                callbacks.onActionCard?.(
                  actionCard,
                  buildAssistantBlocks(assistantContent, assistantBlocks),
                );
              }
              return null;
            }
            case "tool_start": {
              const activeTool = readToolStart(event.data);
              setActiveToolCall(activeTool);
              if (!isRecord(event.data)) {
                return null;
              }

              const nextToolCall: AskBloomToolCall = {
                id:
                  readString(event.data.id) ||
                  `tool-call-${crypto.randomUUID()}`,
                name: activeTool?.toolName ?? "tool",
                arguments: toDataRecord(
                  event.data.params ??
                    event.data.arguments ??
                    event.data.tool_input,
                ),
                result: null,
                status: "running",
              };
              toolCalls = appendToolCall(toolCalls, nextToolCall);
              const toolCallForCallbacks: BloomActiveToolCall = {
                toolName: nextToolCall.name,
                description: describeToolCall(nextToolCall.name),
              };
              callbacks.onToolStart?.(toolCallForCallbacks);
              if (!callbacks.onToolStart) {
                callbacks.onActiveToolCall?.(toolCallForCallbacks);
              }
              return null;
            }
            case "tool_result": {
              setActiveToolCall(null);
              const liveBlock = readToolResult(event.data);
              if (liveBlock) {
                if (firstBlockTimeRef.current === null) {
                  firstBlockTimeRef.current = Date.now();
                }
                addStreamingBlock(liveBlock);
              }
              if (!isRecord(event.data)) {
                return null;
              }

              const toolCallId = readString(event.data.id);
              const toolName =
                readString(event.data.tool) ||
                readString(event.data.tool_name) ||
                "tool";
              const result = event.data.result ?? null;

              toolCalls = appendToolCall(toolCalls, {
                id: toolCallId || `tool-result-${toolName}`,
                name: toolName,
                arguments: {},
                result,
                status: toToolCallStatus(event.data.status ?? "complete"),
              });

              // Preserve the full Bloom tool-result block instead of
              // collapsing it to a generic data card. The original block type
              // and tool metadata are carried through for renderers.
              const toolResultBlock: BloomContentBlock = {
                type: "tool_result",
                id: toolCallId || `tool-result-${toolName}-${blockIndex}`,
                toolName,
                blockType:
                  readString(event.data.block_type ?? event.data.blockType) ||
                  null,
                data: result,
                status: toBloomToolResultStatus(event.data.status),
                message: readString(event.data.message) || null,
                error:
                  readString(event.data.error_message ?? event.data.error) ||
                  null,
                count:
                  isRecord(result) && typeof result.count === "number"
                    ? result.count
                    : null,
              };

              const askBlock = bloomContentBlockToAskBloomBlock(
                toolResultBlock,
                blockIndex,
              );
              const streamingBlock: BloomStreamingBlock = {
                id: toolResultBlock.id,
                toolName: toolResultBlock.toolName,
                blockType: toolResultBlock.blockType ?? "tool_result",
                payload: toJsonPayload(result),
                createdAt: new Date().toISOString(),
              };
              blockIndex += 1;

              assistantBlocks = [...assistantBlocks, askBlock];
              rawStreamingBlocks = [...rawStreamingBlocks, streamingBlock];
              callbacks.onActiveToolCall?.(null);
              callbacks.onToolResult?.(streamingBlock);
              if (!callbacks.onToolResult) {
                callbacks.onBloomStreamingBlock?.(streamingBlock);
              }
              callbacks.onStreamingBlock?.(askBlock);
              return null;
            }
            case "error": {
              failStream(readSseErrorMessage(event.data, store));
              return "error";
            }
            case "done": {
              flushTextBuffer();
              markResearchComplete();
              const source = isRecord(event.data) ? event.data : {};
              const doneMetadata = readDoneMetadata(source);
              const doneAt = Date.now();
              const latencyMetrics: BloomStreamingLatencyMetrics = {
                clientTtftMs: latencyDelta(
                  streamStartTimeRef.current,
                  firstTokenTimeRef.current,
                ),
                clientTtfbMs: latencyDelta(
                  streamStartTimeRef.current,
                  firstBlockTimeRef.current,
                ),
                clientTotalMs: latencyDelta(streamStartTimeRef.current, doneAt),
                serverMetrics: doneMetadata.latencyMetrics,
                cacheStats: doneMetadata.cacheStats,
              };
              setLastLatencyMetrics(latencyMetrics);
              setLastDoneMetadata(doneMetadata);
              if (doneMetadata.modeOverride) {
                callbacks.onModeOverride?.(doneMetadata.modeOverride);
              }

              if (usesMessageCache) {
                void logClientLatencyMetrics(
                  request,
                  doneMetadata,
                  latencyMetrics,
                ).catch((error) => {
                  console.error(
                    "Failed to log Bloom client latency metrics",
                    error,
                  );
                });
                await finalizePersistedMessages(request, doneMetadata);
              } else {
                const persistedAssistantMessageId =
                  readString(source.assistant_message_id) || placeholderId;
                const followUpChips = doneMetadata.followUpChips.filter(
                  (chip): chip is string => typeof chip === "string",
                );
                if (followUpChips.length > 0) {
                  assistantBlocks = [
                    ...assistantBlocks,
                    {
                      type: "suggestion_chips",
                      content: "",
                      data: { suggestions: followUpChips },
                    },
                  ];
                  callbacks.onFollowUpChips?.(followUpChips);
                }

                const finalContent = sanitizeFinalAssistantContent(
                  assistantContent,
                  rawStreamingBlocks,
                );

                callbacks.onMessage?.({
                  id: persistedAssistantMessageId,
                  conversationId:
                    (readString(source.conversation_id) || conversationId) ??
                    `ask-bloom-conversation-${streamId}`,
                  role: "assistant",
                  content: finalContent,
                  blocks: buildAssistantBlocks(finalContent, assistantBlocks),
                  toolCalls,
                  createdAt,
                  isStreaming: false,
                });
                callbacks.onStreamComplete?.();
                callbacks.onDone?.();
              }

              setActiveToolCall(null);
              setConnectionState("done");
              return "done";
            }
            default:
              return null;
          }
        };

        try {
          if (usesMessageCache && (!tenantId || !userId)) {
            throw new Error(
              "Sign in and select an organization to message Bloom.",
            );
          }

          if (!accessToken) {
            throw new Error(copy.missingSession);
          }

          if (usesMessageCache) {
            await insertOptimisticMessages(request, attachments, placeholderId);
          }

          abortController = new AbortController();
          abortControllerRef.current = abortController;

          const response = await fetch(
            `${SUPABASE_URL}/functions/v1/bloom-assist`,
            {
              method: "POST",
              headers: {
                Accept: "text/event-stream",
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                apikey: SUPABASE_PUBLISHABLE_KEY,
              },
              signal: abortController.signal,
              body: JSON.stringify({
                conversation_id: conversationId,
                message: trimmedMessage,
                mode,
                model_preference:
                  modelPreference === "auto" ? null : modelPreference,
                session_type: resourceFocus ? "resource_focused" : "standard",
                resource_focus: resourceFocus
                  ? {
                      resourceType: resourceFocus.resourceType,
                      resourceId: resourceFocus.resourceId,
                      resourceSummary: resourceFocus.resourceSummary,
                    }
                  : null,
                page_context: pageContext,
                timezone,
                attachments,
                client_context: bloomChatClientContext(),
              }),
            },
          );

          if (!isCurrentStream()) {
            return;
          }

          if (!response.ok) {
            throw new Error(await readResponseErrorMessage(response, store));
          }

          if (!response.body) {
            throw new Error(copy.noStream);
          }

          setConnectionState("streaming");
          reader = response.body.getReader();
          readerRef.current = reader;
          const decoder = new TextDecoder();
          let buffer = "";

          const consumeBuffer = async (
            isFinal: boolean,
          ): Promise<TerminalEvent> => {
            const parts = buffer.split(/\r?\n\r?\n/);
            buffer = isFinal ? "" : (parts.pop() ?? "");

            for (const part of parts) {
              if (!isCurrentStream()) {
                return null;
              }

              const rawMessage = part.trim();
              if (!rawMessage) {
                continue;
              }

              const parsed = parseSseMessage(rawMessage);
              if (parsed.error) {
                consecutiveParseErrorsRef.current += 1;
                console.warn("Malformed Bloom SSE event", {
                  raw: rawMessage.slice(0, 1000),
                  reason: parsed.error,
                });

                if (
                  consecutiveParseErrorsRef.current >=
                  MAX_CONSECUTIVE_PARSE_ERRORS
                ) {
                  throw new Error(
                    "Bloom stream returned malformed events. Partial response preserved.",
                  );
                }
                continue;
              }

              if (!parsed.event) {
                continue;
              }

              consecutiveParseErrorsRef.current = 0;
              const terminal = await handleEvent(parsed.event);
              if (terminal) {
                return terminal;
              }
            }

            return null;
          };

          while (isCurrentStream()) {
            const { done, value } = await reader.read();
            if (done) {
              buffer += decoder.decode();
              if (buffer.trim()) {
                buffer += "\n\n";
              }
              terminalEvent = await consumeBuffer(true);
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            terminalEvent = await consumeBuffer(false);
            if (terminalEvent) {
              break;
            }
          }

          if (
            !terminalEvent &&
            isCurrentStream() &&
            !cancelRequestedRef.current
          ) {
            failStream(STREAM_INTERRUPTED_MESSAGE);
          }
        } catch (error) {
          if (!isCurrentStream() || cancelRequestedRef.current) {
            return;
          }

          failStream(toRequestErrorMessage(error, store));
        } finally {
          if (readerRef.current === reader) {
            readerRef.current = null;
          }
          if (reader) {
            try {
              reader.releaseLock();
            } catch {
              // The stream may already be closed or cancelled.
            }
          }
          if (abortControllerRef.current === abortController) {
            abortControllerRef.current = null;
          }
          if (activeStreamIdRef.current === streamId) {
            clearFlushInterval();
            flushTextBuffer();
          }
        }
      })();
    },
    [
      abortActiveTransport,
      accessToken,
      addStreamingBlock,
      appendThinkingToken,
      appendToken,
      clearFlushInterval,
      finalizePersistedMessages,
      flushTextBuffer,
      insertOptimisticMessages,
      logClientLatencyMetrics,
      markResearchComplete,
      patchPartialAssistantMessage,
      resetStreamState,
      setConnectionState,
      startFlushInterval,
      store,
      tenantId,
      updateResearchStep,
      upsertLiveTaskPlan,
      userId,
    ],
  );

  React.useEffect(
    () => () => {
      cancelRequestedRef.current = true;
      activeStreamIdRef.current = null;
      abortActiveTransport();
    },
    [abortActiveTransport],
  );

  const resolvedResearchSteps = Array.from(researchSteps.values()).filter(
    (step) => step.status === "completed" || step.status === "failed",
  ).length;
  const allResearchStepsResolved =
    researchSteps.size > 0 && resolvedResearchSteps >= researchSteps.size;
  const isResearchSynthesizing =
    connectionState === "streaming" &&
    allResearchStepsResolved &&
    streamingContent.trim().length > 0;
  const isResearchComplete =
    connectionState === "done" && researchSteps.size > 0;

  return {
    sendMessage,
    cancelStream,
    isStreaming:
      connectionState === "connecting" || connectionState === "streaming",
    /** True once a signed-in user (and, for the Bloom message cache, an organization) is loaded. */
    canSend: Boolean(
      accessToken && (store === "local" || (tenantId && userId)),
    ),
    connectionState,
    streamingContent,
    streamingThinking,
    activeToolCall,
    streamError,
    streamingBlocks,
    researchPlan,
    researchSteps,
    researchConversationId,
    isResearchSynthesizing,
    isResearchComplete,
    pendingTaskPlan,
    lastLatencyMetrics,
    lastDoneMetadata,
    resetStream: resetStreamState,
    dismissPendingTaskPlan,
  };
}
