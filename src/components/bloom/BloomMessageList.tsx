import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Info } from "lucide-react";
import { BloomAssistantMessage } from "@/components/bloom/BloomAssistantMessage";
import { BloomContextualTip } from "@/components/bloom/BloomContextualTip";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { BloomStreamingMessage } from "@/components/bloom/BloomStreamingMessage";
import { BloomStreamingIndicator } from "@/components/bloom/BloomToolLoadingPill";
import { BloomUserMessage } from "@/components/bloom/BloomUserMessage";
import { normalizeBloomBlockItems } from "@/components/bloom/blocks/blockUtils";
import { useBloom } from "@/components/bloom/BloomContext";
import { useBloomOnboarding } from "@/hooks/bloom/useBloomOnboarding";
import type {
  BloomMessage,
  BloomOnboardingTipId,
  MessageFeedback,
} from "@/hooks/bloom/types";
import { useBloomMessageMutations } from "@/hooks/bloom/useBloomMessageMutations";

interface BloomMessageListProps {
  messages: BloomMessage[];
  isStreaming: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onTopBoundaryVisible?: () => void;
}

export interface BloomMessageListHandle {
  isVirtualized: () => boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  scrollToMessage: (messageId: string, behavior?: ScrollBehavior) => boolean;
}

type BloomMessageRow = {
  message: BloomMessage;
  index: number;
  showTip: boolean;
};

const VIRTUALIZATION_MESSAGE_THRESHOLD = 50;
const VIRTUALIZER_ESTIMATE_SIZE = 120;
const VIRTUALIZER_OVERSCAN = 5;

const chatColumnSx = {
  width: "100%",
  maxWidth: "52rem",
  mx: "auto",
  px: { xs: 2, md: 4 },
} as const;

function MessageSkeletons() {
  const reducedMotion = useBloomReducedMotion();

  return (
    <Stack spacing={2.5} sx={{ ...chatColumnSx, py: 4 }}>
      {Array.from({ length: 4 }).map((_, index) => {
        const alignRight = index % 2 === 1;

        return (
          <Stack
            key={index}
            spacing={0.75}
            alignItems={alignRight ? "flex-end" : "flex-start"}
          >
            <Skeleton
              variant="rectangular"
              animation={reducedMotion ? false : "wave"}
              sx={{
                width: alignRight ? "42%" : "58%",
                height: alignRight ? 54 : 72,
                borderRadius: alignRight
                  ? "16px 16px 4px 16px"
                  : "var(--joy-radius-lg)",
              }}
            />
            <Skeleton
              variant="text"
              animation={reducedMotion ? false : "wave"}
              sx={{ width: 72 }}
            />
          </Stack>
        );
      })}
    </Stack>
  );
}

function TypingIndicator({
  connectionState,
}: {
  connectionState: ReturnType<typeof useBloom>["connectionState"];
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <BloomStreamingIndicator connectionState={connectionState} />
    </Box>
  );
}

function BloomSystemMessage({ message }: { message: BloomMessage }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", mb: 2.5 }}>
      <Sheet
        variant="soft"
        color="neutral"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderRadius: "var(--joy-radius-lg)",
          backgroundColor: "background.level1",
        }}
      >
        <Info size={14} strokeWidth={1.9} />
        <Typography level="body-md" color="neutral" sx={{ fontSize: "16px" }}>
          {message.text}
        </Typography>
      </Sheet>
    </Box>
  );
}

const isLatestAssistantMessage = (
  messages: BloomMessage[],
  message: BloomMessage,
) => {
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((candidate) => candidate.role === "assistant");

  return lastAssistantMessage?.id === message.id;
};

const hasUserMessageAfter = (messages: BloomMessage[], messageIndex: number) =>
  messages.slice(messageIndex + 1).some((message) => message.role === "user");

const isStreamingPlaceholder = (message: BloomMessage) =>
  message.role === "assistant" && message.id.startsWith("streaming-");

const retryPromptFor = (messages: BloomMessage[], messageIndex: number) => {
  for (let index = messageIndex - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (candidate.role === "user" && candidate.text.trim()) {
      return candidate.text;
    }
  }

  return null;
};

const onboardingTipText: Record<BloomOnboardingTipId, string> = {
  slash_commands:
    "Tip: Type / in the message box for quick commands - search customers, check revenue, and more.",
  task_plans:
    "Tip: Bloom always shows you a plan before making any changes. You can review, edit, or cancel.",
  reasoning_mode:
    "Tip: Try Reasoning mode for strategic questions - Bloom will show its step-by-step thinking.",
  cmd_k_shortcut:
    "Tip: Press ⌘K from any CRM page to ask Bloom without leaving your work.",
};

const messageHasTaskPlan = (message: BloomMessage) =>
  normalizeBloomBlockItems(message.blockData).some(
    (block) => block.blockType.trim().toLowerCase() === "task_plan",
  );

const messageHasImageBlock = (message: BloomMessage) =>
  normalizeBloomBlockItems(message.blockData).some(
    (block) => block.blockType.trim().toLowerCase() === "image",
  );

const renderKeyForMessage = (message: BloomMessage) => {
  const metadataRenderKey = message.metadata.render_key;
  return typeof metadataRenderKey === "string" && metadataRenderKey.trim()
    ? metadataRenderKey
    : message.id;
};

function resolveTipAnchorMessageId(
  messages: BloomMessage[],
  pendingTip: BloomOnboardingTipId | null,
) {
  if (!pendingTip) {
    return null;
  }

  if (pendingTip === "slash_commands") {
    let assistantCount = 0;
    for (const message of messages) {
      if (message.role !== "assistant" || isStreamingPlaceholder(message)) {
        continue;
      }

      assistantCount += 1;
      if (assistantCount === 3) {
        return message.id;
      }
    }

    return null;
  }

  if (pendingTip === "task_plans") {
    return (
      messages.find(
        (message) =>
          message.role === "assistant" &&
          !isStreamingPlaceholder(message) &&
          messageHasTaskPlan(message),
      )?.id ?? null
    );
  }

  return (
    [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" && !isStreamingPlaceholder(message),
      )?.id ?? null
  );
}

interface MemoizedMessageRowProps {
  connectionState: ReturnType<typeof useBloom>["connectionState"];
  editingMessageId: string | null;
  isStreaming: boolean;
  latestStreamingPlaceholderId: string | null;
  messages: BloomMessage[];
  onBookmark: (message: BloomMessage) => void;
  onEdit: (message: BloomMessage) => void;
  onEditCancel: () => void;
  onEditSave: (message: BloomMessage, newText: string) => Promise<void>;
  onFeedback: (message: BloomMessage, feedback: MessageFeedback) => void;
  onRegenerate: (message: BloomMessage) => void;
  onTipDismiss: (tipId: BloomOnboardingTipId) => void;
  pendingTip: BloomOnboardingTipId | null;
  row: BloomMessageRow;
  tipText: string | null;
}

const MemoizedMessageRow = React.memo(function MemoizedMessageRow({
  connectionState,
  editingMessageId,
  isStreaming,
  latestStreamingPlaceholderId,
  messages,
  onBookmark,
  onEdit,
  onEditCancel,
  onEditSave,
  onFeedback,
  onRegenerate,
  onTipDismiss,
  pendingTip,
  row,
  tipText,
}: MemoizedMessageRowProps) {
  const { message, index, showTip } = row;
  const renderStreamingPlaceholder =
    connectionState === "connecting" ||
    connectionState === "streaming" ||
    connectionState === "error";
  let content: React.ReactNode;

  if (message.role === "user") {
    content = (
      <BloomUserMessage
        message={message}
        isEditing={editingMessageId === message.id}
        isStreaming={isStreaming}
        onEdit={onEdit}
        onEditCancel={onEditCancel}
        onEditSave={onEditSave}
      />
    );
  } else if (message.role === "assistant") {
    if (
      renderStreamingPlaceholder &&
      latestStreamingPlaceholderId === message.id
    ) {
      content = (
        <BloomStreamingMessage
          message={message}
          retryPrompt={retryPromptFor(messages, index)}
        />
      );
    } else {
      const isLatestAssistant = isLatestAssistantMessage(messages, message);
      content = (
        <BloomAssistantMessage
          message={message}
          isLatestAssistant={isLatestAssistant}
          showFollowUps={
            isLatestAssistant && !hasUserMessageAfter(messages, index)
          }
          isStreaming={isStreaming}
          onBookmark={onBookmark}
          onFeedback={onFeedback}
          onRegenerate={onRegenerate}
        />
      );
    }
  } else {
    content = <BloomSystemMessage message={message} />;
  }

  return (
    <Box sx={{ display: "flow-root" }}>
      {content}
      {showTip && pendingTip && tipText ? (
        <BloomContextualTip
          tipId={pendingTip}
          text={tipText}
          onDismiss={onTipDismiss}
        />
      ) : null}
    </Box>
  );
});

export const BloomMessageList = React.forwardRef<
  BloomMessageListHandle,
  BloomMessageListProps
>(function BloomMessageList(
  {
    hasNextPage,
    isFetchingNextPage,
    isStreaming,
    messages,
    onTopBoundaryVisible,
    scrollContainerRef,
  },
  ref,
) {
  const { connectionState, registerMessageListController, streamingBlocks } =
    useBloom();
  const { markTipSeen, pendingTip } = useBloomOnboarding();
  const { editAndResend, regenerateResponse, submitFeedback, toggleBookmark } =
    useBloomMessageMutations();
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(
    null,
  );
  const startBoundaryNotifiedRef = React.useRef(false);

  React.useEffect(() => {
    registerMessageListController({
      startEditingMessage: (messageId: string) => {
        setEditingMessageId(messageId);

        if (typeof document === "undefined") {
          return;
        }

        window.setTimeout(() => {
          document
            .getElementById(messageId)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 0);
      },
      stopEditingMessage: () => {
        setEditingMessageId(null);
      },
    });

    return () => {
      registerMessageListController(null);
    };
  }, [registerMessageListController]);

  const handleBookmark = React.useCallback(
    (message: BloomMessage) => {
      void toggleBookmark(message.id, message.isBookmarked).catch(
        () => undefined,
      );
    },
    [toggleBookmark],
  );

  const handleRegenerate = React.useCallback(
    (message: BloomMessage) => {
      void regenerateResponse(message.id).catch(() => undefined);
    },
    [regenerateResponse],
  );

  const handleFeedback = React.useCallback(
    (message: BloomMessage, feedback: MessageFeedback) => {
      void submitFeedback(message.id, feedback).catch(() => undefined);
    },
    [submitFeedback],
  );

  const handleStartEdit = React.useCallback((message: BloomMessage) => {
    setEditingMessageId(message.id);
  }, []);

  const handleCancelEdit = React.useCallback(() => {
    setEditingMessageId(null);
  }, []);

  const handleEditSave = React.useCallback(
    async (message: BloomMessage, newText: string) => {
      await editAndResend(message.id, newText);
      setEditingMessageId(null);
    },
    [editAndResend],
  );

  const handleTipDismiss = React.useCallback(
    (tipId: BloomOnboardingTipId) => {
      markTipSeen(tipId);
    },
    [markTipSeen],
  );

  const latestStreamingPlaceholder = React.useMemo(
    () => [...messages].reverse().find(isStreamingPlaceholder),
    [messages],
  );
  const tipAnchorMessageId = React.useMemo(
    () => resolveTipAnchorMessageId(messages, pendingTip),
    [messages, pendingTip],
  );
  const tipText = pendingTip ? onboardingTipText[pendingTip] : null;
  const hasImageMessages = React.useMemo(
    () => messages.some(messageHasImageBlock),
    [messages],
  );
  const hasActiveStreamingImageBlock = React.useMemo(
    () =>
      (connectionState === "connecting" ||
        connectionState === "streaming" ||
        connectionState === "error") &&
      streamingBlocks.some(
        (block) => block.blockType.trim().toLowerCase() === "image",
      ),
    [connectionState, streamingBlocks],
  );
  const shouldVirtualize =
    messages.length > VIRTUALIZATION_MESSAGE_THRESHOLD &&
    !hasImageMessages &&
    !hasActiveStreamingImageBlock;
  const rows = React.useMemo<BloomMessageRow[]>(
    () =>
      messages.map((message, index) => ({
        message,
        index,
        showTip: Boolean(
          pendingTip && tipText && tipAnchorMessageId === message.id,
        ),
      })),
    [messages, pendingTip, tipAnchorMessageId, tipText],
  );
  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? rows.length : 0,
    enabled: shouldVirtualize,
    getScrollElement: () =>
      shouldVirtualize ? scrollContainerRef.current : null,
    estimateSize: () => VIRTUALIZER_ESTIMATE_SIZE,
    overscan: VIRTUALIZER_OVERSCAN,
  });
  const virtualItems = shouldVirtualize ? virtualizer.getVirtualItems() : [];
  const firstVirtualIndex = virtualItems[0]?.index ?? null;

  React.useEffect(() => {
    if (!shouldVirtualize || firstVirtualIndex === null) {
      startBoundaryNotifiedRef.current = false;
      return;
    }

    if (firstVirtualIndex > VIRTUALIZER_OVERSCAN) {
      startBoundaryNotifiedRef.current = false;
      return;
    }

    if (startBoundaryNotifiedRef.current) {
      return;
    }

    startBoundaryNotifiedRef.current = true;
    onTopBoundaryVisible?.();
  }, [firstVirtualIndex, onTopBoundaryVisible, shouldVirtualize]);

  React.useImperativeHandle(
    ref,
    () => ({
      isVirtualized: () => shouldVirtualize,
      scrollToBottom: (behavior = "smooth") => {
        const container = scrollContainerRef.current;
        if (!container || rows.length === 0) {
          return;
        }

        if (shouldVirtualize) {
          virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
          if (behavior !== "auto") {
            requestAnimationFrame(() => {
              container.scrollTo({ top: container.scrollHeight, behavior });
            });
          }
          return;
        }

        container.scrollTo({ top: container.scrollHeight, behavior });
      },
      scrollToMessage: (messageId: string, behavior = "smooth") => {
        const container = scrollContainerRef.current;
        if (!container) {
          return false;
        }

        const targetIndex = rows.findIndex(
          ({ message }) => message.id === messageId,
        );
        if (targetIndex < 0) {
          return false;
        }

        if (shouldVirtualize) {
          virtualizer.scrollToIndex(targetIndex, { align: "center" });
          return true;
        }

        const target = document.getElementById(messageId);
        if (!target || !container.contains(target)) {
          return false;
        }

        target.scrollIntoView({ block: "center", behavior });
        return true;
      },
    }),
    [rows, scrollContainerRef, shouldVirtualize, virtualizer],
  );

  if (messages.length === 0 && !isStreaming) {
    return null;
  }

  const renderRow = (row: BloomMessageRow) => (
    <MemoizedMessageRow
      connectionState={connectionState}
      editingMessageId={editingMessageId}
      isStreaming={isStreaming}
      latestStreamingPlaceholderId={latestStreamingPlaceholder?.id ?? null}
      messages={messages}
      onBookmark={handleBookmark}
      onEdit={handleStartEdit}
      onEditCancel={handleCancelEdit}
      onEditSave={handleEditSave}
      onFeedback={handleFeedback}
      onRegenerate={handleRegenerate}
      onTipDismiss={handleTipDismiss}
      pendingTip={pendingTip}
      row={row}
      tipText={tipText}
    />
  );

  return (
    <Stack spacing={0} sx={{ ...chatColumnSx, py: { xs: 3, md: 4 } }}>
      {isFetchingNextPage ? (
        <Stack direction="row" justifyContent="center" sx={{ py: 1.5 }}>
          <CircularProgress size="sm" thickness={2.5} />
        </Stack>
      ) : hasNextPage ? (
        <Typography
          level="body-xs"
          color="neutral"
          sx={{ textAlign: "center", pb: 1.5 }}
        >
          Scroll up for older messages
        </Typography>
      ) : null}

      {shouldVirtualize ? (
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: virtualizer.getTotalSize(),
          }}
        >
          {virtualItems.map((virtualItem) => {
            const row = rows[virtualItem.index];
            if (!row) {
              return null;
            }

            return (
              <Box
                key={renderKeyForMessage(row.message)}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {renderRow(row)}
              </Box>
            );
          })}
        </Box>
      ) : (
        rows.map((row) => (
          <React.Fragment key={renderKeyForMessage(row.message)}>
            {renderRow(row)}
          </React.Fragment>
        ))
      )}

      {(connectionState === "connecting" || connectionState === "streaming") &&
      !latestStreamingPlaceholder ? (
        <TypingIndicator connectionState={connectionState} />
      ) : null}
    </Stack>
  );
});

export { MessageSkeletons as BloomMessageSkeletons };
