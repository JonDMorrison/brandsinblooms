import React from 'react';
import { cn } from '@/lib/utils';
import { DashboardSection } from './DashboardSection';
import { Sparkline } from '@/components/ui/sparkline';
import { TimelineChart } from '@/components/charts/TimelineChart';
import { EmptyChartOverlay } from '@/components/ui/empty-chart-overlay';
import { Activity, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface EngagementHealthOverviewProps {
  metrics: {
    engagementScore?: number;
    engagementTrend?: number[];
    daysSinceLastEngagement?: number;
    engagementVelocity?: number;
    emailInteractions7d?: number;
    emailInteractions30d?: number;
    smsInteractions7d?: number;
    smsInteractions30d?: number;
  };
  timelineData?: Array<{
    date: string;
    engagement?: number;
    email?: number;
    sms?: number;
  }>;
  className?: string;
}

const getEngagementColor = (score: number): string => {
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-600';
};

const getEngagementLabel = (score: number): string => {
  if (score >= 70) return 'Healthy';
  if (score >= 40) return 'At Risk';
  return 'Critical';
};

export const EngagementHealthOverview: React.FC<EngagementHealthOverviewProps> = ({
  metrics,
  timelineData = [],
  className,
}) => {
  const velocityTrend = (metrics.engagementVelocity || 0) >= 0;
  const hasTimelineData = timelineData.length > 0 && timelineData.some(d => (d.engagement || 0) > 0);

  return (
    <DashboardSection
      title="Engagement Health Overview"
      icon={<Activity className="h-4 w-4" />}
      tooltip="Track overall engagement patterns across all channels over time"
      className={className}
    >
      {/* Main Chart */}
      <div className="mb-6 relative">
        {hasTimelineData ? (
          <TimelineChart
            data={timelineData.map(d => ({
              date: d.date,
              engagement: d.engagement,
            }))}
            height={180}
            showOrders={false}
            showRevenue={false}
            showEngagement={true}
          />
        ) : (
          <EmptyChartOverlay
            message="No engagement timeline data available yet"
            icon="line"
            height={180}
          />
        )}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Engagement Score */}
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              'text-2xl font-bold',
              getEngagementColor(metrics.engagementScore || 0)
            )}>
              {metrics.engagementScore || 0}
            </div>
            {metrics.engagementTrend && metrics.engagementTrend.length > 1 && (
              <Sparkline
                data={metrics.engagementTrend}
                width={48}
                height={20}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Score: <span className={getEngagementColor(metrics.engagementScore || 0)}>
              {getEngagementLabel(metrics.engagementScore || 0)}
            </span>
          </p>
        </div>

        {/* Days Since Engagement */}
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className={cn(
              'text-2xl font-bold',
              (metrics.daysSinceLastEngagement || 0) > 14 ? 'text-amber-600' : 'text-foreground'
            )}>
              {metrics.daysSinceLastEngagement || 0}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Days Since Engagement</p>
        </div>

        {/* Engagement Velocity */}
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 mb-2">
            {velocityTrend ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span className={cn(
              'text-2xl font-bold',
              velocityTrend ? 'text-green-600' : 'text-red-600'
            )}>
              {velocityTrend ? '+' : ''}{metrics.engagementVelocity || 0}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Velocity (vs. last period)</p>
        </div>

        {/* Channel Activity */}
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between mb-2">
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">
                {metrics.emailInteractions7d || 0}
              </div>
              <div className="text-[10px] text-muted-foreground">Email</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">
                {metrics.smsInteractions7d || 0}
              </div>
              <div className="text-[10px] text-muted-foreground">SMS</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">7-Day Interactions</p>
        </div>
      </div>
    </DashboardSection>
  );
};

export default EngagementHealthOverview;
