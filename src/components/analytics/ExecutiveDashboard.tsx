import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Users, Target, BarChart3, ShoppingCart, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePOSAnalytics } from '@/hooks/usePOSAnalytics';

interface ExecutiveMetric {
  title: string;
  value: string;
  change?: number;
  changeLabel: string;
  icon: React.ElementType;
  priority: 'high' | 'medium' | 'low';
}

interface ExecutiveDashboardProps {
  totalViews?: number;
  engagementRate?: number;
  clicks?: number;
  conversions?: number;
  growth?: number;
  loading?: boolean;
  dateRange?: number;
}

export const ExecutiveDashboard = ({
  totalViews = 0,
  engagementRate = 0,
  clicks = 0,
  conversions = 0,
  growth = 0,
  loading = false,
  dateRange = 30
}: ExecutiveDashboardProps) => {
  const { data: posData, isLoading: posLoading } = usePOSAnalytics(dateRange);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const metrics: ExecutiveMetric[] = [
    {
      title: 'Total Customers',
      value: (posData?.totalCustomers || 0).toLocaleString(),
      changeLabel: 'in database',
      icon: Users,
      priority: 'high'
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(posData?.totalRevenue || 0),
      changeLabel: `${dateRange} day period`,
      icon: DollarSign,
      priority: 'high'
    },
    {
      title: 'Total Orders',
      value: (posData?.totalOrders || 0).toLocaleString(),
      changeLabel: `${dateRange} day period`,
      icon: ShoppingCart,
      priority: 'medium'
    },
    {
      title: 'Avg Order Value',
      value: formatCurrency(posData?.avgOrderValue || 0),
      changeLabel: 'per transaction',
      icon: BarChart3,
      priority: 'medium'
    }
  ];

  const marketingMetrics: ExecutiveMetric[] = [
    {
      title: 'Lead Generation',
      value: totalViews.toLocaleString(),
      change: growth,
      changeLabel: 'vs last period',
      icon: Target,
      priority: 'medium'
    },
    {
      title: 'Engagement Rate',
      value: `${engagementRate.toFixed(1)}%`,
      changeLabel: 'vs last month',
      icon: Target,
      priority: 'medium'
    },
    {
      title: 'Marketing Clicks',
      value: clicks.toLocaleString(),
      changeLabel: 'total clicks',
      icon: BarChart3,
      priority: 'low'
    },
    {
      title: 'Conversions',
      value: conversions.toLocaleString(),
      changeLabel: 'total conversions',
      icon: DollarSign,
      priority: 'low'
    }
  ];

  const getChangeColor = (change?: number) => {
    if (!change) return 'text-muted-foreground';
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  const getChangeIcon = (change?: number) => {
    if (!change) return null;
    if (change > 0) return TrendingUp;
    if (change < 0) return TrendingDown;
    return null;
  };

  const getPriorityBorder = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-l-primary';
      case 'medium': return 'border-l-4 border-l-yellow-500';
      default: return 'border-l-4 border-l-gray-300';
    }
  };

  const isLoading = loading || posLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Executive Summary</h2>
          <Badge variant="outline">Loading...</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const renderMetricCard = (metric: ExecutiveMetric, index: number) => {
    const ChangeIcon = getChangeIcon(metric.change);
    
    return (
      <Card key={index} className={cn("transition-all hover:shadow-md", getPriorityBorder(metric.priority))}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {metric.title}
          </CardTitle>
          <metric.icon className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-1">{metric.value}</div>
          <div className="flex items-center text-sm">
            {ChangeIcon && metric.change !== undefined && (
              <>
                <ChangeIcon className={cn("h-4 w-4 mr-1", getChangeColor(metric.change))} />
                <span className={getChangeColor(metric.change)}>
                  {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                </span>
              </>
            )}
            <span className="text-muted-foreground ml-1">{metric.changeLabel}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Executive Summary</h2>
          <p className="text-muted-foreground">Key business metrics at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          {posData?.hasIntegration && (
            <Badge variant="outline" className="gap-1">
              <Store className="h-3 w-3" />
              {posData.integrationName}
            </Badge>
          )}
          <Badge variant="secondary">Live Data</Badge>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Store className="h-5 w-5" />
          POS & Sales Metrics
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric, index) => renderMetricCard(metric, index))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Target className="h-5 w-5" />
          Marketing Performance
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {marketingMetrics.map((metric, index) => renderMetricCard(metric, index + 4))}
        </div>
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <div className="rounded-full bg-blue-100 p-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">Performance Highlight</h3>
              <p className="text-blue-700 text-sm mt-1">
                {posData?.totalCustomers ? (
                  <>You have {posData.totalCustomers.toLocaleString()} customers with {formatCurrency(posData.totalRevenue)} in revenue over the last {dateRange} days.</>
                ) : (
                  <>Connect a POS system to see real-time sales and customer data.</>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
