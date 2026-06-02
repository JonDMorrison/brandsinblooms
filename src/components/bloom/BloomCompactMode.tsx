import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowLeft, ArrowRight, Brain, Send, Sparkles } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import { BloomAvatar } from "@/components/bloom/BloomAvatar";
import {
  BloomStreamingMessageContent,
  type BloomStreamingMessageState,
} from "@/components/bloom/BloomStreamingMessage";
import { CompactBlockRenderer } from "@/components/bloom/CompactBlockRenderer";
import type { BloomMessage, BloomMode } from "@/hooks/bloom/types";
import type { BloomStreamingConnectionState } from "@/hooks/bloom/useBloomStreaming";

type CompactPromptMode = Extract<BloomMode, "standard" | "reasoning">;

interface BloomCompactModeProps {
  activeMode: CompactPromptMode;
  connectionState: BloomStreamingConnectionState;
  draftPrompt: string;
  isStreaming: boolean;
  onBack: () => void;
  onCancelStream: () => void;
  onContinueInBloom: () => boolean;
  onDraftPromptChange: (value: string) => void;
  onModeChange: (mode: CompactPromptMode) => void;
  onSendPrompt: (prompt: string) => void;
  streamState: BloomStreamingMessageState;
  submittedPrompt: string | null;
}

const compactModes = [
  { icon: Sparkles, label: "Standard", value: "standard" as const },
  { icon: Brain, label: "Reasoning", value: "reasoning" as const },
] as const;

function statusLabel(connectionState: BloomStreamingConnectionState) {
  switch (connectionState) {
    case "connecting":
      return "Connecting";
    case "streaming":
      return "Responding";
    case "error":
      return "Needs attention";
    default:
      return "Ready";
  }
}

function createStreamingMessage(): BloomMessage {
  return {
    attachments: [],
    blockData: null,
    conversationId: "compact-bloom",
    createdAt: new Date().toISOString(),
    followUpChips: [],
    id: "compact-bloom-stream",
    isBookmarked: false,
    isCompacted: false,
    metadata: {},
    mode: "standard",
    model: null,
    role: "assistant",
    text: "",
    thinkingContent: null,
    tokensInput: null,
    tokensOutput: null,
  };
}

export function BloomCompactMode({
  activeMode,
  connectionState,
  draftPrompt,
  isStreaming,
  onBack,
  onCancelStream,
  onContinueInBloom,
  onDraftPromptChange,
  onModeChange,
  onSendPrompt,
  streamState,
  submittedPrompt,
}: BloomCompactModeProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const responseScrollRef = React.useRef<HTMLDivElement | null>(null);
  const trimmedDraft = draftPrompt.trim();
  const hasResponse =
    Boolean(streamState.streamingContent.trim()) ||
    streamState.streamingBlocks.length > 0 ||
    Boolean(streamState.streamError) ||
    connectionState === "connecting" ||
    connectionState === "streaming";
  const streamingMessage = React.useMemo(() => createStreamingMessage(), []);

  React.useEffect(() => {
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  React.useEffect(() => {
    const scrollContainer = responseScrollRef.current;

    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }, [
    connectionState,
    streamState.streamingBlocks.length,
    streamState.streamingContent,
    streamState.streamingThinking,
    submittedPrompt,
  ]);

  const submitDraft = React.useCallback(() => {
    if (!trimmedDraft || isStreaming) {
      return;
    }

    onSendPrompt(trimmedDraft);
  }, [isStreaming, onSendPrompt, trimmedDraft]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: { xs: "min(560px, calc(100vh - 48px))", md: 560 },
        maxHeight: { xs: "calc(100vh - 48px)", md: "min(76vh, 660px)" },
        overflow: "hidden",
        animation: "compactModeIn 100ms ease both",
        "@keyframes compactModeIn": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }}
      data-command-palette-compact="true"
    >
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        sx={{
          px: { xs: 1.25, sm: 1.5 },
          py: 1.25,
          borderBottom: "1px solid",
          borderBottomColor: "neutral.100",
          backgroundColor: "background.surface",
        }}
      >
        <IconButton
          aria-label="Back to command palette"
          color="neutral"
          onClick={onBack}
          size="sm"
          variant="plain"
        >
          <ArrowLeft size={16} strokeWidth={1.9} />
        </IconButton>
        <BloomAvatar
          size="sm"
          animate={
            connectionState === "connecting" || connectionState === "streaming"
          }
        />
        <Stack spacing={0.125} sx={{ minWidth: 0, flex: 1 }}>
          <Typography level="title-sm" noWrap sx={{ color: "neutral.900" }}>
            Ask Bloom
          </Typography>
          <Typography level="body-xs" noWrap sx={{ color: "neutral.500" }}>
            {statusLabel(connectionState)}
          </Typography>
        </Stack>
        <JoyButton
          color="neutral"
          endDecorator={<ArrowRight size={14} strokeWidth={1.9} />}
          onClick={onContinueInBloom}
          size="sm"
          variant="outlined"
          sx={{ display: { xs: "none", sm: "inline-flex" }, flexShrink: 0 }}
        >
          Continue in Bloom
        </JoyButton>
      </Stack>

      <Box
        ref={responseScrollRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: { xs: 1.25, sm: 1.5 },
          py: 1.5,
          backgroundColor: "background.surface",
        }}
      >
        <Stack spacing={1.25}>
          {submittedPrompt ? (
            <Sheet
              variant="soft"
              color="neutral"
              sx={{
                alignSelf: "flex-end",
                maxWidth: "88%",
                borderRadius: "var(--joy-radius-lg)",
                backgroundColor: "background.level1",
                px: 1.25,
                py: 1,
              }}
            >
              <Typography
                level="body-xs"
                sx={{
                  color: "neutral.800",
                  lineHeight: 1.6,
                  overflowWrap: "anywhere",
                }}
              >
                {submittedPrompt}
              </Typography>
            </Sheet>
          ) : null}

          {hasResponse ? (
            <BloomStreamingMessageContent
              compact
              message={streamingMessage}
              onCancelStream={onCancelStream}
              onSubmitPrompt={onSendPrompt}
              renderBlock={(block) => (
                <CompactBlockRenderer
                  blockType={block.blockType}
                  payload={block.payload}
                  onContinueInBloom={onContinueInBloom}
                />
              )}
              retryPrompt={submittedPrompt}
              showAvatar={false}
              streamState={streamState}
            />
          ) : null}
        </Stack>
      </Box>

      <Sheet
        variant="plain"
        sx={{
          borderTop: "1px solid",
          borderTopColor: "neutral.100",
          backgroundColor: "background.surface",
          px: { xs: 1.25, sm: 1.5 },
          py: 1.25,
        }}
      >
        <Stack spacing={1}>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack
              direction="row"
              spacing={0.5}
              role="group"
              aria-label="Bloom mode"
            >
              {compactModes.map(({ icon: ModeIcon, label, value }) => {
                const isActive = activeMode === value;

                return (
                  <JoyButton
                    key={value}
                    aria-pressed={isActive}
                    color="neutral"
                    onClick={() => onModeChange(value)}
                    size="sm"
                    startDecorator={<ModeIcon size={14} strokeWidth={1.9} />}
                    variant={isActive ? "outlined" : "plain"}
                    sx={{ minHeight: 30, px: 1 }}
                  >
                    {label}
                  </JoyButton>
                );
              })}
            </Stack>
            <JoyButton
              color="neutral"
              endDecorator={<ArrowRight size={14} strokeWidth={1.9} />}
              onClick={onContinueInBloom}
              size="sm"
              variant="plain"
              sx={{
                display: { xs: "inline-flex", sm: "none" },
                minHeight: 30,
                px: 1,
              }}
            >
              Bloom
            </JoyButton>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="flex-end">
            <JoyTextarea
              ref={textareaRef}
              aria-label="Ask Bloom"
              minRows={2}
              maxRows={4}
              value={draftPrompt}
              onValueChange={onDraftPromptChange}
              onKeyDown={(event) => {
                event.stopPropagation();

                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitDraft();
                }
              }}
              placeholder="Ask Bloom..."
              sx={{
                minHeight: 72,
                "& .MuiTextarea-textarea": {
                  minHeight: 72,
                },
              }}
            />
            <JoyButton
              aria-label="Send to Bloom"
              color="primary"
              disabled={!trimmedDraft || isStreaming}
              onClick={submitDraft}
              size="sm"
              variant="solid"
              sx={{ minHeight: 40, minWidth: 40, px: 1.25 }}
            >
              <Send size={16} strokeWidth={1.9} />
            </JoyButton>
          </Stack>
        </Stack>
      </Sheet>
    </Box>
  );
}
