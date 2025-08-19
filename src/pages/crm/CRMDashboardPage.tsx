import React, { useState } from 'react';
import { BarChart3, Users, Target, TrendingUp, RefreshCw, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCRMDashboardMetrics } from '@/hooks/useCRMDashboardMetrics';
import { useCRMTimeSeriesMetrics } from '@/hooks/useCRMTimeSeriesMetrics';
import { useCRMCampaignPerformance } from '@/hooks/useCRMCampaignPerformance';
import { MetricCard } from '@/components/crm/analytics/MetricCard';
import { CRMFilterBar } from '@/components/crm/CRMFilterBar';
import { CRMTimeSeriesChart } from '@/components/crm/analytics/CRMTimeSeriesChart';
import { CRMSegmentsSummary } from '@/components/crm/segments/CRMSegmentsSummary';
import { CRMCampaignPerformance } from '@/components/crm/campaigns/CRMCampaignPerformance';
import { CRMRecentActivity } from '@/components/crm/CRMRecentActivity';

type TimeFilter = '7d' | '30d' | 'all';
type SegmentFilter = 'all' | 'high-value' | 'new-customers' | 'loyalty-members';
type ChannelFilter = 'all' | 'email' | 'sms' | 'social';

export const CRMDashboardPage: React.FC = () => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d');
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');

  const { data: metrics, isLoading, refetch } = useCRMDashboardMetrics();
  const { metrics: timeSeriesMetrics, loading: timeSeriesLoading } = useCRMTimeSeriesMetrics(timeFilter);
  const { campaigns, loading: campaignsLoading } = useCRMCampaignPerformance(timeFilter, channelFilter);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTrend = (growth: number): 'up' | 'down' | 'flat' => {
    if (growth > 1) return 'up';
    if (growth < -1) return 'down';
    return 'flat';
  };

  const handleResetFilters = () => {
    setTimeFilter('30d');
    setSegmentFilter('all');
    setChannelFilter('all');
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">CRM Dashboard</h1>
          <div className="h-9 bg-muted animate-pulse rounded w-24"></div>
        </div>
        
        <div className="h-16 bg-muted animate-pulse rounded-lg"></div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg"></div>
          ))}
        </div>
        
        <div className="h-96 bg-muted animate-pulse rounded-lg"></div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-muted animate-pulse rounded-lg"></div>
          <div className="h-80 bg-muted animate-pulse rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CRM Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive insights into your customer relationships and campaign performance
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <CRMFilterBar
        timeFilter={timeFilter}
        segmentFilter={segmentFilter}
        channelFilter={channelFilter}
        onTimeFilterChange={setTimeFilter}
        onSegmentFilterChange={setSegmentFilter}
        onChannelFilterChange={setChannelFilter}
        onResetFilters={handleResetFilters}
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Customers"
          value={metrics?.totalCustomers?.toLocaleString() || '0'}
          icon={<Users className="w-5 h-5" />}
          description="Active customer base"
          trend={getTrend(metrics?.totalCustomersGrowth || 0)}
        />
        <MetricCard
          title="Active Campaigns"
          value={metrics?.activeCampaigns?.toString() || '0'}
          icon={<Target className="w-5 h-5" />}
          description="Currently running"
          trend={getTrend(metrics?.activeCampaignsGrowth || 0)}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${metrics?.conversionRate || 0}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          description="Average across channels"
          trend={getTrend(metrics?.conversionRateGrowth || 0)}
        />
        <MetricCard
          title="Revenue"
          value={formatCurrency(timeSeriesMetrics?.totalRevenue || metrics?.totalRevenue || 0)}
          icon={<BarChart3 className="w-5 h-5" />}
          description={`Last ${timeFilter === '7d' ? '7 days' : timeFilter === '30d' ? '30 days' : 'all time'}`}
          trend={getTrend(timeSeriesMetrics?.revenueGrowth || metrics?.totalRevenueGrowth || 0)}
        />
      </div>

      {/* Performance Chart */}
      <CRMTimeSeriesChart 
        data={timeSeriesMetrics?.data || []} 
        loading={timeSeriesLoading}
      />

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <CRMSegmentsSummary />
          <CRMRecentActivity />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <CRMCampaignPerformance 
            campaigns={campaigns} 
            loading={campaignsLoading}
          />
        </div>
      </div>
    </div>
  );
};