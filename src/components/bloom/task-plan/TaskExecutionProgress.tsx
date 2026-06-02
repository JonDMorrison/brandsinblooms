import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { CheckCircle, Lock, MinusCircle, XCircle } from "lucide-react";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import type {
  BloomTaskCompletionSummary,
  BloomTaskPlan,
  BloomTaskPlanStatus,
} from "@/hooks/bloom/taskPlanTypes";

export interface TaskExecutionProgressProps {
  plan: BloomTaskPlan;
  taskStatuses: Map<
    string,
    {
      status: BloomTaskPlanStatus;
      error_message?: string | null;
      errorMessage?: string | null;
    }
  >;
  onRetry: (taskId: string) => void;
  completionSummary: BloomTaskCompletionSummary | null;
}

const statusLabel = (status: BloomTaskPlanStatus) =>
  status === "approved" ? "pending" : status.replace(/_/g, " ");

function StatusIndicator({ status }: { status: BloomTaskPlanStatus }) {
  const reducedMotion = useBloomReducedMotion();

  if (status === "executing") {
    if (reducedMotion) {
      return (
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: 999,
            backgroundColor: "primary.500",
          }}
        />
      );
    }

    return (
      <CircularProgress
        aria-label="Executing"
        color="primary"
        size="sm"
        thickness={3}
      />
    );
  }

  if (status === "pending" || status === "approved") {
    return (
      <CircularProgress
        aria-label="Pending"
        color="neutral"
        determinate
        size="sm"
        thickness={3}
        value={0}
      />
    );
  }

  if (status === "completed") {
    return (
      <JoyChip aria-label="Completed" color="success" size="sm" variant="soft">
        <CheckCircle size={14} />
      </JoyChip>
    );
  }

  if (status === "failed") {
    return (
      <JoyChip aria-label="Failed" color="danger" size="sm" variant="soft">
        <XCircle size={14} />
      </JoyChip>
    );
  }

  if (status === "blocked") {
    return (
      <JoyChip aria-label="Blocked" color="warning" size="sm" variant="soft">
        <Lock size={14} />
      </JoyChip>
    );
  }

  return (
    <JoyChip aria-label="Skipped" color="neutral" size="sm" variant="soft">
      <MinusCircle size={14} />
    </JoyChip>
  );
}

export function TaskExecutionProgress({
  completionSummary,
  onRetry,
  plan,
  taskStatuses,
}: TaskExecutionProgressProps) {
  const reducedMotion = useBloomReducedMotion();

  return (
    <JoyCard
      variant="plain"
      sx={{
        mt: 1,
        p: 1.5,
        backgroundColor: "background.level1",
        transition: reducedMotion
          ? "none"
          : "opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <Stack spacing={1.25}>
        <Typography level="title-sm" sx={{ color: "neutral.800" }}>
          Executing Plan
        </Typography>

        <Stack spacing={0.75}>
          {plan.tasks.map((task) => {
            const liveStatus = taskStatuses.get(task.taskId);
            const status = liveStatus?.status ?? task.status;
            const errorMessage =
              liveStatus?.errorMessage ??
              liveStatus?.error_message ??
              task.errorMessage;

            return (
              <Box key={task.taskId}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "stretch", sm: "center" }}
                  justifyContent="space-between"
                  sx={{
                    py: 0.5,
                    transition: reducedMotion ? "none" : "opacity 150ms ease",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ minWidth: 0 }}
                  >
                    <Box
                      sx={{
                        width: 32,
                        display: "flex",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <StatusIndicator status={status} />
                    </Box>
                    <Typography
                      level="body-sm"
                      sx={{ color: "neutral.800", overflowWrap: "anywhere" }}
                    >
                      {task.description}
                    </Typography>
                  </Stack>
                  <Typography
                    level="body-xs"
                    color={
                      status === "failed"
                        ? "danger"
                        : status === "completed"
                          ? "success"
                          : "neutral"
                    }
                    sx={{ flexShrink: 0, textTransform: "capitalize" }}
                  >
                    {statusLabel(status)}
                  </Typography>
                </Stack>

                {status === "failed" ? (
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    alignItems={{ xs: "stretch", sm: "center" }}
                    sx={{ pl: { xs: 0, sm: 5 }, pb: 0.75 }}
                  >
                    <Typography
                      level="body-xs"
                      color="danger"
                      sx={{ flex: 1, overflowWrap: "anywhere" }}
                    >
                      {errorMessage ?? "This task failed."}
                    </Typography>
                    <JoyButton
                      color="danger"
                      size="sm"
                      variant="outlined"
                      onClick={() => onRetry(task.taskId)}
                    >
                      Retry
                    </JoyButton>
                  </Stack>
                ) : null}
              </Box>
            );
          })}
        </Stack>

        {completionSummary ? (
          <>
            <Divider />
            <Stack
              direction="row"
              spacing={0.75}
              useFlexGap
              sx={{ flexWrap: "wrap" }}
            >
              <JoyChip color="success" size="sm" variant="soft">
                {completionSummary.completed} completed
              </JoyChip>
              <JoyChip color="neutral" size="sm" variant="soft">
                {completionSummary.skipped} skipped
              </JoyChip>
              <JoyChip
                color={completionSummary.failed > 0 ? "danger" : "neutral"}
                size="sm"
                variant="soft"
              >
                {completionSummary.failed} failed
              </JoyChip>
              {completionSummary.blocked > 0 ? (
                <JoyChip color="warning" size="sm" variant="soft">
                  {completionSummary.blocked} blocked
                </JoyChip>
              ) : null}
            </Stack>
          </>
        ) : null}
      </Stack>
    </JoyCard>
  );
}
