import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle, XCircle, Info, Shield } from 'lucide-react';
import { useListHealth } from '@/hooks/analytics/useListHealth';
import { Skeleton } from '@/components/ui/skeleton';

export const ListHealthCard: React.FC = () => {
  const health = useListHealth();

  if (health.loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = () => {
    switch (health.healthStatus) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const getStatusBadge = () => {
    const variants = {
      healthy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return (
      <Badge className={variants[health.healthStatus]}>
        {health.healthStatus.charAt(0).toUpperCase() + health.healthStatus.slice(1)}
      </Badge>
    );
  };

  // Calculate health score (inverse of problem rates)
  const healthScore = Math.max(0, 100 - (health.bounceRate * 10) - (health.complaintRate * 100));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            List Health
          </CardTitle>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            {getStatusBadge()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Score Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Health Score</span>
            <span className="text-lg font-bold">{Math.round(healthScore)}%</span>
          </div>
          <Progress 
            value={healthScore} 
            className={`h-3 ${
              health.healthStatus === 'critical' ? '[&>div]:bg-red-500' :
              health.healthStatus === 'warning' ? '[&>div]:bg-yellow-500' :
              '[&>div]:bg-green-500'
            }`}
          />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="text-left">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Bounce Rate
                    <Info className="h-3 w-3" />
                  </p>
                  <p className={`text-xl font-bold ${
                    health.bounceRate >= 5 ? 'text-red-600' :
                    health.bounceRate >= 2 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {health.bounceRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {health.bounceCount30d} bounces / {health.totalSent30d} sent
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Keep below 2% to maintain good deliverability.</p>
                <p>Above 5% may trigger ISP blocks.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="text-left">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Complaint Rate
                    <Info className="h-3 w-3" />
                  </p>
                  <p className={`text-xl font-bold ${
                    health.complaintRate >= 0.3 ? 'text-red-600' :
                    health.complaintRate >= 0.1 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {health.complaintRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {health.complaintCount30d} complaints
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Keep below 0.1% to avoid reputation damage.</p>
                <p>Above 0.3% may result in blacklisting.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Suppression Info */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
          <span className="text-sm text-muted-foreground">Suppressed Contacts</span>
          <Badge variant="secondary">{health.suppressedCount}</Badge>
        </div>

        {/* Warning Messages */}
        {health.healthStatus !== 'healthy' && (
          <div className={`p-3 rounded-lg text-sm ${
            health.healthStatus === 'critical' 
              ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
              : 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
          }`}>
            {health.healthStatus === 'critical' ? (
              <p>⚠️ Your list health is critical. Clean your list and review your sending practices immediately.</p>
            ) : (
              <p>⚡ Your list health needs attention. Consider cleaning invalid addresses.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ListHealthCard;
