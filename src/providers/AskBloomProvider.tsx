import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/config";
import type { Json } from "@/integrations/supabase/types";
import { useAskBloomStreaming } from "@/hooks/askBloom/useAskBloomStreaming";
import { useAskBloomConversation } from "@/hooks/askBloom/useAskBloomConversation";
import { useAskBloomNavigation } from "@/hooks/askBloom/useAskBloomNavigation";
import {
  parseBloomTaskCompletionSummary,
  parseBloomTaskPlan,
  parseBloomTaskStatusUpdate,
  type BloomTaskCompletionSummary,
  type BloomEditedTaskFields,
  type BloomTaskPlan,
  type BloomTaskPlanStatus,
  type BloomTaskStatusUpdate,
} from "@/hooks/bloom/taskPlanTypes";
import {
  parsePersistedFormState,
  type PendingResourceForm,
  type PersistedResourceFormState,
} from "@/components/bloom/utils/resourceFormRegistry";
import type {
  AskBloomActionCard,
  AskBloomBlock,
  AskBloomConversation,
  AskBloomContextValue,
  AskBloomMessage,
  AskBloomNavigationPrompt,
  AskBloomPlanDecision,
  AskBloomState,
  AskBloomTaskStatusEntry,
  ResourceFocus,
} from "@/types/askBloom";
import { getResourceFocusFromCache } from "@/utils/askBloomResourceRegistry";
import { buildResourceFocusFromMutationResult } from "@/utils/askBloomMutationResults";
import { serializeAskBloomBlock } from "@/utils/askBloomBlocks";
import { parseResourceFromPath } from "@/utils/askBloomRouteContext";
import { dispatchAskBloomResourceSync } from "@/utils/askBloomResourceSync";

interface AskBloomProviderProps {
  children: React.ReactNode;
}

interface AskBloomConversationCacheEntry {
  conversation: AskBloomConversation | null;
  messages: AskBloomMessage[];
}

interface PostStreamRefetchGuard {
  conversationId: string;
  minimumMessageCount: number;
  timeoutId: number;
}

interface ParsedSseEvent {
  event: string;
  data: unknown;
}

type AskBloomAction =
  | { type: "OPEN_WITH_RESOURCE"; payload: ResourceFocus }
  | { type: "OPEN_GENERAL" }
  | { type: "CLOSE" }
  | { type: "TOGGLE_COLLAPSE" }
  | { type: "SET_PANEL_WIDTH"; payload: number }
  | { type: "SET_RESOURCE_FOCUS"; payload: ResourceFocus }
  | { type: "REFRESH_RESOURCE_FOCUS"; payload: ResourceFocus }
  | { type: "CLEAR_RESOURCE_FOCUS" }
  | { type: "SELECT_CONVERSATION"; payload: { id: string } }
  | {
      type: "SET_CONVERSATION";
      payload: { id: string; messages: AskBloomMessage[] };
    }
  | { type: "ADD_MESSAGE"; payload: AskBloomMessage }
  | {
      type: "UPDATE_MESSAGE";
      payload: { id: string; partial: Partial<AskBloomMessage> };
    }
  | { type: "SET_PENDING_TASK_PLAN"; payload: BloomTaskPlan }
  | { type: "DISMISS_PENDING_TASK_PLAN" }
  | {
      type: "SET_PLAN_EXECUTING";
      payload: { planId: string; executing: boolean };
    }
  | {
      type: "UPDATE_TASK_STATUS";
      payload: {
        planId: string;
        taskId: string;
        status: BloomTaskPlanStatus;
        errorMessage?: string;
      };
    }
  | {
      type: "SET_PLAN_COMPLETION";
      payload: { planId: string; summary: BloomTaskCompletionSummary };
    }
  | {
      type: "SET_PLAN_DECISION";
      payload: { planId: string; decision: AskBloomPlanDecision };
    }
  | { type: "SET_PENDING_RESOURCE_FORM"; payload: PendingResourceForm }
  | { type: "DISMISS_RESOURCE_FORM" }
  | {
      type: "SET_RESTORED_FORM_VALUES";
      payload: Record<string, string> | null;
    }
  | { type: "SET_TRANSITIONING"; payload: boolean }
  | { type: "SET_SENDING_MESSAGE"; payload: boolean }
  | { type: "SET_STREAMING"; payload: boolean }
  | { type: "SET_LOADING_CONVERSATION"; payload: boolean }
  | { type: "SET_PINNED"; payload: boolean }
  | { type: "SET_NAVIGATION_PROMPT"; payload: AskBloomNavigationPrompt | null }
  | { type: "BUMP_CONTEXT_UPDATED_TOKEN" }
  | { type: "SET_THINKING_CONTENT"; payload: string | null }
  | { type: "SET_ACTIVE_TOOL_CALL"; payload: AskBloomState["activeToolCall"] }
  | {
      type: "ADD_STREAMING_BLOCK";
      payload: AskBloomState["streamingBlocks"][number];
    }
  | { type: "CLEAR_STREAMING_BLOCKS" }
  | { type: "SET_STREAM_ERROR"; payload: string | null }
  | { type: "CLEAR_STREAMING_INDICATORS" }
  | { type: "REMOVE_MESSAGE"; payload: { id: string } }
  | { type: "RESET" };

const ASK_BLOOM_QUERY_KEY = "ask-bloom-conversation";
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 600;
const DEFAULT_PANEL_WIDTH = 400;
const POST_STREAM_REFETCH_GUARD_MS = 2000;

const initialAskBloomState: AskBloomState = {
  isOpen: false,
  panelWidth: DEFAULT_PANEL_WIDTH,
  isCollapsed: false,
  resourceFocus: null,
  contextUpdatedToken: 0,
  navigationPrompt: null,
  conversationId: null,
  messages: [],
  pendingTaskPlan: null,
  executingPlanIds: new Set(),
  taskStatusesByPlan: {},
  completionSummaries: {},
  planDecisions: {},
  pendingResourceForm: null,
  restoredFormValues: null,
  isTransitioning: false,
  isSendingMessage: false,
  isStreaming: false,
  isLoadingConversation: false,
  isPinned: false,
  thinkingContent: null,
  activeToolCall: null,
  streamingBlocks: [],
  streamError: null,
};

const AskBloomContext = React.createContext<AskBloomContextValue | undefined>(
  undefined,
);

const clampPanelWidth = (width: number) =>
  Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, width));

const buildMessageBlocks = (
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

const replaceActionCardBlock = (
  blocks: AskBloomBlock[],
  mutationId: string,
  transform: (card: AskBloomActionCard) => AskBloomActionCard | null,
) =>
  blocks.flatMap((block) => {
    if (block.type !== "mutation_action" || block.mutationId !== mutationId) {
      return [block];
    }

    const nextBlock = transform(block);
    return nextBlock ? [nextBlock] : [];
  });

const toPersistedBlockData = (blocks: AskBloomBlock[]) => ({
  blocks: blocks.map(serializeAskBloomBlock),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

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

const readResponseErrorMessage = async (response: Response) => {
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

const addExecutingPlanId = (planIds: Set<string>, planId: string) => {
  const nextPlanIds = new Set(planIds);
  nextPlanIds.add(planId);
  return nextPlanIds;
};

const removeExecutingPlanId = (planIds: Set<string>, planId: string) => {
  if (!planIds.has(planId)) {
    return planIds;
  }

  const nextPlanIds = new Set(planIds);
  nextPlanIds.delete(planId);
  return nextPlanIds;
};

const serializePersistedFormState = (
  state: PersistedResourceFormState,
): Json => ({
  messageId: state.messageId,
  resourceType: state.resourceType,
  fields: state.fields.map((field) => ({
    name: field.name,
    label: field.label,
    type: field.type,
    required: field.required,
    placeholder: field.placeholder,
    options: field.options,
    defaultValue: field.defaultValue,
  })),
  prefilledValues: state.prefilledValues,
  values: state.values,
  savedAt: state.savedAt,
});

const isMatchingResourceQuery = (
  queryKey: readonly unknown[],
  resourceFocus: ResourceFocus,
) => {
  const [root] = queryKey;
  if (typeof root !== "string") {
    return false;
  }

  switch (resourceFocus.resourceType) {
    case "customer":
      return (
        root === "customer-360" && queryKey[1] === resourceFocus.resourceId
      );
    case "product":
      return root === "product" && queryKey[1] === resourceFocus.resourceId;
    case "segment":
      return (
        (root === "segment" || root === "segment-members") &&
        queryKey.includes(resourceFocus.resourceId)
      );
    default:
      return false;
  }
};

const hasSameResourceFocus = (
  left: ResourceFocus | null,
  right: ResourceFocus | null,
) => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.resourceType === right.resourceType &&
    left.resourceId === right.resourceId &&
    left.resourceLabel === right.resourceLabel &&
    left.resourceSummary === right.resourceSummary &&
    left.sourceRoute === right.sourceRoute
  );
};

const doesConversationMatchTarget = (
  conversation: AskBloomConversation,
  selectedConversationId: string | null,
  resourceFocus: ResourceFocus | null,
) => {
  if (selectedConversationId) {
    return conversation.id === selectedConversationId;
  }

  if (!resourceFocus) {
    return true;
  }

  return (
    conversation.resourceType === resourceFocus.resourceType &&
    conversation.resourceId === resourceFocus.resourceId
  );
};

const askBloomReducer = (
  state: AskBloomState,
  action: AskBloomAction,
): AskBloomState => {
  switch (action.type) {
    case "OPEN_WITH_RESOURCE":
      return {
        ...state,
        isOpen: true,
        isCollapsed: false,
        resourceFocus: action.payload,
        navigationPrompt: null,
        conversationId: null,
        messages: [],
        pendingTaskPlan: null,
        executingPlanIds: new Set(),
        taskStatusesByPlan: {},
        completionSummaries: {},
        planDecisions: {},
        pendingResourceForm: null,
        restoredFormValues: null,
        isTransitioning: true,
        isSendingMessage: false,
        isLoadingConversation: true,
        isPinned: true,
        thinkingContent: null,
        activeToolCall: null,
        streamingBlocks: [],
        streamError: null,
      };
    case "OPEN_GENERAL":
      return {
        ...state,
        isOpen: true,
        isCollapsed: false,
        resourceFocus: null,
        navigationPrompt: null,
        isTransitioning: false,
        isSendingMessage: false,
        isPinned: false,
      };
    case "CLOSE":
      return {
        ...state,
        isOpen: false,
        navigationPrompt: null,
      };
    case "TOGGLE_COLLAPSE":
      return {
        ...state,
        isCollapsed: !state.isCollapsed,
      };
    case "SET_PANEL_WIDTH":
      return {
        ...state,
        panelWidth: clampPanelWidth(action.payload),
      };
    case "SET_RESOURCE_FOCUS":
      return {
        ...state,
        isOpen: true,
        resourceFocus: action.payload,
        navigationPrompt: null,
        conversationId: null,
        messages: [],
        pendingTaskPlan: null,
        executingPlanIds: new Set(),
        taskStatusesByPlan: {},
        completionSummaries: {},
        planDecisions: {},
        pendingResourceForm: null,
        restoredFormValues: null,
        isTransitioning: true,
        isSendingMessage: false,
        isLoadingConversation: true,
        isPinned: true,
        thinkingContent: null,
        activeToolCall: null,
        streamingBlocks: [],
        streamError: null,
      };
    case "REFRESH_RESOURCE_FOCUS":
      if (hasSameResourceFocus(state.resourceFocus, action.payload)) {
        return state;
      }

      return {
        ...state,
        resourceFocus: action.payload,
      };
    case "CLEAR_RESOURCE_FOCUS":
      if (
        !state.resourceFocus &&
        !state.navigationPrompt &&
        !state.isPinned &&
        !state.isLoadingConversation
      ) {
        return state;
      }

      return {
        ...state,
        resourceFocus: null,
        navigationPrompt: null,
        isTransitioning: false,
        isPinned: false,
        isLoadingConversation: false,
      };
    case "SELECT_CONVERSATION":
      return {
        ...state,
        conversationId: action.payload.id,
        messages: [],
        navigationPrompt: null,
        isTransitioning: true,
        isLoadingConversation: true,
        pendingTaskPlan: null,
        executingPlanIds: new Set(),
        taskStatusesByPlan: {},
        completionSummaries: {},
        planDecisions: {},
        pendingResourceForm: null,
        restoredFormValues: null,
        isSendingMessage: false,
        thinkingContent: null,
        activeToolCall: null,
        streamingBlocks: [],
        streamError: null,
      };
    case "SET_CONVERSATION": {
      const isConversationSwitch = state.conversationId !== action.payload.id;

      if (
        !isConversationSwitch &&
        action.payload.messages.length < state.messages.length
      ) {
        return {
          ...state,
          isTransitioning: false,
          isLoadingConversation: false,
        };
      }

      if (
        state.conversationId === action.payload.id &&
        state.messages === action.payload.messages &&
        !state.isLoadingConversation
      ) {
        return state;
      }

      return {
        ...state,
        conversationId: action.payload.id,
        messages: action.payload.messages,
        isTransitioning: false,
        isLoadingConversation: false,
        pendingTaskPlan: isConversationSwitch ? null : state.pendingTaskPlan,
        executingPlanIds: isConversationSwitch
          ? new Set()
          : state.executingPlanIds,
        taskStatusesByPlan: isConversationSwitch
          ? {}
          : state.taskStatusesByPlan,
        completionSummaries: isConversationSwitch
          ? {}
          : state.completionSummaries,
        planDecisions: isConversationSwitch ? {} : state.planDecisions,
        pendingResourceForm: isConversationSwitch
          ? null
          : state.pendingResourceForm,
        restoredFormValues: isConversationSwitch
          ? null
          : state.restoredFormValues,
        thinkingContent: isConversationSwitch ? null : state.thinkingContent,
        activeToolCall: isConversationSwitch ? null : state.activeToolCall,
        streamingBlocks: isConversationSwitch ? [] : state.streamingBlocks,
        streamError: isConversationSwitch ? null : state.streamError,
      };
    }
    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };
    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.payload.id
            ? { ...message, ...action.payload.partial }
            : message,
        ),
      };
    case "SET_PENDING_TASK_PLAN":
      return {
        ...state,
        pendingTaskPlan: action.payload,
        taskStatusesByPlan: {
          ...state.taskStatusesByPlan,
          [action.payload.planId]:
            state.taskStatusesByPlan[action.payload.planId] ?? {},
        },
        completionSummaries: Object.fromEntries(
          Object.entries(state.completionSummaries).filter(
            ([planId]) => planId !== action.payload.planId,
          ),
        ),
      };
    case "SET_PLAN_EXECUTING":
      return {
        ...state,
        executingPlanIds: action.payload.executing
          ? addExecutingPlanId(state.executingPlanIds, action.payload.planId)
          : removeExecutingPlanId(
              state.executingPlanIds,
              action.payload.planId,
            ),
        completionSummaries: action.payload.executing
          ? Object.fromEntries(
              Object.entries(state.completionSummaries).filter(
                ([planId]) => planId !== action.payload.planId,
              ),
            )
          : state.completionSummaries,
      };
    case "UPDATE_TASK_STATUS":
      return {
        ...state,
        taskStatusesByPlan: {
          ...state.taskStatusesByPlan,
          [action.payload.planId]: {
            ...(state.taskStatusesByPlan[action.payload.planId] ?? {}),
            [action.payload.taskId]: {
              status: action.payload.status,
              errorMessage: action.payload.errorMessage,
            },
          },
        },
      };
    case "SET_PLAN_COMPLETION":
      return {
        ...state,
        completionSummaries: {
          ...state.completionSummaries,
          [action.payload.planId]: action.payload.summary,
        },
      };
    case "SET_PLAN_DECISION":
      return {
        ...state,
        planDecisions: {
          ...state.planDecisions,
          [action.payload.planId]: action.payload.decision,
        },
      };
    case "DISMISS_PENDING_TASK_PLAN":
      if (!state.pendingTaskPlan) {
        return state;
      }

      return {
        ...state,
        pendingTaskPlan: null,
      };
    case "SET_PENDING_RESOURCE_FORM":
      return {
        ...state,
        pendingResourceForm: action.payload,
      };
    case "DISMISS_RESOURCE_FORM":
      if (!state.pendingResourceForm && !state.restoredFormValues) {
        return state;
      }

      return {
        ...state,
        pendingResourceForm: null,
        restoredFormValues: null,
      };
    case "SET_RESTORED_FORM_VALUES":
      return {
        ...state,
        restoredFormValues: action.payload,
      };
    case "SET_TRANSITIONING":
      if (state.isTransitioning === action.payload) {
        return state;
      }

      return {
        ...state,
        isTransitioning: action.payload,
      };
    case "SET_SENDING_MESSAGE":
      return {
        ...state,
        isSendingMessage: action.payload,
      };
    case "SET_STREAMING":
      return {
        ...state,
        isStreaming: action.payload,
      };
    case "SET_LOADING_CONVERSATION":
      if (state.isLoadingConversation === action.payload) {
        return state;
      }

      return {
        ...state,
        isLoadingConversation: action.payload,
        isTransitioning: action.payload ? state.isTransitioning : false,
      };
    case "SET_PINNED":
      if (state.isPinned === action.payload) {
        return state;
      }

      return {
        ...state,
        isPinned: action.payload,
      };
    case "SET_NAVIGATION_PROMPT":
      return {
        ...state,
        navigationPrompt: action.payload,
      };
    case "BUMP_CONTEXT_UPDATED_TOKEN":
      return {
        ...state,
        contextUpdatedToken: state.contextUpdatedToken + 1,
      };
    case "SET_THINKING_CONTENT":
      return {
        ...state,
        thinkingContent: action.payload,
      };
    case "SET_ACTIVE_TOOL_CALL":
      return {
        ...state,
        activeToolCall: action.payload,
      };
    case "ADD_STREAMING_BLOCK":
      if (
        state.streamingBlocks.some((block) => block.id === action.payload.id)
      ) {
        return state;
      }

      return {
        ...state,
        streamingBlocks: [...state.streamingBlocks, action.payload],
      };
    case "CLEAR_STREAMING_BLOCKS":
      if (state.streamingBlocks.length === 0 && !state.activeToolCall) {
        return state;
      }

      return {
        ...state,
        streamingBlocks: [],
        activeToolCall: null,
      };
    case "SET_STREAM_ERROR":
      return {
        ...state,
        streamError: action.payload,
      };
    case "CLEAR_STREAMING_INDICATORS":
      return {
        ...state,
        thinkingContent: null,
        activeToolCall: null,
        streamError: null,
      };
    case "REMOVE_MESSAGE":
      return {
        ...state,
        messages: state.messages.filter(
          (message) => message.id !== action.payload.id,
        ),
      };
    case "RESET":
      return initialAskBloomState;
    default:
      return state;
  }
};

const activeElementIsInsideAskBloomInput = () => {
  if (typeof document === "undefined") {
    return false;
  }

  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    activeElement.closest("[data-ask-bloom-panel-input]") ||
    activeElement.closest(
      '[data-ask-bloom-panel] input, [data-ask-bloom-panel] textarea, [data-ask-bloom-panel] [contenteditable="true"]',
    ),
  );
};

export function useAskBloom() {
  const context = React.useContext(AskBloomContext);
  if (!context) {
    throw new Error("useAskBloom must be used within an AskBloomProvider");
  }

  return context;
}

export function useOptionalAskBloom() {
  return React.useContext(AskBloomContext);
}

export function AskBloomProvider({ children }: AskBloomProviderProps) {
  const [state, dispatch] = React.useReducer(
    askBloomReducer,
    initialAskBloomState,
  );
  const { tenant } = useTenant();
  const { user, session } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const persistFormTimerRef = React.useRef<number | undefined>(undefined);
  const restoredFormConversationRef = React.useRef<string | null>(null);
  const creatingResourceConversationKeyRef = React.useRef<string | null>(null);
  // Shared in-flight conversation insert. The eager auto-create effect and an
  // immediate first send both go through `ensureConversation`, so they reuse a
  // single insert instead of each creating an orphan "Untitled" conversation.
  const conversationCreationRef = React.useRef<Promise<string> | null>(null);
  const activeAssistantMessageIdRef = React.useRef<string | null>(null);
  const activeConversationIdRef = React.useRef<string | null>(null);
  const activeStreamResourceFocusRef = React.useRef<ResourceFocus | null>(null);
  const activeAssistantBlocksRef = React.useRef<AskBloomBlock[]>([]);
  const activeAssistantContentRef = React.useRef<string>("");
  const latestMessagesRef = React.useRef<AskBloomMessage[]>([]);
  const postStreamRefetchGuardRef = React.useRef<PostStreamRefetchGuard | null>(
    null,
  );

  React.useEffect(() => {
    activeConversationIdRef.current = state.conversationId;
  }, [state.conversationId]);

  React.useEffect(() => {
    latestMessagesRef.current = state.messages;
  }, [state.messages]);

  const resourceType = state.resourceFocus?.resourceType ?? null;
  const resourceId = state.resourceFocus?.resourceId ?? null;

  const conversationQuery = useAskBloomConversation({
    conversationId: state.conversationId,
    resourceType,
    resourceId,
    enabled: Boolean(state.resourceFocus || state.conversationId),
  });

  const clearPostStreamRefetchGuard = React.useCallback(
    (conversationId?: string | null) => {
      const guard = postStreamRefetchGuardRef.current;
      if (!guard) {
        return;
      }

      if (conversationId && guard.conversationId !== conversationId) {
        return;
      }

      window.clearTimeout(guard.timeoutId);
      postStreamRefetchGuardRef.current = null;
    },
    [],
  );

  const startPostStreamRefetchGuard = React.useCallback(
    (conversationId: string | null, minimumMessageCount: number) => {
      if (!conversationId) {
        return;
      }

      clearPostStreamRefetchGuard();
      const timeoutId = window.setTimeout(() => {
        if (
          postStreamRefetchGuardRef.current?.conversationId === conversationId
        ) {
          postStreamRefetchGuardRef.current = null;
        }
      }, POST_STREAM_REFETCH_GUARD_MS);

      postStreamRefetchGuardRef.current = {
        conversationId,
        minimumMessageCount,
        timeoutId,
      };
    },
    [clearPostStreamRefetchGuard],
  );

  const shouldHoldPostStreamConversationSync = React.useCallback(
    (conversationId: string, messages: AskBloomMessage[]) => {
      const guard = postStreamRefetchGuardRef.current;
      if (!guard || guard.conversationId !== conversationId) {
        return false;
      }

      if (
        messages.length < guard.minimumMessageCount ||
        messages.length < latestMessagesRef.current.length
      ) {
        return true;
      }

      clearPostStreamRefetchGuard(conversationId);
      return false;
    },
    [clearPostStreamRefetchGuard],
  );

  React.useEffect(
    () => () => {
      clearPostStreamRefetchGuard();
    },
    [clearPostStreamRefetchGuard],
  );

  React.useEffect(() => {
    const guard = postStreamRefetchGuardRef.current;
    if (!guard || state.conversationId === guard.conversationId) {
      return;
    }

    clearPostStreamRefetchGuard();
  }, [clearPostStreamRefetchGuard, state.conversationId]);

  const resolveConversationResourceFocus = React.useCallback(
    (conversation: AskBloomConversation): ResourceFocus | null => {
      if (
        conversation.sessionType !== "resource_focused" ||
        !conversation.resourceType ||
        !conversation.resourceId
      ) {
        return null;
      }

      if (
        state.resourceFocus?.resourceType === conversation.resourceType &&
        state.resourceFocus.resourceId === conversation.resourceId
      ) {
        return state.resourceFocus;
      }

      return getResourceFocusFromCache(
        conversation.resourceType,
        conversation.resourceId,
        queryClient,
      );
    },
    [queryClient, state.resourceFocus],
  );

  const createConversation = React.useCallback(
    async (resourceFocus: ResourceFocus | null) => {
      const tenantId = tenant?.id;
      const userId = user?.id;
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization before opening Ask Bloom.",
        );
      }

      const isResourceFocused = Boolean(resourceFocus);
      const { data, error } = await supabase
        .from("bloom_conversations")
        .insert({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          user_id: userId,
          title: null,
          status: "active",
          metadata: {},
          mode: "standard",
          session_type: isResourceFocused ? "resource_focused" : "standard",
          resource_type: resourceFocus?.resourceType ?? null,
          resource_id: resourceFocus?.resourceId ?? null,
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      return data.id;
    },
    [tenant?.id, user?.id],
  );

  // Creates the conversation at most once even when the eager auto-create effect
  // and a first `sendMessage` race. Concurrent callers await the same insert;
  // only the caller that initiated it receives `created: true`.
  const ensureConversation = React.useCallback(
    async (
      resourceFocus: ResourceFocus | null,
    ): Promise<{ id: string; created: boolean }> => {
      const inFlight = conversationCreationRef.current;
      if (inFlight) {
        return { id: await inFlight, created: false };
      }

      const creation = createConversation(resourceFocus);
      conversationCreationRef.current = creation;
      try {
        const id = await creation;
        return { id, created: true };
      } finally {
        conversationCreationRef.current = null;
      }
    },
    [createConversation],
  );

  React.useEffect(() => {
    const currentResourceFocus = state.resourceFocus;
    const hasSelectedConversation = Boolean(state.conversationId);

    if (!currentResourceFocus && !hasSelectedConversation) {
      creatingResourceConversationKeyRef.current = null;
      return;
    }

    if (conversationQuery.isLoading) {
      dispatch({ type: "SET_LOADING_CONVERSATION", payload: true });
      return;
    }

    if (conversationQuery.error) {
      console.error(
        "Failed to load Ask Bloom conversation",
        conversationQuery.error,
      );
      dispatch({ type: "SET_LOADING_CONVERSATION", payload: false });
      return;
    }

    if (conversationQuery.conversation) {
      creatingResourceConversationKeyRef.current = null;

      if (
        !doesConversationMatchTarget(
          conversationQuery.conversation,
          state.conversationId,
          currentResourceFocus,
        )
      ) {
        return;
      }

      const nextResourceFocus = resolveConversationResourceFocus(
        conversationQuery.conversation,
      );

      const shouldHoldConversationSync =
        !state.isStreaming &&
        shouldHoldPostStreamConversationSync(
          conversationQuery.conversation.id,
          conversationQuery.messages,
        );

      if (!state.isStreaming && !shouldHoldConversationSync) {
        dispatch({
          type: "SET_CONVERSATION",
          payload: {
            id: conversationQuery.conversation.id,
            messages: conversationQuery.messages,
          },
        });
      }

      if (nextResourceFocus) {
        dispatch({
          type: "REFRESH_RESOURCE_FOCUS",
          payload: nextResourceFocus,
        });
        dispatch({ type: "SET_PINNED", payload: true });
      } else {
        dispatch({ type: "CLEAR_RESOURCE_FOCUS" });
      }
      return;
    }

    if (hasSelectedConversation || !currentResourceFocus) {
      creatingResourceConversationKeyRef.current = null;
      dispatch({ type: "SET_LOADING_CONVERSATION", payload: false });
      return;
    }

    const focusKey = `${currentResourceFocus.resourceType}:${currentResourceFocus.resourceId}`;
    if (creatingResourceConversationKeyRef.current === focusKey) {
      return;
    }

    creatingResourceConversationKeyRef.current = focusKey;
    dispatch({ type: "SET_LOADING_CONVERSATION", payload: true });

    let cancelled = false;
    void (async () => {
      try {
        const { id: conversationId, created } =
          await ensureConversation(currentResourceFocus);
        if (cancelled) {
          return;
        }

        // Only the insert's initiator selects it with an empty message list. If
        // a concurrent first send already created and populated it, skip the
        // reset so the freshly added user/assistant bubbles survive.
        if (created && !activeAssistantMessageIdRef.current) {
          dispatch({
            type: "SET_CONVERSATION",
            payload: { id: conversationId, messages: [] },
          });
        }
        dispatch({ type: "SET_PINNED", payload: true });
        void queryClient.invalidateQueries({
          queryKey: [
            ASK_BLOOM_QUERY_KEY,
            currentResourceFocus.resourceType,
            currentResourceFocus.resourceId,
          ],
        });
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to create Ask Bloom conversation", error);
          dispatch({ type: "SET_LOADING_CONVERSATION", payload: false });
        }
      } finally {
        if (!cancelled) {
          creatingResourceConversationKeyRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    conversationQuery.conversation,
    conversationQuery.error,
    conversationQuery.isLoading,
    conversationQuery.messages,
    ensureConversation,
    queryClient,
    resolveConversationResourceFocus,
    shouldHoldPostStreamConversationSync,
    state.conversationId,
    state.isStreaming,
    state.resourceFocus,
  ]);

  const openWithResource = React.useCallback(
    (resource: ResourceFocus) => {
      clearPostStreamRefetchGuard();
      dispatch({ type: "OPEN_WITH_RESOURCE", payload: resource });
    },
    [clearPostStreamRefetchGuard],
  );

  const openGeneral = React.useCallback(() => {
    clearPostStreamRefetchGuard();
    dispatch({ type: "OPEN_GENERAL" });
  }, [clearPostStreamRefetchGuard]);

  const close = React.useCallback(() => {
    dispatch({ type: "CLOSE" });
  }, []);

  const toggleCollapse = React.useCallback(() => {
    dispatch({ type: "TOGGLE_COLLAPSE" });
  }, []);

  const setPanelWidth = React.useCallback((width: number) => {
    dispatch({ type: "SET_PANEL_WIDTH", payload: width });
  }, []);

  const clearResourceFocus = React.useCallback(() => {
    clearPostStreamRefetchGuard();
    dispatch({ type: "CLEAR_RESOURCE_FOCUS" });
  }, [clearPostStreamRefetchGuard]);

  const switchResource = React.useCallback(
    (resource: ResourceFocus) => {
      clearPostStreamRefetchGuard();
      dispatch({ type: "SET_RESOURCE_FOCUS", payload: resource });
    },
    [clearPostStreamRefetchGuard],
  );

  const setNavigationPrompt = React.useCallback(
    (prompt: AskBloomNavigationPrompt | null) => {
      dispatch({ type: "SET_NAVIGATION_PROMPT", payload: prompt });
    },
    [],
  );

  const dismissNavigationPrompt = React.useCallback(() => {
    dispatch({ type: "SET_NAVIGATION_PROMPT", payload: null });
  }, []);

  const acceptNavigationPrompt = React.useCallback(() => {
    if (!state.navigationPrompt) {
      return;
    }

    const nextFocus = state.navigationPrompt.buildNewContext();
    clearPostStreamRefetchGuard();
    dispatch({ type: "SET_NAVIGATION_PROMPT", payload: null });
    dispatch({ type: "SET_RESOURCE_FOCUS", payload: nextFocus });
  }, [clearPostStreamRefetchGuard, state.navigationPrompt]);

  const pinConversation = React.useCallback(() => {
    dispatch({ type: "SET_PINNED", payload: true });
  }, []);

  const unpinConversation = React.useCallback(() => {
    dispatch({ type: "SET_PINNED", payload: false });
  }, []);

  const invalidateAskBloomConversation = React.useCallback(
    (
      resourceFocus: ResourceFocus | null,
      guard?: { conversationId: string | null; minimumMessageCount: number },
    ) => {
      if (guard?.conversationId) {
        startPostStreamRefetchGuard(
          guard.conversationId,
          guard.minimumMessageCount,
        );
      }

      if (!resourceFocus) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: [
          ASK_BLOOM_QUERY_KEY,
          resourceFocus.resourceType,
          resourceFocus.resourceId,
        ],
      });
    },
    [queryClient, startPostStreamRefetchGuard],
  );

  const refetchConversationMessages = React.useCallback(
    async (guard?: {
      conversationId: string | null;
      minimumMessageCount: number;
    }) => {
      if (guard?.conversationId) {
        startPostStreamRefetchGuard(
          guard.conversationId,
          guard.minimumMessageCount,
        );
      }

      const result = await conversationQuery.refetch();

      if (
        guard?.conversationId &&
        result.data?.conversation?.id === guard.conversationId &&
        result.data.messages.length >= guard.minimumMessageCount
      ) {
        clearPostStreamRefetchGuard(guard.conversationId);
      }
    },
    [
      clearPostStreamRefetchGuard,
      conversationQuery,
      startPostStreamRefetchGuard,
    ],
  );

  const invalidateFocusedResourceQueries = React.useCallback(
    (resourceFocus: ResourceFocus | null) => {
      if (!resourceFocus) {
        return;
      }

      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          isMatchingResourceQuery(query.queryKey, resourceFocus),
      });
    },
    [queryClient],
  );

  const refreshCurrentResourceFocus = React.useCallback(
    (resourceFocus: ResourceFocus | null) => {
      if (!resourceFocus) {
        return;
      }

      const nextFocus = getResourceFocusFromCache(
        resourceFocus.resourceType,
        resourceFocus.resourceId,
        queryClient,
      );
      if (!nextFocus) {
        return;
      }

      dispatch({ type: "REFRESH_RESOURCE_FOCUS", payload: nextFocus });
    },
    [queryClient],
  );

  const writePendingFormState = React.useCallback(
    async (
      conversationId: string,
      persistedState: PersistedResourceFormState | null,
    ) => {
      try {
        const { data, error: readError } = await supabase
          .from("bloom_conversations")
          .select("metadata")
          .eq("id", conversationId)
          .single();
        if (readError) {
          return;
        }

        const currentMetadata =
          data?.metadata &&
          typeof data.metadata === "object" &&
          !Array.isArray(data.metadata)
            ? (data.metadata as Record<string, Json>)
            : {};
        const nextMetadata: Record<string, Json> = { ...currentMetadata };

        if (persistedState) {
          nextMetadata.pending_form_state =
            serializePersistedFormState(persistedState);
        } else {
          delete nextMetadata.pending_form_state;
        }

        await supabase
          .from("bloom_conversations")
          .update({ metadata: nextMetadata })
          .eq("id", conversationId);

        queryClient.setQueriesData<AskBloomConversationCacheEntry>(
          { queryKey: [ASK_BLOOM_QUERY_KEY] },
          (existing) =>
            existing?.conversation?.id === conversationId
              ? {
                  ...existing,
                  conversation: {
                    ...existing.conversation,
                    metadata: nextMetadata,
                  },
                }
              : existing,
        );
      } catch {
        // Persistence is best-effort.
      }
    },
    [queryClient],
  );

  const presentResourceForm = React.useCallback(
    (form: PendingResourceForm) => {
      if (state.pendingResourceForm?.messageId === form.messageId) {
        return;
      }

      if (state.pendingResourceForm) {
        return;
      }

      dispatch({ type: "SET_PENDING_RESOURCE_FORM", payload: form });
      dispatch({ type: "SET_RESTORED_FORM_VALUES", payload: null });

      const conversationId =
        state.conversationId ?? activeConversationIdRef.current;
      if (!conversationId) {
        return;
      }

      restoredFormConversationRef.current = conversationId;
      void writePendingFormState(conversationId, {
        messageId: form.messageId,
        resourceType: form.resourceType,
        fields: form.fields,
        prefilledValues: form.prefilledValues,
        values: {},
        savedAt: new Date().toISOString(),
      });
    },
    [state.conversationId, state.pendingResourceForm, writePendingFormState],
  );

  const persistResourceFormState = React.useCallback(
    (values: Record<string, string>) => {
      const form = state.pendingResourceForm;
      const conversationId = state.conversationId;
      if (!form || !conversationId) {
        return;
      }

      if (persistFormTimerRef.current) {
        window.clearTimeout(persistFormTimerRef.current);
      }

      persistFormTimerRef.current = window.setTimeout(() => {
        void writePendingFormState(conversationId, {
          messageId: form.messageId,
          resourceType: form.resourceType,
          fields: form.fields,
          prefilledValues: form.prefilledValues,
          values,
          savedAt: new Date().toISOString(),
        });
      }, 500);
    },
    [state.conversationId, state.pendingResourceForm, writePendingFormState],
  );

  const clearPersistedFormState = React.useCallback(async (): Promise<void> => {
    if (persistFormTimerRef.current) {
      window.clearTimeout(persistFormTimerRef.current);
    }

    const conversationId =
      state.conversationId ?? activeConversationIdRef.current;
    if (conversationId) {
      restoredFormConversationRef.current = conversationId;
      await writePendingFormState(conversationId, null);
    }
  }, [state.conversationId, writePendingFormState]);

  const dismissResourceForm = React.useCallback(() => {
    dispatch({ type: "DISMISS_RESOURCE_FORM" });
    void clearPersistedFormState();
  }, [clearPersistedFormState]);

  const dismissPendingTaskPlan = React.useCallback(() => {
    dispatch({ type: "DISMISS_PENDING_TASK_PLAN" });
  }, []);

  const handleApprovalEvent = React.useCallback(
    (planId: string, event: ParsedSseEvent) => {
      if (event.event === "task_plan") {
        const nextPlan = parseBloomTaskPlan(event.data);
        if (nextPlan) {
          dispatch({ type: "SET_PENDING_TASK_PLAN", payload: nextPlan });
        }
        return;
      }

      if (event.event === "task_progress") {
        const progress = parseBloomTaskStatusUpdate(event.data);
        if (progress) {
          dispatch({
            type: "UPDATE_TASK_STATUS",
            payload: {
              planId: progress.planId || planId,
              taskId: progress.taskId,
              status: progress.status,
              errorMessage: progress.errorMessage ?? undefined,
            },
          });
        }
        return;
      }

      if (event.event === "task_complete") {
        const summary = parseBloomTaskCompletionSummary(event.data);
        if (summary) {
          dispatch({
            type: "SET_PLAN_COMPLETION",
            payload: { planId: summary.planId, summary },
          });
        }
      }
    },
    [],
  );

  const cancelTaskPlan = React.useCallback((planId: string) => {
    dispatch({
      type: "SET_PLAN_DECISION",
      payload: {
        planId,
        decision: {
          approvedTaskIds: [],
          skippedTaskIds: [],
          decidedAt: new Date().toISOString(),
          cancelled: true,
        },
      },
    });
    dispatch({
      type: "SET_PLAN_EXECUTING",
      payload: { planId, executing: false },
    });
    dispatch({ type: "DISMISS_PENDING_TASK_PLAN" });
  }, []);

  const executeTaskPlanStream = React.useCallback(
    async (
      plan: BloomTaskPlan,
      approvedTaskIds: string[],
      editedFields: BloomEditedTaskFields,
      retryTaskId: string | null,
    ) => {
      if (!state.conversationId) {
        throw new Error("Ask Bloom needs an active conversation.");
      }

      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("Sign in to approve Ask Bloom tasks.");
      }

      const approvedTaskIdSet = new Set(approvedTaskIds);
      const skippedTaskIds = retryTaskId
        ? []
        : plan.tasks
            .filter((task) => !approvedTaskIdSet.has(task.taskId))
            .map((task) => task.taskId);

      dispatch({
        type: "SET_PLAN_EXECUTING",
        payload: { planId: plan.planId, executing: true },
      });

      if (retryTaskId) {
        dispatch({
          type: "UPDATE_TASK_STATUS",
          payload: {
            planId: plan.planId,
            taskId: retryTaskId,
            status: "pending",
          },
        });
      } else {
        dispatch({
          type: "SET_PLAN_DECISION",
          payload: {
            planId: plan.planId,
            decision: {
              approvedTaskIds,
              skippedTaskIds,
              decidedAt: new Date().toISOString(),
            },
          },
        });
        dispatch({ type: "DISMISS_PENDING_TASK_PLAN" });

        for (const task of plan.tasks) {
          dispatch({
            type: "UPDATE_TASK_STATUS",
            payload: {
              planId: plan.planId,
              taskId: task.taskId,
              status: approvedTaskIdSet.has(task.taskId)
                ? "pending"
                : "skipped",
            },
          });
        }
      }

      try {
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
            body: JSON.stringify({
              conversation_id: state.conversationId,
              plan_id: plan.planId,
              approved_task_ids: approvedTaskIds,
              skipped_task_ids: skippedTaskIds,
              edited_fields: editedFields,
              retry_task_id: retryTaskId,
              mode: "resource_focused",
              timezone:
                Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            }),
          },
        );

        if (!response.ok) {
          throw new Error(await readResponseErrorMessage(response));
        }

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          const consumeBuffer = (isFinal = false) => {
            const parts = buffer.split(/\r?\n\r?\n/);
            buffer = isFinal ? "" : (parts.pop() ?? "");

            for (const part of parts) {
              const event = parseSseMessage(part.trim());
              if (!event) {
                continue;
              }

              handleApprovalEvent(plan.planId, event);

              if (
                event.event === "task_plan" ||
                event.event === "task_progress" ||
                event.event === "task_complete"
              ) {
                continue;
              }

              if (event.event === "error") {
                throw new Error(
                  readString(
                    isRecord(event.data) ? event.data.message : event.data,
                  ) || "Ask Bloom could not execute that task plan.",
                );
              }
            }
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              buffer += decoder.decode();
              if (buffer.trim()) {
                buffer += "\n\n";
              }
              consumeBuffer(true);
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            consumeBuffer(false);
          }
        }

        const guard = {
          conversationId: state.conversationId,
          minimumMessageCount: latestMessagesRef.current.length,
        };
        await refetchConversationMessages(guard);
        invalidateAskBloomConversation(state.resourceFocus, guard);
      } finally {
        dispatch({
          type: "SET_PLAN_EXECUTING",
          payload: { planId: plan.planId, executing: false },
        });
      }
    },
    [
      handleApprovalEvent,
      invalidateAskBloomConversation,
      refetchConversationMessages,
      session?.access_token,
      state.conversationId,
      state.resourceFocus,
    ],
  );

  const approveTaskPlan = React.useCallback(
    async (
      plan: BloomTaskPlan,
      approvedTaskIds: string[],
      editedFields: BloomEditedTaskFields,
    ) => executeTaskPlanStream(plan, approvedTaskIds, editedFields, null),
    [executeTaskPlanStream],
  );

  const retryTaskPlan = React.useCallback(
    async (plan: BloomTaskPlan, taskId: string) => {
      await executeTaskPlanStream(plan, [taskId], {}, taskId);
    },
    [executeTaskPlanStream],
  );

  const getTaskStatuses = React.useCallback(
    (planId: string) =>
      new Map(Object.entries(state.taskStatusesByPlan[planId] ?? {})),
    [state.taskStatusesByPlan],
  );

  const getTaskCompletionSummary = React.useCallback(
    (planId: string) => state.completionSummaries[planId] ?? null,
    [state.completionSummaries],
  );

  const isTaskPlanExecuting = React.useCallback(
    (planId: string) => state.executingPlanIds.has(planId),
    [state.executingPlanIds],
  );

  const getPlanDecision = React.useCallback(
    (planId: string): AskBloomPlanDecision | null =>
      state.planDecisions[planId] ?? null,
    [state.planDecisions],
  );

  const persistMessageBlocks = React.useCallback(
    async (messageId: string, content: string, blocks: AskBloomBlock[]) => {
      if (!state.conversationId) {
        return;
      }

      const { error } = await supabase
        .from("bloom_messages")
        .update({
          block_data: toPersistedBlockData(buildMessageBlocks(content, blocks)),
        })
        .eq("id", messageId)
        .eq("conversation_id", state.conversationId);

      if (error) {
        throw error;
      }
    },
    [state.conversationId],
  );

  React.useEffect(() => {
    if (!state.resourceFocus) {
      return;
    }

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!("query" in event) || event.query.state.status !== "success") {
        return;
      }

      if (!Array.isArray(event.query.queryKey)) {
        return;
      }

      if (
        !isMatchingResourceQuery(event.query.queryKey, state.resourceFocus!)
      ) {
        return;
      }

      const nextFocus = getResourceFocusFromCache(
        state.resourceFocus!.resourceType,
        state.resourceFocus!.resourceId,
        queryClient,
      );

      if (
        !nextFocus ||
        nextFocus.resourceSummary === state.resourceFocus!.resourceSummary
      ) {
        return;
      }

      dispatch({ type: "REFRESH_RESOURCE_FOCUS", payload: nextFocus });
      dispatch({ type: "BUMP_CONTEXT_UPDATED_TOKEN" });
    });

    return unsubscribe;
  }, [queryClient, state.resourceFocus]);

  React.useEffect(() => {
    if (!state.conversationId) {
      restoredFormConversationRef.current = null;
      dispatch({ type: "DISMISS_RESOURCE_FORM" });
      return;
    }

    if (restoredFormConversationRef.current === state.conversationId) {
      return;
    }

    const conversation = conversationQuery.conversation;
    if (!conversation || conversation.id !== state.conversationId) {
      return;
    }

    restoredFormConversationRef.current = state.conversationId;

    const metadata = conversation.metadata;
    const persisted =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? parsePersistedFormState(
            (metadata as Record<string, Json>).pending_form_state,
          )
        : null;

    if (!persisted) {
      dispatch({ type: "DISMISS_RESOURCE_FORM" });
      return;
    }

    dispatch({
      type: "SET_PENDING_RESOURCE_FORM",
      payload: {
        messageId: persisted.messageId,
        resourceType: persisted.resourceType,
        fields: persisted.fields,
        prefilledValues: persisted.prefilledValues,
      },
    });
    dispatch({
      type: "SET_RESTORED_FORM_VALUES",
      payload: { ...persisted.values },
    });
  }, [conversationQuery.conversation, state.conversationId]);

  useAskBloomNavigation({
    pathname: location.pathname,
    isOpen: state.isOpen,
    currentResourceFocus: state.resourceFocus,
    navigationPrompt: state.navigationPrompt,
    queryClient,
    onNavigationPromptChange: setNavigationPrompt,
  });

  const {
    sendMessage: sendAskBloomStreamingMessage,
    cancelStream: cancelAskBloomStreaming,
  } = useAskBloomStreaming({
    conversationId: state.conversationId,
    resourceFocus: state.resourceFocus,
    onStreamingUpdate: (partialContent) => {
      const assistantMessageId = activeAssistantMessageIdRef.current;
      if (!assistantMessageId) {
        return;
      }

      activeAssistantContentRef.current = partialContent;
      dispatch({
        type: "UPDATE_MESSAGE",
        payload: {
          id: assistantMessageId,
          partial: {
            content: partialContent,
            blocks: buildMessageBlocks(
              partialContent,
              activeAssistantBlocksRef.current.filter(
                (block) => block.type !== "text",
              ),
            ),
            isStreaming: true,
          },
        },
      });
    },
    onThinkingToken: (thinkingContent) => {
      dispatch({ type: "SET_THINKING_CONTENT", payload: thinkingContent });
    },
    onToolStart: (toolCall) => {
      dispatch({ type: "SET_ACTIVE_TOOL_CALL", payload: toolCall });
    },
    onToolResult: (block) => {
      dispatch({ type: "SET_ACTIVE_TOOL_CALL", payload: null });
      dispatch({ type: "ADD_STREAMING_BLOCK", payload: block });
    },
    onTaskPlan: (plan) => {
      dispatch({ type: "SET_ACTIVE_TOOL_CALL", payload: null });
      dispatch({ type: "SET_PENDING_TASK_PLAN", payload: plan });
    },
    onTaskProgress: (progress) => {
      dispatch({
        type: "UPDATE_TASK_STATUS",
        payload: {
          planId: progress.planId,
          taskId: progress.taskId,
          status: progress.status,
          errorMessage: progress.errorMessage ?? undefined,
        },
      });
    },
    onTaskComplete: (summary) => {
      dispatch({
        type: "SET_PLAN_COMPLETION",
        payload: { planId: summary.planId, summary },
      });
      dispatch({ type: "DISMISS_PENDING_TASK_PLAN" });
      void refetchConversationMessages({
        conversationId: activeConversationIdRef.current,
        minimumMessageCount: latestMessagesRef.current.length,
      });
    },
    onResourceFormDetected: presentResourceForm,
    onStreamingBlock: (block) => {
      const assistantMessageId = activeAssistantMessageIdRef.current;
      if (!assistantMessageId) {
        return;
      }

      const nextBlocks = buildMessageBlocks(activeAssistantContentRef.current, [
        ...activeAssistantBlocksRef.current.filter(
          (existing) => existing.type !== "text",
        ),
        block,
      ]);
      activeAssistantBlocksRef.current = nextBlocks;
      dispatch({
        type: "UPDATE_MESSAGE",
        payload: {
          id: assistantMessageId,
          partial: {
            blocks: nextBlocks,
            isStreaming: true,
          },
        },
      });
    },
    onActionCard: (_card, blocks) => {
      const assistantMessageId = activeAssistantMessageIdRef.current;
      if (!assistantMessageId) {
        return;
      }

      activeAssistantBlocksRef.current = blocks;
      dispatch({
        type: "UPDATE_MESSAGE",
        payload: {
          id: assistantMessageId,
          partial: {
            blocks,
            isStreaming: true,
          },
        },
      });
    },
    onMessage: (message) => {
      const assistantMessageId = activeAssistantMessageIdRef.current;
      const completedConversationId =
        message.conversationId || activeConversationIdRef.current;
      const completedMessageCount = latestMessagesRef.current.length;
      const completedOriginalContent =
        activeAssistantContentRef.current.trim().length > 0
          ? activeAssistantContentRef.current
          : message.content;
      startPostStreamRefetchGuard(
        completedConversationId,
        completedMessageCount,
      );
      dispatch({ type: "SET_TRANSITIONING", payload: false });
      dispatch({ type: "SET_SENDING_MESSAGE", payload: false });
      dispatch({ type: "SET_STREAMING", payload: false });
      dispatch({ type: "CLEAR_STREAMING_INDICATORS" });
      dispatch({ type: "CLEAR_STREAMING_BLOCKS" });

      if (assistantMessageId) {
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            id: assistantMessageId,
            partial: {
              content: message.content,
              originalContent: completedOriginalContent,
              blocks: message.blocks,
              toolCalls: message.toolCalls,
              id: message.id,
              isStreaming: false,
            },
          },
        });
      }

      activeAssistantMessageIdRef.current = null;
      activeAssistantBlocksRef.current = [];
      activeAssistantContentRef.current = "";
      invalidateAskBloomConversation(activeStreamResourceFocusRef.current, {
        conversationId: completedConversationId,
        minimumMessageCount: completedMessageCount,
      });
      activeStreamResourceFocusRef.current = null;
    },
    onStreamComplete: () => {
      dispatch({ type: "CLEAR_STREAMING_BLOCKS" });
      void refetchConversationMessages({
        conversationId: activeConversationIdRef.current,
        minimumMessageCount: latestMessagesRef.current.length,
      });
    },
    onError: (errorMessage) => {
      const assistantMessageId = activeAssistantMessageIdRef.current;
      dispatch({ type: "SET_TRANSITIONING", payload: false });
      dispatch({ type: "SET_SENDING_MESSAGE", payload: false });
      dispatch({ type: "SET_STREAMING", payload: false });
      dispatch({ type: "SET_THINKING_CONTENT", payload: null });
      dispatch({ type: "SET_ACTIVE_TOOL_CALL", payload: null });
      dispatch({ type: "SET_STREAM_ERROR", payload: errorMessage });

      // Preserve whatever streamed in so far instead of overwriting the bubble
      // with the error text. The error UI is rendered separately with retry and
      // keep-partial actions, so the partial response must stay intact. We also
      // skip the conversation invalidation here to avoid a refetch wiping the
      // unpersisted partial bubble.
      if (assistantMessageId) {
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            id: assistantMessageId,
            partial: { isStreaming: false },
          },
        });
      }

      activeAssistantMessageIdRef.current = null;
      activeAssistantBlocksRef.current = [];
      activeAssistantContentRef.current = "";
      activeStreamResourceFocusRef.current = null;
    },
    onDone: () => {
      dispatch({ type: "SET_TRANSITIONING", payload: false });
      dispatch({ type: "SET_SENDING_MESSAGE", payload: false });
      dispatch({ type: "SET_STREAMING", payload: false });
      dispatch({ type: "CLEAR_STREAMING_INDICATORS" });
    },
  });

  const cancelStream = React.useCallback(() => {
    cancelAskBloomStreaming();
    clearPostStreamRefetchGuard();
    dispatch({ type: "SET_TRANSITIONING", payload: false });
    dispatch({ type: "SET_SENDING_MESSAGE", payload: false });
    dispatch({ type: "SET_STREAMING", payload: false });
    dispatch({ type: "CLEAR_STREAMING_INDICATORS" });
    dispatch({ type: "CLEAR_STREAMING_BLOCKS" });

    const assistantMessageId = activeAssistantMessageIdRef.current;
    if (assistantMessageId) {
      dispatch({
        type: "UPDATE_MESSAGE",
        payload: {
          id: assistantMessageId,
          partial: { isStreaming: false },
        },
      });
    }

    activeAssistantMessageIdRef.current = null;
    activeStreamResourceFocusRef.current = null;
    activeAssistantBlocksRef.current = [];
    activeAssistantContentRef.current = "";
  }, [cancelAskBloomStreaming, clearPostStreamRefetchGuard]);

  const newConversation = React.useCallback(() => {
    void (async () => {
      cancelStream();
      clearPostStreamRefetchGuard();

      try {
        const conversationId = await createConversation(state.resourceFocus);
        dispatch({
          type: "SET_CONVERSATION",
          payload: { id: conversationId, messages: [] },
        });
        dispatch({
          type: "SET_PINNED",
          payload: Boolean(state.resourceFocus),
        });

        invalidateAskBloomConversation(state.resourceFocus);
      } catch (error) {
        console.error("Failed to start a new Ask Bloom conversation", error);
      }
    })();
  }, [
    cancelStream,
    clearPostStreamRefetchGuard,
    createConversation,
    invalidateAskBloomConversation,
    state.resourceFocus,
  ]);

  const loadConversation = React.useCallback(
    (conversationId: string) => {
      if (
        !conversationId ||
        (conversationId === state.conversationId &&
          !state.isLoadingConversation)
      ) {
        return;
      }

      cancelStream();
      clearPostStreamRefetchGuard();
      dispatch({
        type: "SELECT_CONVERSATION",
        payload: { id: conversationId },
      });
    },
    [
      cancelStream,
      clearPostStreamRefetchGuard,
      state.conversationId,
      state.isLoadingConversation,
    ],
  );

  const isResourceMatch = React.useCallback(
    (type: string, id: string) =>
      state.resourceFocus?.resourceType === type &&
      state.resourceFocus?.resourceId === id,
    [state.resourceFocus],
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
        const key = event.key.toLowerCase();
        if (key === "b") {
          event.preventDefault();
          if (state.isOpen) {
            close();
            return;
          }

          const resource =
            state.resourceFocus?.sourceRoute === location.pathname
              ? state.resourceFocus
              : null;
          if (resource) {
            openWithResource(resource);
            return;
          }

          openGeneral();
          return;
        }

        if (key === "k") {
          event.preventDefault();
          const parsedRouteResource = parseResourceFromPath(location.pathname);
          if (parsedRouteResource) {
            const nextFocus = getResourceFocusFromCache(
              parsedRouteResource.resourceType,
              parsedRouteResource.resourceId,
              queryClient,
            );

            if (nextFocus) {
              openWithResource(nextFocus);
              return;
            }
          }

          const currentRouteFocus =
            state.resourceFocus?.sourceRoute === location.pathname
              ? state.resourceFocus
              : null;
          if (currentRouteFocus) {
            openWithResource(currentRouteFocus);
            return;
          }

          openGeneral();
        }
      }

      if (
        event.key === "Escape" &&
        state.isOpen &&
        !activeElementIsInsideAskBloomInput()
      ) {
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    close,
    location.pathname,
    openGeneral,
    openWithResource,
    queryClient,
    state.isOpen,
    state.resourceFocus,
  ]);

  React.useEffect(
    () => () => {
      cancelAskBloomStreaming();
    },
    [cancelAskBloomStreaming],
  );

  const sendMessage = React.useCallback(
    (content: string) => {
      void (async () => {
        const trimmedContent = content.trim();
        if (
          !trimmedContent ||
          state.isStreaming ||
          state.isTransitioning ||
          state.isSendingMessage
        ) {
          return;
        }

        clearPostStreamRefetchGuard(state.conversationId);
        dispatch({ type: "SET_TRANSITIONING", payload: true });
        dispatch({ type: "DISMISS_RESOURCE_FORM" });
        void clearPersistedFormState();

        const createdAt = new Date().toISOString();
        const optimisticConversationId =
          state.conversationId ??
          `ask-bloom-pending-conversation-${crypto.randomUUID()}`;
        const userMessage: AskBloomMessage = {
          id: `ask-bloom-user-${crypto.randomUUID()}`,
          conversationId: optimisticConversationId,
          role: "user",
          content: trimmedContent,
          blocks: [{ type: "text", content: trimmedContent, data: {} }],
          toolCalls: [],
          createdAt,
          isStreaming: false,
        };
        const assistantMessageId = `ask-bloom-assistant-${crypto.randomUUID()}`;
        const streamingAssistantMessage: AskBloomMessage = {
          id: assistantMessageId,
          conversationId: optimisticConversationId,
          role: "assistant",
          content: "",
          blocks: [],
          toolCalls: [],
          createdAt,
          isStreaming: true,
        };
        const optimisticMessages = [
          ...state.messages,
          userMessage,
          streamingAssistantMessage,
        ];

        activeAssistantMessageIdRef.current = assistantMessageId;
        activeStreamResourceFocusRef.current = state.resourceFocus;
        activeAssistantBlocksRef.current = [];
        activeAssistantContentRef.current = "";

        dispatch({ type: "CLEAR_STREAMING_INDICATORS" });
        dispatch({ type: "CLEAR_STREAMING_BLOCKS" });
        dispatch({ type: "SET_SENDING_MESSAGE", payload: true });
        dispatch({ type: "ADD_MESSAGE", payload: userMessage });
        dispatch({ type: "ADD_MESSAGE", payload: streamingAssistantMessage });

        let conversationId = state.conversationId;
        try {
          if (!conversationId) {
            const ensured = await ensureConversation(state.resourceFocus);
            conversationId = ensured.id;
            dispatch({
              type: "SET_CONVERSATION",
              payload: {
                id: conversationId,
                messages: optimisticMessages.map((message) => ({
                  ...message,
                  conversationId,
                })),
              },
            });
          }

          activeConversationIdRef.current = conversationId;
          dispatch({ type: "SET_STREAMING", payload: true });
          dispatch({ type: "SET_TRANSITIONING", payload: false });
          dispatch({ type: "SET_SENDING_MESSAGE", payload: false });

          sendAskBloomStreamingMessage(trimmedContent, {
            conversationId,
            resourceFocus: state.resourceFocus,
            assistantMessageId,
          });
        } catch (error) {
          const fallbackMessage =
            error instanceof Error
              ? error.message
              : "Ask Bloom could not complete that request.";

          dispatch({
            type: "REMOVE_MESSAGE",
            payload: { id: assistantMessageId },
          });
          dispatch({
            type: "ADD_MESSAGE",
            payload: {
              id: `ask-bloom-assistant-${crypto.randomUUID()}`,
              conversationId: conversationId ?? optimisticConversationId,
              role: "assistant",
              content: fallbackMessage,
              blocks: [{ type: "text", content: fallbackMessage, data: {} }],
              toolCalls: [],
              createdAt: new Date().toISOString(),
              isStreaming: false,
            },
          });
          dispatch({ type: "SET_TRANSITIONING", payload: false });
          dispatch({ type: "SET_SENDING_MESSAGE", payload: false });
          dispatch({ type: "SET_STREAMING", payload: false });
          activeAssistantMessageIdRef.current = null;
          activeConversationIdRef.current = conversationId;
          activeStreamResourceFocusRef.current = null;
          activeAssistantBlocksRef.current = [];
          activeAssistantContentRef.current = "";
        }
      })();
    },
    [
      sendAskBloomStreamingMessage,
      ensureConversation,
      clearPersistedFormState,
      clearPostStreamRefetchGuard,
      state.conversationId,
      state.isSendingMessage,
      state.isTransitioning,
      state.messages,
      state.isStreaming,
      state.resourceFocus,
    ],
  );

  const retryStream = React.useCallback(() => {
    const lastAssistant = [...state.messages]
      .reverse()
      .find((entry) => entry.role === "assistant");
    const lastUser = [...state.messages]
      .reverse()
      .find((entry) => entry.role === "user");

    dispatch({ type: "CLEAR_STREAMING_INDICATORS" });
    dispatch({ type: "CLEAR_STREAMING_BLOCKS" });

    if (lastAssistant) {
      dispatch({ type: "REMOVE_MESSAGE", payload: { id: lastAssistant.id } });
    }
    if (lastUser) {
      dispatch({ type: "REMOVE_MESSAGE", payload: { id: lastUser.id } });
      sendMessage(lastUser.content);
    }
  }, [sendMessage, state.messages]);

  const keepPartialResponse = React.useCallback(() => {
    dispatch({ type: "CLEAR_STREAMING_INDICATORS" });
    dispatch({ type: "CLEAR_STREAMING_BLOCKS" });
  }, []);

  const executeActionCard = React.useCallback(
    async (messageId: string, card: AskBloomActionCard) => {
      if (!state.conversationId || !state.resourceFocus) {
        throw new Error("Ask Bloom needs an active resource conversation.");
      }

      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("Sign in to apply Ask Bloom actions.");
      }

      const targetMessage = state.messages.find(
        (message) => message.id === messageId,
      );
      if (!targetMessage) {
        throw new Error(
          "The selected Ask Bloom action is no longer available.",
        );
      }

      const executingBlocks = replaceActionCardBlock(
        targetMessage.blocks,
        card.mutationId,
        (existingCard) => ({
          ...existingCard,
          status: "executing",
          result: null,
          data: {
            ...existingCard.data,
            status: "executing",
            result: null,
          },
        }),
      );

      dispatch({
        type: "UPDATE_MESSAGE",
        payload: {
          id: messageId,
          partial: { blocks: executingBlocks },
        },
      });

      try {
        // Reuse bloom-assist for inline mutations so Ask Bloom goes through the
        // same validated tool executor path as full Bloom instead of duplicating
        // privileged writes in browser code.
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/bloom-assist`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              apikey: SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              conversation_id: state.conversationId,
              assistant_message_id: messageId,
              execute_action: {
                mutationId: card.mutationId,
                toolName: card.toolName,
                toolArgs: card.toolArgs,
              },
            }),
          },
        );

        const payload = (await response.json()) as Record<string, unknown>;
        if (!response.ok) {
          throw new Error(
            (typeof payload.error === "string" && payload.error) ||
              "Ask Bloom could not apply that action.",
          );
        }

        const status = payload.status === "completed" ? "completed" : "failed";
        const resultMessage =
          (typeof payload.result === "string" && payload.result) ||
          (typeof payload.error === "string" && payload.error) ||
          (status === "completed" ? "Applied successfully." : "Action failed.");

        const nextBlocks = replaceActionCardBlock(
          executingBlocks,
          card.mutationId,
          (existingCard) => ({
            ...existingCard,
            status,
            result: resultMessage,
            data: {
              ...existingCard.data,
              status,
              result: resultMessage,
            },
          }),
        );

        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            id: messageId,
            partial: { blocks: nextBlocks },
          },
        });

        if (status !== "completed") {
          return;
        }

        const nextFocus = buildResourceFocusFromMutationResult(
          state.resourceFocus,
          payload.data,
        );
        if (nextFocus) {
          dispatch({ type: "REFRESH_RESOURCE_FOCUS", payload: nextFocus });
        } else {
          refreshCurrentResourceFocus(state.resourceFocus);
        }

        invalidateFocusedResourceQueries(state.resourceFocus);
        invalidateAskBloomConversation(state.resourceFocus);
        dispatch({ type: "BUMP_CONTEXT_UPDATED_TOKEN" });
        dispatchAskBloomResourceSync({
          resourceType: state.resourceFocus.resourceType,
          resourceId: state.resourceFocus.resourceId,
          toolName: card.toolName,
          status: "completed",
        });
      } catch (error) {
        const failedMessage =
          error instanceof Error
            ? error.message
            : "Ask Bloom could not apply that action.";

        const failedBlocks = replaceActionCardBlock(
          executingBlocks,
          card.mutationId,
          (existingCard) => ({
            ...existingCard,
            status: "failed",
            result: failedMessage,
            data: {
              ...existingCard.data,
              status: "failed",
              result: failedMessage,
            },
          }),
        );

        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            id: messageId,
            partial: { blocks: failedBlocks },
          },
        });

        throw error;
      }
    },
    [
      invalidateAskBloomConversation,
      invalidateFocusedResourceQueries,
      refreshCurrentResourceFocus,
      session?.access_token,
      state.conversationId,
      state.messages,
      state.resourceFocus,
    ],
  );

  const dismissActionCard = React.useCallback(
    (messageId: string, mutationId: string) => {
      const targetMessage = state.messages.find(
        (message) => message.id === messageId,
      );
      if (!targetMessage) {
        return;
      }

      const nextBlocks = replaceActionCardBlock(
        targetMessage.blocks,
        mutationId,
        () => null,
      );

      dispatch({
        type: "UPDATE_MESSAGE",
        payload: {
          id: messageId,
          partial: { blocks: nextBlocks },
        },
      });

      void persistMessageBlocks(
        messageId,
        targetMessage.content,
        nextBlocks,
      ).catch((error) => {
        console.error("Failed to persist dismissed Ask Bloom action", error);
      });
    },
    [persistMessageBlocks, state.messages],
  );

  const value = React.useMemo<AskBloomContextValue>(
    () => ({
      ...state,
      state,
      openWithResource,
      openGeneral,
      close,
      toggleCollapse,
      setPanelWidth,
      clearResourceFocus,
      switchResource,
      pinConversation,
      unpinConversation,
      newConversation,
      loadConversation,
      setNavigationPrompt,
      dismissNavigationPrompt,
      acceptNavigationPrompt,
      sendMessage,
      cancelStream,
      retryStream,
      keepPartialResponse,
      dismissPendingTaskPlan,
      approveTaskPlan,
      cancelTaskPlan,
      retryTaskPlan,
      getTaskStatuses,
      getTaskCompletionSummary,
      isTaskPlanExecuting,
      getPlanDecision,
      presentResourceForm,
      dismissResourceForm,
      persistResourceFormState,
      clearPersistedFormState,
      executeActionCard,
      dismissActionCard,
      isResourceMatch,
    }),
    [
      acceptNavigationPrompt,
      approveTaskPlan,
      cancelStream,
      cancelTaskPlan,
      clearResourceFocus,
      clearPersistedFormState,
      close,
      dismissPendingTaskPlan,
      dismissNavigationPrompt,
      dismissActionCard,
      dismissResourceForm,
      executeActionCard,
      getPlanDecision,
      getTaskCompletionSummary,
      getTaskStatuses,
      isTaskPlanExecuting,
      isResourceMatch,
      keepPartialResponse,
      loadConversation,
      newConversation,
      openGeneral,
      openWithResource,
      pinConversation,
      persistResourceFormState,
      presentResourceForm,
      retryTaskPlan,
      retryStream,
      sendMessage,
      setNavigationPrompt,
      setPanelWidth,
      state,
      switchResource,
      toggleCollapse,
      unpinConversation,
    ],
  );

  return (
    <AskBloomContext.Provider value={value}>
      {children}
    </AskBloomContext.Provider>
  );
}
