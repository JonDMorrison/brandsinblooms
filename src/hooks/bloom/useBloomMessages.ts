import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import {
  bloomSupabase,
  isBloomMissingRelationError,
  toBloomMessage,
  toBloomToolExecution,
  type BloomMessage,
  type BloomToolExecution,
} from "@/hooks/bloom/types";

const BLOOM_MESSAGES_PAGE_SIZE = 20;
const BLOOM_MESSAGES_STALE_TIME_MS = 60_000;

const BLOOM_MESSAGE_COLUMNS =
  "id, conversation_id, tenant_id, user_id, role, content, thinking_content, block_data, mode, model, tokens_input, tokens_output, attachments, follow_up_chips, is_bookmarked, is_compacted, metadata, created_at";

const BLOOM_TOOL_EXECUTION_COLUMNS =
  "id, message_id, conversation_id, tenant_id, user_id, tool_name, tool_input, tool_output, status, error_message, execution_time_ms, created_at";

export interface BloomMessagesPage {
  messages: BloomMessage[];
  nextCursor: string | null;
}

export const bloomMessagesQueryKey = (conversationId: string | null) =>
  ["bloom-messages", conversationId] as const;

interface FetchBloomMessagesPageOptions {
  conversationId: string;
  tenantId: string;
  userId: string;
  cursor?: string | null;
  pageSize?: number;
}

async function fetchToolExecutionsForMessages({
  conversationId,
  messageIds,
  tenantId,
  userId,
}: {
  conversationId: string;
  messageIds: string[];
  tenantId: string;
  userId: string;
}): Promise<BloomToolExecution[]> {
  if (messageIds.length === 0) {
    return [];
  }

  const { data, error } = await bloomSupabase
    .from("bloom_tool_executions")
    .select(BLOOM_TOOL_EXECUTION_COLUMNS)
    .eq("conversation_id", conversationId)
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });

  if (error) {
    if (isBloomMissingRelationError(error)) {
      return [];
    }

    throw error;
  }

  return (data ?? []).map(toBloomToolExecution);
}

function attachToolExecutionsToSourceMessages(
  messages: BloomMessage[],
  executions: BloomToolExecution[],
) {
  if (executions.length === 0) {
    return messages;
  }

  const executionsByMessageId = new Map<string, BloomToolExecution[]>();

  for (const execution of executions) {
    const current = executionsByMessageId.get(execution.messageId) ?? [];
    current.push(execution);
    executionsByMessageId.set(execution.messageId, current);
  }

  return messages.map((message) => {
    const attachedExecutions = executionsByMessageId.get(message.id);
    return attachedExecutions
      ? {
          ...message,
          toolExecutions: [
            ...(message.toolExecutions ?? []),
            ...attachedExecutions,
          ],
        }
      : message;
  });
}

function attachToolExecutionsToAssistantMessages(messages: BloomMessage[]) {
  const messageIndexById = new Map(
    messages.map((message, index) => [message.id, index] as const),
  );
  const executionsByAssistantId = new Map<string, BloomToolExecution[]>();

  const targetAssistantIdFor = (message: BloomMessage) => {
    if (message.role === "assistant") {
      return message.id;
    }

    const linkedIndex = messageIndexById.get(message.id);
    if (linkedIndex === undefined) {
      return null;
    }

    for (let index = linkedIndex + 1; index < messages.length; index += 1) {
      const candidate = messages[index];
      if (candidate.role === "assistant") {
        return candidate.id;
      }
      if (candidate.role === "user") {
        return null;
      }
    }

    return null;
  };

  for (const message of messages) {
    const executions = message.toolExecutions ?? [];
    if (executions.length === 0) {
      continue;
    }

    const assistantId = targetAssistantIdFor(message);
    if (!assistantId) {
      continue;
    }

    const current = executionsByAssistantId.get(assistantId) ?? [];
    current.push(...executions);
    executionsByAssistantId.set(assistantId, current);
  }

  return messages.map((message) =>
    message.role === "assistant"
      ? {
          ...message,
          toolExecutions: executionsByAssistantId.get(message.id) ?? [],
        }
      : { ...message, toolExecutions: [] },
  );
}

export async function fetchBloomMessagesPage({
  conversationId,
  tenantId,
  userId,
  cursor = null,
  pageSize = BLOOM_MESSAGES_PAGE_SIZE,
}: FetchBloomMessagesPageOptions): Promise<BloomMessagesPage> {
  let query = bloomSupabase
    .from("bloom_messages")
    .select(BLOOM_MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(pageSize);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    if (isBloomMissingRelationError(error)) {
      return { messages: [], nextCursor: null };
    }

    throw error;
  }

  const messages = (data ?? []).map(toBloomMessage).reverse();
  const toolExecutions = await fetchToolExecutionsForMessages({
    conversationId,
    messageIds: messages.map((message) => message.id),
    tenantId,
    userId,
  });
  const messagesWithToolExecutions = attachToolExecutionsToSourceMessages(
    messages,
    toolExecutions,
  );

  return {
    messages: messagesWithToolExecutions,
    nextCursor:
      messages.length === pageSize ? (messages[0]?.createdAt ?? null) : null,
  };
}

export function useBloomMessages(conversationId: string | null) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const userId = user?.id ?? null;
  const tenantId = tenant?.id ?? null;

  const query = useInfiniteQuery({
    queryKey: bloomMessagesQueryKey(conversationId),
    enabled: Boolean(conversationId && tenantId && userId),
    staleTime: BLOOM_MESSAGES_STALE_TIME_MS,
    retry: 1,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      if (!conversationId || !tenantId || !userId) {
        return { messages: [], nextCursor: null } satisfies BloomMessagesPage;
      }

      return fetchBloomMessagesPage({
        conversationId,
        tenantId,
        userId,
        cursor: pageParam,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const messages = useMemo(() => {
    const flattenedMessages =
      query.data?.pages
        .slice()
        .reverse()
        .flatMap((page) => page.messages) ?? [];

    return attachToolExecutionsToAssistantMessages(flattenedMessages);
  }, [query.data?.pages]);

  return {
    data: messages,
    isLoading: query.isLoading,
    error: query.error,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
