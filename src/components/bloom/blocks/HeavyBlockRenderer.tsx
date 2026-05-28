import * as React from "react";
import Stack from "@mui/joy/Stack";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import BloomCodeBlock from "@/components/bloom/BloomCodeBlock";
import { useBloom } from "@/components/bloom/BloomContext";
import {
  ChartBlock,
  normalizeChartPayload,
} from "@/components/bloom/blocks/ChartBlock";
import { DataTableBlock } from "@/components/bloom/blocks/DataTableBlock";
import {
  ImageBlock,
  normalizeImagePayload,
} from "@/components/bloom/blocks/ImageBlock";
import { ResearchProgressBlock } from "@/components/bloom/blocks/ResearchProgressBlock";
import { normalizeResearchProgressPayload } from "@/components/bloom/blocks/researchProgressPayload";
import type { BloomBlockActionContext } from "@/components/bloom/blocks/blockTypes";
import {
  defaultColumnsForEntity,
  inferEntityType,
  isRecord,
  normalizeColumns,
  readNumber,
  readString,
  rowsFromValue,
} from "@/components/bloom/blocks/blockUtils";
import { TaskExecutionProgress } from "@/components/bloom/task-plan/TaskExecutionProgress";
import { TaskPlanBlock } from "@/components/bloom/task-plan/TaskPlanBlock";
import { parseBloomTaskPlan } from "@/hooks/bloom/taskPlanTypes";

export type HeavyBlockType =
  | "chart"
  | "code"
  | "data_table"
  | "image"
  | "research_progress"
  | "task_plan";

export interface HeavyBlockRendererProps {
  blockType: HeavyBlockType;
  payload: unknown;
  onAction: (action: string, context: BloomBlockActionContext) => void;
}

function fallbackPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return "Unable to render this block payload.";
  }
}

function HeavyFallbackBlock({
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

function readCodePayload(payload: unknown) {
  const source = isRecord(payload) ? payload : {};
  const code = isRecord(payload)
    ? (readString(source.code) ??
      readString(source.content) ??
      readString(source.text) ??
      readString(source.markdown) ??
      readString(source.data))
    : readString(payload);

  if (!code) {
    return null;
  }

  const language = isRecord(payload)
    ? (readString(source.language) ?? readString(source.lang))
    : null;
  const className = isRecord(payload)
    ? (readString(source.className) ?? readString(source.class_name))
    : null;

  return {
    className: className ?? (language ? `language-${language}` : undefined),
    code,
    language,
  };
}

function readDataTablePayload(payload: unknown) {
  const source = isRecord(payload) ? payload : {};
  const nestedData = source.data;
  const dataRecord = isRecord(nestedData) ? nestedData : null;
  const rows = rowsFromValue(
    source.rows ?? dataRecord?.rows ?? source.data ?? payload,
  );
  const firstRow = rows[0] ?? null;
  const entityType = inferEntityType(
    source.entity_type ?? source.entityType ?? dataRecord?.entity_type,
    firstRow,
  );
  const columns = normalizeColumns(source.columns ?? dataRecord?.columns);
  const totalCount =
    readNumber(source.totalCount) ??
    readNumber(source.total_count) ??
    readNumber(source.count) ??
    readNumber(dataRecord?.total_count) ??
    rows.length;
  const page = readNumber(source.page) ?? readNumber(dataRecord?.page) ?? 1;
  const pageSize =
    readNumber(source.pageSize) ??
    readNumber(source.page_size) ??
    readNumber(dataRecord?.page_size) ??
    10;

  return {
    columns:
      columns.length > 0 ? columns : defaultColumnsForEntity(entityType, rows),
    entityType,
    page,
    pageSize,
    rows,
    totalCount,
  };
}

function TaskPlanRenderer({ payload }: { payload: unknown }) {
  const {
    approveTaskPlan,
    cancelTaskPlan,
    getTaskCompletionSummary,
    getTaskStatuses,
    isTaskPlanExecuting,
    retryTaskPlan,
    sendMessage,
  } = useBloom();
  const plan = parseBloomTaskPlan(payload);

  if (!plan) {
    return <HeavyFallbackBlock blockType="task_plan" payload={payload} />;
  }

  const taskStatuses = getTaskStatuses(plan.planId);
  const completionSummary = getTaskCompletionSummary(plan.planId);
  const isExecuting = isTaskPlanExecuting(plan.planId);

  const submitDiscussion = (question: string) => {
    void sendMessage(question).catch(() => undefined);
  };

  return (
    <Stack spacing={1}>
      <TaskPlanBlock
        compact={plan.compact}
        isExecuting={isExecuting}
        onApprove={(approvedTaskIds, editedFields) => {
          void approveTaskPlan(plan, approvedTaskIds, editedFields).catch(
            () => undefined,
          );
        }}
        onCancel={() => cancelTaskPlan(plan.planId)}
        onDiscuss={submitDiscussion}
        plan={plan}
      />
      {isExecuting || completionSummary ? (
        <TaskExecutionProgress
          completionSummary={completionSummary}
          onRetry={(taskId) => {
            void retryTaskPlan(plan, taskId).catch(() => undefined);
          }}
          plan={plan}
          taskStatuses={taskStatuses}
        />
      ) : null}
    </Stack>
  );
}

export default function HeavyBlockRenderer({
  blockType,
  onAction,
  payload,
}: HeavyBlockRendererProps) {
  switch (blockType) {
    case "data_table": {
      const tablePayload = readDataTablePayload(payload);
      return (
        <DataTableBlock
          columns={tablePayload.columns}
          entityType={tablePayload.entityType}
          page={tablePayload.page}
          pageSize={tablePayload.pageSize}
          rows={tablePayload.rows}
          totalCount={tablePayload.totalCount}
          onAction={(prompt) =>
            onAction(prompt, {
              blockType,
              entityType: tablePayload.entityType,
            })
          }
          onPageChange={(page) =>
            onAction(
              `Show me page ${page} of these ${tablePayload.entityType} results`,
              {
                blockType,
                entityType: tablePayload.entityType,
                page,
              },
            )
          }
          onSort={(key, direction) =>
            onAction("", {
              blockType,
              entityType: tablePayload.entityType,
              sortKey: key,
              sortDirection: direction,
            })
          }
        />
      );
    }
    case "task_plan":
      return <TaskPlanRenderer payload={payload} />;
    case "code": {
      const codePayload = readCodePayload(payload);
      return codePayload ? (
        <BloomCodeBlock
          className={codePayload.className}
          code={codePayload.code}
          language={codePayload.language}
        />
      ) : (
        <HeavyFallbackBlock blockType={blockType} payload={payload} />
      );
    }
    case "research_progress": {
      const researchPayload = normalizeResearchProgressPayload(payload);
      return researchPayload ? (
        <ResearchProgressBlock {...researchPayload} />
      ) : (
        <HeavyFallbackBlock blockType={blockType} payload={payload} />
      );
    }
    case "chart": {
      const chartPayload = normalizeChartPayload(payload);
      return chartPayload ? (
        <ChartBlock {...chartPayload} />
      ) : (
        <HeavyFallbackBlock blockType={blockType} payload={payload} />
      );
    }
    case "image": {
      const imagePayload = normalizeImagePayload(payload);
      return imagePayload ? (
        <ImageBlock
          {...imagePayload}
          onAction={(prompt) => onAction(prompt, { blockType })}
        />
      ) : (
        <HeavyFallbackBlock blockType={blockType} payload={payload} />
      );
    }
    default:
      return <HeavyFallbackBlock blockType={blockType} payload={payload} />;
  }
}
