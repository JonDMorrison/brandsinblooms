import * as React from "react";
import Box from "@mui/joy/Box";
import Skeleton from "@mui/joy/Skeleton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  AlertCircle,
  ChevronRight,
  Clock,
  EyeOff,
  Lightbulb,
  Mail,
  MessageSquare,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import type { AIInsightsData } from "@/hooks/useCustomerAIInsights";

interface AIInsightsActionsProps {
  insights: AIInsightsData | null;
  loading?: boolean;
  regenerating?: boolean;
  errorMessage?: string | null;
  onRegenerate?: () => void | Promise<void>;
}

const actionTypeIcons: Record<string, React.ElementType> = {
  sms: MessageSquare,
  email: Mail,
  schedule: Clock,
  monitor: TrendingUp,
  suppress: EyeOff,
};

const priorityConfig: Record<
  string,
  { color: "danger" | "warning" | "neutral" }
> = {
  high: { color: "danger" },
  medium: { color: "warning" },
  low: { color: "neutral" },
};

export function AIInsightsActions({
  insights,
  loading = false,
  regenerating = false,
  errorMessage,
  onRegenerate,
}: AIInsightsActionsProps) {
  const [expandedAction, setExpandedAction] = React.useState<number | null>(
    null,
  );

  if (loading && !insights) {
    return (
      <JoyCard variant="outlined">
        <JoyCardHeader
          title="AI insights & next actions"
          description="Personalized analysis and action recommendations generated from customer behavior."
        />
        <JoyCardContent>
          <Stack spacing={2}>
            <Skeleton
              variant="rectangular"
              sx={{ height: 120, borderRadius: "xl" }}
            />
            <Skeleton
              variant="rectangular"
              sx={{ height: 120, borderRadius: "xl" }}
            />
            <Skeleton
              variant="rectangular"
              sx={{ height: 180, borderRadius: "xl" }}
            />
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (!insights) {
    return (
      <JoyCard variant="outlined">
        <JoyCardHeader
          title="AI insights & next actions"
          description="Personalized analysis and action recommendations generated from customer behavior."
          actions={
            onRegenerate ? (
              <JoyButton
                size="sm"
                onClick={() => void onRegenerate()}
                loading={regenerating}
                startDecorator={<RefreshCw size={14} />}
              >
                Generate
              </JoyButton>
            ) : null
          }
        />
        <JoyCardContent>
          <Sheet
            variant="soft"
            color={errorMessage ? "danger" : "neutral"}
            sx={{ borderRadius: "xl", p: 3, textAlign: "center" }}
          >
            <Stack spacing={1.5} alignItems="center">
              <AlertCircle size={28} />
              <Typography level="title-md">
                {errorMessage
                  ? "AI insights unavailable"
                  : "No AI insights generated yet"}
              </Typography>
              <Typography
                level="body-sm"
                color={errorMessage ? "danger" : "neutral"}
              >
                {errorMessage ||
                  "Generate insights to summarize behavior, patterns, and next-best actions for this customer."}
              </Typography>
            </Stack>
          </Sheet>
        </JoyCardContent>
      </JoyCard>
    );
  }

  const generatedAgo = insights.generatedAt
    ? formatDistanceToNow(new Date(insights.generatedAt), { addSuffix: true })
    : null;

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="AI insights & next actions"
        description="Personalized analysis and action recommendations generated from customer behavior."
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            {generatedAgo ? (
              <Typography level="body-xs" color="neutral">
                Generated {generatedAgo}
              </Typography>
            ) : null}
            {onRegenerate ? (
              <JoyButton
                size="sm"
                variant="plain"
                color="primary"
                onClick={() => void onRegenerate()}
                loading={regenerating}
                startDecorator={<RefreshCw size={14} />}
              >
                Regenerate
              </JoyButton>
            ) : null}
          </Stack>
        }
      />
      <JoyCardContent>
        <Stack spacing={2.5}>
          {!insights.hasSufficientData ? (
            <Sheet
              color="warning"
              variant="soft"
              sx={{ borderRadius: "xl", p: 2 }}
            >
              <Typography level="body-sm">
                Limited data available. Recommendations are based on partial
                profile and event history.
              </Typography>
            </Sheet>
          ) : null}

          <Sheet
            variant="soft"
            color="primary"
            sx={{ borderRadius: "xl", p: 2.5 }}
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Sheet
                variant="solid"
                color="primary"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "lg",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Lightbulb size={18} />
              </Sheet>
              <Stack spacing={0.5}>
                <Typography
                  level="body-xs"
                  textTransform="uppercase"
                  fontWeight="lg"
                >
                  Key insight
                </Typography>
                <Typography level="title-md">{insights.keyInsight}</Typography>
              </Stack>
            </Stack>
          </Sheet>

          {insights.patterns.length > 0 ? (
            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
              <Stack spacing={1.25}>
                <Typography level="title-sm">Observed patterns</Typography>
                {insights.patterns.map((pattern) => (
                  <Stack
                    key={pattern}
                    direction="row"
                    spacing={1}
                    alignItems="flex-start"
                  >
                    <Sparkles size={14} />
                    <Typography level="body-sm">{pattern}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Sheet>
          ) : null}

          <Stack spacing={1.5}>
            <Typography level="title-sm">Recommended actions</Typography>
            {insights.actions.length > 0 ? (
              insights.actions.map((action, index) => {
                const Icon = actionTypeIcons[action.actionType] || TrendingUp;

                return (
                  <Sheet
                    key={`${action.title}-${index}`}
                    variant="outlined"
                    sx={{
                      borderRadius: "xl",
                      p: 2,
                      cursor: "pointer",
                      borderColor:
                        expandedAction === index
                          ? "primary.300"
                          : "neutral.200",
                    }}
                    onClick={() =>
                      setExpandedAction((current) =>
                        current === index ? null : index,
                      )
                    }
                  >
                    <Stack spacing={1.25}>
                      <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="flex-start"
                      >
                        <Sheet
                          variant="soft"
                          color="primary"
                          sx={{
                            width: 34,
                            height: 34,
                            borderRadius: "lg",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={16} />
                        </Sheet>
                        <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={0.75}
                            alignItems={{ xs: "flex-start", sm: "center" }}
                          >
                            <Typography level="title-sm">
                              {index + 1}. {action.title}
                            </Typography>
                            <JoyChip
                              color={
                                priorityConfig[action.priority]?.color ||
                                "neutral"
                              }
                              variant="soft"
                              size="sm"
                            >
                              {action.priority}
                            </JoyChip>
                            <JoyChip color="neutral" variant="soft" size="sm">
                              {action.confidence}% confidence
                            </JoyChip>
                          </Stack>
                          <Typography level="body-sm" color="neutral">
                            {action.description}
                          </Typography>
                        </Stack>
                        <ChevronRight
                          size={16}
                          style={{
                            transform:
                              expandedAction === index
                                ? "rotate(90deg)"
                                : "rotate(0deg)",
                            transition: "transform 0.16s ease",
                            flexShrink: 0,
                          }}
                        />
                      </Stack>

                      {expandedAction === index ? (
                        <Stack spacing={1} sx={{ pl: { xs: 0, sm: 5 } }}>
                          <JoyTooltip title="Action queueing is not wired on this page yet.">
                            <Box component="span">
                              <JoyButton
                                disabled
                                size="sm"
                                color="neutral"
                                variant="soft"
                              >
                                Queue action
                              </JoyButton>
                            </Box>
                          </JoyTooltip>
                          <Typography level="body-xs" color="neutral">
                            Review this recommendation before executing it
                            elsewhere in CRM.
                          </Typography>
                        </Stack>
                      ) : null}
                    </Stack>
                  </Sheet>
                );
              })
            ) : (
              <Typography level="body-sm" color="neutral">
                No actions were suggested for the current data set.
              </Typography>
            )}
          </Stack>

          <Typography level="body-xs" color="neutral" textAlign="center">
            Generated by {insights.modelUsed}. Review before taking action.
          </Typography>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}

export default AIInsightsActions;
