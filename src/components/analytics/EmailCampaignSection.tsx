import { useState } from "react";
import Box from "@mui/joy/Box";
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
import Alert from "@mui/joy/Alert";
import { useAdmin } from "@/contexts/AdminContext";
import {
  useCampaignDeliveryMetrics,
  type DeliveryMetrics,
} from "@/hooks/analytics/useCampaignDeliveryMetrics";
import { CampaignDeliveryBreakdown } from "@/components/analytics/CampaignDeliveryBreakdown";
import { formatPercent } from "@/components/analytics/analyticsUtils";
import {
  ESTIMATED_STATS_EXPLANATION,
  ESTIMATED_STATS_LABEL,
} from "@/lib/crm/campaignStats";
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

  // Bounced and unconfirmed sends are finished, not in progress: only
  // recipients still queued or sending mean the campaign is sending.
  if (campaign.computedPending > 0) {
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
    sentCounts,
  } = useCampaignDeliveryMetrics(dateRange);
  const { isMasterAdmin } = useAdmin();
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
      <JoyCard variant="outlined" sx={{ borderRadius: "xl", boxShadow: "0 4px 20px rgb(24 60 83 / 5%)" }}>
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
      <JoyCard variant="outlined" sx={{ borderRadius: "xl", boxShadow: "0 4px 20px rgb(24 60 83 / 5%)" }}>
        <JoyCardHeader title="Email engagement" />
        <JoyCardContent sx={{ pt: 3 }}>
          <Stack spacing={1.5}>
            <Typography level="body-sm">
              Failed to load campaign delivery metrics.
            </Typography>
            <JoyButton
              size="sm"
              variant="soft"
              color="neutral"
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
      <JoyCard variant="outlined" sx={{ borderRadius: "xl", boxShadow: "0 4px 20px rgb(24 60 83 / 5%)" }}>
        <JoyCardHeader title="Email engagement" />
        <JoyCardContent sx={{ pt: 3 }}>
          <JoyEmptyState
            icon={<Mail />}
            title="No email campaigns in this period"
            description={
              sentCounts && sentCounts.allTime > 0
                ? `No campaign was sent in the last ${dateRange} days. ${sentCounts.allTime.toLocaleString()} sent all time; widen the date range to see them.`
                : "Launch a campaign to start tracking delivery, opens, clicks, and skip reasons here."
            }
            primaryAction={{
              label: "Create campaign",
              onClick: () => navigate("/crm/campaigns/new"),
            }}
          />
        </JoyCardContent>
      </JoyCard>
    );
  }

  // The hook weights campaign rates by delivered messages and limits its
  // reporting window to the ten most recent sent campaigns.
  const hasDeliveryData = summary.totalDelivered > 0;
  const engagementMetrics = [
    {
      id: "clicks",
      label: "Click-through rate",
      value: hasDeliveryData ? formatPercent(summary.avgClickRate) : "—",
      helper: "Average across recent delivered emails",
      icon: MousePointerClick,
    },
    {
      id: "opens",
      label: "Reported open rate",
      value: hasDeliveryData ? formatPercent(summary.avgOpenRate) : "—",
      helper: "Approximate; privacy features can inflate opens",
      icon: Eye,
    },
    {
      id: "delivered",
      label: "Delivered emails",
      value: hasDeliveryData ? summary.totalDelivered.toLocaleString() : "—",
      helper: "Recorded delivery for these recent campaigns",
      icon: Mail,
    },
  ];
  const summaryChips = [
    {
      key: "campaigns",
      color: "neutral" as const,
      label: sentCounts
        ? `${sentCounts.inPeriod.toLocaleString()} sent in this period · ${sentCounts.allTime.toLocaleString()} all time`
        : `${summary.totalCampaigns} recent campaigns`,
    },
    {
      key: "skipped",
      color: summary.totalSkipped > 0 ? ("warning" as const) : ("neutral" as const),
      label: `${summary.totalSkipped.toLocaleString()} skipped`,
    },
    ...(summary.estimated
      ? [{
          key: "estimated",
          color: "neutral" as const,
          label: `${ESTIMATED_STATS_LABEL}: includes campaigns without send records`,
        }]
      : []),
  ];

  return (
    <JoyCard variant="outlined" sx={{ borderRadius: "xl", boxShadow: "0 4px 20px rgb(24 60 83 / 5%)" }}>
      <JoyCardHeader
        title="Email engagement"
        description="Clicks, opens and delivery across your 10 most recent sent campaigns"
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Cache reconciliation is an internal diagnostic: admins only. */}
            {isMasterAdmin && campaigns.some((campaign) => campaign.isStale) ? (
              <JoyChip
                size="sm"
                variant="soft"
                color="warning"
                startDecorator={<AlertTriangle size={12} />}
              >
                Stored totals out of date (admin)
              </JoyChip>
            ) : null}
            <JoyButton
              size="md"
              variant="outlined"
              color="neutral"
              onClick={() => navigate("/crm/campaigns")}
            >
              All campaigns →
            </JoyButton>
          </Stack>
        }
      />
      <JoyCardContent sx={{ pt: 3 }}>
        <Stack spacing={2}>
          {!hasDeliveryData ? (
            <Alert color="neutral" variant="soft" size="sm">
              These campaigns have no recorded deliveries yet, so open rate,
              click-through rate and delivered show “—”. This happens when
              campaigns were imported or sent before delivery tracking was
              connected, or while a send is still being recorded. It does not
              mean nobody opened them.
            </Alert>
          ) : null}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                sm: "repeat(3, minmax(0, 1fr))",
              },
              borderTop: "1px solid",
              borderBottom: "1px solid",
              borderColor: "neutral.200",
            }}
          >
            {engagementMetrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <Stack
                  key={metric.id}
                  spacing={0.5}
                  sx={{
                    py: { xs: 2, md: 2.5 },
                    pl: { xs: 0, sm: index === 0 ? 0 : 3 },
                    pr: { xs: 0, sm: 3 },
                    minWidth: 0,
                    borderLeft: { xs: "none", sm: index === 0 ? "none" : "1px solid" },
                    borderTop: { xs: index === 0 ? "none" : "1px solid", sm: "none" },
                    borderColor: { xs: "neutral.200", sm: "neutral.200" },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: "neutral.600" }}>
                    <Icon size={16} aria-hidden="true" />
                    <Typography level="body-sm" sx={{ color: "neutral.700", fontWeight: 600 }}>
                      {metric.label}
                    </Typography>
                  </Stack>
                  <Typography
                    level="h2"
                    sx={{ fontSize: { xs: "2.25rem", md: "2.75rem" }, lineHeight: 1.1, py: 0.5, fontWeight: 700, color: "neutral.900", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}
                  >
                    {metric.value}
                  </Typography>
                  <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                    {metric.helper}
                  </Typography>
                </Stack>
              );
            })}
          </Box>
          {!hasDeliveryData ? (
            <Typography level="body-xs" sx={{ color: "neutral.600" }}>
              Recorded delivery totals are not yet available. Engagement rates are not shown as zero.
            </Typography>
          ) : null}
          <Typography level="body-xs" sx={{ color: "neutral.600" }}>
            {summaryChips.map((chip, index) => (
              <Box
                component="span"
                key={chip.key}
                sx={{ color: chip.color === "warning" ? "warning.700" : undefined }}
              >
                {index > 0 ? " · " : ""}
                {chip.label}
              </Box>
            ))}
          </Typography>

          <Box
            component="details"
            sx={{
              borderTop: "1px solid",
              borderColor: "neutral.200",
              pt: 1.5,
              "&[open] .campaign-detail-chevron": { transform: "rotate(180deg)" },
            }}
          >
            <Box
              component="summary"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                color: "neutral.800",
                fontWeight: 600,
                py: 1,
                "&:focus-visible": {
                  outline: "2px solid var(--joy-palette-primary-400)",
                  outlineOffset: 2,
                },
              }}
            >
              See individual campaigns and delivery details
              <ChevronDown
                className="campaign-detail-chevron"
                size={18}
                aria-hidden="true"
                style={{ transition: "transform 150ms ease" }}
              />
            </Box>
            <Box sx={{ overflowX: "auto", mt: 1 }}>
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
                          {campaign.estimated ? (
                            <Typography
                              level="body-xs"
                              sx={{ color: "neutral.600" }}
                              title={ESTIMATED_STATS_EXPLANATION}
                            >
                              {ESTIMATED_STATS_LABEL}
                            </Typography>
                          ) : null}
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
                        {campaign.recipients.toLocaleString()}
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
            </Box>
          </Box>
          <Box component="details" sx={{ pt: 0.5 }}>
            <Box
              component="summary"
              sx={{ cursor: "pointer", color: "neutral.600", fontSize: 13 }}
            >
              Advanced delivery tools
            </Box>
            <JoyButton
              size="sm"
              variant="soft"
              color="neutral"
              startDecorator={<RefreshCw size={14} />}
              onClick={() => void handleRecomputeAll()}
              loading={recomputingAll}
              sx={{ mt: 1 }}
            >
              Recompute campaign metrics
            </JoyButton>
          </Box>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}
