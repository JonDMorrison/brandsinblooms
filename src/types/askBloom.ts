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
  | "text"
  | "data_card"
  | "mutation_action"
  | "insight_card"
  | "suggestion_chips";

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

interface AskBloomBaseBlock {
  type: AskBloomBlockType;
  content: string;
  data: Record<string, unknown>;
}

export interface AskBloomTextBlock extends AskBloomBaseBlock {
  type: "text";
}

export interface AskBloomDataBlock extends AskBloomBaseBlock {
  type: "data_card" | "insight_card";
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
  blocks: AskBloomBlock[];
  toolCalls: AskBloomToolCall[];
  createdAt: string;
  isStreaming: boolean;
}

export interface AskBloomConversation {
  id: string;
  tenantId: string;
  userId: string;
  title: string | null;
  status: string;
  mode: string;
  messageCount: number;
  lastMessagePreview: string | null;
  sessionType: AskBloomSessionType;
  resourceType: AskBloomResourceType | null;
  resourceId: string | null;
  createdAt: string;
  updatedAt: string;
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
  isStreaming: boolean;
  isLoadingConversation: boolean;
  isPinned: boolean;
}

export interface AskBloomContextValue {
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
  setNavigationPrompt: (prompt: AskBloomNavigationPrompt | null) => void;
  dismissNavigationPrompt: () => void;
  acceptNavigationPrompt: () => void;
  sendMessage: (content: string) => void;
  cancelStream: () => void;
  executeActionCard: (messageId: string, card: AskBloomActionCard) => Promise<void>;
  dismissActionCard: (messageId: string, mutationId: string) => void;
  isResourceMatch: (type: string, id: string) => boolean;
}
