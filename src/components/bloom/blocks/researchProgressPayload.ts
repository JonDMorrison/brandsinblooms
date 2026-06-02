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
