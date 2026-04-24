import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { BadgeCheck, Gauge, Gift, Heart, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { POSAnalytics } from "@/hooks/usePOSAnalytics";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  formatCompactNumber,
  formatCurrency,
  formatRelativeTimestamp,
  getTrendMeta,
} from "@/components/analytics/analyticsUtils";

type POSDetailCardsProps = {
  avgOrderTrend?: number | null;
  loyaltyTrend?: number | null;
  loading?: boolean;
  pointsTrend?: number | null;
  posData?: POSAnalytics;
};

function POSCompactCard({
  actionLabel,
  chip,
  label,
  trend,
  value,
  onAction,
}: {
  actionLabel?: string;
  chip: React.ReactNode;
  label: string;
  trend?: number | null;
  value: React.ReactNode;
  onAction?: () => void;
}) {
  const trendMeta = getTrendMeta(trend);

  return (
    <JoyCard
      variant="soft"
      color="neutral"
      sx={{
        p: 1.75,
        borderRadius: "md",
        boxShadow: "none",
        borderColor: "transparent",
      }}
    >
      <Stack spacing={1.25}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={1.5}
        >
          <Stack spacing={0.35} sx={{ minWidth: 0 }}>
            <Typography
              level="body-xs"
              sx={{
                color: "neutral.500",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {label}
            </Typography>
            <Typography
              level="title-lg"
              sx={{
                color: "neutral.900",
                fontWeight: 700,
                fontFamily: "var(--joy-fontFamily-display)",
              }}
            >
              {value}
            </Typography>
          </Stack>
          {chip}
        </Stack>

        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={1.5}
        >
          <Typography
            level="body-xs"
            sx={{
              color:
                trendMeta.tone === "success"
                  ? "success.600"
                  : trendMeta.tone === "danger"
                    ? "danger.600"
                    : "neutral.500",
              fontWeight: 600,
            }}
          >
            {trendMeta.label === "—"
              ? "No prior baseline"
              : `${trendMeta.label} vs prior period`}
          </Typography>
          {actionLabel && onAction ? (
            <JoyButton
              size="sm"
              variant="plain"
              color="primary"
              onClick={onAction}
            >
              {actionLabel}
            </JoyButton>
          ) : null}
        </Stack>
      </Stack>
    </JoyCard>
  );
}

export function POSDetailCards({
  avgOrderTrend,
  loyaltyTrend,
  loading = false,
  pointsTrend,
  posData,
}: POSDetailCardsProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Stack spacing={1.5}>
        {Array.from({ length: 3 }).map((_, index) => (
          <JoyCard
            key={index}
            variant="soft"
            color="neutral"
            sx={{ p: 1.75, borderRadius: "md", boxShadow: "none" }}
          >
            <Stack spacing={1.25}>
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                Loading...
              </Typography>
              <Typography level="title-lg">—</Typography>
            </Stack>
          </JoyCard>
        ))}
      </Stack>
    );
  }

  const hasIntegration = Boolean(posData?.hasIntegration);
  const lastSyncLabel = formatRelativeTimestamp(posData?.lastSyncedAt);

  return (
    <Stack spacing={1.5}>
      <POSCompactCard
        label="Average Order Value"
        value={formatCurrency(posData?.avgOrderValue ?? 0)}
        trend={avgOrderTrend}
        chip={
          hasIntegration ? (
            posData?.needsOrderSync ? (
              <JoyChip
                size="sm"
                variant="soft"
                color="warning"
                startDecorator={<RefreshCw size={12} />}
              >
                Sync Required
              </JoyChip>
            ) : (
              <JoyChip
                size="sm"
                variant="soft"
                color="success"
                startDecorator={<BadgeCheck size={12} />}
              >
                Synced
              </JoyChip>
            )
          ) : (
            <JoyChip size="sm" variant="soft" color="neutral">
              Not Connected
            </JoyChip>
          )
        }
        actionLabel={
          hasIntegration
            ? posData?.needsOrderSync
              ? "Sync Now"
              : undefined
            : "Connect"
        }
        onAction={() => navigate("/crm/pos")}
      />

      <POSCompactCard
        label="Loyalty Members"
        value={formatCompactNumber(posData?.loyaltyMembers ?? 0)}
        trend={loyaltyTrend}
        chip={
          hasIntegration ? (
            posData?.loyaltySynced ? (
              <JoyChip
                size="sm"
                variant="soft"
                color="success"
                startDecorator={<Heart size={12} />}
              >
                Program Active
              </JoyChip>
            ) : (
              <JoyChip size="sm" variant="soft" color="warning">
                Sync Required
              </JoyChip>
            )
          ) : (
            <JoyChip size="sm" variant="soft" color="neutral">
              Not Connected
            </JoyChip>
          )
        }
        actionLabel={
          hasIntegration
            ? posData?.loyaltySynced
              ? undefined
              : "Sync Now"
            : "Connect"
        }
        onAction={() => navigate("/crm/pos")}
      />

      <JoyCard
        variant="soft"
        color="neutral"
        sx={{
          p: 1.75,
          borderRadius: "md",
          boxShadow: "none",
          borderColor: "transparent",
        }}
      >
        <Stack spacing={1.25}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            spacing={1.5}
          >
            <Stack spacing={0.35}>
              <Typography
                level="body-xs"
                sx={{
                  color: "neutral.500",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Total Points Earned
              </Typography>
              <Typography
                level="title-lg"
                sx={{
                  color: "neutral.900",
                  fontWeight: 700,
                  fontFamily: "var(--joy-fontFamily-display)",
                }}
              >
                {formatCompactNumber(posData?.totalPointsEarned ?? 0)}
              </Typography>
            </Stack>
            <JoyChip
              size="sm"
              variant="soft"
              color={hasIntegration ? "success" : "neutral"}
              startDecorator={<Gift size={12} />}
            >
              {hasIntegration ? "Rewards Data" : "Not Connected"}
            </JoyChip>
          </Stack>

          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1.5}
          >
            <Typography
              level="body-xs"
              sx={{
                color:
                  getTrendMeta(pointsTrend).tone === "success"
                    ? "success.600"
                    : "neutral.500",
                fontWeight: 600,
              }}
            >
              {getTrendMeta(pointsTrend).label === "—"
                ? `Last synced ${lastSyncLabel}`
                : `${getTrendMeta(pointsTrend).label} engagement change`}
            </Typography>
            <JoyButton
              size="sm"
              variant="plain"
              color="primary"
              onClick={() => navigate("/crm/pos")}
            >
              {hasIntegration ? "Configure" : "Connect"}
            </JoyButton>
          </Stack>
        </Stack>
      </JoyCard>
    </Stack>
  );
}
