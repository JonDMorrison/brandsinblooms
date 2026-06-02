import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  Lock,
  MinusCircle,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import type {
  ConfirmationDetailsBlock,
  ConfirmationResultItem,
  ConfirmationResultStatus,
  ConfirmationSummary,
  JoyBlockTone,
} from "@/components/bloom/blocks/blockTypes";
import {
  formatLabel,
  formatNumberValue,
  inferEntityType,
  isRecord,
  readBoolean,
  readEntityIdFromRecord,
  readNumber,
  readString,
  routeForEntityId,
} from "@/components/bloom/blocks/blockUtils";

export interface ConfirmationBlockProps {
  summary: ConfirmationSummary | null;
  details: ConfirmationDetailsBlock | null;
  results: ConfirmationResultItem[];
  warnings: string[];
  onAction: (prompt: string) => void;
}

const statusIcons: Record<ConfirmationResultStatus, LucideIcon> = {
  blocked: Lock,
  completed: CheckCircle,
  failed: XCircle,
  pending: MinusCircle,
  skipped: MinusCircle,
};

const statusTones: Record<ConfirmationResultStatus, JoyBlockTone> = {
  blocked: "warning",
  completed: "success",
  failed: "danger",
  pending: "neutral",
  skipped: "neutral",
};

function normalizeStatus(
  value: unknown,
  fallback: ConfirmationResultStatus = "pending",
): ConfirmationResultStatus {
  const status = readString(value)?.toLowerCase();
  if (
    status === "completed" ||
    status === "failed" ||
    status === "skipped" ||
    status === "blocked" ||
    status === "pending"
  ) {
    return status;
  }
  return fallback;
}

function riskTone(value: unknown): JoyBlockTone {
  const risk = readString(value)?.toLowerCase();
  if (risk === "high") return "danger";
  if (risk === "medium") return "warning";
  if (risk === "safe") return "success";
  if (risk === "low") return "primary";
  return "neutral";
}

function entityTypeFromToolName(
  toolName: string | null,
  data: Record<string, unknown> | null,
): string {
  if (toolName?.includes("customer")) return "customer";
  if (toolName?.includes("product")) return "product";
  if (toolName?.includes("campaign")) return "campaign";
  if (toolName?.includes("segment")) return "segment";
  return inferEntityType(null, data);
}

function routeFromResult(
  toolName: string | null,
  resultPayload: Record<string, unknown> | null,
): string | null {
  const data = isRecord(resultPayload?.data) ? resultPayload.data : null;
  const entity = isRecord(data?.entity)
    ? data.entity
    : isRecord(data?.customer)
      ? data.customer
      : isRecord(data?.product)
        ? data.product
        : isRecord(data?.campaign)
          ? data.campaign
          : isRecord(data?.segment)
            ? data.segment
            : data;
  if (!entity) {
    return null;
  }

  const entityType = entityTypeFromToolName(toolName, entity);
  return routeForEntityId(entityType, readEntityIdFromRecord(entity));
}

function normalizeResult(
  value: unknown,
  index: number,
): ConfirmationResultItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const toolName = readString(value.tool_name) ?? readString(value.toolName);
  const resultPayload = isRecord(value.result) ? value.result : null;
  const status = normalizeStatus(
    value.status,
    resultPayload?.success === false ? "failed" : "completed",
  );
  const taskId = readString(value.task_id) ?? readString(value.taskId);
  const errorMessage =
    readString(value.error_message) ??
    readString(value.errorMessage) ??
    readString(resultPayload?.error);
  const message =
    errorMessage ??
    readString(resultPayload?.message) ??
    readString(value.message) ??
    `${formatLabel(toolName ?? "Task")} ${status}`;

  return {
    id: taskId ?? `result-${index + 1}`,
    taskId,
    toolName,
    status,
    message,
    errorMessage,
    route: routeFromResult(toolName, resultPayload),
    executionTimeMs:
      readNumber(value.execution_time_ms) ?? readNumber(value.executionTimeMs),
  };
}

function normalizeResults(value: unknown): ConfirmationResultItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    const result = normalizeResult(entry, index);
    return result ? [result] : [];
  });
}

function normalizeSummary(
  record: Record<string, unknown> | null,
  results: ConfirmationResultItem[],
): ConfirmationSummary | null {
  if (!record && results.length === 0) {
    return null;
  }

  const counted = results.reduce(
    (summary, result) => ({
      completed: summary.completed + (result.status === "completed" ? 1 : 0),
      skipped: summary.skipped + (result.status === "skipped" ? 1 : 0),
      failed: summary.failed + (result.status === "failed" ? 1 : 0),
      blocked: summary.blocked + (result.status === "blocked" ? 1 : 0),
    }),
    { completed: 0, skipped: 0, failed: 0, blocked: 0 },
  );

  return {
    planId: readString(record?.plan_id) ?? readString(record?.planId),
    completed:
      readNumber(record?.completed_count) ??
      readNumber(record?.completed) ??
      counted.completed,
    skipped:
      readNumber(record?.skipped_count) ??
      readNumber(record?.skipped) ??
      counted.skipped,
    failed:
      readNumber(record?.failed_count) ??
      readNumber(record?.failed) ??
      counted.failed,
    blocked:
      readNumber(record?.blocked_count) ??
      readNumber(record?.blocked) ??
      counted.blocked,
  };
}

function normalizeDetails(value: unknown): ConfirmationDetailsBlock | null {
  if (!isRecord(value)) {
    return null;
  }

  const action = readString(value.action);
  if (!action) {
    return null;
  }

  return {
    action,
    affectedCount:
      readNumber(value.affected_count) ?? readNumber(value.affectedCount),
    reversible: readBoolean(value.reversible),
    riskLevel: riskTone(value.risk_level ?? value.riskLevel),
    toolName: readString(value.tool_name) ?? readString(value.toolName),
  };
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const warning = readString(entry);
    return warning ? [warning] : [];
  });
}

export function normalizeConfirmationPayload(
  payload: unknown,
): Omit<ConfirmationBlockProps, "onAction"> | null {
  const source: Record<string, unknown> = isRecord(payload) ? payload : {};
  const dataRecord = isRecord(source.data) ? source.data : null;
  const taskComplete = isRecord(source.task_complete)
    ? source.task_complete
    : isRecord(dataRecord?.task_complete)
      ? dataRecord.task_complete
      : null;
  const summaryRecord =
    taskComplete ??
    (isRecord(source.summary)
      ? source.summary
      : isRecord(dataRecord?.summary)
        ? dataRecord.summary
        : null);
  const results = normalizeResults(
    summaryRecord?.results ?? source.results ?? dataRecord?.results,
  );
  const summary = normalizeSummary(summaryRecord, results);
  const details = normalizeDetails(
    source.confirmation_details ??
      dataRecord?.confirmation_details ??
      source.confirmationDetails ??
      dataRecord?.confirmationDetails,
  );
  const warnings = normalizeWarnings(source.warnings ?? dataRecord?.warnings);

  if (!summary && !details && results.length === 0) {
    return null;
  }

  return { details, results, summary, warnings };
}

function SummaryChips({ summary }: { summary: ConfirmationSummary }) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
      <JoyChip color="success" size="sm" variant="soft">
        {formatNumberValue(summary.completed)} completed
      </JoyChip>
      <JoyChip color="neutral" size="sm" variant="soft">
        {formatNumberValue(summary.skipped)} skipped
      </JoyChip>
      <JoyChip
        color={summary.failed > 0 ? "danger" : "neutral"}
        size="sm"
        variant="soft"
      >
        {formatNumberValue(summary.failed)} failed
      </JoyChip>
      {summary.blocked > 0 ? (
        <JoyChip color="warning" size="sm" variant="soft">
          {formatNumberValue(summary.blocked)} blocked
        </JoyChip>
      ) : null}
    </Stack>
  );
}

function ResultRow({
  onAction,
  planId,
  result,
}: {
  onAction: (prompt: string) => void;
  planId: string | null;
  result: ConfirmationResultItem;
}) {
  const navigate = useNavigate();
  const Icon = statusIcons[result.status];
  const tone = statusTones[result.status];

  return (
    <Stack spacing={0.75} sx={{ py: 0.75 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        justifyContent="space-between"
      >
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            useFlexGap
            sx={{ flexWrap: "wrap", minWidth: 0 }}
          >
            <Typography
              level="body-sm"
              sx={{ color: "neutral.800", overflowWrap: "anywhere" }}
            >
              {result.message}
            </Typography>
            <JoyChip
              color={tone}
              size="sm"
              variant="soft"
              startDecorator={<Icon size={13} strokeWidth={1.9} />}
            >
              {formatLabel(result.status)}
            </JoyChip>
          </Stack>
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            {formatLabel(result.toolName ?? "Task")}
            {result.executionTimeMs !== null
              ? ` - ${formatNumberValue(result.executionTimeMs)} ms`
              : ""}
          </Typography>
        </Stack>

        <Stack
          direction="row"
          spacing={0.75}
          justifyContent={{ xs: "flex-end", sm: "flex-start" }}
        >
          {result.route ? (
            <JoyButton
              color="neutral"
              size="sm"
              variant="plain"
              startDecorator={<Eye size={14} strokeWidth={1.9} />}
              onClick={() => navigate(result.route ?? "/dashboard")}
            >
              View
            </JoyButton>
          ) : null}
          {result.status === "failed" && result.taskId ? (
            <JoyButton
              color="danger"
              size="sm"
              variant="outlined"
              startDecorator={<RotateCcw size={14} strokeWidth={1.9} />}
              onClick={() =>
                onAction(
                  `Retry failed task ${result.taskId}${planId ? ` from plan ${planId}` : ""}`,
                )
              }
            >
              Retry
            </JoyButton>
          ) : null}
        </Stack>
      </Stack>
    </Stack>
  );
}

export function ConfirmationBlock({
  details,
  onAction,
  results,
  summary,
  warnings,
}: ConfirmationBlockProps) {
  const completeWithoutFailures =
    summary && summary.failed === 0 && summary.blocked === 0;

  return (
    <JoyCard variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1.25}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack spacing={0.35} sx={{ minWidth: 0 }}>
            <Typography level="title-sm" sx={{ color: "neutral.900" }}>
              {summary ? "Task Plan Complete" : "Confirmation Required"}
            </Typography>
            <Typography
              level="body-sm"
              sx={{ color: "neutral.600", overflowWrap: "anywhere" }}
            >
              {summary
                ? completeWithoutFailures
                  ? "Bloom finished the approved work."
                  : "Bloom finished with items that need attention."
                : (details?.action ??
                  "Bloom needs confirmation before continuing.")}
            </Typography>
          </Stack>
          {summary ? (
            <SummaryChips summary={summary} />
          ) : details ? (
            <JoyChip
              color={details.riskLevel}
              size="sm"
              variant="soft"
              startDecorator={<AlertTriangle size={13} strokeWidth={1.9} />}
            >
              {formatLabel(details.riskLevel)} risk
            </JoyChip>
          ) : null}
        </Stack>

        {details && !summary ? (
          <Stack spacing={0.75}>
            <Divider
              sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-100)" }}
            />
            <Typography
              level="body-xs"
              sx={{ color: "neutral.600", overflowWrap: "anywhere" }}
            >
              {details.affectedCount !== null
                ? `${formatNumberValue(details.affectedCount)} affected record${details.affectedCount === 1 ? "" : "s"}. `
                : ""}
              {details.reversible === null
                ? "Reversibility is unknown."
                : details.reversible
                  ? "This is marked reversible."
                  : "This is not marked reversible."}
            </Typography>
            <Stack direction="row" spacing={0.75} justifyContent="flex-end">
              <JoyButton
                color="primary"
                size="sm"
                variant="solid"
                onClick={() =>
                  onAction(`Confirm ${details.toolName ?? "this action"}`)
                }
              >
                Confirm
              </JoyButton>
              <JoyButton
                color="neutral"
                size="sm"
                variant="plain"
                onClick={() =>
                  onAction(
                    `Explain the risk for ${details.toolName ?? "this action"}`,
                  )
                }
              >
                Explain Risk
              </JoyButton>
            </Stack>
          </Stack>
        ) : null}

        {warnings.length > 0 ? (
          <Stack spacing={0.5}>
            {warnings.map((warning, index) => (
              <Typography
                key={`${warning}-${index}`}
                level="body-xs"
                color="warning"
                sx={{ overflowWrap: "anywhere" }}
              >
                {warning}
              </Typography>
            ))}
          </Stack>
        ) : null}

        {results.length > 0 ? (
          <>
            <Divider
              sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-100)" }}
            />
            <Stack spacing={0}>
              {results.map((result, index) => (
                <Stack key={result.id} spacing={0}>
                  {index > 0 ? (
                    <Divider
                      sx={{
                        "--Divider-lineColor": "var(--joy-palette-neutral-100)",
                      }}
                    />
                  ) : null}
                  <ResultRow
                    planId={summary?.planId ?? null}
                    result={result}
                    onAction={onAction}
                  />
                </Stack>
              ))}
            </Stack>
          </>
        ) : null}
      </Stack>
    </JoyCard>
  );
}
