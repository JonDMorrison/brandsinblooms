import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import {
  bloomSupabase,
  isBloomMissingRelationError,
  toBloomConversation,
  type BloomConversation,
  type BloomConversationStatus,
} from "@/hooks/bloom/types";

const BLOOM_CONVERSATIONS_STALE_TIME_MS = 30_000;
const BLOOM_CONVERSATION_SERVER_SEARCH_THRESHOLD = 100;

const BLOOM_CONVERSATION_COLUMNS =
  "id, tenant_id, user_id, title, status, mode, message_count, last_message_preview, metadata, created_at, updated_at";

interface BloomConversationsOptions {
  includeArchived?: boolean;
  searchQuery?: string;
}

interface BloomConversationsQueryKeyOptions extends BloomConversationsOptions {
  serverSideSearch?: boolean;
}

const STATUS_PRIORITY: Record<BloomConversationStatus, number> = {
  pinned: 0,
  active: 1,
  archived: 2,
  deleted: 3,
};

export const bloomConversationsQueryBaseKey = (tenantId: string | null) =>
  ["bloom-conversations", tenantId] as const;

export const bloomConversationsCountQueryKey = (
  tenantId: string | null,
  userId: string | null,
  includeArchived = false,
) => ["bloom-conversations-count", tenantId, userId, includeArchived] as const;

export const bloomConversationsCountQueryBaseKey = (tenantId: string | null) =>
  ["bloom-conversations-count", tenantId] as const;

export const normalizeBloomConversationSearch = (searchQuery = "") =>
  searchQuery.trim().replace(/\s+/g, " ");

export const bloomConversationsQueryKey = (
  tenantId: string | null,
  userId: string | null,
  {
    includeArchived = false,
    searchQuery = "",
    serverSideSearch = false,
  }: BloomConversationsQueryKeyOptions = {},
) =>
  [
    ...bloomConversationsQueryBaseKey(tenantId),
    userId,
    includeArchived,
    serverSideSearch ? normalizeBloomConversationSearch(searchQuery) : "",
  ] as const;

const getConversationStatuses = (includeArchived: boolean) =>
  includeArchived
    ? (["active", "pinned", "archived"] satisfies BloomConversationStatus[])
    : (["active", "pinned"] satisfies BloomConversationStatus[]);

export const sortBloomConversations = (conversations: BloomConversation[]) =>
  [...conversations].sort((left, right) => {
    const statusDifference =
      STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status];

    if (statusDifference !== 0) {
      return statusDifference;
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });

export function useBloomConversations({
  includeArchived = false,
  searchQuery = "",
}: BloomConversationsOptions = {}) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const userId = user?.id ?? null;
  const tenantId = tenant?.id ?? null;
  const normalizedSearchQuery = normalizeBloomConversationSearch(searchQuery);

  const countQuery = useQuery({
    queryKey: bloomConversationsCountQueryKey(
      tenantId,
      userId,
      includeArchived,
    ),
    enabled: Boolean(userId && tenantId),
    retry: 1,
    staleTime: BLOOM_CONVERSATIONS_STALE_TIME_MS,
    queryFn: async (): Promise<number> => {
      if (!userId || !tenantId) {
        return 0;
      }

      const { count, error } = await bloomSupabase
        .from("bloom_conversations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .in("status", getConversationStatuses(includeArchived));

      if (error) {
        if (isBloomMissingRelationError(error)) {
          return 0;
        }

        throw error;
      }

      return count ?? 0;
    },
  });

  const useServerSideSearch =
    normalizedSearchQuery.length > 0 &&
    (countQuery.data ?? 0) > BLOOM_CONVERSATION_SERVER_SEARCH_THRESHOLD;

  const query = useQuery({
    queryKey: bloomConversationsQueryKey(tenantId, userId, {
      includeArchived,
      searchQuery: normalizedSearchQuery,
      serverSideSearch: useServerSideSearch,
    }),
    enabled: Boolean(userId && tenantId),
    retry: 1,
    staleTime: BLOOM_CONVERSATIONS_STALE_TIME_MS,
    queryFn: async (): Promise<BloomConversation[]> => {
      if (!userId || !tenantId) {
        return [];
      }

      let query = bloomSupabase
        .from("bloom_conversations")
        .select(BLOOM_CONVERSATION_COLUMNS, { count: "exact" })
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .in("status", getConversationStatuses(includeArchived))
        .order("updated_at", { ascending: false });

      if (useServerSideSearch) {
        query = query.ilike("title", `%${normalizedSearchQuery}%`);
      }

      const { data, error } = await query;

      if (error) {
        if (isBloomMissingRelationError(error)) {
          return [];
        }

        throw error;
      }

      return sortBloomConversations((data ?? []).map(toBloomConversation));
    },
  });

  return {
    ...query,
    data: query.data ?? [],
    isLoading: query.isLoading,
  };
}
