import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolveSmsCampaignMetrics } from "@/lib/sms/smsCampaignMetrics";

type SmsDashboardAggregate = {
  subscribers?: unknown;
  sent?: unknown;
  delivered?: unknown;
  clicks?: unknown;
  queued_messages?: unknown;
  current_sent?: unknown;
  current_delivered?: unknown;
  current_clicks?: unknown;
  previous_sent?: unknown;
  previous_delivered?: unknown;
  previous_clicks?: unknown;
};

function count(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export interface SMSStats {
  subscribers: number;
  subscribersGrowth: number;
  credits: number;
  creditsUsed: number;
  deliverability: number;
  deliverabilityGrowth: number;
  clicks: number;
  clicksGrowth: number;
  queuedMessages: number;
  recentCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    sent: number;
    delivered: number;
    clicked: number;
    created_at: string;
  }>;
  recentMessages: Array<{
    id: string;
    phone: string;
    content: string;
    status: string;
    created_at: string;
  }>;
}

export const useSMSStats = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["sms-stats", user?.id],
    queryFn: async (): Promise<SMSStats> => {
      if (!user) {
        return {
          subscribers: 0,
          subscribersGrowth: 0,
          credits: 0,
          creditsUsed: 0,
          deliverability: 0,
          deliverabilityGrowth: 0,
          clicks: 0,
          clicksGrowth: 0,
          queuedMessages: 0,
          recentCampaigns: [],
          recentMessages: [],
        };
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      if (userError) {
        throw userError;
      }

      const tenantId = userData?.tenant_id;

      const baseFilters = tenantId
        ? { tenant_id: tenantId }
        : { user_id: user.id };

      const [subscriptionResult, campaignsResult, aggregateResult] =
        await Promise.all([
          supabase
            .from("subscriptions")
            .select("sms_quota, sms_usage")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("crm_sms_campaigns")
            .select("*")
            .match(baseFilters)
            .or("source.is.null,source.neq.segment_send")
            .order("created_at", { ascending: false })
            .limit(10),
          supabase.rpc("get_sms_dashboard_stats"),
        ]);

      if (subscriptionResult.error) {
        throw subscriptionResult.error;
      }
      if (campaignsResult.error) {
        throw campaignsResult.error;
      }
      if (aggregateResult.error) {
        throw aggregateResult.error;
      }

      const subscription = subscriptionResult.data;
      const campaigns = campaignsResult.data || [];
      const aggregate =
        aggregateResult.data && typeof aggregateResult.data === "object"
          ? (aggregateResult.data as SmsDashboardAggregate)
          : {};

      const smsQuota = subscription?.sms_quota || 0;
      const smsUsage = subscription?.sms_usage || 0;
      const creditsRemaining = Math.max(0, smsQuota - smsUsage);

      // RLS scopes this query to the authenticated tenant. Do not restrict it
      // to the ten campaign cards or older messages disappear from the feed.
      const { data: messages = [], error: messagesError } = await supabase
        .from("sms_messages")
        .select(
          `
          id,
          phone,
          content,
          status,
          created_at,
          campaign_id
        `,
        )
        .order("created_at", { ascending: false })
        .limit(20);

      if (messagesError) {
        throw messagesError;
      }

      const totalSent = count(aggregate.sent);
      const totalDelivered = count(aggregate.delivered);
      const totalClicked = count(aggregate.clicks);
      const currentSent = count(aggregate.current_sent);
      const currentDelivered = count(aggregate.current_delivered);
      const currentClicks = count(aggregate.current_clicks);
      const previousSent = count(aggregate.previous_sent);
      const previousDelivered = count(aggregate.previous_delivered);
      const previousClicks = count(aggregate.previous_clicks);

      // Calculate growth percentages
      const subscribersGrowth = 0; // Would need historical customer data

      const currentDeliverability =
        currentSent > 0 ? (currentDelivered / currentSent) * 100 : 0;
      const previousDeliverability =
        previousSent > 0 ? (previousDelivered / previousSent) * 100 : 0;
      const deliverabilityGrowth =
        previousDeliverability > 0
          ? ((currentDeliverability - previousDeliverability) /
              previousDeliverability) *
            100
          : 0;

      const clicksGrowth =
        previousClicks > 0
          ? ((currentClicks - previousClicks) / previousClicks) * 100
          : currentClicks > 0
            ? 100
            : 0;

      const queuedMessages = count(aggregate.queued_messages);
      const deliverability =
        totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

      return {
        subscribers: count(aggregate.subscribers),
        subscribersGrowth,
        credits: creditsRemaining,
        creditsUsed: smsUsage,
        deliverability: Math.round(deliverability),
        deliverabilityGrowth: Math.round(deliverabilityGrowth * 10) / 10,
        clicks: totalClicked,
        clicksGrowth: Math.round(clicksGrowth * 10) / 10,
        queuedMessages,
        recentCampaigns: campaigns.slice(0, 5).map((campaign) => {
          const metrics = resolveSmsCampaignMetrics(
            campaign.metrics && typeof campaign.metrics === "object"
              ? campaign.metrics
              : null,
          );

          return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            sent: metrics.sent,
            delivered: metrics.delivered,
            clicked: metrics.totalClicks,
            created_at: campaign.created_at,
          };
        }),
        recentMessages: messages.slice(0, 10).map((message) => ({
          id: message.id,
          phone: message.phone,
          content:
            message.content.substring(0, 50) +
            (message.content.length > 50 ? "..." : ""),
          status: message.status,
          created_at: message.created_at,
        })),
      };
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
};
