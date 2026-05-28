export type ResearchPlanParseResult = {
  totalSteps: number;
  stepLabels: string[];
};

const STEP_LINE_PATTERN =
  /^\s*(?:(\d{1,2})[.)]|step\s+(\d{1,2})\s*[:.)-])\s*(.+?)\s*$/gim;
const MAX_STEP_LABEL_CHARS = 180;

function normalizeStepLabel(value: string): string {
  const label = value.replace(/\s+/g, " ").trim();
  if (label.length <= MAX_STEP_LABEL_CHARS) {
    return label;
  }

  return `${label.slice(0, MAX_STEP_LABEL_CHARS - 3).trim()}...`;
}

export function parseResearchPlan(content: string): ResearchPlanParseResult {
  const labelsByStepNumber = new Map<number, string>();

  for (const match of content.matchAll(STEP_LINE_PATTERN)) {
    const rawStepNumber = match[1] ?? match[2];
    const stepNumber = Number(rawStepNumber);
    const label = normalizeStepLabel(match[3] ?? "");

    if (!Number.isInteger(stepNumber) || stepNumber <= 0 || !label) {
      continue;
    }

    labelsByStepNumber.set(stepNumber, label);
  }

  if (labelsByStepNumber.size === 0) {
    return { totalSteps: 0, stepLabels: [] };
  }

  const totalSteps = Math.max(...labelsByStepNumber.keys());
  return {
    totalSteps,
    stepLabels: Array.from(
      { length: totalSteps },
      (_item, index) => labelsByStepNumber.get(index + 1) ?? "",
    ),
  };
}