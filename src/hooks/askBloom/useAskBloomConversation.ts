import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  stripRedundantContent,
  type BloomContentBlock,
} from "@/components/bloom/content/parseContentBlocks";
import {
  analyzeStreamingContent,
  extractPreFormText,
} from "@/components/bloom/utils/contentGate";
import { stripToolJsonFromText } from "@/components/bloom/utils/stripToolJson";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type {
  AskBloomBlock,
  AskBloomConversation,
  AskBloomMessage,
  AskBloomResourceType,
  AskBloomToolCall,
  AskBloomToolCallStatus,
} from "@/types/askBloom";
import {
  isRecord,
  readString,
  toAskBloomActionCard,
  toAskBloomBlockType,
  toDataRecord,
} from "@/utils/askBloomBlocks";

type BloomConversationRow =
  Database["public"]["Tables"]["bloom_conversations"]["Row"];
type BloomMessageRow = Database["public"]["Tables"]["bloom_messages"]["Row"];

interface UseAskBloomConversationParams {
  conversationId: string | null;
  resourceType: AskBloomResourceType | null;
  resourceId: string | null;
  enabled: boolean;
}

interface AskBloomConversationQueryResult {
  conversation: AskBloomConversation | null;
  messages: AskBloomMessage[];
}

const EMPTY_ASK_BLOOM_MESSAGES: AskBloomMessage[] = [];

const toToolCallStatus = (value: unknown): AskBloomToolCallStatus => {
  const normalized = readString(value).toLowerCase();
  switch (normalized) {
    case "running":
    case "executing":
      return "running";
    case "complete":
    case "completed":
      return "complete";
    case "error":
    case "failed":
      return "error";
    case "pending":
    default:
      return "pending";
  }
};

const parseSuggestionTags = (content: string): string[] => {
  const match = content.match(
    /<(?:suggestions|follow_ups)>([\s\S]*?)<\/(?:suggestions|follow_ups)>/i,
  );
  if (!match) {
    return [];
  }

  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : [];
  } catch {
    return [];
  }
};

const stripSuggestionTags = (content: string) =>
  content
    .replace(
      /<(?:suggestions|follow_ups)>[\s\S]*?<\/(?:suggestions|follow_ups)>/gi,
      "",
    )
    .trim();

const parseFollowUpChips = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];

const withFollowUpChipBlock = (
  blocks: AskBloomBlock[],
  followUpChips: string[],
): AskBloomBlock[] => {
  if (
    followUpChips.length === 0 ||
    blocks.some((block) => block.type === "suggestion_chips")
  ) {
    return blocks;
  }

  return [
    ...blocks,
    {
      type: "suggestion_chips",
      content: "",
      data: { suggestions: followUpChips },
    },
  ];
};

type ToolResultContentBlock = Extract<
  BloomContentBlock,
  { type: "tool_result" }
>;

const askBloomToolResultToContentBlock = (
  block: AskBloomBlock,
  index: number,
): ToolResultContentBlock | null => {
  if (block.type !== "tool_result") {
    return null;
  }

  const toolResult = block.toolResult;
  const trimmedContent = block.content.trim();
  return {
    type: "tool_result",
    id: block.id ?? `persisted-tool-result-${index}`,
    toolName: toolResult?.toolName || null,
    blockType: toolResult?.blockType ?? null,
    data: toolResult?.data ?? block.data,
    status: toolResult?.status ?? "success",
    message: toolResult?.message ?? (trimmedContent ? trimmedContent : null),
    error: toolResult?.error ?? null,
    count: toolResult?.count ?? null,
  };
};

const toolResultBlocksFromAskBloomBlocks = (
  blocks: AskBloomBlock[],
): ToolResultContentBlock[] =>
  blocks
    .map(askBloomToolResultToContentBlock)
    .filter((block): block is ToolResultContentBlock => block !== null);

const sanitizePersistedTextContent = (
  content: string,
  toolResultBlocks: ToolResultContentBlock[],
): string => {
  let sanitized = stripToolJsonFromText(content);
  const gateDecision = analyzeStreamingContent(sanitized, {
    hasToolResultBlocks: false,
    toolResultIdentifiers: new Set<string>(),
    isAfterToolResult: false,
  });

  if (
    gateDecision.action === "gate_json" ||
    (gateDecision.action === "suppress" &&
      (gateDecision.reason === "tool_error_json" ||
        gateDecision.reason === "tool_json_payload"))
  ) {
    sanitized = "";
  } else if (
    gateDecision.action === "intercept_form" ||
    gateDecision.action === "intercept_plan"
  ) {
    sanitized = extractPreFormText(sanitized);
  }

  if (toolResultBlocks.length > 0) {
    sanitized = stripRedundantContent(sanitized, toolResultBlocks);
  }

  return sanitized.trim();
};

const sanitizePersistedBlocks = (blocks: AskBloomBlock[]): AskBloomBlock[] => {
  const toolResultBlocks = toolResultBlocksFromAskBloomBlocks(blocks);
  return blocks
    .map((block) => {
      if (block.type !== "text") {
        return block;
      }

      const content = sanitizePersistedTextContent(
        block.content,
        toolResultBlocks,
      );
      return content === block.content ? block : { ...block, content };
    })
    .filter(
      (block) => block.type !== "text" || block.content.trim().length > 0,
    );
};

const sanitizePersistedMessageContent = (
  content: string,
  blocks: AskBloomBlock[],
): string =>
  sanitizePersistedTextContent(
    stripSuggestionTags(content),
    toolResultBlocksFromAskBloomBlocks(blocks),
  );

const readOriginalAssistantContent = (row: BloomMessageRow): string | null => {
  const blockData = row.block_data;

  if (isRecord(blockData) && Array.isArray(blockData.blocks)) {
    for (const block of blockData.blocks) {
      if (!isRecord(block)) {
        continue;
      }

      const blockType = toAskBloomBlockType(
        block.block_type ?? block.blockType,
      );
      if (blockType !== "text") {
        continue;
      }

      const payload = toDataRecord(block.payload);
      const content =
        readString(block.content) || readString(payload.text) || "";
      const normalizedContent = stripSuggestionTags(content).trim();
      if (normalizedContent) {
        return normalizedContent;
      }
    }
  }

  const fallbackContent = stripSuggestionTags(row.content ?? "").trim();
  return fallbackContent || null;
};

const parseBlocks = (
  row: BloomMessageRow,
  shouldSanitize: boolean,
): AskBloomBlock[] => {
  const blockData = row.block_data;
  const rawContent = row.content?.trim() ?? "";
  const fallbackText = stripSuggestionTags(rawContent);
  const followUpChips = [
    ...parseFollowUpChips(row.follow_up_chips),
    ...parseSuggestionTags(rawContent),
  ].filter((chip, index, chips) => chips.indexOf(chip) === index);

  if (isRecord(blockData) && Array.isArray(blockData.blocks)) {
    const parsed = blockData.blocks
      .filter(isRecord)
      .map((block): AskBloomBlock => {
        const payload = toDataRecord(block.payload);
        const blockType = toAskBloomBlockType(
          block.block_type ?? block.blockType,
        );
        const actionCard =
          blockType === "mutation_action"
            ? toAskBloomActionCard(payload)
            : null;

        if (actionCard) {
          return actionCard;
        }

        const safeBlockType =
          blockType === "mutation_action" ? "data_card" : blockType;

        const content =
          readString(block.content) ||
          readString(payload.text) ||
          (safeBlockType === "text" ? fallbackText : "");

        if (safeBlockType === "tool_result") {
          // Rebuild the structured tool-result payload so reloaded cards route
          // to the correct entity card (CustomerResultCard, etc.) instead of
          // degrading to the generic fallback. `serializeAskBloomBlock` embeds
          // tool_name / block_type / status / message / error / count in the
          // persisted payload, so recover them here.
          const persistedStatus = readString(payload.status).toLowerCase();
          const toolResultStatus: "success" | "error" =
            persistedStatus === "error" || persistedStatus === "failed"
              ? "error"
              : "success";
          const persistedCount = payload.count;

          return {
            type: "tool_result",
            content,
            data: payload,
            toolResult: {
              toolName: readString(payload.tool_name),
              blockType: readString(payload.block_type) || null,
              data: payload,
              status: toolResultStatus,
              message: readString(payload.message) || null,
              error: readString(payload.error) || null,
              count: typeof persistedCount === "number" ? persistedCount : null,
            },
          };
        }

        return {
          type: safeBlockType,
          content,
          data: payload,
        };
      });

    const normalized = shouldSanitize
      ? sanitizePersistedBlocks(parsed)
      : parsed;
    if (normalized.length > 0) {
      return withFollowUpChipBlock(normalized, followUpChips);
    }
  }

  const normalizedFallbackText = shouldSanitize
    ? sanitizePersistedTextContent(fallbackText, [])
    : fallbackText;
  if (!normalizedFallbackText) {
    return withFollowUpChipBlock([], followUpChips);
  }

  return withFollowUpChipBlock(
    [{ type: "text", content: normalizedFallbackText, data: {} }],
    followUpChips,
  );
};

const parseToolCalls = (row: BloomMessageRow): AskBloomToolCall[] => {
  if (!isRecord(row.metadata)) {
    return [];
  }

  const toolCalls = Array.isArray(row.metadata.tool_calls)
    ? row.metadata.tool_calls
    : Array.isArray(row.metadata.toolCalls)
      ? row.metadata.toolCalls
      : [];

  return toolCalls.filter(isRecord).map((toolCall, index): AskBloomToolCall => {
    const argumentsValue = isRecord(toolCall.arguments)
      ? toolCall.arguments
      : isRecord(toolCall.tool_input)
        ? toolCall.tool_input
        : {};

    return {
      id: readString(toolCall.id) || `tool-call-${row.id}-${index}`,
      name:
        readString(toolCall.name) || readString(toolCall.tool_name) || "tool",
      arguments: argumentsValue,
      result: toolCall.result ?? toolCall.tool_output ?? null,
      status: toToolCallStatus(toolCall.status),
    };
  });
};

const toAskBloomConversation = (
  row: BloomConversationRow,
): AskBloomConversation => ({
  id: row.id,
  tenantId: row.tenant_id,
  userId: row.user_id,
  title: row.title,
  status: row.status,
  mode: row.mode,
  metadata: row.metadata,
  messageCount: row.message_count,
  lastMessagePreview: row.last_message_preview,
  sessionType: row.session_type,
  resourceType: row.resource_type as AskBloomResourceType | null,
  resourceId: row.resource_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toAskBloomMessage = (row: BloomMessageRow): AskBloomMessage => {
  const shouldSanitize = row.role === "assistant";
  const blocks = parseBlocks(row, shouldSanitize);
  const originalContent = shouldSanitize
    ? readOriginalAssistantContent(row)
    : null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as AskBloomMessage["role"],
    content: shouldSanitize
      ? sanitizePersistedMessageContent(row.content ?? "", blocks)
      : (row.content ?? ""),
    originalContent: originalContent ?? undefined,
    blocks,
    toolCalls: parseToolCalls(row),
    createdAt: row.created_at,
    isStreaming: false,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
  };
};

export function useAskBloomConversation({
  conversationId,
  resourceType,
  resourceId,
  enabled,
}: UseAskBloomConversationParams) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: [
      "ask-bloom-conversation",
      conversationId,
      resourceType,
      resourceId,
    ],
    enabled: Boolean(
      enabled &&
      tenantId &&
      userId &&
      (conversationId || (resourceType && resourceId)),
    ),
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 0,
    retry: 1,
    queryFn: async (): Promise<AskBloomConversationQueryResult> => {
      if (!tenantId || !userId) {
        return { conversation: null, messages: [] };
      }

      if (conversationId) {
        const { data: conversationRow, error: conversationError } =
          await supabase
            .from("bloom_conversations")
            .select("*")
            .eq("id", conversationId)
            .eq("tenant_id", tenantId)
            .eq("user_id", userId)
            .maybeSingle();

        if (conversationError) {
          throw conversationError;
        }

        if (!conversationRow) {
          return { conversation: null, messages: [] };
        }

        const { data: messageRows, error: messageError } = await supabase
          .from("bloom_messages")
          .select("*")
          .eq("conversation_id", conversationRow.id)
          .eq("tenant_id", tenantId)
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        if (messageError) {
          throw messageError;
        }

        return {
          conversation: toAskBloomConversation(conversationRow),
          messages: (messageRows ?? []).map(toAskBloomMessage),
        };
      }

      if (!resourceType || !resourceId) {
        return { conversation: null, messages: [] };
      }

      const { data: conversationRows, error: conversationError } =
        await supabase
          .from("bloom_conversations")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("user_id", userId)
          .eq("session_type", "resource_focused")
          .eq("resource_type", resourceType)
          .eq("resource_id", resourceId)
          .order("updated_at", { ascending: false })
          .limit(1);

      if (conversationError) {
        throw conversationError;
      }

      const conversationRow = conversationRows?.[0] ?? null;
      if (!conversationRow) {
        return { conversation: null, messages: [] };
      }

      const { data: messageRows, error: messageError } = await supabase
        .from("bloom_messages")
        .select("*")
        .eq("conversation_id", conversationRow.id)
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (messageError) {
        throw messageError;
      }

      return {
        conversation: toAskBloomConversation(conversationRow),
        messages: (messageRows ?? []).map(toAskBloomMessage),
      };
    },
  });

  return {
    conversation: query.data?.conversation ?? null,
    messages: query.data?.messages ?? EMPTY_ASK_BLOOM_MESSAGES,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
