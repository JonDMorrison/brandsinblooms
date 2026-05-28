import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useAskBloomStreaming } from "@/hooks/askBloom/useAskBloomStreaming";
import { useAskBloomConversation } from "@/hooks/askBloom/useAskBloomConversation";
import { useAskBloomNavigation } from "@/hooks/askBloom/useAskBloomNavigation";
import type {
  AskBloomActionCard,
  AskBloomBlock,
  AskBloomContextValue,
  AskBloomMessage,
  AskBloomNavigationPrompt,
  AskBloomState,
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

type AskBloomAction =
  | { type: "OPEN_WITH_RESOURCE"; payload: ResourceFocus }
  | { type: "OPEN_GENERAL" }
  | { type: "CLOSE" }
  | { type: "TOGGLE_COLLAPSE" }
  | { type: "SET_PANEL_WIDTH"; payload: number }
  | { type: "SET_RESOURCE_FOCUS"; payload: ResourceFocus }
  | { type: "REFRESH_RESOURCE_FOCUS"; payload: ResourceFocus }
  | { type: "CLEAR_RESOURCE_FOCUS" }
  | { type: "SET_CONVERSATION"; payload: { id: string; messages: AskBloomMessage[] } }
  | { type: "ADD_MESSAGE"; payload: AskBloomMessage }
  | {
      type: "UPDATE_MESSAGE";
      payload: { id: string; partial: Partial<AskBloomMessage> };
    }
  | { type: "SET_STREAMING"; payload: boolean }
  | { type: "SET_LOADING_CONVERSATION"; payload: boolean }
  | { type: "SET_PINNED"; payload: boolean }
  | { type: "SET_NAVIGATION_PROMPT"; payload: AskBloomNavigationPrompt | null }
  | { type: "BUMP_CONTEXT_UPDATED_TOKEN" }
  | { type: "RESET" };

const ASK_BLOOM_QUERY_KEY = "ask-bloom-conversation";
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 600;
const DEFAULT_PANEL_WIDTH = 400;

const initialState: AskBloomState = {
  isOpen: false,
  panelWidth: DEFAULT_PANEL_WIDTH,
  isCollapsed: false,
  resourceFocus: null,
  contextUpdatedToken: 0,
  navigationPrompt: null,
  conversationId: null,
  messages: [],
  isStreaming: false,
  isLoadingConversation: false,
  isPinned: false,
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
      return root === "customer-360" && queryKey[1] === resourceFocus.resourceId;
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
        isLoadingConversation: true,
        isPinned: true,
      };
    case "OPEN_GENERAL":
      return {
        ...state,
        isOpen: true,
        isCollapsed: false,
        resourceFocus: null,
        navigationPrompt: null,
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
        isLoadingConversation: true,
        isPinned: true,
      };
    case "REFRESH_RESOURCE_FOCUS":
      return {
        ...state,
        resourceFocus: action.payload,
      };
    case "CLEAR_RESOURCE_FOCUS":
      return {
        ...state,
        resourceFocus: null,
        navigationPrompt: null,
        isPinned: false,
        isLoadingConversation: false,
      };
    case "SET_CONVERSATION":
      return {
        ...state,
        conversationId: action.payload.id,
        messages: action.payload.messages,
        isLoadingConversation: false,
      };
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
    case "SET_STREAMING":
      return {
        ...state,
        isStreaming: action.payload,
      };
    case "SET_LOADING_CONVERSATION":
      return {
        ...state,
        isLoadingConversation: action.payload,
      };
    case "SET_PINNED":
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
    case "RESET":
      return initialState;
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
  const [state, dispatch] = React.useReducer(askBloomReducer, initialState);
  const { tenant } = useTenant();
  const { user, session } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const creatingResourceConversationKeyRef = React.useRef<string | null>(null);
  const activeAssistantMessageIdRef = React.useRef<string | null>(null);
  const activeStreamResourceFocusRef = React.useRef<ResourceFocus | null>(null);
  const activeAssistantBlocksRef = React.useRef<AskBloomBlock[]>([]);

  const resourceType = state.resourceFocus?.resourceType ?? null;
  const resourceId = state.resourceFocus?.resourceId ?? null;

  const conversationQuery = useAskBloomConversation({
    resourceType,
    resourceId,
    enabled: Boolean(state.resourceFocus),
  });

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

  React.useEffect(() => {
    const currentResourceFocus = state.resourceFocus;
    if (!currentResourceFocus) {
      creatingResourceConversationKeyRef.current = null;
      return;
    }

    if (conversationQuery.isLoading) {
      dispatch({ type: "SET_LOADING_CONVERSATION", payload: true });
      return;
    }

    if (conversationQuery.error) {
      console.error("Failed to load Ask Bloom conversation", conversationQuery.error);
      dispatch({ type: "SET_LOADING_CONVERSATION", payload: false });
      return;
    }

    if (conversationQuery.conversation) {
      creatingResourceConversationKeyRef.current = null;
      if (!state.isStreaming) {
        dispatch({
          type: "SET_CONVERSATION",
          payload: {
            id: conversationQuery.conversation.id,
            messages: conversationQuery.messages,
          },
        });
      }
      dispatch({ type: "SET_PINNED", payload: true });
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
        const conversationId = await createConversation(currentResourceFocus);
        if (cancelled) {
          return;
        }

        dispatch({
          type: "SET_CONVERSATION",
          payload: { id: conversationId, messages: [] },
        });
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
    createConversation,
    queryClient,
    state.isStreaming,
    state.resourceFocus,
  ]);

  const openWithResource = React.useCallback((resource: ResourceFocus) => {
    dispatch({ type: "OPEN_WITH_RESOURCE", payload: resource });
  }, []);

  const openGeneral = React.useCallback(() => {
    dispatch({ type: "OPEN_GENERAL" });
  }, []);

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
    dispatch({ type: "CLEAR_RESOURCE_FOCUS" });
  }, []);

  const switchResource = React.useCallback((resource: ResourceFocus) => {
    dispatch({ type: "SET_RESOURCE_FOCUS", payload: resource });
  }, []);

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
    dispatch({ type: "SET_NAVIGATION_PROMPT", payload: null });
    dispatch({ type: "SET_RESOURCE_FOCUS", payload: nextFocus });
  }, [state.navigationPrompt]);

  const pinConversation = React.useCallback(() => {
    dispatch({ type: "SET_PINNED", payload: true });
  }, []);

  const unpinConversation = React.useCallback(() => {
    dispatch({ type: "SET_PINNED", payload: false });
  }, []);

  const invalidateAskBloomConversation = React.useCallback(
    (resourceFocus: ResourceFocus | null) => {
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
    [queryClient],
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

      if (!isMatchingResourceQuery(event.query.queryKey, state.resourceFocus!)) {
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
      dispatch({ type: "SET_STREAMING", payload: false });

      if (assistantMessageId) {
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            id: assistantMessageId,
            partial: {
              content: message.content,
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
      invalidateAskBloomConversation(activeStreamResourceFocusRef.current);
      activeStreamResourceFocusRef.current = null;
    },
    onError: (errorMessage) => {
      const assistantMessageId = activeAssistantMessageIdRef.current;
      dispatch({ type: "SET_STREAMING", payload: false });

      if (assistantMessageId) {
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            id: assistantMessageId,
            partial: {
              content: errorMessage,
              blocks: buildMessageBlocks(errorMessage, []),
              isStreaming: false,
            },
          },
        });
      }

      activeAssistantMessageIdRef.current = null;
      activeAssistantBlocksRef.current = [];
      invalidateAskBloomConversation(activeStreamResourceFocusRef.current);
      activeStreamResourceFocusRef.current = null;
    },
    onDone: () => {
      dispatch({ type: "SET_STREAMING", payload: false });
    },
  });

  const cancelStream = React.useCallback(() => {
    cancelAskBloomStreaming();
    dispatch({ type: "SET_STREAMING", payload: false });

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
  }, [cancelAskBloomStreaming]);

  const newConversation = React.useCallback(() => {
    void (async () => {
      cancelStream();

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
  }, [cancelStream, createConversation, invalidateAskBloomConversation, state.resourceFocus]);

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

      if (event.key === "Escape" && state.isOpen && !activeElementIsInsideAskBloomInput()) {
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
        if (!trimmedContent || state.isStreaming) {
          return;
        }

        let conversationId = state.conversationId;
        try {
          if (!conversationId) {
            conversationId = await createConversation(state.resourceFocus);
            dispatch({
              type: "SET_CONVERSATION",
              payload: { id: conversationId, messages: state.messages },
            });
          }

          const createdAt = new Date().toISOString();
          const userMessage: AskBloomMessage = {
            id: `ask-bloom-user-${crypto.randomUUID()}`,
            conversationId,
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
            conversationId,
            role: "assistant",
            content: "",
            blocks: [],
            toolCalls: [],
            createdAt,
            isStreaming: true,
          };

          activeAssistantMessageIdRef.current = assistantMessageId;
          activeStreamResourceFocusRef.current = state.resourceFocus;
          activeAssistantBlocksRef.current = [];

          dispatch({ type: "ADD_MESSAGE", payload: userMessage });
          dispatch({ type: "ADD_MESSAGE", payload: streamingAssistantMessage });
          dispatch({ type: "SET_STREAMING", payload: true });

          sendAskBloomStreamingMessage(trimmedContent, {
            conversationId,
            resourceFocus: state.resourceFocus,
          });
        } catch (error) {
          const fallbackMessage =
            error instanceof Error
              ? error.message
              : "Ask Bloom could not complete that request.";

          dispatch({
            type: "ADD_MESSAGE",
            payload: {
              id: `ask-bloom-assistant-${crypto.randomUUID()}`,
              conversationId: state.conversationId ?? `ask-bloom-error-${crypto.randomUUID()}`,
              role: "assistant",
              content: fallbackMessage,
              blocks: [{ type: "text", content: fallbackMessage, data: {} }],
              toolCalls: [],
              createdAt: new Date().toISOString(),
              isStreaming: false,
            },
          });
          dispatch({ type: "SET_STREAMING", payload: false });
        }
      })();
    },
    [
      sendAskBloomStreamingMessage,
      createConversation,
      state.conversationId,
      state.messages,
      state.isStreaming,
      state.resourceFocus,
    ],
  );

  const executeActionCard = React.useCallback(
    async (messageId: string, card: AskBloomActionCard) => {
      if (!state.conversationId || !state.resourceFocus) {
        throw new Error("Ask Bloom needs an active resource conversation.");
      }

      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("Sign in to apply Ask Bloom actions.");
      }

      const targetMessage = state.messages.find((message) => message.id === messageId);
      if (!targetMessage) {
        throw new Error("The selected Ask Bloom action is no longer available.");
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
        const response = await fetch(`${SUPABASE_URL}/functions/v1/bloom-assist`, {
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
        });

        const payload = (await response.json()) as Record<string, unknown>;
        if (!response.ok) {
          throw new Error(
            (typeof payload.error === "string" && payload.error) ||
              "Ask Bloom could not apply that action.",
          );
        }

        const status =
          payload.status === "completed" ? "completed" : "failed";
        const resultMessage =
          (typeof payload.result === "string" && payload.result) ||
          (typeof payload.error === "string" && payload.error) ||
          (status === "completed"
            ? "Applied successfully."
            : "Action failed.");

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
      const targetMessage = state.messages.find((message) => message.id === messageId);
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

      void persistMessageBlocks(messageId, targetMessage.content, nextBlocks).catch(
        (error) => {
          console.error("Failed to persist dismissed Ask Bloom action", error);
        },
      );
    },
    [persistMessageBlocks, state.messages],
  );

  const value = React.useMemo<AskBloomContextValue>(
    () => ({
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
      setNavigationPrompt,
      dismissNavigationPrompt,
      acceptNavigationPrompt,
      sendMessage,
      cancelStream,
      executeActionCard,
      dismissActionCard,
      isResourceMatch,
    }),
    [
      acceptNavigationPrompt,
      cancelStream,
      clearResourceFocus,
      close,
      dismissNavigationPrompt,
      dismissActionCard,
      executeActionCard,
      isResourceMatch,
      newConversation,
      openGeneral,
      openWithResource,
      pinConversation,
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
    <AskBloomContext.Provider value={value}>{children}</AskBloomContext.Provider>
  );
}
