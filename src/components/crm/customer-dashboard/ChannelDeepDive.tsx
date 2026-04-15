import React from 'react';
import { cn } from '@/lib/utils';
import { DashboardSection } from './DashboardSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui-legacy/tabs';
import { FunnelChart } from '@/components/charts/FunnelChart';
import { EngagementHeatmap } from '@/components/charts/EngagementHeatmap';
import { EmptyChartOverlay } from '@/components/ui-legacy/empty-chart-overlay';
import { Badge } from '@/components/ui-legacy/badge';
import { Mail, MessageSquare, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface ChannelDeepDiveProps {
  emailMetrics: {
    sent?: number;
    delivered?: number;
    opened?: number;
    clicked?: number;
    converted?: number;
    openRate?: number;
    clickRate?: number;
    avgTimeToOpen?: number;
    isQuickOpener?: boolean;
  };
  smsMetrics: {
    sent?: number;
    delivered?: number;
    clicked?: number;
    replied?: number;
    deliveryRate?: number;
    clickRate?: number;
    replyRate?: number;
    avgTimeToResponse?: number;
  };
  emailHeatmapData?: Array<{ day: string; hour: number; value: number }>;
  smsHeatmapData?: Array<{ day: string; hour: number; value: number }>;
  className?: string;
}

const formatTime = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
};

export const ChannelDeepDive: React.FC<ChannelDeepDiveProps> = ({
  emailMetrics,
  smsMetrics,
  emailHeatmapData = [],
  smsHeatmapData = [],
  className,
}) => {
  const emailFunnelSteps = [
    { label: 'Sent', value: emailMetrics.sent || 0, percentage: 100 },
    { 
      label: 'Delivered', 
      value: emailMetrics.delivered || 0, 
      percentage: emailMetrics.sent ? Math.round((emailMetrics.delivered || 0) / emailMetrics.sent * 100) : 0 
    },
    { 
      label: 'Opened', 
      value: emailMetrics.opened || 0,
      percentage: emailMetrics.delivered ? Math.round((emailMetrics.opened || 0) / emailMetrics.delivered * 100) : 0
    },
    { 
      label: 'Clicked', 
      value: emailMetrics.clicked || 0,
      percentage: emailMetrics.opened ? Math.round((emailMetrics.clicked || 0) / emailMetrics.opened * 100) : 0
    },
    { 
      label: 'Converted', 
      value: emailMetrics.converted || 0,
      percentage: emailMetrics.clicked ? Math.round((emailMetrics.converted || 0) / emailMetrics.clicked * 100) : 0
    },
  ];

  const smsFunnelSteps = [
    { label: 'Sent', value: smsMetrics.sent || 0, percentage: 100 },
    { 
      label: 'Delivered', 
      value: smsMetrics.delivered || 0,
      percentage: smsMetrics.sent ? Math.round((smsMetrics.delivered || 0) / smsMetrics.sent * 100) : 0
    },
    { 
      label: 'Clicked', 
      value: smsMetrics.clicked || 0,
      percentage: smsMetrics.delivered ? Math.round((smsMetrics.clicked || 0) / smsMetrics.delivered * 100) : 0
    },
    { 
      label: 'Replied', 
      value: smsMetrics.replied || 0,
      percentage: smsMetrics.delivered ? Math.round((smsMetrics.replied || 0) / smsMetrics.delivered * 100) : 0
    },
  ];

  const hasEmailHeatmapData = emailHeatmapData.length > 0;
  const hasSmsHeatmapData = smsHeatmapData.length > 0;

  return (
    <DashboardSection
      title="Channel Engagement Deep Dive"
      icon={<Mail className="h-4 w-4" />}
      tooltip="Detailed performance metrics for each communication channel"
      className={className}
    >
      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="email" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Email
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            SMS
          </TabsTrigger>
        </TabsList>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-4 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Funnel */}
            <div className="p-4 rounded-lg border border-border bg-card">
              <h4 className="text-sm font-medium text-foreground mb-3">Email Funnel</h4>
              <FunnelChart steps={emailFunnelSteps} variant="email" />
            </div>

            {/* Time to Open & Heatmap */}
            <div className="space-y-4">
              {/* Time to Open */}
              <div className="p-4 rounded-lg border border-border bg-card">
                <h4 className="text-sm font-medium text-foreground mb-3">Time to Open</h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xl font-semibold text-foreground">
                      {formatTime(emailMetrics.avgTimeToOpen || 0)}
                    </span>
                  </div>
                  {emailMetrics.isQuickOpener && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                      Quick Opener
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Average time to open emails</p>
              </div>

              {/* Click Heatmap */}
              <div className="p-4 rounded-lg border border-border bg-card">
                <h4 className="text-sm font-medium text-foreground mb-3">Click Activity</h4>
                {hasEmailHeatmapData ? (
                  <EngagementHeatmap 
                    data={emailHeatmapData} 
                    variant="clicks"
                  />
                ) : (
                  <EmptyChartOverlay
                    message="No email click activity data yet"
                    icon="activity"
                    height={120}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-border bg-card text-center">
              <div className="text-xl font-semibold text-foreground">
                {emailMetrics.openRate || 0}%
              </div>
              <p className="text-xs text-muted-foreground">Open Rate</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card text-center">
              <div className="text-xl font-semibold text-foreground">
                {emailMetrics.clickRate || 0}%
              </div>
              <p className="text-xs text-muted-foreground">Click Rate</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card text-center">
              <div className="text-xl font-semibold text-foreground">
                {emailMetrics.sent || 0}
              </div>
              <p className="text-xs text-muted-foreground">Total Sent</p>
            </div>
          </div>
        </TabsContent>

        {/* SMS Tab */}
        <TabsContent value="sms" className="space-y-4 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Funnel */}
            <div className="p-4 rounded-lg border border-border bg-card">
              <h4 className="text-sm font-medium text-foreground mb-3">SMS Funnel</h4>
              <FunnelChart steps={smsFunnelSteps} variant="sms" />
            </div>

            {/* Response Time & Activity */}
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-border bg-card">
                <h4 className="text-sm font-medium text-foreground mb-3">Response Time</h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xl font-semibold text-foreground">
                      {formatTime(smsMetrics.avgTimeToResponse || 0)}
                    </span>
                  </div>
                  {(smsMetrics.avgTimeToResponse || 0) < 30 && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                      Fast Responder
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Average response time</p>
              </div>

              <div className="p-4 rounded-lg border border-border bg-card">
                <h4 className="text-sm font-medium text-foreground mb-3">SMS Activity</h4>
                {hasSmsHeatmapData ? (
                  <EngagementHeatmap 
                    data={smsHeatmapData}
                    variant="engagement"
                  />
                ) : (
                  <EmptyChartOverlay
                    message="No SMS activity data yet"
                    icon="activity"
                    height={120}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-border bg-card text-center">
              <div className="text-xl font-semibold text-foreground">
                {smsMetrics.deliveryRate || 0}%
              </div>
              <p className="text-xs text-muted-foreground">Delivery Rate</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card text-center">
              <div className="text-xl font-semibold text-foreground">
                {smsMetrics.clickRate || 0}%
              </div>
              <p className="text-xs text-muted-foreground">Click Rate</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card text-center">
              <div className="text-xl font-semibold text-foreground">
                {smsMetrics.replyRate || 0}%
              </div>
              <p className="text-xs text-muted-foreground">Reply Rate</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardSection>
  );
};

export default ChannelDeepDive;
