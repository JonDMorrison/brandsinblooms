import { useEffect, useState } from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Activity, BarChart3, FileText, Sparkles, Users, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useSubscription as useLegacySubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

interface UsageData {
  postsCreated: number;
  maxPosts: number;
  connectionsUsed: number;
  maxConnections: number;
  tokensRemaining: number;
  maxTokens: number;
}

const surfaceStyles = {
  borderRadius: "24px",
  borderColor: "divider",
  bgcolor: "background.surface",
  boxShadow: "sm",
  p: { xs: 2.5, sm: 3 },
};

const getUsagePercentage = (used: number, max: number) => {
  if (max <= 0 || max === -1) {
    return 0;
  }

  return Math.min((used / max) * 100, 100);
};

const getUsageStatus = (percentage: number, unlimited: boolean) => {
  if (unlimited) {
    return { label: "Unlimited", color: "neutral" as const };
  }

  if (percentage > 80) {
    return { label: "Near Limit", color: "warning" as const };
  }

  return { label: "Normal", color: "neutral" as const };
};

export const UsageAnalytics = () => {
  const { subscription, loading } = useSubscription();
  const { subscription: subscriptionLimits, loading: limitsLoading } = useLegacySubscription();
  const { user } = useAuth();
  const [usageData, setUsageData] = useState<UsageData>({
    postsCreated: 0,
    maxPosts: 0,
    connectionsUsed: 0,
    maxConnections: 0,
    tokensRemaining: 0,
    maxTokens: 0,
  });
  const [usageLoading, setUsageLoading] = useState(true);

  useEffect(() => {
    const fetchUsageData = async () => {
      if (!user || !subscription) {
        setUsageLoading(false);
        return;
      }

      try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: postsCount } = await supabase
          .from('content_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', startOfMonth.toISOString());

        const { count: connectionsCount } = await supabase
          .from('social_connections')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_active', true);

        const { data: profile } = await supabase
          .from('company_profiles')
          .select('tokens_balance')
          .eq('user_id', user.id)
          .single();

        const isExpiredPlan = (subscription.tier ?? subscription.plan) === 'expired';
        const fallbackPosts = isExpiredPlan ? 0 : 200;
        const fallbackConnections = isExpiredPlan ? 0 : 4;
        const fallbackTokens = isExpiredPlan ? 0 : 200;
        const maxPosts = subscriptionLimits?.max_posts_per_month ?? fallbackPosts;
        const maxConnections = subscriptionLimits?.max_connections ?? fallbackConnections;
        const maxTokens = subscriptionLimits?.max_posts_per_month ?? fallbackTokens;

        setUsageData({
          postsCreated: postsCount || 0,
          maxPosts,
          connectionsUsed: connectionsCount || 0,
          maxConnections,
          tokensRemaining: Math.max(0, profile?.tokens_balance || 0),
          maxTokens,
        });
      } catch (error) {
        console.error('Error fetching usage data:', error);
      } finally {
        setUsageLoading(false);
      }
    };

    fetchUsageData();
  }, [user, subscription, subscriptionLimits]);

  if (loading || limitsLoading || usageLoading) {
    return (
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Stack spacing={0.75}>
            <Skeleton variant="text" width={180} level="h2" />
            <Skeleton variant="text" width={240} />
          </Stack>
          <Skeleton variant="rectangular" width={124} height={32} />
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
          }}
        >
          {[1, 2, 3].map((metricIndex) => (
            <Sheet key={metricIndex} variant="soft" sx={{ ...surfaceStyles, p: 2.5 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                  <Skeleton variant="text" width={120} />
                  <Skeleton variant="rectangular" width={82} height={24} />
                </Stack>
                <Skeleton variant="text" width={90} level="h1" />
                <Skeleton variant="text" width={150} />
                <Skeleton variant="rectangular" height={8} />
              </Stack>
            </Sheet>
          ))}
        </Box>
      </Stack>
    );
  }

  const postsPercentage = getUsagePercentage(usageData.postsCreated, usageData.maxPosts);
  const connectionsPercentage = getUsagePercentage(
    usageData.connectionsUsed,
    usageData.maxConnections,
  );
  const tokensConsumed =
    usageData.maxTokens <= 0 || usageData.maxTokens === -1
      ? 0
      : Math.max(0, usageData.maxTokens - usageData.tokensRemaining);
  const tokensPercentage = getUsagePercentage(tokensConsumed, usageData.maxTokens);

  const usageMetrics = [
    {
      label: "Posts This Month",
      icon: FileText,
      value: usageData.postsCreated.toLocaleString(),
      subtext:
        usageData.maxPosts === -1
          ? "No monthly post cap on this plan."
          : `${Math.max(usageData.maxPosts - usageData.postsCreated, 0).toLocaleString()} remaining of ${usageData.maxPosts.toLocaleString()}`,
      percentage: postsPercentage,
      finite: usageData.maxPosts !== -1,
      status: getUsageStatus(postsPercentage, usageData.maxPosts === -1),
    },
    {
      label: "Active Connections",
      icon: Users,
      value: usageData.connectionsUsed.toLocaleString(),
      subtext:
        usageData.maxConnections === -1
          ? "No active connection cap on this plan."
          : `${Math.max(usageData.maxConnections - usageData.connectionsUsed, 0).toLocaleString()} remaining of ${usageData.maxConnections.toLocaleString()}`,
      percentage: connectionsPercentage,
      finite: usageData.maxConnections !== -1,
      status: getUsageStatus(connectionsPercentage, usageData.maxConnections === -1),
    },
    {
      label: "Tokens Remaining",
      icon: Zap,
      value: usageData.tokensRemaining.toLocaleString(),
      subtext:
        usageData.maxTokens === -1
          ? "Your token balance is not capped on this plan."
          : `Used ${tokensConsumed.toLocaleString()} of ${usageData.maxTokens.toLocaleString()} this cycle`,
      percentage: tokensPercentage,
      finite: usageData.maxTokens !== -1,
      status: getUsageStatus(tokensPercentage, usageData.maxTokens === -1),
    },
  ];

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Stack spacing={0.75}>
          <Typography level="title-lg">Usage Analytics</Typography>
          <Typography level="body-sm" textColor="text.secondary">
            Monitor publishing activity, connected channels, and remaining token balance.
          </Typography>
        </Stack>
        <Chip color="neutral" size="sm" startDecorator={<Activity size={14} />} variant="soft">
          Live Tracking
        </Chip>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
        }}
      >
        {usageMetrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <Sheet key={metric.label} variant="soft" sx={{ ...surfaceStyles, p: 2.5 }}>
              <Stack spacing={1.75}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Icon size={18} color="var(--joy-palette-neutral-500)" />
                    <Typography level="title-sm">{metric.label}</Typography>
                  </Stack>
                  <Chip color={metric.status.color} size="sm" variant="soft">
                    {metric.status.label}
                  </Chip>
                </Stack>

                <Typography level="h2">{metric.value}</Typography>
                <Typography level="body-sm" textColor="text.secondary">
                  {metric.subtext}
                </Typography>

                {metric.finite ? (
                  <LinearProgress
                    color={metric.percentage > 80 ? "warning" : "neutral"}
                    determinate
                    size="sm"
                    value={metric.percentage}
                    variant="soft"
                  />
                ) : null}
              </Stack>
            </Sheet>
          );
        })}
      </Box>

      <Sheet variant="outlined" sx={surfaceStyles}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <BarChart3 size={18} color="var(--joy-palette-neutral-500)" />
            <Typography level="title-md">Usage Insights</Typography>
          </Stack>
          <Divider />
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <FileText size={16} color="var(--joy-palette-neutral-500)" />
              <Typography level="body-sm" textColor="text.secondary">
                {usageData.postsCreated > 0
                  ? `You created ${usageData.postsCreated.toLocaleString()} posts this month.`
                  : "No posts have been created yet this month."}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Users size={16} color="var(--joy-palette-neutral-500)" />
              <Typography level="body-sm" textColor="text.secondary">
                {usageData.connectionsUsed > 0
                  ? `${usageData.connectionsUsed.toLocaleString()} social connections are currently active.`
                  : "No active social connections are linked right now."}
              </Typography>
            </Stack>
            {(subscription.tier ?? subscription.plan) === 'free_trial' ? (
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Sparkles size={16} color="var(--joy-palette-neutral-500)" />
                <Typography level="body-sm" textColor="text.secondary">
                  Upgrade from trial to raise your account limits and keep billing features active.
                </Typography>
              </Stack>
            ) : null}
          </Stack>
        </Stack>
      </Sheet>
    </Stack>
  );
};