import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/config";
import type {
  AskBloomActionCard,
  AskBloomBlock,
  AskBloomMessage,
  AskBloomToolCall,
  AskBloomToolCallStatus,
  ResourceFocus,
} from "@/types/askBloom";
import {
  isRecord,
  readString,
  toAskBloomActionCard,
  toAskBloomBlockType,
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
}

interface SendMessageOverrides {
  conversationId?: string | null;
  resourceFocus?: ResourceFocus | null;
}

interface ParsedSseEvent {
  event: string;
  data: unknown;
}

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

const appendToolCall = (
  current: AskBloomToolCall[],
  next: AskBloomToolCall,
): AskBloomToolCall[] => {
  const existingIndex = current.findIndex((toolCall) => toolCall.id === next.id);
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

  if (normalizedContent && normalizedBlocks.every((block) => block.type !== "text")) {
    return [{ type: "text", content, data: {} }, ...normalizedBlocks];
  }

  return normalizedBlocks;
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
    entityId: entityType ? resourceFocus?.resourceId ?? null : null,
    pageName: "Ask Bloom",
    availableActions: [],
    suggestions: [],
  };
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
      const createdAt = new Date().toISOString();

      cancelRequestedRef.current = false;
      activeRequestIdRef.current = requestId;
      setIsStreaming(true);

      void (async () => {
        let assistantContent = "";
        let assistantBlocks: AskBloomBlock[] = [];
        let toolCalls: AskBloomToolCall[] = [];
        let resolvedAssistantConversationId = resolvedConversationId;

        try {
          const abortController = new AbortController();
          abortControllerRef.current = abortController;

          const response = await fetch(`${SUPABASE_URL}/functions/v1/bloom-assist`, {
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
              session_type: resolvedResourceFocus ? "resource_focused" : "standard",
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
          });

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
                const tokenText = typeof event.data === "string"
                  ? event.data
                  : readString(isRecord(event.data) ? event.data.text : "");
                if (tokenText) {
                  assistantContent += tokenText;
                  optionsRef.current.onStreamingUpdate(assistantContent);
                }
                continue;
              }

              if (event.event === "thinking_token") {
                continue;
              }

              if (event.event === "action_card") {
                const actionCard = toAskBloomActionCard(event.data);
                if (!actionCard) {
                  continue;
                }

                assistantBlocks = [
                  ...assistantBlocks,
                  actionCard,
                ];
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
                continue;
              }

              if (event.event === "tool_result" && isRecord(event.data)) {
                const toolCallId = readString(event.data.id);
                const toolName =
                  readString(event.data.tool) ||
                  readString(event.data.tool_name) ||
                  "tool";
                const result = event.data.result ?? null;
                const blockType = toAskBloomBlockType(
                  event.data.block_type ?? event.data.blockType ?? "data_card",
                );
                const safeBlockType =
                  blockType === "mutation_action" ? "data_card" : blockType;

                toolCalls = appendToolCall(toolCalls, {
                  id: toolCallId || `tool-result-${toolName}`,
                  name: toolName,
                  arguments: {},
                  result,
                  status: toToolCallStatus(event.data.status ?? "complete"),
                });

                assistantBlocks = [
                  ...assistantBlocks,
                  {
                    type: safeBlockType,
                    content: readString(event.data.content),
                    data: toDataRecord(result),
                  },
                ];
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
                  `ask-bloom-assistant-${requestId}`;

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
                }

                optionsRef.current.onMessage({
                  id: persistedAssistantMessageId,
                  conversationId:
                    resolvedAssistantConversationId ??
                    `ask-bloom-conversation-${requestId}`,
                  role: "assistant",
                  content: assistantContent,
                  blocks: buildAssistantBlocks(assistantContent, assistantBlocks),
                  toolCalls,
                  createdAt,
                  isStreaming: false,
                });
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
            optionsRef.current.onError("Connection lost. Partial response preserved.");
          }
        } catch (error) {
          if (
            activeRequestIdRef.current !== requestId ||
            cancelRequestedRef.current
          ) {
            return;
          }

          optionsRef.current.onError(
            error instanceof Error
              ? error.message
              : "Ask Bloom could not complete that request.",
          );
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
