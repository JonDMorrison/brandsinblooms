import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Users, Target, Mail, MessageSquare, Eye, MousePointerClick, Smartphone, Calendar } from 'lucide-react';

interface HeroMetricsSectionProps {
  customerStats: {
    total: number;
    smsOptedIn: number;
    smsOptInRate: number;
  };
  campaignStats: {
    email: {
      totalSent: number;
      campaignCount: number;
      avgOpenRate: number;
      avgClickRate: number;
    };
    sms: {
      totalSent: number;
      campaignCount: number;
      deliveryRate: number;
    };
  };
  segmentCount: number;
}

interface MetricCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
  subtitle: string;
  trend?: number;
  color?: string;
  progress?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  icon: Icon, 
  title, 
  value, 
  subtitle, 
  trend, 
  color = "text-primary",
  progress 
}) => (
  <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-gradient-to-br from-background to-muted/20">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        {trend && (
          <div className={`text-xs px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <div className="text-3xl font-bold tracking-tight text-foreground">
          {value}
        </div>
        <div className="text-sm font-medium text-muted-foreground">
          {title}
        </div>
        <div className="text-xs text-muted-foreground">
          {subtitle}
        </div>
        
        {progress !== undefined && (
          <div className="mt-3">
            <Progress 
              value={progress} 
              className="h-2" 
              indicatorClassName="bg-gradient-to-r from-primary to-primary/80"
            />
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

export const HeroMetricsSection: React.FC<HeroMetricsSectionProps> = ({
  customerStats,
  campaignStats,
  segmentCount
}) => {
  const totalCampaigns = campaignStats.email.campaignCount + campaignStats.sms.campaignCount;
  const totalSent = campaignStats.email.totalSent + campaignStats.sms.totalSent;
  
  return (
    <div className="space-y-6">
      {/* Primary KPIs Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Users}
          title="Total Customers"
          value={customerStats.total}
          subtitle={customerStats.total === 0 ? "Add your first customer" : "Growing your garden community"}
          trend={customerStats.total > 0 ? 12 : undefined}
          color="text-emerald-600"
          progress={Math.min((customerStats.total / 1000) * 100, 100)}
        />
        
        <MetricCard
          icon={Target}
          title="Active Segments"
          value={segmentCount}
          subtitle={segmentCount === 0 ? "Create your first segment" : "Targeted customer groups"}
          color="text-blue-600"
        />
        
        <MetricCard
          icon={Mail}
          title="Campaigns Sent"
          value={totalCampaigns}
          subtitle={totalCampaigns === 0 ? "Launch your first campaign" : `${totalSent} messages delivered`}
          color="text-purple-600"
        />
        
        <MetricCard
          icon={MessageSquare}
          title="SMS Opt-In Rate"
          value={`${customerStats.smsOptInRate.toFixed(1)}%`}
          subtitle={`${customerStats.smsOptedIn} of ${customerStats.total} opted in`}
          color="text-green-600"
          progress={customerStats.smsOptInRate}
        />
      </div>

      {/* Performance Snapshot Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Eye}
          title="Email Open Rate"
          value={campaignStats.email.totalSent > 0 ? `${campaignStats.email.avgOpenRate.toFixed(1)}%` : "0%"}
          subtitle={campaignStats.email.totalSent > 0 ? "Average across campaigns" : "Send emails to see performance"}
          color="text-blue-500"
        />
        
        <MetricCard
          icon={MousePointerClick}
          title="Click Rate"
          value={campaignStats.email.totalSent > 0 ? `${campaignStats.email.avgClickRate.toFixed(1)}%` : "0%"}
          subtitle={campaignStats.email.totalSent > 0 ? "Engagement with your content" : "Track click performance"}
          color="text-indigo-500"
        />
        
        <MetricCard
          icon={Smartphone}
          title="SMS Delivery Rate"
          value={campaignStats.sms.totalSent > 0 ? `${campaignStats.sms.deliveryRate.toFixed(1)}%` : "0%"}
          subtitle={campaignStats.sms.totalSent > 0 ? "Successfully delivered" : "Send SMS to track delivery"}
          color="text-green-500"
        />
        
        <MetricCard
          icon={Calendar}
          title="Last Campaign"
          value="3 days ago"
          subtitle="Spring Plant Care Tips"
          color="text-orange-500"
        />
      </div>
    </div>
  );
};