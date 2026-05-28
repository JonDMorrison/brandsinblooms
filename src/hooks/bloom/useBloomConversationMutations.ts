import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import {
  bloomSupabase,
  toBloomConversation,
  type BloomConversation,
  type BloomConversationStatus,
  type BloomMode,
} from "@/hooks/bloom/types";
import {
  bloomConversationsCountQueryBaseKey,
  bloomConversationsQueryBaseKey,
  sortBloomConversations,
} from "@/hooks/bloom/useBloomConversations";

interface RenameConversationInput {
  id: string;
  title: string;
}

interface UpdateConversationStatusInput {
  id: string;
  status: Exclude<BloomConversationStatus, "deleted"> | "deleted";
}

interface CreateConversationInput {
  id: string;
  mode: BloomMode;
}

interface OptimisticConversationContext {
  previousConversationLists: Array<
    [readonly unknown[], BloomConversation[] | undefined]
  >;
}

const BLOOM_CONVERSATION_SELECT_COLUMNS =
  "id, tenant_id, user_id, title, status, mode, message_count, last_message_preview, metadata, created_at, updated_at";

const createMutationErrorMessage = (action: string) =>
  `Failed to ${action} conversation`;

const getCachedConversationQueryOptions = (queryKey: readonly unknown[]) => {
  const includeArchived = queryKey[2] === true;
  const searchQuery = typeof queryKey[3] === "string" ? queryKey[3] : "";

  return { includeArchived, searchQuery };
};

const conversationBelongsInCache = (
  queryKey: readonly unknown[],
  conversation: BloomConversation,
) => {
  if (conversation.status === "deleted") {
    return false;
  }

  const { includeArchived, searchQuery } =
    getCachedConversationQueryOptions(queryKey);

  if (conversation.status === "archived" && !includeArchived) {
    return false;
  }

  if (searchQuery) {
    return conversation.title.toLowerCase().includes(searchQuery.toLowerCase());
  }

  return true;
};

const patchConversation = (
  queryKey: readonly unknown[],
  conversations: BloomConversation[] | undefined,
  id: string,
  patch: Partial<BloomConversation>,
) => {
  if (!conversations) {
    return conversations;
  }

  return sortBloomConversations(
    conversations
      .map((conversation) =>
        conversation.id === id ? { ...conversation, ...patch } : conversation,
      )
      .filter((conversation) =>
        conversationBelongsInCache(queryKey, conversation),
      ),
  );
};

const insertConversation = (
  queryKey: readonly unknown[],
  conversations: BloomConversation[] | undefined,
  conversation: BloomConversation,
) => {
  if (!conversationBelongsInCache(queryKey, conversation)) {
    return conversations;
  }

  return sortBloomConversations([conversation, ...(conversations ?? [])]);
};

export function useBloomConversationMutations() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId?: string }>();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const userId = user?.id ?? null;
  const tenantId = tenant?.id ?? null;
  const conversationsQueryBaseKey = bloomConversationsQueryBaseKey(tenantId);
  const conversationsCountQueryBaseKey =
    bloomConversationsCountQueryBaseKey(tenantId);

  const getConversationLists = useCallback(
    () =>
      queryClient.getQueriesData<BloomConversation[]>({
        queryKey: conversationsQueryBaseKey,
      }),
    [conversationsQueryBaseKey, queryClient],
  );

  const patchConversationLists = useCallback(
    (
      updater: (
        queryKey: readonly unknown[],
        conversations: BloomConversation[] | undefined,
      ) => BloomConversation[] | undefined,
    ) => {
      getConversationLists().forEach(([queryKey, conversations]) => {
        queryClient.setQueryData<BloomConversation[]>(
          queryKey,
          updater(queryKey, conversations),
        );
      });
    },
    [getConversationLists, queryClient],
  );

  const rollback = useCallback(
    (context: OptimisticConversationContext | undefined) => {
      context?.previousConversationLists.forEach(
        ([queryKey, previousValue]) => {
          queryClient.setQueryData(queryKey, previousValue);
        },
      );
    },
    [queryClient],
  );

  const createConversationMutation = useMutation({
    mutationFn: async ({
      id,
      mode,
    }: CreateConversationInput): Promise<string> => {
      if (!tenantId || !userId) {
        throw new Error("Sign in and select an organization to start Bloom.");
      }

      const { data, error } = await bloomSupabase
        .from("bloom_conversations")
        .insert({
          id,
          tenant_id: tenantId,
          user_id: userId,
          title: null,
          status: "active",
          mode,
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      return data.id;
    },
    onMutate: async ({ id, mode }) => {
      if (!tenantId || !userId) {
        return { previousConversationLists: [] };
      }

      await queryClient.cancelQueries({ queryKey: conversationsQueryBaseKey });
      const previousConversationLists = getConversationLists();
      const now = new Date().toISOString();
      const optimisticConversation: BloomConversation = {
        id,
        title: "New chat",
        status: "active",
        mode,
        messageCount: 0,
        lastMessagePreview: "",
        createdAt: now,
        updatedAt: now,
      };

      patchConversationLists((queryKey, conversations) =>
        insertConversation(queryKey, conversations, optimisticConversation),
      );

      return { previousConversationLists };
    },
    onError: (error, _variables, context) => {
      rollback(context);
      toast.error(createMutationErrorMessage("create"), {
        description: error.message,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: conversationsQueryBaseKey,
      });
      void queryClient.invalidateQueries({
        queryKey: conversationsCountQueryBaseKey,
      });
    },
  });

  const renameConversationMutation = useMutation({
    mutationFn: async ({ id, title }: RenameConversationInput) => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to rename Bloom chats.",
        );
      }

      const nextTitle = title.trim();
      if (!nextTitle) {
        throw new Error("Conversation title is required.");
      }

      const { data, error } = await bloomSupabase
        .from("bloom_conversations")
        .update({ title: nextTitle })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .select(BLOOM_CONVERSATION_SELECT_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      return toBloomConversation(data);
    },
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: conversationsQueryBaseKey });
      const previousConversationLists = getConversationLists();
      const nextTitle = title.trim();

      patchConversationLists((queryKey, conversations) =>
        patchConversation(queryKey, conversations, id, {
          title: nextTitle,
          updatedAt: new Date().toISOString(),
        }),
      );

      return { previousConversationLists };
    },
    onError: (error, _variables, context) => {
      rollback(context);
      toast.error(createMutationErrorMessage("rename"), {
        description: error.message,
      });
    },
    onSuccess: (conversation) => {
      patchConversationLists((queryKey, conversations) =>
        patchConversation(
          queryKey,
          conversations,
          conversation.id,
          conversation,
        ),
      );
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: UpdateConversationStatusInput) => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to update Bloom chats.",
        );
      }

      const { data, error } = await bloomSupabase
        .from("bloom_conversations")
        .update({ status })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .select(BLOOM_CONVERSATION_SELECT_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      return toBloomConversation(data);
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: conversationsQueryBaseKey });
      const previousConversationLists = getConversationLists();

      patchConversationLists((queryKey, conversations) =>
        patchConversation(queryKey, conversations, id, {
          status,
          updatedAt: new Date().toISOString(),
        }),
      );

      return { previousConversationLists };
    },
    onError: (error, variables, context) => {
      rollback(context);
      toast.error(createMutationErrorMessage(variables.status), {
        description: error.message,
      });
    },
    onSuccess: (conversation, variables) => {
      if (
        (variables.status === "archived" || variables.status === "deleted") &&
        chatId === variables.id
      ) {
        navigate("/bloom");
      }

      if (conversation.status !== "deleted") {
        patchConversationLists((queryKey, conversations) =>
          patchConversation(
            queryKey,
            conversations,
            conversation.id,
            conversation,
          ),
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: conversationsQueryBaseKey,
      });
      void queryClient.invalidateQueries({
        queryKey: conversationsCountQueryBaseKey,
      });
    },
  });

  const createConversation = useCallback(
    (mode: BloomMode = "standard") =>
      createConversationMutation.mutateAsync({
        id: crypto.randomUUID(),
        mode,
      }),
    [createConversationMutation],
  );

  const renameConversation = useCallback(
    (id: string, title: string) =>
      renameConversationMutation.mutateAsync({ id, title }),
    [renameConversationMutation],
  );

  const pinConversation = useCallback(
    (id: string) => {
      const conversationMap = new Map<string, BloomConversation>();

      getConversationLists().forEach(([, conversations]) => {
        conversations?.forEach((conversation) => {
          conversationMap.set(conversation.id, conversation);
        });
      });

      const conversations = Array.from(conversationMap.values());
      const current = conversations.find(
        (conversation) => conversation.id === id,
      );
      const pinnedCount = conversations.filter(
        (conversation) => conversation.status === "pinned",
      ).length;

      if (current?.status !== "pinned" && pinnedCount >= 5) {
        const error = new Error("You can pin up to 5 Bloom conversations.");
        toast.error("Pin limit reached", { description: error.message });
        return Promise.reject(error);
      }

      return updateStatusMutation.mutateAsync({ id, status: "pinned" });
    },
    [getConversationLists, updateStatusMutation],
  );

  const unpinConversation = useCallback(
    (id: string) => updateStatusMutation.mutateAsync({ id, status: "active" }),
    [updateStatusMutation],
  );

  const archiveConversation = useCallback(
    (id: string) =>
      updateStatusMutation.mutateAsync({ id, status: "archived" }),
    [updateStatusMutation],
  );

  const unarchiveConversation = useCallback(
    (id: string) => updateStatusMutation.mutateAsync({ id, status: "active" }),
    [updateStatusMutation],
  );

  const deleteConversation = useCallback(
    (id: string) => updateStatusMutation.mutateAsync({ id, status: "deleted" }),
    [updateStatusMutation],
  );

  return {
    createConversation,
    renameConversation,
    pinConversation,
    unpinConversation,
    archiveConversation,
    unarchiveConversation,
    deleteConversation,
    isCreatingConversation: createConversationMutation.isPending,
    isRenamingConversation: renameConversationMutation.isPending,
    isUpdatingConversationStatus: updateStatusMutation.isPending,
  };
}
