import React from 'react';
import { cn } from '@/lib/utils';
import { DashboardSection } from './DashboardSection';
import { EngagementRadarChart } from '@/components/charts/EngagementRadarChart';
import { EmptyChartOverlay } from '@/components/ui-legacy/empty-chart-overlay';
import { Progress } from '@/components/ui-legacy/progress';
import { Badge } from '@/components/ui-legacy/badge';
import { Layers, Mail, MessageSquare, Star, Clock, AlertTriangle } from 'lucide-react';

interface CrossChannelIntelligenceProps {
  metrics: {
    multiChannelScore?: number;
    emailEngagement?: number;
    smsEngagement?: number;
    loyaltyEngagement?: number;
    preferredChannel?: string;
    channelFatigueEmail?: number;
    channelFatigueSms?: number;
    daysSinceLastEmail?: number;
    daysSinceLastSms?: number;
    daysSinceLastLoyalty?: number;
  };
  channelTrend?: Array<{
    month: string;
    preferredChannel: 'email' | 'sms';
  }>;
  className?: string;
}

const getChannelRecommendation = (
  emailFatigue: number, 
  smsFatigue: number, 
  preferredChannel: string
): string => {
  if (emailFatigue > 70 && smsFatigue < 50) {
    return 'Switch to SMS for the next 2 weeks to reduce email fatigue';
  }
  if (smsFatigue > 70 && emailFatigue < 50) {
    return 'Switch to email for the next 2 weeks to reduce SMS fatigue';
  }
  if (emailFatigue > 70 && smsFatigue > 70) {
    return 'Reduce overall messaging frequency - customer showing fatigue across channels';
  }
  return `Continue with ${preferredChannel} as primary channel`;
};

const getFatigueColor = (value: number): string => {
  if (value >= 70) return 'bg-red-500';
  if (value >= 50) return 'bg-amber-500';
  return 'bg-green-500';
};

const getFatigueLabel = (value: number): string => {
  if (value >= 70) return 'High';
  if (value >= 50) return 'Moderate';
  return 'Low';
};

export const CrossChannelIntelligence: React.FC<CrossChannelIntelligenceProps> = ({
  metrics,
  channelTrend = [],
  className,
}) => {
  const radarData = [
    { channel: 'Email', value: metrics.emailEngagement || 0 },
    { channel: 'SMS', value: metrics.smsEngagement || 0 },
    { channel: 'Loyalty', value: metrics.loyaltyEngagement || 0 },
  ];

  const recommendation = getChannelRecommendation(
    metrics.channelFatigueEmail || 0,
    metrics.channelFatigueSms || 0,
    metrics.preferredChannel || 'email'
  );

  const hasChannelTrendData = channelTrend.length > 0;

  return (
    <DashboardSection
      title="Cross-Channel Intelligence"
      icon={<Layers className="h-4 w-4" />}
      tooltip="Understand how channels interact and identify the optimal communication strategy"
      className={className}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar Chart */}
        <div className="p-4 rounded-lg border border-border bg-card">
          <h4 className="text-sm font-medium text-foreground mb-2">Engagement by Channel</h4>
          <EngagementRadarChart data={radarData} height={180} />
          <div className="text-center mt-2">
            <Badge variant="secondary" className="text-xs">
              Multi-Channel Score: {metrics.multiChannelScore || 0}
            </Badge>
          </div>
        </div>

        {/* Channel Fatigue */}
        <div className="p-4 rounded-lg border border-border bg-card">
          <h4 className="text-sm font-medium text-foreground mb-4">Channel Fatigue Analysis</h4>
          
          {/* Email Fatigue */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-sm text-foreground">Email</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">
                  {metrics.channelFatigueEmail || 0}%
                </span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    'text-[10px]',
                    (metrics.channelFatigueEmail || 0) >= 70 
                      ? 'border-red-200 text-red-700' 
                      : 'border-green-200 text-green-700'
                  )}
                >
                  {getFatigueLabel(metrics.channelFatigueEmail || 0)}
                </Badge>
              </div>
            </div>
            <Progress 
              value={metrics.channelFatigueEmail || 0} 
              className="h-2"
            />
          </div>

          {/* SMS Fatigue */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-green-600" />
                <span className="text-sm text-foreground">SMS</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">
                  {metrics.channelFatigueSms || 0}%
                </span>
                <Badge 
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    (metrics.channelFatigueSms || 0) >= 70 
                      ? 'border-red-200 text-red-700' 
                      : 'border-green-200 text-green-700'
                  )}
                >
                  {getFatigueLabel(metrics.channelFatigueSms || 0)}
                </Badge>
              </div>
            </div>
            <Progress 
              value={metrics.channelFatigueSms || 0} 
              className="h-2"
            />
          </div>

          {/* Recommendation */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border mt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">{recommendation}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Channel Preference Trend */}
      <div className="mt-4 p-4 rounded-lg border border-border bg-card">
        <h4 className="text-sm font-medium text-foreground mb-3">Preferred Channel Trend</h4>
        {hasChannelTrendData ? (
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {channelTrend.map((item, index) => (
              <div key={index} className="flex flex-col items-center min-w-[40px]">
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center mb-1',
                  item.preferredChannel === 'email' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'bg-green-100 text-green-600'
                )}>
                  {item.preferredChannel === 'email' 
                    ? <Mail className="h-4 w-4" /> 
                    : <MessageSquare className="h-4 w-4" />
                  }
                </div>
                <span className="text-[10px] text-muted-foreground">{item.month}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyChartOverlay
            message="No channel trend data available yet"
            icon="activity"
            height={80}
          />
        )}
      </div>

      {/* Days Since Last Engagement */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <Clock className="h-4 w-4 mx-auto mb-1 text-blue-600" />
          <div className="text-lg font-semibold text-foreground">
            {metrics.daysSinceLastEmail || 0}
          </div>
          <p className="text-[10px] text-muted-foreground">Days since email</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <Clock className="h-4 w-4 mx-auto mb-1 text-green-600" />
          <div className="text-lg font-semibold text-foreground">
            {metrics.daysSinceLastSms || 0}
          </div>
          <p className="text-[10px] text-muted-foreground">Days since SMS</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <Clock className="h-4 w-4 mx-auto mb-1 text-purple-600" />
          <div className="text-lg font-semibold text-foreground">
            {metrics.daysSinceLastLoyalty || 0}
          </div>
          <p className="text-[10px] text-muted-foreground">Days since loyalty</p>
        </div>
      </div>
    </DashboardSection>
  );
};

export default CrossChannelIntelligence;
