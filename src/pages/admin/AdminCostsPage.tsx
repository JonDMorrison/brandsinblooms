import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Navigate, Link } from 'react-router-dom';
import { 
  Shield, 
  DollarSign, 
  Mail, 
  MessageSquare, 
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Users,
  ArrowLeft,
  Activity
} from 'lucide-react';
import { format, subDays, startOfMonth } from 'date-fns';

interface TenantUsage {
  tenant_id: string;
  tenant_name: string;
  email_sent: number;
  sms_sent: number;
  sync_jobs: number;
  automations_run: number;
}

interface PlatformMetrics {
  totalEmailsSent: number;
  totalSmsSent: number;
  totalSyncJobs: number;
  totalAutomationsRun: number;
  activeTenants: number;
  avgEmailsPerTenant: number;
  avgSmsPerTenant: number;
}

interface AnomalyTenant {
  tenant_id: string;
  tenant_name: string;
  metric: string;
  value: number;
  average: number;
  multiplier: number;
}

export default function AdminCostsPage() {
  const navigate = useNavigate();
  const { data: isSuperAdmin, isLoading: adminLoading } = useIsSuperAdmin();
  const [loading, setLoading] = useState(true);
  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetrics | null>(null);
  const [topTenants, setTopTenants] = useState<TenantUsage[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyTenant[]>([]);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('month');

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCostData();
    }
  }, [isSuperAdmin, dateRange]);

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return format(now, 'yyyy-MM-dd');
      case 'week':
        return format(subDays(now, 7), 'yyyy-MM-dd');
      case 'month':
        return format(startOfMonth(now), 'yyyy-MM-dd');
      default:
        return format(startOfMonth(now), 'yyyy-MM-dd');
    }
  };

  const fetchCostData = async () => {
    setLoading(true);
    try {
      const startDate = getDateFilter();

      // Fetch email campaigns with sent counts by tenant
      const { data: emailCampaigns } = await supabase
        .from('crm_campaigns')
        .select('tenant_id, total_sent')
        .not('sent_at', 'is', null)
        .gte('sent_at', startDate);

      // Fetch SMS campaigns with counts by tenant
      const { data: smsCampaigns } = await supabase
        .from('crm_sms_campaigns')
        .select('tenant_id, total_enqueued, metrics')
        .not('sent_at', 'is', null)
        .gte('sent_at', startDate);

      // Fetch sync jobs by tenant
      const { data: syncData } = await supabase
        .from('pos_sync_jobs_v2')
        .select('tenant_id, status')
        .gte('created_at', startDate);

      // Fetch automation runs
      const { data: automationData } = await supabase
        .from('automation_events')
        .select('automation_id')
        .gte('created_at', startDate);

      // Fetch tenant names
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name');

      const tenantMap = new Map(tenants?.map(t => [t.id, t.name]) || []);

      // Aggregate by tenant
      const tenantUsageMap = new Map<string, TenantUsage>();

      emailCampaigns?.forEach(c => {
        if (!c.tenant_id) return;
        const existing = tenantUsageMap.get(c.tenant_id) || {
          tenant_id: c.tenant_id,
          tenant_name: tenantMap.get(c.tenant_id) || 'Unknown',
          email_sent: 0,
          sms_sent: 0,
          sync_jobs: 0,
          automations_run: 0
        };
        existing.email_sent += c.total_sent || 0;
        tenantUsageMap.set(c.tenant_id, existing);
      });

      smsCampaigns?.forEach(c => {
        if (!c.tenant_id) return;
        const existing = tenantUsageMap.get(c.tenant_id) || {
          tenant_id: c.tenant_id,
          tenant_name: tenantMap.get(c.tenant_id) || 'Unknown',
          email_sent: 0,
          sms_sent: 0,
          sync_jobs: 0,
          automations_run: 0
        };
        // Get sent count from metrics or fall back to total_enqueued
        const metrics = c.metrics as Record<string, number> | null;
        const sentCount = metrics?.sent || c.total_enqueued || 0;
        existing.sms_sent += sentCount;
        tenantUsageMap.set(c.tenant_id, existing);
      });

      syncData?.forEach(s => {
        if (!s.tenant_id) return;
        const existing = tenantUsageMap.get(s.tenant_id) || {
          tenant_id: s.tenant_id,
          tenant_name: tenantMap.get(s.tenant_id) || 'Unknown',
          email_sent: 0,
          sms_sent: 0,
          sync_jobs: 0,
          automations_run: 0
        };
        existing.sync_jobs++;
        tenantUsageMap.set(s.tenant_id, existing);
      });

      const allTenants = Array.from(tenantUsageMap.values());

      // Calculate platform metrics
      const totalEmails = allTenants.reduce((sum, t) => sum + t.email_sent, 0);
      const totalSms = allTenants.reduce((sum, t) => sum + t.sms_sent, 0);
      const totalSync = allTenants.reduce((sum, t) => sum + t.sync_jobs, 0);
      const activeTenantCount = allTenants.filter(t => t.email_sent > 0 || t.sms_sent > 0).length;

      setPlatformMetrics({
        totalEmailsSent: totalEmails,
        totalSmsSent: totalSms,
        totalSyncJobs: totalSync,
        totalAutomationsRun: automationData?.length || 0,
        activeTenants: activeTenantCount,
        avgEmailsPerTenant: activeTenantCount > 0 ? Math.round(totalEmails / activeTenantCount) : 0,
        avgSmsPerTenant: activeTenantCount > 0 ? Math.round(totalSms / activeTenantCount) : 0,
      });

      // Top 10 by total usage
      const sorted = allTenants
        .map(t => ({ ...t, total: t.email_sent + t.sms_sent * 10 + t.sync_jobs }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
      setTopTenants(sorted);

      // Find anomalies (>3x average)
      const avgEmail = activeTenantCount > 0 ? totalEmails / activeTenantCount : 0;
      const avgSms = activeTenantCount > 0 ? totalSms / activeTenantCount : 0;
      const avgSync = activeTenantCount > 0 ? totalSync / activeTenantCount : 0;

      const anomalyList: AnomalyTenant[] = [];
      allTenants.forEach(t => {
        if (avgEmail > 0 && t.email_sent > avgEmail * 3) {
          anomalyList.push({
            tenant_id: t.tenant_id,
            tenant_name: t.tenant_name,
            metric: 'Emails',
            value: t.email_sent,
            average: Math.round(avgEmail),
            multiplier: Math.round(t.email_sent / avgEmail * 10) / 10
          });
        }
        if (avgSms > 0 && t.sms_sent > avgSms * 3) {
          anomalyList.push({
            tenant_id: t.tenant_id,
            tenant_name: t.tenant_name,
            metric: 'SMS',
            value: t.sms_sent,
            average: Math.round(avgSms),
            multiplier: Math.round(t.sms_sent / avgSms * 10) / 10
          });
        }
        if (avgSync > 0 && t.sync_jobs > avgSync * 3) {
          anomalyList.push({
            tenant_id: t.tenant_id,
            tenant_name: t.tenant_name,
            metric: 'Sync Jobs',
            value: t.sync_jobs,
            average: Math.round(avgSync),
            multiplier: Math.round(t.sync_jobs / avgSync * 10) / 10
          });
        }
      });

      setAnomalies(anomalyList.sort((a, b) => b.multiplier - a.multiplier));

    } catch (error) {
      console.error('Error fetching cost data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/admin">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <h1 className="text-3xl font-bold">Cost Dashboard</h1>
                <p className="text-muted-foreground">Platform resource usage and cost monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex border rounded-lg overflow-hidden">
                {(['today', 'week', 'month'] as const).map(range => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      dateRange === range 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </button>
                ))}
              </div>
              <Button onClick={fetchCostData} variant="outline" size="icon">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Platform Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Emails Sent</p>
                  {loading ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{platformMetrics?.totalEmailsSent.toLocaleString()}</p>
                  )}
                </div>
                <Mail className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                ~${((platformMetrics?.totalEmailsSent || 0) * 0.001).toFixed(2)} est. cost
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">SMS Sent</p>
                  {loading ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{platformMetrics?.totalSmsSent.toLocaleString()}</p>
                  )}
                </div>
                <MessageSquare className="h-8 w-8 text-purple-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                ~${((platformMetrics?.totalSmsSent || 0) * 0.0079).toFixed(2)} est. cost
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">POS Sync Jobs</p>
                  {loading ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{platformMetrics?.totalSyncJobs.toLocaleString()}</p>
                  )}
                </div>
                <RefreshCw className="h-8 w-8 text-green-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Edge function invocations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Tenants</p>
                  {loading ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{platformMetrics?.activeTenants}</p>
                  )}
                </div>
                <Users className="h-8 w-8 text-amber-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Avg: {platformMetrics?.avgEmailsPerTenant} emails/tenant
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Anomalies Alert */}
        {anomalies.length > 0 && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                Usage Anomalies Detected
              </CardTitle>
              <CardDescription>
                These tenants are using {'>'}3x more resources than average
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {anomalies.slice(0, 5).map((anomaly, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                    <div>
                      <p className="font-medium">{anomaly.tenant_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {anomaly.metric}: {anomaly.value.toLocaleString()} (avg: {anomaly.average.toLocaleString()})
                      </p>
                    </div>
                    <Badge variant="destructive">
                      {anomaly.multiplier}x average
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Tenants */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top 10 Resource Consumers
            </CardTitle>
            <CardDescription>
              Tenants with highest combined usage this {dateRange}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : topTenants.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No usage data found for this period</p>
            ) : (
              <div className="space-y-2">
                {topTenants.map((tenant, idx) => (
                  <div 
                    key={tenant.tenant_id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="font-medium">{tenant.tenant_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {tenant.tenant_id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="font-medium">{tenant.email_sent.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Emails</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{tenant.sms_sent.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">SMS</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{tenant.sync_jobs}</p>
                        <p className="text-xs text-muted-foreground">Syncs</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cost Estimation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Estimated Platform Costs ({dateRange})
            </CardTitle>
            <CardDescription>
              Based on current usage rates and provider pricing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">Resend (Email)</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                  ${((platformMetrics?.totalEmailsSent || 0) * 0.001).toFixed(2)}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-500">$0.001/email after free tier</p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-700 dark:text-purple-400 font-medium">Twilio (SMS)</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">
                  ${((platformMetrics?.totalSmsSent || 0) * 0.0079).toFixed(2)}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-500">~$0.0079/SMS (US)</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium">Supabase Edge</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-300">
                  ${((platformMetrics?.totalSyncJobs || 0) * 0.000002).toFixed(4)}
                </p>
                <p className="text-xs text-green-600 dark:text-green-500">~$0.000002/invocation</p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">Estimated Total ({dateRange})</span>
                <span className="text-2xl font-bold">
                  ${(
                    (platformMetrics?.totalEmailsSent || 0) * 0.001 +
                    (platformMetrics?.totalSmsSent || 0) * 0.0079 +
                    (platformMetrics?.totalSyncJobs || 0) * 0.000002
                  ).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
