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
  message: AIImageStudioMessageModel;
  isHighlighted?: boolean;
  isHistorical?: boolean;
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
  message,
  isHighlighted = false,
  isHistorical = false,
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
  const maxWidth = message.type === "user" ? "85%" : "90%";
  const timestampText = formatMessageTimestamp(message.timestamp);
  const imageResults = message.images || [];

  const bubbleSx = {
    maxWidth,
    px: 1.75,
    py: message.type === "user" ? 1.25 : 1.5,
    borderRadius:
      message.type === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
    backgroundColor:
      message.type === "user"
        ? "background.level2"
        : message.type === "error"
          ? "danger.softBg"
          : "background.level1",
    boxShadow: isHistorical ? "none" : "sm",
    opacity: isHistorical ? 0.9 : 1,
  } as const;

  return (
    <Stack
      spacing={0.5}
      sx={{
        alignItems: alignment,
        ...(prefersReducedMotion ? {} : bubbleEnterSx),
      }}
    >
      <Box sx={bubbleSx}>
        {message.type === "user" ? (
          <Typography level="body-md" sx={{ whiteSpace: "pre-wrap" }}>
            {message.content}
          </Typography>
        ) : null}

        {message.type === "assistant" ? (
          <Typography level="body-md" sx={{ whiteSpace: "pre-wrap" }}>
            {message.content}
          </Typography>
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
                  message.userPrompt ||
                  image.userPrompt ||
                  message.prompt ||
                  "";

                return (
                  <AIImageStudioImageResultCard
                    key={`${message.id}-${image.id}`}
                    activeVariationMessageId={message.id}
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
      </Box>

      {message.type !== "session_divider" ? (
        <Typography
          level="body-xs"
          textColor="text.tertiary"
          sx={{ px: 0.5, opacity: isHistorical ? 0.72 : 1 }}
        >
          {timestampText}
        </Typography>
      ) : null}
    </Stack>
  );
}
