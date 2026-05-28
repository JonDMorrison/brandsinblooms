import * as React from "react";
import Stack from "@mui/joy/Stack";
import Skeleton from "@mui/joy/Skeleton";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import { motion } from "framer-motion";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { BloomMarkdown } from "@/components/bloom/BloomMarkdown";
import {
  ConfirmationBlock,
  normalizeConfirmationPayload,
} from "@/components/bloom/blocks/ConfirmationBlock";
import {
  ContentBlock,
  normalizeContentPayload,
} from "@/components/bloom/blocks/ContentBlock";
import { DataCardBlock } from "@/components/bloom/blocks/DataCardBlock";
import {
  InsightBlock,
  normalizeInsightPayload,
} from "@/components/bloom/blocks/InsightBlock";
import {
  InteractionBlock,
  normalizeInteractionPayload,
} from "@/components/bloom/blocks/InteractionBlock";
import {
  NavigationBlock,
  normalizeNavigationPayload,
} from "@/components/bloom/blocks/NavigationBlock";
import {
  StatCardBlock,
  normalizeStatCardPayload,
} from "@/components/bloom/blocks/StatCardBlock";
import { ThinkingBlock } from "@/components/bloom/blocks/ThinkingBlock";
import type { BloomBlockActionContext } from "@/components/bloom/blocks/blockTypes";
import {
  defaultColumnsForEntity,
  formatLabel,
  inferEntityType,
  isDataCardEntityType,
  isRecord,
  normalizeActions,
  normalizeColumns,
  readNumber,
  readString,
} from "@/components/bloom/blocks/blockUtils";
import type { HeavyBlockType } from "@/components/bloom/blocks/HeavyBlockRenderer";

const LazyHeavyBlockRenderer = React.lazy(
  () => import("@/components/bloom/blocks/HeavyBlockRenderer"),
);

export interface BlockRendererProps {
  blockType: string;
  payload: unknown;
  onAction: (action: string, context: BloomBlockActionContext) => void;
}

const heavyBlockFallbackHeight: Record<HeavyBlockType, number> = {
  chart: 200,
  code: 140,
  data_table: 200,
  image: 260,
  research_progress: 140,
  task_plan: 200,
};

function fallbackPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return "Unable to render this block payload.";
  }
}

function FallbackBlock({
  blockType,
  payload,
}: {
  blockType: string;
  payload: unknown;
}) {
  return (
    <Sheet
      variant="soft"
      color="neutral"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        p: 1.5,
        backgroundColor: "background.level1",
      }}
    >
      <Stack spacing={0.75}>
        <Typography
          level="body-xs"
          sx={{ color: "neutral.500", fontWeight: 600 }}
        >
          {blockType || "Unsupported block"}
        </Typography>
        <Typography
          component="pre"
          level="body-xs"
          sx={{
            color: "neutral.700",
            m: 0,
            maxHeight: 260,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontFamily: "var(--joy-fontFamily-code)",
          }}
        >
          {fallbackPayload(payload)}
        </Typography>
      </Stack>
    </Sheet>
  );
}

function UnknownBlockFallback({
  blockType,
  onAction,
  payload,
}: {
  blockType: string;
  onAction: (action: string, context: BloomBlockActionContext) => void;
  payload: unknown;
}) {
  return (
    <Stack spacing={0.75}>
      <Typography
        level="body-xs"
        sx={{ color: "neutral.500", fontWeight: 600 }}
      >
        {blockType || "Unsupported block"}
      </Typography>
      <React.Suspense fallback={<BlockSuspenseFallback blockType="code" />}>
        <LazyHeavyBlockRenderer
          blockType="code"
          onAction={onAction}
          payload={{
            code: fallbackPayload(payload),
            language: "json",
          }}
        />
      </React.Suspense>
    </Stack>
  );
}

function TextBlock({ payload }: { payload: unknown }) {
  const text = isRecord(payload)
    ? (readString(payload.text) ??
      readString(payload.content) ??
      readString(payload.markdown) ??
      readString(payload.data))
    : readString(payload);

  if (!text) {
    return <FallbackBlock blockType="text" payload={payload} />;
  }

  return <BloomMarkdown content={text} />;
}

function readThinkingPayload(payload: unknown) {
  return isRecord(payload)
    ? (readString(payload.content) ??
        readString(payload.thinking_content) ??
        readString(payload.thinkingContent) ??
        readString(payload.text) ??
        readString(payload.data))
    : readString(payload);
}

function readDataCardPayload(payload: unknown) {
  const source = isRecord(payload) ? payload : {};
  const rawEntity = source.entity ?? source.data ?? payload;
  const entity = Array.isArray(rawEntity)
    ? (rawEntity.find(isRecord) ?? null)
    : rawEntity;
  if (!isRecord(entity)) {
    return null;
  }

  const entityType = inferEntityType(
    source.entity_type ?? source.entityType,
    entity,
  );
  if (!isDataCardEntityType(entityType)) {
    return null;
  }

  return {
    entity,
    entityType,
    actions: (() => {
      const normalizedActions = normalizeActions(
        source.actions,
        entityType,
        entity,
      );
      const downloadUrl =
        readString(source.download_url) ?? readString(source.downloadUrl);
      if (!downloadUrl) {
        return normalizedActions;
      }

      const fileName =
        readString(source.file_name) ??
        readString(source.fileName) ??
        readString(entity.name);
      const format = readString(source.format);

      return [
        {
          label: format ? `Download ${formatLabel(format)}` : "Download export",
          prompt: fileName ? `Download ${fileName}` : "Download export",
          type: "download",
          url: downloadUrl,
          downloadFileName: fileName ?? undefined,
          icon: "download",
        },
        ...normalizedActions,
      ];
    })(),
  };
}

function isHeavyBlockType(blockType: string): blockType is HeavyBlockType {
  return (
    blockType === "chart" ||
    blockType === "code" ||
    blockType === "data_table" ||
    blockType === "image" ||
    blockType === "research_progress" ||
    blockType === "task_plan"
  );
}

function BlockSuspenseFallback({ blockType }: { blockType: HeavyBlockType }) {
  const minHeight = heavyBlockFallbackHeight[blockType];
  const reducedMotion = useBloomReducedMotion();

  return (
    <Sheet
      variant="outlined"
      sx={{
        p: 1.5,
        minHeight,
        borderRadius: "var(--joy-radius-lg)",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
      }}
    >
      <Stack spacing={1.25}>
        <Skeleton
          animation={reducedMotion ? false : "wave"}
          variant="text"
          sx={{ width: 120 }}
        />
        <Skeleton
          animation={reducedMotion ? false : "wave"}
          variant="rectangular"
          sx={{
            borderRadius: "var(--joy-radius-md)",
            height: Math.max(minHeight - 52, 88),
          }}
        />
      </Stack>
    </Sheet>
  );
}

function BlockContent({ blockType, onAction, payload }: BlockRendererProps) {
  const normalizedBlockType = blockType.trim().toLowerCase();

  if (isHeavyBlockType(normalizedBlockType)) {
    return (
      <React.Suspense
        fallback={<BlockSuspenseFallback blockType={normalizedBlockType} />}
      >
        <LazyHeavyBlockRenderer
          blockType={normalizedBlockType}
          onAction={onAction}
          payload={payload}
        />
      </React.Suspense>
    );
  }

  switch (normalizedBlockType) {
    case "data_card": {
      const cardPayload = readDataCardPayload(payload);
      return cardPayload ? (
        <DataCardBlock
          actions={cardPayload.actions}
          entity={cardPayload.entity}
          entityType={cardPayload.entityType}
          onAction={(prompt) =>
            onAction(prompt, {
              blockType: normalizedBlockType,
              entityType: cardPayload.entityType,
              entityId: readString(cardPayload.entity.id),
            })
          }
        />
      ) : (
        <FallbackBlock blockType={blockType} payload={payload} />
      );
    }
    case "text": {
      const contentPayload = normalizeContentPayload(payload);
      return contentPayload ? (
        <ContentBlock
          {...contentPayload}
          onAction={(prompt) =>
            onAction(prompt, { blockType: normalizedBlockType })
          }
        />
      ) : (
        <TextBlock payload={payload} />
      );
    }
    case "thinking": {
      const thinkingContent = readThinkingPayload(payload);
      return thinkingContent ? (
        <ThinkingBlock
          content={thinkingContent}
          defaultExpanded={false}
          isStreaming={false}
        />
      ) : (
        <FallbackBlock blockType={blockType} payload={payload} />
      );
    }
    case "interaction": {
      const interactionPayload = normalizeInteractionPayload(payload);
      return interactionPayload ? (
        <InteractionBlock
          {...interactionPayload}
          onSelect={(selectedValue) =>
            onAction(
              Array.isArray(selectedValue)
                ? selectedValue.join(", ")
                : selectedValue,
              {
                blockType: normalizedBlockType,
                interactionType: interactionPayload.interactionType,
              },
            )
          }
        />
      ) : (
        <FallbackBlock blockType={blockType} payload={payload} />
      );
    }
    case "stat_card": {
      const statPayload = normalizeStatCardPayload(payload);
      return statPayload ? (
        <StatCardBlock {...statPayload} />
      ) : (
        <FallbackBlock blockType={blockType} payload={payload} />
      );
    }
    case "insight": {
      const insightPayload = normalizeInsightPayload(payload);
      return insightPayload ? (
        <InsightBlock
          {...insightPayload}
          onAction={(prompt) =>
            onAction(prompt, { blockType: normalizedBlockType })
          }
        />
      ) : (
        <FallbackBlock blockType={blockType} payload={payload} />
      );
    }
    case "confirmation": {
      const confirmationPayload = normalizeConfirmationPayload(payload);
      return confirmationPayload ? (
        <ConfirmationBlock
          {...confirmationPayload}
          onAction={(prompt) =>
            onAction(prompt, { blockType: normalizedBlockType })
          }
        />
      ) : (
        <FallbackBlock blockType={blockType} payload={payload} />
      );
    }
    case "navigation": {
      const navigationPayload = normalizeNavigationPayload(payload);
      return navigationPayload ? (
        <NavigationBlock {...navigationPayload} />
      ) : (
        <FallbackBlock blockType={blockType} payload={payload} />
      );
    }
    default:
      return (
        <UnknownBlockFallback
          blockType={blockType}
          onAction={onAction}
          payload={payload}
        />
      );
  }
}

export function BlockRenderer(props: BlockRendererProps) {
  const reducedMotion = useBloomReducedMotion();

  if (reducedMotion) {
    return <BlockContent {...props} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <BlockContent {...props} />
    </motion.div>
  );
}
