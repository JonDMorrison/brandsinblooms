import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Eye, 
  MousePointer, 
  TrendingDown, 
  DollarSign, 
  Users,
  Calendar,
  BarChart3
} from 'lucide-react';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { MetricCard } from '@/components/crm/analytics/MetricCard';
import { CampaignPerformanceChart } from '@/components/crm/analytics/CampaignPerformanceChart';
import { SegmentPerformanceBreakdown } from '@/components/crm/analytics/SegmentPerformanceBreakdown';
import { TimeFilterToggle } from '@/components/crm/analytics/TimeFilterToggle';

type TimeFilter = '7d' | '30d' | 'all';

interface CampaignMetrics {
  id: string;
  name: string;
  status: string;
  sent_at: string | null;
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    revenue: number;
  };
  target_segment_ids?: string[];
  crm_segments?: { name: string }[];
}

const CRMAnalytics = () => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d');

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['crm-analytics', timeFilter],
    queryFn: async () => {
      let query = supabase
        .from('crm_campaigns')
        .select(`
          *,
          crm_segments (name)
        `)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false });

      // Apply time filter
      if (timeFilter !== 'all') {
        const days = timeFilter === '7d' ? 7 : 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        query = query.gte('sent_at', cutoffDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data?.map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        sent_at: campaign.sent_at,
        target_segment_ids: (campaign as any).target_segment_ids || [],
        crm_segments: Array.isArray(campaign.crm_segments) ? campaign.crm_segments : [],
        metrics: (campaign.metrics as any) || {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          unsubscribed: 0,
          revenue: 0,
        }
      })) as CampaignMetrics[];
    },
  });

  // Calculate aggregate metrics
  const aggregateMetrics = React.useMemo(() => {
    if (!campaigns?.length) {
      return {
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        totalUnsubscribed: 0,
        totalRevenue: 0,
        avgOpenRate: 0,
        avgClickRate: 0,
        avgBounceRate: 0,
      };
    }

    const totals = campaigns.reduce((acc, campaign) => {
      const metrics = campaign.metrics;
      return {
        totalSent: acc.totalSent + metrics.sent,
        totalDelivered: acc.totalDelivered + metrics.delivered,
        totalOpened: acc.totalOpened + metrics.opened,
        totalClicked: acc.totalClicked + metrics.clicked,
        totalBounced: acc.totalBounced + metrics.bounced,
        totalUnsubscribed: acc.totalUnsubscribed + metrics.unsubscribed,
        totalRevenue: acc.totalRevenue + metrics.revenue,
      };
    }, {
      totalSent: 0,
      totalDelivered: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalBounced: 0,
      totalUnsubscribed: 0,
      totalRevenue: 0,
    });

    return {
      ...totals,
      avgOpenRate: totals.totalDelivered > 0 ? (totals.totalOpened / totals.totalDelivered) * 100 : 0,
      avgClickRate: totals.totalOpened > 0 ? (totals.totalClicked / totals.totalOpened) * 100 : 0,
      avgBounceRate: totals.totalSent > 0 ? (totals.totalBounced / totals.totalSent) * 100 : 0,
    };
  }, [campaigns]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BarChart3 className="w-8 h-8 animate-pulse mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <SubscriptionGate feature="crm_enabled" requiredPlan="bloom">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">📊 Campaign Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Track the performance of your email campaigns
            </p>
          </div>
          <TimeFilterToggle value={timeFilter} onChange={setTimeFilter} />
        </div>

        {campaigns?.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Mail className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No campaigns found</h3>
              <p className="text-muted-foreground mb-4">
                Send your first campaign to see analytics here
              </p>
              <Button>
                <a href="/crm/campaigns/new">Create Campaign</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="📬 Emails Sent"
                value={aggregateMetrics.totalSent.toLocaleString()}
                icon={<Mail className="w-5 h-5" />}
                description="Total messages delivered"
              />
              <MetricCard
                title="📈 Open Rate"
                value={`${aggregateMetrics.avgOpenRate.toFixed(1)}%`}
                icon={<Eye className="w-5 h-5" />}
                description={`${aggregateMetrics.totalOpened.toLocaleString()} opens`}
                trend={aggregateMetrics.avgOpenRate > 20 ? 'up' : 'down'}
              />
              <MetricCard
                title="🖱️ Click Rate" 
                value={`${aggregateMetrics.avgClickRate.toFixed(1)}%`}
                icon={<MousePointer className="w-5 h-5" />}
                description={`${aggregateMetrics.totalClicked.toLocaleString()} clicks`}
                trend={aggregateMetrics.avgClickRate > 3 ? 'up' : 'down'}
              />
              <MetricCard
                title="💰 Revenue"
                value={`$${aggregateMetrics.totalRevenue.toFixed(2)}`}
                icon={<DollarSign className="w-5 h-5" />}
                description="Total campaign revenue"
                trend={aggregateMetrics.totalRevenue > 0 ? 'up' : 'flat'}
              />
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="📉 Bounce Rate"
                value={`${aggregateMetrics.avgBounceRate.toFixed(1)}%`}
                icon={<TrendingDown className="w-5 h-5" />}
                description={`${aggregateMetrics.totalBounced.toLocaleString()} bounces`}
                trend={aggregateMetrics.avgBounceRate < 5 ? 'up' : 'down'}
                variant="secondary"
              />
              <MetricCard
                title="❌ Unsubscribes"
                value={aggregateMetrics.totalUnsubscribed.toLocaleString()}
                icon={<Users className="w-5 h-5" />}
                description="Total opt-outs"
                variant="secondary"
              />
              <MetricCard
                title="📧 Campaigns"
                value={campaigns?.length.toLocaleString() || '0'}
                icon={<Calendar className="w-5 h-5" />}
                description={`In ${timeFilter === '7d' ? 'past 7 days' : timeFilter === '30d' ? 'past 30 days' : 'all time'}`}
                variant="secondary"
              />
            </div>

            {/* Performance Chart */}
            <CampaignPerformanceChart campaigns={campaigns || []} />

            {/* Segment Performance */}
            <SegmentPerformanceBreakdown campaigns={campaigns || []} />

            {/* Campaign List */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {campaigns?.slice(0, 10).map((campaign) => {
                    const openRate = campaign.metrics.delivered > 0 
                      ? (campaign.metrics.opened / campaign.metrics.delivered * 100).toFixed(1)
                      : '0.0';
                    
                    return (
                      <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">{campaign.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {campaign.status}
                            </Badge>
                            {campaign.sent_at && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(campaign.sent_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{openRate}% open rate</div>
                          <div className="text-xs text-muted-foreground">
                            {campaign.metrics.sent.toLocaleString()} sent
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </SubscriptionGate>
  );
};

export default CRMAnalytics;