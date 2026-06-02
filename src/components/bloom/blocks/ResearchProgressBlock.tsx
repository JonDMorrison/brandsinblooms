import * as React from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Circle,
  Microscope,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { JoyCard } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";

export type ResearchStepStatus =
  | "pending"
  | "executing"
  | "completed"
  | "failed";

export type ResearchProgressPlan = {
  totalSteps: number;
  stepLabels: string[];
};

export type ResearchProgressStep = {
  status: ResearchStepStatus;
  toolName: string;
  label: string;
  startedAt?: string;
  updatedAt?: string;
};

export interface ResearchProgressBlockProps {
  plan: ResearchProgressPlan;
  stepStatuses: Map<number, ResearchProgressStep>;
  isSynthesizing: boolean;
  isComplete: boolean;
}

export type ResearchProgressPayload = {
  plan: ResearchProgressPlan;
  steps: Array<ResearchProgressStep & { stepNumber: number }>;
  isSynthesizing: boolean;
  isComplete: boolean;
};

const statusLabels: Record<ResearchStepStatus, string> = {
  pending: "pending",
  executing: "executing",
  completed: "completed",
  failed: "failed",
};

const statusTextColor: Record<ResearchStepStatus, string> = {
  pending: "neutral.400",
  executing: "neutral.800",
  completed: "neutral.500",
  failed: "danger.500",
};

const MotionListItem = motion.create(ListItem);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readInteger(value: unknown): number | null {
  const number = readNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function readBoolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function isResearchStepStatus(value: unknown): value is ResearchStepStatus {
  return (
    value === "pending" ||
    value === "executing" ||
    value === "completed" ||
    value === "failed"
  );
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(1, Math.round(milliseconds / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds} ${totalSeconds === 1 ? "second" : "seconds"}`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function timestampMs(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function statusColor(status: ResearchStepStatus) {
  if (status === "failed") {
    return "danger" as const;
  }

  if (status === "completed") {
    return "success" as const;
  }

  if (status === "executing") {
    return "primary" as const;
  }

  return "neutral" as const;
}

function fallbackStepLabel(stepNumber: number) {
  return `Research step ${stepNumber}`;
}

function normalizePlan(value: unknown): ResearchProgressPlan {
  const source = isRecord(value) ? value : {};
  const totalSteps = Math.max(
    0,
    readInteger(source.totalSteps) ?? readInteger(source.total_steps) ?? 0,
  );
  const rawStepLabels = source.stepLabels ?? source.step_labels;
  const stepLabels = Array.isArray(rawStepLabels)
    ? rawStepLabels.map((label) => readString(label) ?? "")
    : [];

  return { totalSteps, stepLabels };
}

function normalizeStepEntry(
  item: unknown,
  fallbackStepNumber?: number,
): [number, ResearchProgressStep] | null {
  if (!isRecord(item)) {
    return null;
  }

  const stepNumber =
    readInteger(item.stepNumber) ??
    readInteger(item.step_number) ??
    fallbackStepNumber ??
    null;
  const status = readString(item.status);
  const label = readString(item.label);
  if (
    stepNumber === null ||
    stepNumber <= 0 ||
    !isResearchStepStatus(status) ||
    !label
  ) {
    return null;
  }

  return [
    stepNumber,
    {
      status,
      toolName: readString(item.toolName) ?? readString(item.tool_name) ?? "",
      label,
      startedAt:
        readString(item.startedAt) ?? readString(item.started_at) ?? undefined,
      updatedAt:
        readString(item.updatedAt) ?? readString(item.updated_at) ?? undefined,
    },
  ];
}

function normalizeSteps(value: unknown): Map<number, ResearchProgressStep> {
  const steps = new Map<number, ResearchProgressStep>();
  if (value instanceof Map) {
    value.forEach((item, stepNumber) => {
      const normalizedEntry = normalizeStepEntry(
        item,
        typeof stepNumber === "number" ? stepNumber : undefined,
      );
      if (normalizedEntry) {
        steps.set(normalizedEntry[0], normalizedEntry[1]);
      }
    });
    return steps;
  }

  if (!Array.isArray(value)) {
    if (isRecord(value)) {
      Object.entries(value).forEach(([stepNumberKey, item]) => {
        const parsedStepNumber = Number(stepNumberKey);
        const normalizedEntry = normalizeStepEntry(
          item,
          Number.isInteger(parsedStepNumber) ? parsedStepNumber : undefined,
        );
        if (normalizedEntry) {
          steps.set(normalizedEntry[0], normalizedEntry[1]);
        }
      });
    }
    return steps;
  }

  value.forEach((item) => {
    const normalizedEntry = normalizeStepEntry(item);
    if (normalizedEntry) {
      steps.set(normalizedEntry[0], normalizedEntry[1]);
    }
  });

  return steps;
}

export function createResearchProgressPayload({
  isComplete,
  isSynthesizing,
  plan,
  stepStatuses,
}: ResearchProgressBlockProps): ResearchProgressPayload {
  return {
    plan,
    steps: Array.from(stepStatuses.entries())
      .sort(
        ([leftStepNumber], [rightStepNumber]) =>
          leftStepNumber - rightStepNumber,
      )
      .map(([stepNumber, step]) => ({
        ...step,
        stepNumber,
      })),
    isSynthesizing,
    isComplete,
  };
}

export function normalizeResearchProgressPayload(
  payload: unknown,
): ResearchProgressBlockProps | null {
  if (!isRecord(payload)) {
    return null;
  }

  const plan = normalizePlan(payload.plan);
  const stepStatuses = normalizeSteps(
    payload.steps ?? payload.stepStatuses ?? payload.step_statuses,
  );
  if (plan.totalSteps === 0 && stepStatuses.size === 0) {
    return null;
  }

  return {
    plan,
    stepStatuses,
    isSynthesizing: readBoolean(payload.isSynthesizing),
    isComplete: readBoolean(payload.isComplete),
  };
}

function StatusIndicator({ status }: { status: ResearchStepStatus }) {
  const reducedMotion = useBloomReducedMotion();
  let indicator: React.ReactNode;

  if (status === "executing") {
    indicator = reducedMotion ? (
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: 999,
          backgroundColor: "primary.500",
        }}
      />
    ) : (
      <CircularProgress
        aria-label="Executing"
        color="primary"
        size="sm"
        thickness={3}
        sx={{ "--CircularProgress-size": "16px" }}
      />
    );
  } else if (status === "completed") {
    indicator = (
      <Box sx={{ color: "success.500", display: "inline-flex" }}>
        <CheckCircle aria-label="Completed" size={16} strokeWidth={1.9} />
      </Box>
    );
  } else if (status === "failed") {
    indicator = (
      <Box sx={{ color: "danger.500", display: "inline-flex" }}>
        <XCircle aria-label="Failed" size={16} strokeWidth={1.9} />
      </Box>
    );
  } else {
    indicator = (
      <Box sx={{ color: "neutral.300", display: "inline-flex" }}>
        <Circle aria-label="Pending" size={15} strokeWidth={1.8} />
      </Box>
    );
  }

  if (reducedMotion) {
    return <Box sx={{ display: "inline-flex" }}>{indicator}</Box>;
  }

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.span
        key={status}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.12 }}
        style={{ display: "inline-flex" }}
      >
        {indicator}
      </motion.span>
    </AnimatePresence>
  );
}

function ResearchStepRow({
  label,
  stepNumber,
  status,
}: {
  label: string;
  stepNumber: number;
  status: ResearchStepStatus;
}) {
  const reducedMotion = useBloomReducedMotion();

  const rowSx = {
    px: 0,
    py: 0.5,
    gap: 1,
    alignItems: "center",
    transition: reducedMotion ? "none" : "color 150ms ease, opacity 150ms ease",
  } as const;

  if (reducedMotion) {
    return (
      <ListItem sx={rowSx}>
        <Box
          sx={{
            width: 24,
            display: "flex",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <StatusIndicator status={status} />
        </Box>
        <Typography
          level="body-sm"
          sx={{
            color: statusTextColor[status],
            flex: 1,
            minWidth: 0,
            overflowWrap: "anywhere",
          }}
        >
          <Box component="span" sx={{ fontWeight: 700 }}>
            {stepNumber}.
          </Box>{" "}
          {label}
        </Typography>
        <Typography
          level="body-xs"
          color={statusColor(status)}
          sx={{ flexShrink: 0, textTransform: "capitalize" }}
        >
          {statusLabels[status]}
        </Typography>
      </ListItem>
    );
  }

  return (
    <MotionListItem
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.15 }}
      sx={rowSx}
    >
      <Box
        sx={{
          width: 24,
          display: "flex",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <StatusIndicator status={status} />
      </Box>
      <Typography
        level="body-sm"
        sx={{
          color: statusTextColor[status],
          flex: 1,
          minWidth: 0,
          overflowWrap: "anywhere",
        }}
      >
        <Box component="span" sx={{ fontWeight: 700 }}>
          {stepNumber}.
        </Box>{" "}
        {label}
      </Typography>
      <Typography
        level="body-xs"
        color={statusColor(status)}
        sx={{ flexShrink: 0, textTransform: "capitalize" }}
      >
        {statusLabels[status]}
      </Typography>
    </MotionListItem>
  );
}

export function ResearchProgressBlock({
  isComplete,
  isSynthesizing,
  plan,
  stepStatuses,
}: ResearchProgressBlockProps) {
  const reducedMotion = useBloomReducedMotion();
  const previousCompleteRef = React.useRef(isComplete);
  const firstRenderedAtRef = React.useRef<number | null>(null);
  const completedAtRef = React.useRef<number | null>(null);
  const [expanded, setExpanded] = React.useState(!isComplete);

  const steps = React.useMemo(() => {
    const highestSeenStep = Math.max(0, ...stepStatuses.keys());
    const totalSteps = Math.max(plan.totalSteps, highestSeenStep);
    const shouldFinalizePendingSteps = isComplete || isSynthesizing;

    return Array.from({ length: totalSteps }, (_item, index) => {
      const stepNumber = index + 1;
      const liveStep = stepStatuses.get(stepNumber);
      return {
        stepNumber,
        status:
          liveStep?.status ??
          (shouldFinalizePendingSteps ? "completed" : "pending"),
        label:
          liveStep?.label ||
          plan.stepLabels[index] ||
          fallbackStepLabel(stepNumber),
        toolName: liveStep?.toolName ?? "",
        startedAt: liveStep?.startedAt,
        updatedAt: liveStep?.updatedAt,
      } satisfies ResearchProgressStep & { stepNumber: number };
    });
  }, [
    isComplete,
    isSynthesizing,
    plan.stepLabels,
    plan.totalSteps,
    stepStatuses,
  ]);

  React.useEffect(() => {
    if (steps.length > 0 && firstRenderedAtRef.current === null) {
      firstRenderedAtRef.current = Date.now();
    }

    if (isComplete && !previousCompleteRef.current) {
      completedAtRef.current = Date.now();
      setExpanded(false);
    } else if (!isComplete) {
      completedAtRef.current = null;
      setExpanded(true);
    }

    previousCompleteRef.current = isComplete;
  }, [isComplete, steps.length]);

  if (steps.length === 0) {
    return null;
  }

  const completedCount = steps.filter(
    (step) => step.status === "completed",
  ).length;
  const failedCount = steps.filter((step) => step.status === "failed").length;
  const activeCount = steps.filter((step) => step.status !== "pending").length;
  const totalSteps = steps.length;
  const startedTimes = steps
    .map((step) => timestampMs(step.startedAt))
    .filter((time): time is number => time !== null);
  const updatedTimes = steps
    .map((step) => timestampMs(step.updatedAt))
    .filter((time): time is number => time !== null);
  const firstStepAt =
    startedTimes.length > 0
      ? Math.min(...startedTimes)
      : (firstRenderedAtRef.current ?? Date.now());
  const completedAt =
    completedAtRef.current ??
    (updatedTimes.length > 0 ? Math.max(...updatedTimes) : Date.now());
  const completionSummary =
    failedCount > 0
      ? `${completedCount} completed, ${failedCount} failed in ${formatDuration(completedAt - firstStepAt)}`
      : `${completedCount} ${completedCount === 1 ? "step" : "steps"} completed in ${formatDuration(completedAt - firstStepAt)}`;

  return (
    <JoyCard
      aria-live="polite"
      variant="outlined"
      sx={{
        borderLeft: "3px solid",
        borderLeftColor: "primary.300",
        borderColor: "neutral.200",
        borderRadius: "var(--joy-radius-md)",
        backgroundColor: "background.surface",
        p: 1.25,
        boxShadow: "none",
      }}
    >
      <Stack spacing={1}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <Box
              sx={{
                color: "neutral.600",
                display: "inline-flex",
                flexShrink: 0,
              }}
            >
              <Microscope size={15} strokeWidth={1.9} />
            </Box>
            <Typography
              level="title-sm"
              sx={{
                color: "neutral.700",
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {isComplete ? "Deep Research Complete" : "Deep Research"}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={0.5} alignItems="center">
            <JoyChip color="primary" size="sm" variant="soft">
              {Math.min(activeCount, totalSteps)} / {totalSteps}
            </JoyChip>
            {isComplete ? (
              <IconButton
                aria-label={
                  expanded ? "Collapse research steps" : "Expand research steps"
                }
                color="neutral"
                size="sm"
                variant="plain"
                onClick={() => setExpanded((current) => !current)}
                sx={{ minHeight: 28, width: 28, height: 28 }}
              >
                {expanded ? (
                  <ChevronUp size={15} strokeWidth={1.9} />
                ) : (
                  <ChevronDown size={15} strokeWidth={1.9} />
                )}
              </IconButton>
            ) : null}
          </Stack>
        </Stack>

        <Divider
          sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-100)" }}
        />

        {isComplete && !expanded ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ color: failedCount > 0 ? "danger.500" : "success.500" }}>
              {failedCount > 0 ? (
                <XCircle size={16} strokeWidth={1.9} />
              ) : (
                <CheckCircle size={16} strokeWidth={1.9} />
              )}
            </Box>
            <Typography level="body-sm" sx={{ color: "neutral.700" }}>
              {completionSummary}
            </Typography>
          </Stack>
        ) : (
          <List size="sm" sx={{ p: 0, "--List-gap": "0px" }}>
            {reducedMotion ? (
              steps.map((step) => (
                <ResearchStepRow
                  key={step.stepNumber}
                  label={step.label}
                  stepNumber={step.stepNumber}
                  status={step.status}
                />
              ))
            ) : (
              <AnimatePresence initial={false}>
                {steps.map((step) => (
                  <ResearchStepRow
                    key={step.stepNumber}
                    label={step.label}
                    stepNumber={step.stepNumber}
                    status={step.status}
                  />
                ))}
              </AnimatePresence>
            )}
          </List>
        )}

        {isSynthesizing ? (
          <Stack direction="row" spacing={0.75} alignItems="center">
            {reducedMotion ? (
              <Box sx={{ color: "primary.500", display: "inline-flex" }}>
                <Sparkles size={15} strokeWidth={1.9} />
              </Box>
            ) : (
              <motion.span
                animate={{ opacity: [0.45, 1, 0.45] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ display: "inline-flex" }}
              >
                <Box sx={{ color: "primary.500", display: "inline-flex" }}>
                  <Sparkles size={15} strokeWidth={1.9} />
                </Box>
              </motion.span>
            )}
            <Typography level="body-sm" sx={{ color: "primary.500" }}>
              Bloom is synthesizing findings...
            </Typography>
          </Stack>
        ) : null}
      </Stack>
    </JoyCard>
  );
}
