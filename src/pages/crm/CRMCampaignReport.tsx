import * as React from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
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
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { BounceCleanupCard } from "@/components/crm/campaigns/BounceCleanupCard";
import { CampaignDeliverySummary } from "@/components/crm/campaigns/CampaignDeliverySummary";
import { CampaignEngagementMetrics } from "@/components/crm/campaigns/CampaignEngagementMetrics";
import { GovernanceHealthCard } from "@/components/crm/campaigns/GovernanceHealthCard";
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
        overflow: "hidden",
      }}
    >
      {Array.from({ length: cells }).map((_, index) => (
        <React.Fragment key={index}>
          <Box sx={{ flex: 1, p: 2.25 }}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Skeleton variant="circular" width={32} height={32} />
              <Stack spacing={0.5} sx={{ flex: 1 }}>
                <Skeleton width="45%" />
                <Skeleton width="65%" height={22} />
              </Stack>
            </Stack>
          </Box>
          {index < cells - 1 ? (
            <Divider
              orientation={
                index < cells - 1
                  ? ({ xs: "horizontal", md: "vertical" } as never)
                  : "vertical"
              }
            />
          ) : null}
        </React.Fragment>
      ))}
    </Sheet>
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
  const { cloneCampaign, isCloning } = useCampaignCloning();
  const { bouncedEmails } = useCampaignBounces(campaignId ?? "");
  const derivedMetricsQuery = useCampaignDerivedMetrics(campaignId);
  const [fullPreviewOpen, setFullPreviewOpen] = React.useState(false);

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

  return (
    <PageContainer fullWidth>
      <Stack spacing={3} sx={{ pb: 4 }}>
        <Sheet
          variant="plain"
          sx={{
            borderBottom: "1px solid",
            borderColor: "neutral.200",
            py: 2,
            px: { xs: 0, md: 0.5 },
            mb: 0.5,
          }}
        >
          <Typography
            level="body-xs"
            component={Link}
            to="/crm/campaigns"
            sx={{
              color: "neutral.500",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              "&:hover": { color: "neutral.700" },
              mb: 1,
            }}
          >
            <ChevronLeft size={14} />
            Back to campaigns
          </Typography>

          <Stack
            direction={{ xs: "column", lg: "row" }}
            alignItems={{ lg: "flex-start" }}
            justifyContent="space-between"
            spacing={2}
          >
            {reportQuery.isLoading ? (
              <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
                <Skeleton width={280} height={28} />
                <Stack direction="row" spacing={1}>
                  <Skeleton width={52} height={24} />
                  <Skeleton width={88} height={24} />
                  <Skeleton width={160} height={20} />
                </Stack>
              </Stack>
            ) : (
              <Stack
                spacing={0.5}
                sx={{ minWidth: 0, maxWidth: { xs: "100%", lg: "60%" } }}
              >
                <Typography
                  level="title-lg"
                  fontWeight="bold"
                  title={report?.campaign.name}
                  sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {displayCampaignName}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                >
                  <JoyChip variant="soft" color="neutral" size="sm">
                    {report?.campaign.channel === "sms" ? "SMS" : "Email"}
                  </JoyChip>
                  <JoyStatusChip status={report?.campaign.status ?? "draft"} />
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    Sent {formatDateTime(report?.sentAt ?? null)}
                  </Typography>
                </Stack>
              </Stack>
            )}

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
              justifyContent={{ xs: "flex-start", lg: "flex-end" }}
            >
              <JoyButton
                variant="soft"
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
            </Stack>
          </Stack>
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
            <JoyCard variant="outlined">
              <JoyCardHeader title="Opens Over Time" />
              <JoyCardContent>
                <Skeleton variant="rectangular" height={240} />
              </JoyCardContent>
            </JoyCard>
          ) : (
            <ChartCard
              title="Opens Over Time"
              data={report?.timeline ?? []}
              dataKey="opens"
            />
          )}

          {reportQuery.isLoading ? (
            <JoyCard variant="outlined">
              <JoyCardHeader title="Clicks Over Time" />
              <JoyCardContent>
                <Skeleton variant="rectangular" height={240} />
              </JoyCardContent>
            </JoyCard>
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
              <Stack spacing={1.25}>
                <Skeleton width={220} height={22} />
                <Skeleton width={320} height={18} />
                <Skeleton variant="rectangular" height={260} />
              </Stack>
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

        {!reportQuery.isLoading && report ? (
          <GovernanceHealthCard
            campaignId={campaignId}
            tenantId={report.tenantId}
          />
        ) : null}

        <JoyCard variant="outlined">
          <JoyCardHeader title="Quick Navigation" />
          <JoyCardContent>
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
