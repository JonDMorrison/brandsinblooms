import React, { useState } from 'react';
import { BarChart3, Users, Target, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCRMRealStats } from '@/hooks/useCRMRealStats';
import { MetricCard } from '@/components/crm/analytics/MetricCard';
import { CRMStatsCards } from '@/components/crm/CRMStatsCards';
import { CRMTimeSeriesChart } from '@/components/crm/analytics/CRMTimeSeriesChart';
import { CRMSegmentsSummary } from '@/components/crm/segments/CRMSegmentsSummary';
import { CRMRecentActivity } from '@/components/crm/CRMRecentActivity';

export const CRMDashboardPage: React.FC = () => {
  const { stats, loading, refetch } = useCRMRealStats();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">CRM Dashboard</h1>
          <div className="h-9 bg-muted animate-pulse rounded w-24"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg"></div>
          ))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-muted animate-pulse rounded-lg"></div>
          <div className="h-80 bg-muted animate-pulse rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CRM Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Quick insights and navigation to your customer data
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

      {/* Quick Stats Cards */}
      <CRMStatsCards />

      {/* Key Metrics - Simplified */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={<BarChart3 className="w-5 h-5" />}
          description="All-time customer value"
        />
        <MetricCard
          title="Active Campaigns"
          value={stats.activeCampaigns.toString()}
          icon={<Target className="w-5 h-5" />}
          description="Currently running"
        />
        <MetricCard
          title="New This Month"
          value={stats.recentCustomers.toString()}
          icon={<Users className="w-5 h-5" />}
          description="Customers added recently"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          <CRMSegmentsSummary />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <CRMRecentActivity />
        </div>
      </div>
    </div>
  );
};