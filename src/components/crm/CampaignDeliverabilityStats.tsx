import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Mail, 
  CheckCircle2, 
  Eye, 
  MousePointerClick, 
  AlertTriangle, 
  XCircle,
  UserMinus,
  ShieldX
} from 'lucide-react';
import { useCampaignDeliverabilityStats } from '@/hooks/useDeliverabilityStats';

interface CampaignDeliverabilityStatsProps {
  campaignId: string;
  className?: string;
}

export const CampaignDeliverabilityStats: React.FC<CampaignDeliverabilityStatsProps> = ({
  campaignId,
  className = ''
}) => {
  const { data: stats, isLoading, error } = useCampaignDeliverabilityStats(campaignId);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Email Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return null;
  }

  const { sent, delivered, opened, clicked, bounced, complained, unsubscribed } = stats;
  const hasData = sent > 0;

  if (!hasData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Email Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No delivery data yet. Stats will appear after emails are sent.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Email Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Main metrics grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <MetricCard
            icon={<Mail className="h-4 w-4" />}
            label="Sent"
            value={sent}
            color="text-blue-600"
          />
          <MetricCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Delivered"
            value={delivered}
            rate={stats.deliveryRate}
            color="text-green-600"
          />
          <MetricCard
            icon={<Eye className="h-4 w-4" />}
            label="Opened"
            value={opened}
            rate={stats.openRate}
            color="text-purple-600"
          />
          <MetricCard
            icon={<MousePointerClick className="h-4 w-4" />}
            label="Clicked"
            value={clicked}
            rate={stats.clickRate}
            color="text-orange-600"
          />
        </div>

        {/* Problem indicators */}
        {(bounced > 0 || complained > 0 || unsubscribed > 0 || stats.skipped > 0) && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {stats.skipped > 0 && (
              <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-700 dark:bg-amber-950">
                <ShieldX className="h-3 w-3" />
                {stats.skipped} skipped
                {Object.keys(stats.skippedReasons).length > 0 && (
                  <span className="ml-1 text-xs opacity-75">
                    ({Object.entries(stats.skippedReasons).map(([r, c]) => `${c} ${r}`).join(', ')})
                  </span>
                )}
              </Badge>
            )}
            {bounced > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                {bounced} bounced ({stats.bounceRate.toFixed(1)}%)
              </Badge>
            )}
            {complained > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {complained} complaints
              </Badge>
            )}
            {unsubscribed > 0 && (
              <Badge variant="secondary" className="gap-1">
                <UserMinus className="h-3 w-3" />
                {unsubscribed} unsubscribed
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  rate?: number;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, rate, color }) => (
  <div className="text-center p-3 bg-muted/50 rounded-lg">
    <div className={`flex items-center justify-center gap-1 ${color} mb-1`}>
      {icon}
    </div>
    <div className="text-xl font-bold">{value.toLocaleString()}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
    {rate !== undefined && rate > 0 && (
      <div className="text-xs text-muted-foreground mt-1">
        {rate.toFixed(1)}%
      </div>
    )}
  </div>
);
