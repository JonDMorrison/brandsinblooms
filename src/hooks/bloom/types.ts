import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type BloomMode = "standard" | "reasoning" | "research" | "image";
export type BloomModelPreference = "auto" | "standard" | "pro";
export type BloomResponseDensityPreference =
  | "concise"
  | "balanced"
  | "detailed";
export type BloomDefaultModePreference = Extract<
  BloomMode,
  "standard" | "reasoning" | "research"
>;

export interface BloomPreferences {
  density: BloomResponseDensityPreference;
  default_mode: BloomDefaultModePreference;
  default_model: BloomModelPreference;
  about_me: string;
  response_style: string;
  response_density: BloomResponseDensityPreference;
}

export const DEFAULT_BLOOM_PREFERENCES: BloomPreferences = {
  density: "balanced",
  default_mode: "standard",
  default_model: "auto",
  about_me: "",
  response_style: "",
  response_density: "balanced",
};

export type BloomConversationStatus =
  | "active"
  | "pinned"
  | "archived"
  | "deleted";

export type BloomMessageRole = "user" | "assistant" | "system";

export type BloomJsonArray = Json[];
export type BloomJsonObject = { [key: string]: Json | undefined };
export type MessageFeedback = "positive" | "negative" | null;
export type BloomMessageMetadata = BloomJsonObject & {
  feedback?: MessageFeedback;
};

export type BloomAuditSecurityEventType =
  | "injection_attempt"
  | "output_violation"
  | "cross_tenant_attempt"
  | "rate_limit";

export type BloomAuditEventType =
  | "prompt"
  | "tool_call"
  | "tool_result"
  | "response"
  | "approval"
  | "execution"
  | "error"
  | BloomAuditSecurityEventType;

export type BloomAdminAnalyticsPeriodPreset =
  | "this_month"
  | "last_month"
  | "this_week"
  | "last_7_days"
  | "last_30_days";

export interface BloomAdminDateRange {
  start: string;
  end: string;
}

export type BloomAdminAnalyticsPeriod =
  | BloomAdminAnalyticsPeriodPreset
  | BloomAdminDateRange;

export interface BloomUsageOverview {
  conversation_count: number;
  message_count: number;
  total_tokens: number;
  estimated_cost: number;
  active_user_count: number;
  avg_latency_ms: number | null;
}

export interface BloomDailyVolumePoint {
  date: string;
  message_count: number;
  token_count: number;
}

export type BloomDailyVolume = BloomDailyVolumePoint[];

export interface BloomModelDistributionItem {
  model: string;
  token_count: number;
  percentage: number;
  estimated_cost: number;
}

export type BloomModelDistribution = BloomModelDistributionItem[];

export interface BloomToolUsageStat {
  tool_name: string;
  call_count: number;
  avg_execution_time_ms: number | null;
  success_rate: number;
}

export type BloomToolUsageStats = BloomToolUsageStat[];

export interface BloomAuditEntry {
  id: string;
  timestamp: string;
  user_id: string;
  user_display_name: string;
  event_type: BloomAuditEventType;
  tool_name: string | null;
  model_used: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  latency_ms: number | null;
  event_data: BloomJsonObject;
}

export interface BloomAuditLogFilters {
  event_type?: BloomAuditEventType | null;
  user_id?: string | null;
  date_range?: Partial<BloomAdminDateRange> | null;
  tool_name?: string | null;
}

export interface BloomConversation {
  id: string;
  title: string;
  status: BloomConversationStatus;
  mode: BloomMode;
  messageCount: number;
  lastMessagePreview: string;
  createdAt: string;
  updatedAt: string;
}

export interface BloomMessage {
  id: string;
  conversationId: string;
  role: BloomMessageRole;
  text: string;
  thinkingContent: string | null;
  blockData: Json;
  mode: BloomMode;
  model: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  attachments: BloomJsonArray;
  followUpChips: BloomJsonArray;
  isBookmarked: boolean;
  isCompacted: boolean;
  metadata: BloomMessageMetadata;
  createdAt: string;
  toolExecutions?: BloomToolExecution[];
}

export interface BloomToolExecution {
  id: string;
  messageId: string;
  conversationId: string;
  toolName: string;
  toolInput: Json;
  toolOutput: Json | null;
  status: BloomToolExecutionStatus;
  errorMessage: string | null;
  executionTimeMs: number | null;
  createdAt: string;
}

export type BloomPageCategory =
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

export type BloomPageEntityType =
  | "customer"
  | "product"
  | "campaign"
  | "segment";

export type BloomInsightSeverity = "info" | "warning" | "critical";
export type BloomOnboardingTipId =
  | "slash_commands"
  | "task_plans"
  | "reasoning_mode"
  | "cmd_k_shortcut";
export type BloomToolExecutionStatus =
  | "pending"
  | "executing"
  | "completed"
  | "failed";

export interface BloomPageContext {
  pathname: string;
  pageCategory: BloomPageCategory;
  entityType: BloomPageEntityType | null;
  entityId: string | null;
  pageName: string;
  availableActions: string[];
  suggestions: string[];
}

export type BloomPageContextPayload = BloomPageContext;

export interface BloomEntitySummaryDetail {
  label: string;
  value: string;
}

export interface BloomEntitySummary {
  entityType: BloomPageEntityType;
  entityId: string;
  name: string;
  summaryText: string;
  detailItems: BloomEntitySummaryDetail[];
}

export interface BloomProactiveInsight {
  id: string;
  tenantId: string;
  insightType: string;
  title: string;
  description: string;
  actionPrompt: string | null;
  entityType: BloomPageEntityType | null;
  entityId: string | null;
  severity: BloomInsightSeverity;
  dismissedBy: string[];
  expiresAt: string | null;
  createdAt: string;
}

export interface BloomConversationRow {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string | null;
  status: BloomConversationStatus;
  mode: BloomMode;
  message_count: number;
  last_message_preview: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface BloomConversationInsert {
  id?: string;
  tenant_id: string;
  user_id: string;
  title?: string | null;
  status?: BloomConversationStatus;
  mode?: BloomMode;
  message_count?: number;
  last_message_preview?: string | null;
  metadata?: Json;
  created_at?: string;
  updated_at?: string;
}

export interface BloomConversationUpdate {
  title?: string | null;
  status?: BloomConversationStatus;
  mode?: BloomMode;
  message_count?: number;
  last_message_preview?: string | null;
  metadata?: Json;
  updated_at?: string;
}

export interface BloomMessageRow {
  id: string;
  conversation_id: string;
  tenant_id: string;
  user_id: string;
  role: BloomMessageRole;
  content: string | null;
  thinking_content: string | null;
  block_data: Json;
  mode: BloomMode;
  model: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  attachments: Json;
  follow_up_chips: Json;
  is_bookmarked: boolean;
  is_compacted: boolean;
  metadata: Json;
  created_at: string;
}

export interface BloomMessageInsert {
  id?: string;
  conversation_id: string;
  tenant_id: string;
  user_id: string;
  role: BloomMessageRole;
  content?: string | null;
  thinking_content?: string | null;
  block_data?: Json;
  mode?: BloomMode;
  model?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  attachments?: Json;
  follow_up_chips?: Json;
  is_bookmarked?: boolean;
  is_compacted?: boolean;
  metadata?: Json;
  created_at?: string;
}

export interface BloomMessageUpdate {
  content?: string | null;
  thinking_content?: string | null;
  block_data?: Json;
  mode?: BloomMode;
  model?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  attachments?: Json;
  follow_up_chips?: Json;
  is_bookmarked?: boolean;
  is_compacted?: boolean;
  metadata?: Json;
}

export interface BloomToolExecutionRow {
  id: string;
  message_id: string;
  conversation_id: string;
  tenant_id: string;
  user_id: string;
  tool_name: string;
  tool_input: Json;
  tool_output: Json | null;
  status: BloomToolExecutionStatus;
  error_message: string | null;
  execution_time_ms: number | null;
  created_at: string;
}

export interface BloomToolExecutionInsert {
  id?: string;
  message_id: string;
  conversation_id: string;
  tenant_id: string;
  user_id: string;
  tool_name: string;
  tool_input?: Json;
  tool_output?: Json | null;
  status?: BloomToolExecutionStatus;
  error_message?: string | null;
  execution_time_ms?: number | null;
  created_at?: string;
}

export interface BloomToolExecutionUpdate {
  tool_name?: string;
  tool_input?: Json;
  tool_output?: Json | null;
  status?: BloomToolExecutionStatus;
  error_message?: string | null;
  execution_time_ms?: number | null;
  created_at?: string;
}

export interface BloomUserProfileRow {
  id: string;
  tenant_id: string;
  user_id: string;
  interaction_count: number;
  onboarding_stage: number;
  seen_tips: string[];
  workspace_memory: Json;
  preferences: Json;
  created_at: string;
  updated_at: string;
}

export interface BloomUserProfile {
  id: string;
  tenantId: string;
  userId: string;
  interactionCount: number;
  onboardingStage: number;
  seenTips: string[];
  workspaceMemory: BloomJsonObject;
  preferences: BloomPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface BloomUserProfileInsert {
  id?: string;
  tenant_id: string;
  user_id: string;
  interaction_count?: number;
  onboarding_stage?: number;
  seen_tips?: string[];
  workspace_memory?: Json;
  preferences?: Json;
  created_at?: string;
  updated_at?: string;
}

export interface BloomUserProfileUpdate {
  interaction_count?: number;
  onboarding_stage?: number;
  seen_tips?: string[];
  workspace_memory?: Json;
  preferences?: Json;
  updated_at?: string;
}

export interface BloomProactiveInsightRow {
  id: string;
  tenant_id: string;
  insight_type: string;
  title: string;
  description: string;
  action_prompt: string | null;
  entity_type: BloomPageEntityType | null;
  entity_id: string | null;
  severity: BloomInsightSeverity;
  dismissed_by: string[];
  expires_at: string | null;
  created_at: string;
}

export interface BloomProactiveInsightInsert {
  id?: string;
  tenant_id: string;
  insight_type: string;
  title: string;
  description: string;
  action_prompt?: string | null;
  entity_type?: BloomPageEntityType | null;
  entity_id?: string | null;
  severity?: BloomInsightSeverity;
  dismissed_by?: string[];
  expires_at?: string | null;
  created_at?: string;
}

export interface BloomProactiveInsightUpdate {
  insight_type?: string;
  title?: string;
  description?: string;
  action_prompt?: string | null;
  entity_type?: BloomPageEntityType | null;
  entity_id?: string | null;
  severity?: BloomInsightSeverity;
  dismissed_by?: string[];
  expires_at?: string | null;
  created_at?: string;
}

export interface BloomAuditLogRow {
  id: string;
  tenant_id: string;
  user_id: string;
  conversation_id: string | null;
  message_id: string | null;
  event_type: BloomAuditEventType;
  event_data: Json;
  model_used: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  latency_ms: number | null;
  created_at: string;
}

export interface BloomAuditLogInsert {
  id?: string;
  tenant_id: string;
  user_id: string;
  conversation_id?: string | null;
  message_id?: string | null;
  event_type: BloomAuditEventType;
  event_data?: Json;
  model_used?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  latency_ms?: number | null;
  created_at?: string;
}

export interface BloomAuditLogUpdate {
  conversation_id?: string | null;
  message_id?: string | null;
  event_type?: BloomAuditEventType;
  event_data?: Json;
  model_used?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  latency_ms?: number | null;
  created_at?: string;
}

export interface BloomAuditUserRow {
  id: string;
  email: string;
  full_name: string | null;
  name: string;
  tenant_id: string | null;
  role: string;
  created_at: string;
  created_by_user_id: string | null;
  last_sign_in_at: string | null;
}

export interface BloomAuditUserInsert {
  id?: string;
  email: string;
  full_name?: string | null;
  name: string;
  tenant_id?: string | null;
  role?: string;
  created_at?: string;
  created_by_user_id?: string | null;
  last_sign_in_at?: string | null;
}

export interface BloomAuditUserUpdate {
  id?: string;
  email?: string;
  full_name?: string | null;
  name?: string;
  tenant_id?: string | null;
  role?: string;
  created_at?: string;
  created_by_user_id?: string | null;
  last_sign_in_at?: string | null;
}

export type BloomKnowledgeDocumentStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "failed";

export type BloomKnowledgeDocumentFileType = "pdf" | "txt" | "docx";

export interface BloomKnowledgeDocument {
  id: string;
  title: string;
  content: string | null;
  status: BloomKnowledgeDocumentStatus;
  chunkCount: number;
  sourceFile: string;
  fileType: BloomKnowledgeDocumentFileType;
  processingProgress: number;
  errorMessage: string | null;
  metadata: BloomJsonObject;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BloomKnowledgeDocumentRow {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  content: string | null;
  chunk_count: number;
  status: BloomKnowledgeDocumentStatus;
  error_message: string | null;
  source_file: string;
  file_type: BloomKnowledgeDocumentFileType;
  processing_progress: number;
  metadata: Json;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BloomKnowledgeDocumentInsert {
  id?: string;
  tenant_id: string;
  user_id: string;
  title: string;
  content?: string | null;
  chunk_count?: number;
  status?: BloomKnowledgeDocumentStatus;
  error_message?: string | null;
  source_file: string;
  file_type: BloomKnowledgeDocumentFileType;
  processing_progress?: number;
  metadata?: Json;
  processed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BloomKnowledgeDocumentUpdate {
  title?: string;
  content?: string | null;
  chunk_count?: number;
  status?: BloomKnowledgeDocumentStatus;
  error_message?: string | null;
  processing_progress?: number;
  metadata?: Json;
  processed_at?: string | null;
  updated_at?: string;
}

type BloomAssistDatabase = {
  public: {
    Tables: {
      bloom_conversations: {
        Row: BloomConversationRow;
        Insert: BloomConversationInsert;
        Update: BloomConversationUpdate;
        Relationships: [];
      };
      bloom_messages: {
        Row: BloomMessageRow;
        Insert: BloomMessageInsert;
        Update: BloomMessageUpdate;
        Relationships: [];
      };
      bloom_tool_executions: {
        Row: BloomToolExecutionRow;
        Insert: BloomToolExecutionInsert;
        Update: BloomToolExecutionUpdate;
        Relationships: [];
      };
      bloom_user_profiles: {
        Row: BloomUserProfileRow;
        Insert: BloomUserProfileInsert;
        Update: BloomUserProfileUpdate;
        Relationships: [];
      };
      bloom_proactive_insights: {
        Row: BloomProactiveInsightRow;
        Insert: BloomProactiveInsightInsert;
        Update: BloomProactiveInsightUpdate;
        Relationships: [];
      };
      bloom_audit_log: {
        Row: BloomAuditLogRow;
        Insert: BloomAuditLogInsert;
        Update: BloomAuditLogUpdate;
        Relationships: [];
      };
      bloom_knowledge_documents: {
        Row: BloomKnowledgeDocumentRow;
        Insert: BloomKnowledgeDocumentInsert;
        Update: BloomKnowledgeDocumentUpdate;
        Relationships: [];
      };
      users: {
        Row: BloomAuditUserRow;
        Insert: BloomAuditUserInsert;
        Update: BloomAuditUserUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export const bloomSupabase =
  supabase as unknown as SupabaseClient<BloomAssistDatabase>;

type BloomPostgrestLikeError =
  | {
      code?: string;
      details?: string;
      message?: string;
      status?: number;
    }
  | null
  | undefined;

export const isBloomMissingRelationError = (error: BloomPostgrestLikeError) => {
  const code = String(error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();
  const details = String(error?.details ?? "").toLowerCase();
  const status = error?.status;

  return (
    code === "42p01" ||
    ((status === 404 || status === 400) &&
      ((message.includes("relation") && message.includes("does not exist")) ||
        (details.includes("relation") && details.includes("does not exist"))))
  );
};

export const isBloomMode = (value: string): value is BloomMode =>
  value === "standard" ||
  value === "reasoning" ||
  value === "research" ||
  value === "image";

export const isBloomModelPreference = (
  value: unknown,
): value is BloomModelPreference =>
  value === "auto" || value === "standard" || value === "pro";

export const isBloomResponseDensityPreference = (
  value: unknown,
): value is BloomResponseDensityPreference =>
  value === "concise" || value === "balanced" || value === "detailed";

export const isBloomDefaultModePreference = (
  value: unknown,
): value is BloomDefaultModePreference =>
  value === "standard" || value === "reasoning" || value === "research";

export const toBloomJsonArray = (value: Json): BloomJsonArray =>
  Array.isArray(value) ? value : [];

export const toBloomJsonObject = (value: Json): BloomJsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : {};

const readBloomPreferenceText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export const toBloomPreferences = (value: Json): BloomPreferences => {
  const record = toBloomJsonObject(value);

  return {
    density: isBloomResponseDensityPreference(record.density)
      ? record.density
      : DEFAULT_BLOOM_PREFERENCES.density,
    default_mode: isBloomDefaultModePreference(record.default_mode)
      ? record.default_mode
      : DEFAULT_BLOOM_PREFERENCES.default_mode,
    default_model: isBloomModelPreference(record.default_model)
      ? record.default_model
      : DEFAULT_BLOOM_PREFERENCES.default_model,
    about_me: readBloomPreferenceText(record.about_me, 500),
    response_style: readBloomPreferenceText(record.response_style, 500),
    response_density: isBloomResponseDensityPreference(record.response_density)
      ? record.response_density
      : DEFAULT_BLOOM_PREFERENCES.response_density,
  };
};

export const toBloomConversation = (
  row: BloomConversationRow,
): BloomConversation => ({
  id: row.id,
  title: row.title?.trim() || "New chat",
  status: row.status,
  mode: row.mode,
  messageCount: row.message_count,
  lastMessagePreview: row.last_message_preview?.trim() || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toBloomMessage = (row: BloomMessageRow): BloomMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  role: row.role,
  text: row.content ?? "",
  thinkingContent: row.thinking_content,
  blockData: row.block_data,
  mode: row.mode,
  model: row.model,
  tokensInput: row.tokens_input,
  tokensOutput: row.tokens_output,
  attachments: toBloomJsonArray(row.attachments),
  followUpChips: toBloomJsonArray(row.follow_up_chips),
  isBookmarked: row.is_bookmarked,
  isCompacted: row.is_compacted,
  metadata: toBloomJsonObject(row.metadata) as BloomMessageMetadata,
  createdAt: row.created_at,
  toolExecutions: [],
});

export const toBloomToolExecution = (
  row: BloomToolExecutionRow,
): BloomToolExecution => ({
  id: row.id,
  messageId: row.message_id,
  conversationId: row.conversation_id,
  toolName: row.tool_name,
  toolInput: row.tool_input,
  toolOutput: row.tool_output,
  status: row.status,
  errorMessage: row.error_message,
  executionTimeMs: row.execution_time_ms,
  createdAt: row.created_at,
});

export const toBloomUserProfile = (
  row: BloomUserProfileRow,
): BloomUserProfile => ({
  id: row.id,
  tenantId: row.tenant_id,
  userId: row.user_id,
  interactionCount: row.interaction_count,
  onboardingStage: row.onboarding_stage,
  seenTips: row.seen_tips,
  workspaceMemory: toBloomJsonObject(row.workspace_memory),
  preferences: toBloomPreferences(row.preferences),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toBloomProactiveInsight = (
  row: BloomProactiveInsightRow,
): BloomProactiveInsight => ({
  id: row.id,
  tenantId: row.tenant_id,
  insightType: row.insight_type.trim(),
  title: row.title.trim(),
  description: row.description.trim(),
  actionPrompt: row.action_prompt?.trim() || null,
  entityType: row.entity_type,
  entityId: row.entity_id,
  severity: row.severity,
  dismissedBy: row.dismissed_by,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
});

export const toBloomKnowledgeDocument = (
  row: BloomKnowledgeDocumentRow,
): BloomKnowledgeDocument => ({
  id: row.id,
  title: row.title.trim() || "Untitled document",
  content: row.content,
  status: row.status,
  chunkCount: row.chunk_count,
  sourceFile: row.source_file,
  fileType: row.file_type,
  processingProgress: row.processing_progress,
  errorMessage: row.error_message,
  metadata: toBloomJsonObject(row.metadata),
  processedAt: row.processed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
