import * as React from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertCircle } from "lucide-react";
import { useBloom } from "@/components/bloom/BloomContext";
import { BloomStreamingIndicator } from "@/components/bloom/BloomToolLoadingPill";
import { createResearchProgressPayload } from "@/components/bloom/blocks/researchProgressPayload";
import { ThinkingBlock } from "@/components/bloom/blocks/ThinkingBlock";
import { ContentBlockRenderer } from "@/components/bloom/content/ContentBlockRenderer";
import {
  contentBlockFromStreamingBlock,
  extractIdentifiersFromToolResults,
  stripRedundantContent,
} from "@/components/bloom/content/parseContentBlocks";
import {
  stripEchoedToolPayloads,
  stripStreamingMarkdownTables,
} from "@/components/bloom/content/sanitizeBloomContent";
import {
  analyzeStreamingContent,
  extractPreFormText,
  gateLoaderMessage,
  isGlobalGateAction,
  type GateDecision,
} from "@/components/bloom/utils/contentGate";
import type { PendingResourceForm } from "@/components/bloom/utils/resourceFormRegistry";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import type { BloomBlockActionContext } from "@/components/bloom/blocks/blockTypes";
import type { BloomContentBlock } from "@/components/bloom/content/parseContentBlocks";
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
  onResourceFormDetected?: (form: PendingResourceForm) => void;
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

export function BloomStreamingMessageContent({
  compact = false,
  message,
  onCancelStream,
  onResourceFormDetected,
  onSubmitPrompt,
  renderBlock,
  retryPrompt,
  streamState,
}: BloomStreamingMessageContentProps) {
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
  const currentTextStartRef = React.useRef(0);
  const renderedBlockIdsRef = React.useRef<Set<string>>(new Set());
  const currentTextItemIdRef = React.useRef(initialTextItem(message.id).id);
  // Streaming-time redundant-text suppression: when a tool-result card has
  // rendered and the trailing text only restates the same entities, we clear
  // the live text element and show an "Organizing your results…" loader.
  const suppressTrailingRef = React.useRef(false);
  const postToolTrailingRef = React.useRef(false);
  const toolResultBlocksRef = React.useRef<BloomContentBlock[]>([]);
  // Content-gate decision that hides the WHOLE live buffer (JSON payloads, form
  // requests, task plans). Drives both the imperative text writer and the
  // tailored loader copy.
  const globalGateRef = React.useRef<GateDecision | null>(null);
  const [currentTextItemId, setCurrentTextItemId] = React.useState(
    currentTextItemIdRef.current,
  );
  const [items, setItems] = React.useState<StreamRenderItem[]>(() => [
    initialTextItem(message.id),
  ]);
  const showConnecting =
    (connectionState === "connecting" || connectionState === "streaming") &&
    !streamingContent.trim() &&
    !streamingThinking.trim() &&
    streamingBlocks.length === 0 &&
    !activeToolCall;

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

  const renderCurrentText = React.useCallback((nextContent: string) => {
    if (nextContent.length === appendedLengthRef.current) {
      return;
    }

    const currentElement = textRefs.current.get(currentTextItemIdRef.current);
    if (!currentElement) {
      return;
    }

    // Rewrite the current text element from its starting offset, hiding any
    // markdown tables so raw `| pipe |` rows never flash during streaming.
    // Frozen elements (before an inline block) keep their last rendered text.
    const slice = nextContent.slice(currentTextStartRef.current);
    let rendered: string;
    const globalGate = globalGateRef.current;
    if (globalGate) {
      // JSON payload / task plan: hide everything. Form request: keep only the
      // pre-form intro prose so the field list never flashes as raw text.
      rendered =
        globalGate.action === "intercept_form"
          ? extractPreFormText(stripStreamingMarkdownTables(slice))
          : "";
    } else if (suppressTrailingRef.current) {
      // Trailing text is fully redundant with the result cards — keep it empty
      // while the loader is shown.
      rendered = "";
    } else if (
      postToolTrailingRef.current &&
      toolResultBlocksRef.current.length > 0
    ) {
      // Post-card text: strip any restated tables/lists so only real analysis
      // remains visible, consistent with the completion-time cleanup.
      rendered = stripRedundantContent(
        stripStreamingMarkdownTables(slice),
        toolResultBlocksRef.current,
      );
    } else {
      // Default path also strips any echoed tool-error JSON so a complete
      // payload never flashes mid-stream before the gate can buffer it.
      rendered = stripEchoedToolPayloads(stripStreamingMarkdownTables(slice));
    }
    currentElement.textContent = rendered;
    appendedLengthRef.current = nextContent.length;
  }, []);

  React.useEffect(() => {
    textRefs.current.clear();
    appendedLengthRef.current = 0;
    currentTextStartRef.current = 0;
    renderedBlockIdsRef.current = new Set();
    suppressTrailingRef.current = false;
    postToolTrailingRef.current = false;
    toolResultBlocksRef.current = [];
    globalGateRef.current = null;
    const firstTextItem = initialTextItem(message.id);
    currentTextItemIdRef.current = firstTextItem.id;
    setCurrentTextItemId(firstTextItem.id);
    setItems([firstTextItem]);
  }, [message.id]);

  React.useLayoutEffect(() => {
    renderCurrentText(streamingContent);
  }, [renderCurrentText, items, streamingContent]);

  React.useEffect(() => {
    const nextItems: StreamRenderItem[] = [];
    let nextTextItemId = currentTextItemIdRef.current;

    for (const block of streamingBlocks) {
      if (renderedBlockIdsRef.current.has(block.id)) {
        continue;
      }

      // Freeze the text streamed so far into the current element, then start a
      // fresh text element positioned after this inline block.
      renderCurrentText(streamingContent);
      renderedBlockIdsRef.current.add(block.id);
      const textItemId = `${message.id}-text-${renderedBlockIdsRef.current.size}`;
      nextItems.push({ kind: "block", id: block.id, block });
      nextItems.push({ kind: "text", id: textItemId });
      currentTextItemIdRef.current = textItemId;
      currentTextStartRef.current = streamingContent.length;
      nextTextItemId = textItemId;
    }

    if (nextItems.length === 0) {
      return;
    }

    setCurrentTextItemId(nextTextItemId);
    setItems((current) => [...current, ...nextItems]);
  }, [renderCurrentText, message.id, streamingBlocks, streamingContent]);

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

  // Tool-result cards rendered so far in this stream, normalized to content
  // blocks for the redundancy detector.
  const toolResultBlocks = React.useMemo<BloomContentBlock[]>(
    () =>
      streamingBlocks
        .map((block) => contentBlockFromStreamingBlock(block))
        .filter((block) => block.type === "tool_result"),
    [streamingBlocks],
  );

  // Once a result card exists, the trailing text is "post-tool". If everything
  // streamed after that card is redundant with the cards, suppress it and show
  // the organizing loader instead of restated data.
  const isStreaming = connectionState === "streaming";
  const trailingText = streamingContent.slice(currentTextStartRef.current);
  const postToolTrailing = toolResultBlocks.length > 0;
  const cleanedTrailing = postToolTrailing
    ? stripRedundantContent(
        stripStreamingMarkdownTables(trailingText),
        toolResultBlocks,
      )
    : trailingText;
  const suppressTrailing =
    isStreaming &&
    postToolTrailing &&
    trailingText.trim().length > 0 &&
    cleanedTrailing.trim().length === 0;

  // Content-gate pass over the whole live buffer. Only "global" actions (JSON
  // payloads, form requests, task plans) override the entire render; redundant
  // suppression stays with the precise trailing stripper above.
  const gateDecision = React.useMemo<GateDecision>(() => {
    if (!streamingContent.trim()) {
      return { action: "pass" };
    }
    return analyzeStreamingContent(streamingContent, {
      hasToolResultBlocks: toolResultBlocks.length > 0,
      toolResultIdentifiers:
        extractIdentifiersFromToolResults(toolResultBlocks),
      isAfterToolResult: toolResultBlocks.length > 0,
    });
  }, [streamingContent, toolResultBlocks]);
  const globalGate =
    isStreaming && isGlobalGateAction(gateDecision) ? gateDecision : null;

  suppressTrailingRef.current = suppressTrailing;
  postToolTrailingRef.current = postToolTrailing;
  toolResultBlocksRef.current = toolResultBlocks;
  globalGateRef.current = globalGate;

  // When the gate detects a "please provide these fields" request, surface it
  // as an interactive resource form in the approval bar (once per message).
  const resourceFormGate =
    globalGate && globalGate.action === "intercept_form" ? globalGate : null;
  const presentedFormMessageRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!onResourceFormDetected || !resourceFormGate) {
      return;
    }
    if (presentedFormMessageRef.current === message.id) {
      return;
    }
    presentedFormMessageRef.current = message.id;
    onResourceFormDetected({
      messageId: message.id,
      resourceType: resourceFormGate.resourceType,
      fields: resourceFormGate.fields,
      prefilledValues: resourceFormGate.prefilledValues,
    });
  }, [message.id, onResourceFormDetected, resourceFormGate]);

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
      <Stack spacing={compact ? 1 : 1.25} sx={{ minWidth: 0, flex: 1 }}>
        {showConnecting ? (
          <BloomStreamingIndicator connectionState={connectionState} />
        ) : null}

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
              </Typography>
            );
          })}
        </Stack>

        {globalGate ? (
          <BloomStreamingIndicator
            connectionState="streaming"
            overrideMessage={gateLoaderMessage(globalGate)}
          />
        ) : suppressTrailing ? (
          <BloomStreamingIndicator overrideMessage />
        ) : null}

        {activeToolCall && !showResearchProgress ? (
          <BloomStreamingIndicator
            connectionState="streaming"
            hasPartialText={Boolean(streamingContent)}
            toolName={activeToolCall.toolName}
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
    presentResourceForm,
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
      onResourceFormDetected={presentResourceForm}
      onSubmitPrompt={submitPrompt}
      retryPrompt={retryPrompt}
      streamState={streamState}
    />
  );
}
