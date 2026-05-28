import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  CheckCircle,
  Info,
  Lightbulb,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import type {
  BloomBlockAction,
  InsightItem,
  InsightSeverity,
  JoyBlockTone,
} from "@/components/bloom/blocks/blockTypes";
import {
  formatLabel,
  isRecord,
  readString,
} from "@/components/bloom/blocks/blockUtils";

export interface InsightBlockProps {
  insights: InsightItem[];
  onAction: (prompt: string) => void;
}

const severityIcons: Record<InsightSeverity, LucideIcon> = {
  danger: AlertTriangle,
  info: Info,
  success: CheckCircle,
  warning: Lightbulb,
};

const severityTone: Record<InsightSeverity, JoyBlockTone> = {
  danger: "danger",
  info: "neutral",
  success: "success",
  warning: "warning",
};

function normalizeSeverity(value: unknown): InsightSeverity {
  const severity = readString(value)
    ?.toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (
    severity === "error" ||
    severity === "critical" ||
    severity === "high" ||
    severity === "danger"
  ) {
    return "danger";
  }
  if (severity === "warning" || severity === "medium" || severity === "risk") {
    return "warning";
  }
  if (
    severity === "success" ||
    severity === "positive" ||
    severity === "opportunity"
  ) {
    return "success";
  }
  return "info";
}

function normalizeAction(
  value: unknown,
  index: number,
): BloomBlockAction | null {
  if (typeof value === "string" && value.trim()) {
    const label = value.trim();
    return { label, prompt: label, icon: "sparkles" };
  }

  if (!isRecord(value)) {
    return null;
  }

  const label =
    readString(value.label) ?? readString(value.title) ?? `Action ${index + 1}`;
  const prompt =
    readString(value.prompt) ??
    readString(value.action_prompt) ??
    readString(value.actionPrompt) ??
    label;
  return { label, prompt, icon: readString(value.icon) ?? "sparkles" };
}

function normalizeInsightActions(
  source: Record<string, unknown>,
): BloomBlockAction[] {
  const directActions =
    source.actions ?? source.recommended_actions ?? source.recommendations;
  const actions = Array.isArray(directActions)
    ? directActions.flatMap((entry, index) => {
        const action = normalizeAction(entry, index);
        return action ? [action] : [];
      })
    : [];

  const prompt =
    readString(source.action_prompt) ??
    readString(source.actionPrompt) ??
    readString(source.prompt);
  const label =
    readString(source.action_label) ??
    readString(source.actionLabel) ??
    (prompt ? "Take Action" : null);
  if (prompt && label) {
    return [{ label, prompt, icon: "sparkles" }, ...actions];
  }

  return actions;
}

function normalizeInsight(value: unknown, index: number): InsightItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const title =
    readString(value.title) ??
    readString(value.heading) ??
    readString(value.type) ??
    readString(value.insight_type) ??
    "Insight";
  const description =
    readString(value.description) ??
    readString(value.message) ??
    readString(value.key_insight) ??
    readString(value.insight) ??
    readString(value.content);

  if (!description) {
    return null;
  }

  return {
    id: readString(value.id) ?? `insight-${index + 1}`,
    severity: normalizeSeverity(
      value.severity ?? value.status ?? value.risk_level ?? value.type,
    ),
    title: formatLabel(title),
    description,
    actions: normalizeInsightActions(value),
  };
}

export function normalizeInsightPayload(
  payload: unknown,
): Omit<InsightBlockProps, "onAction"> | null {
  const source: Record<string, unknown> = isRecord(payload) ? payload : {};
  const dataRecord = isRecord(source.data) ? source.data : null;
  const insightSource = dataRecord ?? source;
  const rawInsights = source.insights ?? dataRecord?.insights;

  const insights = Array.isArray(rawInsights)
    ? rawInsights.flatMap((entry, index) => {
        const insight = normalizeInsight(entry, index);
        return insight ? [insight] : [];
      })
    : [];

  if (insights.length > 0) {
    return { insights };
  }

  const singleInsight = normalizeInsight(insightSource, 0);
  return singleInsight ? { insights: [singleInsight] } : null;
}

function InsightCard({
  insight,
  onAction,
}: {
  insight: InsightItem;
  onAction: (prompt: string) => void;
}) {
  const Icon = severityIcons[insight.severity];
  const tone = severityTone[insight.severity];

  return (
    <JoyCard
      variant="outlined"
      sx={{
        p: 1.5,
        borderLeft: "3px solid",
        borderLeftColor: `${tone}.500`,
      }}
    >
      <Stack spacing={1.25}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="flex-start"
          justifyContent="space-between"
        >
          <Stack spacing={0.35} sx={{ minWidth: 0 }}>
            <Typography
              level="title-sm"
              sx={{ color: "neutral.900", overflowWrap: "anywhere" }}
            >
              {insight.title}
            </Typography>
            <Typography
              level="body-sm"
              sx={{
                color: "neutral.700",
                lineHeight: 1.65,
                overflowWrap: "anywhere",
              }}
            >
              {insight.description}
            </Typography>
          </Stack>
          <JoyChip
            color={tone}
            size="sm"
            variant="soft"
            startDecorator={<Icon size={13} strokeWidth={1.9} />}
            sx={{ flexShrink: 0 }}
          >
            {formatLabel(insight.severity)}
          </JoyChip>
        </Stack>

        {insight.actions.length > 0 ? (
          <>
            <Divider
              sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-100)" }}
            />
            <Stack
              direction="row"
              spacing={0.75}
              useFlexGap
              sx={{ flexWrap: "wrap" }}
            >
              {insight.actions.map((action, index) => (
                <JoyButton
                  key={`${insight.id}-${action.label}-${index}`}
                  color="neutral"
                  size="sm"
                  variant={index === 0 ? "outlined" : "plain"}
                  startDecorator={<Sparkles size={14} strokeWidth={1.9} />}
                  onClick={() => onAction(action.prompt)}
                >
                  {action.label}
                </JoyButton>
              ))}
            </Stack>
          </>
        ) : null}
      </Stack>
    </JoyCard>
  );
}

export function InsightBlock({ insights, onAction }: InsightBlockProps) {
  return (
    <Stack spacing={1}>
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} onAction={onAction} />
      ))}
    </Stack>
  );
}
