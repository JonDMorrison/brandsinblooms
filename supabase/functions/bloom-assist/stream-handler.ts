import type {
  BloomCacheStats,
  BloomLatencyBreakdown,
  BloomMode,
  BloomSseEvent,
  JsonArray,
  JsonObject,
  JsonValue,
  OpenAIChatMessage,
  OpenAIToolCall,
  OpenAIToolDefinition,
  StreamCompletion,
  TokenCounts,
  ToolExecutor,
  ToolExecutorResult,
} from "./types.ts";
import type { TaskPlanToolResult } from "./task-plan/types.ts";
import {
  parseResearchPlan,
  type ResearchPlanParseResult,
} from "./research-parser.ts";
import type {
  OutputValidationContext,
  OutputValidationResult,
} from "./security/output-validator.ts";
import { sandboxToolResult } from "./security/tool-result-sandbox.ts";

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";
const DEFAULT_MAX_TOOL_ITERATIONS = 10;
const MAX_OUTPUT_TOKENS = 8_000;
const MAX_RESEARCH_STEP_LABEL_CHARS = 180;
const TAGS_ALL_MODES = ["<follow_ups>", "</follow_ups>"];
const TAGS_REASONING = ["<thinking>", "</thinking>", "<answer>", "</answer>"];
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

type StreamHandlerOptions = {
  openAiApiKey: string;
  model: string;
  mode: BloomMode;
  modeOverride?: BloomMode | null;
  conversationId: string;
  conversationTitle?: string | null;
  messages: OpenAIChatMessage[];
  tools: OpenAIToolDefinition[];
  estimatedInputTokens: number;
  maxToolIterations?: number;
  validateOutput?: (
    response: string,
    context: OutputValidationContext,
  ) => OutputValidationResult;
  onOutputViolation?: (violation: OutputValidationResult) => Promise<void>;
  onSuspiciousEntityIds?: (audit: {
    suspiciousEntityIds: string[];
    knownEntityIdCount: number;
  }) => Promise<void>;
  onComplete: (completion: StreamCompletion) => Promise<void>;
  onTaskPlan?: (request: TaskPlanStreamRequest) => Promise<JsonObject>;
  onError?: (message: string, code: string) => Promise<void>;
  monitoring?: StreamMonitoringOptions;
  getDoneData?: () => JsonObject | null;
};

type StreamMonitoringOptions = {
  requestStartedAt: number;
  contextBuildCompletedAt: number | null;
  openAiRequestStartedAt: number | null;
  getCacheStats?: () => BloomCacheStats;
  onFirstOpenAiChunk?: (timestamp: number) => void;
  onFirstToken?: (timestamp: number) => void;
  onFirstToolResult?: (timestamp: number) => void;
  onDone?: (timestamp: number) => void;
};

type TaskPlanStreamRequest = {
  toolResults: TaskPlanToolResult[];
  content: string;
  thinkingContent: string | null;
  followUpChips: JsonArray;
  tokenCounts: TokenCounts;
  model: string;
};

type FinalizedCompletion = {
  followUpChips: JsonArray;
  tokenCounts: TokenCounts;
  blockData: JsonObject;
};

type OpenAIUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

type ToolCallDelta = {
  index: number;
  id: string | null;
  name: string | null;
  argumentsText: string;
};

type ToolCallAccumulator = {
  index: number;
  id: string;
  name: string;
  argumentsText: string;
};

type ParsedChunk = {
  content: string | null;
  toolCallDeltas: ToolCallDelta[];
  finishReason: string | null;
  usage: OpenAIUsage | null;
};

type ReadStreamResult = {
  toolCalls: OpenAIToolCall[];
  finishReason: string | null;
  usage: OpenAIUsage | null;
  cycleRawContent: string;
};

type ContentRoutingState = {
  rawContent: string;
  visibleContent: string;
  thinkingContent: string;
  pending: string;
  inThinking: boolean;
  inFollowUps: boolean;
};

type CompletionState = {
  completed: boolean;
};

type CancellationState = {
  cancelled: boolean;
};

type ResearchProgressState = {
  plan: ResearchPlanParseResult;
  toolCallCount: number;
  toolDescriptionsByName: Map<string, string>;
};

type StreamLatencyState = {
  firstOpenAiChunkAt: number | null;
  firstTokenEmittedAt: number | null;
  firstToolResultAt: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value) && Object.values(value).every(isJsonValue);
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

  return isJsonObject(value);
}

function extractUuidCandidates(value: string): string[] {
  UUID_PATTERN.lastIndex = 0;
  const matches = value.match(UUID_PATTERN);
  if (!matches) {
    return [];
  }

  return [...new Set(matches.map((match) => match.toLowerCase()))];
}

function collectKnownEntityIds(
  value: JsonValue,
  knownEntityIds: Set<string>,
): void {
  if (typeof value === "string") {
    for (const entityId of extractUuidCandidates(value)) {
      knownEntityIds.add(entityId);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectKnownEntityIds(entry, knownEntityIds);
    }
    return;
  }

  if (isJsonObject(value)) {
    for (const entry of Object.values(value)) {
      collectKnownEntityIds(entry, knownEntityIds);
    }
  }
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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function formatSseEvent(event: BloomSseEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

function createInitialRoutingState(): ContentRoutingState {
  return {
    rawContent: "",
    visibleContent: "",
    thinkingContent: "",
    pending: "",
    inThinking: false,
    inFollowUps: false,
  };
}

function usesThinkingTags(mode: BloomMode): boolean {
  return mode === "reasoning" || mode === "research";
}

function getRecognizedTags(mode: BloomMode): string[] {
  return usesThinkingTags(mode)
    ? [...TAGS_ALL_MODES, ...TAGS_REASONING]
    : TAGS_ALL_MODES;
}

function compactResearchStepLabel(value: string): string {
  const label = value.replace(/\s+/g, " ").trim();
  if (label.length <= MAX_RESEARCH_STEP_LABEL_CHARS) {
    return label;
  }

  return `${label.slice(0, MAX_RESEARCH_STEP_LABEL_CHARS - 3).trim()}...`;
}

function createResearchProgressState(
  tools: OpenAIToolDefinition[],
): ResearchProgressState {
  return {
    plan: { totalSteps: 0, stepLabels: [] },
    toolCallCount: 0,
    toolDescriptionsByName: new Map(
      tools.map((tool) => [tool.function.name, tool.function.description]),
    ),
  };
}

function refreshResearchPlan(
  progress: ResearchProgressState,
  thinkingContent: string,
): void {
  const parsedPlan = parseResearchPlan(thinkingContent);
  if (parsedPlan.totalSteps === 0) {
    return;
  }

  const mergedLabels = [...progress.plan.stepLabels];
  parsedPlan.stepLabels.forEach((label, index) => {
    if (label) {
      mergedLabels[index] = label;
    }
  });

  progress.plan = {
    totalSteps: Math.max(progress.plan.totalSteps, parsedPlan.totalSteps),
    stepLabels: mergedLabels,
  };
}

function getResearchStepLabel(
  progress: ResearchProgressState,
  stepNumber: number,
  toolName: string,
): string {
  const planLabel = progress.plan.stepLabels[stepNumber - 1];
  if (planLabel) {
    return compactResearchStepLabel(planLabel);
  }

  const toolDescription = progress.toolDescriptionsByName.get(toolName);
  if (toolDescription) {
    return compactResearchStepLabel(toolDescription);
  }

  return compactResearchStepLabel(`Run ${toolName.replace(/_/g, " ")}`);
}

function emitResearchStep(args: {
  emit: (event: BloomSseEvent) => void;
  progress: ResearchProgressState;
  stepNumber: number;
  label: string;
  status: "executing" | "completed" | "failed";
  toolName: string;
}): void {
  args.emit({
    event: "research_step",
    data: {
      step_number: args.stepNumber,
      total_steps: Math.max(args.progress.plan.totalSteps, args.stepNumber),
      label: args.label,
      status: args.status,
      tool_name: args.toolName,
    },
  });
}

function getSafeFlushIndex(buffer: string, tags: string[]): number {
  const lastOpen = buffer.lastIndexOf("<");
  if (lastOpen === -1) {
    return buffer.length;
  }

  const tail = buffer.slice(lastOpen);
  const couldBecomeKnownTag = tags.some((tag) => tag.startsWith(tail));
  return couldBecomeKnownTag ? lastOpen : buffer.length;
}

function findNextTagIndex(
  segment: string,
  tags: string[],
): {
  index: number;
  tag: string | null;
} {
  let nextIndex = -1;
  let nextTag: string | null = null;

  for (const tag of tags) {
    const candidateIndex = segment.indexOf(tag);
    if (candidateIndex === -1) {
      continue;
    }

    if (nextIndex === -1 || candidateIndex < nextIndex) {
      nextIndex = candidateIndex;
      nextTag = tag;
    }
  }

  return { index: nextIndex, tag: nextTag };
}

function emitText(
  text: string,
  state: ContentRoutingState,
  emit: (event: BloomSseEvent) => void,
): void {
  if (!text || state.inFollowUps) {
    return;
  }

  if (state.inThinking) {
    state.thinkingContent += text;
    emit({ event: "thinking_token", data: { text } });
    return;
  }

  state.visibleContent += text;
  emit({ event: "token", data: { text } });
}

function applyTag(tag: string, state: ContentRoutingState): void {
  switch (tag) {
    case "<thinking>":
      state.inThinking = true;
      break;
    case "</thinking>":
      state.inThinking = false;
      break;
    case "<answer>":
      state.inThinking = false;
      break;
    case "</answer>":
      break;
    case "<follow_ups>":
      state.inFollowUps = true;
      break;
    case "</follow_ups>":
      state.inFollowUps = false;
      break;
  }
}

function processStableText(
  stableText: string,
  tags: string[],
  state: ContentRoutingState,
  emit: (event: BloomSseEvent) => void,
): void {
  let remaining = stableText;

  while (remaining.length > 0) {
    const next = findNextTagIndex(remaining, tags);
    if (next.index === -1 || !next.tag) {
      emitText(remaining, state, emit);
      return;
    }

    const beforeTag = remaining.slice(0, next.index);
    emitText(beforeTag, state, emit);
    applyTag(next.tag, state);
    remaining = remaining.slice(next.index + next.tag.length);
  }
}

function routeContentChunk(
  chunk: string,
  mode: BloomMode,
  state: ContentRoutingState,
  emit: (event: BloomSseEvent) => void,
): void {
  state.rawContent += chunk;
  state.pending += chunk;

  const tags = getRecognizedTags(mode);
  const flushIndex = getSafeFlushIndex(state.pending, tags);
  if (flushIndex <= 0) {
    return;
  }

  const stableText = state.pending.slice(0, flushIndex);
  state.pending = state.pending.slice(flushIndex);
  processStableText(stableText, tags, state, emit);
}

function flushPendingContent(
  mode: BloomMode,
  state: ContentRoutingState,
  emit: (event: BloomSseEvent) => void,
): void {
  if (!state.pending) {
    return;
  }

  const tags = getRecognizedTags(mode);
  processStableText(state.pending, tags, state, emit);
  state.pending = "";
}

function parseOpenAIUsage(rawValue: unknown): OpenAIUsage | null {
  if (!isRecord(rawValue)) {
    return null;
  }

  return {
    prompt_tokens:
      typeof rawValue.prompt_tokens === "number"
        ? rawValue.prompt_tokens
        : undefined,
    completion_tokens:
      typeof rawValue.completion_tokens === "number"
        ? rawValue.completion_tokens
        : undefined,
  };
}

function parseToolCallDelta(rawValue: unknown): ToolCallDelta | null {
  if (!isRecord(rawValue) || typeof rawValue.index !== "number") {
    return null;
  }

  const functionValue = isRecord(rawValue.function) ? rawValue.function : {};
  return {
    index: rawValue.index,
    id: typeof rawValue.id === "string" ? rawValue.id : null,
    name: typeof functionValue.name === "string" ? functionValue.name : null,
    argumentsText:
      typeof functionValue.arguments === "string"
        ? functionValue.arguments
        : "",
  };
}

function parseOpenAIChunk(rawJson: string): ParsedChunk | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const choice =
    Array.isArray(parsed.choices) && isRecord(parsed.choices[0])
      ? parsed.choices[0]
      : null;
  const delta = choice && isRecord(choice.delta) ? choice.delta : {};
  const rawToolCalls = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
  const toolCallDeltas = rawToolCalls
    .map(parseToolCallDelta)
    .filter((deltaValue): deltaValue is ToolCallDelta => Boolean(deltaValue));

  return {
    content: typeof delta.content === "string" ? delta.content : null,
    toolCallDeltas,
    finishReason:
      choice && typeof choice.finish_reason === "string"
        ? choice.finish_reason
        : null,
    usage: parseOpenAIUsage(parsed.usage),
  };
}

function applyToolCallDelta(
  accumulators: Map<number, ToolCallAccumulator>,
  delta: ToolCallDelta,
): void {
  const existing = accumulators.get(delta.index) ?? {
    index: delta.index,
    id: delta.id ?? `call_${delta.index}`,
    name: delta.name ?? "",
    argumentsText: "",
  };

  if (delta.id) {
    existing.id = delta.id;
  }

  if (delta.name) {
    existing.name = delta.name;
  }

  existing.argumentsText += delta.argumentsText;
  accumulators.set(delta.index, existing);
}

function finalizeToolCalls(
  accumulators: Map<number, ToolCallAccumulator>,
): OpenAIToolCall[] {
  return [...accumulators.values()]
    .sort((left, right) => left.index - right.index)
    .filter((call) => call.name.trim().length > 0)
    .map((call) => ({
      id: call.id,
      type: "function",
      function: {
        name: call.name,
        arguments: call.argumentsText || "{}",
      },
    }));
}

function parseToolArguments(argumentsText: string): JsonObject {
  if (!argumentsText.trim()) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(argumentsText);
    return isJsonObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeToolResult(value: ToolExecutorResult): ToolExecutorResult {
  return {
    block_type: value.block_type || "data",
    result: isJsonValue(value.result) ? value.result : null,
    status: value.status,
    execution_time_ms: value.execution_time_ms,
    error_message: value.error_message,
  };
}

function getToolMessageContent(result: ToolExecutorResult): string {
  return JSON.stringify({
    block_type: result.block_type,
    status: result.status,
    result: result.result,
    error_message: result.error_message,
  });
}

async function readOpenAIStream(
  response: Response,
  mode: BloomMode,
  routingState: ContentRoutingState,
  cancellationState: CancellationState,
  emit: (event: BloomSseEvent) => void,
  onFirstChunk?: (timestamp: number) => void,
): Promise<ReadStreamResult> {
  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again shortly.");
    }
    if (response.status === 402) {
      throw new Error(
        "OpenAI billing requires attention before Bloom can respond.",
      );
    }
    throw new Error(`OpenAI request failed (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    throw new Error("OpenAI response did not include a stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const accumulators = new Map<number, ToolCallAccumulator>();
  let buffer = "";
  let finishReason: string | null = null;
  let usage: OpenAIUsage | null = null;
  let cycleRawContent = "";
  let firstChunkObserved = false;

  try {
    while (!cancellationState.cancelled) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!firstChunkObserved) {
        firstChunkObserved = true;
        onFirstChunk?.(Date.now());
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith("data:")) {
          continue;
        }

        const data = trimmedLine.slice("data:".length).trim();
        if (data === "[DONE]") {
          flushPendingContent(mode, routingState, emit);
          return {
            toolCalls: finalizeToolCalls(accumulators),
            finishReason,
            usage,
            cycleRawContent,
          };
        }

        const parsedChunk = parseOpenAIChunk(data);
        if (!parsedChunk) {
          continue;
        }

        if (parsedChunk.content) {
          cycleRawContent += parsedChunk.content;
          routeContentChunk(parsedChunk.content, mode, routingState, emit);
        }

        for (const toolCallDelta of parsedChunk.toolCallDeltas) {
          applyToolCallDelta(accumulators, toolCallDelta);
        }

        if (parsedChunk.finishReason) {
          finishReason = parsedChunk.finishReason;
        }

        if (parsedChunk.usage) {
          usage = parsedChunk.usage;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  flushPendingContent(mode, routingState, emit);
  return {
    toolCalls: finalizeToolCalls(accumulators),
    finishReason,
    usage,
    cycleRawContent,
  };
}

async function requestOpenAIStream(
  openAiApiKey: string,
  model: string,
  messages: OpenAIChatMessage[],
  tools: OpenAIToolDefinition[],
  forceTextOnly: boolean,
): Promise<Response> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.3,
    max_tokens: MAX_OUTPUT_TOKENS,
    stream: true,
    stream_options: { include_usage: true },
  };

  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = forceTextOnly ? "none" : "auto";
  }

  return fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function parseFollowUpChips(rawContent: string): JsonArray {
  const match = rawContent.match(/<follow_ups>([\s\S]*?)<\/follow_ups>/i);
  const chips: JsonArray = [];

  if (!match) {
    return chips;
  }

  try {
    const parsed: unknown = JSON.parse(match[1].trim());
    if (!Array.isArray(parsed)) {
      return chips;
    }

    for (const value of parsed) {
      if (typeof value !== "string") {
        continue;
      }
      const chip = value.trim();
      if (chip) {
        chips.push(chip.slice(0, 80));
      }
      if (chips.length >= 4) {
        break;
      }
    }
  } catch {
    return [];
  }

  return chips;
}

function stripResponseTags(content: string): string {
  return content
    .replace(/<follow_ups>[\s\S]*?<\/follow_ups>/gi, "")
    .replace(/<\/?answer>/gi, "")
    .replace(/<\/?thinking>/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function computeTokenCounts(
  usage: OpenAIUsage | null,
  estimatedInputTokens: number,
  rawContent: string,
): TokenCounts {
  return {
    tokens_input: usage?.prompt_tokens ?? estimatedInputTokens,
    tokens_output: usage?.completion_tokens ?? estimateTokens(rawContent),
  };
}

function buildLatencyBreakdown(
  monitoring: StreamMonitoringOptions | undefined,
  latencyState: StreamLatencyState,
  doneAt: number,
): BloomLatencyBreakdown | null {
  if (!monitoring) {
    return null;
  }

  const toDelta = (startAt: number | null, endAt: number | null) =>
    startAt === null || endAt === null ? null : Math.max(0, endAt - startAt);

  return {
    server_ttft_ms: toDelta(
      monitoring.requestStartedAt,
      latencyState.firstTokenEmittedAt,
    ),
    server_ttfb_ms: toDelta(
      monitoring.requestStartedAt,
      latencyState.firstToolResultAt,
    ),
    server_total_ms: Math.max(0, doneAt - monitoring.requestStartedAt),
    context_build_ms: toDelta(
      monitoring.requestStartedAt,
      monitoring.contextBuildCompletedAt,
    ),
    llm_latency_ms: toDelta(
      monitoring.openAiRequestStartedAt,
      latencyState.firstOpenAiChunkAt,
    ),
  };
}

function buildDoneData(
  options: StreamHandlerOptions,
  tokenCounts: TokenCounts,
  followUpChips: JsonArray,
  latencyBreakdown: BloomLatencyBreakdown | null,
  cacheStats: BloomCacheStats | null,
) {
  return {
    tokens_input: tokenCounts.tokens_input,
    tokens_output: tokenCounts.tokens_output,
    model: options.model,
    conversation_id: options.conversationId,
    ...(options.conversationTitle ? { title: options.conversationTitle } : {}),
    follow_up_chips: followUpChips,
    ...(latencyBreakdown ? { latency_metrics: latencyBreakdown } : {}),
    ...(cacheStats ? { cache_stats: cacheStats } : {}),
    ...(options.modeOverride ? { mode_override: options.modeOverride } : {}),
    ...(options.getDoneData?.() ?? {}),
  };
}

async function executeAndAppendTools(args: {
  toolCalls: OpenAIToolCall[];
  messages: OpenAIChatMessage[];
  conversationId: string;
  iteration: number;
  executor: ToolExecutor;
  knownEntityIds: Set<string>;
  emit: (event: BloomSseEvent) => void;
  researchProgress: ResearchProgressState | null;
  thinkingContent: string;
  actionCards: JsonObject[];
}): Promise<TaskPlanToolResult[]> {
  const confirmationResults: TaskPlanToolResult[] = [];

  for (const toolCall of args.toolCalls) {
    const toolArguments = parseToolArguments(toolCall.function.arguments);
    let researchStep: {
      stepNumber: number;
      label: string;
      toolName: string;
    } | null = null;

    if (args.researchProgress) {
      refreshResearchPlan(args.researchProgress, args.thinkingContent);
      args.researchProgress.toolCallCount += 1;
      const stepNumber = args.researchProgress.toolCallCount;
      const label = getResearchStepLabel(
        args.researchProgress,
        stepNumber,
        toolCall.function.name,
      );
      researchStep = { stepNumber, label, toolName: toolCall.function.name };
      emitResearchStep({
        emit: args.emit,
        progress: args.researchProgress,
        stepNumber,
        label,
        status: "executing",
        toolName: toolCall.function.name,
      });
    }

    args.emit({
      event: "tool_start",
      data: { tool: toolCall.function.name, params: toolArguments },
    });

    const startedAt = Date.now();
    let result: ToolExecutorResult;
    try {
      result = normalizeToolResult(
        await args.executor({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: toolArguments,
          conversationId: args.conversationId,
          iteration: args.iteration,
        }),
      );
    } catch (error) {
      result = {
        block_type: "error",
        result: { message: toErrorMessage(error) },
        status: "failed",
        execution_time_ms: Date.now() - startedAt,
        error_message: toErrorMessage(error),
      };
    }

    if (result.result !== null) {
      collectKnownEntityIds(result.result, args.knownEntityIds);
    }

    if (result.block_type === "mutation_action" && isJsonObject(result.result)) {
      args.actionCards.push(result.result);
      args.emit({
        event: "action_card",
        data: result.result,
      });
    } else {
      args.emit({
        event: "tool_result",
        data: {
          tool: toolCall.function.name,
          block_type: result.block_type,
          result: result.result,
        },
      });
    }

    if (args.researchProgress && researchStep) {
      emitResearchStep({
        emit: args.emit,
        progress: args.researchProgress,
        stepNumber: researchStep.stepNumber,
        label: researchStep.label,
        status: result.status === "failed" ? "failed" : "completed",
        toolName: researchStep.toolName,
      });
    }

    args.messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: sandboxToolResult(getToolMessageContent(result)),
    });

    if (
      isJsonObject(result.result) &&
      result.result.confirmation_required === true
    ) {
      confirmationResults.push({
        tool_call_id: toolCall.id,
        tool_name: toolCall.function.name,
        tool_params: toolArguments,
        tool_result: result.result,
        block_type: result.block_type,
        execution_time_ms: result.execution_time_ms,
        error_message: result.error_message,
        iteration: args.iteration,
      });
    }
  }

  return confirmationResults;
}

export function processOpenAIStream(
  response: Response,
  toolExecutor: ToolExecutor,
  options: StreamHandlerOptions,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const routingState = createInitialRoutingState();
  const completionState: CompletionState = { completed: false };
  const cancellationState: CancellationState = { cancelled: false };
  const messages = [...options.messages];
  const researchProgress =
    options.mode === "research"
      ? createResearchProgressState(options.tools)
      : null;
  const maxToolIterations =
    options.maxToolIterations ?? DEFAULT_MAX_TOOL_ITERATIONS;
  let latestUsage: OpenAIUsage | null = null;
  let finalizedCompletion: FinalizedCompletion | null = null;
  const knownEntityIds = new Set<string>();
  const actionCards: JsonObject[] = [];
  const latencyState: StreamLatencyState = {
    firstOpenAiChunkAt: null,
    firstTokenEmittedAt: null,
    firstToolResultAt: null,
  };

  const emitToController = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    event: BloomSseEvent,
  ) => {
    if (cancellationState.cancelled) {
      return;
    }
    controller.enqueue(encoder.encode(formatSseEvent(event)));
  };

  const completeOnce = async (
    finishReason: "completed" | "partial",
  ): Promise<FinalizedCompletion | null> => {
    if (completionState.completed) {
      return finalizedCompletion;
    }

    completionState.completed = true;
    flushPendingContent(options.mode, routingState, () => undefined);
    let followUpChips = parseFollowUpChips(routingState.rawContent);
    let content = stripResponseTags(routingState.visibleContent);
    const outputValidation = options.validateOutput?.(content, {
      knownEntityIds,
    });
    if (outputValidation?.suspiciousEntityIds.length) {
      await options.onSuspiciousEntityIds?.({
        suspiciousEntityIds: outputValidation.suspiciousEntityIds,
        knownEntityIdCount: knownEntityIds.size,
      });
    }
    if (outputValidation && !outputValidation.valid) {
      await options.onOutputViolation?.(outputValidation);
      content = outputValidation.sanitizedResponse;
      followUpChips = [];
    }
    const thinkingContent = routingState.thinkingContent.trim() || null;
    const tokenCounts = computeTokenCounts(
      latestUsage,
      options.estimatedInputTokens,
      routingState.rawContent,
    );

    finalizedCompletion = {
      followUpChips,
      tokenCounts,
      blockData:
        actionCards.length > 0
          ? {
              blocks: [
                { block_type: "text", content, payload: {} },
                ...actionCards.map((card) => ({
                  block_type: "mutation_action",
                  content:
                    typeof card.description === "string" ? card.description : "",
                  payload: card,
                })),
              ],
            }
          : {},
    };

    await options.onComplete({
      content,
      thinkingContent,
      followUpChips,
      tokenCounts,
      blockData: finalizedCompletion.blockData,
      model: options.model,
      finishReason,
    });

    return finalizedCompletion;
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let currentResponse = response;
      let iteration = 0;

      const emit = (event: BloomSseEvent) => {
        const now = Date.now();

        if (
          event.event === "token" &&
          latencyState.firstTokenEmittedAt === null
        ) {
          latencyState.firstTokenEmittedAt = now;
          options.monitoring?.onFirstToken?.(now);
        }

        if (
          event.event === "tool_result" &&
          latencyState.firstToolResultAt === null
        ) {
          latencyState.firstToolResultAt = now;
          options.monitoring?.onFirstToolResult?.(now);
        }

        emitToController(controller, event);
      };

      const emitDone = (tokenCounts: TokenCounts, followUpChips: JsonArray) => {
        const doneAt = Date.now();
        options.monitoring?.onDone?.(doneAt);
        emitToController(controller, {
          event: "done",
          data: buildDoneData(
            options,
            tokenCounts,
            followUpChips,
            buildLatencyBreakdown(options.monitoring, latencyState, doneAt),
            options.monitoring?.getCacheStats?.() ?? null,
          ),
        });
      };

      try {
        while (!cancellationState.cancelled) {
          const streamResult = await readOpenAIStream(
            currentResponse,
            options.mode,
            routingState,
            cancellationState,
            emit,
            (timestamp) => {
              if (latencyState.firstOpenAiChunkAt !== null) {
                return;
              }

              latencyState.firstOpenAiChunkAt = timestamp;
              options.monitoring?.onFirstOpenAiChunk?.(timestamp);
            },
          );

          latestUsage = streamResult.usage ?? latestUsage;

          if (streamResult.toolCalls.length === 0) {
            const completion = await completeOnce("completed");
            const followUpChips = completion?.followUpChips ?? [];
            const tokenCounts =
              completion?.tokenCounts ??
              computeTokenCounts(
                latestUsage,
                options.estimatedInputTokens,
                routingState.rawContent,
              );
            emitDone(tokenCounts, followUpChips);
            break;
          }

          if (iteration >= maxToolIterations) {
            messages.push({
              role: "system",
              content:
                "Maximum tool calls reached. Please provide your best response with available information.",
            });
            currentResponse = await requestOpenAIStream(
              options.openAiApiKey,
              options.model,
              messages,
              options.tools,
              true,
            );
            continue;
          }

          iteration += 1;
          messages.push({
            role: "assistant",
            content: streamResult.cycleRawContent.trim() || null,
            tool_calls: streamResult.toolCalls,
          });

          const confirmationResults = await executeAndAppendTools({
            toolCalls: streamResult.toolCalls,
            messages,
            conversationId: options.conversationId,
            iteration,
            executor: toolExecutor,
            knownEntityIds,
            emit,
            researchProgress,
            thinkingContent: routingState.thinkingContent,
            actionCards,
          });

          if (confirmationResults.length > 0 && options.onTaskPlan) {
            flushPendingContent(options.mode, routingState, emit);
            let followUpChips = parseFollowUpChips(routingState.rawContent);
            let content =
              stripResponseTags(routingState.visibleContent) ||
              "I prepared a task plan for your approval.";
            const outputValidation = options.validateOutput?.(content, {
              knownEntityIds,
            });
            if (outputValidation?.suspiciousEntityIds.length) {
              await options.onSuspiciousEntityIds?.({
                suspiciousEntityIds: outputValidation.suspiciousEntityIds,
                knownEntityIdCount: knownEntityIds.size,
              });
            }
            if (outputValidation && !outputValidation.valid) {
              await options.onOutputViolation?.(outputValidation);
              content =
                outputValidation.sanitizedResponse ||
                "I prepared a task plan for your approval.";
              followUpChips = [];
            }
            const tokenCounts = computeTokenCounts(
              latestUsage,
              options.estimatedInputTokens,
              routingState.rawContent,
            );
            const thinkingContent = routingState.thinkingContent.trim() || null;
            const taskPlanPayload = await options.onTaskPlan({
              toolResults: confirmationResults,
              content,
              thinkingContent,
              followUpChips,
              tokenCounts,
              model: options.model,
            });

            completionState.completed = true;
            finalizedCompletion = { followUpChips, tokenCounts, blockData: {} };
            emit({ event: "task_plan", data: taskPlanPayload });
            emitDone(tokenCounts, followUpChips);
            break;
          }

          currentResponse = await requestOpenAIStream(
            options.openAiApiKey,
            options.model,
            messages,
            options.tools,
            false,
          );
        }

        if (cancellationState.cancelled) {
          await completeOnce("partial");
        }
      } catch (error) {
        const message = toErrorMessage(error);
        try {
          await options.onError?.(message, "stream_error");
        } finally {
          if (routingState.rawContent.trim()) {
            await completeOnce("partial");
          }

          emit({
            event: "error",
            data: { message, code: "stream_error" },
          });
        }
      } finally {
        controller.close();
      }
    },
    async cancel() {
      cancellationState.cancelled = true;
      if (routingState.rawContent.trim()) {
        await completeOnce("partial");
      }
    },
  });
}
