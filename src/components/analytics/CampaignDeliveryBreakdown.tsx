import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  Ban,
  CheckCircle,
  Mail,
  RefreshCw,
  UserX,
  XCircle,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import type { DeliveryMetrics } from "@/hooks/analytics/useCampaignDeliveryMetrics";

interface CampaignDeliveryBreakdownProps {
  campaign: DeliveryMetrics;
  onRecompute: (campaignId: string) => Promise<void>;
  recomputing?: boolean;
}

export const CampaignDeliveryBreakdown: React.FC<
  CampaignDeliveryBreakdownProps
> = ({ campaign, onRecompute, recomputing = false }) => {
  const totalAttempted = campaign.computedEnqueued + campaign.skipsTotal;
  const deliveryRate =
    totalAttempted > 0
      ? (campaign.computedDelivered / totalAttempted) * 100
      : 0;
  const deliveryColor =
    deliveryRate >= 95 ? "success" : deliveryRate >= 80 ? "warning" : "danger";
  const skipReasons = [
    {
      label: "Opted Out",
      value: campaign.skipsByReason.opt_out,
      icon: <UserX size={13} />,
    },
    {
      label: "Suppressed",
      value: campaign.skipsByReason.suppressed,
      icon: <Ban size={13} />,
    },
    {
      label: "Invalid Email",
      value: campaign.skipsByReason.invalid_email,
      icon: <XCircle size={13} />,
    },
    {
      label: "Other",
      value: campaign.skipsByReason.other,
      icon: <AlertTriangle size={13} />,
    },
  ].filter((reason) => reason.value > 0);

  const deliveryStats = [
    {
      label: "Enqueued",
      value: campaign.computedEnqueued,
      icon: <Mail size={14} />,
      tone: "neutral" as const,
    },
    {
      label: "Delivered",
      value: campaign.computedDelivered,
      icon: <CheckCircle size={14} />,
      tone: "success" as const,
    },
    {
      label: "Skipped",
      value: campaign.skipsTotal,
      icon: <Ban size={14} />,
      tone: "warning" as const,
    },
    {
      label: "Failed",
      value: campaign.computedFailed,
      icon: <XCircle size={14} />,
      tone: "danger" as const,
    },
  ];

  return (
    <Box sx={{ px: 2, py: 2.25, backgroundColor: "neutral.50" }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography level="title-sm">Delivery Details</Typography>
            {campaign.isStale ? (
              <JoyTooltip
                title={`Displayed cached totals drift by ${campaign.metricsDiscrepancy.toFixed(0)}%. Recompute to refresh the rollup.`}
              >
                <JoyChip
                  size="sm"
                  variant="soft"
                  color="warning"
                  startDecorator={<AlertTriangle size={12} />}
                >
                  Cached drift
                </JoyChip>
              </JoyTooltip>
            ) : null}
          </Stack>
          <JoyButton
            size="sm"
            variant="plain"
            color="primary"
            startDecorator={<RefreshCw size={14} />}
            onClick={() => onRecompute(campaign.campaignId)}
            loading={recomputing}
          >
            Recompute
          </JoyButton>
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          {deliveryStats.map((stat) => (
            <Sheet
              key={stat.label}
              variant="soft"
              color={stat.tone}
              sx={{ flex: 1, borderRadius: "md", p: 1.25 }}
            >
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  {stat.icon}
                  <Typography level="body-xs">{stat.label}</Typography>
                </Stack>
                <Typography
                  level="title-md"
                  sx={{ fontWeight: 700, color: "neutral.900" }}
                >
                  {stat.value.toLocaleString()}
                </Typography>
              </Stack>
            </Sheet>
          ))}
        </Stack>

        <Stack spacing={0.75}>
          <Stack direction="row" justifyContent="space-between" spacing={1.5}>
            <Typography
              level="body-sm"
              sx={{ color: "neutral.700", fontWeight: 600 }}
            >
              Delivery Rate
            </Typography>
            <Typography
              level="body-sm"
              sx={{ color: "neutral.900", fontWeight: 700 }}
            >
              {deliveryRate.toFixed(1)}%
            </Typography>
          </Stack>
          <LinearProgress
            determinate
            value={deliveryRate}
            color={deliveryColor}
            sx={{ borderRadius: 999, height: 10 }}
          />
        </Stack>

        <Stack spacing={1.25}>
          <Typography
            level="body-sm"
            sx={{ color: "neutral.700", fontWeight: 600 }}
          >
            Skip Reasons
          </Typography>
          {skipReasons.length ? (
            <Sheet
              variant="outlined"
              sx={{ borderRadius: "md", overflow: "hidden" }}
            >
              <Stack divider={<Divider />}>
                {skipReasons.map((reason) => (
                  <Stack
                    key={reason.label}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={1.5}
                    sx={{ px: 1.5, py: 1.1 }}
                  >
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      {reason.icon}
                      <Typography level="body-sm">{reason.label}</Typography>
                    </Stack>
                    <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                      {reason.value.toLocaleString()}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Sheet>
          ) : (
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              No skips were recorded for this campaign.
            </Typography>
          )}
        </Stack>

        {campaign.isStale ? (
          <Sheet
            variant="soft"
            color="warning"
            sx={{ borderRadius: "md", p: 1.25 }}
          >
            <Stack spacing={0.5}>
              <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                Cached vs computed totals differ
              </Typography>
              <Typography level="body-xs">
                Cached: {campaign.cachedTotalSent.toLocaleString()} sent.
                Computed: {campaign.computedDelivered.toLocaleString()}{" "}
                delivered.
              </Typography>
            </Stack>
          </Sheet>
        ) : null}
      </Stack>
    </Box>
  );
};

export default CampaignDeliveryBreakdown;
