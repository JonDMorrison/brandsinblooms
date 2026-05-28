import * as React from "react";
import { useLocation } from "react-router-dom";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useBloom } from "@/components/bloom/BloomContext";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { InsightBlock } from "@/components/bloom/blocks/InsightBlock";
import type { InsightItem } from "@/components/bloom/blocks/blockTypes";
import { JoyCard } from "@/components/joy/JoyCard";
import { useBloomInsightMutations } from "@/hooks/bloom/useBloomInsightMutations";
import { useBloomInsightNotifications } from "@/hooks/bloom/useBloomInsightNotifications";
import { useBloomInsights } from "@/hooks/bloom/useBloomInsights";
import type { BloomProactiveInsight } from "@/hooks/bloom/types";
import { useTenant } from "@/hooks/useTenant";

const insightCardWidth = { xs: "min(82vw, 320px)", sm: 320 } as const;
const desktopFadeBackground =
  "linear-gradient(90deg, rgba(var(--joy-palette-neutral-mainChannel) / 0) 0%, rgba(var(--joy-palette-neutral-mainChannel) / 0.02) 38%, var(--joy-palette-background-surface) 100%)";

const severityMap: Record<
  BloomProactiveInsight["severity"],
  InsightItem["severity"]
> = {
  critical: "danger",
  info: "info",
  warning: "warning",
};

function toInsightItem(insight: BloomProactiveInsight): InsightItem {
  return {
    id: insight.id,
    severity: severityMap[insight.severity],
    title: insight.title,
    description: insight.description,
    actions: insight.actionPrompt?.trim()
      ? [{ label: "Ask Bloom", prompt: insight.actionPrompt.trim() }]
      : [],
  };
}

function InsightSkeletonCard() {
  const reducedMotion = useBloomReducedMotion();

  return (
    <JoyCard
      variant="outlined"
      sx={{
        width: insightCardWidth,
        minWidth: insightCardWidth,
        minHeight: 188,
        p: 1.5,
      }}
    >
      <Stack spacing={1.25} sx={{ width: "100%" }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="flex-start"
          justifyContent="space-between"
        >
          <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton
              animation={reducedMotion ? false : "pulse"}
              variant="text"
              sx={{ width: "64%", height: 22 }}
            />
            <Skeleton
              animation={reducedMotion ? false : "pulse"}
              variant="text"
              sx={{ width: "94%", height: 16 }}
            />
            <Skeleton
              animation={reducedMotion ? false : "pulse"}
              variant="text"
              sx={{ width: "78%", height: 16 }}
            />
          </Stack>
          <Skeleton
            animation={reducedMotion ? false : "pulse"}
            variant="rounded"
            sx={{
              width: 76,
              height: 24,
              borderRadius: "999px",
              flexShrink: 0,
            }}
          />
        </Stack>
        <Skeleton
          animation={reducedMotion ? false : "pulse"}
          variant="rectangular"
          sx={{
            width: 114,
            height: 32,
            borderRadius: "var(--joy-radius-sm)",
          }}
        />
      </Stack>
    </JoyCard>
  );
}

export function BloomInsightsSection() {
  const location = useLocation();
  const reducedMotion = useBloomReducedMotion();
  const { tenant, loading: tenantLoading } = useTenant();
  const { isStreaming, sendMessage } = useBloom();
  const { data: insights, isLoading } = useBloomInsights(tenant?.id);
  const { markAllSeen } = useBloomInsightNotifications(tenant?.id);
  const { dismissInsight } = useBloomInsightMutations();
  const [dismissingInsightIds, setDismissingInsightIds] = React.useState<
    Set<string>
  >(() => new Set());

  const showLoading = tenantLoading || (Boolean(tenant?.id) && isLoading);
  const isActionDrivenBloomEntry = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.has("insight") || params.has("continue") || params.has("new");
  }, [location.search]);

  React.useEffect(() => {
    if (
      location.pathname !== "/bloom" ||
      isActionDrivenBloomEntry ||
      showLoading ||
      insights.length === 0
    ) {
      return;
    }

    markAllSeen();
  }, [
    insights.length,
    isActionDrivenBloomEntry,
    location.pathname,
    markAllSeen,
    showLoading,
  ]);

  const handleAction = React.useCallback(
    (prompt: string) => {
      if (isStreaming || !prompt.trim()) {
        return;
      }

      void sendMessage(prompt).catch(() => undefined);
    },
    [isStreaming, sendMessage],
  );

  const handleDismiss = React.useCallback(
    (insightId: string) => {
      if (dismissingInsightIds.has(insightId)) {
        return;
      }

      setDismissingInsightIds((current) => {
        const next = new Set(current);
        next.add(insightId);
        return next;
      });

      void dismissInsight(insightId)
        .catch(() => undefined)
        .finally(() => {
          setDismissingInsightIds((current) => {
            const next = new Set(current);
            next.delete(insightId);
            return next;
          });
        });
    },
    [dismissInsight, dismissingInsightIds],
  );

  if (!showLoading && insights.length === 0) {
    return null;
  }

  return (
    <Stack spacing={1.25} sx={{ width: "min(100%, 680px)" }}>
      {!showLoading ? (
        <Typography
          level="body-xs"
          sx={{
            color: "neutral.400",
            fontWeight: "var(--joy-fontWeight-md)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Insights for today
        </Typography>
      ) : null}

      <Box sx={{ position: "relative" }}>
        <Stack
          direction="row"
          spacing={1.5}
          useFlexGap
          sx={{
            overflowX: "auto",
            pb: 0.5,
            pr: { xs: 0, md: 6 },
            scrollbarWidth: "thin",
            scrollSnapType: "x proximity",
            "&::-webkit-scrollbar": {
              height: 8,
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor:
                "rgba(var(--joy-palette-neutral-mainChannel) / 0.14)",
              borderRadius: 999,
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: "transparent",
            },
          }}
        >
          {showLoading ? (
            [0, 1].map((item) => <InsightSkeletonCard key={item} />)
          ) : reducedMotion ? (
            insights.map((insight) => {
              const insightItem = toInsightItem(insight);
              const isDismissing = dismissingInsightIds.has(insight.id);

              return (
                <Box key={insight.id} sx={{ flex: "0 0 auto" }}>
                  <Box
                    sx={{
                      position: "relative",
                      width: insightCardWidth,
                      minWidth: insightCardWidth,
                      scrollSnapAlign: "start",
                    }}
                  >
                    <Box
                      data-insight-block="true"
                      sx={{
                        "& .MuiCard-root": {
                          minHeight: 188,
                          height: "100%",
                          pr: 5,
                        },
                        "& .MuiChip-root": {
                          mr: 4,
                        },
                        "& .MuiButton-root": isStreaming
                          ? {
                              opacity: 0.7,
                              pointerEvents: "none",
                            }
                          : undefined,
                      }}
                    >
                      <InsightBlock
                        insights={[insightItem]}
                        onAction={handleAction}
                      />
                    </Box>

                    <IconButton
                      aria-label={`Dismiss ${insight.title}`}
                      color="neutral"
                      disabled={isDismissing}
                      size="sm"
                      variant="plain"
                      onClick={() => handleDismiss(insight.id)}
                      sx={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        color: "neutral.500",
                        zIndex: 1,
                        backgroundColor: "background.surface",
                        "&:hover": {
                          backgroundColor: "background.level1",
                        },
                      }}
                    >
                      <X size={14} strokeWidth={2} />
                    </IconButton>
                  </Box>
                </Box>
              );
            })
          ) : (
            <AnimatePresence initial={false}>
              {insights.map((insight) => {
                const insightItem = toInsightItem(insight);
                const isDismissing = dismissingInsightIds.has(insight.id);

                return (
                  <motion.div
                    key={insight.id}
                    layout
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -28, scale: 0.98 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    style={{ flex: "0 0 auto" }}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        width: insightCardWidth,
                        minWidth: insightCardWidth,
                        scrollSnapAlign: "start",
                      }}
                    >
                      <Box
                        data-insight-block="true"
                        sx={{
                          "& .MuiCard-root": {
                            minHeight: 188,
                            height: "100%",
                            pr: 5,
                          },
                          "& .MuiChip-root": {
                            mr: 4,
                          },
                          "& .MuiButton-root": isStreaming
                            ? {
                                opacity: 0.7,
                                pointerEvents: "none",
                              }
                            : undefined,
                        }}
                      >
                        <InsightBlock
                          insights={[insightItem]}
                          onAction={handleAction}
                        />
                      </Box>

                      <IconButton
                        aria-label={`Dismiss ${insight.title}`}
                        color="neutral"
                        disabled={isDismissing}
                        size="sm"
                        variant="plain"
                        onClick={() => handleDismiss(insight.id)}
                        sx={{
                          position: "absolute",
                          top: 10,
                          right: 10,
                          color: "neutral.500",
                          zIndex: 1,
                          backgroundColor: "background.surface",
                          "&:hover": {
                            backgroundColor: "background.level1",
                          },
                        }}
                      >
                        <X size={14} strokeWidth={2} />
                      </IconButton>
                    </Box>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </Stack>

        {!showLoading && insights.length > 3 ? (
          <Box
            aria-hidden="true"
            sx={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 72,
              display: { xs: "none", md: "block" },
              pointerEvents: "none",
              background: desktopFadeBackground,
            }}
          />
        ) : null}
      </Box>
    </Stack>
  );
}
