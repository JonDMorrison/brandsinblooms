import React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";
import {
  AIImageStudioImageResultCard,
  type AIImageStudioVariationItem,
} from "./AIImageStudioImageResultCard";
import type { AIImageStudioMessage as AIImageStudioMessageModel } from "./types";

interface AIImageStudioMessageProps {
  hideTimestamp?: boolean;
  message: AIImageStudioMessageModel;
  renderInline?: boolean;
  isHighlighted?: boolean;
  isHistorical?: boolean;
  onActionClick?: (
    actionId: "done" | "next-target",
    message: AIImageStudioMessageModel,
  ) => void;
  onPreviewImage?: (
    image: NonNullable<AIImageStudioMessageModel["images"]>[number],
    message: AIImageStudioMessageModel,
  ) => void;
  onRegenerate?: (prompt: string) => void;
  onRetry?: (prompt: string) => void;
  onUseImage?: (
    image: NonNullable<AIImageStudioMessageModel["images"]>[number],
    message: AIImageStudioMessageModel,
  ) => void | Promise<void>;
  onVariationSelect?: (messageId: string) => void;
  showVariationStrip?: boolean;
  variationGroup?: AIImageStudioVariationItem[];
}

const bubbleEnterSx = {
  animation: "aiImageStudioMessageEnter 250ms ease-out both",
  "@keyframes aiImageStudioMessageEnter": {
    from: {
      opacity: 0,
      transform: "translateY(8px)",
    },
    to: {
      opacity: 1,
      transform: "translateY(0)",
    },
  },
} as const;

const statusFadeSx = {
  animation: "aiImageStudioStatusFade 2500ms ease-in-out both",
  "@keyframes aiImageStudioStatusFade": {
    "0%": {
      opacity: 0,
      transform: "translateY(2px)",
    },
    "12%": {
      opacity: 1,
      transform: "translateY(0)",
    },
    "88%": {
      opacity: 1,
      transform: "translateY(0)",
    },
    "100%": {
      opacity: 0,
      transform: "translateY(-2px)",
    },
  },
} as const;

function formatMessageTimestamp(timestamp: Date) {
  if (Date.now() - timestamp.getTime() < 30_000) {
    return "just now";
  }

  return formatDistanceToNow(timestamp, { addSuffix: true }).replace(
    /^about\s+/,
    "",
  );
}

function AIImageStudioPulseDots() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      {[0, 1, 2].map((index) => (
        <Box
          key={index}
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "text.tertiary",
            opacity: 0.4,
            animation: "aiImageStudioPulseDots 900ms ease-in-out infinite",
            animationDelay: `${index * 150}ms`,
            "@keyframes aiImageStudioPulseDots": {
              "0%, 80%, 100%": {
                opacity: 0.25,
                transform: "scale(0.92)",
              },
              "40%": {
                opacity: 1,
                transform: "scale(1)",
              },
            },
          }}
        />
      ))}
    </Stack>
  );
}

export function AIImageStudioMessage({
  hideTimestamp = false,
  message,
  renderInline = false,
  isHighlighted = false,
  isHistorical = false,
  onActionClick,
  onPreviewImage,
  onRegenerate,
  onRetry,
  onUseImage,
  onVariationSelect,
  showVariationStrip = false,
  variationGroup,
}: AIImageStudioMessageProps) {
  const [statusIndex, setStatusIndex] = React.useState(0);
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );

  const statusMessages = React.useMemo(
    () =>
      message.statusMessages && message.statusMessages.length > 0
        ? message.statusMessages
        : [message.content || "Interpreting your vision..."],
    [message.content, message.statusMessages],
  );

  React.useEffect(() => {
    setStatusIndex(0);

    if (
      message.type !== "loading" ||
      message.loadingPhase !== "thinking" ||
      statusMessages.length <= 1
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setStatusIndex((currentIndex) =>
        currentIndex + 1 >= statusMessages.length ? 0 : currentIndex + 1,
      );
    }, 2500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [message.id, message.loadingPhase, message.type, statusMessages]);

  const alignment = message.type === "user" ? "flex-end" : "flex-start";
  const maxWidth = message.type === "user" ? "82%" : "90%";
  const timestampText = formatMessageTimestamp(message.timestamp);
  const imageResults = message.images || [];
  const isAssistantBubble =
    message.type === "assistant" ||
    message.type === "thinking" ||
    message.type === "loading" ||
    message.type === "images";

  const bubbleSx = {
    maxWidth,
    px: message.type === "user" ? "16px" : "16px",
    py: message.type === "user" ? "10px" : "12px",
    borderRadius:
      message.type === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
    backgroundColor:
      message.type === "user"
        ? "var(--joy-palette-brandNavy-solidBg)"
        : message.type === "error"
          ? "danger.softBg"
          : "background.level1",
    border: isAssistantBubble ? "1px solid" : "none",
    borderColor: isAssistantBubble
      ? "var(--joy-palette-neutral-100, #F0F0F0)"
      : undefined,
    boxShadow: isHistorical ? "none" : "sm",
    opacity: isHistorical ? 0.9 : 1,
  } as const;

  const content = (
    <>
      {message.type === "user" ? (
        <Typography
          level="body-sm"
          sx={{
            whiteSpace: "pre-wrap",
            color: "common.white",
            fontWeight: 400,
          }}
        >
          {message.content}
        </Typography>
      ) : null}

      {message.type === "assistant" ? (
        <Stack spacing={1}>
          <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap" }}>
            {message.content}
          </Typography>
          {message.actions && message.actions.length > 0 ? (
            <Stack direction="row" spacing={0.75} flexWrap="wrap">
              {message.actions.map((action) => (
                <Button
                  key={`${message.id}-${action.id}`}
                  color={action.id === "next-target" ? "primary" : "neutral"}
                  onClick={() => onActionClick?.(action.id, message)}
                  size="sm"
                  variant={action.id === "next-target" ? "solid" : "soft"}
                >
                  {action.label}
                </Button>
              ))}
            </Stack>
          ) : null}
        </Stack>
      ) : null}

      {message.type === "thinking" ? (
        <Typography
          level="body-sm"
          sx={{
            color: "text.secondary",
            fontStyle: "italic",
            whiteSpace: "pre-wrap",
          }}
        >
          {message.content}
        </Typography>
      ) : null}

      {message.type === "loading" ? (
        <Box aria-live="polite">
          {message.loadingPhase === "acknowledged" ? (
            <AIImageStudioPulseDots />
          ) : (
            <Stack direction="row" spacing={1.25} alignItems="center">
              <CircularProgress color="primary" size="sm" variant="soft" />
              <Typography
                key={`${message.id}-${statusIndex}`}
                level="body-sm"
                sx={{
                  color: "text.secondary",
                  fontStyle: "italic",
                  ...statusFadeSx,
                }}
              >
                {statusMessages[statusIndex]}
              </Typography>
            </Stack>
          )}
        </Box>
      ) : null}

      {message.type === "images" ? (
        <Stack spacing={1.25}>
          {message.content ? (
            <Typography level="body-sm" textColor="text.secondary">
              {message.content}
            </Typography>
          ) : null}

          <Stack spacing={1.25}>
            {imageResults.map((image, index) => {
              const promptForAlt =
                message.userPrompt ||
                image.userPrompt ||
                message.prompt ||
                "AI generated image.";
              const promptForDetails =
                image.enhancedPrompt ||
                message.enhancedPrompt ||
                message.userPrompt ||
                image.userPrompt ||
                message.prompt ||
                "";
              const regeneratePrompt =
                message.userPrompt || image.userPrompt || message.prompt || "";

              return (
                <AIImageStudioImageResultCard
                  key={`${message.id}-${image.id}`}
                  activeVariationMessageId={message.id}
                  aspectRatio={message.aspectRatio}
                  generatedAt={message.timestamp}
                  image={image}
                  isHighlighted={isHighlighted}
                  isHistorical={isHistorical}
                  onPreview={() => onPreviewImage?.(image, message)}
                  onRegenerate={
                    regeneratePrompt
                      ? () => onRegenerate?.(regeneratePrompt)
                      : undefined
                  }
                  onUseImage={
                    onUseImage ? () => onUseImage(image, message) : undefined
                  }
                  onVariationSelect={onVariationSelect}
                  promptForAlt={promptForAlt}
                  promptForDetails={promptForDetails}
                  showVariationStrip={
                    showVariationStrip && index === imageResults.length - 1
                  }
                  stylePreset={message.generationConfig?.stylePreset}
                  variationGroup={
                    showVariationStrip && index === imageResults.length - 1
                      ? variationGroup
                      : undefined
                  }
                />
              );
            })}
          </Stack>
        </Stack>
      ) : null}

      {message.type === "error" ? (
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Box
              aria-hidden="true"
              sx={{ color: "danger.500", display: "inline-flex", mt: 0.125 }}
            >
              <AlertTriangle size={16} strokeWidth={2} />
            </Box>
            <Typography level="body-sm" sx={{ color: "danger.700" }}>
              {message.content}
            </Typography>
          </Stack>

          {message.retryPrompt ? (
            <Button
              color="primary"
              onClick={() => onRetry?.(message.retryPrompt ?? "")}
              size="sm"
              sx={{ alignSelf: "flex-start" }}
              variant="outlined"
            >
              Try Again
            </Button>
          ) : null}
        </Stack>
      ) : null}
    </>
  );

  if (renderInline) {
    return content;
  }

  return (
    <Stack
      spacing={0.5}
      sx={{
        alignItems: alignment,
        ...(prefersReducedMotion ? {} : bubbleEnterSx),
      }}
    >
      <Box sx={bubbleSx}>{content}</Box>

      {message.type !== "session_divider" && !hideTimestamp ? (
        <Typography
          level="body-xs"
          textColor="text.tertiary"
          sx={{
            px: 0.5,
            opacity: 0.6,
            alignSelf: message.type === "user" ? "flex-end" : "flex-start",
            textAlign: message.type === "user" ? "right" : "left",
          }}
        >
          {timestampText}
        </Typography>
      ) : null}
    </Stack>
  );
}
