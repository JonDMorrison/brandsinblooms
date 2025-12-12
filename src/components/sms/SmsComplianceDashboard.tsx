import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSmsComplianceStats } from '@/hooks/useSmsComplianceStats';
import { 
  Ban, 
  UserCheck, 
  HelpCircle, 
  AlertTriangle, 
  ShieldAlert,
  Phone,
  Filter,
  MessageSquareOff,
  RefreshCw,
  TrendingDown,
  TrendingUp
} from 'lucide-react';

interface SmsComplianceDashboardProps {
  className?: string;
}

const SmsComplianceDashboard: React.FC<SmsComplianceDashboardProps> = ({ className }) => {
  const [dateRange] = useState<{ startDate?: Date; endDate?: Date }>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    endDate: new Date(),
  });
  
  const { stats, loading, error, refetch } = useSmsComplianceStats(dateRange);

  if (loading) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasA2PErrors = stats && stats.a2pErrors > 0;
  const hasHighOptOutRate = stats && stats.optOutRate > 2;

  return (
    <div className={className}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              SMS Compliance Dashboard
            </CardTitle>
            <CardDescription>
              Last 30 days compliance events and carrier errors
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Warnings */}
          {(hasA2PErrors || hasHighOptOutRate) && (
            <div className="space-y-2">
              {hasA2PErrors && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>A2P 10DLC Registration Issues</AlertTitle>
                  <AlertDescription>
                    {stats?.a2pErrors} messages failed due to unregistered 10DLC. 
                    Check your Twilio A2P campaign registration.
                  </AlertDescription>
                </Alert>
              )}
              {hasHighOptOutRate && (
                <Alert>
                  <TrendingDown className="h-4 w-4" />
                  <AlertTitle>High Opt-Out Rate</AlertTitle>
                  <AlertDescription>
                    Your opt-out rate is {stats?.optOutRate.toFixed(2)}%. 
                    Consider reviewing your messaging frequency and content.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Opt-in/Opt-out Stats */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Consent Events</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Ban className="h-5 w-5 text-red-500" />}
                label="STOP (Opt-Out)"
                value={stats?.stopCount || 0}
                trend={stats?.optOutRate ? `${stats.optOutRate.toFixed(2)}% rate` : undefined}
                trendNegative={hasHighOptOutRate}
              />
              <StatCard
                icon={<UserCheck className="h-5 w-5 text-green-500" />}
                label="START (Opt-In)"
                value={stats?.startCount || 0}
              />
              <StatCard
                icon={<HelpCircle className="h-5 w-5 text-blue-500" />}
                label="HELP Requests"
                value={stats?.helpCount || 0}
              />
              <StatCard
                icon={<TrendingUp className="h-5 w-5 text-muted-foreground" />}
                label="Total Events"
                value={stats?.totalEvents || 0}
              />
            </div>
          </div>

          {/* Carrier Error Stats */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Carrier Errors</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard
                icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
                label="A2P 10DLC"
                value={stats?.a2pErrors || 0}
                badge={stats?.a2pErrors && stats.a2pErrors > 0 ? 'Critical' : undefined}
                badgeVariant="destructive"
              />
              <StatCard
                icon={<Filter className="h-5 w-5 text-orange-500" />}
                label="Carrier Filtering"
                value={stats?.carrierFiltering || 0}
              />
              <StatCard
                icon={<Phone className="h-5 w-5 text-yellow-500" />}
                label="Invalid Numbers"
                value={stats?.invalidNumbers || 0}
              />
              <StatCard
                icon={<ShieldAlert className="h-5 w-5 text-red-400" />}
                label="Spam Detection"
                value={stats?.spamDetection || 0}
              />
              <StatCard
                icon={<MessageSquareOff className="h-5 w-5 text-purple-500" />}
                label="Content Rejection"
                value={stats?.contentRejection || 0}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend?: string;
  trendNegative?: boolean;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

const StatCard: React.FC<StatCardProps> = ({ 
  icon, 
  label, 
  value, 
  trend, 
  trendNegative,
  badge,
  badgeVariant = 'default'
}) => (
  <div className="p-4 rounded-lg border bg-card">
    <div className="flex items-center justify-between mb-2">
      {icon}
      {badge && (
        <Badge variant={badgeVariant} className="text-xs">
          {badge}
        </Badge>
      )}
    </div>
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-sm text-muted-foreground">{label}</div>
    {trend && (
      <div className={`text-xs mt-1 ${trendNegative ? 'text-red-500' : 'text-muted-foreground'}`}>
        {trend}
      </div>
    )}
  </div>
);

export default SmsComplianceDashboard;
