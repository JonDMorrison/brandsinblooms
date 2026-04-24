import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Grid from "@mui/joy/Grid";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useListHealth } from "@/hooks/analytics/useListHealth";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import { JoyButton } from "@/components/joy/JoyButton";
import HealthSparkline from "./HealthSparkline";
import { clampPercentage } from "@/components/analytics/analyticsUtils";

type SuppressionBreakdown = {
  bounced: number;
  complained: number;
  unsubscribed: number;
};

const classifySuppressionReason = (
  suppressionType: string | null,
  reason: string | null,
) => {
  const normalized = `${suppressionType ?? ""} ${reason ?? ""}`.toLowerCase();

  if (normalized.includes("complaint")) {
    return "complained" as const;
  }

  if (normalized.includes("bounce")) {
    return "bounced" as const;
  }

  return "unsubscribed" as const;
};

export const ListHealthCard: React.FC = () => {
  const health = useListHealth();
  const { tenant } = useTenant();

  const {
    data: suppressionBreakdown,
    error,
    isLoading: suppressionLoading,
    refetch,
  } = useQuery<SuppressionBreakdown>({
    queryKey: ["analytics-list-health-breakdown", tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) {
        return { bounced: 0, complained: 0, unsubscribed: 0 };
      }

      const { data, error } = await supabase
        .from("suppression_list")
        .select("suppression_type, reason")
        .eq("tenant_id", tenant.id)
        .eq("channel", "email");

      if (error) {
        throw error;
      }

      return (data ?? []).reduce(
        (accumulator, item) => {
          const bucket = classifySuppressionReason(
            item.suppression_type,
            item.reason,
          );
          accumulator[bucket] += 1;
          return accumulator;
        },
        { bounced: 0, complained: 0, unsubscribed: 0 },
      );
    },
  });

  if (health.loading) {
    return (
      <JoyCard variant="outlined">
        <JoyCardHeader
          title={<Skeleton variant="text" sx={{ width: 120 }} />}
        />
        <JoyCardContent sx={{ pt: 3 }}>
          <Stack spacing={2} alignItems="center">
            <Skeleton variant="circular" sx={{ width: 108, height: 108 }} />
            <Skeleton variant="text" sx={{ width: 160 }} />
            <Skeleton
              variant="rectangular"
              sx={{ width: "100%", height: 120, borderRadius: "lg" }}
            />
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  // Calculate health score (inverse of problem rates)
  const healthScore = clampPercentage(
    100 - health.bounceRate * 10 - health.complaintRate * 100,
  );
  const tone =
    health.healthStatus === "healthy"
      ? "success"
      : health.healthStatus === "warning"
        ? "warning"
        : "danger";

  if (error) {
    return (
      <JoyCard variant="soft" color="danger">
        <JoyCardHeader title="List Health" />
        <JoyCardContent sx={{ pt: 3 }}>
          <Stack spacing={1.5}>
            <Typography level="body-sm">
              Failed to load suppression details.
            </Typography>
            <JoyButton
              size="sm"
              variant="soft"
              color="danger"
              onClick={() => void refetch()}
            >
              Retry
            </JoyButton>
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  const suppressionRows = [
    { label: "Unsubscribed", value: suppressionBreakdown?.unsubscribed ?? 0 },
    { label: "Bounced", value: suppressionBreakdown?.bounced ?? 0 },
    { label: "Complained", value: suppressionBreakdown?.complained ?? 0 },
  ];

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="List Health"
        description="Bounce risk, complaint pressure, and suppression drift across the last 30 days"
        actions={
          <JoyStatusChip
            size="sm"
            status={health.healthStatus}
            tone={tone}
            label={
              health.healthStatus === "healthy"
                ? "Healthy"
                : health.healthStatus === "warning"
                  ? "Warning"
                  : "Critical"
            }
          />
        }
        startDecorator={<ShieldAlert size={18} />}
      />
      <JoyCardContent sx={{ pt: 3 }}>
        <Stack spacing={2.25}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <CircularProgress
              determinate
              value={healthScore}
              color={tone}
              size="lg"
              sx={{
                "--CircularProgress-size": "108px",
                "--CircularProgress-thickness": "10px",
              }}
            >
              <Typography level="title-lg" sx={{ fontWeight: 700 }}>
                {Math.round(healthScore)}%
              </Typography>
            </CircularProgress>
            <Stack spacing={1} sx={{ flex: 1 }}>
              <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                Health Score
              </Typography>
              <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                Bounce rate and complaint rate are normalized against
                deliverability thresholds to estimate overall list quality.
              </Typography>
            </Stack>
          </Stack>

          <Grid container spacing={1.5}>
            <Grid xs={12} sm={6}>
              <Sheet
                variant="soft"
                color="neutral"
                sx={{ p: 1.5, borderRadius: "md" }}
              >
                <Stack spacing={0.6}>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    Bounce Rate
                  </Typography>
                  <Typography
                    level="title-md"
                    sx={{
                      color:
                        health.bounceRate >= 5
                          ? "danger.600"
                          : health.bounceRate >= 2
                            ? "warning.600"
                            : "success.600",
                      fontWeight: 700,
                    }}
                  >
                    {health.bounceRate}%
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {health.bounceCount30d} bounces / {health.totalSent30d} sent
                  </Typography>
                  <HealthSparkline type="bounce" height={40} />
                </Stack>
              </Sheet>
            </Grid>
            <Grid xs={12} sm={6}>
              <Sheet
                variant="soft"
                color="neutral"
                sx={{ p: 1.5, borderRadius: "md" }}
              >
                <Stack spacing={0.6}>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    Complaint Rate
                  </Typography>
                  <Typography
                    level="title-md"
                    sx={{
                      color:
                        health.complaintRate >= 0.3
                          ? "danger.600"
                          : health.complaintRate >= 0.1
                            ? "warning.600"
                            : "success.600",
                      fontWeight: 700,
                    }}
                  >
                    {health.complaintRate}%
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {health.complaintCount30d} complaints
                  </Typography>
                  <HealthSparkline type="complaint" height={40} />
                </Stack>
              </Sheet>
            </Grid>
          </Grid>

          <Sheet
            variant="outlined"
            sx={{ borderRadius: "md", overflow: "hidden" }}
          >
            <Stack divider={<Divider />}>
              {suppressionRows.map((row) => (
                <Stack
                  key={row.label}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={1.5}
                  sx={{ px: 1.5, py: 1.1 }}
                >
                  <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                    {row.label}
                  </Typography>
                  {suppressionLoading ? (
                    <Skeleton variant="text" sx={{ width: 32 }} />
                  ) : (
                    <Typography
                      level="body-sm"
                      sx={{ color: "neutral.900", fontWeight: 700 }}
                    >
                      {row.value.toLocaleString()}
                    </Typography>
                  )}
                </Stack>
              ))}
            </Stack>
          </Sheet>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
};

export default ListHealthCard;
