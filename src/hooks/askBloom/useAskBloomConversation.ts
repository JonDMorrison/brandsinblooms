import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
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
  resourceType: AskBloomResourceType | null;
  resourceId: string | null;
  enabled: boolean;
}

interface AskBloomConversationQueryResult {
  conversation: AskBloomConversation | null;
  messages: AskBloomMessage[];
}

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
  const match = content.match(/<(?:suggestions|follow_ups)>([\s\S]*?)<\/(?:suggestions|follow_ups)>/i);
  if (!match) {
    return [];
  }

  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        )
      : [];
  } catch {
    return [];
  }
};

const stripSuggestionTags = (content: string) =>
  content
    .replace(/<(?:suggestions|follow_ups)>[\s\S]*?<\/(?:suggestions|follow_ups)>/gi, "")
    .trim();

const parseFollowUpChips = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
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

const parseBlocks = (row: BloomMessageRow): AskBloomBlock[] => {
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
          (safeBlockType === "text"
            ? fallbackText
            : "");

        return {
          type: safeBlockType,
          content,
          data: payload,
        };
      });

    if (parsed.length > 0) {
      return withFollowUpChipBlock(parsed, followUpChips);
    }
  }

  if (!fallbackText) {
    return withFollowUpChipBlock([], followUpChips);
  }

  return withFollowUpChipBlock(
    [{ type: "text", content: fallbackText, data: {} }],
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
      name: readString(toolCall.name) || readString(toolCall.tool_name) || "tool",
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
  messageCount: row.message_count,
  lastMessagePreview: row.last_message_preview,
  sessionType: row.session_type,
  resourceType: row.resource_type as AskBloomResourceType | null,
  resourceId: row.resource_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toAskBloomMessage = (row: BloomMessageRow): AskBloomMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  role: row.role as AskBloomMessage["role"],
  content: row.content ?? "",
  blocks: parseBlocks(row),
  toolCalls: parseToolCalls(row),
  createdAt: row.created_at,
  isStreaming: false,
});

export function useAskBloomConversation({
  resourceType,
  resourceId,
  enabled,
}: UseAskBloomConversationParams) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ["ask-bloom-conversation", resourceType, resourceId],
    enabled: Boolean(enabled && resourceType && resourceId && tenantId && userId),
    staleTime: 0,
    retry: 1,
    queryFn: async (): Promise<AskBloomConversationQueryResult> => {
      if (!resourceType || !resourceId || !tenantId || !userId) {
        return { conversation: null, messages: [] };
      }

      const { data: conversationRows, error: conversationError } = await supabase
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
    messages: query.data?.messages ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
