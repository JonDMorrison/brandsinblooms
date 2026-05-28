import * as React from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertCircle } from "lucide-react";
import { BloomAvatar } from "@/components/bloom/BloomAvatar";
import { useBloom } from "@/components/bloom/BloomContext";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { BloomToolLoadingPill } from "@/components/bloom/BloomToolLoadingPill";
import { createResearchProgressPayload } from "@/components/bloom/blocks/researchProgressPayload";
import { ThinkingBlock } from "@/components/bloom/blocks/ThinkingBlock";
import { ContentBlockRenderer } from "@/components/bloom/content/ContentBlockRenderer";
import { contentBlockFromStreamingBlock } from "@/components/bloom/content/parseContentBlocks";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import type { BloomBlockActionContext } from "@/components/bloom/blocks/blockTypes";
import type { BloomMessage } from "@/hooks/bloom/types";
import type {
  BloomActiveToolCall,
  BloomStreamingBlock,
} from "@/hooks/bloom/useBloomStreaming";

interface BloomStreamingMessageProps {
  compact?: boolean;
  message: BloomMessage;
  retryPrompt: string | null;
}

export interface BloomStreamingMessageState {
  activeToolCall: BloomActiveToolCall | null;
  connectionState: ReturnType<typeof useBloom>["connectionState"];
  isResearchComplete: boolean;
  isResearchSynthesizing: boolean;
  researchConversationId: string | null;
  researchPlan: ReturnType<typeof useBloom>["researchPlan"];
  researchSteps: ReturnType<typeof useBloom>["researchSteps"];
  streamError: string | null;
  streamingBlocks: BloomStreamingBlock[];
  streamingContent: string;
  streamingThinking: string;
}

export interface BloomStreamingMessageContentProps {
  compact?: boolean;
  message: BloomMessage;
  onCancelStream: () => void;
  onSubmitPrompt: (prompt: string) => void;
  renderBlock?: (
    block: BloomStreamingBlock,
    onAction: (action: string, context: BloomBlockActionContext) => void,
  ) => React.ReactNode;
  retryPrompt: string | null;
  showAvatar?: boolean;
  streamState: BloomStreamingMessageState;
}

type StreamRenderItem =
  | { kind: "text"; id: string }
  | { kind: "block"; id: string; block: BloomStreamingBlock };

const initialTextItem = (messageId: string): StreamRenderItem => ({
  kind: "text",
  id: `${messageId}-text-0`,
});

export function BloomResponseLoadingAvatar() {
  const reducedMotion = useBloomReducedMotion();

  return (
    <Box
      sx={{
        position: "relative",
        alignItems: "center",
        display: "inline-flex",
        flexShrink: 0,
        height: 36,
        justifyContent: "center",
        width: 36,
      }}
    >
      {reducedMotion ? (
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            inset: 0,
            border: "2px solid",
            borderColor: "primary.300",
            borderRadius: "50%",
          }}
        />
      ) : (
        <CircularProgress
          aria-label="Bloom is generating a response"
          color="primary"
          size="sm"
          thickness={2.5}
          sx={{
            position: "absolute",
            inset: 0,
            "--CircularProgress-size": "36px",
          }}
        />
      )}
      <BloomAvatar size={28} />
    </Box>
  );
}

function ThinkingDots({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        alignItems: "center",
        alignSelf: "flex-start",
        display: "inline-flex",
        minHeight: 36,
        width: "fit-content",
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        {[0, 1, 2].map((index) => (
          <Box
            key={index}
            sx={{
              width: 6,
              height: 6,
              borderRadius: 999,
              backgroundColor: "neutral.500",
              animation: reducedMotion
                ? "none"
                : "bloomStreamingThinkingDot 1.4s ease-in-out infinite",
              animationDelay: `${index * 140}ms`,
              "@keyframes bloomStreamingThinkingDot": {
                "0%, 80%, 100%": { opacity: 0.35, transform: "translateY(0)" },
                "40%": { opacity: 1, transform: "translateY(-2px)" },
              },
            }}
          />
        ))}
      </Stack>
    </Box>
  );
}

function CompactThinkingNotice() {
  return (
    <Sheet
      variant="soft"
      color="neutral"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        p: 1,
        backgroundColor: "background.level1",
      }}
    >
      <Typography level="body-xs" sx={{ color: "neutral.600" }}>
        Reasoning available. Open in Bloom to expand it.
      </Typography>
    </Sheet>
  );
}

function ErrorActions({
  error,
  onCancel,
  onRetry,
  retryPrompt,
}: {
  error: string;
  onCancel: () => void;
  onRetry: (prompt: string) => void;
  retryPrompt: string | null;
}) {
  return (
    <Stack spacing={1} alignItems="flex-start">
      <JoyChip
        color="danger"
        size="sm"
        variant="soft"
        startDecorator={<AlertCircle size={13} strokeWidth={1.9} />}
        sx={{
          maxWidth: "100%",
          "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
        }}
      >
        {error}
      </JoyChip>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <JoyButton
          color="neutral"
          disabled={!retryPrompt}
          size="sm"
          variant="outlined"
          onClick={() => {
            if (retryPrompt) {
              onRetry(retryPrompt);
            }
          }}
        >
          Retry
        </JoyButton>
        <JoyButton color="neutral" size="sm" variant="plain" onClick={onCancel}>
          Keep partial response
        </JoyButton>
      </Stack>
    </Stack>
  );
}

function useLastToolCall(activeToolCall: BloomActiveToolCall | null) {
  const [lastToolCall, setLastToolCall] =
    React.useState<BloomActiveToolCall | null>(activeToolCall);

  React.useEffect(() => {
    if (activeToolCall) {
      setLastToolCall(activeToolCall);
    }
  }, [activeToolCall]);

  return lastToolCall;
}

export function BloomStreamingMessageContent({
  compact = false,
  message,
  onCancelStream,
  onSubmitPrompt,
  renderBlock,
  retryPrompt,
  showAvatar = true,
  streamState,
}: BloomStreamingMessageContentProps) {
  const reducedMotion = useBloomReducedMotion();
  const {
    activeToolCall,
    connectionState,
    isResearchComplete,
    isResearchSynthesizing,
    researchConversationId,
    researchPlan,
    researchSteps,
    streamError,
    streamingBlocks,
    streamingContent,
    streamingThinking,
  } = streamState;
  const textRefs = React.useRef<Map<string, HTMLSpanElement>>(new Map());
  const appendedLengthRef = React.useRef(0);
  const renderedBlockIdsRef = React.useRef<Set<string>>(new Set());
  const currentTextItemIdRef = React.useRef(initialTextItem(message.id).id);
  const [currentTextItemId, setCurrentTextItemId] = React.useState(
    currentTextItemIdRef.current,
  );
  const [items, setItems] = React.useState<StreamRenderItem[]>(() => [
    initialTextItem(message.id),
  ]);
  const lastToolCall = useLastToolCall(activeToolCall);
  const showConnecting =
    connectionState === "connecting" &&
    !streamingContent.trim() &&
    !streamingThinking.trim() &&
    streamingBlocks.length === 0 &&
    !activeToolCall;
  const showGeneratingAvatar =
    showAvatar &&
    !compact &&
    (connectionState === "connecting" || connectionState === "streaming");
  const cursorVisible = connectionState === "streaming";

  const setTextRef = React.useCallback(
    (id: string, element: HTMLSpanElement | null) => {
      if (element) {
        textRefs.current.set(id, element);
        return;
      }

      textRefs.current.delete(id);
    },
    [],
  );

  const appendStreamingText = React.useCallback((nextContent: string) => {
    if (nextContent.length <= appendedLengthRef.current) {
      return;
    }

    const currentElement = textRefs.current.get(currentTextItemIdRef.current);
    if (!currentElement) {
      return;
    }

    const nextText = nextContent.slice(appendedLengthRef.current);
    currentElement.textContent = `${currentElement.textContent ?? ""}${nextText}`;
    appendedLengthRef.current = nextContent.length;
  }, []);

  React.useEffect(() => {
    textRefs.current.clear();
    appendedLengthRef.current = 0;
    renderedBlockIdsRef.current = new Set();
    const firstTextItem = initialTextItem(message.id);
    currentTextItemIdRef.current = firstTextItem.id;
    setCurrentTextItemId(firstTextItem.id);
    setItems([firstTextItem]);
  }, [message.id]);

  React.useLayoutEffect(() => {
    appendStreamingText(streamingContent);
  }, [appendStreamingText, items, streamingContent]);

  React.useEffect(() => {
    const nextItems: StreamRenderItem[] = [];
    let nextTextItemId = currentTextItemIdRef.current;

    for (const block of streamingBlocks) {
      if (renderedBlockIdsRef.current.has(block.id)) {
        continue;
      }

      appendStreamingText(streamingContent);
      renderedBlockIdsRef.current.add(block.id);
      const textItemId = `${message.id}-text-${renderedBlockIdsRef.current.size}`;
      nextItems.push({ kind: "block", id: block.id, block });
      nextItems.push({ kind: "text", id: textItemId });
      nextTextItemId = textItemId;
    }

    if (nextItems.length === 0) {
      return;
    }

    currentTextItemIdRef.current = nextTextItemId;
    setCurrentTextItemId(nextTextItemId);
    setItems((current) => [...current, ...nextItems]);
  }, [appendStreamingText, message.id, streamingBlocks, streamingContent]);

  const handleBlockAction = React.useCallback(
    (action: string, _context: BloomBlockActionContext) => {
      const prompt = action.trim();
      if (prompt) {
        onSubmitPrompt(prompt);
      }
    },
    [onSubmitPrompt],
  );
  const showResearchProgress =
    message.mode === "research" &&
    researchConversationId === message.conversationId &&
    (researchPlan.totalSteps > 0 || researchSteps.size > 0);
  const researchProgressPayload = showResearchProgress
    ? createResearchProgressPayload({
        plan: researchPlan,
        stepStatuses: researchSteps,
        isSynthesizing: isResearchSynthesizing,
        isComplete: isResearchComplete,
      })
    : null;

  return (
    <Box
      sx={{
        alignItems: showConnecting ? "center" : "flex-start",
        display: "flex",
        gap: compact ? 1 : 1.5,
        mb: compact ? 0 : 3,
        pr: compact ? 0 : { xs: 0, md: 5 },
      }}
    >
      {showGeneratingAvatar ? <BloomResponseLoadingAvatar /> : null}
      <Stack spacing={compact ? 1 : 1.25} sx={{ minWidth: 0, flex: 1 }}>
        {showConnecting ? <ThinkingDots reducedMotion={reducedMotion} /> : null}

        {compact ? (
          streamingThinking.trim() ? (
            <CompactThinkingNotice />
          ) : null
        ) : (
          <ThinkingBlock
            content={streamingThinking}
            defaultExpanded
            isStreaming={
              connectionState === "streaming" ||
              connectionState === "connecting"
            }
          />
        )}

        {researchProgressPayload ? (
          <BlockRenderer
            blockType="research_progress"
            payload={researchProgressPayload}
            onAction={handleBlockAction}
          />
        ) : null}

        <Stack spacing={compact ? 1 : 1.25} sx={{ minWidth: 0 }}>
          {items.map((item) => {
            if (item.kind === "block") {
              return renderBlock ? (
                <React.Fragment key={item.id}>
                  {renderBlock(item.block, handleBlockAction)}
                </React.Fragment>
              ) : (
                <ContentBlockRenderer
                  key={item.id}
                  block={contentBlockFromStreamingBlock(item.block)}
                  onAction={(prompt) =>
                    handleBlockAction(prompt, {
                      blockType: item.block.blockType,
                      toolName: item.block.toolName,
                    })
                  }
                />
              );
            }

            return (
              <Typography
                key={item.id}
                component="div"
                level="body-md"
                sx={{
                  color: compact ? "neutral.700" : "neutral.800",
                  fontSize: "16px",
                  lineHeight: compact ? 1.65 : 1.7,
                  minHeight:
                    item.id === currentTextItemId && !showConnecting
                      ? compact
                        ? 18
                        : 24
                      : undefined,
                  overflowWrap: "anywhere",
                  whiteSpace: "pre-wrap",
                }}
              >
                <Box
                  component="span"
                  ref={(element: HTMLSpanElement | null) =>
                    setTextRef(item.id, element)
                  }
                />
                {item.id === currentTextItemId ? (
                  <Box
                    aria-hidden="true"
                    component="span"
                    sx={{
                      display: cursorVisible ? "inline-block" : "none",
                      width: 2,
                      height: "1em",
                      ml: 0.25,
                      verticalAlign: "-0.12em",
                      borderRadius: 999,
                      backgroundColor: "primary.500",
                      opacity: cursorVisible ? 1 : 0,
                      transition: reducedMotion ? "none" : "opacity 200ms ease",
                      animation: cursorVisible
                        ? reducedMotion
                          ? "none"
                          : "bloomStreamingCursor 1s step-end infinite"
                        : "none",
                      "@keyframes bloomStreamingCursor": {
                        "0%, 50%": { opacity: 1 },
                        "51%, 100%": { opacity: 0 },
                      },
                    }}
                  />
                ) : null}
              </Typography>
            );
          })}
        </Stack>

        {lastToolCall && !showResearchProgress ? (
          <BloomToolLoadingPill
            description={lastToolCall.description}
            isActive={Boolean(activeToolCall)}
            toolName={lastToolCall.toolName}
          />
        ) : null}

        {connectionState === "error" && streamError ? (
          <>
            <Divider
              sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-100)" }}
            />
            <ErrorActions
              error={streamError}
              onCancel={onCancelStream}
              onRetry={onSubmitPrompt}
              retryPrompt={retryPrompt}
            />
          </>
        ) : null}
      </Stack>
    </Box>
  );
}

export function BloomStreamingMessage({
  compact = false,
  message,
  retryPrompt,
}: BloomStreamingMessageProps) {
  const {
    activeToolCall,
    cancelStream,
    connectionState,
    isResearchComplete,
    isResearchSynthesizing,
    researchConversationId,
    researchPlan,
    researchSteps,
    sendMessage,
    streamError,
    streamingBlocks,
    streamingContent,
    streamingThinking,
  } = useBloom();

  const streamState = React.useMemo<BloomStreamingMessageState>(
    () => ({
      activeToolCall,
      connectionState,
      isResearchComplete,
      isResearchSynthesizing,
      researchConversationId,
      researchPlan,
      researchSteps,
      streamError,
      streamingBlocks,
      streamingContent,
      streamingThinking,
    }),
    [
      activeToolCall,
      connectionState,
      isResearchComplete,
      isResearchSynthesizing,
      researchConversationId,
      researchPlan,
      researchSteps,
      streamError,
      streamingBlocks,
      streamingContent,
      streamingThinking,
    ],
  );

  const submitPrompt = React.useCallback(
    (prompt: string) => {
      void sendMessage(prompt).catch(() => undefined);
    },
    [sendMessage],
  );

  return (
    <BloomStreamingMessageContent
      compact={compact}
      message={message}
      onCancelStream={cancelStream}
      onSubmitPrompt={submitPrompt}
      retryPrompt={retryPrompt}
      streamState={streamState}
    />
  );
}
