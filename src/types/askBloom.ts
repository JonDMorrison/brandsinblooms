import type { Json } from "@/integrations/supabase/types";
import type { BloomContentBlock } from "@/components/bloom/content/parseContentBlocks";
import type { PendingResourceForm } from "@/components/bloom/utils/resourceFormRegistry";
import type {
  BloomActiveToolCall,
  BloomStreamingBlock,
} from "@/hooks/bloom/useBloomStreaming";
import type {
  BloomTaskCompletionSummary,
  BloomEditedTaskFields,
  BloomTaskPlan,
  BloomTaskPlanStatus,
} from "@/hooks/bloom/taskPlanTypes";

export type { BloomContentBlock };

export type AskBloomResourceType =
  | "customer"
  | "product"
  | "order"
  | "campaign"
  | "segment"
  | "automation"
  | "invoice";

export type AskBloomSessionType = "standard" | "resource_focused";

export type AskBloomMessageRole = "user" | "assistant" | "system";

export type AskBloomInsightType = "info" | "warning" | "positive" | "action";

export type AskBloomBlockType =
  // Text & thinking
  | "text"
  | "thinking"
  // Structured blocks (standard — rendered by BlockRenderer)
  | "data_card"
  | "content"
  | "interaction"
  | "stat_card"
  | "insight"
  | "confirmation"
  | "navigation"
  // Structured blocks (heavy — rendered by HeavyBlockRenderer, lazy loaded)
  | "data_table"
  | "task_plan"
  | "code"
  | "research_progress"
  | "chart"
  | "image"
  // Ask Bloom specific
  | "mutation_action"
  | "suggestion_chips"
  // Tool results (rendered by BloomToolResultCard)
  | "tool_result"
  // Backward-compatibility alias for previously persisted blocks
  | "insight_card";

export type AskBloomToolCallStatus =
  | "pending"
  | "running"
  | "complete"
  | "error";

export interface ResourceFocus {
  resourceType: AskBloomResourceType;
  resourceId: string;
  resourceLabel: string;
  resourceSummary: string;
  sourceRoute: string;
  fetchedAt: string;
}

export interface AskBloomNavigationPrompt {
  newResourceType: AskBloomResourceType;
  newResourceId: string;
  newResourceLabel: string;
  buildNewContext: () => ResourceFocus;
}

export interface AskBloomStarterPrompt {
  label: string;
  description: string;
  prompt: string;
  icon: string;
}

export interface AskBloomInsight {
  id: string;
  type: AskBloomInsightType;
  title: string;
  body: string;
  suggestedPrompt: string | null;
}

export interface ResourceStarterConfig {
  greeting: string;
  starters: AskBloomStarterPrompt[];
}

export type AskBloomActionCardStatus =
  | "pending"
  | "confirmed"
  | "executing"
  | "completed"
  | "failed";

/**
 * Structured payload preserved from a Bloom `tool_result` content block.
 *
 * NOTE: The fields mirror the REAL `BloomContentBlock` `tool_result` variant
 * (see `parseContentBlocks.ts`). Bloom's content blocks do not carry a separate
 * tool input or an explicit route at this layer, so those are intentionally
 * absent. `route` is reserved (optional) for renderer-side derivation in later
 * milestones and is never populated here.
 */
export interface AskBloomToolResult {
  toolName: string;
  blockType: string | null;
  data: Record<string, unknown>;
  status: "success" | "error";
  message: string | null;
  error: string | null;
  count: number | null;
  route?: string;
}

interface AskBloomBaseBlock {
  type: AskBloomBlockType;
  content: string;
  data: Record<string, unknown>;
  /** Stable identifier when available (e.g. carried from a Bloom content block). */
  id?: string;
  /** Original Bloom content block for direct renderer pass-through (M02+). */
  bloomContentBlock?: BloomContentBlock;
  /** Structured tool-result payload for `tool_result` blocks. */
  toolResult?: AskBloomToolResult;
}

export interface AskBloomTextBlock extends AskBloomBaseBlock {
  type: "text";
}

export type AskBloomActiveToolCall = BloomActiveToolCall;

export interface AskBloomStreamingState {
  isStreaming: boolean;
  activeToolCall: BloomActiveToolCall | null;
  thinkingContent: string | null;
  researchProgress: unknown | null;
  streamingBlocks: BloomStreamingBlock[];
  partialText: string;
  connectionState: "connecting" | "streaming" | "error" | "done";
  streamError: string | null;
}
export interface AskBloomDataBlock extends AskBloomBaseBlock {
  type: "data_card" | "insight_card";
}

/**
 * Carries the full fidelity of every non-legacy Bloom block type so the
 * streaming adapter and persistence layer stop collapsing them. Rendering for
 * these arrives in later milestones (M02–M05).
 */
export interface AskBloomContentBlock extends AskBloomBaseBlock {
  type:
    | "thinking"
    | "content"
    | "interaction"
    | "stat_card"
    | "insight"
    | "confirmation"
    | "navigation"
    | "data_table"
    | "task_plan"
    | "code"
    | "research_progress"
    | "chart"
    | "image"
    | "tool_result";
}

export interface AskBloomSuggestionChipsBlock extends AskBloomBaseBlock {
  type: "suggestion_chips";
  data: {
    suggestions: string[];
  };
}

export interface AskBloomActionCard extends AskBloomBaseBlock {
  type: "mutation_action";
  mutationId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  description: string;
  status: AskBloomActionCardStatus;
  result: string | null;
}

export type AskBloomBlock =
  | AskBloomTextBlock
  | AskBloomDataBlock
  | AskBloomContentBlock
  | AskBloomSuggestionChipsBlock
  | AskBloomActionCard;

export interface AskBloomToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  status: AskBloomToolCallStatus;
}

export interface AskBloomMessage {
  id: string;
  conversationId: string;
  role: AskBloomMessageRole;
  content: string;
  originalContent?: string;
  blocks: AskBloomBlock[];
  toolCalls: AskBloomToolCall[];
  createdAt: string;
  isStreaming: boolean;
  // Loosely-typed attachment JSON (parity with bloom_messages.attachments).
  // Rendered via BloomAttachmentDisplay, which extracts fields defensively.
  attachments?: Json[];
}

export interface AskBloomConversation {
  id: string;
  tenantId: string;
  userId: string;
  title: string | null;
  status: string;
  mode: string;
  metadata: Json;
  messageCount: number;
  lastMessagePreview: string | null;
  sessionType: AskBloomSessionType;
  resourceType: AskBloomResourceType | null;
  resourceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AskBloomTaskStatusEntry {
  status: BloomTaskPlanStatus;
  errorMessage?: string;
}

export type AskBloomTaskStatusesByPlan = Record<
  string,
  Record<string, AskBloomTaskStatusEntry>
>;

export interface AskBloomPlanDecision {
  approvedTaskIds: string[];
  skippedTaskIds: string[];
  decidedAt: string;
  cancelled?: boolean;
}

export interface AskBloomState {
  isOpen: boolean;
  panelWidth: number;
  isCollapsed: boolean;
  resourceFocus: ResourceFocus | null;
  contextUpdatedToken: number;
  navigationPrompt: AskBloomNavigationPrompt | null;
  conversationId: string | null;
  messages: AskBloomMessage[];
  pendingTaskPlan: BloomTaskPlan | null;
  executingPlanIds: Set<string>;
  taskStatusesByPlan: AskBloomTaskStatusesByPlan;
  completionSummaries: Record<string, BloomTaskCompletionSummary>;
  planDecisions: Record<string, AskBloomPlanDecision>;
  pendingResourceForm: PendingResourceForm | null;
  restoredFormValues: Record<string, string> | null;
  isStreaming: boolean;
  isTransitioning: boolean;
  isSendingMessage: boolean;
  isLoadingConversation: boolean;
  isPinned: boolean;
  // M05 ephemeral streaming indicators. These describe the in-progress stream
  // only and are cleared when a stream completes, errors are dismissed, or the
  // panel resets. They are intentionally not persisted into `messages`.
  thinkingContent: string | null;
  activeToolCall: BloomActiveToolCall | null;
  streamingBlocks: BloomStreamingBlock[];
  streamError: string | null;
}

export interface AskBloomContextValue extends AskBloomState {
  state: AskBloomState;
  openWithResource: (resource: ResourceFocus) => void;
  openGeneral: () => void;
  close: () => void;
  toggleCollapse: () => void;
  setPanelWidth: (width: number) => void;
  clearResourceFocus: () => void;
  switchResource: (resource: ResourceFocus) => void;
  pinConversation: () => void;
  unpinConversation: () => void;
  newConversation: () => void;
  loadConversation: (conversationId: string) => void;
  setNavigationPrompt: (prompt: AskBloomNavigationPrompt | null) => void;
  dismissNavigationPrompt: () => void;
  acceptNavigationPrompt: () => void;
  sendMessage: (content: string) => void;
  cancelStream: () => void;
  retryStream: () => void;
  keepPartialResponse: () => void;
  dismissPendingTaskPlan: () => void;
  approveTaskPlan: (
    plan: BloomTaskPlan,
    approvedTaskIds: string[],
    editedFields: BloomEditedTaskFields,
  ) => Promise<void>;
  cancelTaskPlan: (planId: string) => void;
  retryTaskPlan: (plan: BloomTaskPlan, taskId: string) => Promise<void>;
  getTaskStatuses: (planId: string) => Map<string, AskBloomTaskStatusEntry>;
  getTaskCompletionSummary: (
    planId: string,
  ) => BloomTaskCompletionSummary | null;
  isTaskPlanExecuting: (planId: string) => boolean;
  getPlanDecision: (planId: string) => AskBloomPlanDecision | null;
  presentResourceForm: (form: PendingResourceForm) => void;
  dismissResourceForm: () => void;
  persistResourceFormState: (values: Record<string, string>) => void;
  clearPersistedFormState: () => Promise<void>;
  executeActionCard: (
    messageId: string,
    card: AskBloomActionCard,
  ) => Promise<void>;
  dismissActionCard: (messageId: string, mutationId: string) => void;
  isResourceMatch: (type: string, id: string) => boolean;
}
