import React from "react";
import Button from "@mui/joy/Button";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ArrowDown } from "lucide-react";
import { AISessionDivider } from "../ai-session-divider";
import { AIImageStudioMessage } from "./AIImageStudioMessage";
import { AIImageStudioWelcome } from "./AIImageStudioWelcome";
import type { AIImageStudioVariationItem } from "./AIImageStudioImageResultCard";
import type { AIImageStudioMessage } from "./types";

interface AIImageStudioConversationProps {
  currentSessionId?: string | null;
  messages: AIImageStudioMessage[];
  hasMoreMessages: boolean;
  historyLoadError: boolean;
  isInitialLoad: boolean;
  isLoadingHistory: boolean;
  onMessageAction?: (
    actionId: "done" | "next-target",
    message: AIImageStudioMessage,
  ) => void;
  onLoadMoreHistory: () => void | Promise<void>;
  onPreviewImage: (
    image: NonNullable<AIImageStudioMessage["images"]>[number],
    message: AIImageStudioMessage,
  ) => void;
  onRegenerate: (prompt: string) => void;
  onRetry: (prompt: string) => void;
  onRetryHistoryLoad: () => void;
  onScroll: React.UIEventHandler<HTMLDivElement>;
  onSuggestionSelect: (suggestion: string) => void;
  onUseImage: (
    image: NonNullable<AIImageStudioMessage["images"]>[number],
    message: AIImageStudioMessage,
  ) => void | Promise<void>;
  paddingX: number;
  welcomeBlockLabel?: string;
  welcomeDescription?: string;
  welcomeSuggestions?: string[];
}

function normalizePrompt(prompt?: string | null) {
  return prompt?.trim().replace(/\s+/g, " ").toLowerCase() || null;
}

function AIImageStudioConversationSkeleton() {
  return (
    <Stack
      spacing={2}
      sx={{ animation: "aiImageStudioConversationFade 200ms ease-out both" }}
    >
      {[0, 1, 2].map((index) => (
        <Stack key={index} spacing={1.25}>
          <Stack alignItems="flex-end">
            <Box
              sx={{
                width: "60%",
                maxWidth: 320,
                height: 20,
                borderRadius: "12px 12px 4px 12px",
                background:
                  "linear-gradient(115deg, rgba(var(--joy-palette-neutral-mainChannel) / 0.08) 10%, rgba(var(--joy-palette-primary-mainChannel) / 0.08) 35%, rgba(var(--joy-palette-neutral-mainChannel) / 0.08) 60%)",
                backgroundSize: "200% 100%",
                animation: "aiImageStudioSkeletonWave 1.4s linear infinite",
              }}
            />
          </Stack>

          <Stack alignItems="flex-start" spacing={0.75}>
            <Box
              sx={{
                width: "36%",
                maxWidth: 180,
                height: 16,
                borderRadius: "999px",
                background:
                  "linear-gradient(115deg, rgba(var(--joy-palette-neutral-mainChannel) / 0.08) 10%, rgba(var(--joy-palette-primary-mainChannel) / 0.08) 35%, rgba(var(--joy-palette-neutral-mainChannel) / 0.08) 60%)",
                backgroundSize: "200% 100%",
                animation: "aiImageStudioSkeletonWave 1.4s linear infinite",
              }}
            />
            <Box
              sx={{
                width: "88%",
                maxWidth: 420,
                aspectRatio: "1 / 1",
                maxHeight: 280,
                borderRadius: "12px",
                background:
                  "linear-gradient(115deg, rgba(var(--joy-palette-neutral-mainChannel) / 0.08) 10%, rgba(var(--joy-palette-primary-mainChannel) / 0.08) 35%, rgba(var(--joy-palette-neutral-mainChannel) / 0.08) 60%)",
                backgroundSize: "200% 100%",
                animation: "aiImageStudioSkeletonWave 1.4s linear infinite",
              }}
            />
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

function formatDateGroupLabel(timestamp: Date) {
  if (isToday(timestamp)) {
    return "Today";
  }

  if (isYesterday(timestamp)) {
    return "Yesterday";
  }

  return format(timestamp, "EEEE, MMMM d");
}

function AIImageStudioDateHeader({ timestamp }: { timestamp: Date }) {
  return (
    <Stack alignItems="center" sx={{ py: 0.75 }}>
      <Typography
        level="body-xs"
        textColor="text.tertiary"
        sx={{
          px: 1.25,
          py: 0.5,
          borderRadius: "999px",
          backgroundColor: "background.level1",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        {formatDateGroupLabel(timestamp)}
      </Typography>
    </Stack>
  );
}

const scrollbarSx = {
  scrollbarWidth: "thin",
  scrollbarColor: "var(--joy-palette-neutral-outlinedBorder) transparent",
  "&::-webkit-scrollbar": {
    width: "5px",
  },
  "&::-webkit-scrollbar-track": {
    backgroundColor: "transparent",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.4)",
    borderRadius: "10px",
  },
  "&:hover::-webkit-scrollbar-thumb": {
    backgroundColor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.7)",
  },
} as const;

const LOAD_MORE_TOP_THRESHOLD_PX = 60;
const NEAR_BOTTOM_THRESHOLD_PX = 100;
const SCROLL_THROTTLE_MS = 200;

function getLatestMessageToken(messages: AIImageStudioMessage[]) {
  const message = messages[messages.length - 1];

  if (!message) {
    return null;
  }

  return [
    message.id,
    message.type,
    message.content,
    message.images?.length || 0,
    message.statusMessages?.join("|") || "",
    message.actions?.length || 0,
  ].join(":");
}

export function AIImageStudioConversation({
  currentSessionId,
  messages,
  hasMoreMessages,
  historyLoadError,
  isInitialLoad,
  isLoadingHistory,
  onMessageAction,
  onLoadMoreHistory,
  onPreviewImage,
  onRegenerate,
  onRetry,
  onRetryHistoryLoad,
  onScroll,
  onSuggestionSelect,
  onUseImage,
  paddingX,
  welcomeBlockLabel,
  welcomeDescription,
  welcomeSuggestions,
}: AIImageStudioConversationProps) {
  const conversationRef = React.useRef<HTMLDivElement | null>(null);
  const messageRefs = React.useRef(new Map<string, HTMLDivElement>());
  const highlightTimeoutRef = React.useRef<number | null>(null);
  const latestMessageTokenRef = React.useRef<string | null>(null);
  const initialScrollCompleteRef = React.useRef(false);
  const lastTopLoadCheckRef = React.useRef(0);
  const isLoadMoreRequestPendingRef = React.useRef(false);
  const prependScrollSnapshotRef = React.useRef<{
    firstMessageId: string | null;
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const nearBottomRef = React.useRef(true);
  const [highlightedMessageId, setHighlightedMessageId] = React.useState<
    string | null
  >(null);
  const [showNewMessageReady, setShowNewMessageReady] = React.useState(false);
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const shouldUseContentVisibility = messages.length > 30;
  const hasEarlierGenerations = React.useMemo(
    () =>
      !!currentSessionId &&
      messages.some(
        (message) =>
          message.type !== "session_divider" &&
          !!message.sessionId &&
          message.sessionId !== currentSessionId,
      ),
    [currentSessionId, messages],
  );

  React.useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const scrollToBottom = React.useCallback(
    (instant = false) => {
      const container = conversationRef.current;

      if (!container) {
        return;
      }

      if (instant) {
        container.scrollTop = container.scrollHeight;
        return;
      }

      container.scrollTo({
        top: container.scrollHeight,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    },
    [prefersReducedMotion],
  );

  const variationGroupsByKey = React.useMemo(() => {
    const groups = new Map<string, AIImageStudioVariationItem[]>();

    for (const message of messages) {
      if (message.type !== "images") {
        continue;
      }

      const primaryImage = message.images?.[0];
      const prompt =
        message.userPrompt || message.prompt || primaryImage?.userPrompt;
      const normalizedPrompt = normalizePrompt(prompt);

      if (!message.sessionId || !normalizedPrompt || !primaryImage) {
        continue;
      }

      const groupKey = `${message.sessionId}:${normalizedPrompt}`;
      const group = groups.get(groupKey) || [];
      group.push({
        imageUrl: primaryImage.imageUrl,
        messageId: message.id,
        prompt,
      });
      groups.set(groupKey, group);
    }

    return groups;
  }, [messages]);

  const latestVariationMessageIdByKey = React.useMemo(() => {
    const latestIds = new Map<string, string>();

    for (const message of messages) {
      if (message.type !== "images") {
        continue;
      }

      const normalizedPrompt = normalizePrompt(
        message.userPrompt || message.prompt,
      );
      if (!message.sessionId || !normalizedPrompt) {
        continue;
      }

      latestIds.set(`${message.sessionId}:${normalizedPrompt}`, message.id);
    }

    return latestIds;
  }, [messages]);

  React.useLayoutEffect(() => {
    const snapshot = prependScrollSnapshotRef.current;
    const container = conversationRef.current;

    if (!snapshot || !container) {
      return;
    }

    const firstMessageId = messages[0]?.id || null;

    if (firstMessageId && firstMessageId !== snapshot.firstMessageId) {
      const addedHeight = container.scrollHeight - snapshot.scrollHeight;
      container.scrollTop = snapshot.scrollTop + addedHeight;
      prependScrollSnapshotRef.current = null;
      return;
    }

    if (!isLoadingHistory) {
      prependScrollSnapshotRef.current = null;
    }
  }, [isLoadingHistory, messages]);

  React.useLayoutEffect(() => {
    if (isInitialLoad) {
      initialScrollCompleteRef.current = false;
      latestMessageTokenRef.current = null;
      setShowNewMessageReady(false);
      return;
    }

    if (messages.length === 0) {
      initialScrollCompleteRef.current = true;
      latestMessageTokenRef.current = null;
      setShowNewMessageReady(false);
      return;
    }

    if (initialScrollCompleteRef.current) {
      return;
    }

    scrollToBottom(true);
    initialScrollCompleteRef.current = true;
    latestMessageTokenRef.current = getLatestMessageToken(messages);
    nearBottomRef.current = true;
    setShowNewMessageReady(false);
  }, [isInitialLoad, messages, scrollToBottom]);

  React.useEffect(() => {
    if (isInitialLoad || !initialScrollCompleteRef.current) {
      return;
    }

    const latestMessageToken = getLatestMessageToken(messages);

    if (!latestMessageToken) {
      latestMessageTokenRef.current = null;
      return;
    }

    if (latestMessageToken === latestMessageTokenRef.current) {
      return;
    }

    latestMessageTokenRef.current = latestMessageToken;

    if (nearBottomRef.current) {
      window.requestAnimationFrame(() => {
        scrollToBottom(false);
      });
      setShowNewMessageReady(false);
      return;
    }

    setShowNewMessageReady(true);
  }, [isInitialLoad, messages, scrollToBottom]);

  const handleVariationSelect = React.useCallback(
    (messageId: string) => {
      const node = messageRefs.current.get(messageId);

      if (!node) {
        return;
      }

      node.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
      setHighlightedMessageId(messageId);

      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }

      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedMessageId(null);
        highlightTimeoutRef.current = null;
      }, 300);
    },
    [prefersReducedMotion],
  );

  const handleScroll = React.useCallback<React.UIEventHandler<HTMLDivElement>>(
    (event) => {
      const container = event.currentTarget;
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const isAtBottom = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX;

      nearBottomRef.current = isAtBottom;

      if (isAtBottom && showNewMessageReady) {
        setShowNewMessageReady(false);
      }

      const now = window.performance.now();
      const shouldCheckTop =
        now - lastTopLoadCheckRef.current >= SCROLL_THROTTLE_MS;

      if (
        shouldCheckTop &&
        container.scrollTop <= LOAD_MORE_TOP_THRESHOLD_PX &&
        hasMoreMessages &&
        !isInitialLoad &&
        !isLoadingHistory &&
        !isLoadMoreRequestPendingRef.current &&
        messages.length > 0
      ) {
        lastTopLoadCheckRef.current = now;
        isLoadMoreRequestPendingRef.current = true;
        prependScrollSnapshotRef.current = {
          firstMessageId: messages[0]?.id || null,
          scrollHeight: container.scrollHeight,
          scrollTop: container.scrollTop,
        };

        void Promise.resolve(onLoadMoreHistory())
          .catch(() => {
            prependScrollSnapshotRef.current = null;
          })
          .finally(() => {
            isLoadMoreRequestPendingRef.current = false;
          });
      }

      onScroll(event);
    },
    [
      hasMoreMessages,
      isInitialLoad,
      isLoadingHistory,
      messages,
      onLoadMoreHistory,
      onScroll,
      showNewMessageReady,
    ],
  );

  const scrollToLatest = React.useCallback(() => {
    nearBottomRef.current = true;
    setShowNewMessageReady(false);
    scrollToBottom(false);
  }, [scrollToBottom]);

  const renderItems = React.useMemo(() => {
    const items: Array<
      | { key: string; kind: "session"; message: AIImageStudioMessage }
      | { key: string; kind: "message"; message: AIImageStudioMessage }
      | { key: string; kind: "ai-group"; messages: AIImageStudioMessage[] }
    > = [];

    let index = 0;

    while (index < messages.length) {
      const message = messages[index];

      if (message.type === "session_divider") {
        items.push({ key: message.id, kind: "session", message });
        index += 1;
        continue;
      }

      if (message.type === "user") {
        items.push({ key: message.id, kind: "message", message });
        index += 1;
        continue;
      }

      const groupedMessages: AIImageStudioMessage[] = [];

      while (index < messages.length) {
        const candidate = messages[index];

        if (candidate.type === "session_divider" || candidate.type === "user") {
          break;
        }

        groupedMessages.push(candidate);
        index += 1;
      }

      if (groupedMessages.length > 0) {
        items.push({
          key: groupedMessages.map((entry) => entry.id).join(":"),
          kind: "ai-group",
          messages: groupedMessages,
        });
      }
    }

    return items;
  }, [messages]);

  return (
    <Box
      component="section"
      data-ai-image-studio-scroll-container="true"
      onScroll={handleScroll}
      ref={conversationRef}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overscrollBehaviorY: "contain",
        scrollBehavior: "auto",
        position: "relative",
        bgcolor: "background.body",
        px: paddingX,
        py: 2.5,
        WebkitOverflowScrolling: "touch",
        "@keyframes aiImageStudioConversationFade": {
          from: {
            opacity: 0,
          },
          to: {
            opacity: 1,
          },
        },
        "@keyframes aiImageStudioSkeletonWave": {
          from: {
            backgroundPosition: "200% 0",
          },
          to: {
            backgroundPosition: "-200% 0",
          },
        },
        ...scrollbarSx,
      }}
    >
      {isLoadingHistory ? (
        <Stack alignItems="center" justifyContent="center" sx={{ my: "12px" }}>
          <CircularProgress color="neutral" size="sm" variant="soft" />
        </Stack>
      ) : null}

      {!isInitialLoad && hasEarlierGenerations ? (
        <Typography
          level="body-xs"
          textAlign="center"
          textColor="text.tertiary"
          sx={{ pb: 1.5, letterSpacing: "0.06em", textTransform: "uppercase" }}
        >
          Earlier generations
        </Typography>
      ) : null}

      {!hasMoreMessages && messages.length > 0 && !isInitialLoad ? (
        <Typography
          level="body-xs"
          textAlign="center"
          textColor="text.tertiary"
          sx={{ my: "16px", opacity: 0.5 }}
        >
          Beginning of conversation
        </Typography>
      ) : null}

      {isInitialLoad ? <AIImageStudioConversationSkeleton /> : null}

      {!isInitialLoad && historyLoadError && messages.length === 0 ? (
        <Stack
          spacing={1.25}
          sx={{
            maxWidth: 320,
            borderRadius: "12px 12px 12px 4px",
            backgroundColor: "danger.softBg",
            boxShadow: "sm",
            px: 1.75,
            py: 1.5,
          }}
        >
          <Typography level="body-sm" sx={{ color: "danger.700" }}>
            Couldn’t load your previous generations.
          </Typography>
          <Button
            color="primary"
            onClick={onRetryHistoryLoad}
            size="sm"
            sx={{ alignSelf: "flex-start" }}
            variant="outlined"
          >
            Retry
          </Button>
        </Stack>
      ) : null}

      {!isInitialLoad && messages.length === 0 && !historyLoadError ? (
        <AIImageStudioWelcome
          blockLabel={welcomeBlockLabel}
          description={welcomeDescription}
          onSuggestionSelect={onSuggestionSelect}
          suggestions={welcomeSuggestions}
        />
      ) : null}

      {!isInitialLoad && messages.length > 0 ? (
        <Stack
          spacing={1.5}
          sx={{
            animation: "aiImageStudioConversationFade 200ms ease-out both",
          }}
        >
          {renderItems.map((item, itemIndex) => {
            if (item.kind === "session" && item.message.sessionInfo) {
              return (
                <AISessionDivider
                  key={item.message.id}
                  channel={item.message.sessionInfo.channel}
                  contextType={item.message.sessionInfo.contextType}
                  createdAt={item.message.sessionInfo.createdAt}
                  sessionTitle={item.message.sessionInfo.title}
                />
              );
            }

            const firstMessage =
              item.kind === "ai-group" ? item.messages[0] : item.message;
            const lastMessage =
              item.kind === "ai-group"
                ? item.messages[item.messages.length - 1]
                : item.message;

            const previousRenderableItem = [...renderItems]
              .slice(0, itemIndex)
              .reverse()
              .find((entry) => entry.kind !== "session");

            const previousMeaningfulMessage = previousRenderableItem
              ? previousRenderableItem.kind === "ai-group"
                ? previousRenderableItem.messages[
                    previousRenderableItem.messages.length - 1
                  ]
                : previousRenderableItem.message
              : null;

            const shouldShowDateHeader =
              !previousMeaningfulMessage ||
              format(firstMessage.timestamp, "yyyy-MM-dd") !==
                format(previousMeaningfulMessage.timestamp, "yyyy-MM-dd");
            const isHistorical =
              !!currentSessionId &&
              (item.kind === "ai-group" ? item.messages : [item.message]).some(
                (entry) =>
                  !!entry.sessionId && entry.sessionId !== currentSessionId,
              );

            return (
              <Box
                key={item.key}
                ref={(node: HTMLDivElement | null) => {
                  const messageIds =
                    item.kind === "ai-group"
                      ? item.messages.map((entry) => entry.id)
                      : [item.message.id];

                  messageIds.forEach((messageId) => {
                    if (node) {
                      messageRefs.current.set(messageId, node);
                    } else {
                      messageRefs.current.delete(messageId);
                    }
                  });
                }}
                sx={
                  shouldUseContentVisibility
                    ? {
                        contentVisibility: "auto",
                        containIntrinsicSize: "320px",
                        contain: "layout paint style",
                      }
                    : undefined
                }
              >
                {shouldShowDateHeader ? (
                  <AIImageStudioDateHeader timestamp={firstMessage.timestamp} />
                ) : null}

                {item.kind === "message" ? (
                  <AIImageStudioMessage
                    isHighlighted={highlightedMessageId === item.message.id}
                    isHistorical={isHistorical}
                    message={item.message}
                    onActionClick={onMessageAction}
                    onPreviewImage={onPreviewImage}
                    onRegenerate={onRegenerate}
                    onRetry={onRetry}
                    onUseImage={onUseImage}
                    onVariationSelect={handleVariationSelect}
                  />
                ) : null}

                {item.kind === "ai-group" ? (
                  <Stack
                    spacing={0.5}
                    sx={{
                      alignItems: "flex-start",
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: "90%",
                        px: "16px",
                        py: "12px",
                        borderRadius: "16px 16px 16px 4px",
                        backgroundColor: "background.level1",
                        border: "1px solid",
                        borderColor: "var(--joy-palette-neutral-100, #F0F0F0)",
                        boxShadow: isHistorical ? "none" : "sm",
                        opacity: isHistorical ? 0.9 : 1,
                      }}
                    >
                      <Stack spacing={1.25}>
                        {item.messages.map((groupMessage) => {
                          const variationKey =
                            groupMessage.type === "images"
                              ? groupMessage.sessionId &&
                                normalizePrompt(
                                  groupMessage.userPrompt ||
                                    groupMessage.prompt,
                                )
                                ? `${groupMessage.sessionId}:${normalizePrompt(groupMessage.userPrompt || groupMessage.prompt)}`
                                : null
                              : null;
                          const variationGroup = variationKey
                            ? variationGroupsByKey.get(variationKey)
                            : undefined;
                          const showVariationStrip =
                            !!variationKey &&
                            latestVariationMessageIdByKey.get(variationKey) ===
                              groupMessage.id &&
                            (variationGroup?.length || 0) > 1;

                          return (
                            <AIImageStudioMessage
                              key={groupMessage.id}
                              hideTimestamp
                              isHighlighted={
                                highlightedMessageId === groupMessage.id
                              }
                              isHistorical={isHistorical}
                              message={groupMessage}
                              onActionClick={onMessageAction}
                              onPreviewImage={onPreviewImage}
                              onRegenerate={onRegenerate}
                              onRetry={onRetry}
                              onUseImage={onUseImage}
                              onVariationSelect={handleVariationSelect}
                              renderInline
                              showVariationStrip={showVariationStrip}
                              variationGroup={variationGroup}
                            />
                          );
                        })}
                      </Stack>
                    </Box>

                    <Typography
                      level="body-xs"
                      textColor="text.tertiary"
                      sx={{ px: 0.5, opacity: 0.6, textAlign: "left" }}
                    >
                      {formatDistanceToNow(lastMessage.timestamp, {
                        addSuffix: true,
                      }).replace(/^about\s+/, "")}
                    </Typography>
                  </Stack>
                ) : null}
              </Box>
            );
          })}
        </Stack>
      ) : null}

      {showNewMessageReady ? (
        <Box
          sx={{
            position: "sticky",
            bottom: "8px",
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            mt: 1.5,
            zIndex: 1,
            transition: prefersReducedMotion ? "none" : "opacity 180ms ease",
          }}
        >
          <Chip
            color="primary"
            endDecorator={<ArrowDown size={14} strokeWidth={2.2} />}
            onClick={scrollToLatest}
            size="sm"
            sx={{
              alignSelf: "center",
              cursor: "pointer",
              pointerEvents: "auto",
              boxShadow: "md",
            }}
            variant="soft"
          >
            New message
          </Chip>
        </Box>
      ) : null}
    </Box>
  );
}
