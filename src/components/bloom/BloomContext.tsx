import * as React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  isBloomMode,
  type BloomConversation,
  type BloomDefaultModePreference,
  type BloomEntitySummary,
  type BloomJsonArray,
  type BloomMessage,
  type BloomPageContext,
  type BloomModelPreference,
  type BloomMode,
} from "@/hooks/bloom/types";
import { resolvePageContext } from "@/components/bloom/utils/resolvePageContext";
import { useBloomEntitySummary } from "@/hooks/bloom/useBloomEntitySummary";
import { useBloomConversations } from "@/hooks/bloom/useBloomConversations";
import { useBloomMessages } from "@/hooks/bloom/useBloomMessages";
import { useBloomConversationMutations } from "@/hooks/bloom/useBloomConversationMutations";
import { useBloomMessageMutations } from "@/hooks/bloom/useBloomMessageMutations";
import { useBloomModelPreference } from "@/hooks/bloom/useBloomModelPreference";
import { useBloomProfile } from "@/hooks/bloom/useBloomProfile";
import {
  useBloomStreaming,
  type BloomActiveToolCall,
  type BloomResearchPlan,
  type BloomResearchStepStatus,
  type BloomStreamingBlock,
  type BloomStreamingConnectionState,
} from "@/hooks/bloom/useBloomStreaming";
import type {
  BloomEditedTaskFields,
  BloomTaskCompletionSummary,
  BloomTaskPlan,
  BloomTaskPlanStatus,
  BloomTaskStatusUpdate,
} from "@/hooks/bloom/taskPlanTypes";
import { useTenant } from "@/hooks/useTenant";

export type BloomComposerSelectionBehavior = "end" | "select-all" | "start";

interface BloomComposerController {
  focus: (selection?: BloomComposerSelectionBehavior) => void;
  getValue: () => string;
  isFocused: () => boolean;
  isSlashMenuOpen: () => boolean;
  setSlashMenuOpen: (open: boolean) => void;
  setValue: (
    value: string,
    options?: {
      focus?: boolean;
      selection?: BloomComposerSelectionBehavior;
    },
  ) => void;
}

interface BloomMessageListController {
  startEditingMessage: (messageId: string) => void;
  stopEditingMessage: () => void;
}

interface BloomContextType {
  activeConversationId: string | null;
  composerDraft: string;
  setComposerDraft: React.Dispatch<React.SetStateAction<string>>;
  conversations: BloomConversation[];
  conversationsLoading: boolean;
  conversationsError: Error | null;
  messages: BloomMessage[];
  messagesLoading: boolean;
  messagesError: Error | null;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isStreaming: boolean;
  cancelStream: () => void;
  streamingContent: string;
  streamingThinking: string;
  activeToolCall: BloomActiveToolCall | null;
  streamError: string | null;
  connectionState: BloomStreamingConnectionState;
  streamingBlocks: BloomStreamingBlock[];
  researchPlan: BloomResearchPlan;
  researchSteps: Map<number, BloomResearchStepStatus>;
  researchConversationId: string | null;
  isResearchSynthesizing: boolean;
  isResearchComplete: boolean;
  activeMode: BloomMode;
  setActiveMode: (mode: BloomMode) => void;
  imageModePulseKey: number;
  modelPreference: BloomModelPreference;
  setModelPreference: (preference: BloomModelPreference) => void;
  sendMessage: (text: string, attachments?: BloomJsonArray) => Promise<void>;
  createConversation: () => Promise<string>;
  switchConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => Promise<unknown>;
  pinConversation: (id: string) => Promise<unknown>;
  unpinConversation: (id: string) => Promise<unknown>;
  archiveConversation: (id: string) => Promise<unknown>;
  unarchiveConversation: (id: string) => Promise<unknown>;
  deleteConversation: (id: string) => Promise<unknown>;
  toggleBookmark: (
    messageId: string,
    currentState: boolean,
  ) => Promise<unknown>;
  activePlan: BloomTaskPlan | null;
  pendingTaskPlan: BloomTaskPlan | null;
  approveTaskPlan: (
    plan: BloomTaskPlan,
    approvedTaskIds: string[],
    editedFields: BloomEditedTaskFields,
  ) => Promise<void>;
  cancelTaskPlan: (planId: string) => void;
  retryTaskPlan: (plan: BloomTaskPlan, taskId: string) => Promise<void>;
  getTaskStatuses: (
    planId: string,
  ) => Map<
    string,
    { status: BloomTaskPlanStatus; errorMessage: string | null }
  >;
  getTaskCompletionSummary: (
    planId: string,
  ) => BloomTaskCompletionSummary | null;
  isTaskPlanExecuting: (planId: string) => boolean;
  getComposerValue: () => string;
  isComposerFocused: () => boolean;
  isSlashMenuOpen: () => boolean;
  focusComposer: (selection?: BloomComposerSelectionBehavior) => void;
  setComposerValue: (
    value: string,
    options?: {
      focus?: boolean;
      selection?: BloomComposerSelectionBehavior;
    },
  ) => void;
  setSlashMenuOpen: (open: boolean) => void;
  registerComposerController: (
    controller: BloomComposerController | null,
  ) => void;
  registerMessageListController: (
    controller: BloomMessageListController | null,
  ) => void;
  startEditingMessage: (messageId: string) => void;
  stopEditingMessage: () => void;
  shortcutsPanelOpen: boolean;
  openShortcutsPanel: () => void;
  closeShortcutsPanel: () => void;
  pageContext: BloomPageContext | null;
  entitySummary: BloomEntitySummary | null;
  entitySummaryLoading: boolean;
  conversationStartCount: number;
}

const BloomContext = React.createContext<BloomContextType | undefined>(
  undefined,
);

const getTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const BLOOM_RESERVED_ROUTE_SEGMENTS = new Set([
  "admin",
  "knowledge",
  "settings",
]);

const resolveBloomRouteConversationId = (pathname: string) => {
  const [, bloomSegment, childSegment] = pathname.split("/");
  if (
    bloomSegment !== "bloom" ||
    !childSegment ||
    BLOOM_RESERVED_ROUTE_SEGMENTS.has(childSegment)
  ) {
    return null;
  }

  return childSegment;
};

export const useBloom = () => {
  const context = React.useContext(BloomContext);
  if (context === undefined) {
    throw new Error("useBloom must be used within a BloomProvider");
  }
  return context;
};

export const BloomProvider = ({ children }: { children?: React.ReactNode }) => {
  const { chatId } = useParams<{ chatId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const routeConversationId =
    chatId ?? resolveBloomRouteConversationId(location.pathname);
  const [lastActiveConversationId, setLastActiveConversationId] =
    React.useState<string | null>(() => routeConversationId);
  const activeConversationId = routeConversationId ?? lastActiveConversationId;
  const [activeMode, setActiveModeState] =
    React.useState<BloomMode>("standard");
  const [composerDraft, setComposerDraft] = React.useState("");
  const [imageModePulseKey, setImageModePulseKey] = React.useState(0);
  const [activePlan, setActivePlan] = React.useState<BloomTaskPlan | null>(
    null,
  );
  const [executingPlanIds, setExecutingPlanIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [taskStatusesByPlan, setTaskStatusesByPlan] = React.useState<
    Record<
      string,
      Record<
        string,
        { status: BloomTaskPlanStatus; errorMessage: string | null }
      >
    >
  >({});
  const [completionSummaries, setCompletionSummaries] = React.useState<
    Record<string, BloomTaskCompletionSummary>
  >({});
  const [conversationStartCount, setConversationStartCount] = React.useState(0);
  const [pageContext, setPageContext] = React.useState<BloomPageContext | null>(
    () => resolvePageContext(location.pathname),
  );
  const [shortcutsPanelOpen, setShortcutsPanelOpen] = React.useState(false);
  const composerControllerRef = React.useRef<BloomComposerController | null>(
    null,
  );
  const messageListControllerRef =
    React.useRef<BloomMessageListController | null>(null);
  const userSelectedModeRef = React.useRef(false);

  const conversationsQuery = useBloomConversations();
  const messagesQuery = useBloomMessages(activeConversationId);
  const conversationMutations = useBloomConversationMutations();
  const { modelPreference, setModelPreference } = useBloomModelPreference();
  const profileQuery = useBloomProfile();
  const entitySummaryQuery = useBloomEntitySummary(pageContext, tenant?.id);
  const preferredDefaultMode: BloomDefaultModePreference =
    profileQuery.data?.preferences.default_mode ?? "standard";

  const markConversationStarted = React.useCallback(() => {
    setConversationStartCount((current) => current + 1);
  }, []);

  React.useEffect(() => {
    if (routeConversationId) {
      setLastActiveConversationId(routeConversationId);
    }
  }, [routeConversationId]);

  React.useEffect(() => {
    if (activeConversationId || userSelectedModeRef.current) {
      return;
    }

    setActiveModeState(preferredDefaultMode);
  }, [activeConversationId, preferredDefaultMode]);

  React.useEffect(() => {
    setPageContext(resolvePageContext(location.pathname));
  }, [location.pathname]);

  const handleTaskPlan = React.useCallback((plan: BloomTaskPlan) => {
    setActivePlan(plan);
    setCompletionSummaries((current) => {
      const next = { ...current };
      delete next[plan.planId];
      return next;
    });
    setTaskStatusesByPlan((current) => ({
      ...current,
      [plan.planId]: current[plan.planId] ?? {},
    }));
  }, []);

  const handleTaskProgress = React.useCallback(
    (progress: BloomTaskStatusUpdate) => {
      setTaskStatusesByPlan((current) => ({
        ...current,
        [progress.planId]: {
          ...(current[progress.planId] ?? {}),
          [progress.taskId]: {
            status: progress.status,
            errorMessage: progress.errorMessage,
          },
        },
      }));
    },
    [],
  );

  const handleTaskComplete = React.useCallback(
    (summary: BloomTaskCompletionSummary) => {
      setCompletionSummaries((current) => ({
        ...current,
        [summary.planId]: summary,
      }));
      setExecutingPlanIds((current) => {
        const next = new Set(current);
        next.delete(summary.planId);
        return next;
      });
    },
    [],
  );

  const handleModeOverride = React.useCallback((mode: BloomMode) => {
    if (mode !== "image") {
      return;
    }

    setActiveModeState("image");
    setImageModePulseKey((current) => current + 1);
    toast("Switched to Image mode", {
      duration: 2000,
      id: "bloom-image-mode-override",
    });
  }, []);

  const bloomMessageMutationHandlers = React.useMemo(
    () => ({
      onTaskPlan: handleTaskPlan,
      onTaskProgress: handleTaskProgress,
      onTaskComplete: handleTaskComplete,
      onModeOverride: handleModeOverride,
    }),
    [
      handleModeOverride,
      handleTaskComplete,
      handleTaskPlan,
      handleTaskProgress,
    ],
  );

  const messageMutations = useBloomMessageMutations(
    bloomMessageMutationHandlers,
  );
  const {
    activeToolCall,
    cancelStream,
    connectionState,
    isResearchComplete,
    isResearchSynthesizing,
    isStreaming,
    pendingTaskPlan,
    researchConversationId,
    researchPlan,
    researchSteps,
    startStream,
    streamError,
    streamingBlocks,
    streamingContent,
    streamingThinking,
  } = useBloomStreaming(bloomMessageMutationHandlers);

  const setActiveMode = React.useCallback((mode: BloomMode) => {
    if (isBloomMode(mode)) {
      userSelectedModeRef.current = true;
      setActiveModeState(mode);
    }
  }, []);

  const createConversation = React.useCallback(async () => {
    const conversationId =
      await conversationMutations.createConversation(preferredDefaultMode);
    markConversationStarted();
    setLastActiveConversationId(conversationId);
    userSelectedModeRef.current = false;
    setActiveModeState(preferredDefaultMode);
    navigate(`/bloom/${conversationId}`);
    return conversationId;
  }, [
    conversationMutations,
    markConversationStarted,
    navigate,
    preferredDefaultMode,
  ]);

  const switchConversation = React.useCallback(
    (id: string) => {
      setLastActiveConversationId(id);
      navigate(`/bloom/${id}`);
    },
    [navigate],
  );

  const sendMessage = React.useCallback(
    async (text: string, attachments?: BloomJsonArray) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return;
      }

      const conversationId =
        activeConversationId ??
        (await conversationMutations.createConversation(activeMode));

      if (!activeConversationId) {
        markConversationStarted();
        setLastActiveConversationId(conversationId);
        navigate(`/bloom/${conversationId}`);
      }

      startStream(
        conversationId,
        trimmedText,
        activeMode,
        modelPreference,
        pageContext,
        getTimezone(),
        attachments,
      );
    },
    [
      activeConversationId,
      activeMode,
      conversationMutations,
      markConversationStarted,
      modelPreference,
      navigate,
      pageContext,
      startStream,
    ],
  );

  const approveTaskPlan = React.useCallback(
    async (
      plan: BloomTaskPlan,
      approvedTaskIds: string[],
      editedFields: BloomEditedTaskFields,
    ) => {
      if (!activeConversationId) {
        return;
      }

      const approved = new Set(approvedTaskIds);
      const skippedTaskIds = plan.tasks
        .filter((task) => !approved.has(task.taskId))
        .map((task) => task.taskId);

      setExecutingPlanIds((current) => new Set(current).add(plan.planId));
      setCompletionSummaries((current) => {
        const next = { ...current };
        delete next[plan.planId];
        return next;
      });
      setTaskStatusesByPlan((current) => ({
        ...current,
        [plan.planId]: plan.tasks.reduce<
          Record<
            string,
            { status: BloomTaskPlanStatus; errorMessage: string | null }
          >
        >((next, task) => {
          next[task.taskId] = {
            status: approved.has(task.taskId) ? "pending" : "skipped",
            errorMessage: null,
          };
          return next;
        }, {}),
      }));

      try {
        await messageMutations.approveTaskPlan(
          activeConversationId,
          plan,
          approvedTaskIds,
          skippedTaskIds,
          editedFields,
          activeMode,
          getTimezone(),
        );
      } finally {
        setExecutingPlanIds((current) => {
          const next = new Set(current);
          next.delete(plan.planId);
          return next;
        });
      }
    },
    [activeConversationId, activeMode, messageMutations.approveTaskPlan],
  );

  const retryTaskPlan = React.useCallback(
    async (plan: BloomTaskPlan, taskId: string) => {
      if (!activeConversationId) {
        return;
      }

      setExecutingPlanIds((current) => new Set(current).add(plan.planId));
      setTaskStatusesByPlan((current) => ({
        ...current,
        [plan.planId]: {
          ...(current[plan.planId] ?? {}),
          [taskId]: { status: "pending", errorMessage: null },
        },
      }));

      try {
        await messageMutations.retryTaskPlan(
          activeConversationId,
          plan,
          taskId,
          activeMode,
          getTimezone(),
        );
      } finally {
        setExecutingPlanIds((current) => {
          const next = new Set(current);
          next.delete(plan.planId);
          return next;
        });
      }
    },
    [activeConversationId, activeMode, messageMutations.retryTaskPlan],
  );

  const cancelTaskPlan = React.useCallback((planId: string) => {
    setExecutingPlanIds((current) => {
      const next = new Set(current);
      next.delete(planId);
      return next;
    });
  }, []);

  const getTaskStatuses = React.useCallback(
    (planId: string) => {
      const statuses = taskStatusesByPlan[planId] ?? {};
      return new Map(Object.entries(statuses));
    },
    [taskStatusesByPlan],
  );

  const getTaskCompletionSummary = React.useCallback(
    (planId: string) => completionSummaries[planId] ?? null,
    [completionSummaries],
  );

  const isTaskPlanExecuting = React.useCallback(
    (planId: string) => executingPlanIds.has(planId),
    [executingPlanIds],
  );

  const registerComposerController = React.useCallback(
    (controller: BloomComposerController | null) => {
      composerControllerRef.current = controller;
    },
    [],
  );

  const registerMessageListController = React.useCallback(
    (controller: BloomMessageListController | null) => {
      messageListControllerRef.current = controller;
    },
    [],
  );

  const getComposerValue = React.useCallback(
    () => composerControllerRef.current?.getValue() ?? composerDraft,
    [composerDraft],
  );

  const setComposerValue = React.useCallback(
    (
      value: string,
      options?: {
        focus?: boolean;
        selection?: BloomComposerSelectionBehavior;
      },
    ) => {
      setComposerDraft(value);
      composerControllerRef.current?.setValue(value, options);
    },
    [],
  );

  const focusComposer = React.useCallback(
    (selection?: BloomComposerSelectionBehavior) => {
      composerControllerRef.current?.focus(selection);
    },
    [],
  );

  const isComposerFocused = React.useCallback(
    () => composerControllerRef.current?.isFocused() ?? false,
    [],
  );

  const isSlashMenuOpen = React.useCallback(
    () => composerControllerRef.current?.isSlashMenuOpen() ?? false,
    [],
  );

  const setSlashMenuOpen = React.useCallback((open: boolean) => {
    composerControllerRef.current?.setSlashMenuOpen(open);
  }, []);

  const startEditingMessage = React.useCallback((messageId: string) => {
    messageListControllerRef.current?.startEditingMessage(messageId);
  }, []);

  const stopEditingMessage = React.useCallback(() => {
    messageListControllerRef.current?.stopEditingMessage();
  }, []);

  const openShortcutsPanel = React.useCallback(() => {
    setShortcutsPanelOpen(true);
  }, []);

  const closeShortcutsPanel = React.useCallback(() => {
    setShortcutsPanelOpen(false);
  }, []);

  const value = React.useMemo(
    () => ({
      activeConversationId,
      composerDraft,
      setComposerDraft,
      conversations: conversationsQuery.data ?? [],
      conversationsLoading: conversationsQuery.isLoading,
      conversationsError: conversationsQuery.error,
      messages: messagesQuery.data,
      messagesLoading: messagesQuery.isLoading,
      messagesError: messagesQuery.error,
      fetchNextPage: messagesQuery.fetchNextPage,
      hasNextPage: Boolean(messagesQuery.hasNextPage),
      isFetchingNextPage: messagesQuery.isFetchingNextPage,
      isStreaming,
      cancelStream,
      streamingContent,
      streamingThinking,
      activeToolCall,
      streamError,
      connectionState,
      streamingBlocks,
      researchPlan,
      researchSteps,
      researchConversationId,
      isResearchSynthesizing,
      isResearchComplete,
      activeMode,
      setActiveMode,
      imageModePulseKey,
      modelPreference,
      setModelPreference,
      sendMessage,
      createConversation,
      switchConversation,
      renameConversation: conversationMutations.renameConversation,
      pinConversation: conversationMutations.pinConversation,
      unpinConversation: conversationMutations.unpinConversation,
      archiveConversation: conversationMutations.archiveConversation,
      unarchiveConversation: conversationMutations.unarchiveConversation,
      deleteConversation: conversationMutations.deleteConversation,
      toggleBookmark: messageMutations.toggleBookmark,
      activePlan,
      pendingTaskPlan,
      approveTaskPlan,
      cancelTaskPlan,
      retryTaskPlan,
      getTaskStatuses,
      getTaskCompletionSummary,
      isTaskPlanExecuting,
      getComposerValue,
      isComposerFocused,
      isSlashMenuOpen,
      focusComposer,
      setComposerValue,
      setSlashMenuOpen,
      registerComposerController,
      registerMessageListController,
      startEditingMessage,
      stopEditingMessage,
      shortcutsPanelOpen,
      openShortcutsPanel,
      closeShortcutsPanel,
      pageContext,
      entitySummary: entitySummaryQuery.data,
      entitySummaryLoading: entitySummaryQuery.isLoading,
      conversationStartCount,
    }),
    [
      activeConversationId,
      activeMode,
      activePlan,
      activeToolCall,
      composerDraft,
      approveTaskPlan,
      cancelStream,
      connectionState,
      cancelTaskPlan,
      conversationMutations.archiveConversation,
      conversationMutations.deleteConversation,
      conversationMutations.pinConversation,
      conversationMutations.renameConversation,
      conversationMutations.unarchiveConversation,
      conversationMutations.unpinConversation,
      conversationStartCount,
      conversationsQuery.data,
      conversationsQuery.error,
      conversationsQuery.isLoading,
      createConversation,
      entitySummaryQuery.data,
      entitySummaryQuery.isLoading,
      focusComposer,
      getComposerValue,
      getTaskCompletionSummary,
      getTaskStatuses,
      imageModePulseKey,
      isComposerFocused,
      isSlashMenuOpen,
      isTaskPlanExecuting,
      isResearchComplete,
      isResearchSynthesizing,
      isStreaming,
      modelPreference,
      messageMutations.toggleBookmark,
      messagesQuery.data,
      messagesQuery.error,
      messagesQuery.fetchNextPage,
      messagesQuery.hasNextPage,
      messagesQuery.isFetchingNextPage,
      messagesQuery.isLoading,
      openShortcutsPanel,
      closeShortcutsPanel,
      pendingTaskPlan,
      researchConversationId,
      researchPlan,
      researchSteps,
      registerComposerController,
      registerMessageListController,
      sendMessage,
      setComposerValue,
      setActiveMode,
      setModelPreference,
      setSlashMenuOpen,
      pageContext,
      shortcutsPanelOpen,
      startEditingMessage,
      stopEditingMessage,
      streamError,
      streamingBlocks,
      streamingContent,
      streamingThinking,
      switchConversation,
      retryTaskPlan,
    ],
  );

  return (
    <BloomContext.Provider value={value}>{children}</BloomContext.Provider>
  );
};
