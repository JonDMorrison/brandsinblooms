import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  Webhook,
  MailWarning,
  Ban,
  TrendingUp
} from 'lucide-react';
import { SidebarLayout } from '@/components/SidebarLayout';

interface HealthMetric {
  name: string;
  value: number | string;
  status: 'green' | 'yellow' | 'red';
  threshold: string;
  icon: React.ReactNode;
}

interface Alert {
  id: string;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  created_at: string;
}

const AnalyticsHealthPage = () => {
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
        .eq('event_type', 'complaint')
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Get bounce count (last 30 days)
      const { count: bounceCount } = await supabase
        .from('email_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'bounce')
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

      return {
        ingestLagMinutes,
        complaintRate,
        bounceRate,
        complaintCount: complaintCount || 0,
        bounceCount: bounceCount || 0,
        sentCount: sentCount || 0,
        latestEventAt: latestEvent?.created_at,
        staleCampaigns: staleCampaigns || [],
      };
    },
    refetchInterval: 60000, // Refresh every minute
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
      case 'red': return <AlertTriangle className="h-4 w-4 text-red-600" />;
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
                    <span className="font-medium">{healthData?.complaintCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Bounces</span>
                    <span className="font-medium">{healthData?.bounceCount}</span>
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
                          onClick={async () => {
                            await supabase.rpc('recompute_campaign_metrics', {
                              p_campaign_id: campaign.id
                            });
                            refetch();
                          }}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
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
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Ingest Lag</TableCell>
                  <TableCell>≤ 2 minutes</TableCell>
                  <TableCell>2-10 minutes</TableCell>
                  <TableCell>&gt; 10 minutes</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Complaint Rate</TableCell>
                  <TableCell>≤ 0.1%</TableCell>
                  <TableCell>0.1-0.3%</TableCell>
                  <TableCell>&gt; 0.3%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Hard Bounce Rate</TableCell>
                  <TableCell>≤ 2%</TableCell>
                  <TableCell>2-5%</TableCell>
                  <TableCell>&gt; 5%</TableCell>
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
