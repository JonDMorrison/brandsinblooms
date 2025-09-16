import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Users, Target, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutiveMetric {
  title: string;
  value: string;
  change: number;
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
}

export const ExecutiveDashboard = ({
  totalViews = 0,
  engagementRate = 0,
  clicks = 0,
  conversions = 0,
  growth = 0,
  loading = false
}: ExecutiveDashboardProps) => {
  const metrics: ExecutiveMetric[] = [
    {
      title: 'Lead Generation',
      value: totalViews.toLocaleString(),
      change: growth,
      changeLabel: 'vs last period',
      icon: Users,
      priority: 'high'
    },
    {
      title: 'Customer Interaction Rate',
      value: `${engagementRate.toFixed(1)}%`,
      change: 12.5,
      changeLabel: 'vs last month',
      icon: Target,
      priority: 'high'
    },
    {
      title: 'Marketing Performance',
      value: clicks.toLocaleString(),
      change: 8.2,
      changeLabel: 'total clicks',
      icon: BarChart3,
      priority: 'medium'
    },
    {
      title: 'Business Results',
      value: conversions.toLocaleString(),
      change: 15.3,
      changeLabel: 'conversions',
      icon: DollarSign,
      priority: 'high'
    }
  ];

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  const getChangeIcon = (change: number) => {
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

  if (loading) {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Executive Summary</h2>
          <p className="text-muted-foreground">Key business metrics at a glance</p>
        </div>
        <Badge variant="secondary">Live Data</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => {
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
                  {ChangeIcon && (
                    <ChangeIcon className={cn("h-4 w-4 mr-1", getChangeColor(metric.change))} />
                  )}
                  <span className={getChangeColor(metric.change)}>
                    {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground ml-1">{metric.changeLabel}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Insights */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <div className="rounded-full bg-blue-100 p-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">Performance Highlight</h3>
              <p className="text-blue-700 text-sm mt-1">
                Your customer interaction rate increased by 12.5% this month. 
                Consider scaling successful campaigns for even better results.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};