import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { bloomSupabase, type BloomMessageRole } from "@/hooks/bloom/types";

const BLOOM_BOOKMARKS_STALE_TIME_MS = 60_000;
const BLOOM_BOOKMARK_MESSAGE_COLUMNS =
  "id, content, role, conversation_id, created_at";
const BLOOM_BOOKMARK_CONVERSATION_COLUMNS = "id, title";

export interface BookmarkedMessage {
  messageId: string;
  contentPreview: string;
  role: Extract<BloomMessageRole, "assistant">;
  conversationId: string;
  conversationTitle: string;
  createdAt: string;
}

export const bloomBookmarksQueryBaseKey = ["bloom-bookmarks"] as const;

export const bloomBookmarksQueryKey = (
  tenantId: string | null,
  userId: string | null,
) => [...bloomBookmarksQueryBaseKey, tenantId, userId] as const;

const messagePreview = (content: string | null) =>
  (content ?? "").replace(/\s+/g, " ").trim().slice(0, 100);

export function useBloomBookmarks(tenantId: string | null = null) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const userId = user?.id ?? null;
  const resolvedTenantId = tenant?.id ?? tenantId;

  return useQuery({
    queryKey: bloomBookmarksQueryKey(resolvedTenantId, userId),
    enabled: Boolean(userId && resolvedTenantId),
    staleTime: BLOOM_BOOKMARKS_STALE_TIME_MS,
    queryFn: async (): Promise<BookmarkedMessage[]> => {
      if (!userId || !resolvedTenantId) {
        return [];
      }

      const { data: messages, error: messagesError } = await bloomSupabase
        .from("bloom_messages")
        .select(BLOOM_BOOKMARK_MESSAGE_COLUMNS)
        .eq("tenant_id", resolvedTenantId)
        .eq("user_id", userId)
        .eq("is_bookmarked", true)
        .eq("role", "assistant")
        .order("created_at", { ascending: false });

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
            .select(BLOOM_BOOKMARK_CONVERSATION_COLUMNS)
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
        contentPreview: messagePreview(message.content),
        role: "assistant",
        conversationId: message.conversation_id,
        conversationTitle:
          conversationTitles.get(message.conversation_id) ?? "New chat",
        createdAt: message.created_at,
      }));
    },
  });
}
