import * as React from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/config";
import type { Json } from "@/integrations/supabase/types";
import { useTenant } from "@/hooks/useTenant";
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
  type BloomTaskCompletionSummary,
  type BloomTaskPlan,
  type BloomTaskStatusUpdate,
} from "@/hooks/bloom/taskPlanTypes";

const TOKEN_FLUSH_INTERVAL_MS = 50;
const TOKEN_FLUSH_COUNT = 5;
const MAX_CONSECUTIVE_PARSE_ERRORS = 5;

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

interface BloomStreamingHandlers {
  onTaskPlan?: (plan: BloomTaskPlan) => void;
  onTaskProgress?: (progress: BloomTaskStatusUpdate) => void;
  onTaskComplete?: (summary: BloomTaskCompletionSummary) => void;
  onModeOverride?: (mode: BloomMode) => void;
  onConversationResolved?: (conversationId: string) => void;
}

interface StartStreamInput {
  conversationId: string | null;
  message: string;
  mode: BloomMode;
  modelPreference: BloomModelPreference;
  pageContext: BloomPageContextPayload | null;
  timezone: string;
  attachments: BloomJsonArray;
}

interface BloomSseEvent {
  event: string;
  data: Json;
}

interface ParseResult {
  event: BloomSseEvent | null;
  error: string | null;
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

interface DoneMetadata extends BloomStreamingDoneMetadata {}

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

export interface BloomStreamingLatencyMetrics {
  clientTtftMs: number | null;
  clientTtfbMs: number | null;
  clientTotalMs: number | null;
  serverMetrics: BloomServerLatencyMetrics | null;
  cacheStats: BloomCacheAuditStats | null;
}

type ResearchStepSsePayload = {
  stepNumber: number;
  totalSteps: number;
  label: string;
  status: Exclude<BloomResearchStepState, "pending">;
  toolName: string;
};

type TerminalEvent = "done" | "error" | null;

const STEP_LINE_PATTERN =
  /^\s*(?:(\d{1,2})[.)]|step\s+(\d{1,2})\s*[:.)-])\s*(.+?)\s*$/gim;
const MAX_RESEARCH_STEP_LABEL_LENGTH = 180;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const readRawString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readBloomMode = (value: unknown): BloomMode | null => {
  const mode = readString(value);
  return mode && isBloomMode(mode) ? mode : null;
};

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

const readTokenText = (data: Json): string | null => {
  if (typeof data === "string") {
    return data;
  }

  return isRecord(data) ? readRawString(data.text) : null;
};

const readSseErrorMessage = (data: Json) => {
  if (isRecord(data)) {
    return readString(data.message) ?? "Bloom Assist stream failed.";
  }

  return readString(data) ?? "Bloom Assist stream failed.";
};

const readResponseErrorMessage = async (response: Response) => {
  const text = await response.text();
  if (!text.trim()) {
    return `Bloom Assist request failed with status ${response.status}.`;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed)) {
      return readString(parsed.error) ?? readString(parsed.message) ?? text;
    }
  } catch {
    return text;
  }

  return text;
};

const appendMessage = (
  current: InfiniteData<BloomMessagesPage, string | null> | undefined,
  message: BloomMessage,
): InfiniteData<BloomMessagesPage, string | null> => {
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
  current: InfiniteData<BloomMessagesPage, string | null> | undefined,
  message: BloomMessage,
): InfiniteData<BloomMessagesPage, string | null> => {
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
  current: InfiniteData<BloomMessagesPage, string | null> | undefined,
  messageId: string,
  patch: Partial<BloomMessage>,
): InfiniteData<BloomMessagesPage, string | null> | undefined => {
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
  current: InfiniteData<BloomMessagesPage, string | null> | undefined,
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

const formatToolLabel = (toolName: string) =>
  toolName
    .replace(/^(query|get|generate|create|update)_/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const describeToolCall = (toolName: string) => {
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

const readToolStart = (data: Json): BloomActiveToolCall | null => {
  if (!isRecord(data)) {
    return null;
  }

  const toolName = readString(data.tool) ?? readString(data.tool_name);
  if (!toolName) {
    return null;
  }

  return {
    toolName,
    description: readString(data.description) ?? describeToolCall(toolName),
  };
};

const readToolResult = (
  data: Json,
): Omit<BloomStreamingBlock, "id" | "createdAt"> | null => {
  if (!isRecord(data)) {
    return null;
  }

  const blockType = readString(data.block_type) ?? readString(data.blockType);
  const payload = data.result;
  if (!blockType || !isJsonValue(payload)) {
    return null;
  }

  return {
    toolName: readString(data.tool) ?? readString(data.tool_name),
    blockType,
    payload,
  };
};

const readResearchStep = (data: Json): ResearchStepSsePayload | null => {
  if (!isRecord(data)) {
    return null;
  }

  const stepNumber =
    readNumber(data.step_number) ?? readNumber(data.stepNumber);
  const totalSteps =
    readNumber(data.total_steps) ?? readNumber(data.totalSteps);
  const label = readString(data.label);
  const toolName = readString(data.tool_name) ?? readString(data.toolName);
  const status = readString(data.status);

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

const readLatencyMetrics = (data: Json): BloomServerLatencyMetrics | null => {
  if (!isRecord(data) || !isRecord(data.latency_metrics)) {
    return null;
  }

  const metrics = data.latency_metrics;
  return {
    server_ttft_ms: readNumber(metrics.server_ttft_ms),
    server_ttfb_ms: readNumber(metrics.server_ttfb_ms),
    server_total_ms: readNumber(metrics.server_total_ms),
    context_build_ms: readNumber(metrics.context_build_ms),
    llm_latency_ms: readNumber(metrics.llm_latency_ms),
  };
};

const readCacheStats = (data: Json): BloomCacheAuditStats | null => {
  if (!isRecord(data) || !isRecord(data.cache_stats)) {
    return null;
  }

  const stats = data.cache_stats;
  const hits = readNumber(stats.hits);
  const misses = readNumber(stats.misses);
  const invalidations = readNumber(stats.invalidations);

  if (hits === null || misses === null || invalidations === null) {
    return null;
  }

  return {
    hits,
    misses,
    invalidations,
  };
};

const latencyDelta = (startAt: number | null, endAt: number | null) =>
  startAt === null || endAt === null ? null : Math.max(0, endAt - startAt);

const readDoneMetadata = (data: Json): DoneMetadata => {
  const source = isRecord(data) ? data : {};
  const followUpChips = Array.isArray(source.follow_up_chips)
    ? source.follow_up_chips.filter(isJsonValue)
    : [];

  return {
    conversationId:
      readString(source.conversation_id) ?? readString(source.conversationId),
    tokensInput:
      readNumber(source.tokens_input) ?? readNumber(source.tokensInput),
    tokensOutput:
      readNumber(source.tokens_output) ?? readNumber(source.tokensOutput),
    model: readString(source.model),
    title: readString(source.title),
    followUpChips,
    modeOverride:
      readBloomMode(source.mode_override) ?? readBloomMode(source.modeOverride),
    latencyMetrics: readLatencyMetrics(source),
    cacheStats: readCacheStats(source),
  };
};

export function useBloomStreaming(handlers: BloomStreamingHandlers = {}) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { tenant } = useTenant();
  const userId = session?.user.id ?? null;
  const tenantId = tenant?.id ?? null;
  const conversationsQueryBaseKey = bloomConversationsQueryBaseKey(tenantId);
  const [connectionState, setConnectionState] =
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

  const tokenBufferRef = React.useRef("");
  const tokenBufferCountRef = React.useRef(0);
  const streamingContentRef = React.useRef("");
  const streamingThinkingRef = React.useRef("");
  const streamingBlocksRef = React.useRef<BloomStreamingBlock[]>([]);
  const researchPlanRef = React.useRef<BloomResearchPlan>(emptyResearchPlan());
  const researchStepsRef = React.useRef<Map<number, BloomResearchStepStatus>>(
    new Map(),
  );
  const flushIntervalRef = React.useRef<ReturnType<
    typeof window.setInterval
  > | null>(null);
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
  const doneTimeRef = React.useRef<number | null>(null);

  const getConversationLists = React.useCallback(
    () =>
      queryClient.getQueriesData<BloomConversation[]>({
        queryKey: conversationsQueryBaseKey,
      }),
    [conversationsQueryBaseKey, queryClient],
  );

  const patchConversationLists = React.useCallback(
    (updater: (conversation: BloomConversation) => BloomConversation) => {
      getConversationLists().forEach(([queryKey, conversations]) => {
        if (!conversations) {
          return;
        }

        queryClient.setQueryData<BloomConversation[]>(
          queryKey,
          sortBloomConversations(conversations.map(updater)),
        );
      });
    },
    [getConversationLists, queryClient],
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
    doneTimeRef.current = null;
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

  const logClientLatencyMetrics = React.useCallback(
    async (
      input: StartStreamInput,
      doneMetadata: DoneMetadata,
      latencyMetrics: BloomStreamingLatencyMetrics,
    ) => {
      const resolvedConversationId =
        doneMetadata.conversationId ?? input.conversationId;

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
          mode: input.mode,
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
    queryClient.setQueryData<InfiniteData<BloomMessagesPage, string | null>>(
      bloomMessagesQueryKey(conversationId),
      (current) =>
        patchMessage(current, placeholderId, {
          text: streamingContentRef.current,
          thinkingContent: streamingThinkingRef.current.trim() || null,
          blockData: createStreamingBlockData(streamingBlocksRef.current),
        }),
    );
  }, [flushTextBuffer, queryClient]);

  const cancelStream = React.useCallback(() => {
    if (connectionState === "idle" || connectionState === "done") {
      return;
    }

    cancelRequestedRef.current = true;
    patchPartialAssistantMessage();
    setActiveToolCall(null);
    setStreamError("Response cancelled.");
    setConnectionState("done");
    abortActiveTransport();
  }, [abortActiveTransport, connectionState, patchPartialAssistantMessage]);

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
    async (input: StartStreamInput, placeholderId: string) => {
      if (!input.conversationId) {
        return;
      }

      const messageQueryKey = bloomMessagesQueryKey(input.conversationId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: messageQueryKey }),
        queryClient.cancelQueries({ queryKey: conversationsQueryBaseKey }),
      ]);

      const now = new Date().toISOString();
      const userMessage = createOptimisticUserMessage(
        input.conversationId,
        input.mode,
        input.message,
        input.attachments,
        now,
      );
      const assistantMessage = createStreamingAssistantMessage(
        input.conversationId,
        input.mode,
        placeholderId,
        now,
      );

      queryClient.setQueryData<InfiniteData<BloomMessagesPage, string | null>>(
        messageQueryKey,
        (current) =>
          appendMessage(appendMessage(current, userMessage), assistantMessage),
      );

      patchConversationLists((conversation) =>
        conversation.id === input.conversationId
          ? {
              ...conversation,
              messageCount: conversation.messageCount + 1,
              lastMessagePreview: input.message.slice(0, 180),
              updatedAt: now,
            }
          : conversation,
      );
    },
    [conversationsQueryBaseKey, patchConversationLists, queryClient],
  );

  const upsertLiveTaskPlan = React.useCallback(
    (conversationId: string, mode: BloomMode, plan: BloomTaskPlan) => {
      queryClient.setQueryData<InfiniteData<BloomMessagesPage, string | null>>(
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
    async (input: StartStreamInput, doneMetadata: DoneMetadata) => {
      const resolvedConversationId =
        doneMetadata.conversationId ?? input.conversationId;
      if (!resolvedConversationId || !tenantId || !userId) {
        return;
      }

      handlers.onConversationResolved?.(resolvedConversationId);
      const currentMessages = queryClient.getQueryData<
        InfiniteData<BloomMessagesPage, string | null>
      >(bloomMessagesQueryKey(resolvedConversationId));
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

      queryClient.setQueryData<InfiniteData<BloomMessagesPage, string | null>>(
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
      handlers,
      patchConversationLists,
      queryClient,
      tenantId,
      userId,
    ],
  );

  const handleParsedEvent = React.useCallback(
    async (
      event: BloomSseEvent,
      input: StartStreamInput,
    ): Promise<TerminalEvent> => {
      switch (event.event) {
        case "token": {
          const text = readTokenText(event.data);
          if (text !== null) {
            if (
              streamStartTimeRef.current !== null &&
              firstTokenTimeRef.current === null
            ) {
              firstTokenTimeRef.current = Date.now();
            }
            appendToken(text);
          }
          return null;
        }
        case "thinking_token": {
          const text = readTokenText(event.data);
          if (text !== null) {
            appendThinkingToken(text, input.mode);
          }
          return null;
        }
        case "research_step": {
          const step = readResearchStep(event.data);
          if (step) {
            updateResearchStep(step);
          }
          return null;
        }
        case "tool_start": {
          setActiveToolCall(readToolStart(event.data));
          return null;
        }
        case "tool_result": {
          setActiveToolCall(null);
          const block = readToolResult(event.data);
          if (block) {
            if (
              streamStartTimeRef.current !== null &&
              firstBlockTimeRef.current === null
            ) {
              firstBlockTimeRef.current = Date.now();
            }
            addStreamingBlock(block);
          }
          return null;
        }
        case "task_plan": {
          const plan = parseBloomTaskPlan(event.data);
          if (plan) {
            setActiveToolCall(null);
            setPendingTaskPlan(plan);
            handlers.onTaskPlan?.(plan);
            if (input.conversationId) {
              upsertLiveTaskPlan(input.conversationId, input.mode, plan);
            }
          }
          return null;
        }
        case "task_progress": {
          const progress = parseBloomTaskStatusUpdate(event.data);
          if (progress) {
            handlers.onTaskProgress?.(progress);
          }
          return null;
        }
        case "task_complete": {
          const summary = parseBloomTaskCompletionSummary(event.data);
          if (summary) {
            handlers.onTaskComplete?.(summary);
          }
          return null;
        }
        case "error": {
          flushTextBuffer();
          patchPartialAssistantMessage();
          setActiveToolCall(null);
          setStreamError(readSseErrorMessage(event.data));
          setConnectionState("error");
          return "error";
        }
        case "done": {
          flushTextBuffer();
          markResearchComplete();
          const doneMetadata = readDoneMetadata(event.data);
          doneTimeRef.current = Date.now();
          const latencyMetrics: BloomStreamingLatencyMetrics = {
            clientTtftMs: latencyDelta(
              streamStartTimeRef.current,
              firstTokenTimeRef.current,
            ),
            clientTtfbMs: latencyDelta(
              streamStartTimeRef.current,
              firstBlockTimeRef.current,
            ),
            clientTotalMs: latencyDelta(
              streamStartTimeRef.current,
              doneTimeRef.current,
            ),
            serverMetrics: doneMetadata.latencyMetrics,
            cacheStats: doneMetadata.cacheStats,
          };
          setLastLatencyMetrics(latencyMetrics);
          setLastDoneMetadata(doneMetadata);
          void logClientLatencyMetrics(
            input,
            doneMetadata,
            latencyMetrics,
          ).catch((error) => {
            console.error("Failed to log Bloom client latency metrics", error);
          });
          if (doneMetadata.modeOverride) {
            handlers.onModeOverride?.(doneMetadata.modeOverride);
          }
          await finalizePersistedMessages(input, doneMetadata);
          setActiveToolCall(null);
          setConnectionState("done");
          return "done";
        }
        default:
          return null;
      }
    },
    [
      addStreamingBlock,
      appendThinkingToken,
      appendToken,
      finalizePersistedMessages,
      flushTextBuffer,
      handlers,
      markResearchComplete,
      patchPartialAssistantMessage,
      updateResearchStep,
      upsertLiveTaskPlan,
    ],
  );

  const startStream = React.useCallback(
    (
      conversationId: string | null,
      message: string,
      mode: BloomMode,
      modelPreference: BloomModelPreference,
      pageContext: BloomPageContextPayload | null,
      timezone: string,
      attachments: BloomJsonArray = [],
    ) => {
      const trimmedMessage = message.trim();
      if (!trimmedMessage) {
        return;
      }

      abortActiveTransport();
      resetStreamState();
      streamStartTimeRef.current = Date.now();
      firstTokenTimeRef.current = null;
      firstBlockTimeRef.current = null;
      doneTimeRef.current = null;

      const streamId = crypto.randomUUID();
      const placeholderId = `streaming-${streamId}`;
      const input: StartStreamInput = {
        conversationId,
        message: trimmedMessage,
        mode,
        modelPreference,
        pageContext,
        timezone,
        attachments,
      };

      activeStreamIdRef.current = streamId;
      activeConversationIdRef.current = conversationId;
      activePlaceholderMessageIdRef.current = conversationId
        ? placeholderId
        : null;
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

        try {
          if (!tenantId || !userId) {
            throw new Error(
              "Sign in and select an organization to message Bloom.",
            );
          }

          const accessToken = session?.access_token;
          if (!accessToken) {
            throw new Error("Sign in to message Bloom.");
          }

          await insertOptimisticMessages(input, placeholderId);

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
                page_context: pageContext,
                timezone,
                attachments,
              }),
            },
          );

          if (!isCurrentStream()) {
            return;
          }

          if (!response.ok) {
            throw new Error(await readResponseErrorMessage(response));
          }

          if (!response.body) {
            throw new Error("Bloom Assist did not return a readable stream.");
          }

          setConnectionState("streaming");
          reader = response.body.getReader();
          readerRef.current = reader;
          const decoder = new TextDecoder();
          let buffer = "";

          const consumeBuffer = async (
            isFinal = false,
          ): Promise<TerminalEvent> => {
            const parts = buffer.split(/\r?\n\r?\n/);
            buffer = isFinal ? "" : (parts.pop() ?? "");

            for (const part of parts) {
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
              const terminal = await handleParsedEvent(parsed.event, input);
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
            patchPartialAssistantMessage();
            setStreamError("Connection lost. Partial response preserved.");
            setConnectionState("error");
          }
        } catch (error) {
          if (!isCurrentStream() || cancelRequestedRef.current) {
            return;
          }

          flushTextBuffer();
          patchPartialAssistantMessage();
          setActiveToolCall(null);
          setStreamError(
            error instanceof Error
              ? error.message
              : "Connection lost. Partial response preserved.",
          );
          setConnectionState("error");
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
      clearFlushInterval,
      flushTextBuffer,
      handleParsedEvent,
      insertOptimisticMessages,
      patchPartialAssistantMessage,
      resetStreamState,
      session?.access_token,
      startFlushInterval,
      tenantId,
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
    startStream,
    cancelStream,
    isStreaming:
      connectionState === "connecting" || connectionState === "streaming",
    streamingContent,
    streamingThinking,
    activeToolCall,
    streamError,
    connectionState,
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
  };
}
