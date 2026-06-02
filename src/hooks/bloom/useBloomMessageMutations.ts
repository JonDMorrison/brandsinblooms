import { useCallback } from "react";
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/config";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import {
  bloomSupabase,
  type BloomJsonArray,
  type BloomJsonObject,
  type BloomMessage,
  type BloomMessageMetadata,
  type BloomMode,
  type BloomPageContextPayload,
  type MessageFeedback,
  toBloomJsonArray,
  toBloomJsonObject,
} from "@/hooks/bloom/types";
import {
  parseBloomTaskCompletionSummary,
  parseBloomTaskPlan,
  parseBloomTaskStatusUpdate,
  taskPlanBlockData,
  type BloomEditedTaskFields,
  type BloomTaskCompletionSummary,
  type BloomTaskPlan,
  type BloomTaskStatusUpdate,
} from "@/hooks/bloom/taskPlanTypes";
import { bloomBookmarksQueryBaseKey } from "@/hooks/bloom/useBloomBookmarks";
import {
  bloomConversationsQueryBaseKey,
  sortBloomConversations,
} from "@/hooks/bloom/useBloomConversations";
import {
  bloomMessagesQueryKey,
  fetchBloomMessagesPage,
  type BloomMessagesPage,
} from "@/hooks/bloom/useBloomMessages";
import type { BloomConversation } from "@/hooks/bloom/types";

interface SendMessageInput {
  conversationId: string;
  text: string;
  mode: BloomMode;
  pageContext: BloomPageContextPayload | null;
  timezone: string;
  attachments?: BloomJsonArray;
}

interface ToggleBookmarkInput {
  messageId: string;
  currentState: boolean;
}

interface SubmitFeedbackInput {
  messageId: string;
  feedback: MessageFeedback;
}

interface EditAndResendInput {
  messageId: string;
  newText: string;
}

interface TaskPlanApprovalInput {
  conversationId: string;
  plan: BloomTaskPlan;
  approvedTaskIds: string[];
  skippedTaskIds: string[];
  editedFields: BloomEditedTaskFields;
  mode: BloomMode;
  timezone: string;
  retryTaskId?: string | null;
}

interface BloomMessageMutationHandlers {
  onTaskPlan?: (plan: BloomTaskPlan) => void;
  onTaskProgress?: (progress: BloomTaskStatusUpdate) => void;
  onTaskComplete?: (summary: BloomTaskCompletionSummary) => void;
}

interface SendMessageResult {
  page: BloomMessagesPage;
  title: string | null;
}

interface SendMessageContext {
  previousMessages: InfiniteData<BloomMessagesPage, string | null> | undefined;
  previousConversationLists: Array<
    [readonly unknown[], BloomConversation[] | undefined]
  >;
}

interface ToggleBookmarkContext {
  previousMessageLists: Array<
    [
      readonly unknown[],
      InfiniteData<BloomMessagesPage, string | null> | undefined,
    ]
  >;
}

interface MessageListMutationContext {
  previousMessageLists: Array<
    [
      readonly unknown[],
      InfiniteData<BloomMessagesPage, string | null> | undefined,
    ]
  >;
}

interface EditAndResendResult {
  conversationId: string;
  text: string;
  mode: BloomMode;
  attachments: BloomJsonArray;
}

interface BloomSseEvent {
  event: string;
  data: unknown;
}

const appendMessage = (
  current: InfiniteData<BloomMessagesPage, string | null> | undefined,
  message: BloomMessage,
): InfiniteData<BloomMessagesPage, string | null> => {
  if (!current || current.pages.length === 0) {
    return {
      pages: [{ messages: [message], nextCursor: null }],
      pageParams: [null],
    };
  }

  const [recentPage, ...olderPages] = current.pages;

  return {
    ...current,
    pages: [
      {
        ...recentPage,
        messages: [...recentPage.messages, message],
      },
      ...olderPages,
    ],
  };
};

const upsertMessage = (
  current: InfiniteData<BloomMessagesPage, string | null> | undefined,
  message: BloomMessage,
): InfiniteData<BloomMessagesPage, string | null> => {
  if (!current || current.pages.length === 0) {
    return appendMessage(current, message);
  }

  const exists = current.pages.some((page) =>
    page.messages.some((candidate) => candidate.id === message.id),
  );

  if (!exists) {
    return appendMessage(current, message);
  }

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      messages: page.messages.map((candidate) =>
        candidate.id === message.id ? message : candidate,
      ),
    })),
  };
};

const createLiveTaskPlanMessage = (
  conversationId: string,
  mode: BloomMode,
  plan: BloomTaskPlan,
): BloomMessage => ({
  id: `live-task-plan-${plan.planId}`,
  conversationId,
  role: "assistant",
  text: plan.summary || "I prepared a task plan for your approval.",
  thinkingContent: null,
  blockData: taskPlanBlockData(plan),
  mode,
  model: null,
  tokensInput: null,
  tokensOutput: null,
  attachments: [],
  followUpChips: [],
  isBookmarked: false,
  isCompacted: false,
  metadata: {},
  createdAt: plan.createdAt,
});

const parseSseMessage = (rawMessage: string): BloomSseEvent | null => {
  const lines = rawMessage.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
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
    return { event, data: JSON.parse(dataText) };
  } catch {
    return { event, data: dataText };
  }
};

const readSseErrorMessage = (value: unknown) => {
  if (isRecord(value) && typeof value.message === "string") {
    return value.message;
  }

  return typeof value === "string" ? value : "Bloom Assist stream failed.";
};

const readResponseErrorMessage = async (response: Response) => {
  const text = await response.text();
  if (!text.trim()) {
    return `Bloom Assist request failed with status ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(text);
    if (isRecord(parsed) && typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {
    // Use the raw response text below.
  }

  return text;
};

const dispatchBloomSseEvent = (
  event: BloomSseEvent,
  handlers: BloomMessageMutationHandlers | undefined,
) => {
  if (event.event === "task_plan") {
    const plan = parseBloomTaskPlan(event.data);
    if (plan) {
      handlers?.onTaskPlan?.(plan);
    }
    return;
  }

  if (event.event === "task_progress") {
    const progress = parseBloomTaskStatusUpdate(event.data);
    if (progress) {
      handlers?.onTaskProgress?.(progress);
    }
    return;
  }

  if (event.event === "task_complete") {
    const summary = parseBloomTaskCompletionSummary(event.data);
    if (summary) {
      handlers?.onTaskComplete?.(summary);
    }
  }
};

const postBloomAssistStream = async (
  body: BloomTaskJsonObject,
  handlers: BloomMessageMutationHandlers | undefined,
) => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error("Sign in to message Bloom.");
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/bloom-assist`, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response));
  }

  if (!response.body) {
    return [];
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: BloomSseEvent[] = [];
  let buffer = "";

  const consumeBuffer = (isFinal = false) => {
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = isFinal ? "" : (parts.pop() ?? "");

    for (const part of parts) {
      const event = parseSseMessage(part.trim());
      if (!event) {
        continue;
      }

      if (event.event === "error") {
        throw new Error(readSseErrorMessage(event.data));
      }

      events.push(event);
      dispatchBloomSseEvent(event, handlers);
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

  return events;
};

const getTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeResponseTitle = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const title = value.trim();
  return title.length > 0 ? title : null;
};

const getResponseConversationId = (value: Record<string, unknown>) => {
  const conversationId = value.conversation_id ?? value.conversationId;
  return typeof conversationId === "string" ? conversationId : null;
};

const extractTitleFromResponseData = (
  value: unknown,
  expectedConversationId: string,
  depth = 0,
): string | null => {
  if (depth > 5) {
    return null;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    try {
      return extractTitleFromResponseData(
        JSON.parse(trimmedValue),
        expectedConversationId,
        depth + 1,
      );
    } catch {
      const sseDataLines = trimmedValue
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"));

      for (const line of sseDataLines) {
        const title = extractTitleFromResponseData(
          line.slice("data:".length).trim(),
          expectedConversationId,
          depth + 1,
        );

        if (title) {
          return title;
        }
      }
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const title = extractTitleFromResponseData(
        item,
        expectedConversationId,
        depth + 1,
      );

      if (title) {
        return title;
      }
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const responseConversationId = getResponseConversationId(value);
  if (
    responseConversationId &&
    responseConversationId !== expectedConversationId
  ) {
    return null;
  }

  const directTitle = normalizeResponseTitle(value.title);
  if (directTitle) {
    return directTitle;
  }

  const nestedCandidates = [value.data, value.conversation, value.payload];
  for (const candidate of nestedCandidates) {
    const title = extractTitleFromResponseData(
      candidate,
      expectedConversationId,
      depth + 1,
    );

    if (title) {
      return title;
    }
  }

  return null;
};

const flattenCachedMessages = (
  data: InfiniteData<BloomMessagesPage, string | null>,
) =>
  data.pages
    .slice()
    .reverse()
    .flatMap((page) => page.messages)
    .sort(
      (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
    );

const findRegenerationSourceMessage = (
  messageLists: Array<
    [
      readonly unknown[],
      InfiniteData<BloomMessagesPage, string | null> | undefined,
    ]
  >,
  assistantMessageId: string,
) => {
  for (const [, data] of messageLists) {
    if (!data) {
      continue;
    }

    const messages = flattenCachedMessages(data);
    const assistantIndex = messages.findIndex(
      (message) =>
        message.id === assistantMessageId && message.role === "assistant",
    );

    if (assistantIndex === -1) {
      continue;
    }

    for (let index = assistantIndex - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "user") {
        return message;
      }
    }
  }

  return null;
};

const mergeFeedbackMetadata = (
  metadata: BloomJsonObject,
  feedback: MessageFeedback,
): BloomMessageMetadata => ({
  ...metadata,
  feedback,
});

const patchMessage = (
  current: InfiniteData<BloomMessagesPage, string | null> | undefined,
  messageId: string,
  updater: (message: BloomMessage) => BloomMessage,
) => {
  if (!current) {
    return current;
  }

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.id === messageId ? updater(message) : message,
      ),
    })),
  };
};

const patchBookmark = (
  current: InfiniteData<BloomMessagesPage, string | null> | undefined,
  messageId: string,
  isBookmarked: boolean,
) =>
  patchMessage(current, messageId, (message) => ({
    ...message,
    isBookmarked,
  }));

const patchFeedback = (
  current: InfiniteData<BloomMessagesPage, string | null> | undefined,
  messageId: string,
  feedback: MessageFeedback,
) =>
  patchMessage(current, messageId, (message) => ({
    ...message,
    metadata: mergeFeedbackMetadata(message.metadata, feedback),
  }));

const patchMessageText = (
  current: InfiniteData<BloomMessagesPage, string | null> | undefined,
  messageId: string,
  text: string,
) => patchMessage(current, messageId, (message) => ({ ...message, text }));

export function useBloomMessageMutations(
  handlers?: BloomMessageMutationHandlers,
) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const userId = user?.id ?? null;
  const tenantId = tenant?.id ?? null;
  const conversationsQueryBaseKey = bloomConversationsQueryBaseKey(tenantId);

  const getConversationLists = useCallback(
    () =>
      queryClient.getQueriesData<BloomConversation[]>({
        queryKey: conversationsQueryBaseKey,
      }),
    [conversationsQueryBaseKey, queryClient],
  );

  const patchConversationLists = useCallback(
    (updater: (conversation: BloomConversation) => BloomConversation) => {
      getConversationLists().forEach(([queryKey, conversations]) => {
        if (!conversations) {
          return;
        }

        queryClient.setQueryData<BloomConversation[]>(
          queryKey,
          sortBloomConversations(conversations.map(updater)),
        );
      });
    },
    [getConversationLists, queryClient],
  );

  const sendMessageMutation = useMutation({
    mutationFn: async ({
      conversationId,
      text,
      mode,
      pageContext,
      timezone,
      attachments = [],
    }: SendMessageInput): Promise<SendMessageResult> => {
      if (!tenantId || !userId) {
        throw new Error("Sign in and select an organization to message Bloom.");
      }

      const message = text.trim();
      if (!message) {
        throw new Error("Message text is required.");
      }

      const streamEvents = await postBloomAssistStream(
        {
          conversation_id: conversationId,
          message,
          mode,
          page_context: pageContext,
          timezone,
          attachments,
        },
        {
          ...handlers,
          onTaskPlan: (plan) => {
            queryClient.setQueryData<
              InfiniteData<BloomMessagesPage, string | null>
            >(bloomMessagesQueryKey(conversationId), (current) =>
              upsertMessage(
                current,
                createLiveTaskPlanMessage(conversationId, mode, plan),
              ),
            );
            handlers?.onTaskPlan?.(plan);
          },
        },
      );

      const page = await fetchBloomMessagesPage({
        conversationId,
        tenantId,
        userId,
      });

      return {
        page,
        title: extractTitleFromResponseData(streamEvents, conversationId),
      };
    },
    onMutate: async ({ conversationId, text, mode, attachments = [] }) => {
      const messageQueryKey = bloomMessagesQueryKey(conversationId);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: messageQueryKey }),
        queryClient.cancelQueries({ queryKey: conversationsQueryBaseKey }),
      ]);

      const previousMessages =
        queryClient.getQueryData<
          InfiniteData<BloomMessagesPage, string | null>
        >(messageQueryKey);
      const previousConversationLists = getConversationLists();
      const now = new Date().toISOString();
      const trimmedText = text.trim();

      queryClient.setQueryData<InfiniteData<BloomMessagesPage, string | null>>(
        messageQueryKey,
        (current) =>
          appendMessage(current, {
            id: `optimistic-${crypto.randomUUID()}`,
            conversationId,
            role: "user",
            text: trimmedText,
            thinkingContent: null,
            blockData: {},
            mode,
            model: null,
            tokensInput: null,
            tokensOutput: null,
            attachments,
            followUpChips: [],
            isBookmarked: false,
            isCompacted: false,
            metadata: {},
            createdAt: now,
          }),
      );

      patchConversationLists((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messageCount: conversation.messageCount + 1,
              lastMessagePreview: trimmedText.slice(0, 180),
              updatedAt: now,
            }
          : conversation,
      );

      return { previousMessages, previousConversationLists };
    },
    onError: (error, variables, context) => {
      queryClient.setQueryData(
        bloomMessagesQueryKey(variables.conversationId),
        context?.previousMessages,
      );
      context?.previousConversationLists.forEach(
        ([queryKey, previousValue]) => {
          queryClient.setQueryData(queryKey, previousValue);
        },
      );
      toast.error("Failed to send Bloom message", {
        description: error.message,
      });
    },
    onSuccess: ({ page, title }, variables) => {
      queryClient.setQueryData<InfiniteData<BloomMessagesPage, string | null>>(
        bloomMessagesQueryKey(variables.conversationId),
        { pages: [page], pageParams: [null] },
      );

      if (title) {
        patchConversationLists((conversation) =>
          conversation.id === variables.conversationId
            ? { ...conversation, title, updatedAt: new Date().toISOString() }
            : conversation,
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: bloomMessagesQueryKey(variables.conversationId),
      });
      void queryClient.invalidateQueries({
        queryKey: conversationsQueryBaseKey,
      });
    },
  });

  const approveTaskPlanMutation = useMutation({
    mutationFn: async ({
      approvedTaskIds,
      conversationId,
      editedFields,
      mode,
      plan,
      retryTaskId = null,
      skippedTaskIds,
      timezone,
    }: TaskPlanApprovalInput): Promise<BloomMessagesPage> => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to approve Bloom tasks.",
        );
      }

      await postBloomAssistStream(
        {
          conversation_id: conversationId,
          plan_id: plan.planId,
          approved_task_ids: approvedTaskIds,
          skipped_task_ids: skippedTaskIds,
          edited_fields: editedFields,
          retry_task_id: retryTaskId,
          mode,
          timezone,
        },
        handlers,
      );

      return fetchBloomMessagesPage({ conversationId, tenantId, userId });
    },
    onError: (error) => {
      toast.error("Failed to execute Bloom task plan", {
        description: error.message,
      });
    },
    onSuccess: (page, variables) => {
      queryClient.setQueryData<InfiniteData<BloomMessagesPage, string | null>>(
        bloomMessagesQueryKey(variables.conversationId),
        { pages: [page], pageParams: [null] },
      );
    },
    onSettled: (_data, _error, variables) => {
      if (!variables) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: bloomMessagesQueryKey(variables.conversationId),
      });
      void queryClient.invalidateQueries({
        queryKey: conversationsQueryBaseKey,
      });
    },
  });

  const regenerateResponseMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const messageLists = queryClient.getQueriesData<
        InfiniteData<BloomMessagesPage, string | null>
      >({ queryKey: ["bloom-messages"] });
      const sourceMessage = findRegenerationSourceMessage(
        messageLists,
        messageId,
      );

      if (!sourceMessage) {
        throw new Error(
          "No preceding user message found for this Bloom response.",
        );
      }

      await sendMessageMutation.mutateAsync({
        conversationId: sourceMessage.conversationId,
        text: sourceMessage.text,
        mode: sourceMessage.mode,
        pageContext: null,
        timezone: getTimezone(),
        attachments: sourceMessage.attachments,
      });
    },
    onError: (error) => {
      if (
        error.message ===
        "No preceding user message found for this Bloom response."
      ) {
        toast.error("Unable to regenerate Bloom response", {
          description: error.message,
        });
      }
    },
  });

  const toggleBookmarkMutation = useMutation({
    mutationFn: async ({ messageId, currentState }: ToggleBookmarkInput) => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to update Bloom messages.",
        );
      }

      const { error } = await bloomSupabase
        .from("bloom_messages")
        .update({ is_bookmarked: !currentState })
        .eq("id", messageId)
        .eq("tenant_id", tenantId)
        .eq("user_id", userId);

      if (error) {
        throw error;
      }
    },
    onMutate: async ({ messageId, currentState }) => {
      await queryClient.cancelQueries({ queryKey: ["bloom-messages"] });
      const previousMessageLists = queryClient.getQueriesData<
        InfiniteData<BloomMessagesPage, string | null>
      >({ queryKey: ["bloom-messages"] });

      queryClient.setQueriesData<
        InfiniteData<BloomMessagesPage, string | null>
      >({ queryKey: ["bloom-messages"] }, (current) =>
        patchBookmark(current, messageId, !currentState),
      );

      return { previousMessageLists };
    },
    onError: (
      error,
      _variables,
      context: ToggleBookmarkContext | undefined,
    ) => {
      context?.previousMessageLists.forEach(([queryKey, previousValue]) => {
        queryClient.setQueryData(queryKey, previousValue);
      });
      toast.error("Failed to update bookmark", {
        description: error.message,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["bloom-messages"] });
      void queryClient.invalidateQueries({
        queryKey: bloomBookmarksQueryBaseKey,
      });
    },
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async ({ messageId, feedback }: SubmitFeedbackInput) => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to update Bloom messages.",
        );
      }

      const { data: message, error: messageError } = await bloomSupabase
        .from("bloom_messages")
        .select("id, role, metadata")
        .eq("id", messageId)
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .single();

      if (messageError) {
        throw messageError;
      }

      if (message.role !== "assistant") {
        throw new Error(
          "Feedback can only be submitted for assistant messages.",
        );
      }

      const metadata = mergeFeedbackMetadata(
        toBloomJsonObject(message.metadata),
        feedback,
      );

      const { error: updateError } = await bloomSupabase
        .from("bloom_messages")
        .update({ metadata })
        .eq("id", messageId)
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .eq("role", "assistant");

      if (updateError) {
        throw updateError;
      }
    },
    onMutate: async ({ messageId, feedback }) => {
      await queryClient.cancelQueries({ queryKey: ["bloom-messages"] });
      const previousMessageLists = queryClient.getQueriesData<
        InfiniteData<BloomMessagesPage, string | null>
      >({ queryKey: ["bloom-messages"] });

      queryClient.setQueriesData<
        InfiniteData<BloomMessagesPage, string | null>
      >({ queryKey: ["bloom-messages"] }, (current) =>
        patchFeedback(current, messageId, feedback),
      );

      return { previousMessageLists };
    },
    onError: (
      error,
      _variables,
      context: MessageListMutationContext | undefined,
    ) => {
      context?.previousMessageLists.forEach(([queryKey, previousValue]) => {
        queryClient.setQueryData(queryKey, previousValue);
      });
      toast.error("Failed to save Bloom feedback", {
        description: error.message,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["bloom-messages"] });
    },
  });

  const editAndResendMutation = useMutation({
    mutationFn: async ({
      messageId,
      newText,
    }: EditAndResendInput): Promise<EditAndResendResult> => {
      if (!tenantId || !userId) {
        throw new Error(
          "Sign in and select an organization to update Bloom messages.",
        );
      }

      const text = newText.trim();
      if (!text) {
        throw new Error("Message text is required.");
      }

      const { data: message, error: messageError } = await bloomSupabase
        .from("bloom_messages")
        .select("id, conversation_id, role, mode, attachments")
        .eq("id", messageId)
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .single();

      if (messageError) {
        throw messageError;
      }

      if (message.role !== "user") {
        throw new Error("Only user messages can be edited and resent.");
      }

      const { error: updateError } = await bloomSupabase
        .from("bloom_messages")
        .update({ content: text })
        .eq("id", messageId)
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .eq("role", "user");

      if (updateError) {
        throw updateError;
      }

      return {
        conversationId: message.conversation_id,
        text,
        mode: message.mode,
        attachments: toBloomJsonArray(message.attachments),
      };
    },
    onMutate: async ({ messageId, newText }) => {
      await queryClient.cancelQueries({ queryKey: ["bloom-messages"] });
      const previousMessageLists = queryClient.getQueriesData<
        InfiniteData<BloomMessagesPage, string | null>
      >({ queryKey: ["bloom-messages"] });
      const text = newText.trim();

      queryClient.setQueriesData<
        InfiniteData<BloomMessagesPage, string | null>
      >({ queryKey: ["bloom-messages"] }, (current) =>
        patchMessageText(current, messageId, text),
      );

      return { previousMessageLists };
    },
    onError: (
      error,
      _variables,
      context: MessageListMutationContext | undefined,
    ) => {
      context?.previousMessageLists.forEach(([queryKey, previousValue]) => {
        queryClient.setQueryData(queryKey, previousValue);
      });
      toast.error("Failed to edit Bloom message", {
        description: error.message,
      });
    },
    onSuccess: (result) => {
      void sendMessageMutation
        .mutateAsync({
          conversationId: result.conversationId,
          text: result.text,
          mode: result.mode,
          pageContext: null,
          timezone: getTimezone(),
          attachments: result.attachments,
        })
        .catch(() => undefined);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["bloom-messages"] });
    },
  });

  const sendMessage = useCallback(
    (
      conversationId: string,
      text: string,
      mode: BloomMode,
      pageContext: BloomPageContextPayload | null,
      timezone: string,
      attachments?: BloomJsonArray,
    ) =>
      sendMessageMutation.mutateAsync({
        conversationId,
        text,
        mode,
        pageContext,
        timezone,
        attachments,
      }),
    [sendMessageMutation],
  );

  const toggleBookmark = useCallback(
    (messageId: string, currentState: boolean) =>
      toggleBookmarkMutation.mutateAsync({ messageId, currentState }),
    [toggleBookmarkMutation],
  );

  const submitFeedback = useCallback(
    (messageId: string, feedback: MessageFeedback) =>
      submitFeedbackMutation.mutateAsync({ messageId, feedback }),
    [submitFeedbackMutation],
  );

  const editAndResend = useCallback(
    (messageId: string, newText: string) => {
      const text = newText.trim();
      if (!text) {
        const error = new Error("Message text is required.");
        toast.error("Failed to edit Bloom message", {
          description: error.message,
        });
        return Promise.reject(error);
      }

      return editAndResendMutation.mutateAsync({ messageId, newText: text });
    },
    [editAndResendMutation],
  );

  const approveTaskPlan = useCallback(
    (
      conversationId: string,
      plan: BloomTaskPlan,
      approvedTaskIds: string[],
      skippedTaskIds: string[],
      editedFields: BloomEditedTaskFields,
      mode: BloomMode,
      timezone: string,
    ) =>
      approveTaskPlanMutation.mutateAsync({
        conversationId,
        plan,
        approvedTaskIds,
        skippedTaskIds,
        editedFields,
        mode,
        timezone,
      }),
    [approveTaskPlanMutation],
  );

  const retryTaskPlan = useCallback(
    (
      conversationId: string,
      plan: BloomTaskPlan,
      taskId: string,
      mode: BloomMode,
      timezone: string,
    ) =>
      approveTaskPlanMutation.mutateAsync({
        conversationId,
        plan,
        approvedTaskIds: [taskId],
        skippedTaskIds: [],
        editedFields: {},
        mode,
        timezone,
        retryTaskId: taskId,
      }),
    [approveTaskPlanMutation],
  );

  const regenerateResponse = useCallback(
    (messageId: string) => regenerateResponseMutation.mutateAsync(messageId),
    [regenerateResponseMutation],
  );

  return {
    sendMessage,
    toggleBookmark,
    submitFeedback,
    editAndResend,
    approveTaskPlan,
    retryTaskPlan,
    regenerateResponse,
    isSendingMessage: sendMessageMutation.isPending,
    isApprovingTaskPlan: approveTaskPlanMutation.isPending,
    isTogglingBookmark: toggleBookmarkMutation.isPending,
    isSubmittingFeedback: submitFeedbackMutation.isPending,
    isEditingAndResending: editAndResendMutation.isPending,
    isRegeneratingResponse: regenerateResponseMutation.isPending,
  };
}
