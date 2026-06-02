import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useTenant } from "@/hooks/useTenant";
import { bloomSupabase, type BloomMessageRole } from "@/hooks/bloom/types";

const BLOOM_MESSAGE_SEARCH_STALE_TIME_MS = 30_000;
const BLOOM_MESSAGE_SEARCH_LIMIT = 20;
const BLOOM_MESSAGE_SEARCH_SNIPPET_RADIUS = 50;
const BLOOM_MESSAGE_SEARCH_COLUMNS =
  "id, conversation_id, role, content, created_at";
const BLOOM_MESSAGE_SEARCH_CONVERSATION_COLUMNS = "id, title";

export type BloomMessageSearchSnippet = {
  before: string;
  match: string;
  after: string;
};

export type SearchResult = {
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  snippet: BloomMessageSearchSnippet;
  role: BloomMessageRole;
  createdAt: string;
  relevance: number | null;
};

export type BloomMessageSearchResult = SearchResult;

export const bloomMessageSearchQueryKey = (
  tenantId: string | null,
  userId: string | null,
  debouncedQuery: string,
) => ["bloom-message-search", tenantId, userId, debouncedQuery] as const;

export function normalizeBloomMessageSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

function findCaseInsensitiveMatch(content: string, query: string) {
  return content.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
}

export function extractSnippet(
  content: string,
  query: string,
): BloomMessageSearchSnippet {
  const normalizedQuery = normalizeBloomMessageSearchQuery(query);
  const matchIndex = normalizedQuery
    ? findCaseInsensitiveMatch(content, normalizedQuery)
    : -1;

  if (matchIndex === -1) {
    return {
      before: "",
      match: content.slice(0, BLOOM_MESSAGE_SEARCH_SNIPPET_RADIUS * 2).trim(),
      after:
        content.length > BLOOM_MESSAGE_SEARCH_SNIPPET_RADIUS * 2 ? "..." : "",
    };
  }

  const beforeStart = Math.max(
    0,
    matchIndex - BLOOM_MESSAGE_SEARCH_SNIPPET_RADIUS,
  );
  const matchEnd = matchIndex + normalizedQuery.length;
  const afterEnd = Math.min(
    content.length,
    matchEnd + BLOOM_MESSAGE_SEARCH_SNIPPET_RADIUS,
  );

  return {
    before: `${beforeStart > 0 ? "..." : ""}${content.slice(beforeStart, matchIndex)}`,
    match: content.slice(matchIndex, matchEnd),
    after: `${content.slice(matchEnd, afterEnd)}${afterEnd < content.length ? "..." : ""}`,
  };
}

export function useBloomMessageSearch(
  query: string,
  tenantId: string | null = null,
) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const userId = user?.id ?? null;
  const resolvedTenantId = tenant?.id ?? tenantId;
  const debouncedQuery = useDebounce(
    normalizeBloomMessageSearchQuery(query),
    300,
  );

  const searchQuery = useQuery({
    queryKey: bloomMessageSearchQueryKey(
      resolvedTenantId,
      userId,
      debouncedQuery,
    ),
    enabled: Boolean(userId && resolvedTenantId && debouncedQuery),
    staleTime: BLOOM_MESSAGE_SEARCH_STALE_TIME_MS,
    queryFn: async (): Promise<SearchResult[]> => {
      if (!userId || !resolvedTenantId || !debouncedQuery) {
        return [];
      }

      const { data: messages, error: messagesError } = await bloomSupabase
        .from("bloom_messages")
        .select(BLOOM_MESSAGE_SEARCH_COLUMNS)
        .eq("tenant_id", resolvedTenantId)
        .eq("user_id", userId)
        .eq("is_compacted", false)
        .not("content", "is", null)
        .ilike("content", `%${debouncedQuery}%`)
        .order("created_at", { ascending: false })
        .limit(BLOOM_MESSAGE_SEARCH_LIMIT);

      if (messagesError) {
        throw messagesError;
      }

      const conversationIds = Array.from(
        new Set((messages ?? []).map((message) => message.conversation_id)),
      );
      const conversationTitles = new Map<string, string>();

      if (conversationIds.length > 0) {
        const { data: conversations, error: conversationsError } =
          await bloomSupabase
            .from("bloom_conversations")
            .select(BLOOM_MESSAGE_SEARCH_CONVERSATION_COLUMNS)
            .eq("tenant_id", resolvedTenantId)
            .eq("user_id", userId)
            .in("id", conversationIds);

        if (conversationsError) {
          throw conversationsError;
        }

        (conversations ?? []).forEach((conversation) => {
          conversationTitles.set(
            conversation.id,
            conversation.title?.trim() || "New chat",
          );
        });
      }

      return (messages ?? []).map((message) => ({
        messageId: message.id,
        conversationId: message.conversation_id,
        conversationTitle:
          conversationTitles.get(message.conversation_id) ?? "New chat",
        snippet: extractSnippet(message.content ?? "", debouncedQuery),
        role: message.role,
        createdAt: message.created_at,
        relevance: null,
      }));
    },
  });

  return {
    ...searchQuery,
    data: searchQuery.data ?? [],
  };
}
