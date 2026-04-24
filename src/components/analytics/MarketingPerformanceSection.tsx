import Box from "@mui/joy/Box";
import Grid from "@mui/joy/Grid";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Globe, Mail, Megaphone, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { AnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { useTenant } from "@/hooks/useTenant";
import { GoogleAnalyticsCard } from "@/components/analytics/GoogleAnalyticsCard";
import { SocialAnalyticsTab } from "@/components/analytics/SocialAnalyticsTab";
import {
  formatCompactNumber,
  formatPercent,
  normalizePlatformLabel,
} from "@/components/analytics/analyticsUtils";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import {
  JoyTabs,
  JoyTabsContent,
  JoyTabsList,
  JoyTabsTrigger,
} from "@/components/joy/JoyTabs";
import { supabase } from "@/integrations/supabase/client";

type MarketingPerformanceSectionProps = {
  dateRange: number;
  gaConnected: boolean;
  overview: AnalyticsOverview;
  propertyId?: string;
};

type CampaignStatusCounts = {
  active: number;
  completed: number;
  draft: number;
  paused: number;
};

type MarketingSummary = {
  activeCampaigns: number;
  campaignStatusCounts: CampaignStatusCounts;
  campaignsConnected: boolean;
  campaignsPerWeek: Array<{ label: string; total: number }>;
  emailConnected: boolean;
  engagementRate: number;
  recentCampaignPerformance: Array<{
    clickRate: number;
    name: string;
    openRate: number;
  }>;
  sentMessages: number;
  socialConnected: boolean;
  socialPlatforms: string[];
  totalCustomers: number;
};

const normalizeCampaignStatus = (status: string | null) => {
  switch ((status ?? "").toLowerCase()) {
    case "sent":
    case "sent_with_errors":
    case "completed":
      return "completed" as const;
    case "active":
    case "scheduled":
    case "sending":
      return "active" as const;
    case "paused":
      return "paused" as const;
    default:
      return "draft" as const;
  }
};

export function MarketingPerformanceSection({
  dateRange,
  gaConnected,
  overview,
  propertyId,
}: MarketingPerformanceSectionProps) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const { data, error, isLoading, refetch } = useQuery<MarketingSummary>({
    queryKey: ["analytics-marketing-summary", user?.id, tenant?.id, dateRange],
    enabled: Boolean(user?.id && tenant?.id),
    queryFn: async () => {
      if (!user?.id || !tenant?.id) {
        return {
          activeCampaigns: 0,
          campaignStatusCounts: {
            active: 0,
            completed: 0,
            draft: 0,
            paused: 0,
          },
          campaignsConnected: false,
          campaignsPerWeek: [],
          emailConnected: false,
          engagementRate: 0,
          recentCampaignPerformance: [],
          sentMessages: 0,
          socialConnected: false,
          socialPlatforms: [],
          totalCustomers: 0,
        };
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const [
        socialConnections,
        totalCustomers,
        activeCampaigns,
        sentCampaigns,
        allCampaigns,
        sentMessages,
      ] = await Promise.all([
        supabase
          .from("social_connections")
          .select("platform")
          .eq("user_id", user.id)
          .eq("is_active", true),
        supabase
          .from("crm_customers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id),
        supabase
          .from("crm_campaigns")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("status", "active"),
        supabase
          .from("crm_campaigns")
          .select(
            "id, name, status, created_at, sent_at, total_sent, total_opens, total_clicks, open_rate, click_rate",
          )
          .eq("tenant_id", tenant.id)
          .not("sent_at", "is", null)
          .gte("sent_at", startDate.toISOString())
          .order("sent_at", { ascending: false })
          .limit(12),
        supabase
          .from("crm_campaigns")
          .select("id, status, created_at, sent_at")
          .eq("tenant_id", tenant.id)
          .gte("created_at", startDate.toISOString()),
        supabase
          .from("sms_messages")
          .select("id, crm_customers!inner(tenant_id)", {
            count: "exact",
            head: true,
          })
          .eq("status", "sent")
          .eq("crm_customers.tenant_id", tenant.id),
      ]);

      const campaignStatusCounts = (
        allCampaigns.data ?? []
      ).reduce<CampaignStatusCounts>(
        (accumulator, campaign) => {
          const normalized = normalizeCampaignStatus(campaign.status);
          accumulator[normalized] += 1;
          return accumulator;
        },
        { active: 0, completed: 0, draft: 0, paused: 0 },
      );

      const campaignsPerWeekMap = new Map<string, number>();

      for (const campaign of allCampaigns.data ?? []) {
        const weekLabel = format(
          startOfWeek(new Date(campaign.sent_at ?? campaign.created_at), {
            weekStartsOn: 1,
          }),
          "MMM d",
        );
        campaignsPerWeekMap.set(
          weekLabel,
          (campaignsPerWeekMap.get(weekLabel) ?? 0) + 1,
        );
      }

      const recentCampaignPerformance = (sentCampaigns.data ?? [])
        .slice(0, 5)
        .map((campaign) => ({
          clickRate: campaign.click_rate ?? 0,
          name: campaign.name,
          openRate: campaign.open_rate ?? 0,
        }))
        .reverse();

      const totalSent = (sentCampaigns.data ?? []).reduce(
        (sum, campaign) => sum + (campaign.total_sent ?? 0),
        0,
      );
      const totalEngaged = (sentCampaigns.data ?? []).reduce(
        (sum, campaign) =>
          sum + (campaign.total_opens ?? 0) + (campaign.total_clicks ?? 0),
        0,
      );

      return {
        activeCampaigns: activeCampaigns.count ?? 0,
        campaignStatusCounts,
        campaignsConnected: (allCampaigns.data?.length ?? 0) > 0,
        campaignsPerWeek: Array.from(campaignsPerWeekMap.entries()).map(
          ([label, total]) => ({ label, total }),
        ),
        emailConnected: (sentCampaigns.data?.length ?? 0) > 0,
        engagementRate: totalSent > 0 ? (totalEngaged / totalSent) * 100 : 0,
        recentCampaignPerformance,
        sentMessages: sentMessages.count ?? 0,
        socialConnected: (socialConnections.data?.length ?? 0) > 0,
        socialPlatforms: Array.from(
          new Set(
            (socialConnections.data ?? []).map((connection) =>
              normalizePlatformLabel(connection.platform),
            ),
          ),
        ),
        totalCustomers: totalCustomers.count ?? 0,
      };
    },
  });

  const channelStates = [
    {
      id: "website",
      icon: <Globe size={16} />,
      label: "Website",
      active: gaConnected,
      description: gaConnected ? "GA4 connected" : "Connection required",
    },
    {
      id: "social",
      icon: <Share2 size={16} />,
      label: "Social",
      active: data?.socialConnected ?? false,
      description: data?.socialPlatforms.length
        ? data.socialPlatforms.join(", ")
        : "No social accounts connected",
    },
    {
      id: "email",
      icon: <Mail size={16} />,
      label: "Email",
      active: data?.emailConnected ?? false,
      description: data?.emailConnected
        ? "Campaign history detected"
        : "No sent campaigns yet",
    },
    {
      id: "campaigns",
      icon: <Megaphone size={16} />,
      label: "Campaigns",
      active: data?.campaignsConnected ?? false,
      description: data?.campaignsConnected
        ? "Campaign objects available"
        : "No campaigns created yet",
    },
  ];

  const marketingMetrics = [
    {
      label: "Total Reach",
      value: formatCompactNumber(overview.totalViews),
    },
    {
      label: "Clicks",
      value: formatCompactNumber(overview.clicks),
    },
    {
      label: "Engagement Rate",
      value: formatPercent(overview.engagementRate),
    },
    {
      label: "Conversions",
      value: formatCompactNumber(overview.conversions),
    },
  ];

  const renderSectionError = (sectionLabel: string) => (
    <JoyCard variant="soft" color="danger">
      <JoyCardContent sx={{ pt: 4 }}>
        <Stack spacing={1.5}>
          <Typography level="body-sm">
            Failed to load {sectionLabel}.
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

  return (
    <Stack spacing={1.75}>
      <Stack spacing={0.5}>
        <Typography level="title-lg" sx={{ color: "neutral.900" }}>
          Marketing Performance
        </Typography>
        <Typography level="body-sm" sx={{ color: "neutral.500" }}>
          Channel-by-channel performance with connection-aware status and
          campaign detail.
        </Typography>
      </Stack>

      <JoyCard variant="outlined">
        <JoyCardHeader title="Channel Performance" />
        <JoyCardContent sx={{ pt: 3 }}>
          <Stack spacing={2}>
            <Grid container spacing={1.25}>
              {channelStates.map((channel) => (
                <Grid key={channel.id} xs={12} sm={6} lg={3}>
                  <Sheet
                    variant="soft"
                    color={channel.active ? "success" : "neutral"}
                    sx={{ p: 1.25, borderRadius: "md" }}
                  >
                    <Stack spacing={0.6}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        {channel.icon}
                        <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                          {channel.label}
                        </Typography>
                      </Stack>
                      <Typography
                        level="body-xs"
                        sx={{
                          color: channel.active ? "success.800" : "neutral.600",
                        }}
                      >
                        {channel.description}
                      </Typography>
                    </Stack>
                  </Sheet>
                </Grid>
              ))}
            </Grid>

            <JoyTabs defaultValue="website">
              <JoyTabsList>
                <JoyTabsTrigger value="website">
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Globe size={14} />
                    <Typography
                      level="body-sm"
                      sx={{ display: { xs: "none", sm: "block" } }}
                    >
                      Website
                    </Typography>
                  </Stack>
                </JoyTabsTrigger>
                <JoyTabsTrigger value="social">
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Share2 size={14} />
                    <Typography
                      level="body-sm"
                      sx={{ display: { xs: "none", sm: "block" } }}
                    >
                      Social Media
                    </Typography>
                  </Stack>
                </JoyTabsTrigger>
                <JoyTabsTrigger value="email">
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Mail size={14} />
                    <Typography
                      level="body-sm"
                      sx={{ display: { xs: "none", sm: "block" } }}
                    >
                      Email
                    </Typography>
                  </Stack>
                </JoyTabsTrigger>
                <JoyTabsTrigger value="campaigns">
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Megaphone size={14} />
                    <Typography
                      level="body-sm"
                      sx={{ display: { xs: "none", sm: "block" } }}
                    >
                      Campaigns
                    </Typography>
                  </Stack>
                </JoyTabsTrigger>
              </JoyTabsList>

              <JoyTabsContent value="website">
                {gaConnected && propertyId ? (
                  <GoogleAnalyticsCard
                    propertyId={propertyId}
                    dateRange={dateRange}
                  />
                ) : (
                  <JoyCard variant="soft" color="neutral">
                    <JoyCardContent sx={{ pt: 4 }}>
                      <JoyEmptyState
                        icon={<Globe />}
                        title="Connect Google Analytics"
                        description="See traffic, top markets, and website engagement once your GA4 property is linked."
                        primaryAction={{
                          label: "Connect",
                          onClick: () => navigate("/integrations"),
                        }}
                      />
                    </JoyCardContent>
                  </JoyCard>
                )}
              </JoyTabsContent>

              <JoyTabsContent value="social">
                <SocialAnalyticsTab dateRange={dateRange} />
              </JoyTabsContent>

              <JoyTabsContent value="email">
                {error ? (
                  renderSectionError("email analytics")
                ) : isLoading ? (
                  <JoyCard variant="outlined">
                    <JoyCardContent sx={{ pt: 4 }}>
                      <Typography level="body-sm" sx={{ color: "neutral.400" }}>
                        Loading email performance…
                      </Typography>
                    </JoyCardContent>
                  </JoyCard>
                ) : data?.recentCampaignPerformance.length ? (
                  <JoyCard variant="outlined">
                    <JoyCardHeader title="Email Channel Summary" />
                    <JoyCardContent sx={{ pt: 3 }}>
                      <Stack spacing={2}>
                        <Grid container spacing={1.25}>
                          {[
                            {
                              label: "Total Customers",
                              value: formatCompactNumber(data.totalCustomers),
                            },
                            {
                              label: "Active Campaigns",
                              value: formatCompactNumber(data.activeCampaigns),
                            },
                            {
                              label: "Messages Sent",
                              value: formatCompactNumber(data.sentMessages),
                            },
                            {
                              label: "Engagement Rate",
                              value: formatPercent(data.engagementRate),
                            },
                          ].map((metric) => (
                            <Grid key={metric.label} xs={12} sm={6} lg={3}>
                              <Sheet
                                variant="soft"
                                color="neutral"
                                sx={{ p: 1.25, borderRadius: "md" }}
                              >
                                <Typography
                                  level="body-xs"
                                  sx={{ color: "neutral.500" }}
                                >
                                  {metric.label}
                                </Typography>
                                <Typography
                                  level="title-md"
                                  sx={{ fontWeight: 700, color: "neutral.900" }}
                                >
                                  {metric.value}
                                </Typography>
                              </Sheet>
                            </Grid>
                          ))}
                        </Grid>

                        <Box sx={{ height: 240 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={data.recentCampaignPerformance}
                              layout="vertical"
                              margin={{
                                top: 8,
                                right: 16,
                                left: 12,
                                bottom: 0,
                              }}
                            >
                              <CartesianGrid
                                stroke="rgba(var(--joy-palette-neutral-mainChannel) / 0.08)"
                                horizontal={false}
                              />
                              <XAxis
                                type="number"
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                dataKey="name"
                                type="category"
                                axisLine={false}
                                tickLine={false}
                                width={120}
                                tickFormatter={(value) =>
                                  `${value}`.slice(0, 16)
                                }
                              />
                              <Tooltip />
                              <Bar
                                dataKey="openRate"
                                fill="var(--joy-palette-primary-500)"
                                name="Open Rate"
                                radius={[0, 6, 6, 0]}
                              />
                              <Bar
                                dataKey="clickRate"
                                fill="var(--joy-palette-neutral-800)"
                                name="Click Rate"
                                radius={[0, 6, 6, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      </Stack>
                    </JoyCardContent>
                  </JoyCard>
                ) : (
                  <JoyCard variant="soft" color="neutral">
                    <JoyCardContent sx={{ pt: 4 }}>
                      <JoyEmptyState
                        icon={<Mail />}
                        title="No sent campaigns yet"
                        description="Send your first campaign to unlock email channel benchmarks and campaign-level performance."
                        primaryAction={{
                          label: "Create campaign",
                          onClick: () => navigate("/crm/campaigns/new"),
                        }}
                      />
                    </JoyCardContent>
                  </JoyCard>
                )}
              </JoyTabsContent>

              <JoyTabsContent value="campaigns">
                {error ? (
                  renderSectionError("campaign summaries")
                ) : isLoading ? (
                  <JoyCard variant="outlined">
                    <JoyCardContent sx={{ pt: 4 }}>
                      <Typography level="body-sm" sx={{ color: "neutral.400" }}>
                        Loading campaign summaries…
                      </Typography>
                    </JoyCardContent>
                  </JoyCard>
                ) : data?.campaignsConnected ? (
                  <JoyCard variant="outlined">
                    <JoyCardHeader title="Campaign Summary" />
                    <JoyCardContent sx={{ pt: 3 }}>
                      <Stack spacing={2}>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          flexWrap="wrap"
                          useFlexGap
                        >
                          <JoyChip size="sm" variant="soft" color="neutral">
                            {data.campaignStatusCounts.draft} Draft
                          </JoyChip>
                          <JoyChip size="sm" variant="soft" color="primary">
                            {data.campaignStatusCounts.active} Active
                          </JoyChip>
                          <JoyChip size="sm" variant="soft" color="success">
                            {data.campaignStatusCounts.completed} Completed
                          </JoyChip>
                          <JoyChip size="sm" variant="soft" color="warning">
                            {data.campaignStatusCounts.paused} Paused
                          </JoyChip>
                        </Stack>

                        <Box sx={{ height: 220 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={data.campaignsPerWeek}
                              margin={{ left: 0, right: 12, top: 8, bottom: 0 }}
                            >
                              <CartesianGrid
                                stroke="rgba(var(--joy-palette-neutral-mainChannel) / 0.08)"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                allowDecimals={false}
                                axisLine={false}
                                tickLine={false}
                                width={40}
                              />
                              <Tooltip />
                              <Bar
                                dataKey="total"
                                fill="var(--joy-palette-primary-500)"
                                radius={[8, 8, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      </Stack>
                    </JoyCardContent>
                  </JoyCard>
                ) : (
                  <JoyCard variant="soft" color="neutral">
                    <JoyCardContent sx={{ pt: 4 }}>
                      <JoyEmptyState
                        icon={<Megaphone />}
                        title="No campaigns yet"
                        description="Create your first campaign to start tracking status mix and weekly send volume."
                        primaryAction={{
                          label: "Create campaign",
                          onClick: () => navigate("/crm/campaigns/new"),
                        }}
                      />
                    </JoyCardContent>
                  </JoyCard>
                )}
              </JoyTabsContent>
            </JoyTabs>

            <Grid container spacing={1.25}>
              {marketingMetrics.map((metric) => (
                <Grid key={metric.label} xs={12} sm={6} lg={3}>
                  <Sheet
                    variant="soft"
                    color="neutral"
                    sx={{ p: 1.25, borderRadius: "md" }}
                  >
                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                      {metric.label}
                    </Typography>
                    <Typography
                      level="title-md"
                      sx={{
                        color: "neutral.900",
                        fontWeight: 700,
                        fontFamily: "var(--joy-fontFamily-display)",
                      }}
                    >
                      {overview.loading ? "—" : metric.value}
                    </Typography>
                  </Sheet>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </JoyCardContent>
      </JoyCard>
    </Stack>
  );
}
