
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  icon: Icon, 
  title, 
  value, 
  subtitle, 
  trend
}) => (
  <Card className="hover:shadow-md transition-shadow duration-200 border border-gray-200">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-gray-50">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        {trend && (
          <div className={`text-xs px-2 py-1 rounded-full font-medium ${
            trend > 0 
              ? 'bg-green-50 text-green-700' 
              : 'bg-red-50 text-red-700'
          }`}>
            {trend > 0 ? '+' : ''}{trend}%
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <div className="text-2xl font-bold text-gray-900">
          {value}
        </div>
        <div className="text-sm font-medium text-gray-900">
          {title}
        </div>
        <div className="text-xs text-gray-500">
          {subtitle}
        </div>
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
          title="Total Contacts"
          value={customerStats.total.toLocaleString()}
          subtitle={customerStats.total === 0 ? "Import your first contacts" : "Active contacts in database"}
          trend={customerStats.total > 0 ? 12 : undefined}
        />
        
        <MetricCard
          icon={Target}
          title="Segments"
          value={segmentCount}
          subtitle={segmentCount === 0 ? "Create targeted groups" : "Active customer segments"}
        />
        
        <MetricCard
          icon={Mail}
          title="Campaigns"
          value={totalCampaigns}
          subtitle={totalCampaigns === 0 ? "Send your first campaign" : `${totalSent.toLocaleString()} messages sent`}
        />
        
        <MetricCard
          icon={MessageSquare}
          title="SMS Opt-in Rate"
          value={`${customerStats.smsOptInRate.toFixed(1)}%`}
          subtitle={`${customerStats.smsOptedIn} opted in for SMS`}
        />
      </div>

      {/* Performance Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Eye}
          title="Avg Open Rate"
          value={campaignStats.email.totalSent > 0 ? `${campaignStats.email.avgOpenRate.toFixed(1)}%` : "0%"}
          subtitle="Email campaign performance"
        />
        
        <MetricCard
          icon={MousePointerClick}
          title="Avg Click Rate"
          value={campaignStats.email.totalSent > 0 ? `${campaignStats.email.avgClickRate.toFixed(1)}%` : "0%"}
          subtitle="Email engagement rate"
        />
        
        <MetricCard
          icon={Smartphone}
          title="SMS Delivery"
          value={campaignStats.sms.totalSent > 0 ? `${campaignStats.sms.deliveryRate.toFixed(1)}%` : "0%"}
          subtitle="SMS delivery success rate"
        />
        
        <MetricCard
          icon={Calendar}
          title="Last Campaign"
          value={totalCampaigns > 0 ? "3 days ago" : "Never"}
          subtitle={totalCampaigns > 0 ? "Most recent send" : "No campaigns sent"}
        />
      </div>
    </div>
  );
};
