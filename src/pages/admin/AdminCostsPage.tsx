import { useState, useEffect } from "react";
import CircularProgress from "@mui/joy/CircularProgress";
import Grid from "@mui/joy/Grid";
import JoySkeleton from "@mui/joy/Skeleton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Link, Navigate } from "react-router-dom";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { PageContainer } from "@/components/joy/PageContainer";
import {
  DollarSign,
  Mail,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Users,
  ArrowLeft,
  Activity,
} from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";

interface TenantUsage {
  tenant_id: string;
  tenant_name: string;
  email_sent: number;
  sms_sent: number;
  sync_jobs: number;
  automations_run: number;
}

interface PlatformMetrics {
  totalEmailsSent: number;
  totalSmsSent: number;
  totalSyncJobs: number;
  totalAutomationsRun: number;
  activeTenants: number;
  avgEmailsPerTenant: number;
  avgSmsPerTenant: number;
}

interface AnomalyTenant {
  tenant_id: string;
  tenant_name: string;
  metric: string;
  value: number;
  average: number;
  multiplier: number;
}

export default function AdminCostsPage() {
  const { data: isSuperAdmin, isLoading: adminLoading } = useIsSuperAdmin();
  const [loading, setLoading] = useState(true);
  const [platformMetrics, setPlatformMetrics] =
    useState<PlatformMetrics | null>(null);
  const [topTenants, setTopTenants] = useState<TenantUsage[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyTenant[]>([]);
  const [dateRange, setDateRange] = useState<"today" | "week" | "month">(
    "month",
  );

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCostData();
    }
  }, [isSuperAdmin, dateRange]);

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return format(now, "yyyy-MM-dd");
      case "week":
        return format(subDays(now, 7), "yyyy-MM-dd");
      case "month":
        return format(startOfMonth(now), "yyyy-MM-dd");
      default:
        return format(startOfMonth(now), "yyyy-MM-dd");
    }
  };

  const fetchCostData = async () => {
    setLoading(true);
    try {
      const startDate = getDateFilter();

      // Fetch email campaigns with sent counts by tenant
      const { data: emailCampaigns } = await supabase
        .from("crm_campaigns")
        .select("tenant_id, total_sent")
        .not("sent_at", "is", null)
        .gte("sent_at", startDate);

      // Fetch SMS campaigns with counts by tenant
      const { data: smsCampaigns } = await supabase
        .from("crm_sms_campaigns")
        .select("tenant_id, total_enqueued, metrics")
        .not("sent_at", "is", null)
        .gte("sent_at", startDate);

      // Fetch sync jobs by tenant
      const { data: syncData } = await supabase
        .from("pos_sync_jobs_v2")
        .select("tenant_id, status")
        .gte("created_at", startDate);

      // Fetch automation runs
      const { data: automationData } = await supabase
        .from("automation_events")
        .select("automation_id")
        .gte("created_at", startDate);

      // Fetch tenant names
      const { data: tenants } = await supabase
        .from("tenants")
        .select("id, name");

      const tenantMap = new Map(tenants?.map((t) => [t.id, t.name]) || []);

      // Aggregate by tenant
      const tenantUsageMap = new Map<string, TenantUsage>();

      emailCampaigns?.forEach((c) => {
        if (!c.tenant_id) return;
        const existing = tenantUsageMap.get(c.tenant_id) || {
          tenant_id: c.tenant_id,
          tenant_name: tenantMap.get(c.tenant_id) || "Unknown",
          email_sent: 0,
          sms_sent: 0,
          sync_jobs: 0,
          automations_run: 0,
        };
        existing.email_sent += c.total_sent || 0;
        tenantUsageMap.set(c.tenant_id, existing);
      });

      smsCampaigns?.forEach((c) => {
        if (!c.tenant_id) return;
        const existing = tenantUsageMap.get(c.tenant_id) || {
          tenant_id: c.tenant_id,
          tenant_name: tenantMap.get(c.tenant_id) || "Unknown",
          email_sent: 0,
          sms_sent: 0,
          sync_jobs: 0,
          automations_run: 0,
        };
        // Get sent count from metrics or fall back to total_enqueued
        const metrics = c.metrics as Record<string, number> | null;
        const sentCount = metrics?.sent || c.total_enqueued || 0;
        existing.sms_sent += sentCount;
        tenantUsageMap.set(c.tenant_id, existing);
      });

      syncData?.forEach((s) => {
        if (!s.tenant_id) return;
        const existing = tenantUsageMap.get(s.tenant_id) || {
          tenant_id: s.tenant_id,
          tenant_name: tenantMap.get(s.tenant_id) || "Unknown",
          email_sent: 0,
          sms_sent: 0,
          sync_jobs: 0,
          automations_run: 0,
        };
        existing.sync_jobs++;
        tenantUsageMap.set(s.tenant_id, existing);
      });

      const allTenants = Array.from(tenantUsageMap.values());

      // Calculate platform metrics
      const totalEmails = allTenants.reduce((sum, t) => sum + t.email_sent, 0);
      const totalSms = allTenants.reduce((sum, t) => sum + t.sms_sent, 0);
      const totalSync = allTenants.reduce((sum, t) => sum + t.sync_jobs, 0);
      const activeTenantCount = allTenants.filter(
        (t) => t.email_sent > 0 || t.sms_sent > 0,
      ).length;

      setPlatformMetrics({
        totalEmailsSent: totalEmails,
        totalSmsSent: totalSms,
        totalSyncJobs: totalSync,
        totalAutomationsRun: automationData?.length || 0,
        activeTenants: activeTenantCount,
        avgEmailsPerTenant:
          activeTenantCount > 0
            ? Math.round(totalEmails / activeTenantCount)
            : 0,
        avgSmsPerTenant:
          activeTenantCount > 0 ? Math.round(totalSms / activeTenantCount) : 0,
      });

      // Top 10 by total usage
      const sorted = allTenants
        .map((t) => ({
          ...t,
          total: t.email_sent + t.sms_sent * 10 + t.sync_jobs,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
      setTopTenants(sorted);

      // Find anomalies (>3x average)
      const avgEmail =
        activeTenantCount > 0 ? totalEmails / activeTenantCount : 0;
      const avgSms = activeTenantCount > 0 ? totalSms / activeTenantCount : 0;
      const avgSync = activeTenantCount > 0 ? totalSync / activeTenantCount : 0;

      const anomalyList: AnomalyTenant[] = [];
      allTenants.forEach((t) => {
        if (avgEmail > 0 && t.email_sent > avgEmail * 3) {
          anomalyList.push({
            tenant_id: t.tenant_id,
            tenant_name: t.tenant_name,
            metric: "Emails",
            value: t.email_sent,
            average: Math.round(avgEmail),
            multiplier: Math.round((t.email_sent / avgEmail) * 10) / 10,
          });
        }
        if (avgSms > 0 && t.sms_sent > avgSms * 3) {
          anomalyList.push({
            tenant_id: t.tenant_id,
            tenant_name: t.tenant_name,
            metric: "SMS",
            value: t.sms_sent,
            average: Math.round(avgSms),
            multiplier: Math.round((t.sms_sent / avgSms) * 10) / 10,
          });
        }
        if (avgSync > 0 && t.sync_jobs > avgSync * 3) {
          anomalyList.push({
            tenant_id: t.tenant_id,
            tenant_name: t.tenant_name,
            metric: "Sync Jobs",
            value: t.sync_jobs,
            average: Math.round(avgSync),
            multiplier: Math.round((t.sync_jobs / avgSync) * 10) / 10,
          });
        }
      });

      setAnomalies(anomalyList.sort((a, b) => b.multiplier - a.multiplier));
    } catch (error) {
      console.error("Error fetching cost data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (adminLoading) {
    return (
      <PageContainer>
        <Stack
          minHeight="40vh"
          alignItems="center"
          justifyContent="center"
          spacing={2}
        >
          <CircularProgress size="md" />
          <Typography level="body-sm" color="neutral">
            Loading cost dashboard...
          </Typography>
        </Stack>
      </PageContainer>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <PageContainer fullWidth>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", xl: "row" }}
          alignItems={{ xs: "flex-start", xl: "center" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <JoyButton
              aria-label="Back to admin"
              bloomVariant="ghost"
              component={Link}
              size="icon"
              to="/admin"
            >
              <ArrowLeft className="h-5 w-5" />
            </JoyButton>
            <DollarSign className="w-8 h-8 text-green-500" />
            <Stack spacing={0.5}>
              <Typography level="h2">Cost Dashboard</Typography>
              <Typography level="body-sm" color="neutral">
                Platform resource usage and cost monitoring
              </Typography>
            </Stack>
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {(["today", "week", "month"] as const).map((range) => (
                <JoyButton
                  key={range}
                  bloomVariant={dateRange === range ? "default" : "outline"}
                  onClick={() => setDateRange(range)}
                  size="sm"
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </JoyButton>
              ))}
            </Stack>
            <JoyButton
              aria-label="Refresh cost data"
              bloomVariant="outline"
              loading={loading}
              onClick={fetchCostData}
              size="icon"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </JoyButton>
          </Stack>
        </Stack>

        <Grid container spacing={2}>
          <Grid xs={12} md={6} xl={3}>
            <JoyCard>
              <JoyCardContent sx={{ pt: 3 }}>
                <Stack spacing={1.5}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <Stack spacing={0.5}>
                      <Typography level="body-sm" color="neutral">
                        Emails Sent
                      </Typography>
                      {loading ? (
                        <JoySkeleton sx={{ height: 32, width: 80, mt: 1 }} />
                      ) : (
                        <Typography level="h2">
                          {platformMetrics?.totalEmailsSent.toLocaleString()}
                        </Typography>
                      )}
                    </Stack>
                    <Mail className="h-8 w-8 text-blue-500 opacity-50" />
                  </Stack>
                  <Typography level="body-xs" color="neutral">
                    ~$
                    {((platformMetrics?.totalEmailsSent || 0) * 0.001).toFixed(
                      2,
                    )}{" "}
                    est. cost
                  </Typography>
                </Stack>
              </JoyCardContent>
            </JoyCard>
          </Grid>
          <Grid xs={12} md={6} xl={3}>
            <JoyCard>
              <JoyCardContent sx={{ pt: 3 }}>
                <Stack spacing={1.5}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <Stack spacing={0.5}>
                      <Typography level="body-sm" color="neutral">
                        SMS Sent
                      </Typography>
                      {loading ? (
                        <JoySkeleton sx={{ height: 32, width: 80, mt: 1 }} />
                      ) : (
                        <Typography level="h2">
                          {platformMetrics?.totalSmsSent.toLocaleString()}
                        </Typography>
                      )}
                    </Stack>
                    <MessageSquare className="h-8 w-8 text-purple-500 opacity-50" />
                  </Stack>
                  <Typography level="body-xs" color="neutral">
                    ~$
                    {((platformMetrics?.totalSmsSent || 0) * 0.0079).toFixed(
                      2,
                    )}{" "}
                    est. cost
                  </Typography>
                </Stack>
              </JoyCardContent>
            </JoyCard>
          </Grid>
          <Grid xs={12} md={6} xl={3}>
            <JoyCard>
              <JoyCardContent sx={{ pt: 3 }}>
                <Stack spacing={1.5}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <Stack spacing={0.5}>
                      <Typography level="body-sm" color="neutral">
                        POS Sync Jobs
                      </Typography>
                      {loading ? (
                        <JoySkeleton sx={{ height: 32, width: 80, mt: 1 }} />
                      ) : (
                        <Typography level="h2">
                          {platformMetrics?.totalSyncJobs.toLocaleString()}
                        </Typography>
                      )}
                    </Stack>
                    <RefreshCw className="h-8 w-8 text-green-500 opacity-50" />
                  </Stack>
                  <Typography level="body-xs" color="neutral">
                    Edge function invocations
                  </Typography>
                </Stack>
              </JoyCardContent>
            </JoyCard>
          </Grid>
          <Grid xs={12} md={6} xl={3}>
            <JoyCard>
              <JoyCardContent sx={{ pt: 3 }}>
                <Stack spacing={1.5}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <Stack spacing={0.5}>
                      <Typography level="body-sm" color="neutral">
                        Active Tenants
                      </Typography>
                      {loading ? (
                        <JoySkeleton sx={{ height: 32, width: 80, mt: 1 }} />
                      ) : (
                        <Typography level="h2">
                          {platformMetrics?.activeTenants}
                        </Typography>
                      )}
                    </Stack>
                    <Users className="h-8 w-8 text-amber-500 opacity-50" />
                  </Stack>
                  <Typography level="body-xs" color="neutral">
                    Avg: {platformMetrics?.avgEmailsPerTenant} emails/tenant
                  </Typography>
                </Stack>
              </JoyCardContent>
            </JoyCard>
          </Grid>
        </Grid>

        {anomalies.length > 0 ? (
          <JoyCard
            sx={{ borderColor: "warning.200", backgroundColor: "warning.50" }}
          >
            <JoyCardHeader
              title="Usage Anomalies Detected"
              description="These tenants are using >3x more resources than average."
              startDecorator={
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              }
            />
            <JoyCardContent>
              <Stack spacing={1.5}>
                {anomalies.slice(0, 5).map((anomaly, idx) => (
                  <Sheet
                    key={idx}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: "var(--joy-radius-md)",
                      backgroundColor: "background.surface",
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      spacing={1.5}
                    >
                      <Stack spacing={0.5}>
                        <Typography level="title-sm">
                          {anomaly.tenant_name}
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                          {anomaly.metric}: {anomaly.value.toLocaleString()}{" "}
                          (avg: {anomaly.average.toLocaleString()})
                        </Typography>
                      </Stack>
                      <JoyChip bloomVariant="destructive">
                        {anomaly.multiplier}x average
                      </JoyChip>
                    </Stack>
                  </Sheet>
                ))}
              </Stack>
            </JoyCardContent>
          </JoyCard>
        ) : null}

        <JoyCard>
          <JoyCardHeader
            title="Top 10 Resource Consumers"
            description={`Tenants with highest combined usage this ${dateRange}`}
            startDecorator={<TrendingUp className="h-5 w-5" />}
          />
          <JoyCardContent>
            {loading ? (
              <Stack spacing={1.5}>
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </Stack>
            ) : topTenants.length === 0 ? (
              <Typography
                level="body-sm"
                color="neutral"
                textAlign="center"
                sx={{ py: 4 }}
              >
                No usage data found for this period
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {topTenants.map((tenant, idx) => (
                  <Sheet
                    key={tenant.tenant_id}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: "var(--joy-radius-md)",
                      transition: "background-color 0.18s ease",
                      "&:hover": { backgroundColor: "neutral.50" },
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", lg: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", lg: "center" }}
                      spacing={1.5}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography
                          level="title-md"
                          color="neutral"
                          sx={{ width: 24 }}
                        >
                          #{idx + 1}
                        </Typography>
                        <Stack spacing={0.25}>
                          <Typography level="title-sm">
                            <JoySkeleton key={i} sx={{ height: 48, width: "100%" }} />
                          </Typography>
                          <Typography
                            level="body-xs"
                            color="neutral"
                            fontFamily="monospace"
                          >
                            {tenant.tenant_id.slice(0, 8)}...
                          </Typography>
                        </Stack>
                      </Stack>
                      <Stack direction="row" spacing={3}>
                        <Stack spacing={0.25} alignItems="center">
                          <Typography level="title-sm">
                            {tenant.email_sent.toLocaleString()}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            Emails
                          </Typography>
                        </Stack>
                        <Stack spacing={0.25} alignItems="center">
                          <Typography level="title-sm">
                            {tenant.sms_sent.toLocaleString()}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            SMS
                          </Typography>
                        </Stack>
                        <Stack spacing={0.25} alignItems="center">
                          <Typography level="title-sm">
                            {tenant.sync_jobs}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            Syncs
                          </Typography>
                        </Stack>
                      </Stack>
                    </Stack>
                  </Sheet>
                ))}
              </Stack>
            )}
          </JoyCardContent>
        </JoyCard>

        <JoyCard>
          <JoyCardHeader
            title={`Estimated Platform Costs (${dateRange})`}
            description="Based on current usage rates and provider pricing"
            startDecorator={<Activity className="h-5 w-5" />}
          />
          <JoyCardContent>
            <Grid container spacing={2}>
              <Grid xs={12} md={4}>
                <Sheet
                  variant="soft"
                  color="primary"
                  sx={{ p: 2, borderRadius: "var(--joy-radius-md)" }}
                >
                  <Stack spacing={0.5}>
                    <Typography
                      level="body-sm"
                      sx={{
                        color: "var(--joy-palette-primary-700)",
                        fontWeight: "md",
                      }}
                    >
                      Resend (Email)
                    </Typography>
                    <Typography
                      level="h2"
                      sx={{ color: "var(--joy-palette-primary-800)" }}
                    >
                      $
                      {(
                        (platformMetrics?.totalEmailsSent || 0) * 0.001
                      ).toFixed(2)}
                    </Typography>
                    <Typography
                      level="body-xs"
                      sx={{ color: "var(--joy-palette-primary-600)" }}
                    >
                      $0.001/email after free tier
                    </Typography>
                  </Stack>
                </Sheet>
              </Grid>
              <Grid xs={12} md={4}>
                <Sheet
                  variant="soft"
                  color="secondary"
                  sx={{ p: 2, borderRadius: "var(--joy-radius-md)" }}
                >
                  <Stack spacing={0.5}>
                    <Typography
                      level="body-sm"
                      sx={{
                        color: "var(--joy-palette-neutral-700)",
                        fontWeight: "md",
                      }}
                    >
                      Twilio (SMS)
                    </Typography>
                    <Typography
                      level="h2"
                      sx={{ color: "var(--joy-palette-neutral-800)" }}
                    >
                      $
                      {((platformMetrics?.totalSmsSent || 0) * 0.0079).toFixed(
                        2,
                      )}
                    </Typography>
                    <Typography
                      level="body-xs"
                      sx={{ color: "var(--joy-palette-neutral-600)" }}
                    >
                      ~$0.0079/SMS (US)
                    </Typography>
                  </Stack>
                </Sheet>
              </Grid>
              <Grid xs={12} md={4}>
                <Sheet
                  variant="soft"
                  color="success"
                  sx={{ p: 2, borderRadius: "var(--joy-radius-md)" }}
                >
                  <Stack spacing={0.5}>
                    <Typography
                      level="body-sm"
                      sx={{
                        color: "var(--joy-palette-success-700)",
                        fontWeight: "md",
                      }}
                    >
                      Supabase Edge
                    </Typography>
                    <Typography
                      level="h2"
                      sx={{ color: "var(--joy-palette-success-800)" }}
                    >
                      $
                      {(
                        (platformMetrics?.totalSyncJobs || 0) * 0.000002
                      ).toFixed(4)}
                    </Typography>
                    <Typography
                      level="body-xs"
                      sx={{ color: "var(--joy-palette-success-600)" }}
                    >
                      ~$0.000002/invocation
                    </Typography>
                  </Stack>
                </Sheet>
              </Grid>
            </Grid>
            <Sheet
              variant="soft"
              color="neutral"
              sx={{ mt: 2, p: 2, borderRadius: "var(--joy-radius-md)" }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                spacing={2}
              >
                <Typography level="title-sm">
                  Estimated Total ({dateRange})
                </Typography>
                <Typography level="h2">
                  {(
                    (platformMetrics?.totalEmailsSent || 0) * 0.001 +
                    (platformMetrics?.totalSmsSent || 0) * 0.0079 +
                    (platformMetrics?.totalSyncJobs || 0) * 0.000002
                  ).toLocaleString(undefined, {
                    style: "currency",
                    currency: "USD",
                  })}
                </Typography>
              </Stack>
            </Sheet>
          </JoyCardContent>
        </JoyCard>
      </Stack>
    </PageContainer>
  );
}
