import type {
  JsonObject,
  JsonValue,
  OpenAIChatMessage,
  PersistenceClient,
} from "./types.ts";

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";
const COMPACTION_MODEL = "gpt-4o-mini";
const NO_COMPACTION_MAX_MESSAGES = 12;
const TIER_TWO_MAX_MESSAGES = 20;
const TIER_TWO_RECENT_MESSAGES = 8;
const TIER_THREE_RECENT_MESSAGES = 6;
const STALE_REFRESH_MESSAGES = 10;
const DEFAULT_MAX_SUMMARY_TOKENS = 800;
const EMERGENCY_MAX_SUMMARY_TOKENS = 600;
const SUMMARY_PROMPT_MAX_CHARS = 42_000;
const TOOL_IO_MAX_CHARS = 700;
const MESSAGE_CONTENT_MAX_CHARS = 2_400;

export type CompactionTier = 1 | 2 | 3;
export type CompactionTrigger = "none" | "threshold" | "stale" | "emergency";

export type CompactionCheckResult = {
  conversationId: string;
  needed: boolean;
  tier: CompactionTier;
  recentWindow: number;
  trigger: CompactionTrigger;
  reason: string | null;
};

export type CompactionMessageRange = {
  tenantId?: string;
  userId?: string;
  currentMessageId?: string;
  tier?: CompactionTier;
  recentWindow?: number;
  trigger?: Exclude<CompactionTrigger, "none">;
  maxSummaryTokens?: number;
};

export type CompactionSummary = {
  conversation_id: string;
  tenant_id: string;
  user_id: string;
  summary: string;
  model: string;
  first_message_id: string;
  last_message_id: string;
  message_count: number;
  generated_at: string;
  summary_token_count: number;
  cutoff_created_at: string;
  tier: CompactionTier;
  recent_window: number;
  trigger: Exclude<CompactionTrigger, "none">;
};

export type CompactionContextResult = {
  messages: OpenAIChatMessage[];
  summary: string | null;
  tier: CompactionTier;
  recentWindow: number;
  truncatedHistoryCount: number;
  compactionApplied: boolean;
  trigger: CompactionTrigger;
};

type ConversationCompactionRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  message_count: number;
  metadata: JsonObject;
};

type MessageRow = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string | null;
  thinking_content: string | null;
  created_at: string;
};

type ToolExecutionRow = {
  message_id: string;
  tool_name: string;
  tool_input: JsonObject;
  tool_output: JsonValue | null;
  status: string;
  error_message: string | null;
};

type StoredCompactionSummary = {
  summary: string;
  messageCount: number;
  tier: CompactionTier;
  recentWindow: number;
};

type StoredCompactionState = {
  messagesSummarizedCount: number;
  tier: CompactionTier;
  recentWindow: number;
};

type ContextOptions = {
  tenantId?: string;
  userId?: string;
  currentMessageId?: string;
  forceTrigger?: "emergency";
};

type TenantScope = {
  tenantId: string;
  userId: string;
};

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

  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function toJsonObject(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readTier(value: unknown, fallback: CompactionTier): CompactionTier {
  return value === 1 || value === 2 || value === 3 ? value : fallback;
}

function requireTenantScope(
  scope: { tenantId?: string; userId?: string },
  operation: string,
): TenantScope {
  if (!scope.tenantId || !scope.userId) {
    throw new Error(`Tenant and user scope are required to ${operation}`);
  }

  return {
    tenantId: scope.tenantId,
    userId: scope.userId,
  };
}

function limitText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxChars - 24)).trim()}\n[truncated]`;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function estimateMessageTokens(message: OpenAIChatMessage): number {
  return estimateTokens(`${message.role}\n${message.content ?? ""}`) + 4;
}

function estimateContextTokens(messages: OpenAIChatMessage[]): number {
  return messages.reduce(
    (total, message) => total + estimateMessageTokens(message),
    0,
  );
}

function limitToApproxTokens(value: string, maxTokens: number): string {
  return limitText(value, Math.max(1, maxTokens * 4));
}

function safeJsonStringify(
  value: JsonValue | unknown,
  maxChars: number,
): string {
  try {
    return limitText(JSON.stringify(value, null, 2), maxChars);
  } catch {
    return "[unserializable]";
  }
}

function tierForMessageCount(messageCount: number): CompactionTier {
  if (messageCount <= NO_COMPACTION_MAX_MESSAGES) {
    return 1;
  }

  return messageCount <= TIER_TWO_MAX_MESSAGES ? 2 : 3;
}

function recentWindowForTier(tier: CompactionTier): number {
  return tier === 3 ? TIER_THREE_RECENT_MESSAGES : TIER_TWO_RECENT_MESSAGES;
}

function parseStoredSummary(value: unknown): StoredCompactionSummary | null {
  if (typeof value === "string" && value.trim()) {
    return {
      summary: value.trim(),
      messageCount: 0,
      tier: 2,
      recentWindow: TIER_TWO_RECENT_MESSAGES,
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const summary = readString(value.summary) ?? readString(value.text);
  if (!summary) {
    return null;
  }

  const tier = readTier(value.tier, 2);
  return {
    summary,
    messageCount: readNumber(value.message_count, 0),
    tier,
    recentWindow: readNumber(value.recent_window, recentWindowForTier(tier)),
  };
}

function parseStoredState(value: unknown): StoredCompactionState | null {
  if (!isRecord(value)) {
    return null;
  }

  const tier = readTier(value.tier, 2);
  return {
    messagesSummarizedCount: readNumber(value.messages_summarized_count, 0),
    tier,
    recentWindow: readNumber(value.recent_window, recentWindowForTier(tier)),
  };
}

function extractCompactionSummary(metadata: JsonObject): string | null {
  return parseStoredSummary(metadata.compaction_summary)?.summary ?? null;
}

function parseConversationRow(
  value: unknown,
): ConversationCompactionRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const tenantId = readString(value.tenant_id);
  const userId = readString(value.user_id);
  if (!id || !tenantId || !userId) {
    return null;
  }

  return {
    id,
    tenant_id: tenantId,
    user_id: userId,
    message_count: readNumber(value.message_count, 0),
    metadata: toJsonObject(value.metadata),
  };
}

function parseMessageRows(value: unknown): MessageRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rows: MessageRow[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const id = readString(item.id);
    const createdAt = readString(item.created_at);
    const role = item.role;
    if (
      !id ||
      !createdAt ||
      (role !== "user" && role !== "assistant" && role !== "system")
    ) {
      continue;
    }

    rows.push({
      id,
      role,
      content: readString(item.content),
      thinking_content: readString(item.thinking_content),
      created_at: createdAt,
    });
  }

  return rows;
}

function parseToolExecutionRows(value: unknown): ToolExecutionRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rows: ToolExecutionRow[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const messageId = readString(item.message_id);
    const toolName = readString(item.tool_name);
    const status = readString(item.status);
    if (!messageId || !toolName || !status) {
      continue;
    }

    rows.push({
      message_id: messageId,
      tool_name: toolName,
      tool_input: toJsonObject(item.tool_input),
      tool_output: isJsonValue(item.tool_output) ? item.tool_output : null,
      status,
      error_message: readString(item.error_message),
    });
  }

  return rows;
}

async function loadConversation(
  serviceClient: PersistenceClient,
  conversationId: string,
  scope: TenantScope,
): Promise<ConversationCompactionRow> {
  const { data, error } = await serviceClient
    .from("bloom_conversations")
    .select("id, tenant_id, user_id, message_count, metadata")
    .eq("id", conversationId)
    .eq("tenant_id", scope.tenantId)
    .eq("user_id", scope.userId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `Failed to load conversation compaction state: ${error.message}`,
    );
  }

  const conversation = parseConversationRow(data);
  if (!conversation) {
    throw new Error("Conversation not found for compaction");
  }

  return conversation;
}

async function loadMessagesForSummary(
  serviceClient: PersistenceClient,
  conversation: ConversationCompactionRow,
  targetSummaryCount: number,
): Promise<{ summaryMessages: MessageRow[]; nextMessage: MessageRow | null }> {
  if (targetSummaryCount <= 0) {
    return { summaryMessages: [], nextMessage: null };
  }

  const { data, error } = await serviceClient
    .from("bloom_messages")
    .select("id, role, content, thinking_content, created_at")
    .eq("tenant_id", conversation.tenant_id)
    .eq("user_id", conversation.user_id)
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(targetSummaryCount + 1);

  if (error) {
    throw new Error(`Failed to load messages for compaction: ${error.message}`);
  }

  const rows = parseMessageRows(data);
  return {
    summaryMessages: rows.slice(0, targetSummaryCount),
    nextMessage: rows[targetSummaryCount] ?? null,
  };
}

async function loadRecentMessages(
  serviceClient: PersistenceClient,
  conversation: ConversationCompactionRow,
  tier: CompactionTier,
  recentWindow: number,
  currentMessageId?: string,
): Promise<MessageRow[]> {
  let query = serviceClient
    .from("bloom_messages")
    .select("id, role, content, thinking_content, created_at")
    .eq("tenant_id", conversation.tenant_id)
    .eq("user_id", conversation.user_id)
    .eq("conversation_id", conversation.id);

  if (tier === 1) {
    const { data, error } = await query.order("created_at", {
      ascending: true,
    });
    if (error) {
      throw new Error(
        `Failed to load uncompacted conversation history: ${error.message}`,
      );
    }

    return parseMessageRows(data).filter((row) => row.id !== currentMessageId);
  }

  const queryLimit = currentMessageId ? recentWindow + 1 : recentWindow;
  const { data, error } = await query
    .eq("is_compacted", false)
    .order("created_at", { ascending: false })
    .limit(queryLimit);

  if (error) {
    throw new Error(
      `Failed to load compaction-aware history: ${error.message}`,
    );
  }

  return parseMessageRows(data)
    .filter((row) => row.id !== currentMessageId)
    .slice(0, recentWindow)
    .reverse();
}

async function loadToolExecutionsForMessages(
  serviceClient: PersistenceClient,
  conversation: ConversationCompactionRow,
  messageIds: string[],
): Promise<ToolExecutionRow[]> {
  if (messageIds.length === 0) {
    return [];
  }

  const { data, error } = await serviceClient
    .from("bloom_tool_executions")
    .select(
      "message_id, tool_name, tool_input, tool_output, status, error_message",
    )
    .eq("tenant_id", conversation.tenant_id)
    .eq("user_id", conversation.user_id)
    .eq("conversation_id", conversation.id)
    .in("message_id", messageIds);

  if (error) {
    throw new Error(
      `Failed to load tool executions for compaction: ${error.message}`,
    );
  }

  return parseToolExecutionRows(data);
}

function groupToolExecutionsByMessage(
  rows: ToolExecutionRow[],
): Map<string, ToolExecutionRow[]> {
  const grouped = new Map<string, ToolExecutionRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.message_id) ?? [];
    existing.push(row);
    grouped.set(row.message_id, existing);
  }

  return grouped;
}

function countToolResults(output: JsonValue | null): number | null {
  if (Array.isArray(output)) {
    return output.length;
  }

  if (!isJsonObject(output)) {
    return null;
  }

  for (const key of ["count", "total", "total_count", "result_count"]) {
    const value = output[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  for (const key of [
    "data",
    "results",
    "items",
    "customers",
    "products",
    "orders",
    "campaigns",
    "segments",
  ]) {
    const value = output[key];
    if (Array.isArray(value)) {
      return value.length;
    }
  }

  return null;
}

function summarizeToolExecution(row: ToolExecutionRow): string {
  const resultCount = countToolResults(row.tool_output);
  const resultText =
    resultCount === null
      ? "a response"
      : `${resultCount} ${resultCount === 1 ? "result" : "results"}`;
  const inputText = safeJsonStringify(row.tool_input, TOOL_IO_MAX_CHARS);

  if (row.status === "failed") {
    return `Bloom queried ${row.tool_name} with ${inputText} and the tool failed${row.error_message ? `: ${row.error_message}` : "."}`;
  }

  return `Bloom queried ${row.tool_name} with ${inputText} and found ${resultText}.`;
}

function formatMessageForSummary(
  row: MessageRow,
  index: number,
  toolRows: ToolExecutionRow[],
): string {
  const messageText = limitText(row.content ?? "", MESSAGE_CONTENT_MAX_CHARS);
  const thinkingText = row.thinking_content
    ? `Reasoning trace: ${limitText(row.thinking_content, 900)}`
    : null;
  const toolText = toolRows.map(summarizeToolExecution).join("\n");

  return [
    `Message ${index + 1} (${row.role}, ${row.created_at})`,
    thinkingText,
    messageText ? `Content: ${messageText}` : null,
    toolText ? `Tool activity:\n${toolText}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSummaryPrompt(
  messages: MessageRow[],
  toolRows: ToolExecutionRow[],
): string {
  const groupedTools = groupToolExecutionsByMessage(toolRows);
  const transcript = messages
    .map((message, index) =>
      formatMessageForSummary(
        message,
        index,
        groupedTools.get(message.id) ?? [],
      ),
    )
    .join("\n\n---\n\n");

  return limitText(
    [
      "Summarize this Bloom Assist conversation history for future context.",
      "Preserve concrete entity names, customer or product filters, campaign or automation decisions, user preferences, unresolved questions, tool findings, and the trajectory of the work.",
      "Condense tool results into plain-language findings such as 'Bloom queried customers and found 12 matching customers.'",
      "Do not invent facts. Do not include generic commentary. Return only the summary.",
      "Transcript:",
      transcript,
    ].join("\n\n"),
    SUMMARY_PROMPT_MAX_CHARS,
  );
}

function extractOpenAiContent(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return null;
  }

  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return null;
  }

  return readString(firstChoice.message.content);
}

function computeCutoffCreatedAt(
  summaryMessages: MessageRow[],
  nextMessage: MessageRow | null,
): string {
  const lastMessage = summaryMessages[summaryMessages.length - 1];
  if (nextMessage && nextMessage.created_at > lastMessage.created_at) {
    return nextMessage.created_at;
  }

  const lastDate = new Date(lastMessage.created_at);
  if (Number.isNaN(lastDate.getTime())) {
    return lastMessage.created_at;
  }

  return new Date(lastDate.getTime() + 1).toISOString();
}

function toOpenAIHistoryMessage(row: MessageRow): OpenAIChatMessage | null {
  const thinkingPrefix = row.thinking_content
    ? `Previous reasoning trace:\n${row.thinking_content}\n\n`
    : "";
  const content = `${thinkingPrefix}${row.content ?? ""}`.trim();
  if (!content) {
    return null;
  }

  return {
    role: row.role,
    content,
  };
}

function buildLayerFiveMessages(
  summary: string | null,
  recentMessages: MessageRow[],
): OpenAIChatMessage[] {
  const messages: OpenAIChatMessage[] = [];

  if (summary) {
    messages.push({
      role: "system",
      content: `Layer 5 - Conversation compaction summary:\n${summary}`,
    });
  }

  const historyMessages = recentMessages
    .map(toOpenAIHistoryMessage)
    .filter((message): message is OpenAIChatMessage => Boolean(message));

  if (historyMessages.length > 0) {
    messages.push({
      role: "system",
      content: "Layer 5 - Recent conversation history follows.",
    });
    messages.push(...historyMessages);
  }

  return messages;
}

function trimHistoryToBudget(
  messages: OpenAIChatMessage[],
  tokenBudget: number,
): { messages: OpenAIChatMessage[]; truncatedHistoryCount: number } {
  const trimmed = [...messages];
  let truncatedHistoryCount = 0;

  while (estimateContextTokens(trimmed) > tokenBudget) {
    const dropIndex = trimmed.findIndex((message) => {
      const content =
        typeof message.content === "string" ? message.content : "";
      return !(
        message.role === "system" &&
        (content.startsWith("Layer 5 - Conversation compaction summary:") ||
          content === "Layer 5 - Recent conversation history follows.")
      );
    });

    if (dropIndex === -1) {
      break;
    }

    trimmed.splice(dropIndex, 1);
    truncatedHistoryCount += 1;
  }

  return { messages: trimmed, truncatedHistoryCount };
}

async function insertCompactionAuditEvent(
  serviceClient: PersistenceClient,
  summary: CompactionSummary,
): Promise<void> {
  const payload: JsonObject = {
    tier: summary.tier,
    recent_window: summary.recent_window,
    messages_summarized_count: summary.message_count,
    summary_token_count: summary.summary_token_count,
    trigger_type: summary.trigger,
    first_message_id: summary.first_message_id,
    last_message_id: summary.last_message_id,
  };

  const exactInsert = await serviceClient.from("bloom_audit_log").insert({
    tenant_id: summary.tenant_id,
    user_id: summary.user_id,
    conversation_id: summary.conversation_id,
    message_id: null,
    event_type: "compaction",
    event_data: payload,
    model_used: COMPACTION_MODEL,
    tokens_input: null,
    tokens_output: summary.summary_token_count,
    latency_ms: null,
  });

  if (!exactInsert.error) {
    return;
  }

  const fallbackPayload: JsonObject = {
    ...payload,
    requested_event_type: "compaction",
    stored_event_type: "execution",
  };

  const fallbackInsert = await serviceClient.from("bloom_audit_log").insert({
    tenant_id: summary.tenant_id,
    user_id: summary.user_id,
    conversation_id: summary.conversation_id,
    message_id: null,
    event_type: "execution",
    event_data: fallbackPayload,
    model_used: COMPACTION_MODEL,
    tokens_input: null,
    tokens_output: summary.summary_token_count,
    latency_ms: null,
  });

  if (fallbackInsert.error) {
    throw new Error(
      `Failed to log Bloom compaction audit event: ${fallbackInsert.error.message}`,
    );
  }
}

export function checkCompactionNeeded(
  conversationId: string,
  messageCount: number,
  metadata: JsonObject,
): CompactionCheckResult {
  const tier = tierForMessageCount(messageCount);
  const recentWindow = recentWindowForTier(tier);

  if (tier === 1) {
    return {
      conversationId,
      needed: false,
      tier,
      recentWindow: messageCount,
      trigger: "none",
      reason: null,
    };
  }

  const storedSummary = parseStoredSummary(metadata.compaction_summary);
  const storedState = parseStoredState(metadata.compaction_state);

  if (!storedSummary) {
    return {
      conversationId,
      needed: true,
      tier,
      recentWindow,
      trigger: "threshold",
      reason:
        "Conversation crossed compaction threshold without a stored summary.",
    };
  }

  const stateTier = storedState?.tier ?? storedSummary.tier;
  if (tier > stateTier) {
    return {
      conversationId,
      needed: true,
      tier,
      recentWindow,
      trigger: "threshold",
      reason: "Conversation crossed into a more aggressive compaction tier.",
    };
  }

  const summarizedCount =
    storedState?.messagesSummarizedCount || storedSummary.messageCount;
  const messagesBeyondRecentWindow =
    messageCount - summarizedCount - recentWindow;
  if (tier === 3 && messagesBeyondRecentWindow > STALE_REFRESH_MESSAGES) {
    return {
      conversationId,
      needed: true,
      tier,
      recentWindow,
      trigger: "stale",
      reason: "Stored compaction summary is stale for tier 3 context.",
    };
  }

  return {
    conversationId,
    needed: false,
    tier,
    recentWindow,
    trigger: "none",
    reason: null,
  };
}

export async function generateCompactionSummary(
  serviceClient: PersistenceClient,
  conversationId: string,
  messageRange: CompactionMessageRange,
): Promise<CompactionSummary> {
  const conversation = await loadConversation(
    serviceClient,
    conversationId,
    requireTenantScope(messageRange, "generate a Bloom compaction summary"),
  );
  const tier =
    messageRange.tier ?? tierForMessageCount(conversation.message_count);
  const recentWindow = messageRange.recentWindow ?? recentWindowForTier(tier);
  const trigger = messageRange.trigger ?? "threshold";
  const maxSummaryTokens =
    messageRange.maxSummaryTokens ?? DEFAULT_MAX_SUMMARY_TOKENS;
  const reservedCurrentMessage = messageRange.currentMessageId ? 1 : 0;
  const targetSummaryCount = Math.max(
    0,
    conversation.message_count - recentWindow - reservedCurrentMessage,
  );
  const { summaryMessages, nextMessage } = await loadMessagesForSummary(
    serviceClient,
    conversation,
    targetSummaryCount,
  );

  if (summaryMessages.length === 0) {
    throw new Error(
      "No messages are eligible for Bloom conversation compaction",
    );
  }

  const toolRows = await loadToolExecutionsForMessages(
    serviceClient,
    conversation,
    summaryMessages.map((message) => message.id),
  );
  const prompt = buildSummaryPrompt(summaryMessages, toolRows);
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is required for Bloom conversation compaction",
    );
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: COMPACTION_MODEL,
      temperature: 0.2,
      max_tokens: maxSummaryTokens,
      messages: [
        {
          role: "system",
          content:
            "You compact Bloom Assist conversation history into durable working memory. Return a faithful summary under the requested budget.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Bloom compaction summary generation failed: ${response.status}`,
    );
  }

  const payload: unknown = await response.json();
  const generatedSummary = extractOpenAiContent(payload);
  if (!generatedSummary) {
    throw new Error("Bloom compaction summary generation returned no content");
  }

  const summary = limitToApproxTokens(generatedSummary, maxSummaryTokens);
  const firstMessage = summaryMessages[0];
  const lastMessage = summaryMessages[summaryMessages.length - 1];
  return {
    conversation_id: conversation.id,
    tenant_id: conversation.tenant_id,
    user_id: conversation.user_id,
    summary,
    model: COMPACTION_MODEL,
    first_message_id: firstMessage.id,
    last_message_id: lastMessage.id,
    message_count: summaryMessages.length,
    generated_at: new Date().toISOString(),
    summary_token_count: estimateTokens(summary),
    cutoff_created_at: computeCutoffCreatedAt(summaryMessages, nextMessage),
    tier,
    recent_window: recentWindow,
    trigger,
  };
}

export async function applyCompaction(
  serviceClient: PersistenceClient,
  conversationId: string,
  summary: CompactionSummary,
): Promise<void> {
  const conversation = await loadConversation(serviceClient, conversationId, {
    tenantId: summary.tenant_id,
    userId: summary.user_id,
  });
  const metadata = conversation.metadata;
  const nextMetadata: JsonObject = {
    ...metadata,
    compaction_summary: {
      version: 1,
      summary: summary.summary,
      model: summary.model,
      first_message_id: summary.first_message_id,
      last_message_id: summary.last_message_id,
      message_count: summary.message_count,
      generated_at: summary.generated_at,
      summary_token_count: summary.summary_token_count,
      cutoff_created_at: summary.cutoff_created_at,
      tier: summary.tier,
      recent_window: summary.recent_window,
      trigger: summary.trigger,
    },
    compaction_state: {
      last_compacted_at: summary.generated_at,
      messages_summarized_count: summary.message_count,
      last_message_id: summary.last_message_id,
      summary_token_count: summary.summary_token_count,
      tier: summary.tier,
      recent_window: summary.recent_window,
      stale: false,
      trigger: summary.trigger,
    },
  };

  const { error: metadataError } = await serviceClient
    .from("bloom_conversations")
    .update({ metadata: nextMetadata })
    .eq("id", conversationId)
    .eq("tenant_id", summary.tenant_id)
    .eq("user_id", summary.user_id);

  if (metadataError) {
    throw new Error(
      `Failed to update compaction metadata: ${metadataError.message}`,
    );
  }

  const { error: messageError } = await serviceClient
    .from("bloom_messages")
    .update({ is_compacted: true })
    .eq("tenant_id", summary.tenant_id)
    .eq("user_id", summary.user_id)
    .eq("conversation_id", conversationId)
    .lt("created_at", summary.cutoff_created_at);

  if (messageError) {
    throw new Error(
      `Failed to mark Bloom messages as compacted: ${messageError.message}`,
    );
  }

  await insertCompactionAuditEvent(serviceClient, summary);
}

export async function getContextWithCompaction(
  serviceClient: PersistenceClient,
  conversationId: string,
  tokenBudget: number,
  options: ContextOptions = {},
): Promise<CompactionContextResult> {
  const scope = requireTenantScope(options, "build compaction-aware context");
  const conversation = await loadConversation(
    serviceClient,
    conversationId,
    scope,
  );
  const check = checkCompactionNeeded(
    conversation.id,
    conversation.message_count,
    conversation.metadata,
  );
  const forcedEmergency = options.forceTrigger === "emergency";
  const shouldCompact =
    check.needed ||
    (forcedEmergency &&
      conversation.message_count > TIER_THREE_RECENT_MESSAGES + 1);
  let summaryText = extractCompactionSummary(conversation.metadata);
  let appliedSummary: CompactionSummary | null = null;

  if (shouldCompact) {
    const tier = forcedEmergency ? 3 : check.tier;
    const recentWindow = forcedEmergency
      ? TIER_THREE_RECENT_MESSAGES
      : check.recentWindow;
    const trigger = forcedEmergency
      ? "emergency"
      : check.trigger === "none"
        ? "threshold"
        : check.trigger;
    appliedSummary = await generateCompactionSummary(
      serviceClient,
      conversation.id,
      {
        tenantId: conversation.tenant_id,
        userId: conversation.user_id,
        currentMessageId: options.currentMessageId,
        tier,
        recentWindow,
        trigger,
        maxSummaryTokens: forcedEmergency
          ? EMERGENCY_MAX_SUMMARY_TOKENS
          : DEFAULT_MAX_SUMMARY_TOKENS,
      },
    );
    await applyCompaction(serviceClient, conversation.id, appliedSummary);
    summaryText = appliedSummary.summary;
  }

  const activeTier = forcedEmergency ? 3 : (appliedSummary?.tier ?? check.tier);
  const recentWindow = forcedEmergency
    ? TIER_THREE_RECENT_MESSAGES
    : (appliedSummary?.recent_window ?? check.recentWindow);
  const recentMessages = await loadRecentMessages(
    serviceClient,
    conversation,
    activeTier,
    recentWindow,
    options.currentMessageId,
  );
  const layerMessages = buildLayerFiveMessages(summaryText, recentMessages);
  const trimmed = trimHistoryToBudget(layerMessages, tokenBudget);

  return {
    messages: trimmed.messages,
    summary: summaryText,
    tier: activeTier,
    recentWindow,
    truncatedHistoryCount: trimmed.truncatedHistoryCount,
    compactionApplied: Boolean(appliedSummary),
    trigger: appliedSummary?.trigger ?? check.trigger,
  };
}
