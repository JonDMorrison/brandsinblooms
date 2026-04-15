import React from "react";
import Grid from "@mui/joy/Grid";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import JoySkeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { PageContainer } from "@/components/joy/PageContainer";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Webhook,
  MailWarning,
  Ban,
  TrendingUp,
  ShieldAlert,
  XCircle,
  Bell,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

interface HealthMetric {
  name: string;
  value: number | string;
  status: "green" | "yellow" | "red";
  threshold: string;
  icon: React.ReactNode;
}

interface AnalyticsAlert {
  id: string;
  metric: string;
  value: number;
  threshold: number;
  severity: "warning" | "critical";
  created_at: string;
  resolved_at?: string;
}

const AnalyticsHealthPage = () => {
  const queryClient = useQueryClient();

  // Fetch health metrics
  const {
    data: healthData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["analytics-health"],
    queryFn: async () => {
      // Get latest event timestamp for ingest lag
      const { data: latestEvent } = await supabase
        .from("email_tracking_events")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Get complaint count (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: complaintCount } = await supabase
        .from("email_tracking_events")
        .select("*", { count: "exact", head: true })
        .in("event_type", ["complaint", "complained"])
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Get bounce count (last 30 days)
      const { count: bounceCount } = await supabase
        .from("email_tracking_events")
        .select("*", { count: "exact", head: true })
        .in("event_type", ["bounce", "bounced"])
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Get total sent (last 30 days)
      const { count: sentCount } = await supabase
        .from("email_tracking_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "sent")
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Get stale campaigns (rollup older than latest event)
      const { data: staleCampaigns } = await supabase
        .from("crm_campaigns")
        .select("id, name, rollup_refreshed_at")
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(10);

      // Get last purge timestamp from analytics_alerts
      const { data: lastPurge } = await supabase
        .from("analytics_alerts")
        .select("created_at, value")
        .eq("metric", "purge_completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Calculate rates
      const complaintRate =
        sentCount && sentCount > 0
          ? ((complaintCount || 0) / sentCount) * 100
          : 0;
      const bounceRate =
        sentCount && sentCount > 0 ? ((bounceCount || 0) / sentCount) * 100 : 0;

      // Calculate ingest lag
      let ingestLagMinutes = 0;
      if (latestEvent?.created_at) {
        const eventTime = new Date(latestEvent.created_at).getTime();
        const now = Date.now();
        ingestLagMinutes = Math.floor((now - eventTime) / (1000 * 60));
      }

      // Check and store alerts for threshold breaches
      const alerts: AnalyticsAlert[] = [];
      const now = new Date().toISOString();

      if (complaintRate > 0.3) {
        alerts.push({
          id: `complaint_${Date.now()}`,
          metric: "complaint_rate",
          value: complaintRate,
          threshold: 0.3,
          severity: "critical",
          created_at: now,
        });
      } else if (complaintRate > 0.1) {
        alerts.push({
          id: `complaint_${Date.now()}`,
          metric: "complaint_rate",
          value: complaintRate,
          threshold: 0.1,
          severity: "warning",
          created_at: now,
        });
      }

      if (bounceRate > 5) {
        alerts.push({
          id: `bounce_${Date.now()}`,
          metric: "bounce_rate",
          value: bounceRate,
          threshold: 5,
          severity: "critical",
          created_at: now,
        });
      } else if (bounceRate > 2) {
        alerts.push({
          id: `bounce_${Date.now()}`,
          metric: "bounce_rate",
          value: bounceRate,
          threshold: 2,
          severity: "warning",
          created_at: now,
        });
      }

      if (ingestLagMinutes > 10) {
        alerts.push({
          id: `ingest_${Date.now()}`,
          metric: "ingest_lag",
          value: ingestLagMinutes,
          threshold: 10,
          severity: "critical",
          created_at: now,
        });
      } else if (ingestLagMinutes > 2) {
        alerts.push({
          id: `ingest_${Date.now()}`,
          metric: "ingest_lag",
          value: ingestLagMinutes,
          threshold: 2,
          severity: "warning",
          created_at: now,
        });
      }

      return {
        ingestLagMinutes,
        complaintRate,
        bounceRate,
        complaintCount: complaintCount || 0,
        bounceCount: bounceCount || 0,
        sentCount: sentCount || 0,
        latestEventAt: latestEvent?.created_at,
        staleCampaigns: staleCampaigns || [],
        alerts,
        lastPurgeAt: lastPurge?.created_at,
        lastPurgeCount: lastPurge?.value,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Recompute mutation
  const recomputeMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase.rpc("recompute_campaign_metrics", {
        p_campaign_id: campaignId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Metrics recomputed");
      queryClient.invalidateQueries({ queryKey: ["analytics-health"] });
    },
    onError: () => {
      toast.error("Failed to recompute metrics");
    },
  });

  // Build metrics array
  const metrics: HealthMetric[] = healthData
    ? [
        {
          name: "Ingest Lag",
          value: `${healthData.ingestLagMinutes} min`,
          status:
            healthData.ingestLagMinutes <= 2
              ? "green"
              : healthData.ingestLagMinutes <= 10
                ? "yellow"
                : "red",
          threshold: "< 2 min green, < 10 min yellow",
          icon: <Clock className="h-5 w-5" />,
        },
        {
          name: "Complaint Rate (30d)",
          value: `${healthData.complaintRate.toFixed(3)}%`,
          status:
            healthData.complaintRate <= 0.1
              ? "green"
              : healthData.complaintRate <= 0.3
                ? "yellow"
                : "red",
          threshold: "< 0.1% green, < 0.3% yellow",
          icon: <MailWarning className="h-5 w-5" />,
        },
        {
          name: "Hard Bounce Rate (30d)",
          value: `${healthData.bounceRate.toFixed(2)}%`,
          status:
            healthData.bounceRate <= 2
              ? "green"
              : healthData.bounceRate <= 5
                ? "yellow"
                : "red",
          threshold: "< 2% green, < 5% yellow",
          icon: <Ban className="h-5 w-5" />,
        },
        {
          name: "Events Processed (30d)",
          value: healthData.sentCount.toLocaleString(),
          status: "green",
          threshold: "Info only",
          icon: <TrendingUp className="h-5 w-5" />,
        },
      ]
    : [];

  const getStatusCardSx = (status: "green" | "yellow" | "red") => {
    switch (status) {
      case "green":
        return {
          borderColor: "success.200",
          backgroundColor: "success.50",
          color: "success.700",
        };
      case "yellow":
        return {
          borderColor: "warning.200",
          backgroundColor: "warning.50",
          color: "warning.700",
        };
      case "red":
        return {
          borderColor: "danger.200",
          backgroundColor: "danger.50",
          color: "danger.700",
        };
    }
  };

  const getStatusIcon = (status: "green" | "yellow" | "red") => {
    switch (status) {
      case "green":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "yellow":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "red":
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  return (
      <PageContainer fullWidth>
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            alignItems={{ xs: "flex-start", lg: "center" }}
            justifyContent="space-between"
            spacing={2}
          >
            <Stack spacing={0.5}>
              <Typography level="h2">Analytics Health</Typography>
              <Typography level="body-sm" color="neutral">
                Monitor webhook processing, event ingestion, and deliverability
                metrics
              </Typography>
            </Stack>
            <JoyButton
              bloomVariant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              loading={isLoading}
              loadingPosition="start"
              startDecorator={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </JoyButton>
          </Stack>

          {healthData?.alerts && healthData.alerts.length > 0 ? (
            <JoyCard
              sx={{ borderColor: "warning.200", backgroundColor: "warning.50" }}
            >
              <JoyCardHeader
                title={`Active Alerts (${healthData.alerts.length})`}
                startDecorator={<Bell className="h-5 w-5 text-yellow-700" />}
              />
              <JoyCardContent>
                <Stack spacing={1.5}>
                  {healthData.alerts.map((alert) => (
                    <Sheet
                      key={alert.id}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        borderRadius: "var(--joy-radius-md)",
                        backgroundColor:
                          alert.severity === "critical"
                            ? "danger.50"
                            : "warning.100",
                        borderColor:
                          alert.severity === "critical"
                            ? "danger.200"
                            : "warning.200",
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        alignItems={{ xs: "flex-start", md: "center" }}
                        justifyContent="space-between"
                        spacing={1.5}
                      >
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                        >
                          {alert.severity === "critical" ? (
                            <XCircle className="h-5 w-5 text-red-600" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-yellow-600" />
                          )}
                          <Stack spacing={0.25}>
                            <Typography level="title-sm">
                              {alert.metric === "complaint_rate" &&
                                "Complaint Rate Threshold"}
                              {alert.metric === "bounce_rate" &&
                                "Bounce Rate Threshold"}
                              {alert.metric === "ingest_lag" &&
                                "Ingest Lag Threshold"}
                            </Typography>
                            <Typography level="body-sm" color="neutral">
                              Current:{" "}
                              {typeof alert.value === "number"
                                ? alert.value.toFixed(2)
                                : alert.value}
                              {alert.metric.includes("rate") ? "%" : " min"}{" "}
                              (Threshold: {alert.threshold}
                              {alert.metric.includes("rate") ? "%" : " min"})
                            </Typography>
                          </Stack>
                        </Stack>
                        <JoyStatusChip
                          label={alert.severity}
                          status={alert.severity}
                        />
                      </Stack>
                    </Sheet>
                  ))}
                </Stack>
              </JoyCardContent>
            </JoyCard>
          ) : null}

          <Grid container spacing={2}>
            {isLoading
              ? [...Array(4)].map((_, i) => (
                  <Grid key={i} xs={12} md={6} lg={3}>
                    <JoyCard>
                      <JoyCardContent sx={{ pt: 3 }}>
                        <JoySkeleton sx={{ height: 64, width: "100%" }} />
                      </JoyCardContent>
                    </JoyCard>
                  </Grid>
                ))
              : metrics.map((metric, idx) => (
                  <Grid key={idx} xs={12} md={6} lg={3}>
                    <JoyCard sx={getStatusCardSx(metric.status)}>
                      <JoyCardContent sx={{ pt: 3 }}>
                        <Stack
                          direction="row"
                          alignItems="flex-start"
                          justifyContent="space-between"
                          spacing={2}
                        >
                          <Stack spacing={0.5}>
                            <Typography level="body-sm" color="neutral">
                              {metric.name}
                            </Typography>
                            <Typography level="h2">{metric.value}</Typography>
                            <Typography level="body-xs" color="neutral">
                              {metric.threshold}
                            </Typography>
                          </Stack>
                          <Stack spacing={1} alignItems="flex-end">
                            {metric.icon}
                            {getStatusIcon(metric.status)}
                          </Stack>
                        </Stack>
                      </JoyCardContent>
                    </JoyCard>
                  </Grid>
                ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid xs={12} lg={6}>
              <JoyCard>
                <JoyCardHeader
                  title="Webhook Status"
                  description="Real-time event ingestion from email providers"
                  startDecorator={<Webhook className="h-5 w-5" />}
                />
                <JoyCardContent>
                  <Stack spacing={1.5}>
                    <Sheet
                      variant="soft"
                      color="neutral"
                      sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        spacing={2}
                      >
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                        >
                          <Activity className="h-4 w-4 text-green-600" />
                          <Typography level="title-sm">
                            Resend Webhook
                          </Typography>
                        </Stack>
                        <JoyStatusChip status="active" />
                      </Stack>
                    </Sheet>
                    <Sheet
                      variant="soft"
                      color="neutral"
                      sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        spacing={2}
                      >
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                        >
                          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                          <Typography level="title-sm">
                            Signature Verification
                          </Typography>
                        </Stack>
                        <JoyStatusChip status="enabled" />
                      </Stack>
                    </Sheet>
                    {healthData?.latestEventAt ? (
                      <Typography level="body-sm" color="neutral">
                        Last event:{" "}
                        {formatDistanceToNow(
                          new Date(healthData.latestEventAt),
                          { addSuffix: true },
                        )}
                      </Typography>
                    ) : null}
                    {healthData?.lastPurgeAt ? (
                      <Sheet
                        variant="soft"
                        color="neutral"
                        sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
                      >
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                          justifyContent="space-between"
                          spacing={1.5}
                        >
                          <Stack
                            direction="row"
                            spacing={1.5}
                            alignItems="center"
                          >
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Typography level="title-sm">
                              Last Retention Purge
                            </Typography>
                          </Stack>
                          <Typography level="body-sm" color="neutral">
                            {formatDistanceToNow(
                              new Date(healthData.lastPurgeAt),
                              { addSuffix: true },
                            )}
                            {healthData.lastPurgeCount
                              ? ` (${healthData.lastPurgeCount.toLocaleString()} events)`
                              : ""}
                          </Typography>
                        </Stack>
                      </Sheet>
                    ) : null}
                  </Stack>
                </JoyCardContent>
              </JoyCard>
            </Grid>

            <Grid xs={12} lg={6}>
              <JoyCard>
                <JoyCardHeader
                  title="30-Day Summary"
                  description="Email delivery and engagement overview"
                />
                <JoyCardContent>
                  {isLoading ? (
                    <JoySkeleton sx={{ height: 128, width: "100%" }} />
                  ) : (
                    <Stack spacing={1.5}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography level="body-sm" color="neutral">
                          Emails Sent
                        </Typography>
                        <Typography level="title-sm">
                          {healthData?.sentCount.toLocaleString()}
                        </Typography>
                      </Stack>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography level="body-sm" color="neutral">
                          Complaints
                        </Typography>
                        <Typography
                          level="title-sm"
                          sx={{
                            color:
                              healthData?.complaintRate &&
                              healthData.complaintRate > 0.1
                                ? "danger.600"
                                : undefined,
                          }}
                        >
                          {healthData?.complaintCount}
                        </Typography>
                      </Stack>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography level="body-sm" color="neutral">
                          Bounces
                        </Typography>
                        <Typography
                          level="title-sm"
                          sx={{
                            color:
                              healthData?.bounceRate &&
                              healthData.bounceRate > 2
                                ? "warning.600"
                                : undefined,
                          }}
                        >
                          {healthData?.bounceCount}
                        </Typography>
                      </Stack>
                    </Stack>
                  )}
                </JoyCardContent>
              </JoyCard>
            </Grid>
          </Grid>

          <JoyCard>
            <JoyCardHeader
              title="Recent Campaigns - Metric Freshness"
              description="Campaigns with potentially stale analytics that may need recomputation"
            />
            <JoyCardContent>
              {isLoading ? (
                <JoyTable containerSx={{ minWidth: 720 }}>
                  <JoyTableHead>
                    <JoyTableRow>
                      <JoyTableHeaderCell>Campaign</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Last Refreshed</JoyTableHeaderCell>
                      <JoyTableHeaderCell align="right">
                        Actions
                      </JoyTableHeaderCell>
                    </JoyTableRow>
                  </JoyTableHead>
                  <JoyTableBody>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <JoyTableRow key={index}>
                        {Array.from({ length: 3 }).map((__, cellIndex) => (
                          <JoyTableCell key={cellIndex}>
                            <JoySkeleton sx={{ height: 20, width: "100%" }} />
                          </JoyTableCell>
                        ))}
                      </JoyTableRow>
                    ))}
                  </JoyTableBody>
                </JoyTable>
              ) : healthData?.staleCampaigns &&
                healthData.staleCampaigns.length > 0 ? (
                <Sheet
                  variant="outlined"
                  sx={{ borderRadius: "var(--joy-radius-lg)" }}
                >
                  <JoyTable containerSx={{ minWidth: 720 }}>
                    <JoyTableHead>
                      <JoyTableRow>
                        <JoyTableHeaderCell>Campaign</JoyTableHeaderCell>
                        <JoyTableHeaderCell>Last Refreshed</JoyTableHeaderCell>
                        <JoyTableHeaderCell align="right">
                          Actions
                        </JoyTableHeaderCell>
                      </JoyTableRow>
                    </JoyTableHead>
                    <JoyTableBody>
                      {healthData.staleCampaigns.map((campaign: any) => (
                        <JoyTableRow key={campaign.id}>
                          <JoyTableCell
                            sx={{ fontWeight: "var(--joy-fontWeight-md)" }}
                          >
                            {campaign.name}
                          </JoyTableCell>
                          <JoyTableCell>
                            {campaign.rollup_refreshed_at ? (
                              formatDistanceToNow(
                                new Date(campaign.rollup_refreshed_at),
                                { addSuffix: true },
                              )
                            ) : (
                              <Typography level="body-sm" color="neutral">
                                Never
                              </Typography>
                            )}
                          </JoyTableCell>
                          <JoyTableCell sx={{ textAlign: "right" }}>
                            <JoyDropdownMenu>
                              <JoyDropdownMenuTrigger
                                aria-label={`Actions for ${campaign.name}`}
                                iconButtonSx={{
                                  width: 32,
                                  height: 32,
                                  ml: "auto",
                                }}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </JoyDropdownMenuTrigger>
                              <JoyDropdownMenuContent placement="bottom-end">
                                <JoyDropdownMenuItem
                                  startDecorator={
                                    <RefreshCw className="h-4 w-4" />
                                  }
                                  onClick={() =>
                                    recomputeMutation.mutate(campaign.id)
                                  }
                                  disabled={recomputeMutation.isPending}
                                >
                                  Recompute metrics
                                </JoyDropdownMenuItem>
                              </JoyDropdownMenuContent>
                            </JoyDropdownMenu>
                          </JoyTableCell>
                        </JoyTableRow>
                      ))}
                    </JoyTableBody>
                  </JoyTable>
                </Sheet>
              ) : (
                <Stack spacing={0.75} alignItems="center" sx={{ py: 5 }}>
                  <Clock
                    className="h-5 w-5"
                    style={{ color: "var(--joy-palette-neutral-400)" }}
                  />
                  <Typography level="title-sm">
                    No stale campaigns found
                  </Typography>
                  <Typography
                    level="body-sm"
                    color="neutral"
                    textAlign="center"
                  >
                    Recent campaign analytics are up to date.
                  </Typography>
                </Stack>
              )}
            </JoyCardContent>
          </JoyCard>

          <JoyCard>
            <JoyCardHeader title="Health Thresholds Reference" />
            <JoyCardContent>
              <Sheet
                variant="outlined"
                sx={{ borderRadius: "var(--joy-radius-lg)" }}
              >
                <JoyTable containerSx={{ minWidth: 720 }}>
                  <JoyTableHead>
                    <JoyTableRow>
                      <JoyTableHeaderCell>Metric</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Green</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Yellow</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Red</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Action</JoyTableHeaderCell>
                    </JoyTableRow>
                  </JoyTableHead>
                  <JoyTableBody>
                    <JoyTableRow>
                      <JoyTableCell
                        sx={{ fontWeight: "var(--joy-fontWeight-md)" }}
                      >
                        Ingest Lag
                      </JoyTableCell>
                      <JoyTableCell>≤ 2 minutes</JoyTableCell>
                      <JoyTableCell>2-10 minutes</JoyTableCell>
                      <JoyTableCell>&gt; 10 minutes</JoyTableCell>
                      <JoyTableCell sx={{ color: "neutral.500" }}>
                        Check webhook delivery
                      </JoyTableCell>
                    </JoyTableRow>
                    <JoyTableRow>
                      <JoyTableCell
                        sx={{ fontWeight: "var(--joy-fontWeight-md)" }}
                      >
                        Complaint Rate
                      </JoyTableCell>
                      <JoyTableCell>≤ 0.1%</JoyTableCell>
                      <JoyTableCell>0.1-0.3%</JoyTableCell>
                      <JoyTableCell>&gt; 0.3%</JoyTableCell>
                      <JoyTableCell sx={{ color: "neutral.500" }}>
                        Review list hygiene
                      </JoyTableCell>
                    </JoyTableRow>
                    <JoyTableRow>
                      <JoyTableCell
                        sx={{ fontWeight: "var(--joy-fontWeight-md)" }}
                      >
                        Hard Bounce Rate
                      </JoyTableCell>
                      <JoyTableCell>≤ 2%</JoyTableCell>
                      <JoyTableCell>2-5%</JoyTableCell>
                      <JoyTableCell>&gt; 5%</JoyTableCell>
                      <JoyTableCell sx={{ color: "neutral.500" }}>
                        Clean email list
                      </JoyTableCell>
                    </JoyTableRow>
                    <JoyTableRow>
                      <JoyTableCell
                        sx={{ fontWeight: "var(--joy-fontWeight-md)" }}
                      >
                        Webhook 5xx Rate
                      </JoyTableCell>
                      <JoyTableCell>≤ 1%</JoyTableCell>
                      <JoyTableCell>1-5%</JoyTableCell>
                      <JoyTableCell>&gt; 5%</JoyTableCell>
                      <JoyTableCell sx={{ color: "neutral.500" }}>
                        Check edge function logs
                      </JoyTableCell>
                    </JoyTableRow>
                  </JoyTableBody>
                </JoyTable>
              </Sheet>
            </JoyCardContent>
          </JoyCard>
        </Stack>
      </PageContainer>
  );
};

export default AnalyticsHealthPage;
