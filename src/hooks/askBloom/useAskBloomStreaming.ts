import * as React from "react";
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
import { stripToolJsonFromText } from "@/components/bloom/utils/stripToolJson";
import type { PendingResourceForm } from "@/components/bloom/utils/resourceFormRegistry";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/config";
import type { Json } from "@/integrations/supabase/types";
import {
  parseBloomTaskCompletionSummary,
  parseBloomTaskPlan,
  parseBloomTaskStatusUpdate,
  type BloomTaskJsonObject,
  type BloomTaskCompletionSummary,
  type BloomTaskPlanAction,
  type BloomTaskPlanEntityType,
  type BloomTaskRiskLevel,
  type BloomTaskPlan,
  type BloomTaskStatusUpdate,
} from "@/hooks/bloom/taskPlanTypes";
import type {
  BloomActiveToolCall,
  BloomStreamingBlock,
} from "@/hooks/bloom/useBloomStreaming";
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

interface UseAskBloomStreamingOptions {
  conversationId: string | null;
  resourceFocus: ResourceFocus | null;
  onMessage: (message: AskBloomMessage) => void;
  onStreamingUpdate: (partialContent: string) => void;
  onActionCard?: (card: AskBloomActionCard, blocks: AskBloomBlock[]) => void;
  onError: (error: string) => void;
  onDone?: () => void;
  onStreamComplete?: () => void;
  // Optional state callbacks used by Ask Bloom provider state and later UI
  // milestones. They should not alter the existing assistant message block
  // path, which still flows through `onStreamingBlock` / `onActionCard`.
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
}

interface SendMessageOverrides {
  conversationId?: string | null;
  resourceFocus?: ResourceFocus | null;
  assistantMessageId?: string | null;
}

interface ParsedSseEvent {
  event: string;
  data: unknown;
}

const ASK_BLOOM_UNAVAILABLE_MESSAGE =
  "Ask Bloom is temporarily unavailable. The Bloom Assist edge function may be down, undeployed, or failing to start.";

const getTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const parseSseMessage = (rawMessage: string): ParsedSseEvent | null => {
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
    return null;
  }

  const dataText = dataLines.join("\n");
  if (!dataText || dataText === "[DONE]") {
    return null;
  }

  try {
    return { event, data: JSON.parse(dataText) as unknown };
  } catch {
    return null;
  }
};

/**
 * Reads streaming token text WITHOUT trimming. The SSE token payload carries
 * the leading/trailing spaces that ARE the inter-word whitespace (e.g.
 * " customer"). Routing token text through the trimming `readString` collapses
 * adjacent tokens together ("Certainly!Tohelp..."). Mirrors Bloom's raw token
 * reader in `useBloomStreaming.ts`.
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
  if (
    value === null ||
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

const readResponseErrorMessage = async (response: Response) => {
  if (
    response.status === 502 ||
    response.status === 503 ||
    response.status === 504
  ) {
    return `${ASK_BLOOM_UNAVAILABLE_MESSAGE} Received ${response.status} from the service.`;
  }

  const text = await response.text();
  if (!text.trim()) {
    return `Ask Bloom request failed with status ${response.status}.`;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed)) {
      return readString(parsed.error) || readString(parsed.message) || text;
    }
  } catch {
    return text;
  }

  return text;
};

const toAskBloomRequestErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "Ask Bloom request was cancelled.";
    }

    if (error instanceof TypeError) {
      return `${ASK_BLOOM_UNAVAILABLE_MESSAGE} The browser could not complete the network request.`;
    }

    return error.message;
  }

  return "Ask Bloom could not complete that request.";
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

  if (toolName === "send_campaign") {
    return {
      ...normalizedParams,
      send_mode: normalizedParams.send_mode ?? "now",
    };
  }

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

const buildTaskPlanFromDetectedTextPlan = (
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
      validationAnnotations: [],
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

export function useAskBloomStreaming(options: UseAskBloomStreamingOptions) {
  const { session } = useAuth();
  const [isStreaming, setIsStreaming] = React.useState(false);
  const optionsRef = React.useRef(options);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const activeRequestIdRef = React.useRef<string | null>(null);
  const cancelRequestedRef = React.useRef(false);

  React.useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const cancelStream = React.useCallback(() => {
    cancelRequestedRef.current = true;
    activeRequestIdRef.current = null;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendMessage = React.useCallback(
    (userMessage: string, overrides: SendMessageOverrides = {}) => {
      const trimmedMessage = userMessage.trim();
      if (!trimmedMessage) {
        return;
      }

      const accessToken = session?.access_token;
      if (!accessToken) {
        optionsRef.current.onError("Sign in to message Ask Bloom.");
        return;
      }

      cancelStream();

      const requestId = crypto.randomUUID();
      const resolvedConversationId =
        overrides.conversationId ?? optionsRef.current.conversationId;
      const resolvedResourceFocus =
        overrides.resourceFocus === undefined
          ? optionsRef.current.resourceFocus
          : overrides.resourceFocus;
      const resolvedAssistantMessageId =
        overrides.assistantMessageId ?? `ask-bloom-assistant-${requestId}`;
      const createdAt = new Date().toISOString();

      cancelRequestedRef.current = false;
      activeRequestIdRef.current = requestId;
      setIsStreaming(true);

      void (async () => {
        let assistantContent = "";
        let assistantThinking = "";
        let blockIndex = 0;
        let assistantBlocks: AskBloomBlock[] = [];
        let rawStreamingBlocks: BloomStreamingBlock[] = [];
        let toolCalls: AskBloomToolCall[] = [];
        let resolvedAssistantConversationId = resolvedConversationId;
        let textPlanDetected = false;

        const maybeHandleStreamingInterception = () => {
          const { gateDecision } = analyzeAssistantStreamingState(
            assistantContent,
            rawStreamingBlocks,
          );

          if (
            gateDecision.action === "intercept_plan" &&
            !textPlanDetected &&
            resolvedAssistantMessageId
          ) {
            textPlanDetected = true;
            optionsRef.current.onActiveToolCall?.(null);
            optionsRef.current.onTaskPlan?.(
              buildTaskPlanFromDetectedTextPlan(
                gateDecision.plan,
                resolvedAssistantMessageId,
              ),
            );
          }
        };

        try {
          const abortController = new AbortController();
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
                conversation_id: resolvedConversationId,
                message: trimmedMessage,
                mode: "standard",
                model_preference: null,
                session_type: resolvedResourceFocus
                  ? "resource_focused"
                  : "standard",
                resource_focus: resolvedResourceFocus
                  ? {
                      resourceType: resolvedResourceFocus.resourceType,
                      resourceId: resolvedResourceFocus.resourceId,
                      resourceSummary: resolvedResourceFocus.resourceSummary,
                    }
                  : null,
                page_context: resolvePageContext(resolvedResourceFocus),
                timezone: getTimezone(),
                attachments: [],
              }),
            },
          );

          if (activeRequestIdRef.current !== requestId) {
            return;
          }

          if (!response.ok) {
            throw new Error(await readResponseErrorMessage(response));
          }

          if (!response.body) {
            throw new Error("Ask Bloom did not return a readable stream.");
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let streamFinished = false;

          while (!streamFinished && activeRequestIdRef.current === requestId) {
            const { value, done } = await reader.read();
            if (done) {
              buffer += decoder.decode();
            } else {
              buffer += decoder.decode(value, { stream: true });
            }

            const parts = buffer.split(/\r?\n\r?\n/);
            buffer = done ? "" : (parts.pop() ?? "");

            for (const part of parts) {
              const event = parseSseMessage(part.trim());
              if (!event) {
                continue;
              }

              if (event.event === "token") {
                const tokenText = readRawTokenText(event.data);
                if (tokenText) {
                  assistantContent += tokenText;
                  maybeHandleStreamingInterception();
                  optionsRef.current.onStreamingUpdate(assistantContent);
                }
                continue;
              }

              if (event.event === "thinking_token") {
                const thinkingText = readRawTokenText(event.data);
                if (thinkingText) {
                  assistantThinking += thinkingText;
                  optionsRef.current.onThinkingToken?.(assistantThinking);
                }
                continue;
              }

              if (event.event === "research_step") {
                optionsRef.current.onResearchProgress?.(event.data);
                continue;
              }

              if (event.event === "task_plan") {
                const plan = parseBloomTaskPlan(event.data);
                if (plan) {
                  optionsRef.current.onActiveToolCall?.(null);
                  optionsRef.current.onTaskPlan?.(plan);
                }
                continue;
              }

              if (event.event === "task_progress") {
                const progress = parseBloomTaskStatusUpdate(event.data);
                if (progress) {
                  optionsRef.current.onTaskProgress?.(progress);
                }
                continue;
              }

              if (event.event === "task_complete") {
                const summary = parseBloomTaskCompletionSummary(event.data);
                if (summary) {
                  optionsRef.current.onTaskComplete?.(summary);
                }
                continue;
              }

              if (event.event === "action_card") {
                const actionCard = toAskBloomActionCard(event.data);
                if (!actionCard) {
                  continue;
                }

                assistantBlocks = [...assistantBlocks, actionCard];
                optionsRef.current.onActionCard?.(
                  actionCard,
                  buildAssistantBlocks(assistantContent, assistantBlocks),
                );
                continue;
              }

              if (event.event === "tool_start" && isRecord(event.data)) {
                const nextToolCall: AskBloomToolCall = {
                  id:
                    readString(event.data.id) ||
                    `tool-call-${crypto.randomUUID()}`,
                  name:
                    readString(event.data.tool) ||
                    readString(event.data.tool_name) ||
                    "tool",
                  arguments: toDataRecord(
                    event.data.params ??
                      event.data.arguments ??
                      event.data.tool_input,
                  ),
                  result: null,
                  status: "running",
                };
                toolCalls = appendToolCall(toolCalls, nextToolCall);
                const activeToolCall = {
                  toolName: nextToolCall.name,
                  description: describeToolCall(nextToolCall.name),
                };
                optionsRef.current.onToolStart?.(activeToolCall);
                if (!optionsRef.current.onToolStart) {
                  optionsRef.current.onActiveToolCall?.(activeToolCall);
                }
                continue;
              }

              if (event.event === "tool_result" && isRecord(event.data)) {
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
                // and tool metadata are carried through for renderers (M02+).
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
                optionsRef.current.onActiveToolCall?.(null);
                optionsRef.current.onToolResult?.(streamingBlock);
                if (!optionsRef.current.onToolResult) {
                  optionsRef.current.onBloomStreamingBlock?.(streamingBlock);
                }
                optionsRef.current.onStreamingBlock?.(askBlock);
                continue;
              }

              if (event.event === "error") {
                const message =
                  readString(isRecord(event.data) ? event.data.message : "") ||
                  "Ask Bloom could not complete that request.";
                optionsRef.current.onError(message);
                streamFinished = true;
                break;
              }

              if (event.event === "done" && isRecord(event.data)) {
                resolvedAssistantConversationId =
                  readString(event.data.conversation_id) ||
                  resolvedAssistantConversationId;
                const persistedAssistantMessageId =
                  readString(event.data.assistant_message_id) ||
                  resolvedAssistantMessageId;

                const followUpChips = Array.isArray(event.data.follow_up_chips)
                  ? event.data.follow_up_chips
                  : [];
                if (followUpChips.length > 0) {
                  assistantBlocks = [
                    ...assistantBlocks,
                    {
                      type: "suggestion_chips",
                      content: "",
                      data: { suggestions: followUpChips },
                    },
                  ];
                  optionsRef.current.onFollowUpChips?.(
                    followUpChips.filter(
                      (chip): chip is string => typeof chip === "string",
                    ),
                  );
                }

                const finalContent = sanitizeFinalAssistantContent(
                  assistantContent,
                  rawStreamingBlocks,
                );

                optionsRef.current.onMessage({
                  id: persistedAssistantMessageId,
                  conversationId:
                    resolvedAssistantConversationId ??
                    `ask-bloom-conversation-${requestId}`,
                  role: "assistant",
                  content: finalContent,
                  blocks: buildAssistantBlocks(finalContent, assistantBlocks),
                  toolCalls,
                  createdAt,
                  isStreaming: false,
                });
                optionsRef.current.onStreamComplete?.();
                optionsRef.current.onDone?.();
                streamFinished = true;
                break;
              }
            }

            if (done) {
              break;
            }
          }

          if (
            !streamFinished &&
            activeRequestIdRef.current === requestId &&
            !cancelRequestedRef.current
          ) {
            optionsRef.current.onError(
              "Connection lost. Partial response preserved.",
            );
          }
        } catch (error) {
          if (
            activeRequestIdRef.current !== requestId ||
            cancelRequestedRef.current
          ) {
            return;
          }

          optionsRef.current.onError(toAskBloomRequestErrorMessage(error));
        } finally {
          if (activeRequestIdRef.current === requestId) {
            activeRequestIdRef.current = null;
          }
          abortControllerRef.current = null;
          cancelRequestedRef.current = false;
          setIsStreaming(false);
        }
      })();
    },
    [cancelStream, session?.access_token],
  );

  React.useEffect(
    () => () => {
      cancelRequestedRef.current = true;
      activeRequestIdRef.current = null;
      abortControllerRef.current?.abort();
    },
    [cancelStream],
  );

  return { sendMessage, cancelStream, isStreaming };
}
