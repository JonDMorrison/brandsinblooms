import * as React from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import {
  Copy,
  Pencil,
  RefreshCw,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import type { BloomMessage, MessageFeedback } from "@/hooks/bloom/types";

interface BloomMessageActionsProps {
  message: BloomMessage;
  isLatestAssistant: boolean;
  isStreaming?: boolean;
  forceVisible?: boolean;
  onCopy: () => void;
  onBookmark: () => void;
  onRegenerate: () => void;
  onEdit: () => void;
  onFeedback: (feedback: MessageFeedback) => void;
}

interface MessageActionButtonProps {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  inactiveColor?: string;
  tone?: "neutral" | "success" | "danger";
  onClick: () => void;
}

const LONG_PRESS_MS = 300;

const fallbackCopyText = (text: string) => {
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
};

export const copyBloomMessageText = async (text: string) => {
  if (!text.trim()) {
    toast.error("Nothing to copy");
    return;
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
      return;
    }
  } catch {
    // Fall through to the textarea copy path below.
  }

  if (fallbackCopyText(text)) {
    toast.success("Copied to clipboard");
    return;
  }

  toast.error("Unable to copy to clipboard");
};

export function useBloomMessageActionsVisibility() {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = React.useRef<number | null>(null);
  const [forceVisible, setForceVisible] = React.useState(false);

  const clearLongPressTimer = React.useCallback(() => {
    if (longPressTimerRef.current === null) {
      return;
    }

    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }, []);

  React.useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  React.useEffect(() => {
    if (!forceVisible || typeof document === "undefined") {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) {
        return;
      }

      setForceVisible(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [forceVisible]);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" || typeof window === "undefined") {
        return;
      }

      clearLongPressTimer();
      longPressTimerRef.current = window.setTimeout(() => {
        setForceVisible(true);
      }, LONG_PRESS_MS);
    },
    [clearLongPressTimer],
  );

  const hideForcedActions = React.useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  return {
    forceVisible,
    handlePointerCancel: hideForcedActions,
    handlePointerDown,
    handlePointerLeave: hideForcedActions,
    handlePointerUp: hideForcedActions,
    rootRef,
  };
}

const feedbackFromMessage = (message: BloomMessage): MessageFeedback => {
  const feedback = message.metadata.feedback;
  return feedback === "positive" || feedback === "negative" ? feedback : null;
};

function MessageActionButton({
  active = false,
  children,
  disabled = false,
  inactiveColor = "neutral.400",
  label,
  onClick,
  tone = "neutral",
}: MessageActionButtonProps) {
  const activeColor =
    tone === "success"
      ? "success.500"
      : tone === "danger"
        ? "danger.500"
        : "neutral.800";

  return (
    <JoyTooltip title={label} placement="top">
      <JoyButton
        aria-label={label}
        aria-pressed={active || undefined}
        color={tone === "neutral" ? "neutral" : tone}
        disabled={disabled}
        size="icon"
        variant="ghost"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        sx={{
          width: 28,
          height: 28,
          minHeight: 28,
          borderRadius: "var(--joy-radius-sm)",
          color: active ? activeColor : inactiveColor,
          "&:hover": {
            backgroundColor: "neutral.100",
            color: active ? activeColor : "neutral.700",
          },
        }}
      >
        {children}
      </JoyButton>
    </JoyTooltip>
  );
}

export function BloomMessageActions({
  forceVisible = false,
  isLatestAssistant,
  isStreaming = false,
  message,
  onBookmark,
  onCopy,
  onEdit,
  onFeedback,
  onRegenerate,
}: BloomMessageActionsProps) {
  const reducedMotion = useBloomReducedMotion();

  const feedback = feedbackFromMessage(message);
  const isAssistant = message.role === "assistant";
  const isUser = message.role === "user";

  return (
    <Sheet
      data-bloom-message-actions={isStreaming ? undefined : "true"}
      variant="plain"
      sx={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        minHeight: 30,
        px: 0,
        py: 0,
        backgroundColor: "transparent",
        borderRadius: "var(--joy-radius-sm)",
        boxShadow: "none",
        opacity: forceVisible && !isStreaming ? 1 : 0,
        pointerEvents: forceVisible && !isStreaming ? "auto" : "none",
        transition: reducedMotion ? "none" : "opacity 100ms ease",
        "@media (hover: hover)": {
          opacity: 0,
          pointerEvents: "none",
        },
      }}
    >
      <Stack direction="row" spacing={0.25} sx={{ minHeight: 30 }}>
        {isUser ? (
          <MessageActionButton label="Edit message" onClick={onEdit}>
            <Pencil size={14} strokeWidth={1.9} />
          </MessageActionButton>
        ) : null}

        <MessageActionButton label="Copy message" onClick={onCopy}>
          <Copy size={14} strokeWidth={1.9} />
        </MessageActionButton>

        {isAssistant ? (
          <>
            <MessageActionButton
              active={message.isBookmarked}
              label={message.isBookmarked ? "Remove bookmark" : "Bookmark"}
              onClick={onBookmark}
            >
              <Star
                size={14}
                strokeWidth={1.9}
                fill={message.isBookmarked ? "currentColor" : "none"}
              />
            </MessageActionButton>

            {isLatestAssistant ? (
              <MessageActionButton
                label="Regenerate response"
                onClick={onRegenerate}
              >
                <RefreshCw size={14} strokeWidth={1.9} />
              </MessageActionButton>
            ) : null}

            <MessageActionButton
              active={feedback === "positive"}
              inactiveColor={
                feedback === "negative" ? "neutral.300" : "neutral.400"
              }
              label="Helpful"
              tone="success"
              onClick={() =>
                onFeedback(feedback === "positive" ? null : "positive")
              }
            >
              <ThumbsUp
                size={14}
                strokeWidth={1.9}
                fill={feedback === "positive" ? "currentColor" : "none"}
              />
            </MessageActionButton>

            <MessageActionButton
              active={feedback === "negative"}
              inactiveColor={
                feedback === "positive" ? "neutral.300" : "neutral.400"
              }
              label="Not helpful"
              tone="danger"
              onClick={() =>
                onFeedback(feedback === "negative" ? null : "negative")
              }
            >
              <ThumbsDown
                size={14}
                strokeWidth={1.9}
                fill={feedback === "negative" ? "currentColor" : "none"}
              />
            </MessageActionButton>
          </>
        ) : null}
      </Stack>
    </Sheet>
  );
}
