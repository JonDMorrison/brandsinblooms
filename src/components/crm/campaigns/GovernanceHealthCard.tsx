import * as React from "react";
import Chip from "@mui/joy/Chip";
import LinearProgress from "@mui/joy/LinearProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import { useCampaignGovernanceVisibility } from "@/hooks/useCampaignGovernanceVisibility";
import { useTenantEmailHealthDashboard } from "@/hooks/useTenantEmailHealthDashboard";

interface GovernanceHealthCardProps {
  campaignId: string;
  tenantId: string | null;
}

function toPercent(rate: number) {
  return rate > 1 ? rate : rate * 100;
}

function getHealthTone(value: number, warning: number, danger: number) {
  if (value >= danger) return "danger" as const;
  if (value >= warning) return "warning" as const;
  return "success" as const;
}

function RecommendationList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <CheckCircle2 size={16} />
        <Typography level="body-sm" color="neutral">
          No additional recommendations right now. Deliverability is within
          expected thresholds.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1}>
      {items.map((item) => (
        <Stack key={item} direction="row" spacing={1} alignItems="flex-start">
          <AlertTriangle size={16} />
          <Typography level="body-sm" color="neutral">
            {item}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

export function GovernanceHealthCard({
  campaignId,
  tenantId,
}: GovernanceHealthCardProps) {
  const governanceQuery = useCampaignGovernanceVisibility(campaignId);
  const healthQuery = useTenantEmailHealthDashboard(tenantId, {
    enabled: Boolean(tenantId),
  });

  if (governanceQuery.isLoading) {
    return null;
  }

  if (governanceQuery.error || !governanceQuery.data) {
    return (
      <JoyCard variant="outlined">
        <JoyCardHeader title="Sending Health" />
        <JoyCardContent>
          <Typography level="body-sm" color="neutral">
            Health data unavailable.
          </Typography>
        </JoyCardContent>
      </JoyCard>
    );
  }

  const governance = governanceQuery.data;
  const tenantHealth = healthQuery.data;
  const bounceRate = toPercent(
    governance.hard_bounce_rate + governance.soft_bounce_rate,
  );
  const complaintRate = toPercent(governance.complaint_rate);
  const sendVolume = tenantHealth?.sent_30d ?? 0;
  const sendQuota = governance.policy_recipient_cap ?? null;

  const recommendationSet = new Set<string>();
  if (bounceRate >= 2) {
    recommendationSet.add(
      "Audit the bounced recipients list and suppress invalid addresses before the next send.",
    );
  }
  if (complaintRate >= 0.1) {
    recommendationSet.add(
      "Review message targeting and unsubscribe visibility. Complaint rate is above the preferred threshold.",
    );
  }
  if (governance.is_throttled) {
    recommendationSet.add(
      `Tenant throttling is active: ${governance.throttle_reasons.join(", ") || "sending limits were applied"}.`,
    );
  }
  if (sendQuota && sendVolume >= sendQuota) {
    recommendationSet.add(
      "Thirty-day send volume is at or above the current policy cap. Reduce audience size or pace subsequent sends.",
    );
  }

  const rows = [
    {
      key: "bounce",
      label: "Bounce rate",
      value: `${bounceRate.toFixed(2)}%`,
      detail: `${(governance.hard_bounce_count + governance.soft_bounce_count).toLocaleString()} bounces`,
      progress: Math.min((bounceRate / 5) * 100, 100),
      tone: getHealthTone(bounceRate, 2, 5),
      thresholdLabel: "Warn at 2%, danger at 5%",
    },
    {
      key: "complaints",
      label: "Complaint rate",
      value: `${complaintRate.toFixed(2)}%`,
      detail: `${governance.complaint_count.toLocaleString()} complaints`,
      progress: Math.min((complaintRate / 0.2) * 100, 100),
      tone: getHealthTone(complaintRate, 0.1, 0.2),
      thresholdLabel: "Warn at 0.1%, danger at 0.2%",
    },
    {
      key: "volume",
      label: "Send volume (30 days)",
      value: sendVolume.toLocaleString(),
      detail: sendQuota
        ? `Quota ${sendQuota.toLocaleString()}`
        : "No explicit quota configured",
      progress: sendQuota
        ? Math.min((sendVolume / sendQuota) * 100, 100)
        : Math.min((sendVolume / Math.max(sendVolume, 1)) * 100, 100),
      tone: sendQuota
        ? getHealthTone(sendVolume, sendQuota * 0.85, sendQuota)
        : "neutral",
      thresholdLabel: sendQuota
        ? `Current cap ${sendQuota.toLocaleString()}`
        : "Monitoring only",
    },
  ] as const;

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Sending Health"
        description="Governance thresholds and tenant-level sending health for this campaign."
        actions={
          <JoyStatusChip
            status={governance.risk_indicator}
            label={`Risk ${governance.risk_indicator}`}
          />
        }
      />
      <JoyCardContent>
        <Stack spacing={2.25}>
          {rows.map((row) => (
            <Stack key={row.key} spacing={1}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={1}
              >
                <Stack spacing={0.25}>
                  <Typography level="body-sm" fontWeight="md">
                    {row.label}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    {row.detail}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography
                    level="title-sm"
                    color={row.tone === "neutral" ? "neutral" : row.tone}
                  >
                    {row.value}
                  </Typography>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={row.tone === "neutral" ? "neutral" : row.tone}
                  >
                    {row.thresholdLabel}
                  </Chip>
                </Stack>
              </Stack>
              <LinearProgress
                determinate
                value={row.progress}
                color={row.tone === "neutral" ? "neutral" : row.tone}
                thickness={8}
                sx={{ borderRadius: "999px" }}
              />
            </Stack>
          ))}

          <Stack spacing={1.25}>
            <Typography level="title-sm">Recommendations</Typography>
            <RecommendationList items={Array.from(recommendationSet)} />
          </Stack>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}
