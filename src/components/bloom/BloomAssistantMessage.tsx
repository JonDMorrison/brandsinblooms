import * as React from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import { useBloom } from "@/components/bloom/BloomContext";
import { BloomFollowUpChips } from "@/components/bloom/BloomFollowUpChips";
import {
  BloomMessageActions,
  copyBloomMessageText,
  useBloomMessageActionsVisibility,
} from "@/components/bloom/BloomMessageActions";
import { createResearchProgressPayload } from "@/components/bloom/blocks/researchProgressPayload";
import { ContentBlockRenderer } from "@/components/bloom/content/ContentBlockRenderer";
import {
  parseContentBlocks,
  type BloomContentBlock,
} from "@/components/bloom/content/parseContentBlocks";
import { JoyChip } from "@/components/joy/JoyChip";
import type {
  BloomMessage,
  BloomMode,
  MessageFeedback,
} from "@/hooks/bloom/types";
import type { Json } from "@/integrations/supabase/types";

interface BloomAssistantMessageProps {
  message: BloomMessage;
  isLatestAssistant: boolean;
  showFollowUps: boolean;
  isStreaming: boolean;
  onBookmark: (message: BloomMessage) => void;
  onFeedback: (message: BloomMessage, feedback: MessageFeedback) => void;
  onRegenerate: (message: BloomMessage) => void;
}

const getChipText = (value: Json) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const getModelPreference = (value: Json | undefined) =>
  value === "standard" || value === "pro" ? value : null;

const modeBadgeConfig: Partial<Record<BloomMode, { label: string }>> = {
  reasoning: { label: "Reasoning" },
  research: { label: "Research" },
  image: { label: "Image" },
};

export function BloomAssistantMessage({
  isLatestAssistant,
  isStreaming,
  message,
  onBookmark,
  onFeedback,
  onRegenerate,
  showFollowUps,
}: BloomAssistantMessageProps) {
  const {
    activeConversationId,
    isResearchComplete,
    isResearchSynthesizing,
    researchConversationId,
    researchPlan,
    researchSteps,
    sendMessage,
  } = useBloom();
  const actionVisibility = useBloomMessageActionsVisibility();
  const followUpChips = message.followUpChips.map(getChipText).filter(Boolean);
  const modelPreference = getModelPreference(message.metadata.model_preference);
  const modelIndicatorLabel = modelPreference ? message.model : null;
  const contentBlocks = React.useMemo(
    () => parseContentBlocks(message),
    [
      message.blockData,
      message.id,
      message.text,
      message.thinkingContent,
      message.toolExecutions,
    ],
  );
  const modeBadge = modeBadgeConfig[message.mode];
  const blockDataHasResearchProgress = contentBlocks.some(
    (block) =>
      block.type === "block" &&
      block.blockType.trim().toLowerCase() === "research_progress",
  );
  const showLiveResearchProgress =
    message.mode === "research" &&
    isLatestAssistant &&
    activeConversationId === message.conversationId &&
    researchConversationId === message.conversationId &&
    isResearchComplete &&
    !blockDataHasResearchProgress &&
    (researchPlan.totalSteps > 0 || researchSteps.size > 0);
  const liveResearchProgressBlock: BloomContentBlock[] =
    showLiveResearchProgress
      ? [
          {
            type: "block",
            id: `${message.id}-research-progress`,
            blockType: "research_progress",
            payload: createResearchProgressPayload({
              plan: researchPlan,
              stepStatuses: researchSteps,
              isSynthesizing: isResearchSynthesizing,
              isComplete: isResearchComplete,
            }),
          },
        ]
      : [];

  const handleContentAction = React.useCallback(
    (prompt: string) => {
      const trimmedPrompt = prompt.trim();
      if (trimmedPrompt) {
        void sendMessage(trimmedPrompt).catch(() => undefined);
      }
    },
    [sendMessage],
  );

  return (
    <Box
      id={message.id}
      ref={actionVisibility.rootRef}
      onPointerCancel={actionVisibility.handlePointerCancel}
      onPointerDown={actionVisibility.handlePointerDown}
      onPointerLeave={actionVisibility.handlePointerLeave}
      onPointerUp={actionVisibility.handlePointerUp}
      sx={{
        position: "relative",
        display: "flex",
        gap: 1.5,
        mb: 3,
        pr: { xs: 0, md: 5 },
        scrollMarginBlock: 96,
        "@media (hover: hover)": {
          "&:hover [data-bloom-message-actions='true'], &:focus-within [data-bloom-message-actions='true']":
            {
              opacity: 1,
              pointerEvents: "auto",
            },
          "&:hover [data-bloom-model-indicator='true'], &:focus-within [data-bloom-model-indicator='true']":
            {
              opacity: 1,
            },
        },
      }}
    >
      {modelIndicatorLabel ? (
        <Chip
          data-bloom-model-indicator="true"
          color="neutral"
          size="sm"
          variant="plain"
          sx={{
            position: "absolute",
            top: 0,
            right: { xs: 0, md: 44 },
            opacity: 0,
            pointerEvents: "none",
            transition: "opacity 160ms ease",
            color: "neutral.500",
            backgroundColor: "background.surface",
          }}
        >
          {modelIndicatorLabel}
        </Chip>
      ) : null}
      <Stack spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
        {modeBadge ? (
          <JoyChip
            color="primary"
            size="sm"
            variant="soft"
            sx={{ alignSelf: "flex-start" }}
          >
            {modeBadge.label}
          </JoyChip>
        ) : null}

        {[...liveResearchProgressBlock, ...contentBlocks].map((block) => (
          <ContentBlockRenderer
            key={block.id}
            block={block}
            onAction={handleContentAction}
            onRetry={() => onRegenerate(message)}
          />
        ))}

        <BloomFollowUpChips
          chips={followUpChips}
          isLatestMessage={showFollowUps}
          isStreaming={isStreaming}
          onChipClick={(chipText) => {
            void sendMessage(chipText).catch(() => undefined);
          }}
        />

        <BloomMessageActions
          forceVisible={actionVisibility.forceVisible}
          isLatestAssistant={isLatestAssistant}
          isStreaming={isStreaming}
          message={message}
          onBookmark={() => onBookmark(message)}
          onCopy={() => {
            void copyBloomMessageText(message.text);
          }}
          onEdit={() => undefined}
          onFeedback={(feedback) => onFeedback(message, feedback)}
          onRegenerate={() => onRegenerate(message)}
        />
      </Stack>
    </Box>
  );
}
