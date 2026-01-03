import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  Webhook,
  MailWarning,
  Ban,
  TrendingUp,
  ShieldAlert,
  XCircle,
  Bell
} from 'lucide-react';
import { SidebarLayout } from '@/components/SidebarLayout';
import { toast } from 'sonner';

interface HealthMetric {
  name: string;
  value: number | string;
  status: 'green' | 'yellow' | 'red';
  threshold: string;
  icon: React.ReactNode;
}

interface AnalyticsAlert {
  id: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  created_at: string;
  resolved_at?: string;
}

const AnalyticsHealthPage = () => {
  const queryClient = useQueryClient();

  // Fetch health metrics
  const { data: healthData, isLoading, refetch } = useQuery({
    queryKey: ['analytics-health'],
    queryFn: async () => {
      // Get latest event timestamp for ingest lag
      const { data: latestEvent } = await supabase
        .from('email_tracking_events')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get complaint count (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: complaintCount } = await supabase
        .from('email_tracking_events')
        .select('*', { count: 'exact', head: true })
        .in('event_type', ['complaint', 'complained'])
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Get bounce count (last 30 days)
      const { count: bounceCount } = await supabase
        .from('email_tracking_events')
        .select('*', { count: 'exact', head: true })
        .in('event_type', ['bounce', 'bounced'])
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Get total sent (last 30 days)
      const { count: sentCount } = await supabase
        .from('email_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'sent')
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Get stale campaigns (rollup older than latest event)
      const { data: staleCampaigns } = await supabase
        .from('crm_campaigns')
        .select('id, name, rollup_refreshed_at')
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(10);

      // Calculate rates
      const complaintRate = sentCount && sentCount > 0 ? ((complaintCount || 0) / sentCount) * 100 : 0;
      const bounceRate = sentCount && sentCount > 0 ? ((bounceCount || 0) / sentCount) * 100 : 0;

      // Calculate ingest lag
      let ingestLagMinutes = 0;
      if (latestEvent?.created_at) {
        const eventTime = new Date(latestEvent.created_at).getTime();
        const now = Date.now();
        ingestLagMinutes = Math.floor((now - eventTime) / (1000 * 60));
      }

      // Check and store alerts for threshold breaches
      const alerts: AnalyticsAlert[] = [];
      const now = new Date().toISOString();

      if (complaintRate > 0.3) {
        alerts.push({
          id: `complaint_${Date.now()}`,
          metric: 'complaint_rate',
          value: complaintRate,
          threshold: 0.3,
          severity: 'critical',
          created_at: now,
        });
      } else if (complaintRate > 0.1) {
        alerts.push({
          id: `complaint_${Date.now()}`,
          metric: 'complaint_rate',
          value: complaintRate,
          threshold: 0.1,
          severity: 'warning',
          created_at: now,
        });
      }

      if (bounceRate > 5) {
        alerts.push({
          id: `bounce_${Date.now()}`,
          metric: 'bounce_rate',
          value: bounceRate,
          threshold: 5,
          severity: 'critical',
          created_at: now,
        });
      } else if (bounceRate > 2) {
        alerts.push({
          id: `bounce_${Date.now()}`,
          metric: 'bounce_rate',
          value: bounceRate,
          threshold: 2,
          severity: 'warning',
          created_at: now,
        });
      }

      if (ingestLagMinutes > 10) {
        alerts.push({
          id: `ingest_${Date.now()}`,
          metric: 'ingest_lag',
          value: ingestLagMinutes,
          threshold: 10,
          severity: 'critical',
          created_at: now,
        });
      } else if (ingestLagMinutes > 2) {
        alerts.push({
          id: `ingest_${Date.now()}`,
          metric: 'ingest_lag',
          value: ingestLagMinutes,
          threshold: 2,
          severity: 'warning',
          created_at: now,
        });
      }

      return {
        ingestLagMinutes,
        complaintRate,
        bounceRate,
        complaintCount: complaintCount || 0,
        bounceCount: bounceCount || 0,
        sentCount: sentCount || 0,
        latestEventAt: latestEvent?.created_at,
        staleCampaigns: staleCampaigns || [],
        alerts,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Recompute mutation
  const recomputeMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase.rpc('recompute_campaign_metrics', {
        p_campaign_id: campaignId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Metrics recomputed');
      queryClient.invalidateQueries({ queryKey: ['analytics-health'] });
    },
    onError: () => {
      toast.error('Failed to recompute metrics');
    },
  });

  // Build metrics array
  const metrics: HealthMetric[] = healthData ? [
    {
      name: 'Ingest Lag',
      value: `${healthData.ingestLagMinutes} min`,
      status: healthData.ingestLagMinutes <= 2 ? 'green' : healthData.ingestLagMinutes <= 10 ? 'yellow' : 'red',
      threshold: '< 2 min green, < 10 min yellow',
      icon: <Clock className="h-5 w-5" />,
    },
    {
      name: 'Complaint Rate (30d)',
      value: `${healthData.complaintRate.toFixed(3)}%`,
      status: healthData.complaintRate <= 0.1 ? 'green' : healthData.complaintRate <= 0.3 ? 'yellow' : 'red',
      threshold: '< 0.1% green, < 0.3% yellow',
      icon: <MailWarning className="h-5 w-5" />,
    },
    {
      name: 'Hard Bounce Rate (30d)',
      value: `${healthData.bounceRate.toFixed(2)}%`,
      status: healthData.bounceRate <= 2 ? 'green' : healthData.bounceRate <= 5 ? 'yellow' : 'red',
      threshold: '< 2% green, < 5% yellow',
      icon: <Ban className="h-5 w-5" />,
    },
    {
      name: 'Events Processed (30d)',
      value: healthData.sentCount.toLocaleString(),
      status: 'green',
      threshold: 'Info only',
      icon: <TrendingUp className="h-5 w-5" />,
    },
  ] : [];

  const getStatusColor = (status: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green': return 'bg-green-500/10 text-green-600 border-green-200';
      case 'yellow': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
      case 'red': return 'bg-red-500/10 text-red-600 border-red-200';
    }
  };

  const getStatusIcon = (status: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'yellow': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'red': return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  return (
    <SidebarLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Analytics Health</h1>
            <p className="text-muted-foreground">
              Monitor webhook processing, event ingestion, and deliverability metrics
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Active Alerts */}
        {healthData?.alerts && healthData.alerts.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <Bell className="h-5 w-5" />
                Active Alerts ({healthData.alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {healthData.alerts.map((alert) => (
                  <div 
                    key={alert.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      alert.severity === 'critical' 
                        ? 'bg-red-100 dark:bg-red-900/30' 
                        : 'bg-yellow-100 dark:bg-yellow-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {alert.severity === 'critical' 
                        ? <XCircle className="h-5 w-5 text-red-600" />
                        : <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      }
                      <div>
                        <p className="font-medium">
                          {alert.metric === 'complaint_rate' && 'Complaint Rate Threshold'}
                          {alert.metric === 'bounce_rate' && 'Bounce Rate Threshold'}
                          {alert.metric === 'ingest_lag' && 'Ingest Lag Threshold'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Current: {typeof alert.value === 'number' ? alert.value.toFixed(2) : alert.value}
                          {alert.metric.includes('rate') ? '%' : ' min'} (Threshold: {alert.threshold}
                          {alert.metric.includes('rate') ? '%' : ' min'})
                        </p>
                      </div>
                    </div>
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {alert.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Health Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            metrics.map((metric, idx) => (
              <Card key={idx} className={`border ${getStatusColor(metric.status)}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{metric.name}</p>
                      <p className="text-2xl font-bold">{metric.value}</p>
                      <p className="text-xs text-muted-foreground">{metric.threshold}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {metric.icon}
                      {getStatusIcon(metric.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* System Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Webhook Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhook Status
              </CardTitle>
              <CardDescription>
                Real-time event ingestion from email providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Resend Webhook</span>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600">
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Signature Verification</span>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600">
                    Enabled
                  </Badge>
                </div>
                {healthData?.latestEventAt && (
                  <div className="text-sm text-muted-foreground">
                    Last event: {formatDistanceToNow(new Date(healthData.latestEventAt), { addSuffix: true })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>30-Day Summary</CardTitle>
              <CardDescription>
                Email delivery and engagement overview
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Emails Sent</span>
                    <span className="font-medium">{healthData?.sentCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Complaints</span>
                    <span className={`font-medium ${healthData?.complaintRate && healthData.complaintRate > 0.1 ? 'text-red-600' : ''}`}>
                      {healthData?.complaintCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Bounces</span>
                    <span className={`font-medium ${healthData?.bounceRate && healthData.bounceRate > 2 ? 'text-orange-600' : ''}`}>
                      {healthData?.bounceCount}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stale Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaigns - Metric Freshness</CardTitle>
            <CardDescription>
              Campaigns with potentially stale analytics that may need recomputation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : healthData?.staleCampaigns && healthData.staleCampaigns.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Last Refreshed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {healthData.staleCampaigns.map((campaign: any) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>
                        {campaign.rollup_refreshed_at ? (
                          formatDistanceToNow(new Date(campaign.rollup_refreshed_at), { addSuffix: true })
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => recomputeMutation.mutate(campaign.id)}
                          disabled={recomputeMutation.isPending}
                        >
                          <RefreshCw className={`h-4 w-4 mr-1 ${recomputeMutation.isPending ? 'animate-spin' : ''}`} />
                          Recompute
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No sent campaigns found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Thresholds Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Health Thresholds Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Green</TableHead>
                  <TableHead>Yellow</TableHead>
                  <TableHead>Red</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Ingest Lag</TableCell>
                  <TableCell>≤ 2 minutes</TableCell>
                  <TableCell>2-10 minutes</TableCell>
                  <TableCell>&gt; 10 minutes</TableCell>
                  <TableCell className="text-muted-foreground">Check webhook delivery</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Complaint Rate</TableCell>
                  <TableCell>≤ 0.1%</TableCell>
                  <TableCell>0.1-0.3%</TableCell>
                  <TableCell>&gt; 0.3%</TableCell>
                  <TableCell className="text-muted-foreground">Review list hygiene</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Hard Bounce Rate</TableCell>
                  <TableCell>≤ 2%</TableCell>
                  <TableCell>2-5%</TableCell>
                  <TableCell>&gt; 5%</TableCell>
                  <TableCell className="text-muted-foreground">Clean email list</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Webhook 5xx Rate</TableCell>
                  <TableCell>≤ 1%</TableCell>
                  <TableCell>1-5%</TableCell>
                  <TableCell>&gt; 5%</TableCell>
                  <TableCell className="text-muted-foreground">Check edge function logs</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
};

export default AnalyticsHealthPage;
