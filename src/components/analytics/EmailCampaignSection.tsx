import { useState } from "react";
import IconButton from "@mui/joy/IconButton";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eye,
  Mail,
  MousePointerClick,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useCampaignDeliveryMetrics,
  type DeliveryMetrics,
} from "@/hooks/analytics/useCampaignDeliveryMetrics";
import { CampaignDeliveryBreakdown } from "@/components/analytics/CampaignDeliveryBreakdown";
import { formatPercent } from "@/components/analytics/analyticsUtils";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip, JoyStatusChip } from "@/components/joy/JoyChip";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
} from "@/components/joy/JoyTable";

type EmailCampaignSectionProps = {
  dateRange: number;
};

const getCampaignStatus = (campaign: DeliveryMetrics) => {
  if (campaign.computedFailed > 0 && campaign.computedDelivered === 0) {
    return { label: "Failed", tone: "danger" as const };
  }

  if (
    campaign.computedEnqueued >
    campaign.computedDelivered + campaign.computedFailed
  ) {
    return { label: "Sending", tone: "primary" as const };
  }

  return { label: "Completed", tone: "success" as const };
};

export function EmailCampaignSection({ dateRange }: EmailCampaignSectionProps) {
  const navigate = useNavigate();
  const {
    campaigns,
    error,
    loading,
    recomputeAll,
    recomputeCampaign,
    refresh,
    summary,
  } = useCampaignDeliveryMetrics(dateRange);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(
    () => new Set(),
  );
  const [recomputingAll, setRecomputingAll] = useState(false);
  const [recomputingCampaign, setRecomputingCampaign] = useState<string | null>(
    null,
  );

  const toggleExpanded = (campaignId: string) => {
    setExpandedCampaigns((current) => {
      const next = new Set(current);

      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }

      return next;
    });
  };

  const handleRecomputeAll = async () => {
    setRecomputingAll(true);
    await recomputeAll();
    setRecomputingAll(false);
  };

  const handleRecomputeCampaign = async (campaignId: string) => {
    setRecomputingCampaign(campaignId);
    await recomputeCampaign(campaignId);
    setRecomputingCampaign(null);
  };

  if (loading) {
    return (
      <JoyCard variant="outlined">
        <JoyCardHeader
          title={<Skeleton variant="text" sx={{ width: 220 }} />}
        />
        <JoyCardContent sx={{ pt: 3 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton
                  key={index}
                  variant="rectangular"
                  sx={{ width: 120, height: 28, borderRadius: 999 }}
                />
              ))}
            </Stack>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton
                key={index}
                variant="rectangular"
                sx={{ width: "100%", height: 48, borderRadius: "md" }}
              />
            ))}
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (error) {
    return (
      <JoyCard variant="soft" color="danger">
        <JoyCardHeader title="Email Campaign Performance" />
        <JoyCardContent sx={{ pt: 3 }}>
          <Stack spacing={1.5}>
            <Typography level="body-sm">
              Failed to load campaign delivery metrics.
            </Typography>
            <JoyButton
              size="sm"
              variant="soft"
              color="danger"
              startDecorator={<RefreshCw size={14} />}
              onClick={() => void refresh()}
            >
              Retry
            </JoyButton>
          </Stack>
        </JoyCardContent>
      </JoyCard>
    );
  }

  if (!campaigns.length) {
    return (
      <JoyCard variant="outlined">
        <JoyCardHeader title="Email Campaign Performance" />
        <JoyCardContent sx={{ pt: 3 }}>
          <JoyEmptyState
            icon={<Mail />}
            title="No email campaigns in this period"
            description="Launch a campaign to start tracking delivery, opens, clicks, and skip reasons here."
            primaryAction={{
              label: "Create campaign",
              onClick: () => navigate("/crm/campaigns/new"),
            }}
          />
        </JoyCardContent>
      </JoyCard>
    );
  }

  const summaryChips = [
    {
      key: "campaigns",
      color: "neutral" as const,
      label: `${summary.totalCampaigns} Campaigns Sent`,
    },
    {
      key: "delivered",
      color: "neutral" as const,
      label: `${summary.totalDelivered.toLocaleString()} Delivered`,
    },
    {
      key: "skipped",
      color:
        summary.totalSkipped > 0 ? ("warning" as const) : ("neutral" as const),
      label: `${summary.totalSkipped.toLocaleString()} Skipped`,
    },
    {
      key: "open-rate",
      color:
        summary.avgOpenRate >= 20 ? ("success" as const) : ("warning" as const),
      label: `${formatPercent(summary.avgOpenRate)} Avg Open Rate`,
    },
    {
      key: "click-rate",
      color:
        summary.avgClickRate >= 3 ? ("success" as const) : ("warning" as const),
      label: `${formatPercent(summary.avgClickRate)} Avg Click Rate`,
    },
  ];

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Email Campaign Performance"
        description="Delivery quality, engagement, and breakdowns for your most recent sent campaigns"
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            {campaigns.some((campaign) => campaign.isStale) ? (
              <JoyChip
                size="sm"
                variant="soft"
                color="warning"
                startDecorator={<AlertTriangle size={12} />}
              >
                Cached drift detected
              </JoyChip>
            ) : null}
            <JoyButton
              size="sm"
              variant="soft"
              color="neutral"
              startDecorator={<RefreshCw size={14} />}
              onClick={() => void handleRecomputeAll()}
              loading={recomputingAll}
            >
              Recompute All
            </JoyButton>
            <JoyButton
              size="sm"
              variant="plain"
              color="primary"
              onClick={() => navigate("/crm/campaigns")}
            >
              View All →
            </JoyButton>
          </Stack>
        }
      />
      <JoyCardContent sx={{ pt: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {summaryChips.map((chip) => (
              <JoyChip
                key={chip.key}
                size="sm"
                variant="soft"
                color={chip.color}
              >
                {chip.label}
              </JoyChip>
            ))}
          </Stack>

          <JoyTable stickyHeader>
            <JoyTableHead>
              <JoyTableRow>
                <JoyTableHeaderCell sx={{ width: 44 }} />
                <JoyTableHeaderCell>Campaign Name</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Sent</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Delivered</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Opens</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Clicks</JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Status</JoyTableHeaderCell>
              </JoyTableRow>
            </JoyTableHead>
            <JoyTableBody>
              {campaigns.map((campaign) => {
                const isExpanded = expandedCampaigns.has(campaign.campaignId);
                const status = getCampaignStatus(campaign);
                const deliveryRate =
                  campaign.computedEnqueued > 0
                    ? (campaign.computedDelivered / campaign.computedEnqueued) *
                      100
                    : 0;

                return (
                  <>
                    <JoyTableRow
                      key={campaign.campaignId}
                      clickable
                      onClick={() => toggleExpanded(campaign.campaignId)}
                    >
                      <JoyTableCell>
                        <IconButton
                          size="sm"
                          variant="plain"
                          color="neutral"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExpanded(campaign.campaignId);
                          }}
                        >
                          {isExpanded ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </IconButton>
                      </JoyTableCell>
                      <JoyTableCell>
                        <Stack spacing={0.25}>
                          <Typography
                            level="body-sm"
                            sx={{ fontWeight: 600, color: "neutral.900" }}
                          >
                            {campaign.campaignName}
                          </Typography>
                          {campaign.isStale ? (
                            <Typography
                              level="body-xs"
                              sx={{ color: "warning.600" }}
                            >
                              Cached totals need recompute
                            </Typography>
                          ) : null}
                        </Stack>
                      </JoyTableCell>
                      <JoyTableCell sx={{ textAlign: "right" }}>
                        {campaign.cachedTotalSent.toLocaleString()}
                      </JoyTableCell>
                      <JoyTableCell sx={{ textAlign: "right" }}>
                        <Stack spacing={0.2} alignItems="flex-end">
                          <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                            {campaign.computedDelivered.toLocaleString()}
                          </Typography>
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.500" }}
                          >
                            {formatPercent(deliveryRate)}
                          </Typography>
                        </Stack>
                      </JoyTableCell>
                      <JoyTableCell sx={{ textAlign: "right" }}>
                        <Stack spacing={0.2} alignItems="flex-end">
                          <Stack
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                          >
                            <Eye size={13} />
                            <Typography
                              level="body-sm"
                              sx={{ fontWeight: 600 }}
                            >
                              {campaign.totalOpens.toLocaleString()}
                            </Typography>
                          </Stack>
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.500" }}
                          >
                            {formatPercent(campaign.openRate)}
                          </Typography>
                        </Stack>
                      </JoyTableCell>
                      <JoyTableCell sx={{ textAlign: "right" }}>
                        <Stack spacing={0.2} alignItems="flex-end">
                          <Stack
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                          >
                            <MousePointerClick size={13} />
                            <Typography
                              level="body-sm"
                              sx={{ fontWeight: 600 }}
                            >
                              {campaign.totalClicks.toLocaleString()}
                            </Typography>
                          </Stack>
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.500" }}
                          >
                            {formatPercent(campaign.clickRate)}
                          </Typography>
                        </Stack>
                      </JoyTableCell>
                      <JoyTableCell sx={{ textAlign: "right" }}>
                        <JoyStatusChip
                          size="sm"
                          status={status.label.toLowerCase()}
                          tone={status.tone}
                          label={status.label}
                        />
                      </JoyTableCell>
                    </JoyTableRow>
                    {isExpanded ? (
                      <JoyTableRow key={`${campaign.campaignId}-expanded`}>
                        <JoyTableCell colSpan={7} sx={{ p: 0 }}>
                          <CampaignDeliveryBreakdown
                            campaign={campaign}
                            onRecompute={handleRecomputeCampaign}
                            recomputing={
                              recomputingCampaign === campaign.campaignId
                            }
                          />
                        </JoyTableCell>
                      </JoyTableRow>
                    ) : null}
                  </>
                );
              })}
            </JoyTableBody>
          </JoyTable>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}
