import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type BloomMode = "standard" | "reasoning" | "research" | "image";
export type BloomModelPreference = "auto" | "standard" | "pro";

export type PageCategory =
  | "dashboard"
  | "customers"
  | "products"
  | "campaigns"
  | "segments"
  | "analytics"
  | "integrations"
  | "settings"
  | "bloom"
  | "other";

export type PageEntityType = "customer" | "product" | "campaign" | "segment";

export type BloomSessionType = "standard" | "resource_focused";

export type BloomResourceType =
  | "customer"
  | "product"
  | "order"
  | "campaign"
  | "segment"
  | "automation"
  | "invoice";

export type BloomResourceFocus = {
  resourceType: BloomResourceType;
  resourceId: string;
  resourceSummary: string;
};

export type PageContext = {
  pathname: string;
  pageCategory: PageCategory;
  entityType: PageEntityType | null;
  entityId: string | null;
  pageName: string;
  availableActions: string[];
  suggestions: string[];
};

export type EntitySummary = {
  entityType: PageEntityType;
  entityId: string;
  name: string;
  summaryText: string;
};

export type BloomAssistRequest = {
  conversation_id: string | null;
  message: string;
  mode: BloomMode;
  model_preference: BloomModelPreference | null;
  session_type: BloomSessionType;
  resource_focus: BloomResourceFocus | null;
  page_context: PageContext | null;
  timezone: string;
  attachments: JsonArray | null;
};

export type InputSecurityAssessment = {
  injectionDetected: boolean;
  detectionReason: string | null;
};

export type TokenCounts = {
  tokens_input: number;
  tokens_output: number;
};

export type BloomLatencyBreakdown = {
  server_ttft_ms: number | null;
  server_ttfb_ms: number | null;
  server_total_ms: number;
  context_build_ms: number | null;
  llm_latency_ms: number | null;
};

export type BloomCacheStats = {
  hits: number;
  misses: number;
  invalidations: number;
};

export type OpenAIChatRole = "system" | "user" | "assistant" | "tool";

export type OpenAITextContentPart = {
  type: "text";
  text: string;
};

export type OpenAIImageContentPart = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
};

export type OpenAIContentPart = OpenAITextContentPart | OpenAIImageContentPart;

export type OpenAIToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type OpenAIChatMessage = {
  role: OpenAIChatRole;
  content: string | OpenAIContentPart[] | null;
  tool_call_id?: string;
  tool_calls?: OpenAIToolCall[];
};

export type AttachmentContext = {
  contextInjections: string[];
  imageParts: OpenAIImageContentPart[];
};

export type OpenAIToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonObject;
  };
};

export type ToolDefinitionProvider = (args: {
  mode: BloomMode;
  userRole: string;
}) => OpenAIToolDefinition[] | Promise<OpenAIToolDefinition[]>;

export type ToolExecutionStatus =
  | "pending"
  | "executing"
  | "completed"
  | "failed";

export type BloomAuditEventType =
  | "prompt"
  | "tool_call"
  | "tool_result"
  | "response"
  | "approval"
  | "execution"
  | "error";

export type TokenSseEvent = {
  event: "token";
  data: { text: string };
};

export type ThinkingTokenSseEvent = {
  event: "thinking_token";
  data: { text: string };
};

export type ToolStartSseEvent = {
  event: "tool_start";
  data: { tool: string; params: JsonObject };
};

export type ToolResultSseEvent = {
  event: "tool_result";
  data: { tool: string; block_type: string; result: JsonValue };
};

export type ActionCardSseEvent = {
  event: "action_card";
  data: JsonObject;
};

export type ResearchStepSseEvent = {
  event: "research_step";
  data: {
    step_number: number;
    total_steps: number;
    label: string;
    status: "executing" | "completed" | "failed";
    tool_name: string;
  };
};

export type ErrorSseEvent = {
  event: "error";
  data: { message: string; code: string };
};

export type DoneSseEvent = {
  event: "done";
  data: TokenCounts & {
    model: string;
    conversation_id: string;
    assistant_message_id?: string;
    title?: string;
    follow_up_chips: JsonArray;
    latency_metrics?: BloomLatencyBreakdown;
    cache_stats?: BloomCacheStats;
    mode_override?: BloomMode;
  };
};

export type TaskPlanSseEvent = {
  event: "task_plan";
  data: JsonObject;
};

export type TaskProgressSseEvent = {
  event: "task_progress";
  data: JsonObject;
};

export type TaskCompleteSseEvent = {
  event: "task_complete";
  data: JsonObject;
};

export type BloomSseEvent =
  | TokenSseEvent
  | ThinkingTokenSseEvent
  | ToolStartSseEvent
  | ToolResultSseEvent
  | ActionCardSseEvent
  | ResearchStepSseEvent
  | TaskPlanSseEvent
  | TaskProgressSseEvent
  | TaskCompleteSseEvent
  | ErrorSseEvent
  | DoneSseEvent;

export type OrchestratorContext = {
  tenantId: string;
  userId: string;
  userRole: string;
  userName: string | null;
  conversationId: string | null;
};

export type PersistenceClient = SupabaseClient;

export type PersistUserMessageResult = {
  conversationId: string;
  messageId: string;
  isNewConversation: boolean;
  title: string | null;
};

export type PersistAssistantResponseResult = {
  messageId: string;
};

export type ContextBuildResult = {
  messages: OpenAIChatMessage[];
  tools: OpenAIToolDefinition[];
  estimatedInputTokens: number;
  truncatedHistoryCount: number;
};

export type ToolExecutorRequest = {
  id: string;
  name: string;
  arguments: JsonObject;
  conversationId: string;
  iteration: number;
};

export type ToolExecutorResult = {
  block_type: string;
  result: JsonValue;
  status: ToolExecutionStatus;
  execution_time_ms: number | null;
  error_message: string | null;
};

export type ToolExecutor = (
  request: ToolExecutorRequest,
) => Promise<ToolExecutorResult>;

export type StreamCompletion = {
  content: string;
  thinkingContent: string | null;
  followUpChips: JsonArray;
  tokenCounts: TokenCounts;
  blockData: JsonObject;
  model: string;
  finishReason: "completed" | "partial";
};

export type AuditTokenPayload = {
  input?: number;
  output?: number;
};

export type LogAuditEventOptions = {
  conversationId?: string | null;
  messageId?: string | null;
  model?: string | null;
  tokens?: AuditTokenPayload;
  latencyMs?: number | null;
};
