import React from "react";
import Button from "@mui/joy/Button";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { format, isToday, isYesterday } from "date-fns";
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
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onLoadMoreHistory: () => void;
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

function AIImageStudioTimestampSeparator({ timestamp }: { timestamp: Date }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
      <Box sx={{ flex: 1, height: 1, backgroundColor: "divider" }} />
      <Box
        sx={{
          px: 1,
          py: 0.375,
          borderRadius: "999px",
          backgroundColor: "background.level1",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography level="body-xs" textColor="text.tertiary">
          {format(timestamp, "h:mm a")}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, height: 1, backgroundColor: "divider" }} />
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
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.75 }}>
      <Box sx={{ flex: 1, height: 1, backgroundColor: "divider" }} />
      <Typography level="body-xs" textColor="text.tertiary">
        {formatDateGroupLabel(timestamp)}
      </Typography>
      <Box sx={{ flex: 1, height: 1, backgroundColor: "divider" }} />
    </Stack>
  );
}

const scrollbarSx = {
  scrollbarWidth: "thin",
  scrollbarColor:
    "var(--joy-palette-neutral-outlinedBorder) var(--joy-palette-background-level1)",
  "&::-webkit-scrollbar": {
    width: "6px",
  },
  "&::-webkit-scrollbar-track": {
    backgroundColor: "background.level1",
    borderRadius: "999px",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "neutral.outlinedBorder",
    borderRadius: "999px",
  },
  "&:hover::-webkit-scrollbar-thumb": {
    backgroundColor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.4)",
  },
} as const;

export function AIImageStudioConversation({
  currentSessionId,
  messages,
  hasMoreMessages,
  historyLoadError,
  isInitialLoad,
  isLoadingHistory,
  messagesEndRef,
  onLoadMoreHistory,
  onPreviewImage,
  onRegenerate,
  onRetry,
  onRetryHistoryLoad,
  onScroll,
  onSuggestionSelect,
  onUseImage,
  paddingX,
}: AIImageStudioConversationProps) {
  const conversationRef = React.useRef<HTMLDivElement | null>(null);
  const messageRefs = React.useRef(new Map<string, HTMLDivElement>());
  const highlightTimeoutRef = React.useRef<number | null>(null);
  const lastMessageIdRef = React.useRef<string | null>(null);
  const nearBottomRef = React.useRef(true);
  const [highlightedMessageId, setHighlightedMessageId] = React.useState<
    string | null
  >(null);
  const [showNewImageReady, setShowNewImageReady] = React.useState(false);
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

  React.useEffect(() => {
    if (isInitialLoad) {
      return;
    }

    const lastMessageId =
      messages.length > 0 ? messages[messages.length - 1]?.id : null;
    if (!lastMessageId || lastMessageId === lastMessageIdRef.current) {
      return;
    }

    lastMessageIdRef.current = lastMessageId;

    const container = conversationRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const shouldAutoScroll = nearBottomRef.current || distanceFromBottom <= 60;

    if (shouldAutoScroll) {
      window.requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });
      setShowNewImageReady(false);
      return;
    }

    if (messages[messages.length - 1]?.type === "images") {
      setShowNewImageReady(true);
    }
  }, [isInitialLoad, messages, messagesEndRef]);

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
      const isNearBottom = distanceFromBottom <= 60;

      nearBottomRef.current = isNearBottom;

      if (isNearBottom && showNewImageReady) {
        setShowNewImageReady(false);
      }

      onScroll(event);
    },
    [onScroll, showNewImageReady],
  );

  const scrollToLatest = React.useCallback(() => {
    nearBottomRef.current = true;
    setShowNewImageReady(false);
    messagesEndRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [messagesEndRef, prefersReducedMotion]);

  return (
    <Box
      component="section"
      onScroll={handleScroll}
      ref={conversationRef}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        scrollBehavior: "smooth",
        position: "relative",
        px: paddingX,
        py: 2.5,
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
        <Stack alignItems="center" justifyContent="center" sx={{ py: 1.5 }}>
          <CircularProgress size="sm" thickness={3} />
        </Stack>
      ) : null}

      {!isInitialLoad && hasMoreMessages ? (
        <Stack alignItems="center" sx={{ pb: 1.5 }}>
          <Button
            color="neutral"
            onClick={onLoadMoreHistory}
            size="sm"
            variant="soft"
          >
            Load 25 more
          </Button>
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
          sx={{ py: 1.5 }}
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
        <AIImageStudioWelcome onSuggestionSelect={onSuggestionSelect} />
      ) : null}

      {!isInitialLoad && messages.length > 0 ? (
        <Stack
          spacing={1.5}
          sx={{
            animation: "aiImageStudioConversationFade 200ms ease-out both",
          }}
        >
          {messages.map((message) => {
            if (message.type === "session_divider" && message.sessionInfo) {
              return (
                <AISessionDivider
                  key={message.id}
                  channel={message.sessionInfo.channel}
                  contextType={message.sessionInfo.contextType}
                  createdAt={message.sessionInfo.createdAt}
                  sessionTitle={message.sessionInfo.title}
                />
              );
            }

            const previousMeaningfulMessage = [...messages]
              .slice(0, messages.indexOf(message))
              .reverse()
              .find((entry) => entry.type !== "session_divider");
            const shouldShowDateHeader =
              message.type !== "session_divider" &&
              (!previousMeaningfulMessage ||
                format(message.timestamp, "yyyy-MM-dd") !==
                  format(previousMeaningfulMessage.timestamp, "yyyy-MM-dd"));
            const isHistorical =
              !!currentSessionId &&
              !!message.sessionId &&
              message.sessionId !== currentSessionId;

            const variationKey =
              message.type === "images"
                ? message.sessionId &&
                  normalizePrompt(message.userPrompt || message.prompt)
                  ? `${message.sessionId}:${normalizePrompt(message.userPrompt || message.prompt)}`
                  : null
                : null;
            const variationGroup = variationKey
              ? variationGroupsByKey.get(variationKey)
              : undefined;
            const showVariationStrip =
              !!variationKey &&
              latestVariationMessageIdByKey.get(variationKey) === message.id &&
              (variationGroup?.length || 0) > 1;

            return (
              <Box
                key={message.id}
                ref={(node: HTMLDivElement | null) => {
                  if (node) {
                    messageRefs.current.set(message.id, node);
                    return;
                  }

                  messageRefs.current.delete(message.id);
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
                  <AIImageStudioDateHeader timestamp={message.timestamp} />
                ) : null}

                {message.type === "user" && previousMeaningfulMessage ? (
                  <AIImageStudioTimestampSeparator
                    timestamp={message.timestamp}
                  />
                ) : null}

                <AIImageStudioMessage
                  isHighlighted={highlightedMessageId === message.id}
                  isHistorical={isHistorical}
                  message={message}
                  onPreviewImage={onPreviewImage}
                  onRegenerate={onRegenerate}
                  onRetry={onRetry}
                  onUseImage={onUseImage}
                  onVariationSelect={handleVariationSelect}
                  showVariationStrip={showVariationStrip}
                  variationGroup={variationGroup}
                />
              </Box>
            );
          })}
        </Stack>
      ) : null}

      {showNewImageReady ? (
        <Box
          sx={{
            position: "sticky",
            bottom: 12,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            mt: 1.5,
            transition: prefersReducedMotion ? "none" : "opacity 180ms ease",
          }}
        >
          <Button
            color="primary"
            onClick={scrollToLatest}
            size="sm"
            startDecorator={<ArrowDown size={14} strokeWidth={2.2} />}
            sx={{
              pointerEvents: "auto",
              borderRadius: "999px",
              boxShadow: "md",
            }}
            variant="solid"
          >
            New image ready ↓
          </Button>
        </Box>
      ) : null}

      <div ref={messagesEndRef} />
    </Box>
  );
}
