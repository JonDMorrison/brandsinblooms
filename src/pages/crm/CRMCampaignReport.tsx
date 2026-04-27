import * as React from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronLeft,
  Copy,
  ExternalLink,
  FileDown,
  Mail,
  MoreHorizontal,
  Users,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { BounceCleanupCard } from "@/components/crm/campaigns/BounceCleanupCard";
import { CampaignDeliverySummary } from "@/components/crm/campaigns/CampaignDeliverySummary";
import { CampaignEngagementMetrics } from "@/components/crm/campaigns/CampaignEngagementMetrics";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip, JoyStatusChip } from "@/components/joy/JoyChip";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import { PageContainer } from "@/components/joy/PageContainer";
import { useCampaignBounces } from "@/hooks/useCampaignBounces";
import {
  normalizeDerivedMetrics,
  useCampaignDerivedMetrics,
} from "@/hooks/analytics/useCampaignDerivedMetrics";
import { useCampaignCloning } from "@/hooks/useCampaignCloning";
import {
  CAMPAIGN_STATUS,
  isDeliveredCampaignStatus,
} from "@/constants/campaignStatuses";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCampaignEditorRecord,
  mapCampaignCatalogItem,
  type CampaignCatalogItem,
} from "@/lib/crm/campaignEditor";

type TrackingEventRow = {
  event_type: string;
  customer_email: string | null;
  created_at: string;
};

type ReportTimelinePoint = {
  hour: number;
  opens: number;
  clicks: number;
};

type ReportSummary = {
  campaign: CampaignCatalogItem;
  tenantId: string | null;
  sentAt: string | null;
  subjectLine: string;
  preheaderText: string;
  content: string;
  smsMessage: string;
  metrics: ReturnType<typeof normalizeDerivedMetrics>;
  timeline: ReportTimelinePoint[];
  uniqueOpens: number;
  totalOpens: number;
  uniqueClicks: number;
  totalClicks: number;
  complaints: number;
  unsubscribes: number;
};

function StatsStripSkeleton({ cells }: { cells: number }) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "lg",
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        backgroundColor: "background.surface",
        overflow: "hidden",
      }}
    >
      {Array.from({ length: cells }).map((_, index) => (
        <React.Fragment key={index}>
          <Box sx={{ flex: 1, minWidth: 0, p: 2.25 }}>
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <Skeleton variant="circular" width={34} height={34} />
              <Stack spacing={0.65} sx={{ flex: 1, minWidth: 0 }}>
                <Skeleton width="48%" height={12} />
                <Skeleton width="72%" height={28} />
                <Skeleton width="38%" height={12} />
              </Stack>
            </Stack>
          </Box>
          {index < cells - 1 ? (
            <>
              <Divider sx={{ display: { xs: "block", md: "none" } }} />
              <Divider
                orientation="vertical"
                sx={{ display: { xs: "none", md: "block" } }}
              />
            </>
          ) : null}
        </React.Fragment>
      ))}
    </Sheet>
  );
}

function ReportHeaderTitleSkeleton() {
  return (
    <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
      <Skeleton width="min(420px, 72vw)" height={42} />
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
        <Skeleton width={44} height={18} />
        <Skeleton variant="circular" width={4} height={4} />
        <Skeleton width={92} height={24} sx={{ borderRadius: 999 }} />
        <Skeleton variant="circular" width={4} height={4} />
        <Skeleton width={184} height={18} />
      </Stack>
    </Stack>
  );
}

function ReportHeaderActionsSkeleton() {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      alignItems={{ xs: "stretch", sm: "center" }}
      justifyContent={{ xs: "flex-start", md: "flex-end" }}
    >
      <Skeleton width={132} height={34} sx={{ borderRadius: "md" }} />
      <Skeleton width={34} height={34} sx={{ borderRadius: "md" }} />
    </Stack>
  );
}

function ChartCardSkeleton({ titleWidth }: { titleWidth: number }) {
  return (
    <JoyCard variant="outlined">
      <JoyCardHeader title={<Skeleton width={titleWidth} height={22} />} />
      <JoyCardContent>
        <Box
          sx={{
            height: 240,
            borderRadius: "md",
            border: "1px solid",
            borderColor: "neutral.100",
            backgroundColor: "background.level1",
            p: 2,
            display: "grid",
            gridTemplateRows: "1fr auto",
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              position: "relative",
              minHeight: 0,
              backgroundImage:
                "linear-gradient(rgba(var(--joy-palette-neutral-mainChannel) / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--joy-palette-neutral-mainChannel) / 0.08) 1px, transparent 1px)",
              backgroundSize: "100% 44px, 64px 100%",
            }}
          >
            <Skeleton
              variant="rectangular"
              width="72%"
              height={118}
              sx={{
                position: "absolute",
                left: "12%",
                bottom: 18,
                borderRadius: "48% 52% 0 0 / 38% 46% 0 0",
                opacity: 0.75,
              }}
            />
          </Box>
          <Stack direction="row" spacing={1} justifyContent="space-between">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} width={34} height={10} />
            ))}
          </Stack>
        </Box>
      </JoyCardContent>
    </JoyCard>
  );
}

function PreviewSkeleton() {
  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Skeleton width="min(420px, 72vw)" height={20} />
        <Skeleton width="min(320px, 64vw)" height={16} />
      </Stack>
      <Sheet
        variant="soft"
        color="neutral"
        sx={{ borderRadius: "lg", p: { xs: 2, md: 2.5 } }}
      >
        <Stack spacing={1.15}>
          <Skeleton width="86%" height={18} />
          <Skeleton width="94%" height={18} />
          <Skeleton width="78%" height={18} />
          <Skeleton width="88%" height={18} />
          <Skeleton width="62%" height={18} />
          <Box sx={{ pt: 1 }}>
            <Skeleton variant="rectangular" height={96} sx={{ borderRadius: "md" }} />
          </Box>
        </Stack>
      </Sheet>
    </Stack>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "Not sent yet";
  return format(new Date(value), "PPp");
}

function normalizeCampaignNameForDisplay(name: string) {
  return name.replace(/(?:\s*\(Resend\))+$/i, " (Resend)").trim();
}

function sanitizeEmailAddress(email: string | null | undefined) {
  return (email || "").trim().toLowerCase();
}

function buildTimeline(
  events: TrackingEventRow[],
  sentAt: string | null,
): {
  timeline: ReportTimelinePoint[];
  uniqueOpens: number;
  totalOpens: number;
  uniqueClicks: number;
  totalClicks: number;
  complaints: number;
  unsubscribes: number;
} {
  const baseDate = sentAt ? new Date(sentAt) : null;
  const points = Array.from({ length: 72 }, (_, hour) => ({
    hour,
    opens: 0,
    clicks: 0,
  }));
  const openRecipients = new Set<string>();
  const clickRecipients = new Set<string>();
  let totalOpens = 0;
  let totalClicks = 0;
  let complaints = 0;
  let unsubscribes = 0;

  const openEvents = events
    .filter((event) => ["open", "opened"].includes(event.event_type))
    .sort(
      (left, right) =>
        new Date(left.created_at).getTime() -
        new Date(right.created_at).getTime(),
    );
  const clickEvents = events
    .filter((event) => ["click", "clicked"].includes(event.event_type))
    .sort(
      (left, right) =>
        new Date(left.created_at).getTime() -
        new Date(right.created_at).getTime(),
    );

  for (const event of events) {
    if (["complained", "complaint"].includes(event.event_type)) {
      complaints += 1;
    }
    if (["unsubscribed", "unsubscribe"].includes(event.event_type)) {
      unsubscribes += 1;
    }
  }

  let cumulativeOpens = 0;
  let cumulativeClicks = 0;
  let openIndex = 0;
  let clickIndex = 0;

  for (let hour = 0; hour < points.length; hour += 1) {
    const windowEnd = baseDate
      ? new Date(baseDate.getTime() + (hour + 1) * 60 * 60 * 1000)
      : null;

    while (openIndex < openEvents.length) {
      const event = openEvents[openIndex];
      if (
        windowEnd &&
        new Date(event.created_at).getTime() > windowEnd.getTime()
      ) {
        break;
      }

      const recipientKey = sanitizeEmailAddress(event.customer_email);
      totalOpens += 1;
      if (recipientKey && !openRecipients.has(recipientKey)) {
        openRecipients.add(recipientKey);
        cumulativeOpens += 1;
      }
      openIndex += 1;
    }

    while (clickIndex < clickEvents.length) {
      const event = clickEvents[clickIndex];
      if (
        windowEnd &&
        new Date(event.created_at).getTime() > windowEnd.getTime()
      ) {
        break;
      }

      const recipientKey = sanitizeEmailAddress(event.customer_email);
      totalClicks += 1;
      if (recipientKey && !clickRecipients.has(recipientKey)) {
        clickRecipients.add(recipientKey);
        cumulativeClicks += 1;
      }
      clickIndex += 1;
    }

    points[hour] = {
      hour,
      opens: cumulativeOpens,
      clicks: cumulativeClicks,
    };
  }

  return {
    timeline: points,
    uniqueOpens: openRecipients.size,
    totalOpens,
    uniqueClicks: clickRecipients.size,
    totalClicks,
    complaints,
    unsubscribes,
  };
}

function ChartCard({
  title,
  data,
  dataKey,
}: {
  title: string;
  data: ReportTimelinePoint[];
  dataKey: "opens" | "clicks";
}) {
  return (
    <JoyCard variant="outlined">
      <JoyCardHeader title={title} />
      <JoyCardContent>
        <Box sx={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient
                  id={`${dataKey}-gradient`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--joy-palette-primary-500)"
                    stopOpacity={0.24}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--joy-palette-primary-100)"
                    stopOpacity={0.04}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="rgba(var(--joy-palette-neutral-mainChannel) / 0.12)"
                vertical={false}
              />
              <XAxis
                dataKey="hour"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--joy-palette-neutral-500)", fontSize: 12 }}
                tickFormatter={(value) => `${value}h`}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--joy-palette-neutral-500)", fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--joy-palette-neutral-200)",
                  background: "var(--joy-palette-background-surface)",
                  boxShadow: "var(--joy-shadow-md)",
                }}
                formatter={(value: number) => [value.toLocaleString(), title]}
                labelFormatter={(value) => `Hour ${value}`}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke="var(--joy-palette-primary-500)"
                fill={`url(#${dataKey}-gradient)`}
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </JoyCardContent>
    </JoyCard>
  );
}

function renderPreviewContent(summary: ReportSummary) {
  if (summary.campaign.channel === "sms") {
    return (
      <Sheet variant="soft" color="neutral" sx={{ borderRadius: "lg", p: 2.5 }}>
        <Typography level="body-md" sx={{ whiteSpace: "pre-wrap" }}>
          {summary.smsMessage || "No SMS preview available."}
        </Typography>
      </Sheet>
    );
  }

  if (!summary.content) {
    return (
      <Sheet variant="soft" color="neutral" sx={{ borderRadius: "lg", p: 2.5 }}>
        <Typography level="body-sm" color="neutral">
          Rendered email preview is unavailable for this campaign. Open the
          editor to inspect the current content blocks.
        </Typography>
      </Sheet>
    );
  }

  return (
    <Box
      sx={{
        maxHeight: 480,
        overflow: "auto",
        border: "1px solid",
        borderColor: "neutral.200",
        borderRadius: "md",
        backgroundColor: "background.surface",
        "&::-webkit-scrollbar": { width: 6 },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "neutral.300",
          borderRadius: 3,
        },
      }}
    >
      <Box
        sx={{
          p: 2,
          minHeight: 240,
          "& img": { maxWidth: "100%", height: "auto" },
        }}
        dangerouslySetInnerHTML={{ __html: summary.content }}
      />
    </Box>
  );
}

function ReportFullPreviewDialog({
  open,
  onClose,
  report,
}: {
  open: boolean;
  onClose: () => void;
  report: ReportSummary | null | undefined;
}) {
  return (
    <JoyDialog
      open={open}
      onClose={onClose}
      size="xl"
      title="Full Campaign Preview"
      description={
        report?.campaign.channel === "sms"
          ? "Review the full SMS body exactly as it was sent."
          : report?.subjectLine || "Review the full rendered email content."
      }
      dialogSx={{ maxWidth: 1120, width: "calc(100vw - 2rem)" }}
    >
      <JoyDialogContent sx={{ pt: 0 }}>
        {report ? (
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <Typography level="body-sm" fontWeight="md">
                Subject: {report.subjectLine || "No subject line"}
              </Typography>
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                {report.preheaderText || "No preheader text"}
              </Typography>
            </Stack>
            {report.campaign.channel === "sms" ? (
              <Sheet
                variant="soft"
                color="neutral"
                sx={{ borderRadius: "lg", p: 2.5 }}
              >
                <Typography level="body-md" sx={{ whiteSpace: "pre-wrap" }}>
                  {report.smsMessage || "No SMS preview available."}
                </Typography>
              </Sheet>
            ) : report.content ? (
              <Box
                sx={{
                  minHeight: 560,
                  overflow: "auto",
                  border: "1px solid",
                  borderColor: "neutral.200",
                  borderRadius: "md",
                  backgroundColor: "background.surface",
                  "&::-webkit-scrollbar": { width: 6 },
                  "&::-webkit-scrollbar-thumb": {
                    backgroundColor: "neutral.300",
                    borderRadius: 3,
                  },
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    "& img": { maxWidth: "100%", height: "auto" },
                  }}
                  dangerouslySetInnerHTML={{ __html: report.content }}
                />
              </Box>
            ) : (
              <Sheet
                variant="soft"
                color="neutral"
                sx={{ borderRadius: "lg", p: 2.5 }}
              >
                <Typography level="body-sm" color="neutral">
                  Rendered email preview is unavailable for this campaign.
                </Typography>
              </Sheet>
            )}
          </Stack>
        ) : null}
      </JoyDialogContent>
      <JoyDialogActions>
        <JoyButton variant="plain" color="neutral" onClick={onClose}>
          Close
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
}

export default function CRMCampaignReport() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { cloneCampaign, isCloning } = useCampaignCloning();
  const { bouncedEmails } = useCampaignBounces(campaignId ?? "");
  const derivedMetricsQuery = useCampaignDerivedMetrics(campaignId);
  const [fullPreviewOpen, setFullPreviewOpen] = React.useState(false);
  const lastStatusRef = React.useRef<string | null>(null);

  const reportQuery = useQuery({
    queryKey: ["crm-campaign-report-dashboard", campaignId],
    enabled: Boolean(campaignId),
    queryFn: async (): Promise<ReportSummary> => {
      const [
        { data: campaignRow, error: campaignError },
        { data: trackingEvents, error: eventsError },
        editorRecord,
      ] = await Promise.all([
        supabase
          .from("crm_campaigns")
          .select("*")
          .eq("id", campaignId)
          .single(),
        supabase
          .from("email_tracking_events")
          .select("event_type, customer_email, created_at")
          .eq("campaign_id", campaignId)
          .in("event_type", [
            "open",
            "opened",
            "click",
            "clicked",
            "complained",
            "complaint",
            "unsubscribed",
            "unsubscribe",
          ]),
        fetchCampaignEditorRecord(campaignId!),
      ]);

      if (campaignError) throw campaignError;
      if (eventsError) throw eventsError;

      const campaign = mapCampaignCatalogItem(campaignRow);
      const timeline = buildTimeline(
        (trackingEvents ?? []) as TrackingEventRow[],
        campaignRow.sent_at,
      );

      return {
        campaign,
        tenantId: campaignRow.tenant_id ?? null,
        sentAt: campaignRow.sent_at,
        subjectLine: campaign.subjectLine,
        preheaderText: campaign.preheaderText,
        content: editorRecord.content || campaignRow.content || "",
        smsMessage: editorRecord.smsMessage || campaignRow.content || "",
        metrics: normalizeDerivedMetrics(campaignRow.metrics),
        ...timeline,
      };
    },
  });

  const report = reportQuery.data;
  const metrics = derivedMetricsQuery.metrics ?? report?.metrics;

  React.useEffect(() => {
    lastStatusRef.current = report?.campaign.status ?? null;
  }, [report?.campaign.status]);

  React.useEffect(() => {
    if (!campaignId) return;

    const channel = supabase
      .channel(`campaign-report-status-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "crm_campaigns",
          filter: `id=eq.${campaignId}`,
        },
        (payload) => {
          const nextStatus =
            payload.new && typeof payload.new.status === "string"
              ? payload.new.status
              : null;
          const previousStatus = lastStatusRef.current;

          if (nextStatus && previousStatus !== nextStatus) {
            if (
              !isDeliveredCampaignStatus(previousStatus) &&
              isDeliveredCampaignStatus(nextStatus)
            ) {
              if (nextStatus === CAMPAIGN_STATUS.SENT_WITH_ERRORS) {
                toast.warning("Campaign finished with errors", {
                  description:
                    "Delivery completed, but some recipients were not sent successfully.",
                });
              } else {
                toast.success("Campaign finished sending", {
                  description: "Delivery completed successfully.",
                });
              }
            }

            if (
              previousStatus !== CAMPAIGN_STATUS.FAILED &&
              nextStatus === CAMPAIGN_STATUS.FAILED
            ) {
              toast.error("Campaign failed", {
                description: "Delivery stopped before the campaign completed.",
              });
            }

            lastStatusRef.current = nextStatus;
          }

          void queryClient.invalidateQueries({
            queryKey: ["crm-campaign-report-dashboard", campaignId],
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campaignId, queryClient]);

  const lifecycleLabel = React.useMemo(() => {
    if (!report) return "";

    if (isDeliveredCampaignStatus(report.campaign.status)) {
      return `Sent ${formatDateTime(report.sentAt)}`;
    }

    if (report.campaign.queuedAt) {
      return `Queued ${formatDateTime(report.campaign.queuedAt)}`;
    }

    if (report.campaign.scheduledAt) {
      return `Scheduled ${formatDateTime(report.campaign.scheduledAt)}`;
    }

    return `Created ${formatDateTime(report.campaign.createdAt)}`;
  }, [report]);

  const handleDuplicate = React.useCallback(async () => {
    if (!campaignId) return;
    const clonedId = await cloneCampaign(campaignId, { clearScheduling: true });
    if (clonedId) {
      navigate(`/crm/campaigns/${clonedId}`);
    }
  }, [campaignId, cloneCampaign, navigate]);

  const handleCopyLink = React.useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Report link copied");
  }, []);

  const handleExportSummary = React.useCallback(() => {
    if (!report || !metrics) return;

    const rows = [
      ["Campaign", report.campaign.name],
      ["Status", report.campaign.status],
      ["Queued At", formatDateTime(report.campaign.queuedAt)],
      ["Sent At", formatDateTime(report.sentAt)],
      ["Recipients", report.campaign.totalRecipients.toString()],
      ["Delivered", metrics.totals.delivered.toString()],
      [
        "Bounced",
        String(metrics.totals.bounces || metrics.totals.hard_bounces),
      ],
      ["Failed", "0"],
      ["Skipped", metrics.totals.skipped.toString()],
      ["Unique Opens", report.uniqueOpens.toString()],
      ["Total Opens", report.totalOpens.toString()],
      ["Unique Clicks", report.uniqueClicks.toString()],
      ["Total Clicks", report.totalClicks.toString()],
      ["Unsubscribes", report.unsubscribes.toString()],
      ["Complaints", report.complaints.toString()],
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [metrics, report]);

  if (!campaignId) {
    return null;
  }

  if (!reportQuery.isLoading && !report) {
    return (
      <PageContainer fullWidth>
        <Typography level="title-lg">Campaign not found.</Typography>
      </PageContainer>
    );
  }

  const sent = metrics?.totals.sent ?? report?.campaign.totalRecipients ?? 0;
  const delivered = metrics?.totals.delivered ?? 0;
  const bounced = metrics?.totals.bounces ?? metrics?.totals.hard_bounces ?? 0;
  const failed = 0;
  const skipped = metrics?.totals.skipped ?? 0;
  const displayCampaignName = report
    ? normalizeCampaignNameForDisplay(report.campaign.name)
    : "";
  const channelLabel = report?.campaign.channel === "sms" ? "SMS" : "Email";

  return (
    <PageContainer fullWidth sx={{ px: { xs: 2, md: 3 }, py: 2.5 }}>
      <Stack spacing={3} sx={{ pb: 4 }}>
        <Sheet
          variant="plain"
          sx={{
            borderRadius: "xl",
            backgroundColor: "background.surface",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              px: { xs: 2, md: 3 },
              py: 2.5,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={2}>
              <JoyButton
                variant="plain"
                color="neutral"
                size="sm"
                startDecorator={<ChevronLeft size={16} />}
                onClick={() => navigate("/crm/campaigns")}
                sx={{ alignSelf: "flex-start" }}
              >
                Back to campaigns
              </JoyButton>

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", md: "center" }}
              >
                {reportQuery.isLoading ? (
                  <ReportHeaderTitleSkeleton />
                ) : (
                  <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      level="h3"
                      fontWeight="lg"
                      title={report?.campaign.name}
                      sx={{
                        lineHeight: 1.05,
                        letterSpacing: 0,
                        wordBreak: "break-word",
                      }}
                    >
                      {displayCampaignName}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                        {channelLabel}
                      </Typography>
                      <Typography level="body-sm" sx={{ color: "neutral.400" }}>
                        ·
                      </Typography>
                      <JoyStatusChip status={report?.campaign.status ?? "draft"} size="sm" />
                      <Typography level="body-sm" sx={{ color: "neutral.400" }}>
                        ·
                      </Typography>
                      <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                        {lifecycleLabel}
                      </Typography>
                    </Stack>
                  </Stack>
                )}

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "stretch", sm: "center" }}
                  justifyContent={{ xs: "flex-start", md: "flex-end" }}
                >
                  {reportQuery.isLoading ? (
                    <ReportHeaderActionsSkeleton />
                  ) : (
                    <>
                      <JoyButton
                        variant="outlined"
                        color="neutral"
                        size="sm"
                        startDecorator={<Users size={16} />}
                        onClick={() =>
                          navigate(`/crm/campaigns/${campaignId}/recipients`)
                        }
                      >
                        View Recipients
                      </JoyButton>
                      <JoyDropdownMenu>
                        <JoyDropdownMenuTrigger
                          variant="outlined"
                          color="neutral"
                          size="sm"
                          iconButtonSx={{ borderRadius: "md" }}
                        >
                          <MoreHorizontal size={16} />
                        </JoyDropdownMenuTrigger>
                        <JoyDropdownMenuContent>
                          <JoyDropdownMenuItem onClick={() => void handleDuplicate()}>
                            {isCloning ? "Duplicating..." : "Duplicate Campaign"}
                          </JoyDropdownMenuItem>
                          <JoyDropdownMenuItem
                            startDecorator={<Copy size={16} />}
                            onClick={() => void handleCopyLink()}
                          >
                            Copy report link
                          </JoyDropdownMenuItem>
                          <JoyDropdownMenuItem
                            startDecorator={<FileDown size={16} />}
                            onClick={handleExportSummary}
                          >
                            Export summary CSV
                          </JoyDropdownMenuItem>
                        </JoyDropdownMenuContent>
                      </JoyDropdownMenu>
                    </>
                  )}
                </Stack>
              </Stack>
            </Stack>
          </Box>
        </Sheet>

        {reportQuery.isLoading ? (
          <StatsStripSkeleton cells={5} />
        ) : (
          <CampaignDeliverySummary
            sent={sent}
            delivered={delivered}
            bounced={bounced}
            failed={failed}
            skipped={skipped}
          />
        )}

        {reportQuery.isLoading ? (
          <StatsStripSkeleton cells={4} />
        ) : (
          <CampaignEngagementMetrics
            uniqueOpens={report?.uniqueOpens ?? 0}
            totalOpens={report?.totalOpens ?? 0}
            uniqueClicks={report?.uniqueClicks ?? 0}
            totalClicks={report?.totalClicks ?? 0}
            unsubscribes={report?.unsubscribes ?? 0}
            complaints={report?.complaints ?? 0}
            totalDelivered={Math.max(delivered, 1)}
          />
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
          }}
        >
          {reportQuery.isLoading ? (
            <ChartCardSkeleton titleWidth={132} />
          ) : (
            <ChartCard
              title="Opens Over Time"
              data={report?.timeline ?? []}
              dataKey="opens"
            />
          )}

          {reportQuery.isLoading ? (
            <ChartCardSkeleton titleWidth={136} />
          ) : (
            <ChartCard
              title="Clicks Over Time"
              data={report?.timeline ?? []}
              dataKey="clicks"
            />
          )}
        </Box>

        <JoyCard variant="outlined" sx={{ borderRadius: "lg" }}>
          <JoyCardContent sx={{ p: 3 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1.25}
              useFlexGap
              sx={{ mb: 2 }}
            >
              <Typography level="title-sm" fontWeight="lg">
                What was sent
              </Typography>
              {!reportQuery.isLoading ? (
                <JoyButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  startDecorator={<ExternalLink size={14} />}
                  sx={{ flexShrink: 0 }}
                  onClick={() => setFullPreviewOpen(true)}
                >
                  View full size
                </JoyButton>
              ) : null}
            </Stack>

            {reportQuery.isLoading ? (
              <PreviewSkeleton />
            ) : (
              <Stack spacing={2}>
                <Stack spacing={0.5}>
                  <Typography level="body-sm" fontWeight="md">
                    Subject: {report?.subjectLine || "No subject line"}
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {report?.preheaderText || "No preheader text"}
                  </Typography>
                </Stack>
                {report ? renderPreviewContent(report) : null}
                <Typography
                  level="body-xs"
                  sx={{ color: "neutral.400", textAlign: "center" }}
                >
                  Scroll to see more · or click "View full size" for the
                  complete{" "}
                  {report?.campaign.channel === "sms" ? "message" : "email"}
                </Typography>
              </Stack>
            )}
          </JoyCardContent>
        </JoyCard>

        {!reportQuery.isLoading && bouncedEmails.length > 0 ? (
          <BounceCleanupCard campaignId={campaignId} />
        ) : null}
        <JoyCard variant="outlined">
          <JoyCardHeader title="Quick Navigation" />
          <JoyCardContent>
            {reportQuery.isLoading ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Skeleton width={156} height={36} sx={{ borderRadius: "md" }} />
                <Skeleton width={162} height={36} sx={{ borderRadius: "md" }} />
                <Skeleton width={138} height={36} sx={{ borderRadius: "md" }} />
              </Stack>
            ) : (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <JoyButton
                  bloomVariant="secondary"
                  startDecorator={<Mail size={16} />}
                  onClick={() =>
                    navigate(`/crm/campaigns/${campaignId}/recipients`)
                  }
                >
                  View All Recipients
                </JoyButton>
                <JoyButton
                  onClick={() => void handleDuplicate()}
                  bloomVariant="secondary"
                  startDecorator={<Copy size={16} />}
                >
                  Duplicate Campaign
                </JoyButton>
                <JoyButton
                  bloomVariant="secondary"
                  onClick={() => navigate("/crm/campaigns")}
                >
                  Back to Campaigns
                </JoyButton>
              </Stack>
            )}
          </JoyCardContent>
        </JoyCard>

        <ReportFullPreviewDialog
          open={fullPreviewOpen}
          onClose={() => setFullPreviewOpen(false)}
          report={report}
        />
      </Stack>
    </PageContainer>
  );
}
