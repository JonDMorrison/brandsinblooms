import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { formatTaskValue } from "@/components/bloom/task-plan/TaskPlanBlock";
import type {
  BloomTaskCompletionSummary,
  BloomTaskPlan,
  BloomTaskPlanItem,
  BloomTaskPlanStatus,
} from "@/hooks/bloom/taskPlanTypes";

type TaskStatusEntry = {
  status: BloomTaskPlanStatus;
  errorMessage: string | null;
};

const PRIMARY_PARAM_KEYS = ["name", "title", "subject", "label"];

const formatRelativeTime = (iso: string | null): string | null => {
  if (!iso) {
    return null;
  }

  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const diffSeconds = Math.round((Date.now() - timestamp) / 1000);
  if (diffSeconds < 45) {
    return "just now";
  }
  if (diffSeconds < 3600) {
    return `${Math.max(1, Math.round(diffSeconds / 60))}m ago`;
  }
  if (diffSeconds < 86400) {
    return `${Math.round(diffSeconds / 3600)}h ago`;
  }
  if (diffSeconds < 604800) {
    return `${Math.round(diffSeconds / 86400)}d ago`;
  }

  return new Date(timestamp).toLocaleDateString();
};

const primaryParamValue = (task: BloomTaskPlanItem): string | null => {
  if (task.entityName?.trim()) {
    return task.entityName.trim();
  }

  for (const key of PRIMARY_PARAM_KEYS) {
    const value = task.toolParams[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  for (const value of Object.values(task.toolParams)) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const humanizeFieldKey = (key: string) =>
  key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());

interface BloomApprovalSummaryCardProps {
  plan: BloomTaskPlan;
  status: "approved" | "cancelled";
  approvedTaskIds: string[] | null;
  at: string | null;
}

export function BloomApprovalSummaryCard({
  plan,
  status,
  approvedTaskIds,
  at,
}: BloomApprovalSummaryCardProps) {
  const approved = status === "approved";
  const approvedSet =
    approvedTaskIds && approvedTaskIds.length > 0
      ? new Set(approvedTaskIds)
      : null;
  const listedTasks = approved
    ? approvedSet
      ? plan.tasks.filter((task) => approvedSet.has(task.taskId))
      : plan.tasks
    : plan.tasks;
  const count = listedTasks.length;
  const relativeTime = formatRelativeTime(at);

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: approved
          ? "success.outlinedBorder"
          : "neutral.outlinedBorder",
        borderRadius: "md",
        p: "12px 16px",
        maxWidth: "85%",
        backgroundColor: approved ? "success.softBg" : "background.surface",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box
          sx={{
            display: "inline-flex",
            color: approved ? "success.plainColor" : "neutral.plainColor",
          }}
        >
          {approved ? (
            <CheckCircle2 size={16} aria-hidden />
          ) : (
            <XCircle size={16} aria-hidden />
          )}
        </Box>
        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
          {approved
            ? `You approved ${count} ${count === 1 ? "action" : "actions"}`
            : "You cancelled the task plan"}
        </Typography>
      </Stack>

      <Stack sx={{ pl: "28px", mt: "6px" }} direction="column" spacing="2px">
        {listedTasks.map((task) => {
          const value = primaryParamValue(task);
          return (
            <Typography
              key={task.taskId}
              level="body-xs"
              sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
            >
              {approved
                ? `• ${task.toolName}${value ? ` — "${value}"` : ""}`
                : `• ${task.toolName} was not executed`}
            </Typography>
          );
        })}
      </Stack>

      {relativeTime ? (
        <Typography
          level="body-xs"
          sx={{
            mt: "8px",
            pl: "28px",
            color: "text.tertiary",
            fontStyle: "italic",
          }}
        >
          {approved ? "Approved" : "Cancelled"} {relativeTime}
        </Typography>
      ) : null}
    </Box>
  );
}

interface ExecutionResultRowProps {
  task: BloomTaskPlanItem;
  status: BloomTaskPlanStatus;
  errorMessage: string | null;
  expanded: boolean;
  onToggle: () => void;
  onRetry: (taskId: string) => void;
}

function ExecutionResultRow({
  task,
  status,
  errorMessage,
  expanded,
  onToggle,
  onRetry,
}: ExecutionResultRowProps) {
  const failed = status === "failed";
  const completed = status === "completed";
  const value = primaryParamValue(task);
  const paramEntries = Object.entries(task.toolParams);

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        onClick={onToggle}
        sx={{ py: "6px", cursor: "pointer" }}
      >
        <Box
          sx={{
            display: "inline-flex",
            color: "text.tertiary",
            transition: "transform 160ms ease",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          <ChevronRight size={15} aria-hidden />
        </Box>
        <Typography
          level="body-xs"
          sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 0.75,
          }}
        >
          {task.toolName}
          {value ? ` — ${value}` : ""}
          {/* Move the status chip to the end of the description */}
          {failed ? (
            <JoyChip size="sm" variant="soft" color="danger">
              Failed
            </JoyChip>
          ) : completed ? (
            <JoyChip size="sm" variant="soft" color="success">
              Done
            </JoyChip>
          ) : (
            <JoyChip size="sm" variant="soft" color="neutral">
              {status.replace(/_/g, " ")}
            </JoyChip>
          )}
        </Typography>
      </Stack>

      {expanded ? (
        <Box
          sx={{
            backgroundColor: "background.level1",
            borderRadius: "sm",
            p: "8px 12px",
            mt: "4px",
            ml: "20px",
          }}
        >
          {failed ? (
            <Stack spacing={1}>
              <Typography
                level="body-xs"
                sx={{ color: "danger.plainColor", overflowWrap: "anywhere" }}
              >
                {errorMessage ?? "This task failed."}
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <JoyButton
                  size="sm"
                  variant="soft"
                  color="danger"
                  startDecorator={<RotateCcw size={14} aria-hidden />}
                  onClick={() => onRetry(task.taskId)}
                >
                  Retry
                </JoyButton>
              </Box>
            </Stack>
          ) : paramEntries.length > 0 ? (
            <Stack spacing={0.5}>
              {paramEntries.map(([key, paramValue]) => (
                <Stack
                  key={key}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "flex-start" }}
                >
                  <Typography
                    level="body-xs"
                    sx={{
                      color: "text.tertiary",
                      fontWeight: 600,
                      minWidth: 120,
                      flexShrink: 0,
                    }}
                  >
                    {humanizeFieldKey(key)}
                  </Typography>
                  <Typography
                    level="body-xs"
                    sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
                  >
                    {formatTaskValue(paramValue ?? null)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
              No additional details.
            </Typography>
          )}
        </Box>
      ) : null}
    </Box>
  );
}

interface BloomExecutionResultCardProps {
  plan: BloomTaskPlan;
  statuses: Map<string, TaskStatusEntry>;
  summary: BloomTaskCompletionSummary | null;
  onRetry: (taskId: string) => void;
}

export function BloomExecutionResultCard({
  plan,
  statuses,
  summary,
  onRetry,
}: BloomExecutionResultCardProps) {
  const rows = plan.tasks
    .map((task) => {
      const entry = statuses.get(task.taskId);
      const status = entry?.status ?? task.status;
      return {
        task,
        status,
        errorMessage: entry?.errorMessage ?? task.errorMessage,
      };
    })
    .filter((row) => row.status !== "skipped");

  const [expandedTaskIds, setExpandedTaskIds] = React.useState<Set<string>>(
    () =>
      new Set(
        rows
          .filter((row) => row.status === "failed")
          .map((row) => row.task.taskId),
      ),
  );

  const completedCount =
    summary?.completed ??
    rows.filter((row) => row.status === "completed").length;
  const failedCount =
    summary?.failed ?? rows.filter((row) => row.status === "failed").length;
  const allSucceeded = failedCount === 0;

  const toggle = (taskId: string) => {
    setExpandedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  if (rows.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: allSucceeded
          ? "success.outlinedBorder"
          : "warning.outlinedBorder",
        borderRadius: "md",
        p: "12px 16px",
        maxWidth: "85%",
        backgroundColor: "background.surface",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Box
          sx={{
            display: "inline-flex",
            color: allSucceeded ? "success.plainColor" : "warning.plainColor",
          }}
        >
          {allSucceeded ? (
            <CheckCircle2 size={16} aria-hidden />
          ) : (
            <AlertTriangle size={16} aria-hidden />
          )}
        </Box>
        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
          Task complete: {completedCount} completed, {failedCount} failed
        </Typography>
      </Stack>

      <Stack spacing={0}>
        {rows.map((row) => (
          <ExecutionResultRow
            key={row.task.taskId}
            task={row.task}
            status={row.status}
            errorMessage={row.errorMessage}
            expanded={expandedTaskIds.has(row.task.taskId)}
            onToggle={() => toggle(row.task.taskId)}
            onRetry={onRetry}
          />
        ))}
      </Stack>
    </Box>
  );
}
